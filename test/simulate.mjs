// node test/simulate.mjs [games=20]
// Simulates 24-player games through both rounds of Option B (one headline motion per round, front page, five-screen-plus debrief) plus small/large variants and asserts:
// no engine crash, every rule type in content/RULES.md has a handler, front page and every debrief screen render within the word cap.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../tools/bundle.mjs';
import { STUB } from './fixtures/stub.js';
import { createGame, apply, tick, seatView, publicView, revealView, unknownRules } from '../engine/engine.js';
import { RULES } from '../engine/rules.js';
import { botStep } from '../engine/bots.js';
import { revealScreen, frontPage } from '../pages/render.js';
import { SCORING } from '../config/scoring.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = loadContent() || STUB;
const usingStub = content === STUB;
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };

// 1. every rule type in RULES.md and in the content has a handler
const rulesMd = (() => { try { return readFileSync(join(root, 'content', 'RULES.md'), 'utf8'); } catch { return ''; } })();
const mdTypes = [...rulesMd.matchAll(/^- `([a-z_]+)`/gm)].map(m => m[1]);
const motionFlags = new Set(['cost_m', 'effects', 'reveal_effects', 'lag_payback', 'coin_flip', 'if_found', 'resolves_issue', 'raises_detect', 'staff_cut_pct', 'payout_m', 'tags', 'founder_wants', 'removes_chair', 'investigates_current_issue', 'admit_stock_hit_mult', 'caught_penalty_mult', 'street_action_mult', 'settles_suit', 'plaintiff_cut', 'available', 'stock_end_below_start']);
const ruleTypes = mdTypes.filter(t => !motionFlags.has(t) || RULES[t]);
for (const t of ruleTypes) ok(RULES[t], 'RULES.md type has no handler: ' + t);
const contentTypes = new Set();
const walk = o => { if (o && typeof o === 'object') { if (typeof o.type === 'string') contentTypes.add(o.type); Object.values(o).forEach(walk); } };
walk(content.boards); walk(content.street);
for (const t of contentTypes) ok(RULES[t], 'content uses unknown rule type: ' + t);
const engineSrc = readFileSync(join(root, 'engine', 'engine.js'), 'utf8');
for (const f of mdTypes.filter(t => motionFlags.has(t) && !RULES[t])) ok(engineSrc.includes(f), 'motion flag not read by engine: ' + f);
console.log('rule types in RULES.md: ' + ruleTypes.length + ', flags: ' + mdTypes.filter(t => motionFlags.has(t)).length + ', content rule types: ' + contentTypes.size + (usingStub ? ' (STUB content)' : ''));

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function playGame(seed, { players = 24, boards = 4, late = 0 } = {}) {
  const st = createGame(content, { code: 'SIM' + seed, seed, boardCount: boards, timers: { shock: 20, play: 120, outside: 10 } });
  const rand = mulberry(seed * 7 + 3);
  const t0 = 1_000_000 + 5000 * 1000;
  let t = 1_000_000, crashes = 0, errors = 0, actions = 0;
  const run = a => { const r = apply(st, { ...a, t }); actions++; if (r.crash) { crashes++; console.log('CRASH', r.error, JSON.stringify(a)); } else if (!r.ok) errors++; return r; };
  for (let i = 0; i < players; i++) run({ by: 'p' + i, type: 'join', name: 'Student ' + i });
  run({ by: 'host', type: 'draft_auto' });
  run({ by: 'host', type: 'start' });
  for (let i = 0; i < late; i++) run({ by: 'late' + i, type: 'join', name: 'Late ' + i });
  const ids = () => st.players.map(p => p.id);
  let steps = 0;
  const seenPhases = new Set();
  while (st.phase !== 'reveal' && steps < 5000) {
    t += 1000; steps++;
    for (const id of ids()) for (const a of botStep(seatView(st, id, t), rand)) run({ ...a, by: id });
    seenPhases.add(st.phase + st.round);
    if (st.phase === 'outside') ok(frontPage(publicView(st, t)).includes('class="story'), 'front page renders');
    if (st.phase === 'play' && steps % 20 === 0) ok(frontPage(publicView(st, t)).includes('The Principal Times'), 'live front page renders during play');
    if (st.phase === 'outside' && !st.clock) run({ by: 'host', type: 'reveal' });
    tick(st, t);
  }
  ok(st.phase === 'reveal', `seed ${seed}: reached reveal (phase ${st.phase})`);
  ok(crashes === 0, `seed ${seed}: no crashes (${crashes})`);
  ok(st.schedule.length === 2, 'two rounds');
  for (const b of Object.values(st.boards)) for (const r of st.schedule) ok(((b.content.rounds.find(x => x.round === r) || {}).motions || []).length === 1, `${b.id} r${r}: exactly one headline motion`);
  for (const b of Object.values(st.boards)) for (const r of st.schedule) {
    const h = b.hist[r]; if (!h) continue;
    ok(['all', 'some', 'none'].includes(h.disclosure), `seed ${seed} ${b.id} r${r}: disclosure level set`);
    const fids = ((b.content.rounds.find(x => x.round === r) || {}).issue || {}).facts.map(f => f.id);
    ok(h.admit.every(id => fids.includes(id)) && h.caughtFacts.every(c => fids.includes(c.id) && !h.admit.includes(c.id)), `seed ${seed} ${b.id} r${r}: admitted and caught facts are real and disjoint`);
    ok((h.disclosure === 'all') === (h.admit.length === fids.length) && (h.disclosure === 'none') === (h.admit.length === 0), `seed ${seed} ${b.id} r${r}: level matches admitted facts`);
    ok(h.caught === (h.caughtFacts.length > 0), `seed ${seed} ${b.id} r${r}: caught flag matches caught facts`);
    ok((h.statement || '').length <= 400 && (h.decided || !h.statement), `seed ${seed} ${b.id} r${r}: statement within cap and empty unless locked`);
  }
  ok(Object.values(st.seats).filter(s => s.kind === 'street').every(s => s.role === 'auditor'), 'the only outside role is the Auditor');
  for (const s of Object.values(st.seats)) if (s.kind === 'director') ok(s.score && Number.isFinite(s.score.total), 'director scored ' + s.id);
  const R = revealView(st);
  ok(R.steps === 4 + Object.keys(st.boards).length, `seed ${seed}: four screens plus one ethics screen per board`);
  let all = '';
  for (let i = 0; i < R.steps; i++) {
    const html = revealScreen({ ...R, step: i }), words = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    all += html;
    ok(words <= 175, `seed ${seed}: debrief screen ${i + 1} has ${words} words (cap 175)`);
  }
  ok(R.boards.every(b => all.includes(b.short.replace(/&/g, '&amp;'))), `seed ${seed}: debrief names every board`);
  ok(R.boards.every(b => b.real && b.real.cases.length === 2 && b.real.fix), `seed ${seed}: every board carries its real-case reveal`);
  ok(revealScreen({ ...R, step: 3 }).includes('Fixes') && R.boards.every(b => all.includes(b.real.cases[0].event.replace(/&/g, '&amp;'))), `seed ${seed}: real cases shown`);
  // hidden facts must not reach the public payload before the reveal
  const pub = JSON.stringify({ ...publicView(st, t0), reveal: null });
  for (const b of Object.values(st.boards)) for (const r of st.schedule) { const h = b.hist[r]; if (!h) continue; for (const f of (((b.content.rounds.find(x => x.round === r) || {}).issue || {}).facts || [])) if (!h.admit.includes(f.id) && !h.caughtFacts.some(c => c.id === f.id)) ok(!pub.includes(f.text), `seed ${seed}: hidden fact not public (${f.id})`); }
  ok(!('leagues' in R), 'no seat leagues');
  ok(SCORING.timers.play === 480, 'round length defaults to 8 minutes');
  const nB = Object.keys(st.boards).length, nS = Object.values(st.seats).filter(s => s.kind === 'street').length;
  return { st, actions, errors, nB, nS, R };
}

const N = Number(process.argv[2]) || 20;
const agg = { failed: 0, caught: 0, all: 0, some: 0, none: 0, facts: 0, admitted: 0, stmts: 0, fired: 0, met: 0, dirs: 0, chats: 0, coin: 0, nodecide: 0, chairs: 0 };
for (let g = 1; g <= N; g++) {
  const { st, nB, nS } = playGame(g);
  if (g === 1) { ok(nB === 4 && nS === 4, `24 players -> 4 boards + 4 Street (got ${nB} + ${nS})`); }
  for (const b of Object.values(st.boards)) { agg.failed += b.failed; for (const h of Object.values(b.hist)) { agg.caught += h.caught; agg[h.disclosure]++; agg.facts += h.admit.length + h.caughtFacts.length; agg.admitted += h.admit.length; if (h.statement) agg.stmts++; } }
  for (const s of Object.values(st.seats)) if (s.kind === 'director') { agg.dirs++; agg.fired += s.score.exposureFired; agg.met += s.score.secret; }
  for (const f of st.feed) { if (f.kind === 'coin') agg.coin++; if (f.kind === 'nodecide') agg.nodecide++; if (f.kind === 'chair') agg.chairs++; }
  agg.chats += st.chat.length;
}
// variants
playGame(102, { players: 18, boards: 3 });
const big = playGame(103, { players: 33, boards: 5, late: 3 });
ok(big.nB === 5, '33 players -> 5 boards');
ok(Object.values(big.st.seats).filter(s => s.kind === 'street').length === 11, '25 seated + 8 Street (incl 3 late)');
const small = playGame(104, { players: 7, boards: 4 });
ok(small.nB === 2, '7 players -> 2 boards (got ' + small.nB + ')');
ok(unknownRules.size === 0, 'no unknown rule types evaluated: ' + [...unknownRules].join(','));
console.log(`${N} games of 24 + 4 variants. Per-game averages:`, Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, Math.round(v / N * 10) / 10])));
console.log(fails ? fails + ' FAILURES' : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
