// Tiny stub content in the BUILD_BRIEF schema, used only when content/ is empty. Generic text on purpose.
const seats = ['attorney', 'labor', 'fund', 'founder_friend', 'community'];
const mk = (id, name, industry) => ({
  id, name, industry, from_week: 0, blurb: name + ' stub board.',
  communities: { shareholders: 'Shareholders', workers: 'Workers', customers: 'Customers', home: { id: 'town', label: 'Town' }, public: 'Public' },
  directors: seats.map(seat => ({
    seat, name: seat + ' ' + id, title: 'Director', home: { attorney: 'public', labor: 'workers', fund: 'shareholders', founder_friend: 'shareholders', community: 'home' }[seat],
    exposure: { text: 'Exposure for ' + seat, trigger: seat === 'attorney' ? { type: 'facts_caught', weight: 3 } : seat === 'labor' ? { type: 'wages_below_norm_rounds', value: 2 } : seat === 'fund' ? { type: 'stock_end_below_start' } : seat === 'founder_friend' ? { type: 'motion_flag_passed', flag: 'against_founder' } : { type: 'community_effect_lt', community: 'home', round: 3, value: 0 } },
    secrets: [
      { id: seat + '_a', text: 'Secret A', check: seat === 'fund' ? { type: 'payout_high_any_round' } : { type: 'never_caught' } },
      { id: seat + '_b', text: 'Secret B', check: seat === 'labor' ? { type: 'stock_end_above_start' } : seat === 'fund' ? { type: 'rival_stock_beats' } : { type: 'wages_at_or_above_norm_every_round' } },
    ],
  })),
  rounds: [1, 2, 3].map(r => ({
    round: r, budget_m: r === 3 ? 10 : 60, ...(r === 3 ? { must_save_m: 20 } : {}),
    motions: [
      { id: 'buyback' + r, title: 'Buyback', cost_m: 30, motive: 'Return cash', effects: { shareholders: 2, workers: -1, customers: 0, home: 0, public: 0 } },
      { id: 'wages' + r, title: 'Raise wages', cost_m: 20, motive: 'Keep staff', effects: { shareholders: -1, workers: 2, customers: 0, home: 1, public: 0 }, flags: { lag_payback: true } },
      { id: 'price' + r, title: 'Cut prices', cost_m: 15, motive: 'Customers', effects: { shareholders: -1, workers: 0, customers: 2, home: 0, public: 0 } },
      { id: 'cut' + r, title: 'Cut staff', cost_m: -20, motive: 'Save money', effects: { shareholders: 1, workers: -3, customers: -1, home: -2, public: 0 }, flags: { staff_cut_pct: 15 } },
      { id: 'fix' + r, title: 'Quietly fix it', cost_m: 10, motive: 'Safety', effects: { shareholders: 0, workers: 1, customers: 1, home: 0, public: 0 }, flags: { resolves_issue: true, raises_detect: true } },
      { id: 'founder' + r, title: 'Strip founder votes', cost_m: 0, motive: 'Control', effects: { shareholders: 1, workers: 0, customers: 0, home: 0, public: 0 }, flags: { against_founder: true, coin_flip: r === 2 } },
    ],
    issue: { text: 'Issue ' + r + ' at ' + name, facts: [{ id: 'f1', text: 'First fact of issue ' + r + '.', weight: 1 }, { id: 'f2', text: 'Second fact of issue ' + r + '.', weight: 2 }, { id: 'f3', text: 'Third fact of issue ' + r + '.', weight: 3 }] },
  })),
});
export const STUB = {
  boards: [mk('heartland', 'Heartland Beef', 'Beef'), mk('summit', 'Summit Peaks', 'Ski'), mk('valley', 'Valley Health', 'Health'), mk('thread', 'Thread & Co.', 'Apparel'), mk('lumen', 'Lumen Search', 'Search')],
  street: { roles: [] },
  rounds: [{ round: 1, title: 'The Windfall', text: 'A tax cut lands.' }, { round: 2, title: 'The Tool', text: 'AI does 20% of frontline work.' }, { round: 3, title: 'The Dry Year', text: 'Revenue falls 30%.' }],
};
