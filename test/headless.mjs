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
const errs = [], phoneH = [];
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
  await admin.click('#tmbox summary');
  for (const k of ['shock', 'play', 'outside']) await admin.fill('#tm_' + k, k === 'play' ? '60' : '6');
  await admin.click('#savetm');
  await admin.selectOption('#nb', '5');   // 22 players, 5 boards: every test player is seated as a director
  await admin.click('#auto2');
  await admin.waitForTimeout(1500);
  // waiting room -> host placement: phones show where they were placed, host can move a player by hand
  ok((await players[0].$$('.placed:not(.wait)')).length === 1, 'phone waiting room shows the placement tile');
  ok((await admin.$$('[data-seat]')).length === 25, 'host sees 5 boards x 5 seats');
  const first = admin.locator('[data-seat]').first(), who = await first.inputValue();
  await first.selectOption(''); await admin.waitForTimeout(400);
  ok((await admin.locator('[data-seat]').first().inputValue()) === '' && (await admin.textContent('.chipgrid')).trim().length > 0, 'host emptied a seat and the player went back to the waiting room');
  await admin.locator('[data-seat]').first().selectOption(who); await admin.waitForTimeout(400);
  ok((await admin.locator('[data-seat]').first().inputValue()) === who, 'host put the player back');
  await admin.screenshot({ path: join(shots, '1b_admin_lobby.png'), fullPage: true });
  await admin.click('#start');
  await admin.waitForTimeout(500);
  // seat Tester 0 as Chair of their board so the facts vote can be driven from a real player page
  await admin.evaluate(() => { const st = window.__host.state; for (const n of ['Tester 0', 'Tester 1']) { const me = st.players.find(p => p.name === n), s = me && st.seats[me.id]; if (s && s.kind === 'director') st.boards[s.board].chair = me.id; } window.__host.dirty = true; });
  await admin.waitForTimeout(2500);
  for (const [i, p] of players.entries()) await p.screenshot({ path: join(shots, `2_player${i}_shock.png`), fullPage: true });
  await admin.waitForTimeout(7000);
  const lockedText = [];
  // real player acts: if director and chair, call the disclosure vote; post a chat line either way
  const say = async (p, text) => { const cb = p.locator('#chatbtn'); if (await cb.isVisible()) await cb.click(); await p.fill('#msg', text); await p.click('#send'); await p.waitForTimeout(300); const x = p.locator('#chatx'); if (await x.isVisible()) await x.click(); };
  for (const [i, p] of players.entries()) {
    await say(p, 'Tester ' + i + ' says we should talk about the issue first.');
    if (await p.$('[data-go="1"]')) await p.click('[data-go="1"]');
    const callD = await p.$('[data-a=calld]');
    if (callD) {   // Chair: write the statement, tick a fact, call the vote, send picks, lock
      const text = 'Tester ' + i + ' firm statement: we are reviewing a matter.';
      await p.fill('#stmt', text);
      await admin.waitForFunction(t => Object.values(window.__host.state.boards).some(b => b.statement === t), text, { timeout: 10000 }).catch(async e => { console.log('DBG', JSON.stringify(await admin.evaluate(() => ({ ph: window.__host.state.phase, err: window.__host.errors, st: Object.values(window.__host.state.boards).map(b => [b.chair, b.statement]) })))); throw e; });
      await p.click('[data-go="0"]');
      const boxes = await p.$$('[data-fact]'); ok(boxes.length >= 3, 'player ' + i + ' sees a fact list (' + boxes.length + ')');
      await p.click('[data-go="0"]');
      await p.check('[data-fact]');
      const hgt = await p.evaluate(() => document.documentElement.scrollHeight); phoneH.push(hgt); ok(hgt < 1500, 'player ' + i + ' facts step is short (' + hgt + ' px, was about 3000)');
      await p.click('[data-go="1"]');
      await p.screenshot({ path: join(shots, `3a_player${i}_facts.png`), fullPage: true });
      await p.click('[data-a=calld]'); await p.waitForSelector('[data-fsubmit]', { timeout: 5000 });
      await p.click('[data-fsubmit]'); await p.waitForTimeout(800);
      const cl = await p.$('[data-a=close]'); if (cl) await p.click('[data-a=close]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);   // the vote may already have closed when the last director voted
      // last write wins: a simulated director may have overwritten the text, so read back what actually locked
      await p.click('[data-go="1"]');
      const locked = ((await p.textContent('.stmtlocked').catch(() => '')) || '').trim();
      ok(locked.length > 0, 'player ' + i + ' chair locked facts + statement (' + locked.slice(0, 40) + ')');
      await p.click('[data-go="0"]');
      ok((await p.$$('.facts.locked li')).length >= 3, 'player ' + i + ' sees admitted and left-out facts');
      await p.click('[data-go="2"]');
      const rows = await p.$$('.mrow'); ok(rows.length === 3, 'player ' + i + ' sees exactly 3 motion rows (' + rows.length + ')');
      ok((await p.$$('.mrow .strip .cell')).length === 15, 'player ' + i + ' motion rows carry 5 stakeholder icons each');
      const mh = await p.evaluate(() => document.documentElement.scrollHeight); phoneH.push(mh); ok(mh < 1500, 'player ' + i + ' motions step is short (' + mh + ' px)');
      await p.click('.mhead'); await p.screenshot({ path: join(shots, `3c_player${i}_motions.png`), fullPage: true });
      if (await p.$('[data-callm]')) { await p.click('[data-callm]'); await p.waitForTimeout(800); const y = await p.$('[data-ballot="yes"]'); if (y) { await y.click(); await p.waitForTimeout(500); } }
      lockedText.push(locked);
      await p.screenshot({ path: join(shots, `3b_player${i}_locked.png`), fullPage: true });
    }
    const tgt = await p.$('[data-tgt]'); if (tgt) await tgt.click();
    await p.waitForTimeout(1500);
    const ballot = await p.$('[data-ballot]'); if (ballot) await p.click('[data-ballot]', { timeout: 3000 }).catch(() => {});
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
  ok(!rtxt.includes('Seat leagues'), 'projector reveal has no seat leagues (cut)');
  ok(!/Activist|Short seller|Plaintiff|Executive session|Resign/i.test(rtxt), 'projector reveal mentions no cut features');
  const nStruck = await proj.$$eval('.facts li.omitted s', e => e.length), nCaught = await proj.$$eval('.facts li.caughtf', e => e.length);
  ok(nStruck > 0, 'projector reveal shows struck omitted facts (' + nStruck + ' struck, ' + nCaught + ' caught)');
  ok(rtxt.includes('Public statement') && /caught|left out|Admitted/.test(rtxt), 'projector reveal shows statement and fact list');
  ok(!/^(Tell|Spin|Bury)$/i.test((await proj.$$eval('.disc', els => els.map(e => e.textContent.trim()))).join('\n')), 'projector reveal has no Tell/Spin/Bury label');
  if (lockedText.length) ok(lockedText.some(t => rtxt.includes(t)), 'locked statement appears on the projector reveal (' + lockedText.length + ' chair(s) locked)');
  else ok(true, 'no test player was seated as a director this run; statement check skipped');
  await proj.screenshot({ path: join(shots, '6_projector_reveal.png'), fullPage: true });
  for (const [i, p] of players.entries()) { await p.waitForTimeout(500); await p.screenshot({ path: join(shots, `7_player${i}_reveal.png`), fullPage: true }); ok((await p.$('.result .big')) !== null, 'player ' + i + ' sees own result'); }
  console.log('phone heights (px):', phoneH.join(', '));
  await admin.screenshot({ path: join(shots, '8_admin.png'), fullPage: true });
} finally { await browser.close(); srv.kill(); }
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
process.exit(fails ? 1 : 0);
