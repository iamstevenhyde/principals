// Principals game engine. Pure: no DOM, no network, no Date.now (the caller passes t in milliseconds).
// The host page (or the simulation) owns one state object and calls apply(state, action). Players never touch
// state; they send actions and read seatView / publicView slices that the host publishes.
//
// One decision round. Phases: lobby -> play (read the briefing and the private role card, talk, vote one option) -> reveal.
// action = { type, by: seatId | 'host', t, ...fields }. apply() returns { ok, error? } and mutates state.
// Content: content/boards/*.json and content/game.json (rules in content/RULES.md).

import { SCORING as S } from '../config/scoring.js';

export const SEAT_LABEL = { attorney: 'Attorney', labor: 'Labor director', fund: 'Fund partner', founder_friend: "Founder's friend", community: 'Community seat' };
const SEAT_ORDER = ['attorney', 'labor', 'fund', 'founder_friend', 'community'];
const SEAT_KEYS = [...SEAT_ORDER, ...SEAT_ORDER.map(k => k + '2')];   // a "2" key is a partner sharing the same role card
const seatType = k => k.replace(/2$/, '');

// ---------- rng (mulberry32; state kept in the game so a replay is exact) ----------
function rnd(st) { let a = (st.rng = (st.rng + 0x6D2B79F5) | 0); a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; }
function shuffle(st, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pick = (st, arr) => arr[Math.floor(rnd(st) * arr.length)];

export function normalizeContent(c) {
  return { boards: c.boards || [], game: c.game || { title: 'The Board Meeting', text: 'Read your briefing and your private card. Talk it over. The board votes one option.' } };
}

// ---------- create ----------
export function createGame(content, { code = 'TEST', seed = 1, boardCount = 4, timers } = {}) {
  return {
    code, seed, rng: seed | 0, content: normalizeContent(content),
    settings: { boardCount, timers: { ...S.timers, ...(timers || {}) }, autoAdvance: true },
    phase: 'lobby', clock: null,
    players: [], seats: {}, boards: {}, chat: [], feed: [], log: [],
    draft: null, seq: 0, revealStep: 0,
  };
}

// ---------- helpers ----------
export const directorsOf = (st, bid) => Object.values(st.seats).filter(s => s.board === bid);
function feed(st, t, text, extra = {}) { st.feed.push({ seq: ++st.seq, t, text, ...extra }); }
function logEv(st, t, type, data) { st.log.push({ seq: ++st.seq, t, type, ...data }); }
function setClock(st, t, secs) { st.clock = secs == null ? null : { endsAt: t + secs * 1000, paused: false, remaining: secs * 1000, total: secs * 1000 }; }
export function clockLeft(st, t) { if (!st.clock) return null; return Math.max(0, st.clock.paused ? st.clock.remaining : st.clock.endsAt - t); }
const optionOf = (b, n) => ((b.content.decision || {}).options || []).find(o => o.n === n) || null;

// ---------- join ----------
export function join(st, { id, name }) {
  if (st.players.find(p => p.id === id)) return { ok: true, rejoin: true };
  const clean = String(name || '').trim().slice(0, 40) || 'Player ' + (st.players.length + 1);
  st.players.push({ id, name: clean });
  return { ok: true };
}

// ---------- assignment (waiting room -> boards) ----------
// st.draft = { boards: [boardId], seats: { boardId: { seatKey: playerId|null } }, chairs: { boardId: playerId|null } }
// The host edits the draft in the lobby (draft_auto, draft_seat, draft_chair); start deals everyone still unplaced.
function unplace(d, id) { for (const o of Object.values(d.seats)) for (const k of Object.keys(o)) if (o[k] === id) o[k] = null; }
function orderBoards(list) {
  const pr = S.boardPriority, idx = b => { const k = pr.findIndex(p => b.id.startsWith(p)); return k < 0 ? 99 : k; };
  return list.slice().sort((a, b) => idx(a) - idx(b));
}
function emptyDraft(st) {
  const n = Math.min(st.settings.boardCount, st.content.boards.length);
  const boards = orderBoards(st.content.boards).slice(0, n).map(b => b.id);
  return { boards, seats: Object.fromEntries(boards.map(id => [id, Object.fromEntries(SEAT_KEYS.map(k => [k, null]))])), chairs: {} };
}
const placedIds = d => new Set(Object.values(d.seats).flatMap(o => Object.values(o)).filter(Boolean));
function draftAuto(st) {
  const d = emptyDraft(st), players = shuffle(st, st.players);
  const B = Math.min(d.boards.length, Math.max(1, Math.floor(players.length / S.minBoardSize)));
  d.boards = d.boards.slice(0, B); d.seats = Object.fromEntries(d.boards.map(id => [id, d.seats[id]]));
  const groups = d.boards.map(() => []);
  players.forEach((p, i) => groups[i % B].push(p));
  d.boards.forEach((id, i) => {
    const n = groups[i].length;
    const drop = S.seatDropOrder.slice(0, Math.max(0, S.boardSize - n)), types = SEAT_ORDER.filter(x => !drop.includes(x));
    const keys = [...types, ...SEAT_ORDER.map(k => k + '2')];
    groups[i].forEach((p, k) => { if (keys[k]) d.seats[id][keys[k]] = p.id; });
    const ids = groups[i].map(p => p.id); if (ids.length) d.chairs[id] = pick(st, ids);
  });
  st.draft = d;
}
function fillDraft(st) {   // everyone the host left unplaced takes the first open seat on the emptiest board
  if (!st.draft) draftAuto(st);
  const d = st.draft, placed = placedIds(d);
  const load = id => Object.values(d.seats[id]).filter(Boolean).length;
  for (const p of st.players) {
    if (placed.has(p.id)) continue;
    const bid = d.boards.slice().sort((a, b) => load(a) - load(b))[0];
    const k = SEAT_KEYS.find(x => !d.seats[bid][x]);
    if (k) d.seats[bid][k] = p.id;
  }
}
export function placementOf(st, id) {   // what the waiting room shows a player once the host has placed them
  const d = st.draft; if (!d) return null;
  for (const bid of d.boards) for (const k of SEAT_KEYS) if (d.seats[bid][k] === id) return { kind: 'director', board: (st.content.boards.find(b => b.id === bid) || {}).name, seat: seatType(k), seatLabel: SEAT_LABEL[seatType(k)] };
  return null;
}
export function assign(st, t) {
  fillDraft(st);
  const d = st.draft;
  d.boards.forEach(bid => {
    const bc = st.content.boards.find(b => b.id === bid), mem = SEAT_KEYS.filter(k => d.seats[bid][k]).map(k => [k, d.seats[bid][k]]);
    if (!mem.length) return;
    st.boards[bid] = { id: bid, content: bc, chair: null, ballots: {}, locked: false, choice: null, tally: {} };
    for (const [k, pid] of mem) seatDirector(st, pid, st.players.find(p => p.id === pid).name, bc, seatType(k));
    const c = d.chairs[bid];
    st.boards[bid].chair = mem.some(([, pid]) => pid === c) ? c : pick(st, mem.map(([, pid]) => pid));
  });
  logEv(st, t, 'assign', { boards: Object.keys(st.boards) });
}
function seatDirector(st, id, name, bc, type) {
  const card = (bc.directors || []).find(d => d.seat === type) || { seat: type, name: SEAT_LABEL[type], title: '', home: '', motive: '' };
  st.seats[id] = { id, name, board: bc.id, seat: type, card: { seat: card.seat, name: card.name, title: card.title, home: card.home, motive: card.motive || '' } };
}

// ---------- the round ----------
function enterPlay(st, t) {
  st.phase = 'play';
  setClock(st, t, st.settings.timers.play);
  feed(st, t, 'Boards are meeting.', { kind: 'play' });
}
function enterReveal(st, t) {
  for (const b of Object.values(st.boards)) if (!b.locked) lockBoard(st, b, t);
  st.phase = 'reveal'; st.clock = null; st.revealStep = 0; feed(st, t, 'Debrief.', { kind: 'reveal' });
}
export function advance(st, t) {
  if (st.phase === 'lobby') {
    if (st.players.length < 1) return { ok: false, error: 'Nobody has joined.' };
    assign(st, t); enterPlay(st, t);
  } else if (st.phase === 'play') enterReveal(st, t);
  else return { ok: false, error: 'Game is over.' };
  return { ok: true };
}
export function tick(st, t) {
  if (!st.settings.autoAdvance || !st.clock || st.clock.paused) return false;
  if (t >= st.clock.endsAt) { advance(st, t); return true; }
  return false;
}

// ---------- the vote ----------
// Each director picks one numbered option and may change it until the Chair locks the board's choice
// (or the clock ends). The option with the most ballots wins; a tie follows the Chair's ballot when it is among the tied options, else the lowest number.
function lockBoard(st, b, t) {
  const ds = directorsOf(st, b.id), tally = {};
  for (const d of ds) { const n = b.ballots[d.id]; if (n) tally[n] = (tally[n] || 0) + 1; }
  const top = Math.max(0, ...Object.values(tally));
  const tied = Object.keys(tally).map(Number).filter(n => tally[n] === top).sort((x, y) => x - y);
  b.tally = tally; b.locked = true;
  b.choice = !tied.length ? null : tied.length === 1 ? tied[0] : (tied.includes(b.ballots[b.chair]) ? b.ballots[b.chair] : tied[0]);
  const o = b.choice && optionOf(b, b.choice);
  feed(st, t, b.content.name + (o ? ' chose option ' + b.choice + '.' : ' did not decide.'), { kind: 'lock', board: b.id });
  logEv(st, t, 'lock', { board: b.id, choice: b.choice, tally, ballots: { ...b.ballots } });
}

// ---------- actions ----------
export function apply(st, a) {
  try { const err = applyInner(st, a, a.t || 0); return err ? { ok: false, error: err } : { ok: true }; }
  catch (e) { return { ok: false, error: 'Engine error: ' + e.message, crash: true }; }
}
function applyInner(st, a, t) {
  if (a.by === 'host') return hostAction(st, a, t);
  if (a.type === 'join') { join(st, { id: a.by, name: a.name }); return null; }
  const s = st.seats[a.by];
  if (!s) return 'Not seated yet.';
  if (st.phase !== 'play') return 'The board meeting is over.';
  const b = st.boards[s.board];
  switch (a.type) {
    case 'ballot': {
      if (b.locked) return 'Your board has already chosen.';
      const n = Number(a.choice);
      if (!optionOf(b, n)) return 'Pick one of the numbered options.';
      b.ballots[s.id] = n; return null;
    }
    case 'lock': {
      if (s.id !== b.chair) return 'Only the Chair locks the choice.';
      if (b.locked) return 'Your board has already chosen.';
      if (!Object.keys(b.ballots).length) return 'Cast a vote first.';
      lockBoard(st, b, t); return null;
    }
    default: return 'Unknown action.';
  }
}
function hostAction(st, a, t) {
  switch (a.type) {
    case 'set_boards': if (st.phase !== 'lobby') return 'Set boards in the lobby.'; st.settings.boardCount = Math.max(1, Math.min(5, a.n | 0)); st.draft = null; return null;
    case 'draft_auto': if (st.phase !== 'lobby') return 'Assign in the lobby.'; draftAuto(st); return null;
    case 'draft_clear': if (st.phase !== 'lobby') return 'Assign in the lobby.'; st.draft = emptyDraft(st); return null;
    case 'draft_seat': {   // place a player in a board seat (a.player null empties it); a player is only ever in one place
      if (st.phase !== 'lobby') return 'Assign in the lobby.';
      if (!st.draft) st.draft = emptyDraft(st);
      const d = st.draft; if (!d.seats[a.board] || !SEAT_KEYS.includes(a.seat)) return 'No such seat.';
      if (a.player && !st.players.find(p => p.id === a.player)) return 'No such player.';
      if (a.player) unplace(d, a.player);
      d.seats[a.board][a.seat] = a.player || null; return null;
    }
    case 'draft_chair': if (st.draft && st.draft.seats[a.board]) st.draft.chairs[a.board] = a.player; return null;
    case 'set_timers': st.settings.timers = { ...st.settings.timers, ...a.timers }; return null;
    case 'start': if (st.phase !== 'lobby') return 'Already started.'; return advance(st, t).error || null;
    case 'advance': return advance(st, t).error || null;
    case 'pause': if (st.clock && !st.clock.paused) { st.clock.remaining = clockLeft(st, t); st.clock.paused = true; } return null;
    case 'resume': if (st.clock && st.clock.paused) { st.clock.endsAt = t + st.clock.remaining; st.clock.paused = false; } return null;
    case 'add_time': if (st.clock) { const ms = (a.secs || 30) * 1000; if (st.clock.paused) st.clock.remaining += ms; else st.clock.endsAt += ms; } return null;
    case 'auto': st.settings.autoAdvance = !!a.on; return null;
    case 'kick': { if (st.phase === 'lobby') { st.players = st.players.filter(p => p.id !== a.seat); if (st.draft) unplace(st.draft, a.seat); } return null; }
    case 'reveal_step': { if (st.phase !== 'reveal') return 'Not at the debrief.'; const max = revealSteps(st) - 1; st.revealStep = Math.max(0, Math.min(max, a.to != null ? a.to | 0 : st.revealStep + (a.delta || 1))); return null; }
    case 'reveal': if (st.phase !== 'play') return 'Reveal comes after the meeting.'; enterReveal(st, t); return null;
    default: return 'Unknown host action.';
  }
}

// ---------- views ----------
// Debrief screens: one overview, then for each board a newspaper reaction, a "what happened" screen and a "discuss" screen.
export const revealSteps = st => 1 + 3 * Object.keys(st.boards).length;
const tallyList = b => ((b.content.decision || {}).options || []).map(o => ({ n: o.n, title: o.title, votes: b.tally[o.n] || 0 }));
export function publicView(st, t) {
  const out = {
    code: st.code, phase: st.phase, clockLeft: clockLeft(st, t), clockTotal: st.clock ? st.clock.total : null, paused: !!(st.clock && st.clock.paused),
    game: st.content.game,
    players: st.phase === 'lobby' ? st.players.map(p => p.name) : st.players.length,
    boardCount: st.settings.boardCount,
    boards: Object.values(st.boards).map(b => {
      const ds = directorsOf(st, b.id), o = b.locked && b.choice ? optionOf(b, b.choice) : null;
      return { id: b.id, name: b.content.name, short: b.content.short || b.content.name, industry: b.content.industry, seats: ds.length, voted: ds.filter(d => b.ballots[d.id]).length, locked: b.locked, choice: o ? { n: o.n, title: o.title } : null };
    }),
    feed: st.feed.slice(-40),
  };
  if (st.phase === 'reveal') out.reveal = revealView(st);
  return out;
}
export function seatView(st, id, t) {
  const s = st.seats[id];
  const base = { me: s ? { id, name: s.name, kind: 'director' } : { id, name: (st.players.find(p => p.id === id) || {}).name, kind: 'waiting' }, public: publicView(st, t) };
  if (!s) return { ...base, placed: placementOf(st, id), joined: st.players.length };
  const b = st.boards[s.board], bc = b.content, o = b.locked && b.choice ? optionOf(b, b.choice) : null;
  return { ...base, director: {
    seat: s.seat, seatLabel: SEAT_LABEL[s.seat], card: s.card, chair: b.chair === id, chairName: (st.seats[b.chair] || {}).name || '',
  }, board: {
    id: b.id, name: bc.name, industry: bc.industry, blurb: bc.blurb,
    briefing: bc.briefing, lead: (bc.decision || {}).lead || '', options: (bc.decision || {}).options || [],
    directors: directorsOf(st, b.id).map(d => ({ id: d.id, name: d.name, seat: d.seat, seatLabel: SEAT_LABEL[d.seat], cardName: d.card.name, title: d.card.title, chair: d.id === b.chair, voted: !!b.ballots[d.id] })),
    mine: b.ballots[id] || null, locked: b.locked, choice: o ? { n: o.n, title: o.title } : null, tally: b.locked ? tallyList(b) : null,
  }};
}

// ---------- reveal ----------
export function revealView(st) {
  const boards = Object.values(st.boards);
  return {
    step: st.revealStep || 0, steps: revealSteps(st),
    boards: boards.map(b => {
      const o = b.choice ? optionOf(b, b.choice) : null;
      return { id: b.id, name: b.content.name, short: b.content.short || b.content.name, chair: (st.seats[b.chair] || {}).name || '',
        choice: o ? { n: o.n, title: o.title } : null, press: o ? ((b.content.press || []).find(x => x.n === o.n) || null) : null, ticker: b.content.ticker || null, tally: tallyList(b), reveal: b.content.reveal || null, questions: b.content.questions || [],
        directors: directorsOf(st, b.id).map(d => ({ name: d.name, seat: SEAT_LABEL[d.seat], title: d.card.title, vote: b.ballots[d.id] || null, chair: b.chair === d.id })) };
    }),
  };
}
