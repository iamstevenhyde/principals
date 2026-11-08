// Simulated players for local mode and the test script. They act only through the same actions a student sends,
// reading only their own seatView, so they exercise the real permission checks.
const LINES = ['I think we should pass this before the clock runs out.', 'Who is going to tell the workers about this one?', 'If we hide it and the auditor shows up we are done.', 'The fund wants the payout, I can feel it.', 'Can we at least fix it quietly this round?', 'I am not voting for that, the town will never forgive us.'];

export function botStep(view, rand) {
  const out = [], me = view.me, P = view.public;
  if (!me || me.kind === 'waiting' || P.phase === 'lobby' || P.phase === 'reveal') return out;
  const pick = a => a[Math.floor(rand() * a.length)];
  if (view.director && P.phase !== 'outside') {
    const d = view.director, b = view.board;
    if (b.failed) return out;
    if (rand() < 0.02) out.push({ type: 'chat', ch: 'board', text: pick(LINES) });
    if (rand() < 0.03 && !b.decided && b.issue && !b.statement) out.push({ type: 'statement', text: pick(LINES) });
    if (rand() < 0.02 && b.directors.length > 1) out.push({ type: 'chat', ch: 'dm:' + pick(b.directors.filter(x => x.id !== me.id)).id, text: 'Between us: ' + pick(LINES) });
    if (P.phase === 'shock') {
      return out;
    }
    const open = b.votes.find(v => v.open);
    if (open && !open.mine && rand() < 0.5) out.push({ type: 'ballot', vote: open.id, ...(open.kind === 'facts' ? { admit: b.issue.facts.filter(() => rand() < 0.5).map(f => f.id) } : { choice: rand() < 0.6 ? 'yes' : 'no' }) });
    if (d.chair && !open && rand() < 0.35) {
      const left = b.motions.filter(m => !m.passed);
      const tried = new Set(b.votes.map(v => v.target));
      const fresh = left.filter(m => !tried.has(m.id));
      if (!b.decided && (rand() < 0.3 || !fresh.length)) out.push({ type: 'open_vote', kind: 'facts' });
      else if (fresh.length) out.push({ type: 'open_vote', kind: 'motion', target: pick(fresh).id });
    }
    if (d.chair && open && rand() < 0.05) out.push({ type: 'close_vote' });
  }
  if (view.street && P.phase !== 'outside') {
    const s = view.street, ids = P.boards.map(b => b.id);
    if (!s.action && rand() < 0.2) out.push({ type: 'street_action', target: pick(ids) });
    if (rand() < 0.01) out.push({ type: 'chat', ch: 'street', text: 'Watching ' + pick(P.boards).name + ' this round.' });
  }
  return out;
}
