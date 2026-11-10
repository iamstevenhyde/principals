// node test/seating.mjs : seat N players and print the board x seat layout.
import { createGame, apply } from '../engine/engine.js';
import { CONTENT } from '../engine/content_bundle.js';
let fails = 0;
for (const n of [32, 36]) {
  const st = createGame(CONTENT, { code: 'S', seed: 3, boardCount: 6 });
  for (let i = 0; i < n; i++) apply(st, { by: 'p' + i, type: 'join', name: 'P' + i, t: 0 });
  apply(st, { by: 'host', type: 'draft_auto', t: 0 }); apply(st, { by: 'host', type: 'start', t: 1 });
  const seats = Object.values(st.seats), by = {};
  for (const s of seats) (by[s.board] = by[s.board] || []).push(s.seat);
  const sizes = Object.values(by).map(a => a.length), uniq = Object.values(by).every(a => new Set(a).size === a.length);
  const okk = seats.length === n && Object.keys(by).length === 6 && uniq;
  if (!okk) fails++;
  console.log((okk ? 'ok   ' : 'FAIL ') + n + ' players seated=' + seats.length + ' boards=' + Object.keys(by).length + ' sizes=' + sizes.join(',') + ' audit_chair seats=' + seats.filter(s => s.seat === 'audit_chair').length);
}
process.exit(fails ? 1 : 0);
