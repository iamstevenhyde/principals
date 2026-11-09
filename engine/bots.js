// Simulated players for local mode and the test script. They act only through the same actions a student sends,
// reading only their own seatView, so they exercise the real permission checks.
const LINES = ['I think option 2 keeps us out of the worst of it.', 'Who is going to tell the workers about this one?', 'My card pulls me the other way, I will say that much.', 'Can we at least agree on what we will not do?', 'I am not voting for that, the town will never forgive us.'];

export function botStep(view, rand) {
  const out = [], me = view.me, P = view.public;
  if (!me || me.kind === 'waiting' || P.phase !== 'play') return out;
  const pick = a => a[Math.floor(rand() * a.length)];
  const b = view.board;
  if (rand() < 0.02) out.push({ type: 'chat', ch: 'board', text: pick(LINES) });
  if (!b.locked && !b.mine && rand() < 0.05) out.push({ type: 'ballot', choice: pick(b.options).n });
  if (view.director.chair && !b.locked && b.directors.every(d => d.voted) && rand() < 0.1) out.push({ type: 'lock' });
  return out;
}
