// Pure HTML-string renderers shared by the pages and the node simulation (no DOM access here).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const OWN = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.2 1.2-1.8 2.5-1.8s2.5.6 2.5 1.8-1.2 1.6-2.5 1.9-2.5.7-2.5 2 1.2 1.8 2.5 1.8 2.5-.6 2.5-1.8"/>');
export const SEAT_ICON = {
  attorney: svg('<path d="M12 3v18M6 21h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'),
  labor: svg('<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 6v5"/>'), fund: OWN,
  community: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
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

// ---------------- projector: the debrief ----------------
// Screen 0: what each board chose. Then, per board, a "what happened" screen and a "discuss" screen.
export function revealScreen(R) {
  const step = R.step, tag = `<span class="stepno">${step + 1} of ${R.steps}</span>`;
  const wrap = (title, body) => `<section class="deck-screen"><header><h2>${esc(title)}</h2>${tag}</header>${body}</section>`;
  if (step === 0) {
    const rows = R.boards.map(b => `<tr><th>${esc(b.short)}</th><td>${b.choice ? `<b>Option ${b.choice.n}</b> ${esc(b.choice.title)}` : '<i>No decision</i>'}</td><td>${b.tally.filter(t => t.votes).map(t => `${t.n}: ${t.votes}`).join(' &nbsp; ')}</td></tr>`).join('');
    return wrap('What each board chose', `<table class="cmp"><thead><tr><th></th><th>Choice</th><th>Votes by option</th></tr></thead><tbody>${rows}</tbody></table>`);
  }
  const b = R.boards[Math.floor((step - 1) / 2)]; if (!b) return wrap('The end', '');
  const chose = b.choice ? `Your board chose option ${b.choice.n}: ${esc(b.choice.title)}.` : 'Your board did not decide.';
  if ((step - 1) % 2 === 0) return wrap(b.name + ': what happened', `<p class="chose">${chose}</p><h3>${esc(b.reveal ? b.reveal.case : '')}</h3><p class="real">${esc(b.reveal ? b.reveal.text : '')}</p>`);
  return wrap(b.name + ': discuss', `<p class="chose">${chose}</p><ol class="qs">${b.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>`);
}
