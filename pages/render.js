// Pure HTML-string renderers shared by the pages and the node simulation (no DOM access here).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  const leagues = `<section class="leagues">${Object.values(R.leagues).map(l => `<div class="league"><span>${esc(l.label)}</span><b>${esc(l.name)}</b><small>${esc(l.board || '')}</small></div>`).join('')}</section>`;
  const boards = R.boards.map((b, i) => `<article class="rboard">
    <header><h3>${esc(b.name)}</h3>${spark(b.stock, 160, 40, COLORS[i % COLORS.length])}</header>
    <p class="recog"><span class="gain">Gained: ${b.gained.map(c => esc((b.labels || {})[c] || c)).join(', ') || 'nobody'}</span> <span class="paid">Paid: ${b.paid.map(c => esc((b.labels || {})[c] || c)).join(', ') || 'nobody'}</span></p>
    ${b.rounds.map(r => `<div class="rround"><div class="rr-h"><b>Round ${r.round}</b> <span class="disc d-${r.disclosure}">${esc(r.disclosure.toUpperCase())}</span>${r.caught ? ` <span class="caught">caught by ${esc(r.caughtBy)}</span>` : ''}${r.decided ? '' : ' <span class="quiet">failed to decide</span>'}</div>
      <p class="issue">${esc(r.issue)}</p>
      ${r.quotes.map(q => `<div class="quote"><blockquote>"${esc(q.text)}" <cite>${esc(q.name)}</cite></blockquote><p class="shown">Projector at that moment: ${esc(q.projector)}</p></div>`).join('')}</div>`).join('')}
    <ul class="dirs">${b.directors.map(d => `<li><b>${esc(d.name)}</b> ${esc(d.seat)}${d.chair ? ' (Chair)' : ''} <span class="${d.fired ? 'fired' : 'safe'}">${d.fired ? 'exposure fired' : 'exposure safe'}</span> <span class="${d.secretMet ? 'met' : 'unmet'}">${d.secretMet ? 'secret met' : 'secret missed'}</span><br><small>${esc(d.secret)}</small></li>`).join('')}</ul>
  </article>`).join('');
  const street = `<section class="rstreet"><h3>The Street</h3><ul>${R.street.map(s => `<li><b>${esc(s.name)}</b> ${esc(s.label)}: ${s.hits.filter(h => h.hit === true).length} true, ${s.hits.filter(h => h.hit === false).length} false</li>`).join('')}</ul></section>`;
  return `<section class="reveal"><h2>How each community ranks the boards</h2>${grid}<h2>Seat leagues</h2>${leagues}<div class="rboards">${boards}</div>${street}</section>`;
}
