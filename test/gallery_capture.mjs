// node test/gallery_capture.mjs : plays one local game and screenshots, at every phase of every round,
// one team director (phone), one outside/street player (phone) and the projector. Output: test/gallery/ + manifest.json
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x'));
const { chromium } = require('playwright');
const out = join(root, 'test', 'gallery'); rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const PORT = 8132, base = 'http://localhost:' + PORT + '/';
const srv = spawn(process.execPath, [join(root, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const shots = []; const shot = async (p, view, step, label, full = true) => {
  const f = `${String(shots.length).padStart(3, '0')}_${view}.png`;
  await p.screenshot({ path: join(out, f), fullPage: full }); shots.push({ file: f, view, step, label }); };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage(); await admin.setViewportSize({ width: 1280, height: 900 });
  await admin.goto(base + 'admin.html'); await admin.click('#new'); await admin.waitForSelector('#start');
  const code = new URL(admin.url()).searchParams.get('g');
  const proj = await ctx.newPage(); await proj.setViewportSize({ width: 1400, height: 900 });
  await proj.goto(base + 'projector.html?g=' + code);
  const join1 = await ctx.newPage(); await join1.setViewportSize({ width: 390, height: 844 });
  await join1.goto(base + 'index.html?g=' + code);
  await shot(join1, 'team', 'Lobby', 'Join screen');
  const ps = [];
  for (let i = 0; i < 14; i++) {
    const p = i === 0 ? join1 : await ctx.newPage(); if (i) { await p.setViewportSize({ width: 390, height: 844 }); await p.goto(base + 'index.html?g=' + code); }
    await p.fill('#name', 'Student ' + (i + 1)); await p.click('#go'); await p.waitForURL(/play\.html/); ps.push(p);
  }
  for (let k = 0; k < 4; k++) await admin.click('#bots');
  await admin.waitForTimeout(1500);
  await shot(ps[0], 'team', 'Lobby', 'Waiting room (not placed yet)'); await shot(proj, 'projector', 'Lobby', 'Lobby', false); await shot(admin, 'admin', 'Lobby', 'Host: waiting room, nobody placed');
  await admin.click('#tmbox summary');
  for (const k of ['shock', 'play', 'outside']) await admin.fill('#tm_' + k, k === 'play' ? '1' : '10');
  await admin.click('#savetm');
  await admin.selectOption('#nb', '5');
  await admin.click('#auto2'); await admin.waitForTimeout(1500);
  await shot(ps[0], 'team', 'Lobby', 'Waiting room (placed by the host)'); await shot(admin, 'admin', 'Lobby', 'Host: assign boards and roles');
  await admin.click('#start'); await admin.waitForTimeout(800);
  // pick one director (made Chair) and one street player among the real students
  const pick = await admin.evaluate(() => { const st = window.__host.state; let dir = null, street = null;
    for (let i = 1; i <= 14; i++) { const me = st.players.find(p => p.name === 'Student ' + i), s = me && st.seats[me.id]; if (!s) continue;
      if (s.kind === 'director' && dir === null) { dir = i - 1; st.boards[s.board].chair = me.id; } if (s.kind === 'street' && street === null) street = i - 1; }
    window.__host.dirty = true; return { dir, street }; });
  console.log('picked', pick);
  const team = ps[pick.dir ?? 0], outside = pick.street != null ? ps[pick.street] : null;
  const state = () => admin.evaluate(() => ({ ph: window.__host.state.phase, r: window.__host.state.round }));
  let last = '', t0 = Date.now(), acted = {};
  while (Date.now() - t0 < 600000) {
    const s = await state(), key = s.ph + ':' + s.r;
    if (key !== last) {
      last = key; await admin.waitForTimeout(2500);
      const step = s.ph === 'reveal' ? 'Reveal' : `Round ${s.r} · ${s.ph}`;
      await shot(team, 'team', step, 'Team (director)'); if (outside) await shot(outside, 'outside', step, 'Outside player');
      await shot(proj, 'projector', step, 'Projector', s.ph === 'reveal');
      if (s.ph === 'reveal') break;
      if (s.ph === 'play' && !acted[key]) { acted[key] = 1;
        try { // the chair works the three steps and locks, like a real student would
          const cb = team.locator('#chatbtn'); if (await cb.isVisible()) { await cb.click(); await team.fill('#msg', 'Do we really want to leave that fact out?'); await team.click('#send'); await team.waitForTimeout(400); await shot(team, 'team', step, 'Team chat sheet', false); await team.click('#chatx'); }
          else { await team.fill('#msg', 'Do we really want to leave that fact out?'); await team.click('#send'); }
          await team.click('[data-go="0"]');
          for (const k of [0, 1]) await team.locator('[data-fact]').nth(k).check({ timeout: 3000 }).catch(() => {});
          await shot(team, 'team', step, '1 Facts: switches, bars, price cost');
          await team.click('[data-go="1"]');
          if (await team.$('#stmt')) await team.fill('#stmt', 'We are reviewing the matter and will report what we find.');
          await shot(team, 'team', step, '2 Statement');
          if (await team.$('[data-a=calld]')) { await team.click('[data-a=calld]'); await team.waitForSelector('[data-fsubmit]', { timeout: 5000 }); await shot(team, 'team', step, 'Facts vote open', false); await team.click('[data-fsubmit]'); await team.waitForTimeout(800);
            const cl = await team.$('[data-a=close]'); if (cl) await cl.click().catch(() => {}); await team.waitForTimeout(1200); await shot(team, 'team', step, 'Facts and statement locked'); }
          await team.click('[data-go="2"]'); await team.locator('.mhead').first().click(); await shot(team, 'team', step, '3 Motion: the one headline vote');
          if (await team.$('[data-callm]')) { await team.click('[data-callm]'); await team.waitForTimeout(900); await shot(team, 'team', step, 'Motion vote open', false); const y = await team.$('[data-ballot="yes"]'); if (y) { await y.click(); await team.waitForTimeout(500); } }
        } catch (e) { console.log('team act skipped', e.message.slice(0, 80)); }
        if (outside) try { const tg = await outside.$('[data-tgt]'); if (tg) { await tg.click(); await outside.waitForTimeout(1000); await shot(outside, 'outside', step, 'Outside picks a target'); } } catch {}
      }
    }
    const btn = await admin.$('#adv'); if (btn && (await btn.textContent()).trim() === 'Reveal') await btn.click();
    await admin.waitForTimeout(1000);
  }
  await shot(admin, 'admin', 'Reveal', 'Host at end');
} finally { writeFileSync(join(out, 'manifest.json'), JSON.stringify(shots, null, 1)); await browser.close(); srv.kill(); }
console.log(shots.length + ' shots');
