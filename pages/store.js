// One interface, two backends.
//   Local mode (localhost, file server, or ?local=1): localStorage, so every tab of one browser is a player.
//   Live mode (GitHub Pages, or ?live=1): Supabase RPCs from sql/principals.sql (security definer, hashed tokens).
// The host page is the only writer of game state. Players only submit actions and read the view the host published.
import { SUPA_URL, SUPA_ANON_KEY } from './config.js';

export const params = () => new URLSearchParams(location.search);
export function pageMode() {
  const p = params();
  if (p.get('live') === '1') return 'live';
  if (p.get('local') === '1') return 'local';
  return ['file:', ''].includes(location.protocol) || ['localhost', '127.0.0.1'].includes(location.hostname) ? 'local' : 'live';
}
export const safeGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } };
export const uid = (n = 12) => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(n)); for (const x of r) s += a[x % a.length]; return s; };
const newCode = () => { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (const x of crypto.getRandomValues(new Uint8Array(5))) s += a[x % a.length]; return s; };

// ---------------- local ----------------
const K = (code, k) => 'dc:' + code + ':' + k;
const J = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
class LocalStore {
  constructor() { this.mode = 'local'; }
  async createSession() {
    const code = newCode(), hostToken = uid(24);
    safeSet(K(code, 'host'), hostToken); safeSet(K(code, 'inbox'), '[]'); safeSet(K(code, 'public'), JSON.stringify({ code, phase: 'lobby', round: 0, boards: [], feed: [], players: [] }));
    return { code, hostToken };
  }
  async exists(code) { return !!safeGet(K(code, 'host')); }
  async join(code, name, token) {
    if (!(await this.exists(code))) throw new Error('No game with that code.');
    const seats = J(K(code, 'seats')) || {};
    if (token) { const s = Object.values(seats).find(x => x.token === token); if (s) return { seatId: s.id, token }; }
    const id = 's' + uid(8), tok = uid(20);
    seats[id] = { id, token: tok, name }; safeSet(K(code, 'seats'), JSON.stringify(seats));
    await this._inbox(code, id, { type: 'join', name });
    return { seatId: id, token: tok };
  }
  _seat(code, token) { const s = Object.values(J(K(code, 'seats')) || {}).find(x => x.token === token); if (!s) throw new Error('not authorized'); return s; }
  async _inbox(code, seatId, action) {
    const box = J(K(code, 'inbox')) || [];
    const id = (Number(safeGet(K(code, 'inboxSeq'))) || 0) + 1; safeSet(K(code, 'inboxSeq'), String(id));
    box.push({ id, seat_id: seatId, action }); safeSet(K(code, 'inbox'), JSON.stringify(box.slice(-2000)));
  }
  async submit(code, token, action) { const s = this._seat(code, token); await this._inbox(code, s.id, action); return { ok: true }; }
  async seatView(code, token) { const s = this._seat(code, token); return { view: J(K(code, 'view:' + s.id)), public: J(K(code, 'public')) }; }
  async publicView(code) { return J(K(code, 'public')); }
  _host(code, tok) { if (safeGet(K(code, 'host')) !== tok) throw new Error('not authorized'); }
  async hostGet(code, tok) { this._host(code, tok); return J(K(code, 'state')); }
  async hostInbox(code, tok, after) { this._host(code, tok); return (J(K(code, 'inbox')) || []).filter(x => x.id > after); }
  async hostPublish(code, tok, { state, pub, views }) {
    this._host(code, tok);
    if (state) safeSet(K(code, 'state'), JSON.stringify(state));
    if (pub) safeSet(K(code, 'public'), JSON.stringify(pub));
    for (const [id, v] of Object.entries(views || {})) safeSet(K(code, 'view:' + id), JSON.stringify(v));
  }
  subscribe(code, fn) {   // other tabs: storage event; this tab: poll
    const h = e => { if (e.key && e.key.startsWith('dc:' + code + ':')) fn(); };
    window.addEventListener('storage', h); const iv = setInterval(fn, 1000);
    return () => { window.removeEventListener('storage', h); clearInterval(iv); };
  }
}

// ---------------- live ----------------
class SupaStore {
  constructor(sb) { this.sb = sb; this.mode = 'live'; }
  async rpc(fn, args) { const { data, error } = await this.sb.rpc(fn, args); if (error) throw new Error(error.message); return data; }
  async createSession(pin) { return this.rpc('dc_create_session', { p_pin: pin || uid(6) }); }
  async exists(code) { const p = await this.publicView(code); return !!p; }
  async join(code, name, token) { return this.rpc('dc_join', { p_code: code, p_name: name, p_token: token || null }); }
  async submit(code, token, action) { return this.rpc('dc_submit', { p_code: code, p_token: token, p_action: action }); }
  async seatView(code, token) { return this.rpc('dc_seat_view', { p_code: code, p_token: token }); }
  async publicView(code) { const { data, error } = await this.sb.from('dc_public').select('payload').eq('code', code).maybeSingle(); if (error) throw new Error(error.message); return data && data.payload; }
  async hostGet(code, tok) { return this.rpc('dc_host_get', { p_code: code, p_token: tok }); }
  async hostInbox(code, tok, after) { return this.rpc('dc_host_inbox', { p_code: code, p_token: tok, p_after: after }); }
  async hostPublish(code, tok, { state, pub, views }) { return this.rpc('dc_host_publish', { p_code: code, p_token: tok, p_state: state || null, p_public: pub || null, p_views: views || {} }); }
  subscribe(code, fn) {
    const ch = this.sb.channel('dc:' + code).on('postgres_changes', { event: '*', schema: 'public', table: 'dc_public', filter: 'code=eq.' + code }, () => fn()).subscribe();
    const iv = setInterval(fn, 1500);   // seat views are not realtime (they are private); poll
    return () => { clearInterval(iv); this.sb.removeChannel(ch); };
  }
}

let P = null;
export function openStore() {
  if (P) return P;
  P = (async () => {
    if (pageMode() === 'local') return new LocalStore();
    if (!window.supabase) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load Supabase. Check the network.')); document.head.append(s); });
    return new SupaStore(window.supabase.createClient(SUPA_URL, SUPA_ANON_KEY));
  })();
  return P;
}
// a seat's token survives reloads (per tab in local mode so several tabs can be different players)
const bag = () => (pageMode() === 'local' ? sessionStorage : localStorage);
export const savedSeat = code => { try { return JSON.parse(bag().getItem('dc_seat_' + code)); } catch (e) { return null; } };
export const saveSeat = (code, v) => { try { bag().setItem('dc_seat_' + code, JSON.stringify(v)); } catch (e) { /* ignore */ } };
export const hostToken = code => safeGet('dc_host_' + code);
export const saveHostToken = (code, t) => safeSet('dc_host_' + code, t);
export const withMode = url => (pageMode() === 'local' && params().get('local') === '1' ? url + (url.includes('?') ? '&' : '?') + 'local=1' : url);
