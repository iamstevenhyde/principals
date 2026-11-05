// node test/headless.mjs : drives a full local-mode game in headless Chrome (global playwright, system Chrome).
// Admin + projector + 2 real player tabs (phone and laptop width) + simulated players. Screenshots to test/shots/.
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x'));
const { chromium } = require('playwright');
const shots = join(root, 'test', 'shots'); mkdirSync(shots, { recursive: true });
const PORT = 8131, base = 'http://localhost:' + PORT + '/';
const srv = spawn(process.execPath, [join(root, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const errs = [];
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext();
  const watch = (p, name) => { p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); }); return p; };
  const admin = watch(await ctx.newPage(), 'admin');
  await admin.goto(base + 'admin.html');
  await admin.click('#new');
  await admin.waitForSelector('#start');
  const code = new URL(admin.url()).searchParams.get('g');
  ok(!!code, 'game created ' + code);
  const proj = watch(await ctx.newPage(), 'projector'); await proj.setViewportSize({ width: 1400, height: 900 });
  await proj.goto(base + 'projector.html?g=' + code);
  const players = [];
  for (const [i, vp] of [[0, { width: 390, height: 844 }], [1, { width: 1280, height: 800 }]]) {
    const p = watch(await ctx.newPage(), 'player' + i); await p.setViewportSize(vp);
    await p.goto(base + 'index.html?g=' + code);
    await p.fill('#name', 'Tester ' + i); await p.click('#go');
    await p.waitForURL(/play\.html/); players.push(p);
  }
  for (let k = 0; k < 4; k++) await admin.click('#bots');
  await admin.waitForTimeout(1500);
  await proj.screenshot({ path: join(shots, '1_projector_lobby.png') });
  ok((await proj.textContent('#app')).includes('Tester 0'), 'projector lobby lists players');
  for (const k of ['shock', 'play', 'outside']) await admin.fill('#tm_' + k, k === 'play' ? '25' : '6');
  await admin.click('#savetm');
  await admin.click('#start');
  await admin.waitForTimeout(2500);
  for (const [i, p] of players.entries()) await p.screenshot({ path: join(shots, `2_player${i}_shock.png`), fullPage: true });
  await admin.waitForTimeout(7000);
  // real player acts: if director and chair, call the disclosure vote; post a chat line either way
  for (const [i, p] of players.entries()) {
    await p.fill('#msg', 'Tester ' + i + ' says we should talk about the issue first.'); await p.click('#send');
    const callD = await p.$('[data-a=calld]'); if (callD) await callD.click();
    const tgt = await p.$('[data-tgt]'); if (tgt) await tgt.click();
    await p.waitForTimeout(1500);
    const ballot = await p.$('[data-ballot]'); if (ballot) await ballot.click();
    await p.screenshot({ path: join(shots, `3_player${i}_play.png`), fullPage: true });
  }
  await players[0].waitForTimeout(1500);
  ok((await players[0].textContent('#msgs')).includes('Tester 0 says'), 'chat message delivered');
  await proj.screenshot({ path: join(shots, '4_projector_play.png') });
  // run through the rest on the clock
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    const txt = await admin.textContent('#app');
    if (/Phase:\s*reveal/.test(txt)) break;
    const btn = await admin.$('#adv');
    if (btn && (await btn.textContent()).trim() === 'Reveal') { await proj.screenshot({ path: join(shots, '5_projector_outside_r3.png') }); await btn.click(); }
    await admin.waitForTimeout(1000);
  }
  await proj.waitForTimeout(2500);
  const rtxt = await proj.textContent('#app');
  ok(rtxt.includes('How each community ranks the boards'), 'projector reveal renders grid');
  ok(rtxt.includes('Seat leagues'), 'projector reveal renders leagues');
  await proj.screenshot({ path: join(shots, '6_projector_reveal.png'), fullPage: true });
  for (const [i, p] of players.entries()) { await p.waitForTimeout(500); await p.screenshot({ path: join(shots, `7_player${i}_reveal.png`), fullPage: true }); ok((await p.textContent('#main')).includes('points'), 'player ' + i + ' sees own result'); }
  await admin.screenshot({ path: join(shots, '8_admin.png'), fullPage: true });
} finally { await browser.close(); srv.kill(); }
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
process.exit(fails ? 1 : 0);
