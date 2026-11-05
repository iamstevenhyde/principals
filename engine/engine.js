// Principals game engine. Pure: no DOM, no network, no Date.now (the caller passes t in milliseconds).
// The host page (or the simulation) owns one state object and calls apply(state, action). Players never touch
// state; they send actions and read seatView / publicView slices that the host publishes.
//
// action = { type, by: seatId | 'host', t, ...fields }. apply() returns { ok, error? } and mutates state.
// Content: content/boards/*.json, rounds.json, street.json, standing_motions.json (rules in content/RULES.md).

import { SCORING as S } from '../config/scoring.js';
import { evalRule, rewardsFailure, stockNow, communityTable, rankOf, COMMUNITIES, unknownRules } from './rules.js';

export { unknownRules };
export const SEAT_LABEL = { attorney: 'Attorney', labor: 'Labor director', fund: 'Fund partner', founder_friend: "Founder's friend", community: 'Community seat' };
const SEAT_ORDER = ['attorney', 'labor', 'fund', 'founder_friend', 'community'];
const STREET_DEFAULT = {
  activist: { name: 'Activist', action: 'campaign' }, reporter: { name: 'Reporter', action: 'story' }, auditor: { name: 'Auditor', action: 'inspect' },
  short_seller: { name: 'Short seller', action: 'short' }, plaintiffs_lawyer: { name: "Plaintiff's lawyer", action: 'file' },
};
const DEFAULT_STANDING = [
  { id: 'remove_chair', title: 'Remove the Chair', cost_m: 0, effects: {}, flags: { removes_chair: true }, available: 'any_round' },
  { id: 'independent_investigator', title: 'Hire an independent investigator', cost_m: 4, effects: { public: 1 }, flags: { investigates_current_issue: true, raises_detect: 0.25, tell_stock_hit_mult: 0.5, bury_penalty_mult: 2 }, available: 'any_round' },
  { id: 'poison_pill', title: 'Adopt a poison pill', cost_m: 3, effects: {}, flags: { street_action_mult: { campaign: 0.5 } }, available: 'any_round' },
  { id: 'pay_to_stock', title: 'Tie executive pay to the stock', cost_m: 0, effects: { shareholders: 1 }, flags: { tags: ['pay_stock'] }, available: 'any_round' },
  { id: 'pay_to_safety', title: 'Tie executive pay to a worker and safety measure', cost_m: 2, effects: { workers: 1 }, flags: { tags: ['pay_safety'] }, available: 'any_round' },
  { id: 'settle_suit', title: 'Settle the suit', cost_m: 8, effects: { shareholders: -1 }, flags: { settles_suit: true, plaintiff_cut: 0.3 }, available: 'suit_pending' },
];

// ---------- rng (mulberry32; state kept in the game so a replay is exact) ----------
function rnd(st) { let a = (st.rng = (st.rng + 0x6D2B79F5) | 0); a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; }
function shuffle(st, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = (st, arr) => arr[Math.floor(rnd(st) * arr.length)];
const zero = () => Object.fromEntries(COMMUNITIES.map(c => [c, 0]));
const r1 = x => Math.round(x * 10) / 10;
const addEff = (into, eff, k = 1) => { for (const c of COMMUNITIES) into[c] += ((eff || {})[c] || 0) * k; };

// ---------- content shape tolerance ----------
export function normalizeContent(c) {
  const rounds = Array.isArray(c.rounds) ? c.rounds : (c.rounds && c.rounds.rounds) || [];
  const st = c.street || {};
  const seats = (Array.isArray(st) ? st : st.seats || st.roles || []).map(x => ({ ...x, seat: x.seat || x.id }));
  const boards = (c.boards || []).map(b => ({ ...b, communityLabels: communityLabels(b) }));
  return { boards, rounds, standing: c.standing && c.standing.length ? c.standing : DEFAULT_STANDING, street: { ...(Array.isArray(st) ? {} : st), seats, priority: (st.priority) || S.streetPriority } };
}
// communities may be an array of {key,label} or an object {shareholders:'..', home:{id,label}}
function communityLabels(b) {
  const out = { shareholders: 'Shareholders', workers: 'Workers', customers: 'Customers', home: 'Home community', public: 'The public' };
  const c = b.communities;
  if (Array.isArray(c)) for (const e of c) { if (e && e.key) out[e.key] = e.label || out[e.key]; }
  else if (c && typeof c === 'object') for (const k of Object.keys(out)) { const v = c[k]; if (v) out[k] = typeof v === 'string' ? v : v.label || out[k]; }
  return out;
}

// ---------- create ----------
export function createGame(content, { code = 'TEST', seed = 1, boardCount = 4, timers } = {}) {
  return {
    code, seed, rng: seed | 0, content: normalizeContent(content),
    settings: { boardCount, timers: { ...S.timers, ...(timers || {}) }, autoAdvance: true },
    phase: 'lobby', round: 0, schedule: [1, 2, 3], clock: null,
    players: [], seats: {}, boards: {}, chat: [], feed: [], log: [],
    streetActions: {}, visits: {}, suitOverrides: {}, leaks: [], resigns: {}, seq: 0,
  };
}

// ---------- helpers ----------
const roundContent = (st, r) => (st.content.rounds || []).find(x => x.round === r) || { round: r, title: 'Round ' + r, projector_text: '' };
const boardRound = (b, r) => (((b.content || b).rounds) || []).find(x => x.round === r) || { round: r, budget_m: 0, motions: [], issue: { text: '' } };
export const directorsOf = (st, bid) => Object.values(st.seats).filter(s => s.kind === 'director' && s.board === bid);
const streetSeats = st => Object.values(st.seats).filter(s => s.kind === 'street');
function menu(st, b, r) {   // the round's motions plus the standing motions, one list, one vote mechanism
  return [...(boardRound(b, r).motions || []).map(m => ({ ...m, standing: false })), ...st.content.standing.map(m => ({ ...m, standing: true }))];
}
const suitPending = (st, b) => Object.values(st.streetActions[st.round] || {}).some(a => a.type === 'file' && a.target === b.id);
function feed(st, t, text, extra = {}) { st.feed.push({ seq: ++st.seq, t, round: st.round, text, ...extra }); }
function logEv(st, t, type, data) { st.log.push({ seq: ++st.seq, t, round: st.round, type, ...data }); }
function setClock(st, t, secs) { st.clock = secs == null ? null : { endsAt: t + secs * 1000, paused: false, remaining: secs * 1000, total: secs * 1000 }; }
export function clockLeft(st, t) { if (!st.clock) return null; return Math.max(0, st.clock.paused ? st.clock.remaining : st.clock.endsAt - t); }

// ---------- join ----------
export function join(st, { id, name, t }) {
  if (st.players.find(p => p.id === id)) return { ok: true, rejoin: true };
  const clean = String(name || '').trim().slice(0, 40) || 'Player ' + (st.players.length + 1);
  st.players.push({ id, name: clean, joinedAt: t });
  if (st.phase !== 'lobby') { addStreet(st, id, clean); feed(st, t, clean + ' joined the Street.', { kind: 'join' }); }
  return { ok: true };
}
function addStreet(st, id, name) {
  const pr = st.content.street.priority, n = streetSeats(st).length;
  const role = pr[n % pr.length];
  const spec = st.content.street.seats.find(x => x.seat === role) || {};
  const def = STREET_DEFAULT[role] || { name: role, action: 'story' };
  const ids = Object.keys(st.boards);
  st.seats[id] = {
    id, name, kind: 'street', role, label: spec.name || def.name, actionType: (spec.action && spec.action.id) || def.action,
    actionText: (spec.action && spec.action.text) || '', secret: spec.secret || null,
    consulted: ids.length ? pick(st, ids) : null,          // auditor's "your firm consults for one board", dealt at join
    cred: S.credStart, score: 0, hits: [], weak: false, payoutRaised: 0,
  };
}

// ---------- assignment ----------
export function assign(st, t) {
  const players = shuffle(st, st.players);
  const pool = orderBoards(st.content.boards);
  const B = Math.min(st.settings.boardCount, pool.length, Math.max(1, Math.floor(players.length / S.minBoardSize)));
  const boards = pool.slice(0, B);
  const nSeated = Math.min(players.length, B * S.boardSize);
  const seated = players.slice(0, nSeated), street = players.slice(nSeated);
  const groups = boards.map(() => []);
  seated.forEach((p, i) => groups[i % B].push(p));
  boards.forEach((bc, i) => {
    st.boards[bc.id] = { id: bc.id, content: bc, stock: [S.stockStart], hist: {}, community: zero(), reveal: zero(), failed: false, suitsLost: 0, chair: null, votes: [], standing: {}, pending: { lag: zero(), coin: [], activist: 0 } };
    const drop = S.seatDropOrder.slice(0, Math.max(0, S.boardSize - groups[i].length));
    const types = SEAT_ORDER.filter(x => !drop.includes(x));
    groups[i].forEach((p, k) => seatDirector(st, p.id, p.name, bc, types[k] || SEAT_ORDER[k % 5], null));
    const ds = directorsOf(st, bc.id);
    if (ds.length) st.boards[bc.id].chair = pick(st, ds).id;
  });
  street.forEach(p => addStreet(st, p.id, p.name));
  for (const s of streetSeats(st)) if (!s.consulted) s.consulted = pick(st, Object.keys(st.boards));
  logEv(st, t, 'assign', { boards: boards.map(b => b.id), street: street.length });
}
function seatDirector(st, id, name, bc, seatType, avoidIdx) {
  const card = (bc.directors || []).find(d => d.seat === seatType) || { seat: seatType, name: SEAT_LABEL[seatType], title: '', home: '', exposure: { text: '', trigger: null }, secrets: [] };
  const n = (card.secrets || []).length;
  let sIdx = n ? Math.floor(rnd(st) * n) : -1;
  if (avoidIdx != null && n > 1 && sIdx === avoidIdx) sIdx = (sIdx + 1) % n;
  const prev = st.seats[id] || {};
  st.seats[id] = { ...prev, id, name, kind: 'director', board: bc.id, seat: seatType, card: { seat: card.seat, name: card.name, title: card.title, home: card.home }, exposure: card.exposure, secret: sIdx >= 0 ? card.secrets[sIdx] : null, secretIdx: sIdx, history: (prev.history || []).concat(bc.id), score: null, sold: prev.sold || {}, leaked: prev.leaked || {} };
}
function orderBoards(list) {
  const pr = S.boardPriority, idx = b => { const k = pr.findIndex(p => b.id.startsWith(p)); return k < 0 ? 99 : k; };
  return list.slice().sort((a, b) => idx(a) - idx(b));
}

// ---------- rounds ----------
function enterShock(st, t) {
  st.phase = 'shock';
  const r = st.round;
  for (const b of Object.values(st.boards)) {
    b.votes = []; b.disclosure = null;
    b.hist[r] = { passed: [], tags: [], payoutM: 0, staffCut: 0, effects: zero(), spentPos: 0, net: 0, disclosure: null, decided: false, caught: false, caughtBy: null, caughtOn: [], sued: false, settled: false, founderFailed: false, resolves: null, raisesDetect: 0, ifFound: zero(), stockStart: stockNow(b), stockEnd: null, suitsLost: 0 };
    // carry-ins: lag payback and coin flips from last round, activist payout push, standing pay ties
    const h = b.hist[r];
    addEff(h.effects, b.pending.lag); b.pending.lag = zero();
    for (const c of b.pending.coin) { if (rnd(st) < (c.chance ?? 0.5)) { addEff(h.effects, c.effects); feed(st, t, b.content.name + ': a bet paid off.', { kind: 'coin', board: b.id }); } }
    b.pending.coin = [];
    if (b.pending.activist) { h.effects.shareholders += b.pending.activist; h.activistPush = true; b.pending.activist = 0; }
    for (const tag of Object.keys(b.standing.pay || {})) addEff(h.effects, S.payTieEffects[tag]);
  }
  st.streetActions[r] = {};
  for (const s of streetSeats(st)) s.weak = s.cred < S.credLow;
  const ss = streetSeats(st).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (ss.length && Object.keys(st.boards).length) st.visits[r] = { seat: ss[st.schedule.indexOf(r) % ss.length].id, board: null, out: false };
  feed(st, t, 'Round ' + r + ': ' + (roundContent(st, r).title || ''), { kind: 'shock' });
  setClock(st, t, st.settings.timers.shock);
}
function enterPlay(st, t) {
  st.phase = 'play';
  const r = st.round, v = st.visits[r];
  if (v) {
    if (!v.board) {
      const seen = new Set(Object.values(st.visits).filter(x => x.seat === v.seat && x.board).map(x => x.board));
      const opts = Object.keys(st.boards).filter(id => !seen.has(id) && !st.boards[id].failed);
      v.board = opts.length ? pick(st, opts) : pick(st, Object.keys(st.boards));
    }
    feed(st, t, 'The ' + st.seats[v.seat].label + ' is attending ' + st.boards[v.board].content.name + '.', { kind: 'visit', board: v.board });
  }
  const rc = roundContent(st, r);
  setClock(st, t, st.settings.timers.play || rc.timer_s);
}
function enterOutside(st, t) {
  for (const b of Object.values(st.boards)) for (const v of b.votes) if (v.open) closeVote(st, b, v, t);
  resolveRound(st, t);
  st.phase = 'outside';
  const last = st.schedule[st.schedule.length - 1] === st.round;
  setClock(st, t, last ? null : st.settings.timers.outside);
}
export function advance(st, t) {
  if (st.phase === 'lobby') {
    if (st.players.length < 1) return { ok: false, error: 'Nobody has joined.' };
    assign(st, t); st.round = st.schedule[0]; enterShock(st, t);
  } else if (st.phase === 'shock') enterPlay(st, t);
  else if (st.phase === 'play') enterOutside(st, t);
  else if (st.phase === 'outside') {
    const i = st.schedule.indexOf(st.round);
    if (i < st.schedule.length - 1) { st.round = st.schedule[i + 1]; enterShock(st, t); } else enterReveal(st, t);
  } else return { ok: false, error: 'Game is over.' };
  return { ok: true };
}
export function tick(st, t) {
  if (!st.settings.autoAdvance || !st.clock || st.clock.paused) return false;
  if (t >= st.clock.endsAt) { advance(st, t); return true; }
  return false;
}
function enterReveal(st, t) { scoreAll(st); st.phase = 'reveal'; st.clock = null; feed(st, t, 'Reveal.', { kind: 'reveal' }); }

// ---------- budget ----------
// Rounds 1-2: net cost of passed motions <= budget_m. Round 3 (must_save_m): positive costs <= budget_m.
export function budgetRoom(st, b, r) {
  const br = boardRound(b.content, r), h = b.hist[r];
  return br.must_save_m ? r1((br.budget_m || 0) - h.spentPos) : r1((br.budget_m || 0) - h.net);
}
const fits = (st, b, r, m) => (m.cost_m <= 0 || m.cost_m <= budgetRoom(st, b, r));

// ---------- votes ----------
function openVote(st, b, seat, a, t) {
  if (st.phase !== 'play') return 'Votes open during the round.';
  if (b.votes.some(v => v.open)) return 'Another vote is open.';
  const r = st.round, h = b.hist[r];
  const v = { id: 'v' + (++st.seq), kind: a.kind, target: a.target || null, nominee: a.nominee || null, by: seat.id, opened: t, open: true, ballots: {}, result: null };
  if (a.kind === 'motion') {
    const m = menu(st, b, r).find(x => x.id === a.target);
    if (!m) return 'No such motion.';
    if (h.passed.includes(m.id)) return 'Already passed.';
    if (!fits(st, b, r, m)) return 'Over budget.';
    if (m.available === 'suit_pending' && !suitPending(st, b)) return 'No suit is pending.';
    if (m.flags && m.flags.removes_chair) {
      const nom = st.seats[a.nominee];
      if (!nom || nom.board !== b.id || nom.id === b.chair) return 'Pick a director to take the chair.';
    } else if (seat.id !== b.chair) return 'Only the Chair calls a vote.';
    if (m.standing && m.flags && m.flags.tags && m.flags.tags.some(tg => (b.standing.pay || {})[tg])) return 'Already in place.';
    if (m.id === 'poison_pill' && b.standing.pill) return 'Already in place.';
  } else if (a.kind === 'disclosure') {
    if (seat.id !== b.chair) return 'Only the Chair calls a vote.';
  } else return 'Unknown vote.';
  b.votes.push(v);
  logEv(st, t, 'vote_open', { board: b.id, vote: v.id, kind: v.kind, target: v.target, by: seat.id });
  return null;
}
function castBallot(st, b, seat, a, t) {
  const v = b.votes.find(x => x.id === a.vote && x.open);
  if (!v) return 'That vote is closed.';
  const ok = v.kind === 'disclosure' ? ['tell', 'spin', 'bury'] : ['yes', 'no'];
  if (!ok.includes(a.choice)) return 'Bad ballot.';
  v.ballots[seat.id] = a.choice;
  if (directorsOf(st, b.id).every(d => v.ballots[d.id])) closeVote(st, b, v, t);
  return null;
}
function closeVote(st, b, v, t) {
  v.open = false; v.closed = t;
  const ds = directorsOf(st, b.id), r = st.round, h = b.hist[r];
  const vals = Object.entries(v.ballots).filter(([id]) => ds.some(d => d.id === id)).map(([, c]) => c);
  if (v.kind === 'disclosure') {
    if (!vals.length) { v.result = 'no votes'; }
    else {
      const n = { tell: 0, spin: 0, bury: 0 }; vals.forEach(c => n[c]++);
      const max = Math.max(n.tell, n.spin, n.bury);
      let top = Object.keys(n).filter(k => n[k] === max);
      if (top.length > 1) { const cv = v.ballots[b.chair]; top = top.includes(cv) ? [cv] : [top[0]]; }   // Chair breaks ties
      v.result = top[0]; b.disclosure = top[0]; h.decided = true;
    }
  } else {
    const m = menu(st, b, r).find(x => x.id === v.target);
    const yes = vals.filter(c => c === 'yes').length, no = vals.length - yes;
    const pass = m.flags && m.flags.removes_chair ? yes > ds.length / 2 : yes > no;
    v.result = pass ? 'passed' : 'failed';
    if (pass) { if (!fits(st, b, r, m)) v.result = 'over budget'; else passMotion(st, b, m, v, t); }
    if (!pass && m.flags && m.flags.founder_wants) h.founderFailed = true;
  }
  logEv(st, t, 'vote_close', { board: b.id, vote: v.id, kind: v.kind, target: v.target, result: v.result, ballots: { ...v.ballots } });
}
function passMotion(st, b, m, v, t) {
  const r = st.round, h = b.hist[r], fl = m.flags || {};
  h.passed.push(m.id);
  h.net = r1(h.net + m.cost_m); if (m.cost_m > 0) h.spentPos = r1(h.spentPos + m.cost_m);
  addEff(h.effects, m.effects);
  if (fl.tags) h.tags.push(...fl.tags);
  if (fl.payout_m) h.payoutM += Number(fl.payout_m) || 0;
  if (fl.staff_cut_pct) h.staffCut += Number(fl.staff_cut_pct) || 0;
  if (fl.lag_payback && typeof fl.lag_payback === 'object') addEff(b.pending.lag, fl.lag_payback);
  if (fl.coin_flip) b.pending.coin.push(typeof fl.coin_flip === 'object' ? fl.coin_flip : { chance: 0.5, effects: { shareholders: 1 } });
  if (fl.if_found) addEff(h.ifFound, fl.if_found);
  if (fl.reveal_effects) addEff(b.reveal, fl.reveal_effects);
  if (fl.resolves_issue) h.resolves = fl.resolves_issue === 'partial' ? (h.resolves === true ? true : 'partial') : true;
  if (fl.raises_detect) { const add = typeof fl.raises_detect === 'number' ? fl.raises_detect : S.raisesDetectTrue; h.raisesDetect += add; b.standing.detect = (b.standing.detect || 0) + (m.standing ? 0 : add); }
  // standing
  if (fl.removes_chair) { const old = b.chair; b.chair = v.nominee; feed(st, t, b.content.name + ' replaced its Chair.', { kind: 'chair', board: b.id }); logEv(st, t, 'chair', { board: b.id, from: old, to: v.nominee }); }
  if (fl.investigates_current_issue) { h.investigator = { tell: S.investigatorTellHitMult ?? fl.tell_stock_hit_mult ?? 1, bury: S.investigatorBuryPenaltyMult ?? fl.bury_penalty_mult ?? 1, detect: S.investigatorRaisesDetect ?? (typeof fl.raises_detect === 'number' ? 0 : 0) }; }
  if (fl.street_action_mult) { b.standing.pill = { ...fl.street_action_mult, ...(S.poisonPillCampaignMult != null ? { campaign: S.poisonPillCampaignMult } : {}) }; }
  if (m.standing && fl.tags) for (const tg of fl.tags) if (S.payTieEffects[tg]) b.standing.pay = { ...(b.standing.pay || {}), [tg]: r };
  if (fl.settles_suit) { h.settled = true; h.plaintiffCut = fl.plaintiff_cut ?? 0.3; }
  if (m.standing) feed(st, t, b.content.name + ': ' + m.title + '.', { kind: 'standing', board: b.id });
}

// Derived indices (content has no wage tracker): wage index = workers effect this round minus staff cuts;
// payout index = $M paid to owners this round.
export const wageIndex = h => r1(h.effects.workers - h.staffCut / 10);
export const payoutIndex = h => h.payoutM;

// ---------- resolve one round ----------
function resolveRound(st, t) {
  const r = st.round, rc = roundContent(st, r), acts = st.streetActions[r] || {}, visit = st.visits[r];
  const prevR = st.schedule[st.schedule.indexOf(r) - 1];
  for (const b of Object.values(st.boards)) {
    const h = b.hist[r];
    if (!h.decided) {
      const prev = st.schedule.slice(0, st.schedule.indexOf(r)).reverse().map(n => b.hist[n] && b.hist[n].disclosure).find(Boolean);
      b.disclosure = prev || S.defaultDisclosure;
      feed(st, t, b.content.name + ': Board failed to decide.', { kind: 'nodecide', board: b.id });
    }
    h.disclosure = b.disclosure;
    h._d = 0;
    // activist scoring from last round: did the target raise payout this round?
    if (prevR) for (const [sid, a] of Object.entries(st.streetActions[prevR] || {})) {
      if (a.type !== 'campaign' || a.target !== b.id) continue;
      const s = st.seats[sid], raised = h.payoutM > b.hist[prevR].payoutM;
      if (s) { if (raised) s.payoutRaised++; scoreStreet(s, raised, prevR, a); }
    }
  }
  // Street actions
  for (const [sid, a] of Object.entries(acts)) {
    const s = st.seats[sid], b = st.boards[a.target]; if (!s || !b) continue;
    const h = b.hist[r], strength = s.weak ? 0.5 : 1;
    a.hit = null;
    if (a.type === 'inspect') {
      if (h.disclosure === 'tell') { a.hit = false; a.found = false; }   // street.json: an inspect that finds a Tell is a false hit
      else {
        const base = ((boardRound(b.content, r).issue || {}).detect_base || S.detectBase)[h.disclosure] ?? S.detectBase[h.disclosure];
        let p = base + h.raisesDetect + (b.standing.detect || 0) * 0;
        for (const n of Object.keys(b.hist)) if (Number(n) < r) p += b.hist[n].raisesDetect;   // raises_detect carries forward
        if (visit && visit.board === b.id && !visit.out) p += S.detectVisitBonus;
        if (h.investigator) p += S.detectInvestigatorBonus;
        p = Math.min(0.97, p * strength);
        a.found = rnd(st) < p;
        if (a.found) { a.hit = true; h.caught = true; h.caughtBy = h.caughtBy || s.label; }
        else a.hit = null;   // a miss is not a claim
      }
    } else if (a.type === 'story') {
      a.hit = S.reporterTrueOn.includes(h.disclosure);
      if (a.hit) { h.caught = true; h.caughtBy = h.caughtBy || s.label; }
    } else if (a.type === 'campaign') {
      const mult = (b.standing.pill && b.standing.pill.campaign) || 1;
      h._d += S.activistHit * strength * mult;
      b.pending.activist = S.activistPayoutPush;
      a.hit = undefined;   // judged next round (payout raised?)
    } else if (a.type === 'file') {
      h.sued = true;
    }
  }
  // leaks of the issue also count as "found" for if_found (RULES.md)
  // stock
  for (const b of Object.values(st.boards)) {
    const h = b.hist[r], br = boardRound(b.content, r);
    const leaked = st.leaks.some(l => l.round === r && l.board === b.id);
    if (h.caught || leaked) addEff(h.effects, h.ifFound);
    let d = h._d;
    d += h.effects.shareholders * S.stockPerShareholderPoint;
    if (prevR && b.hist[prevR]) d += wageIndex(b.hist[prevR]) * S.stockPerWorkerPointLag;
    if (r === 3 && b.hist[1] && prevR !== 1) d += wageIndex(b.hist[1]) * S.stockRound3WorkerRecognition;
    const dz = S.disclosureStock[h.disclosure] || { clean: 0, caught: 0 };
    if (h.caught) {
      let hit = dz.caught;
      const harmK = h.resolves === true ? 0 : h.resolves === 'partial' ? 0.5 : 1;   // resolves_issue removes or halves the harm part
      hit = hit * (1 - S.harmShareOfCaught) + hit * S.harmShareOfCaught * harmK;
      if (h.investigator && h.disclosure === 'bury') hit *= h.investigator.bury;
      d += hit;
    } else {
      let v = dz.clean;
      if (h.investigator && h.disclosure === 'tell') v *= h.investigator.tell;
      d += v;
    }
    if (visit && visit.board === b.id && visit.out) d += S.execSessionHit;
    if (br.must_save_m) {
      h.saved = r1(-h.net);
      h.mustSaveShort = r1(Math.max(0, br.must_save_m - h.saved));
      if (h.mustSaveShort > 0) { d -= h.mustSaveShort * S.missedSavingsPerM; feed(st, t, b.content.name + ' missed its savings target.', { kind: 'savings', board: b.id }); }
    }
    if (rc.stock_shift) d += Number(rc.stock_shift) || 0;
    d += (rnd(st) * 2 - 1) * S.noise;
    h._d = d;
  }
  // suits
  for (const [sid, a] of Object.entries(acts)) {
    const s = st.seats[sid], b = st.boards[a.target]; if (!s || !b || a.type !== 'file') continue;
    const h = b.hist[r];
    const harm = Object.values(b.hist).some(x => x.caught && x.disclosure === 'bury');
    const dodge = wageIndex(h) >= S.dodgeWageIndexMin || (payoutIndex(h) <= S.dodgePayoutMMax && h.effects.shareholders <= 0);
    let win = a.kind === 'harm' ? harm : a.kind === 'dodge' ? dodge : harm || dodge;
    const ov = (st.suitOverrides[r] || {})[sid];
    if (ov === 'win') win = true; if (ov === 'lose') win = false;
    if (h.settled) { a.result = 'settled'; a.hit = true; s.score += S.plaintiffSettleCut * (h.plaintiffCut || 0.3) / 0.3; h._d += S.settleStock; }
    else if (win) { a.result = 'won'; a.hit = true; h.suitsLost++; b.suitsLost++; h._d += S.suitLossStock; }
    else { a.result = 'lost'; a.hit = false; }
  }
  for (const b of Object.values(st.boards)) {
    const h = b.hist[r];
    h.stockEnd = r1(Math.max(1, stockNow(b) + h._d)); b.stock.push(h.stockEnd); delete h._d;
    if (!b.failed && (h.stockEnd < S.failFloor || b.suitsLost >= S.suitsLostToFail)) { b.failed = true; feed(st, t, b.content.name + ' has failed.', { kind: 'failed', board: b.id }); }
  }
  for (const [sid, a] of Object.entries(acts)) {
    const s = st.seats[sid], b = st.boards[a.target]; if (!s || !b) continue;
    const h = b.hist[r];
    if (a.type === 'short') { a.hit = h.stockEnd < h.stockStart; if (a.hit) { b.stock[b.stock.length - 1] = r1(h.stockEnd + S.shortHitIfTrue); h.stockEnd = stockNow(b); } }
    if (a.hit !== undefined) scoreStreet(s, a.hit, r, a);
    else s.hits.push({ round: r, type: a.type, target: a.target, hit: null, pending: true });
    feed(st, t, headline(s, a, b), { kind: 'street', board: b.id, street: s.role });
    if (s.weak && S.credResetAfterLow) s.cred = Math.max(s.cred, S.credLow);
  }
  for (const s of Object.values(st.seats)) {
    if (s.kind !== 'director' || !s.sold[r]) continue;
    const sale = s.sold[r], b = st.boards[sale.board], h = b.hist[r];
    const watched = Object.values(acts).some(a => a.target === b.id && ['inspect', 'story', 'short'].includes(a.type));
    sale.drop = r1(h.stockStart - h.stockEnd);
    sale.caught = watched && sale.drop > 0;
    if (sale.caught) feed(st, t, 'Insider sale caught at ' + b.content.name + '.', { kind: 'insider', board: b.id });
  }
  recomputeCommunities(st, false);
  logEv(st, t, 'resolve', { round: r, stocks: Object.fromEntries(Object.values(st.boards).map(b => [b.id, stockNow(b)])) });
}
function scoreStreet(s, hit, r, a) {
  const pts = (S.streetHit[s.role] || { true: 3, false: -2 });
  const w = s.weak ? 0.5 : 1;
  const old = s.hits.find(x => x.pending && x.round === r && x.type === a.type);
  if (old) Object.assign(old, { hit, pending: false }); else s.hits.push({ round: r, type: a.type, target: a.target, hit, result: a.result || null, found: a.found });
  if (hit === true) { s.score += pts.true * w * s.cred; s.cred = Math.min(S.credMax, s.cred + S.credTrue); }
  if (hit === false) { s.score += pts.false * w; if (s.role !== 'activist') s.cred = Math.max(S.credMin, s.cred + S.credFalse); }
}
function headline(s, a, b) {
  const n = b.content.name;
  if (a.type === 'inspect') return a.found ? 'Auditor finds a problem at ' + n + '.' : 'Auditor inspected ' + n + '.';
  if (a.type === 'story') return 'Reporter: ' + n + ' buried it.';
  if (a.type === 'campaign') return 'Activist campaign against ' + n + '.';
  if (a.type === 'short') return 'Short seller bets against ' + n + '.';
  if (a.type === 'file') return "Plaintiff's lawyer sues " + n + (a.result ? ': ' + a.result + '.' : '.');
  return s.label + ' acts on ' + n + '.';
}
function recomputeCommunities(st, final) {
  for (const b of Object.values(st.boards)) {
    const c = zero();
    for (const n of Object.keys(b.hist).map(Number)) {
      const h = b.hist[n]; if (!h.disclosure) continue;
      c.shareholders += h.effects.shareholders * 0.5;
      c.workers += wageIndex(h);
      c.customers += h.effects.customers;
      c.home += h.effects.home * (n === 3 ? 2 : 1);   // home community ranks on who absorbed The Dry Year
      c.public += h.effects.public + (S.publicHonesty[h.disclosure] || 0);
    }
    c.shareholders += (stockNow(b) - b.stock[0]) / 2;
    if (final) addEff(c, b.reveal);
    for (const k of COMMUNITIES) c[k] = r1(c[k]);
    b.community = c;
  }
}

// ---------- individual + Street actions ----------
function resign(st, s, t) {
  if (!['shock', 'play'].includes(st.phase)) return 'Resign at the start of a round.';
  const b = st.boards[s.board], r = st.round;
  st.resigns[r] = st.resigns[r] || {};
  if ((st.resigns[r][b.id] || 0) >= S.resignPerBoardPerRound) return 'Someone on this board already resigned this round.';
  const others = Object.values(st.boards).filter(x => x.id !== b.id && !x.failed);
  if (!others.length) return 'There is no other board to join.';
  const dest = others.sort((x, y) => directorsOf(st, x.id).length - directorsOf(st, y.id).length || (x.id < y.id ? -1 : 1))[0];
  const taken = new Set(directorsOf(st, dest.id).map(d => d.seat));
  const seatType = SEAT_ORDER.find(x => !taken.has(x)) || s.seat;
  const used = directorsOf(st, dest.id).filter(d => d.seat === seatType).map(d => d.secretIdx)[0];
  st.resigns[r][b.id] = (st.resigns[r][b.id] || 0) + 1;
  s.prior = (s.prior || []).concat({ board: b.id, seat: s.seat, secret: s.secret, exposure: s.exposure, round: r });
  for (const v of b.votes) if (v.open) delete v.ballots[s.id];
  seatDirector(st, s.id, s.name, dest.content, seatType, used ?? null);
  st.seats[s.id].prior = s.prior;
  if (b.chair === s.id) { const ds = directorsOf(st, b.id); b.chair = ds.length ? pick(st, ds).id : null; }
  feed(st, t, 'Director resigned from ' + b.content.name + ', joins ' + dest.content.name + '.', { kind: 'resign', board: b.id });
  logEv(st, t, 'resign', { seat: s.id, from: b.id, to: dest.id });
  return null;
}

export function apply(st, a) {
  try { const err = applyInner(st, a, a.t || 0); return err ? { ok: false, error: err } : { ok: true }; }
  catch (e) { return { ok: false, error: 'Engine error: ' + e.message, crash: true }; }
}
function applyInner(st, a, t) {
  if (a.by === 'host') return hostAction(st, a, t);
  if (a.type === 'join') { join(st, { id: a.by, name: a.name, t }); return null; }
  const s = st.seats[a.by];
  if (!s) return 'Not seated yet.';
  if (a.type === 'chat') return chat(st, s, a, t);
  if (st.phase === 'reveal') return 'The game is over.';
  if (s.kind === 'director') {
    const b = st.boards[s.board];
    if (b.failed) return 'This firm has failed.';
    switch (a.type) {
      case 'open_vote': return openVote(st, b, s, a, t);
      case 'ballot': return castBallot(st, b, s, a, t);
      case 'close_vote': { if (s.id !== b.chair) return 'Only the Chair closes a vote.'; const v = b.votes.find(x => x.open); if (!v) return 'No open vote.'; closeVote(st, b, v, t); return null; }
      case 'exec_session': {
        if (s.id !== b.chair) return 'Only the Chair calls an executive session.';
        const v = st.visits[st.round]; if (st.phase !== 'play' || !v || v.board !== b.id || v.out) return 'Nobody is visiting.';
        v.out = true; feed(st, t, b.content.name + ' went into executive session.', { kind: 'exec', board: b.id }); logEv(st, t, 'exec', { board: b.id }); return null;
      }
      case 'leak': {
        if (!['shock', 'play'].includes(st.phase)) return 'Leak during the round.';
        if (s.leaked[st.round]) return 'One leak per round.';
        const to = st.seats[a.to]; if (!to || to.kind !== 'street') return 'Pick a Street member.';
        const is = boardRound(b.content, st.round).issue || {};
        const fact = a.fact === 'disclosure' && b.disclosure ? b.content.name + ' voted to ' + b.disclosure + ' on this: ' + is.text : b.content.name + ': ' + is.text;
        s.leaked[st.round] = a.to;
        st.leaks.push({ round: st.round, from: s.id, to: a.to, board: b.id, fact, t });
        logEv(st, t, 'leak', { from: s.id, to: a.to, board: b.id }); return null;
      }
      case 'resign': return resign(st, s, t);
      case 'sell': {
        if (st.phase !== 'play') return 'Sell during the round.';
        if (s.sold[st.round]) return 'Already sold this round.';
        s.sold[st.round] = { board: b.id, price: stockNow(b), t }; logEv(st, t, 'sell', { seat: s.id, board: b.id }); return null;
      }
      default: return 'Unknown action.';
    }
  }
  switch (a.type) {
    case 'street_action': {
      if (!['shock', 'play'].includes(st.phase)) return 'Street actions are entered before the boards lock.';
      if (!st.boards[a.target]) return 'Pick a board.';
      st.streetActions[st.round][s.id] = { type: s.actionType, target: a.target, kind: s.actionType === 'file' ? (a.kind === 'harm' ? 'harm' : 'dodge') : null, t };
      logEv(st, t, 'street_action', { seat: s.id, type: s.actionType, target: a.target, kind: a.kind || null }); return null;
    }
    case 'street_leak': {   // Street to Street tip (short seller can leak to the reporter)
      const to = st.seats[a.to]; if (!to || to.kind !== 'street' || to.id === s.id) return 'Pick another Street member.';
      if (!st.boards[a.board]) return 'Pick a board.';
      st.leaks.push({ round: st.round, from: s.id, to: a.to, board: a.board, fact: s.label + ' tip: look at ' + st.boards[a.board].content.name + '.', t, street: true });
      return null;
    }
    case 'visit_board': {
      const v = st.visits[st.round]; if (!v || v.seat !== s.id || st.phase !== 'shock') return 'You are not visiting this round.';
      const seen = Object.entries(st.visits).filter(([n, x]) => Number(n) !== st.round && x.seat === s.id).map(([, x]) => x.board);
      if (!st.boards[a.board] || seen.includes(a.board)) return 'Pick a board you have not visited.';
      v.board = a.board; return null;
    }
    default: return 'Unknown action.';
  }
}
function chat(st, s, a, t) {
  const text = String(a.text || '').trim().slice(0, 400); if (!text) return 'Empty message.';
  let ch = a.ch;
  if (ch === 'board') { if (s.kind !== 'director') return 'Not on a board.'; ch = 'board:' + s.board; }
  else if (ch === 'street') { if (s.kind !== 'street') return 'Street only.'; }
  else if (ch && ch.startsWith('dm:')) {
    const other = st.seats[ch.slice(3)];
    if (!other || other.kind !== 'director' || s.kind !== 'director' || other.board !== s.board || other.id === s.id) return 'Private messages stay inside your board.';
    ch = 'dm:' + [s.id, other.id].sort().join('|');
  } else return 'Pick a channel.';
  st.chat.push({ seq: ++st.seq, t, round: st.round, phase: st.phase, ch, from: s.id, name: s.name, board: s.board || null, text });
  return null;
}
function hostAction(st, a, t) {
  switch (a.type) {
    case 'set_boards': if (st.phase !== 'lobby') return 'Set boards in the lobby.'; st.settings.boardCount = Math.max(1, Math.min(5, a.n | 0)); return null;
    case 'set_timers': st.settings.timers = { ...st.settings.timers, ...a.timers }; return null;
    case 'start': if (st.phase !== 'lobby') return 'Already started.'; return advance(st, t).error || null;
    case 'advance': return advance(st, t).error || null;
    case 'pause': if (st.clock && !st.clock.paused) { st.clock.remaining = clockLeft(st, t); st.clock.paused = true; } return null;
    case 'resume': if (st.clock && st.clock.paused) { st.clock.endsAt = t + st.clock.remaining; st.clock.paused = false; } return null;
    case 'add_time': if (st.clock) { const ms = (a.secs || 30) * 1000; if (st.clock.paused) st.clock.remaining += ms; else st.clock.endsAt += ms; } return null;
    case 'auto': st.settings.autoAdvance = !!a.on; return null;
    case 'skip_round2': if (st.round >= 2) return 'Round 2 has started.'; st.schedule = st.schedule.filter(r => r !== 2); return null;
    case 'suit_override': st.suitOverrides[st.round] = { ...(st.suitOverrides[st.round] || {}), [a.seat]: a.value }; return null;
    case 'kick': { const s = st.seats[a.seat]; if (st.phase === 'lobby') st.players = st.players.filter(p => p.id !== a.seat); else if (s) s.away = true; return null; }
    case 'reveal': if (st.phase === 'play') enterOutside(st, t); if (st.phase !== 'outside') return 'Reveal after the last round.'; enterReveal(st, t); return null;
    default: return 'Unknown host action.';
  }
}

// ---------- scoring ----------
// Director: secret met (largest) - exposure fired + home community's rank of the board (small) + insider sales.
export function scoreAll(st) {
  recomputeCommunities(st, true);
  const nB = Object.keys(st.boards).length;
  for (const s of Object.values(st.seats)) {
    if (s.kind === 'street') {
      const met = s.secret ? evalRule(s.secret.check, { state: st, seat: s }) : 0;
      s.secretMet = !!met; s.final = r1(s.score + met * S.streetSecretBonus); continue;
    }
    const b = st.boards[s.board], ctx = { state: st, board: b, seat: s };
    const sec = s.secret ? evalRule(s.secret.check, ctx) : 0;
    const fired = s.exposure && s.exposure.trigger ? evalRule(s.exposure.trigger, ctx) === 1 : false;
    const home = homeCommunity(s), rank = rankOf(st, home, b.id);
    const homePts = nB > 1 ? (nB - rank) / (nB - 1) : 1;
    let insider = 0;
    for (const sale of Object.values(s.sold)) insider += sale.caught ? -S.insiderCaughtPenalty : Math.max(0, sale.drop || 0) * S.insiderGainPerPoint;
    let total = sec * S.secretWeight - (fired ? S.exposurePenalty : 0) + homePts * S.homeRankWeight + insider;
    if (b.failed && !(s.secret && rewardsFailure(s.secret.check))) total = Math.min(total, S.failedCap);
    s.score = { total: r1(total), secret: sec, exposureFired: fired, homeRank: rank, home, insider: r1(insider) };
  }
}
export function homeCommunity(s) { return { labor: 'workers', fund: 'shareholders', community: 'home', attorney: 'public', founder_friend: 'shareholders' }[s.seat] || 'public'; }

// ---------- views ----------
const clamp5 = x => Math.max(0, Math.min(4, Math.round(x)));
const dials = h => ({ payout: clamp5(2 + h.effects.shareholders + (h.payoutM >= 30 ? 1 : 0)), wages: clamp5(2 + wageIndex(h)), price: clamp5(2 - h.effects.customers) });
function statement(b, r) {
  const h = b.hist[r]; if (!h || !h.disclosure) return null;
  const is = boardRound(b.content, r).issue || {};
  if (h.disclosure === 'bury') return { kind: 'none', text: 'No statement.' };
  return { kind: 'statement', text: h.disclosure === 'tell' ? 'The board disclosed: ' + (is.text || '') : (is.spin || 'The board issued a statement.').replace(/^"|"$/g, '') };
}
export function publicView(st, t) {
  const rc = st.round ? roundContent(st, st.round) : null, v = st.visits[st.round];
  const out = {
    code: st.code, phase: st.phase, round: st.round, schedule: st.schedule, clockLeft: clockLeft(st, t), clockTotal: st.clock ? st.clock.total : null, paused: !!(st.clock && st.clock.paused),
    shock: rc ? { title: rc.title, text: rc.projector_text || rc.text || '', board_text: rc.board_text || '', image: rc.image || null } : null,
    players: st.phase === 'lobby' ? st.players.map(p => p.name) : st.players.length,
    boardCount: st.settings.boardCount,
    visit: v && v.board && st.phase !== 'shock' ? { label: st.seats[v.seat].label, board: v.board, out: v.out } : null,
    boards: Object.values(st.boards).map(b => {
      const done = st.schedule.filter(r => b.hist[r] && b.hist[r].stockEnd != null), lastR = done[done.length - 1];
      return { id: b.id, name: b.content.name, industry: b.content.industry, image: b.content.image || null, stock: b.stock, failed: b.failed,
        dials: lastR ? dials(b.hist[lastR]) : { payout: 2, wages: 2, price: 2 }, statements: done.map(r => ({ round: r, ...statement(b, r) })), seats: directorsOf(st, b.id).length };
    }),
    feed: st.feed.slice(-40),
  };
  if (st.phase === 'reveal') out.reveal = revealView(st);
  return out;
}
export function seatView(st, id, t) {
  const s = st.seats[id];
  const base = { me: s ? { id, name: s.name, kind: s.kind } : { id, name: (st.players.find(p => p.id === id) || {}).name, kind: 'waiting' }, public: publicView(st, t) };
  if (!s) return base;
  const r = st.round;
  if (s.kind === 'street') {
    const v = st.visits[r];
    const seen = Object.entries(st.visits).filter(([n, x]) => Number(n) !== r && x.seat === id).map(([, x]) => x.board);
    return { ...base, street: {
      role: s.role, label: s.label, secret: s.secret ? s.secret.text : '', actionType: s.actionType, actionText: s.actionText, cred: r1(s.cred), weak: s.weak,
      consulted: s.role === 'auditor' && s.consulted ? st.boards[s.consulted].content.name : null,
      action: (st.streetActions[r] || {})[id] || null, history: s.hits,
      visiting: v && v.seat === id ? { board: v.board, out: v.out, canPick: st.phase === 'shock', seen } : null,
      leaks: st.leaks.filter(l => l.to === id).map(l => ({ round: l.round, board: l.board, fact: l.fact })),
      score: st.phase === 'reveal' ? s.final : null,
      members: streetSeats(st).map(x => ({ id: x.id, name: x.name, label: x.label })),
    }, chat: st.chat.filter(c => c.ch === 'street').slice(-200) };
  }
  const b = st.boards[s.board], br = boardRound(b.content, r), h = b.hist[r];
  return { ...base, director: {
    seat: s.seat, seatLabel: SEAT_LABEL[s.seat], card: s.card, exposure: s.exposure ? s.exposure.text : '', secret: s.secret ? s.secret.text : '',
    chair: b.chair === id, score: st.phase === 'reveal' ? s.score : null,
    sold: !!s.sold[r], leaked: !!s.leaked[r], canResign: ['shock', 'play'].includes(st.phase) && !((st.resigns[r] || {})[b.id] >= S.resignPerBoardPerRound),
    prior: (s.prior || []).map(p => ({ board: st.boards[p.board].content.name, round: p.round })),
  }, board: {
    id: b.id, name: b.content.name, industry: b.content.industry, blurb: b.content.blurb, image: b.content.image || null, labels: b.content.communityLabels, failed: b.failed,
    directors: directorsOf(st, b.id).map(d => ({ id: d.id, name: d.name, seat: d.seat, seatLabel: SEAT_LABEL[d.seat], cardName: d.card.name, title: d.card.title, chair: d.id === b.chair })),
    budget: br.budget_m || 0, room: h ? budgetRoom(st, b, r) : 0, mustSave: br.must_save_m || 0, saved: h ? r1(-h.net) : 0,
    motions: h ? menu(st, b, r).filter(m => !m.standing).map(m => ({ id: m.id, title: m.title, cost_m: m.cost_m, motive: m.motive, effects: m.effects, passed: h.passed.includes(m.id), fits: fits(st, b, r, m) })) : [],
    standing: h ? menu(st, b, r).filter(m => m.standing).map(m => ({ id: m.id, title: m.title, cost_m: m.cost_m, motive: m.motive, effects: m.effects, passed: h.passed.includes(m.id), fits: fits(st, b, r, m), anyone: !!(m.flags && m.flags.removes_chair), available: m.available !== 'suit_pending' || suitPending(st, b) })) : [],
    suitPending: suitPending(st, b),
    issue: br.issue ? { text: br.issue.text, tell: br.issue.tell, spin: br.issue.spin, bury: br.issue.bury } : null,
    disclosure: b.disclosure, decided: h ? h.decided : false,
    votes: b.votes.map(v => ({ id: v.id, kind: v.kind, target: v.target, nominee: v.nominee, by: v.by, open: v.open, result: v.result, voted: Object.keys(v.ballots), ballots: v.open ? null : v.ballots, mine: v.ballots[id] || null })),
    visitor: st.visits[r] && st.visits[r].board === b.id && st.phase !== 'shock' ? { label: st.seats[st.visits[r].seat].label, out: st.visits[r].out } : null,
    street: streetSeats(st).map(x => ({ id: x.id, label: x.label, name: x.name })),
  }, chat: st.chat.filter(c => c.ch === 'board:' + b.id || (c.ch.startsWith('dm:') && c.ch.slice(3).split('|').includes(id))).slice(-300) };
}

// ---------- reveal ----------
export function revealView(st) {
  const boards = Object.values(st.boards), grid = {};
  for (const c of COMMUNITIES) communityTable(st, c).forEach((e, i) => { (grid[e.id] = grid[e.id] || {})[c] = i + 1; });
  const directors = Object.values(st.seats).filter(s => s.kind === 'director');
  const leagues = {};
  for (const k of SEAT_ORDER) {
    const best = directors.filter(d => d.seat === k && d.score).sort((a, b) => b.score.total - a.score.total)[0];
    if (best) leagues[k] = { label: SEAT_LABEL[k], name: best.name, board: st.boards[best.board].content.name, score: best.score.total };
  }
  const chairs = boards.map(b => st.seats[b.chair]).filter(x => x && x.score).sort((a, b) => b.score.total - a.score.total);
  if (chairs[0]) leagues.chair = { label: 'Chair', name: chairs[0].name, board: st.boards[chairs[0].board].content.name, score: chairs[0].score.total };
  const sb = streetSeats(st).sort((a, b) => (b.final || 0) - (a.final || 0))[0];
  if (sb) leagues.street = { label: 'Street', name: sb.name, board: sb.label, score: sb.final };
  return {
    communities: COMMUNITIES, grid, leagues,
    boards: boards.map(b => ({
      id: b.id, name: b.content.name, labels: b.content.communityLabels, failed: b.failed, stock: b.stock, community: b.community,
      gained: COMMUNITIES.filter(c => b.community[c] > 0.5), paid: COMMUNITIES.filter(c => b.community[c] < -0.5),
      rounds: st.schedule.filter(r => b.hist[r] && b.hist[r].disclosure).map(r => {
        const h = b.hist[r], br = boardRound(b.content, r), all = menu(st, b, r);
        return { round: r, issue: br.issue ? br.issue.text : '', disclosure: h.disclosure, decided: h.decided, caught: h.caught, caughtBy: h.caughtBy, passed: h.passed.map(id => (all.find(m => m.id === id) || { title: id }).title), effects: h.effects, quotes: quotes(st, b, r) };
      }),
      directors: directors.filter(d => d.board === b.id).map(d => ({ name: d.name, seat: SEAT_LABEL[d.seat], exposure: d.exposure ? d.exposure.text : '', fired: d.score ? d.score.exposureFired : false, secret: d.secret ? d.secret.text : '', secretMet: d.score ? d.score.secret : 0, score: d.score ? d.score.total : 0, chair: b.chair === d.id })),
    })),
    street: streetSeats(st).map(s => ({ name: s.name, label: s.label, score: s.final, cred: r1(s.cred), secretMet: s.secretMet, hits: s.hits })),
  };
}
function quotes(st, b, r) {
  const lines = st.chat.filter(c => c.ch === 'board:' + b.id && c.round === r && c.text.length >= 12);
  return lines.slice().sort((x, y) => y.text.length - x.text.length).slice(0, 2).sort((x, y) => x.seq - y.seq).map(c => {
    const shown = st.feed.filter(f => f.seq < c.seq && (!f.board || f.board === b.id)).slice(-1)[0];
    return { name: c.name, text: c.text, projector: shown ? shown.text : '' };
  });
}
