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
  reporter: { name: 'Reporter', action: 'story' }, auditor: { name: 'Auditor', action: 'inspect' },
};

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
  return { boards, rounds, standing: [], street: { ...(Array.isArray(st) ? {} : st), seats: seats.filter(x => S.streetPriority.includes(x.seat)), priority: S.streetPriority } };   // middle cut: Auditor and Reporter only
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
    phase: 'lobby', round: 0, schedule: [1, 2], clock: null,
    players: [], seats: {}, boards: {}, chat: [], feed: [], log: [],
    streetActions: {}, draft: null, seq: 0,
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
const issueFacts = (b, r) => ((boardRound(b.content || b, r).issue || {}).facts) || [];
const factW = fs => fs.reduce((n, f) => n + (f.weight || 1), 0);
function feed(st, t, text, extra = {}) { st.feed.push({ seq: ++st.seq, t, round: st.round, text, ...extra }); }
function logEv(st, t, type, data) { st.log.push({ seq: ++st.seq, t, round: st.round, type, ...data }); }
function setClock(st, t, secs) { st.clock = secs == null ? null : { endsAt: t + secs * 1000, paused: false, remaining: secs * 1000, total: secs * 1000 }; }
export function clockLeft(st, t) { if (!st.clock) return null; return Math.max(0, st.clock.paused ? st.clock.remaining : st.clock.endsAt - t); }

// ---------- join ----------
export function join(st, { id, name, t }) {
  if (st.players.find(p => p.id === id)) return { ok: true, rejoin: true };
  const clean = String(name || '').trim().slice(0, 40) || 'Player ' + (st.players.length + 1);
  st.players.push({ id, name: clean, joinedAt: t });
  if (st.phase !== 'lobby') { addStreet(st, id, clean, null); feed(st, t, clean + ' joined the Street.', { kind: 'join' }); }
  return { ok: true };
}
function addStreet(st, id, name, forced) {
  const pr = st.content.street.priority, n = streetSeats(st).length;
  const role = forced || pr[n % pr.length];
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

// ---------- assignment (waiting room -> boards) ----------
// st.draft = { boards: [boardId], seats: { boardId: { seatType: playerId|null } }, chairs: { boardId: playerId|null }, outside: { playerId: 'reporter'|'auditor' } }
// The host edits the draft in the lobby (draft_auto, draft_seat, draft_chair, draft_outside); start deals everyone still unplaced.
function unplace(d, id) {
  for (const o of Object.values(d.seats)) for (const k of Object.keys(o)) if (o[k] === id) o[k] = null;
  delete d.outside[id];
}
function emptyDraft(st) {
  const n = Math.min(st.settings.boardCount, st.content.boards.length);
  const boards = orderBoards(st.content.boards).slice(0, n).map(b => b.id);
  return { boards, seats: Object.fromEntries(boards.map(id => [id, Object.fromEntries(SEAT_ORDER.map(k => [k, null]))])), chairs: {}, outside: {} };
}
const placedIds = d => new Set([...Object.values(d.seats).flatMap(o => Object.values(o)), ...Object.keys(d.outside)].filter(Boolean));
function draftAuto(st) {
  const d = emptyDraft(st), players = shuffle(st, st.players);
  const B = Math.min(d.boards.length, Math.max(1, Math.floor(players.length / S.minBoardSize)));
  d.boards = d.boards.slice(0, B); d.seats = Object.fromEntries(d.boards.map(id => [id, d.seats[id]]));
  const nSeated = Math.min(players.length, B * S.boardSize), groups = d.boards.map(() => []);
  players.slice(0, nSeated).forEach((p, i) => groups[i % B].push(p));
  d.boards.forEach((id, i) => {
    const drop = S.seatDropOrder.slice(0, Math.max(0, S.boardSize - groups[i].length)), types = SEAT_ORDER.filter(x => !drop.includes(x));
    groups[i].forEach((p, k) => { d.seats[id][types[k] || SEAT_ORDER[k % 5]] = p.id; });
    const ids = groups[i].map(p => p.id); if (ids.length) d.chairs[id] = pick(st, ids);
  });
  const pr = st.content.street.priority;
  players.slice(nSeated).forEach((p, i) => { d.outside[p.id] = pr[i % pr.length]; });
  st.draft = d;
}
function fillDraft(st) {   // everyone the host left unplaced takes the first open seat, else goes outside
  if (!st.draft) draftAuto(st);
  const d = st.draft, placed = placedIds(d), pr = st.content.street.priority;
  for (const p of st.players) {
    if (placed.has(p.id)) continue;
    let done = false;
    for (const id of d.boards) { const k = SEAT_ORDER.find(x => !d.seats[id][x]); if (k) { d.seats[id][k] = p.id; done = true; break; } }
    if (!done) d.outside[p.id] = pr[Object.keys(d.outside).length % pr.length];
  }
}
export function placementOf(st, id) {   // what the waiting room shows a player once the host has placed them
  const d = st.draft; if (!d) return null;
  for (const bid of d.boards) for (const k of SEAT_ORDER) if (d.seats[bid][k] === id) return { kind: 'director', board: (st.content.boards.find(b => b.id === bid) || {}).name, seat: k, seatLabel: SEAT_LABEL[k] };
  if (d.outside[id]) return { kind: 'street', role: d.outside[id], seatLabel: (STREET_DEFAULT[d.outside[id]] || {}).name };
  return null;
}
export function assign(st, t) {
  fillDraft(st);
  const d = st.draft;
  d.boards.forEach(bid => {
    const bc = st.content.boards.find(b => b.id === bid), mem = SEAT_ORDER.filter(k => d.seats[bid][k]).map(k => [k, d.seats[bid][k]]);
    if (!mem.length) return;
    st.boards[bid] = { id: bid, content: bc, stock: [S.stockStart], hist: {}, community: zero(), reveal: zero(), failed: false, chair: null, votes: [], standing: {}, pending: { lag: zero(), coin: [] } };
    for (const [k, pid] of mem) seatDirector(st, pid, st.players.find(p => p.id === pid).name, bc, k, null);
    const c = d.chairs[bid];
    st.boards[bid].chair = mem.some(([, pid]) => pid === c) ? c : pick(st, mem.map(([, pid]) => pid));
  });
  for (const [pid, role] of Object.entries(d.outside)) addStreet(st, pid, st.players.find(p => p.id === pid).name, role);
  for (const s of streetSeats(st)) if (!s.consulted) s.consulted = pick(st, Object.keys(st.boards));
  logEv(st, t, 'assign', { boards: Object.keys(st.boards), street: Object.keys(d.outside).length });
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
    b.votes = []; b.disclosure = null; b.admit = null; b.statement = '';
    b.hist[r] = { passed: [], tags: [], payoutM: 0, staffCut: 0, effects: zero(), spentPos: 0, net: 0, disclosure: null, admit: [], statement: '', omittedFrac: 0, decided: false, caught: false, caughtBy: null, caughtFacts: [], caughtOn: [], founderFailed: false, resolves: null, raisesDetect: 0, ifFound: zero(), stockStart: stockNow(b), stockEnd: null };
    // carry-ins: lag payback and coin flips from last round, activist payout push, standing pay ties
    const h = b.hist[r];
    addEff(h.effects, b.pending.lag); b.pending.lag = zero();
    for (const c of b.pending.coin) { if (rnd(st) < (c.chance ?? 0.5)) { addEff(h.effects, c.effects); feed(st, t, b.content.name + ': a bet paid off.', { kind: 'coin', board: b.id }); } }
    b.pending.coin = [];
  }
  st.streetActions[r] = {};
  for (const s of streetSeats(st)) s.weak = s.cred < S.credLow;
  feed(st, t, 'Round ' + r + ': ' + (roundContent(st, r).title || ''), { kind: 'shock' });
  setClock(st, t, st.settings.timers.shock);
}
function enterPlay(st, t) {
  st.phase = 'play';
  const r = st.round;
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

// No budgets in the middle cut: any motion can be called.
const fits = () => true;

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
    if (seat.id !== b.chair) return 'Only the Chair calls a vote.';
  } else if (a.kind === 'facts') {
    if (seat.id !== b.chair) return 'Only the Chair calls a vote.';
    if (h.decided) return 'The facts and statement are locked.';
  } else return 'Unknown vote.';
  b.votes.push(v);
  logEv(st, t, 'vote_open', { board: b.id, vote: v.id, kind: v.kind, target: v.target, by: seat.id });
  return null;
}
function castBallot(st, b, seat, a, t) {
  const v = b.votes.find(x => x.id === a.vote && x.open);
  if (!v) return 'That vote is closed.';
  if (v.kind === 'facts') {
    const ids = issueFacts(b, st.round).map(f => f.id);
    if (!Array.isArray(a.admit) || a.admit.some(x => !ids.includes(x))) return 'Bad ballot.';
    v.ballots[seat.id] = ids.filter(x => a.admit.includes(x));   // the facts this director wants admitted
  } else {
    if (!['yes', 'no'].includes(a.choice)) return 'Bad ballot.';
    v.ballots[seat.id] = a.choice;
  }
  if (directorsOf(st, b.id).every(d => v.ballots[d.id])) closeVote(st, b, v, t);
  return null;
}
function closeVote(st, b, v, t) {
  v.open = false; v.closed = t;
  const ds = directorsOf(st, b.id), r = st.round, h = b.hist[r];
  const vals = Object.entries(v.ballots).filter(([id]) => ds.some(d => d.id === id)).map(([, c]) => c);
  if (v.kind === 'facts') {
    if (!vals.length) { v.result = 'no votes'; }
    else {
      // majority per fact; a tie follows the Chair's ballot (not admitted when the Chair has none)
      const cv = v.ballots[b.chair] || [];
      const admit = issueFacts(b, r).map(f => f.id).filter(id => {
        const n = vals.filter(x => x.includes(id)).length, no = vals.length - n;
        return n > no || (n === no && cv.includes(id));
      });
      lockFacts(st, b, h, admit);
      v.result = 'locked'; v.admit = admit;
    }
  } else {
    const m = menu(st, b, r).find(x => x.id === v.target);
    const yes = vals.filter(c => c === 'yes').length, no = vals.length - yes;
    const pass = yes > no;
    v.result = pass ? 'passed' : 'failed';
    if (pass) passMotion(st, b, m, v, t);
    if (!pass && m.flags && m.flags.founder_wants) h.founderFailed = true;
  }
  logEv(st, t, 'vote_close', { board: b.id, vote: v.id, kind: v.kind, target: v.target, result: v.result, ballots: { ...v.ballots } });
}
// Lock the facts the board admits and its public statement. h.disclosure keeps all / some / none for the rules.
function lockFacts(st, b, h, admit) {
  const fs = issueFacts(b, st.round), out = fs.filter(f => !admit.includes(f.id));
  b.admit = admit; h.admit = admit.slice(); h.decided = true;
  h.statement = String(b.statement || '').trim().slice(0, S.statementMax);
  h.omittedFrac = fs.length ? factW(out) / factW(fs) : 0;
  b.disclosure = h.disclosure = !out.length ? 'all' : out.length === fs.length ? 'none' : 'some';
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
}

// Derived indices (content has no wage tracker): wage index = workers effect this round minus staff cuts;
// payout index = $M paid to owners this round.
export const wageIndex = h => r1(h.effects.workers - h.staffCut / 10);
export const payoutIndex = h => h.payoutM;

// ---------- resolve one round ----------
function resolveRound(st, t) {
  const r = st.round, rc = roundContent(st, r), acts = st.streetActions[r] || {};
  const prevR = st.schedule[st.schedule.indexOf(r) - 1];
  for (const b of Object.values(st.boards)) {
    const h = b.hist[r];
    if (!h.decided) {
      // previous round's call stands (round 1: admit nothing). Same level; a partial call admits as many facts, lightest first.
      const prevR2 = st.schedule[st.schedule.indexOf(r) - 1];
      const prev = st.schedule.slice(0, st.schedule.indexOf(r)).reverse().map(n => b.hist[n] && b.hist[n].disclosure).find(Boolean) || S.defaultDisclosure;
      const fs = issueFacts(b, r), light = fs.slice().sort((x, y) => x.weight - y.weight || (x.id < y.id ? -1 : 1));
      const prevN = prev === 'all' ? fs.length : prev === 'none' ? 0 : Math.max(1, Math.min(fs.length - 1, ((b.hist[prevR2] || {}).admit || []).length));
      const keep = light.slice(0, prevN).map(f => f.id);
      b.statement = '';
      lockFacts(st, b, h, fs.map(f => f.id).filter(id => keep.includes(id)));
      h.decided = false;
      feed(st, t, b.content.name + ': Board failed to decide.', { kind: 'nodecide', board: b.id });
    }
    h._d = 0;
  }
  // Street actions
  for (const [sid, a] of Object.entries(acts)) {
    const s = st.seats[sid], b = st.boards[a.target]; if (!s || !b) continue;
    const h = b.hist[r], strength = s.weak ? 0.5 : 1;
    a.hit = null;
    const left = issueFacts(b, r).filter(f => !h.admit.includes(f.id));
    const catchFact = f => { if (!h.caughtFacts.some(c => c.id === f.id)) h.caughtFacts.push({ id: f.id, weight: f.weight }); h.caught = true; h.caughtBy = h.caughtBy || s.label; };
    if (a.type === 'inspect') {
      if (!left.length) { a.hit = false; a.found = false; }   // street.json: an inspect of a board that admitted every fact is a false hit
      else {
        let bonus = h.raisesDetect + (b.standing.detect || 0) * 0;
        for (const n of Object.keys(b.hist)) if (Number(n) < r) bonus += b.hist[n].raisesDetect;   // raises_detect carries forward
        const found = left.filter(f => rnd(st) < Math.min(0.97, ((S.factDetect[f.weight] ?? S.factDetect[1]) + bonus) * strength));
        found.forEach(catchFact);
        a.found = found.length > 0; a.hit = a.found ? true : null;   // a miss is not a claim
      }
    } else if (a.type === 'story') {
      a.hit = left.length > 0;   // a story finds the heaviest fact the board left out
      if (a.hit) catchFact(left.slice().sort((x, y) => y.weight - x.weight || (x.id < y.id ? -1 : 1))[0]);
    }
  }
  // stock
  for (const b of Object.values(st.boards)) {
    const h = b.hist[r], br = boardRound(b.content, r);
    if (h.caught) addEff(h.effects, h.ifFound);
    let d = h._d;
    d += h.effects.shareholders * S.stockPerShareholderPoint;
    if (prevR && b.hist[prevR]) d += wageIndex(b.hist[prevR]) * S.stockPerWorkerPointLag;
    // stock from the facts: admitted facts cost a little, hidden-and-uncaught facts pay a little, caught facts cost a lot (config/scoring.js factStock)
    const fs = issueFacts(b, r), tot = factW(fs) || 1, fr = fs.length ? h.omittedFrac : 0;
    const caughtFrac = Math.min(fr, factW(h.caughtFacts) / tot);
    const harmK = h.resolves === true ? 0 : h.resolves === 'partial' ? 0.5 : 1;   // resolves_issue removes or halves the harm part
    let hit = S.factStock.caught * caughtFrac;
    hit = hit * (1 - S.harmShareOfCaught) + hit * S.harmShareOfCaught * harmK;
    let adm = S.factStock.admitted * (1 - fr), hid = S.factStock.hidden * (fr - caughtFrac);
    d += hit + adm + hid;
    if (rc.stock_shift) d += Number(rc.stock_shift) || 0;
    d += (rnd(st) * 2 - 1) * S.noise;
    h._d = d;
  }
  for (const b of Object.values(st.boards)) {
    const h = b.hist[r];
    h.stockEnd = r1(Math.max(1, stockNow(b) + h._d)); b.stock.push(h.stockEnd); delete h._d;
    if (!b.failed && h.stockEnd < S.failFloor) { b.failed = true; feed(st, t, b.content.name + ' has failed.', { kind: 'failed', board: b.id }); }
  }
  for (const [sid, a] of Object.entries(acts)) {
    const s = st.seats[sid], b = st.boards[a.target]; if (!s || !b) continue;
    const h = b.hist[r];
    if (a.hit !== undefined) scoreStreet(s, a.hit, r, a);
    else s.hits.push({ round: r, type: a.type, target: a.target, hit: null, pending: true });
    feed(st, t, headline(s, a, b), { kind: 'street', board: b.id, street: s.role });
    if (s.weak && S.credResetAfterLow) s.cred = Math.max(s.cred, S.credLow);
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
  if (a.type === 'story') return 'Reporter: ' + n + ' left something out.';
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
      c.home += h.effects.home * (n === st.schedule[st.schedule.length - 1] ? 2 : 1);   // home community ranks on who absorbed The Dry Year
      c.public += h.effects.public + S.publicHonesty.admitAll + (S.publicHonesty.hideAll - S.publicHonesty.admitAll) * (h.omittedFrac || 0);
    }
    c.shareholders += (stockNow(b) - b.stock[0]) / 2;
    if (final) addEff(c, b.reveal);
    for (const k of COMMUNITIES) c[k] = r1(c[k]);
    b.community = c;
  }
}

// ---------- Street actions ----------
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
      case 'statement': {   // one shared text box per board: any director edits, last write wins, locked with the facts
        if (st.phase !== 'play') return 'Write the statement during the round.';
        if (b.hist[st.round].decided) return 'The facts and statement are locked.';
        b.statement = String(a.text || '').slice(0, S.statementMax); return null;
      }
      default: return 'Unknown action.';
    }
  }
  switch (a.type) {
    case 'street_action': {
      if (!['shock', 'play'].includes(st.phase)) return 'Street actions are entered before the boards lock.';
      if (!st.boards[a.target]) return 'Pick a board.';
      st.streetActions[st.round][s.id] = { type: s.actionType, target: a.target, kind: null, t };
      logEv(st, t, 'street_action', { seat: s.id, type: s.actionType, target: a.target, kind: a.kind || null }); return null;
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
    case 'set_boards': if (st.phase !== 'lobby') return 'Set boards in the lobby.'; st.settings.boardCount = Math.max(1, Math.min(5, a.n | 0)); st.draft = null; return null;
    case 'draft_auto': if (st.phase !== 'lobby') return 'Assign in the lobby.'; draftAuto(st); return null;
    case 'draft_clear': if (st.phase !== 'lobby') return 'Assign in the lobby.'; st.draft = emptyDraft(st); return null;
    case 'draft_seat': {   // place a player in a board seat (a.player null empties it); a player is only ever in one place
      if (st.phase !== 'lobby') return 'Assign in the lobby.';
      if (!st.draft) st.draft = emptyDraft(st);
      const d = st.draft; if (!d.seats[a.board] || !SEAT_ORDER.includes(a.seat)) return 'No such seat.';
      if (a.player && !st.players.find(p => p.id === a.player)) return 'No such player.';
      if (a.player) unplace(d, a.player);
      d.seats[a.board][a.seat] = a.player || null; return null;
    }
    case 'draft_outside': {
      if (st.phase !== 'lobby') return 'Assign in the lobby.';
      if (!st.draft) st.draft = emptyDraft(st);
      if (!st.players.find(p => p.id === a.player)) return 'No such player.';
      unplace(st.draft, a.player);
      if (a.role) { if (!st.content.street.priority.includes(a.role)) return 'No such role.'; st.draft.outside[a.player] = a.role; }
      return null;
    }
    case 'draft_chair': if (st.draft && st.draft.seats[a.board]) st.draft.chairs[a.board] = a.player; return null;
    case 'set_timers': st.settings.timers = { ...st.settings.timers, ...a.timers }; return null;
    case 'start': if (st.phase !== 'lobby') return 'Already started.'; return advance(st, t).error || null;
    case 'advance': return advance(st, t).error || null;
    case 'pause': if (st.clock && !st.clock.paused) { st.clock.remaining = clockLeft(st, t); st.clock.paused = true; } return null;
    case 'resume': if (st.clock && st.clock.paused) { st.clock.endsAt = t + st.clock.remaining; st.clock.paused = false; } return null;
    case 'add_time': if (st.clock) { const ms = (a.secs || 30) * 1000; if (st.clock.paused) st.clock.remaining += ms; else st.clock.endsAt += ms; } return null;
    case 'auto': st.settings.autoAdvance = !!a.on; return null;
    case 'kick': { const s = st.seats[a.seat]; if (st.phase === 'lobby') { st.players = st.players.filter(p => p.id !== a.seat); if (st.draft) unplace(st.draft, a.seat); } else if (s) s.away = true; return null; }
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
    let total = sec * S.secretWeight - (fired ? S.exposurePenalty : 0) + homePts * S.homeRankWeight;
    if (b.failed && !(s.secret && rewardsFailure(s.secret.check))) total = Math.min(total, S.failedCap);
    s.score = { total: r1(total), secret: sec, exposureFired: fired, homeRank: rank, home };
  }
}
export function homeCommunity(s) { return { labor: 'workers', fund: 'shareholders', community: 'home', attorney: 'public', founder_friend: 'shareholders' }[s.seat] || 'public'; }

// ---------- views ----------
const clamp5 = x => Math.max(0, Math.min(4, Math.round(x)));
const dials = h => ({ payout: clamp5(2 + h.effects.shareholders + (h.payoutM >= 30 ? 1 : 0)), wages: clamp5(2 + wageIndex(h)), price: clamp5(2 - h.effects.customers) });
function statement(b, r) {
  const h = b.hist[r]; if (!h || !h.disclosure) return null;
  const facts = issueFacts(b, r);
  return { kind: h.statement ? 'statement' : 'none', text: h.statement || 'No statement.', caught: h.caughtFacts.map(c => (facts.find(f => f.id === c.id) || {}).text).filter(Boolean) };
}
export function publicView(st, t) {
  const rc = st.round ? roundContent(st, st.round) : null;
  const out = {
    code: st.code, phase: st.phase, round: st.round, schedule: st.schedule, clockLeft: clockLeft(st, t), clockTotal: st.clock ? st.clock.total : null, paused: !!(st.clock && st.clock.paused),
    shock: rc ? { title: rc.title, text: rc.projector_text || rc.text || '', board_text: rc.board_text || '', image: rc.image || null } : null,
    players: st.phase === 'lobby' ? st.players.map(p => p.name) : st.players.length,
    boardCount: st.settings.boardCount,
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
  if (!s) return { ...base, placed: placementOf(st, id), joined: st.players.length };
  const r = st.round;
  if (s.kind === 'street') {
    return { ...base, street: {
      role: s.role, label: s.label, secret: s.secret ? s.secret.text : '', actionType: s.actionType, actionText: s.actionText, cred: r1(s.cred), weak: s.weak,
      consulted: s.role === 'auditor' && s.consulted ? st.boards[s.consulted].content.name : null,
      action: (st.streetActions[r] || {})[id] || null, history: s.hits,
      score: st.phase === 'reveal' ? s.final : null,
    }, chat: st.chat.filter(c => c.ch === 'street').slice(-200) };
  }
  const b = st.boards[s.board], br = boardRound(b.content, r), h = b.hist[r];
  return { ...base, director: {
    seat: s.seat, seatLabel: SEAT_LABEL[s.seat], card: s.card, exposure: s.exposure ? s.exposure.text : '', secret: s.secret ? s.secret.text : '',
    chair: b.chair === id, score: st.phase === 'reveal' ? s.score : null,
  }, board: {
    id: b.id, name: b.content.name, industry: b.content.industry, blurb: b.content.blurb, image: b.content.image || null, labels: b.content.communityLabels, failed: b.failed,
    directors: directorsOf(st, b.id).map(d => ({ id: d.id, name: d.name, seat: d.seat, seatLabel: SEAT_LABEL[d.seat], cardName: d.card.name, title: d.card.title, chair: d.id === b.chair })),
    motions: h ? menu(st, b, r).filter(m => !m.standing).map(m => ({ id: m.id, title: m.title, short: m.short || m.title, motive: m.motive, effects: m.effects, passed: h.passed.includes(m.id) })) : [],
    issue: br.issue ? { text: br.issue.text, facts: (br.issue.facts || []).map(f => ({ id: f.id, text: f.text, weight: f.weight })) } : null,
    admit: h && h.decided ? h.admit : null, statement: h ? (h.decided ? h.statement : b.statement || '') : '', statementMax: S.statementMax, decided: h ? h.decided : false,
    votes: b.votes.map(v => ({ id: v.id, kind: v.kind, target: v.target, nominee: v.nominee, by: v.by, open: v.open, result: v.result, voted: Object.keys(v.ballots), ballots: v.open ? null : v.ballots, mine: v.ballots[id] || null })),
  }, chat: st.chat.filter(c => c.ch === 'board:' + b.id || (c.ch.startsWith('dm:') && c.ch.slice(3).split('|').includes(id))).slice(-300) };
}

// ---------- reveal ----------
export function revealView(st) {
  const boards = Object.values(st.boards), grid = {};
  for (const c of COMMUNITIES) communityTable(st, c).forEach((e, i) => { (grid[e.id] = grid[e.id] || {})[c] = i + 1; });
  const directors = Object.values(st.seats).filter(s => s.kind === 'director');
  return {
    communities: COMMUNITIES, grid,
    boards: boards.map(b => ({
      id: b.id, name: b.content.name, labels: b.content.communityLabels, failed: b.failed, stock: b.stock, community: b.community,
      gained: COMMUNITIES.filter(c => b.community[c] > 0.5), paid: COMMUNITIES.filter(c => b.community[c] < -0.5),
      rounds: st.schedule.filter(r => b.hist[r] && b.hist[r].disclosure).map(r => {
        const h = b.hist[r], br = boardRound(b.content, r), all = menu(st, b, r);
        return { round: r, issue: br.issue ? br.issue.text : '', level: h.disclosure, statement: h.statement, facts: issueFacts(b, r).map(f => ({ id: f.id, text: f.text, weight: f.weight, admitted: h.admit.includes(f.id), caught: h.caughtFacts.some(c => c.id === f.id) })), decided: h.decided, caught: h.caught, caughtBy: h.caughtBy, passed: h.passed.map(id => (all.find(m => m.id === id) || { title: id }).title), effects: h.effects, quotes: quotes(st, b, r) };
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
