// Rule vocabulary for exposure triggers and secret checks (content/RULES.md is the spec).
// evalRule(rule, ctx) returns 0 or 1. Triggers fire at 1; secrets are met at 1. Evaluated at the reveal.
// Director ctx = { state, board, seat }. Street ctx = { state, seat } (seat.kind === 'street').
// board.hist[round] = { passed, tags, payoutM, staffCut, disclosure (all|some|none), admit, caughtFacts, decided, caught, caughtOn, sued, founderFailed, ... }

const COMM = ['shareholders', 'workers', 'customers', 'home', 'public'];
const H = b => Object.entries(b.hist).filter(([, h]) => h.disclosure).map(([r, h]) => ({ r: Number(r), ...h }));
const B = x => (x ? 1 : 0);

export const RULES = {
  motion_passed: (r, x) => B(H(x.board).some(h => h.passed.includes(r.id))),
  motion_passed_any: (r, x) => B(H(x.board).some(h => (r.ids || []).some(id => h.passed.includes(id)))),
  tag_passed: (r, x) => B(H(x.board).some(h => (!r.round || h.r === r.round) && h.tags.includes(r.tag))),
  staff_cut_pct_gt: (r, x) => B(H(x.board).reduce((s, h) => s + h.staffCut, 0) > (r.value || 0)),
  payout_m_gte: (r, x) => B(H(x.board).some(h => h.payoutM >= (r.value || 0))),
  disclosure_choice: (r, x) => B(H(x.board).some(h => (!r.round || h.r === r.round) && h.disclosure === r.choice)),
  // facts_caught: the Street caught omitted facts. {min} = at least that many caught facts (default 1); {weight} = caught weight totals at least that; {round} optional.
  facts_caught: (r, x) => {
    const cf = H(x.board).filter(h => !r.round || h.r === r.round).flatMap(h => h.caughtFacts || []);
    return B(r.weight ? cf.reduce((n, f) => n + f.weight, 0) >= r.weight : cf.length >= (r.min || 1));
  },
  stock_end_below_start: (r, x) => B(stockNow(x.board) < x.board.stock[0]),
  stock_end_above_start: (r, x) => B(stockNow(x.board) > x.board.stock[0]),
  stock_rank_bottom_half: (r, x) => { const n = Object.keys(x.state.boards).length; return B(rankOf(x.state, 'stock', x.board.id) > Math.ceil(n / 2)); },
  suit_filed: (r, x) => B(H(x.board).some(h => h.sued)),
  founder_motion_failed: (r, x) => B(H(x.board).some(h => h.founderFailed)),
  // engine extras (not used by content today, kept small)
  firm_failed: (r, x) => B(x.board.failed),
  never_caught: (r, x) => B(!H(x.board).some(h => h.caught)),
  // combinators: RULES.md uses {of:[...]} for all/any and {of:rule} for not
  all: (r, x) => B((r.of || []).every(q => evalRule(q, x) === 1)),
  any: (r, x) => B((r.of || []).some(q => evalRule(q, x) === 1)),
  not: (r, x) => 1 - evalRule(Array.isArray(r.of) ? r.of[0] : r.of, x),

  // ---------- Street checks ----------
  street_target_payout_raised: (r, x) => B((x.seat.payoutRaised || 0) >= (r.min || 1)),
  street_acted_every_round: (r, x) => {
    const played = x.state.schedule.filter(n => x.state.streetActions[n] && n <= x.state.round);
    return B(played.length > 0 && played.every(n => { const a = x.state.streetActions[n][x.seat.id]; return a && (!r.action || a.type === r.action); }));
  },
  street_never_caught_on: (r, x) => B(!x.seat.hits.some(h => h.hit === true && h.target === x.seat.consulted)),
  street_leaked_to: (r, x) => {
    const other = Object.values(x.state.seats).filter(s => s.kind === 'street' && s.role === r.seat).map(s => s.id);
    const n = x.state.leaks.filter(l => (l.to === x.seat.id && other.includes(l.from)) || (l.from === x.seat.id && other.includes(l.to))).length;
    return B(n >= (r.min || 1));
  },
  street_settlement_taken: (r, x) => B(x.seat.hits.filter(h => h.result === 'settled').length >= (r.min || 1)),
};

// Secrets whose success means the firm doing badly: the failed-firm cap does not apply.
export const REWARDS_FAILURE = new Set(['stock_end_below_start', 'stock_rank_bottom_half', 'firm_failed']);

export const unknownRules = new Set();
export function evalRule(rule, ctx) {
  if (!rule || !rule.type) return 0;
  const f = RULES[rule.type];
  if (!f) { unknownRules.add(rule.type); return 0; }
  return f(rule, ctx) ? 1 : 0;
}
export function rewardsFailure(rule) {
  if (!rule) return false;
  if (REWARDS_FAILURE.has(rule.type)) return true;
  if (rule.type === 'all' || rule.type === 'any') return (rule.of || []).some(rewardsFailure);
  return false;
}

export function stockNow(b) { return b.stock[b.stock.length - 1]; }
// 'stock' ranks by stock relative to start; the five communities by the board's community score.
export function communityTable(state, community) {
  const val = b => (community === 'stock' ? stockNow(b) / b.stock[0] : b.community[community] || 0);
  return Object.values(state.boards).map(b => ({ id: b.id, v: (b.failed ? -1e9 : 0) + val(b) }))
    .sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
}
export function rankOf(state, community, boardId) { return communityTable(state, community).findIndex(e => e.id === boardId) + 1; }
export const COMMUNITIES = COMM;
