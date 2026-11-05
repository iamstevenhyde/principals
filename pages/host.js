// The host loop. Runs only in the admin tab: reads the inbox, applies actions to the engine, ticks the clock,
// and publishes the public payload plus each seat's private view. Keep the admin tab open during class.
import { createGame, apply, tick, seatView, publicView } from '../engine/engine.js';
import { botStep } from '../engine/bots.js';
import { CONTENT } from '../engine/content_bundle.js';
import { STUB } from '../test/fixtures/stub.js';

export const GAME_CONTENT = CONTENT || STUB;

export class Host {
  constructor(store, code, token) { this.store = store; this.code = code; this.token = token; this.state = null; this.after = 0; this.sent = {}; this.errors = {}; this.bots = []; this.busy = false; this.dirty = true; this.lastStateSave = 0; this.listeners = []; }
  async load(opts) {
    const saved = await this.store.hostGet(this.code, this.token);
    this.state = saved || createGame(GAME_CONTENT, { code: this.code, seed: Math.floor(Math.random() * 1e9), ...opts });
    this.after = this.state.inboxAfter || 0;
    this.bots = this.state.bots || [];
    await this.publish(true);
  }
  start() { this.iv = setInterval(() => this.step(), 1000); }
  stop() { clearInterval(this.iv); }
  onChange(fn) { this.listeners.push(fn); }
  act(a) { const r = apply(this.state, { ...a, by: 'host', t: Date.now() }); this.dirty = true; this.step(); return r; }
  addBots(n) {
    for (let i = 0; i < n; i++) { const id = 'bot' + Math.random().toString(36).slice(2, 8); this.bots.push(id); apply(this.state, { by: id, type: 'join', name: 'Sim ' + (this.bots.length), t: Date.now() }); }
    this.state.bots = this.bots; this.dirty = true;
  }
  async step() {
    if (this.busy || !this.state) return; this.busy = true;
    try {
      const t = Date.now();
      const box = await this.store.hostInbox(this.code, this.token, this.after);
      for (const row of box || []) {
        this.after = Math.max(this.after, row.id);
        const r = apply(this.state, { ...row.action, by: row.seat_id, t });
        if (!r.ok) this.errors[row.seat_id] = { msg: r.error, t };
        this.dirty = true;
      }
      if (this.bots.length) for (const id of this.bots) for (const a of botStep(seatView(this.state, id, t), Math.random)) { apply(this.state, { ...a, by: id, t }); this.dirty = true; }
      if (tick(this.state, t)) this.dirty = true;
      this.state.inboxAfter = this.after;
      await this.publish(false);
      this.listeners.forEach(f => f(this.state));
    } catch (e) { console.error(e); this.lastError = e.message; }
    finally { this.busy = false; }
  }
  async publish(force) {
    const t = Date.now(), st = this.state;
    const pub = publicView(st, t);
    const views = {};
    for (const p of st.players) {
      if (this.bots.includes(p.id)) continue;
      const v = seatView(st, p.id, t);
      const e = this.errors[p.id]; if (e && t - e.t < 6000) v.notice = e.msg;
      delete v.public;   // seats read the public payload separately; keeps each view small
      const s = JSON.stringify(v);
      if (force || this.sent[p.id] !== s) { views[p.id] = v; this.sent[p.id] = s; }
    }
    const saveState = force || (this.dirty && t - this.lastStateSave > 3000);
    if (saveState) { this.lastStateSave = t; this.dirty = false; }
    await this.store.hostPublish(this.code, this.token, { state: saveState ? st : null, pub, views });
  }
}
