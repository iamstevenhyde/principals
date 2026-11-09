// Pure HTML-string renderers shared by the pages and the node simulation (no DOM access here).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ---- icon kit: stroke icons, no words. Same five stakeholders in the same order everywhere. ----
const svg = d => `<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const STAKE = ['shareholders', 'workers', 'customers', 'home', 'public'];
export const STAKE_ICON = {
  shareholders: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.2 1.2-1.8 2.5-1.8s2.5.6 2.5 1.8-1.2 1.6-2.5 1.9-2.5.7-2.5 2 1.2 1.8 2.5 1.8 2.5-.6 2.5-1.8"/>'),
  workers: svg('<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 6v5"/>'),
  customers: svg('<path d="M3 5h3l2 11h10l2-8H7"/><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>'),
  home: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  public: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};
export const SEAT_ICON = {
  attorney: svg('<path d="M12 3v18M6 21h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'),
  labor: STAKE_ICON.workers, fund: STAKE_ICON.shareholders, community: STAKE_ICON.home,
  founder_friend: svg('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4M21 12v3"/>'),
  auditor: svg('<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>'),
};
export const ICON = {
  check: svg('<path d="M4 12l5 5L20 6"/>'), chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'), crown: svg('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'), eye: STAKE_ICON.public,
  fire: svg('<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'), star: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  swap: svg('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};
// one fixed strip per motion: the five stakeholders, always in this order; arrow up (green) or down (red), 1 or 2 chevrons
export function effectStrip(eff, labels) {
  const L = labels || {};
  return `<span class="strip">${STAKE.map(k => { const v = (eff || {})[k] || 0, n = Math.min(2, Math.abs(v)), name = L[k] || COMM_LABEL[k] || k;
    return `<span class="cell ${v > 0 ? 'up' : v < 0 ? 'down' : 'zero'}" title="${esc(name)}" aria-label="${esc(name + (v > 0 ? ' gains' : v < 0 ? ' loses' : ' unchanged'))}">${STAKE_ICON[k]}<b class="chev">${v === 0 ? '' : (v > 0 ? '▲' : '▼').repeat(n)}</b></span>`; }).join('')}</span>`;
}
export const STAKE_WORD = { shareholders: 'Owners', workers: 'Workers', customers: 'Customers', home: 'Community', public: 'Public' };
// the five words never change between boards; the board's own names are listed in whoLine()
export const legendStrip = () => `<span class="strip legend">${STAKE.map(k => `<span class="cell zero">${STAKE_ICON[k]}<small>${STAKE_WORD[k]}</small></span>`).join('')}</span>`;
export const whoLine = labels => STAKE.map(k => `${STAKE_WORD[k]} = ${esc((labels || {})[k] || STAKE_WORD[k])}`).join(' · ');
// severity meter: 1 to 3 bars, colour ramp, no words
export const sevBars = w => `<span class="sev s${w}" role="img" title="How bad if it comes out" aria-label="How bad if it comes out: ${['', 'light', 'serious', 'severe'][w] || ''}">${[1, 2, 3].map(i => `<i class="${i <= w ? 'on' : ''}"></i>`).join('')}</span>`;
const COMM_LABEL = { shareholders: 'Shareholders', workers: 'Workers', customers: 'Customers', home: 'Home community', public: 'The public' };
export const COLORS = ['#2f6db5', '#c0562f', '#3f8f5a', '#8a5aa8', '#b58a1f'];

export function spark(series, w = 220, h = 56, color = '#2f6db5') {
  const s = series && series.length ? series : [100];
  const lo = Math.min(...s, 90), hi = Math.max(...s, 110), n = Math.max(1, s.length - 1);
  const x = i => 4 + (i / n) * (w - 8), y = v => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const pts = s.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true">
    <line x1="4" x2="${w - 4}" y1="${y(100)}" y2="${y(100)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 3"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${s.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${color}"/>`).join('')}</svg>`;
}
// 5-step dial, 0..4, needle only (no number)
export function dial(label, v) {
  const a = Math.PI * (1 - v / 4), cx = 30, cy = 30, r = 22;
  const nx = cx + Math.cos(a) * r, ny = cy - Math.sin(a) * r;
  const ticks = [0, 1, 2, 3, 4].map(i => { const t = Math.PI * (1 - i / 4); return `<line x1="${cx + Math.cos(t) * 24}" y1="${cy - Math.sin(t) * 24}" x2="${cx + Math.cos(t) * 28}" y2="${cy - Math.sin(t) * 28}" stroke="currentColor" stroke-opacity=".5"/>`; }).join('');
  return `<figure class="dial"><svg viewBox="0 0 60 36" width="64" height="38" aria-label="${esc(label)}"><path d="M4 30 A26 26 0 0 1 56 30" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="4"/>${ticks}<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--ink)"/></svg><figcaption>${esc(label)}</figcaption></figure>`;
}
export function arrows(eff) {
  return Object.entries(eff || {}).filter(([, v]) => v).map(([k, v]) => `<span class="arr ${v > 0 ? 'up' : 'down'}" title="${esc(COMM_LABEL[k] || k)}">${v > 0 ? '▲' : '▼'.repeat(1)}${Math.abs(v) > 1 ? (v > 0 ? '▲' : '▼') : ''} ${esc(shortLab(k))}</span>`).join(' ');
}
const shortLab = k => ({ shareholders: 'Owners', workers: 'Workers', customers: 'Customers', home: 'Home', public: 'Public' }[k] || k);
export function arrowsLabeled(eff, labels) {
  return Object.entries(eff || {}).filter(([, v]) => v).map(([k, v]) => `<span class="arr ${v > 0 ? 'up' : 'down'}">${v > 0 ? '▲' : '▼'}${Math.abs(v) > 1 ? (v > 0 ? '▲' : '▼') : ''} ${esc((labels || {})[k] || shortLab(k))}</span>`).join(' ');
}
export const fmtClock = ms => (ms == null ? '' : Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0'));

// ---------------- projector: the front page ----------------
const told = (n, total) => `<span class="told" aria-label="${n} of ${total} facts told">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const LEVEL_DECK = { all: 'Board comes clean', some: 'Board shares part of the story', none: 'Board says nothing about it' };
const px = v => (v == null ? '' : Number(v).toFixed(1));
function storyHTML(b, n, lead) {
  const last = b.stock[b.stock.length - 1];
  const ch = n && n.resolved ? Math.round((n.stockEnd - n.stockStart) * 10) / 10 : null;
  const kick = `<p class="kick">${esc(b.name)}<span class="px"> Share price ${px(n && n.resolved ? n.stockEnd : last)}${ch == null ? '' : ` <b class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}</b>`}</span></p>`;
  if (!n || (!n.headline && !n.locked)) {
    const chips = n ? `<p class="chips2"><span class="${n.locked ? 'ok' : ''}">${n.locked ? '✓' : '…'} Facts</span><span class="${n.result === 'passed' || n.result === 'failed' ? 'ok' : ''}">${n.result === 'passed' || n.result === 'failed' ? '✓' : '…'} Motion</span></p>` : '';
    return `<article class="story pending ${lead ? 'lead' : ''}">${kick}<h2>Board still meeting</h2>${chips}</article>`;
  }
  const deck = n.undecided ? 'Board failed to decide what to tell' : n.level ? LEVEL_DECK[n.level] : 'Facts not locked yet';
  const q = n.statement ? `<blockquote>“${esc(n.statement)}”</blockquote>` : (n.level ? '<blockquote class="none">No statement.</blockquote>' : '');
  const caught = n.caught && n.caught.length ? `<p class="caught-line"><b>${esc(n.caughtBy || 'Auditor')} finds:</b> ${esc(n.caught[0])}${n.caught.length > 1 ? ' (+' + (n.caught.length - 1) + ' more)' : ''}</p>` : '';
  return `<article class="story ${lead ? 'lead' : ''} r-${n.result}">${kick}<h2>${esc(n.headline || 'Motion not yet decided')}</h2><p class="deck">${n.level ? told(n.told, n.total) : ''}${esc(deck)}</p>${q}${caught}</article>`;
}
export function frontPage(P, round) {
  const r = round || P.round;
  const items = P.boards.map(b => ({ b, n: b.news.find(x => x.round === r) || null }));
  const score = ({ n }) => (n && n.resolved ? (n.caught.length ? 20 : 0) + Math.abs(n.stockEnd - n.stockStart) + (n.level === 'none' ? 2 : 0) : n && n.headline ? 1 : 0);
  const order = items.slice().sort((x, y) => score(y) - score(x));
  const title = P.shock ? P.shock.title : '';
  const done = items.filter(x => x.n && x.n.resolved).length;
  return `<section class="paper"><header class="mast"><span class="edn">Round ${r}${title ? ' · ' + esc(title) : ''}</span><h1>The Principal Times</h1><span class="clock" id="clk"></span></header>
    <div class="front c${Math.min(items.length, 5)}">${order.map((x, i) => storyHTML(x.b, x.n, i === 0)).join('')}</div>
    <footer class="paperfoot">${done === items.length ? 'Final edition' : 'Stories appear as boards decide'}</footer></section>`;
}

// ---------------- projector: the debrief (four screens, then one ethics screen per board) ----------------
const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
const resWord = r => ({ passed: 'Passed', failed: 'Voted down', open: 'No vote', voting: 'No vote' }[r] || 'No vote');
export function revealStageName(R) { return R.step < R.stages.length ? R.stages[R.step] : 'Ethics'; }
export function revealScreen(R) {
  const step = R.step, nS = R.stages.length;
  const stepTag = `<span class="stepno">${step + 1} of ${R.steps}</span>`;
  const wrap = (title, body, ask) => `<section class="deck-screen"><header><h2>${esc(title)}</h2>${stepTag}</header>${body}${ask ? `<p class="ask">${esc(ask)}</p>` : ''}</section>`;
  if (step === 0) {
    const rows = R.boards.map(b => `<tr><th>${esc(b.short)}</th>${R.schedule.map(r => { const n = b.news.find(x => x.round === r); return `<td>${n ? `<b>${esc(n.headline)}</b>${n.level ? told(n.told, n.total) : ''}` : ''}</td>`; }).join('')}</tr>`).join('');
    return wrap('Reactions: how the papers saw it', `<table class="cmp react"><thead><tr><th></th>${R.schedule.map(r => `<th>Round ${r}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`, 'Whose headline would you want?');
  }
  if (step === 1) {
    const rows = R.boards.map(b => `<tr><th>${esc(b.short)}</th>${R.schedule.map(r => { const n = b.news.find(x => x.round === r); return `<td>${n ? `${esc(n.motion ? n.motion.short : '')}<br><b class="res-${n.result}">${resWord(n.result)}</b> · Told ${n.told ?? 0}/${n.total}${n.caught.length ? ' · <b class="down">Caught</b>' : ''}` : ''}</td>`; }).join('')}<td class="num">${px(b.stock[0])} to <b>${px(b.stock[b.stock.length - 1])}</b></td></tr>`).join('');
    return wrap('Side by side', `<table class="cmp"><thead><tr><th></th>${R.schedule.map(r => `<th>Round ${r}</th>`).join('')}<th>Share price</th></tr></thead><tbody>${rows}</tbody></table>`);
  }
  if (step === 2) {
    const rows = R.boards.map(b => { const met = b.directors.filter(d => d.secretMet).length, fired = b.directors.filter(d => d.fired).length, caught = b.rounds.reduce((n, r) => n + r.facts.filter(f => f.caught).length, 0), hid = b.rounds.reduce((n, r) => n + r.facts.filter(f => !f.admitted).length, 0);
      return `<tr><th>${esc(b.short)}</th><td>Chair ${esc(b.chair)}</td><td>${met} of ${b.directors.length} hit a private goal</td><td>${fired} took a penalty</td><td>${hid} facts hidden, ${caught} caught</td></tr>`; }).join('');
    return wrap('Governance: who held the power', `<table class="cmp gov"><tbody>${rows}</tbody></table>`, 'Who gained from silence?');
  }
  if (step === 3) {
    const rows = R.boards.map(b => `<tr><th>${esc(b.short)}</th><td>${b.real ? b.real.cases.map(c => `${esc(c.event)} (${esc(c.years)})`).join(' and ') : ''}<br><i>${b.real ? esc(b.real.fix) : ''}</i></td></tr>`).join('');
    return wrap('Fixes: the real cases behind the boards', `<table class="cmp fix"><tbody>${rows}</tbody></table>`);
  }
  const b = R.boards[step - nS]; if (!b) return wrap('The end', '');
  const dirs = b.directors.map(d => `<tr><th>${esc(d.name)}<small>${esc(d.seat)}${d.chair ? ', Chair' : ''}</small></th><td>Goal: ${esc(d.secretLabel)} <b class="${d.secretMet ? 'up' : 'down'}">${d.secretMet ? 'Hit' : 'Missed'}</b></td><td>Penalty: ${esc(d.exposureLabel)} <b class="${d.fired ? 'down' : 'up'}">${d.fired ? 'Fired' : 'Avoided'}</b></td></tr>`).join('');
  const real = b.real ? b.real.cases.map(c => `<p class="real"><b>${esc(c.event)}, ${esc(c.years)}.</b> ${esc(c.line)}</p>`).join('') : '';
  return wrap('Ethics: ' + b.name, `<table class="cmp eth"><tbody>${dirs}</tbody></table>${real}`);
}
// phone result: why you got N points, in plain words
export function scoreLines(d) {
  const s = d.score, p = s.parts || {};
  return [
    [s.secret ? 'ok' : 'no', 'Private goal ' + (s.secret ? 'hit' : 'missed'), s.secret ? '+' + p.secret : '0'],
    [s.exposureFired ? 'no' : 'ok', 'Penalty ' + (s.exposureFired ? 'fired' : 'avoided'), s.exposureFired ? String(p.exposure) : '0'],
    ['', 'Your board ranked ' + ordinal(s.homeRank) + ' of ' + (p.of ?? '') + ' for ' + (d.homeLabel || 'your group'), '+' + (p.home ?? 0)],
  ];
}
