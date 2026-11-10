// node test/seating_shot.mjs : projector seating screen with 32 players, lobby draft and play phase. Shots to test/shots/.
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x'));
const { chromium } = require('playwright');
const PORT = 8132, base = 'http://localhost:' + PORT + '/';
const srv = spawn(process.execPath, [join(root, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage(); await admin.setViewportSize({ width: 1100, height: 900 });
  await admin.goto(base + 'admin.html'); await admin.click('#new'); await admin.waitForSelector('#start');
  const code = new URL(admin.url()).searchParams.get('g');
  const proj = await ctx.newPage(); await proj.setViewportSize({ width: 1920, height: 1080 });
  const errs = []; proj.on('pageerror', e => errs.push(e.message));
  await proj.goto(base + 'projector.html?g=' + code);
  for (let k = 0; k < 8; k++) await admin.click('#bots');
  await admin.waitForTimeout(500);
  let n = await admin.evaluate(() => window.__host.state.players.length); console.log('players', n);
  await admin.selectOption('#nb', '6'); await admin.click('#auto2'); await admin.waitForTimeout(1500);
  await proj.screenshot({ path: join(root, 'test', 'shots', 'projector_seating_lobby.png') });
  await admin.click('#start'); await admin.waitForTimeout(2500);
  await proj.screenshot({ path: join(root, 'test', 'shots', 'projector_seating_play.png') });
  const info = await proj.evaluate(() => ({ names: document.querySelectorAll('.sn').length, chairs: document.querySelectorAll('.chr').length, over: document.documentElement.scrollHeight > innerHeight, clk: (document.getElementById('clk') || {}).textContent }));
  console.log(JSON.stringify(info), 'errors', errs.length, errs);
} finally { await browser.close(); srv.kill(); }
