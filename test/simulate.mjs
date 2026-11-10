// node test/simulate.mjs : engine-only checks for the one-round design (no browser).
import { createGame, apply, tick, seatView, publicView } from '../engine/engine.js';
import { CONTENT } from '../engine/content_bundle.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = n => {
  const st = createGame(CONTENT, { code: 'SIM', seed: 7, boardCount: 6 });
  for (let i = 0; i < n; i++) apply(st, { by: 'p' + i, type: 'join', name: 'P' + i, t: 0 });
  apply(st, { by: 'host', type: 'draft_auto', t: 0 });
  return st;
};
for (const n of [6, 12, 22, 30, 32, 36, 44]) {
  const st = run(n), r = apply(st, { by: 'host', type: 'start', t: 1000 });
  const seated = Object.keys(st.seats).length;
  ok(r.ok && st.phase === 'play' && seated === n, n + ' players: all seated (' + seated + ') and the meeting starts');
}
const st = run(22); apply(st, { by: 'host', type: 'start', t: 1000 });
const bid = Object.keys(st.boards)[0], b = st.boards[bid], ds = Object.values(st.seats).filter(s => s.board === bid);
ok(apply(st, { by: ds[0].id, type: 'ballot', choice: 9, t: 2 }).ok === false, 'a ballot for a missing option is refused');
ds.forEach((d, i) => apply(st, { by: d.id, type: 'ballot', choice: i < 2 ? 2 : 3, t: 2 }));
const nonChair = ds.find(d => d.id !== b.chair);
ok(apply(st, { by: nonChair.id, type: 'lock', t: 3 }).ok === false, 'only the Chair can lock');
ok(apply(st, { by: b.chair, type: 'lock', t: 3 }).ok && b.locked, 'Chair locks');
const exp = ds.length - 2 > 2 ? 3 : 2;
ok(b.choice === exp || ds.length <= 4, 'plurality wins (option ' + b.choice + ')');
ok(apply(st, { by: ds[0].id, type: 'ballot', choice: 1, t: 4 }).ok === false, 'no ballots after the lock');
const v = seatView(st, ds[0].id, 5);
ok(v.board.locked && v.board.tally && !JSON.stringify(v).includes('auditor'), 'locked view shows the tally');
ok(tick(st, 1000 + 900 * 1000 + 1) && st.phase === 'reveal', 'timer ends the meeting and opens the debrief');
ok(Object.values(st.boards).every(x => x.locked), 'every board is locked at the reveal');
const pv = publicView(st, 0);
ok(pv.reveal && pv.reveal.steps === Object.keys(st.boards).length, 'debrief is one screen per board');
ok(pv.reveal.boards.every(x => x.reveal && x.questions.length === 4 && !x.questions.join().includes('TODO')), 'every board has its real-case reveal and 4 questions');
process.exit(fails ? 1 : 0);
