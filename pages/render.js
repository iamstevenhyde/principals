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
  reporter: svg('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
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
export const legendStrip = labels => `<span class="strip legend">${STAKE.map(k => `<span class="cell zero" title="${esc((labels || {})[k] || COMM_LABEL[k])}">${STAKE_ICON[k]}<small>${esc(((labels || {})[k] || COMM_LABEL[k]).replace(/^The /, '').split(/[\s(]/)[0])}</small></span>`).join('')}</span>`;
// severity meter: 1 to 3 bars, colour ramp, no words
export const sevBars = w => `<span class="sev s${w}" role="img" aria-label="${['', 'light', 'serious', 'severe'][w] || ''}">${[1, 2, 3].map(i => `<i class="${i <= w ? 'on' : ''}"></i>`).join('')}</span>`;
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

export function tickerCard(b, i) {
  const last = b.stock[b.stock.length - 1], prev = b.stock[b.stock.length - 2] ?? last, ch = Math.round((last - prev) * 10) / 10;
  const st = b.statements[b.statements.length - 1];
  return `<article class="ticker ${b.failed ? 'failed' : ''}">
    <header><h3>${esc(b.name)}</h3><span class="px">${last.toFixed(1)}</span><span class="ch ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}</span></header>
    ${spark(b.stock, 220, 56, COLORS[i % COLORS.length])}
    <div class="dials">${dial('Payout', b.dials.payout)}${dial('Wages', b.dials.wages)}${dial('Price', b.dials.price)}</div>
    <p class="stmt ${st && st.kind === 'none' ? 'quiet' : ''}">${st ? esc(st.text) : '&nbsp;'}</p>
    ${st && st.caught && st.caught.length ? st.caught.map(c => `<p class="stmt-caught"><b>Caught:</b> ${esc(c)}</p>`).join('') : ''}
    ${b.failed ? '<p class="failtag">FAILED</p>' : ''}</article>`;
}
export function outsideView(P) {
  return `<section class="tickers">${P.boards.map(tickerCard).join('')}</section>
  <section class="feed"><h2>Wire</h2><ol>${P.feed.slice().reverse().slice(0, 14).map(f => `<li class="k-${esc(f.kind)}"><b>R${f.round}</b> ${esc(f.text)}</li>`).join('')}</ol></section>`;
}

const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
export function revealHTML(R) {
  const C = R.communities;
  const n = R.boards.length;
  const shade = rk => `hsl(210 45% ${30 + (rk - 1) / Math.max(1, n - 1) * 55}%)`;
  const grid = `<table class="grid"><thead><tr><th></th>${C.map(c => `<th>${esc(COMM_LABEL[c])}</th>`).join('')}</tr></thead><tbody>
    ${R.boards.map(b => `<tr><th>${esc(b.name)}${b.failed ? ' <small>failed</small>' : ''}</th>${C.map(c => { const rk = R.grid[b.id][c]; return `<td style="background:${shade(rk)};color:${rk <= n / 2 ? '#fff' : '#111'}" title="${esc((b.labels || {})[c] || c)}">${ordinal(rk)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  const boards = R.boards.map((b, i) => `<article class="rboard">
    <header><h3>${esc(b.name)}</h3>${spark(b.stock, 160, 40, COLORS[i % COLORS.length])}</header>
    <p class="recog"><span class="gain">Gained: ${b.gained.map(c => esc((b.labels || {})[c] || c)).join(', ') || 'nobody'}</span> <span class="paid">Paid: ${b.paid.map(c => esc((b.labels || {})[c] || c)).join(', ') || 'nobody'}</span></p>
    ${b.rounds.map(r => `<div class="rround"><div class="rr-h"><b>Round ${r.round}</b> <span class="disc d-${r.level}">${esc({ all: 'Admitted every fact', some: 'Admitted some facts', none: 'Admitted nothing' }[r.level] || '')}</span>${r.caught ? ` <span class="caught">caught by ${esc(r.caughtBy)}</span>` : ''}${r.decided ? '' : ' <span class="quiet">failed to decide</span>'}</div>
      <p class="issue">${esc(r.issue)}</p>
      <p class="stmt-public">${r.statement ? 'Public statement: "' + esc(r.statement) + '"' : 'No public statement.'}</p>
      <ul class="facts">${r.facts.map(f => `<li class="${f.admitted ? 'admitted' : 'omitted'} ${f.caught ? 'caughtf' : ''}">${f.admitted ? '' : '<s>'}${esc(f.text)}${f.admitted ? '' : '</s>'}${f.caught ? ' <b class="caught">caught</b>' : ''}</li>`).join('')}</ul>
      ${r.quotes.map(q => `<div class="quote"><blockquote>"${esc(q.text)}" <cite>${esc(q.name)}</cite></blockquote><p class="shown">Projector at that moment: ${esc(q.projector)}</p></div>`).join('')}</div>`).join('')}
    <ul class="dirs">${b.directors.map(d => `<li><b>${esc(d.name)}</b> ${esc(d.seat)}${d.chair ? ' (Chair)' : ''} <span class="${d.fired ? 'fired' : 'safe'}">${d.fired ? 'exposure fired' : 'exposure safe'}</span> <span class="${d.secretMet ? 'met' : 'unmet'}">${d.secretMet ? 'secret met' : 'secret missed'}</span><br><small>${esc(d.secret)}</small></li>`).join('')}</ul>
  </article>`).join('');
  const street = `<section class="rstreet"><h3>The Street</h3><ul>${R.street.map(s => `<li><b>${esc(s.name)}</b> ${esc(s.label)}: ${s.hits.filter(h => h.hit === true).length} true, ${s.hits.filter(h => h.hit === false).length} false</li>`).join('')}</ul></section>`;
  return `<section class="reveal"><h2>How each community ranks the boards</h2>${grid}<div class="rboards">${boards}</div>${street}</section>`;
}
