// Pure HTML-string renderers shared by the pages and the node simulation (no DOM access here).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const OWN = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.2 1.2-1.8 2.5-1.8s2.5.6 2.5 1.8-1.2 1.6-2.5 1.9-2.5.7-2.5 2 1.2 1.8 2.5 1.8 2.5-.6 2.5-1.8"/>');
export const SEAT_ICON = {
  attorney: svg('<path d="M12 3v18M6 21h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'),
  labor: svg('<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 6v5"/>'), fund: OWN,
  community: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  audit_chair: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  founder_friend: svg('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4M21 12v3"/>'),
};
export const ICON = {
  check: svg('<path d="M4 12l5 5L20 6"/>'), chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'), crown: svg('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  swap: svg('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};
export const COLORS = ['#2f6db5', '#c0562f', '#3f8f5a', '#8a5aa8', '#b58a1f'];
export const fmtClock = ms => (ms == null ? '' : Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0'));

// ---------------- projector: the boards while they meet ----------------
export function boardTiles(P) {
  const tile = b => `<div class="btile ${b.locked ? 'done' : ''}"><h3>${esc(b.name)}</h3><p class="mute">${esc(b.industry || '')}</p>
    ${b.locked ? `<p class="chose">${ICON.lock} ${b.choice ? 'Option ' + b.choice.n + ': ' + esc(b.choice.title) : 'No decision'}</p>`
      : `<p class="voted"><b>${b.voted}</b> of ${b.seats} have voted</p><div class="dots">${Array.from({ length: b.seats }, (_, i) => `<i class="${i < b.voted ? 'on' : ''}"></i>`).join('')}</div>`}</div>`;
  return `<section class="meeting"><header class="mhd"><h1>${esc(P.game.title)}</h1><span class="clock" id="clk"></span></header>
    <p class="bigline">${esc(P.game.text)}</p><div class="btiles">${P.boards.map(tile).join('')}</div></section>`;
}

// ---------------- projector: who sits where ----------------
// One card per board, every name large, seat label small, Chair marked. `P.seating` comes from the engine's publicView.
export function seatingGrid(P) {
  const bs = (P.seating && P.seating.boards) || [], n = bs.length;
  const stat = id => { const b = (P.boards || []).find(x => x.id === id); return !b ? '' : b.locked ? `<span class="sst done">${ICON.lock} decided</span>` : `<span class="sst">${b.voted}/${b.seats} voted</span>`; };
  const card = b => `<div class="scard"><h3>${esc(b.name)}${stat(b.id)}</h3><ul>${b.members.map(m => `<li><span class="sn">${esc(m.name)}</span><span class="sl">${m.chair ? '<b class="chr">Chair</b> ' : ''}${esc(m.label)}</span></li>`).join('')}</ul></div>`;
  const cols = n <= 3 ? Math.max(1, n) : Math.ceil(n / 2);
  return `<div class="sgrid" style="grid-template-columns:repeat(${cols},1fr)">${bs.map(card).join('')}</div>`;
}
export function seatingPlay(P) {
  return `<section class="meeting seating"><header class="mhd"><h1>${esc(P.game.title)}</h1><span class="clock" id="clk"></span></header>
    <p class="seatline">Find your name and sit with your board.</p>${seatingGrid(P)}</section>`;
}

// ---------------- projector: the debrief ----------------
// One screen per board, everything at once: press + stock on the left, real case + questions on the right.
export function revealScreen(R) {
  const b = R.boards[R.step] || R.boards[0]; if (!b) return '<section class="deck-screen"></section>';
  const chose = b.choice ? `Chose option ${b.choice.n}: ${esc(b.choice.title)}` : 'Did not decide';
  const p = b.press, t = b.ticker;
  const tabs = R.boards.map((x, i) => `<span class="rtab${i === R.step ? ' on' : ''}">${esc(x.short)}</span>`).join('');
  let left;
  if (!p) left = `<p class="real">No decision, so no story today.</p>`;
  else {
    const dn = p.stock.pct < 0, unit = '$', tail = t && t.unit !== '$' ? 'B' : '';
    left = `<h3 class="colhd">The morning after</h3><article class="paper"><h3 class="hl">${esc(p.headline)}</h3><p class="real">${esc(p.story)}</p></article><p class="ticker ${dn ? 'dn' : 'up'}">${esc(p.stock.symbol)} ${unit}${p.stock.from}${tail} to ${unit}${p.stock.to}${tail} (${p.stock.pct > 0 ? '+' : ''}${p.stock.pct}%)</p>`;
  }
  const right = `<h3 class="colhd">What happened: ${esc(b.reveal ? b.reveal.case : '')}</h3><p class="real">${esc(b.reveal ? b.reveal.text : '')}</p><h3 class="colhd">Discuss</h3><ol class="qs">${b.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>`;
  return `<section class="deck-screen one"><header><h2>${esc(b.name)}</h2><span class="chosebar">${chose}</span><span class="rtabs">${tabs}</span></header><div class="split"><div>${left}</div><div>${right}</div></div></section>`;
}
