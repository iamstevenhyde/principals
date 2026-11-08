// node tools/middle_cut.mjs : one-time migration of content/ to the "middle cut" (already run; do not rerun).
// Two rounds (old 1 = Windfall, old 3 = Dry Year renumbered 2), exactly three motions per round, no budgets,
// no standing motions, no suits. Secrets and exposures that pointed at cut motions are rewritten.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dir = join(root, 'content', 'boards');
const mp = id => ({ type: 'motion_passed', id });
const noCaught = { type: 'not', of: { type: 'facts_caught' } };
const PLAN = {
  heartland_beef: {
    keep: { 1: ['buyback', 'ammonia_retrofit', 'rancher_bonus'], 2: ['cancel_small', 'wage_freeze', 'ranch_fund'] }, wants: 'wage_freeze',
    short: { buyback: 'Stock buyback', ammonia_retrofit: 'Fix ammonia system', rancher_bonus: 'Rancher bonus', cancel_small: 'Drop small ranchers', wage_freeze: 'Freeze line wages', ranch_fund: 'Rancher hardship loans' },
    exp: { labor: ['Loses the next union vote if line wages are frozen.', mp('wage_freeze')], founder_friend: ['Loses the seat if the board votes down the wage freeze Walt wants.', null], community: ['Faces a no-confidence vote at home if contracts are cancelled on small ranchers.', mp('cancel_small')] },
    sec: { attorney_B: ['Your firm earns fees when regulators look into Heartland. A hidden fact that comes out keeps the fees coming.', { type: 'facts_caught' }],
      founder_friend_B: ["Walt's name is on the cancellation clause. No fact about it may ever be caught.", noCaught],
      community_A: ['Either the rancher bonus or the hardship loans pass.', { type: 'motion_passed_any', ids: ['rancher_bonus', 'ranch_fund'] }] } },
  lumen_search: {
    keep: { 1: ['buyback', 'mod_wellness', 'ad_cap'], 2: ['sell_data', 'mods_ai', 'safety_rebuild'] }, wants: 'mods_ai',
    short: { buyback: 'Stock buyback', mod_wellness: 'Moderator wellness', ad_cap: 'Cap ad targeting', sell_data: 'Sell user data', mods_ai: 'Model replaces mods', safety_rebuild: 'Rebuild safety team' },
    exp: { founder_friend: ['Loses the seat if the board votes down replacing the moderators with the model, which Idris wants.', null], community: ['Loses standing at home if the board sells user data.', mp('sell_data')] },
    sec: { attorney_A: ['Clean the books: the board admits every fact in round 1.', { type: 'disclosure_choice', round: 1, choice: 'all' }],
      attorney_B: ['Your firm bills Lumen $3M a year. One caught fact ends the contract, so none may be caught.', noCaught],
      community_A: ['The ad targeting cap passes.', mp('ad_cap')] } },
  summit_peaks: {
    keep: { 1: ['buyback', 'housing', 'freeze'], 2: ['pension_skip', 'close_alder', 'cut_div'] }, wants: 'close_alder',
    short: { buyback: 'Stock buyback', housing: 'Staff housing', freeze: 'Freeze pass prices', pension_skip: 'Skip pension payment', close_alder: 'Close Alder Creek', cut_div: 'Cut the dividend' },
    exp: { labor: ['Loses the next union vote if the pension payment is skipped.', mp('pension_skip')], founder_friend: ['Loses the seat if the board votes down closing the Alder Creek mountain, which Dana wants.', null], community: ['Faces a recall if the Alder Creek mountain closes.', mp('close_alder')] },
    sec: { attorney_B: ['Your law firm bills Summit Peaks $2M a year. One caught fact ends the contract, so none may be caught.', noCaught],
      founder_friend_B: ["SnowSense is Dana's pet project and needs the cash. The pension payment must be skipped.", mp('pension_skip')] } },
  thread_and_co: {
    keep: { 1: ['buyback', 'wage_floor', 'supplier_contract'], 2: ['delay_pay', 'shift_orders', 'pay_factory'] }, wants: 'shift_orders',
    short: { buyback: 'Stock buyback', wage_floor: 'Factory wage floor', supplier_contract: 'Five-year deal', delay_pay: 'Delay factory pay', shift_orders: 'Move orders abroad', pay_factory: 'Pay factory in full' },
    exp: { labor: ['Loses the next vote if the board delays factory payment or moves orders away from union factories.', null], founder_friend: ['Loses the seat if the board votes down moving orders to a cheaper country, which Elodie wants.', null] },
    sec: { attorney_B: ["Your firm does Thread & Co.'s trademark work by the hour. One caught fact brings in outside counsel, so none may be caught.", noCaught],
      founder_friend_B: ['You sit on two other boards. No scandal anywhere you sit, so no fact on this board may be caught.', noCaught],
      community_A: ['The supplier wage floor passes.', mp('wage_floor')] } },
  valley_health: {
    keep: { 1: ['distribution', 'staffing_ratio', 'rural_van'], 2: ['close_clinic', 'nurse_layoff', 'telehealth_rural'] }, wants: 'close_clinic',
    short: { distribution: 'Pay owners', staffing_ratio: 'Safe staffing', rural_van: 'Rural mobile clinic', close_clinic: 'Close rural clinic', nurse_layoff: 'Lay off nurses', telehealth_rural: 'Rural telehealth' },
    exp: { labor: ['Loses the next vote if more than 10% of nurses and techs are cut.', null], founder_friend: ['Loses the seat if the board votes down closing the rural clinic, which Dr. Marsh wants.', null], community: ['Loses standing at home if the board closes the rural clinic or cuts nurses.', { type: 'any', of: [mp('close_clinic'), mp('nurse_layoff')] }] },
    sec: { attorney_B: ["Your firm holds the system's compliance contract. One caught fact brings in outside review, so none may be caught.", noCaught] } },
};
for (const f of readdirSync(dir).filter(x => x.endsWith('.json'))) {
  const b = JSON.parse(readFileSync(join(dir, f), 'utf8')), P = PLAN[b.id];
  const rounds = [];
  for (const [newR, oldR] of [[1, 1], [2, 3]]) {
    const r = b.rounds.find(x => x.round === oldR);
    const motions = P.keep[newR].map(id => {
      const m = r.motions.find(x => x.id === id); if (!m) throw new Error(b.id + ' missing ' + id);
      const o = { id: m.id, title: m.title, short: P.short[id], motive: m.motive, effects: m.effects };
      const fl = { ...(m.flags || {}) }; delete fl.founder_wants; if (id === P.wants) fl.founder_wants = true;
      if (Object.keys(fl).length) o.flags = fl;
      return o;
    });
    rounds.push({ round: newR, motions, issue: r.issue });
  }
  b.rounds = rounds; delete b.design_note;
  for (const d of b.directors) {
    const e = P.exp[d.seat]; if (e) { d.exposure.text = e[0]; if (e[1]) d.exposure.trigger = e[1]; }
    for (const s of d.secrets) {
      const p = P.sec[s.id]; if (p) { s.text = p[0]; s.check = p[1]; }
      s.text = s.text.replace(' After that you may resign.', '').replace('buyback or dividend', 'buyback');
    }
  }
  writeFileSync(join(dir, f), JSON.stringify(b, null, 2) + '\n');
}
const rj = join(root, 'content', 'rounds.json'), R = JSON.parse(readFileSync(rj, 'utf8'));
const rounds = [R[0], { ...R[2], round: 2 }];
rounds[0].board_text = 'Same cash for every firm. Your board votes on three motions.';
rounds[1].board_text = 'Revenue is down for every firm. Your board votes on three motions.';
writeFileSync(rj, JSON.stringify(rounds, null, 2) + '\n');
writeFileSync(join(root, 'content', 'standing_motions.json'), '[]\n');
console.log('migrated');
