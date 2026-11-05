# Content rules vocabulary

Every `trigger` (director exposure) and `check` (director secret, Street secret) is a small JSON object with a `type`. All are evaluated once, at the reveal, against the final game log for that director's board. "Board" means the director's board at the end of the game. Rules are pure true/false. A trigger that is true means the exposure FIRED. A check that is true means the secret objective was MET.

## Rule types (director triggers and checks)

- `motion_passed` `{id}`: a motion with this id passed in any round. Works for board motions and standing motions (`independent_investigator`, `settle_suit`, etc).
- `motion_passed_any` `{ids:[...]}`: at least one listed motion passed.
- `tag_passed` `{tag, round?}`: at least one passed motion carries `tag` in `flags.tags` (optionally only in `round`).
- `staff_cut_pct_gt` `{value}`: the SUM of `flags.staff_cut_pct` over all passed motions is greater than `value`.
- `payout_m_gte` `{value}`: in some single round, the SUM of `flags.payout_m` over motions passed that round is at least `value` ($M).
- `disclosure_choice` `{round, choice}`: the board's final disclosure decision in `round` was `choice` (`tell`, `spin`, `bury`). "Board failed to decide" counts as the previous round's choice.
- `disclosure_caught` `{choice?, round?}`: the Street caught a disclosure. `choice` is `bury`, `spin`, or `any` (default `any`, meaning spin or bury). `round` optional.
- `stock_end_below_start`, `stock_end_above_start`: final stock vs starting stock.
- `stock_rank_bottom_half`: final stock rank is in the bottom half of the boards in play (rank > ceil(boards/2)).
- `suit_filed`: any Street suit was filed against the board.
- `founder_motion_failed`: a motion with `flags.founder_wants` was voted on and failed.
- `all` `{of:[...]}`, `any` `{of:[...]}`, `not` `{of:rule}`: combinators.

## Street checks (street.json secrets only)

- `street_target_payout_raised` `{min}`: at least `min` of this member's campaign targets raised payout the following round.
- `street_acted_every_round` `{action}`: the member used `action` in every round played.
- `street_never_caught_on` `{board:"consulted"}`: the member never landed a true hit on the board dealt to them as "consulted" (dealt randomly at join).
- `street_leaked_to` `{seat, min}`: the member received/sent at least `min` true leaks to or from `seat`.
- `street_settlement_taken` `{min}`: at least `min` of the member's suits ended in settlement.

## Motion flags (content/boards/*.json and standing_motions.json)

- `cost_m`: positive spends, negative saves or earns. Round 1 and 2: sum of `cost_m` of passed motions (standing motions included) must be at most `budget_m`; earnings add room. Round 3: the sum of positive `cost_m` must be at most `budget_m`, and net savings (the negative of the sum of all `cost_m`) must be at least `must_save_m`. Unspent budget does not carry over. A board that misses `must_save_m` takes a provisional stock penalty set in config/scoring.js.
- `effects`: integer -3..+3 per community key (`shareholders`, `workers`, `customers`, `home`, `public`). Applied the round the motion passes. Players see arrows, never the numbers.
- `reveal_effects`: same shape as `effects`, applied only at the reveal and hidden until then.
- `lag_payback`: community deltas applied one round after the motion passes.
- `coin_flip`: `{chance, effects, when:"next_round"}` rolled once; effects apply only on success.
- `if_found`: community deltas applied only if the Street catches the motion's consequence (Auditor inspect, Reporter story, or leak).
- `resolves_issue`: `true` removes the accident or harm penalty of that round's company issue if it is later caught (the dishonesty penalty still applies); `"partial"` halves it.
- `raises_detect`: added to the Street detection probability for the company issue (current round and later).
- `staff_cut_pct`: percent of frontline staff cut. Read by `staff_cut_pct_gt`.
- `payout_m`: $M paid to owners. Read by `payout_m_gte`.
- `tags`: free labels read by `tag_passed`. Used: `payout`, `sells_user_data`, `factory_squeeze`, `pay_stock`, `pay_safety`.
- `founder_wants`: the founder wants this passed. Read by `founder_motion_failed`.
- Standing-motion only: `removes_chair`, `investigates_current_issue`, `tell_stock_hit_mult`, `bury_penalty_mult`, `street_action_mult`, `settles_suit`, `plaintiff_cut`, `available` (`any_round` or `suit_pending`).

## Round 3 design guarantee

Each board file carries a `design_note`. Savings from motions that fire no motion-readable exposure total less than `must_save_m`, so every legal Round 3 package fires at least one exposure. Standing motions cost zero or more, so they cannot help. `disclosure_caught`, `stock_*` and `founder_motion_failed` exposures are not needed for the guarantee. A validation script confirms it by brute force over all motion subsets.
