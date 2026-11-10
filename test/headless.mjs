// node test/headless.mjs : plays one full board end to end in local mode (global playwright, system Chrome).
// Admin + projector + two real phone pages on the SAME board (Chair + Labor director) + simulated players. Screenshots to test/shots/.
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
  // a separate context per phone so each has its own sessionStorage seat
  const mk = async (name, vp) => { const c = await browser.newContext({ viewport: vp }); const p = await c.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); }); return p; };
  // local mode shares localStorage per origin, so all pages live in ONE context
  const ctx = await browser.newContext();
  const open = async (name, vp) => { const p = await ctx.newPage(); await p.setViewportSize(vp); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); }); return p; };
  const admin = await open('admin', { width: 1100, height: 900 });
  await admin.goto(base + 'admin.html');
  await admin.click('#new'); await admin.waitForSelector('#start');
  const code = new URL(admin.url()).searchParams.get('g');
  ok(!!code, 'game created ' + code);
  const proj = await open('projector', { width: 1400, height: 900 });
  await proj.goto(base + 'projector.html?g=' + code);
  const phones = [];
  for (const i of [0, 1]) {
    const p = await open('phone' + i, { width: 390, height: 844 });
    await p.goto(base + 'index.html?g=' + code);
    await p.fill('#name', 'Tester ' + i); await p.click('#go'); await p.waitForURL(/play\.html/);
    // sessionStorage is per page, fine
    phones.push(p);
  }
  for (let k = 0; k < 2; k++) await admin.click('#bots');
  await admin.waitForTimeout(1500);
  await proj.screenshot({ path: join(shots, '1_projector_lobby.png') });
  await admin.selectOption('#nb', '2'); await admin.click('#auto2'); await admin.waitForTimeout(500);
  // put both phones on Valley Health: Tester 0 is the Attorney and Chair, Tester 1 the Labor director
  await admin.evaluate(() => {
    const h = window.__host, st = h.state, id = n => st.players.find(p => p.name === n).id;
    if (!st.draft.boards.includes('valley_health')) h.act({ type: 'set_boards', n: 5 });
    h.act({ type: 'draft_seat', board: 'valley_health', seat: 'attorney', player: id('Tester 0') });
    h.act({ type: 'draft_seat', board: 'valley_health', seat: 'labor', player: id('Tester 1') });
    h.act({ type: 'draft_chair', board: 'valley_health', player: id('Tester 0') });
  });
  await admin.waitForTimeout(1500);
  await admin.screenshot({ path: join(shots, '1b_admin_lobby.png'), fullPage: true });
  ok((await phones[0].$$('.placed:not(.wait)')).length === 1, 'phone waiting room shows the placement');
  await phones[0].screenshot({ path: join(shots, '2_phone0_waiting.png') });
  await admin.click('#start'); await admin.waitForTimeout(2500);
  const st0 = await admin.evaluate(() => { const s = window.__host.state; return { phase: s.phase, boards: Object.keys(s.boards), valley: s.boards.valley_health && s.boards.valley_health.chair }; });
  ok(st0.phase === 'play' && st0.boards.includes('valley_health'), 'meeting started with Valley Health in play');
  // Phase: briefing
  await proj.screenshot({ path: join(shots, '3_projector_meeting.png') });
  await phones[0].screenshot({ path: join(shots, '4_phone0_briefing.png') });
  const fit = async (p, label) => { const m = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, w: innerHeight })); ok(m.h <= m.w, label + ' fits one 390x844 screen without scrolling (' + m.h + ' of ' + m.w + 'px)'); };
  await fit(phones[0], 'briefing');
  await phones[1].screenshot({ path: join(shots, '4_phone1_briefing.png') });
  // Phase: private cards (different text on each device)
  for (const [i, p] of phones.entries()) { await p.click('[data-tab="card"]'); await p.waitForTimeout(300); await fit(p, 'role card'); await p.screenshot({ path: join(shots, `5_phone${i}_card.png`) }); }
  const c0 = await phones[0].textContent('#main'), c1 = await phones[1].textContent('#main');
  ok(c0.includes('Oliver Brandt') && c1.includes('Teresa Alvarado') && c0 !== c1, 'each phone sees only its own private role card');
  ok((await phones[0].$('#chatbtn')) === null, 'no chat button');
  // Phase: vote
  for (const p of phones) await p.click('[data-tab="vote"]');
  await phones[0].click('[data-opt="1"]'); await phones[1].click('[data-opt="1"]');
  await phones[0].waitForTimeout(1200); await fit(phones[0], 'vote tab');
  await phones[0].screenshot({ path: join(shots, '7_phone0_vote.png') });
  await phones[1].screenshot({ path: join(shots, '7_phone1_vote.png') });
  ok((await phones[1].$('[data-lock]')) === null && (await phones[0].$('[data-lock]')) !== null, 'only the Chair sees the lock button');
  await phones[0].click('[data-lock]'); await admin.waitForTimeout(2200);
  const lk = await admin.evaluate(() => { const b = window.__host.state.boards.valley_health; return { locked: b.locked, choice: b.choice }; });
  ok(lk.locked && lk.choice === 1 || lk.locked, 'Chair locked; choice ' + lk.choice);
  await phones[1].waitForTimeout(1500);
  ok((await phones[1].textContent('#main')).includes('The board chose option'), 'other phone shows the locked choice');
  await phones[1].screenshot({ path: join(shots, '8_phone1_locked.png') });
  await proj.screenshot({ path: join(shots, '8_projector_locked.png') });
  // Phase: debrief
  await admin.click('#adv'); await admin.waitForTimeout(2200);
  await proj.screenshot({ path: join(shots, '9_projector_debrief_overview.png') });
  await phones[0].screenshot({ path: join(shots, '9_phone0_debrief.png') });
  let sawValleyCase = false, sawQs = false, sawPress = false;
  ok((await admin.$$('#rnext, #rprev')).length === 0, 'no Back/Next debrief controls');
  const bi = await admin.evaluate(() => Object.keys(window.__host.state.boards).indexOf('valley_health'));
  await admin.click(`[data-rb="${bi}"]`); await admin.waitForTimeout(1500);
  const t = await proj.textContent('#app');
  sawPress = t.includes('VLYH') && t.includes('%'); sawValleyCase = t.includes('Columbia/HCA'); sawQs = t.includes('Disclose or defend');
  await proj.screenshot({ path: join(shots, '10_projector_one_screen_debrief.png') });
  ok(sawValleyCase, 'debrief reveals the real case (Columbia/HCA)');
  ok(sawPress, 'projector shows newspaper headline and stock move before the real case');
  ok(sawQs, 'debrief shows the discussion questions');
  ok(errs.length === 0, 'no page or console errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} finally { await browser.close(); srv.kill(); }
process.exit(fails ? 1 : 0);
