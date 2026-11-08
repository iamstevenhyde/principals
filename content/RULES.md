# Content rules vocabulary

Principals runs the "middle cut": two rounds (The Windfall, The Dry Year), five boards, exactly three motions per board per round, one private conflicted card per director, a fact vote plus one public statement, and two outside roles (Auditor and Reporter). There are no budgets or costs, no standing motions, no resigning, no executive session, no leaks, no suits, no insider sales, no Activist or short seller, no board visits and no seat leagues.

Every `trigger` (director exposure) and `check` (director secret, Street secret) is a small JSON object with a `type`. All are evaluated once, at the reveal, against the final game log for that director's board. "Board" means the director's board at the end of the game. Rules are pure true/false. A trigger that is true means the exposure FIRED. A check that is true means the secret objective was MET.

## Rule types (director triggers and checks)

- `motion_passed` `{id}`: a motion with this id passed in either round.
- `motion_passed_any` `{ids:[...]}`: at least one listed motion passed.
- `tag_passed` `{tag, round?}`: at least one passed motion carries `tag` in `flags.tags` (optionally only in `round`).
- `staff_cut_pct_gt` `{value}`: the SUM of `flags.staff_cut_pct` over all passed motions is greater than `value`.
- `payout_m_gte` `{value}`: in some single round, the SUM of `flags.payout_m` over motions passed that round is at least `value` ($M). The $M figure is only a payout size for this rule; nobody spends from a budget.
- `disclosure_choice` `{round, choice}`: the board's locked facts in `round` were `choice`: `all` (every fact admitted), `some`, or `none`. "Board failed to decide" counts as the previous round's level (round 1: `none`).
- `facts_caught` `{min?, weight?, round?}`: the Street caught omitted facts. Default is at least one caught fact. `min` asks for that many caught facts. `weight` asks for caught facts whose weights total at least that. `round` optional.
- `stock_end_below_start`, `stock_end_above_start`: final stock vs starting stock.
- `stock_rank_bottom_half`: final stock rank is in the bottom half of the boards in play (rank > ceil(boards/2)).
- `founder_motion_failed`: a motion with `flags.founder_wants` was voted on and failed.
- `all` `{of:[...]}`, `any` `{of:[...]}`, `not` `{of:rule}`: combinators.

## Street checks (street.json secrets only)

- `street_acted_every_round` `{action}`: the member used `action` in every round played (the Reporter's beat).
- `street_never_caught_on` `{board:"consulted"}`: the member never landed a true hit on the board dealt to them as "consulted" (the Auditor's firm).

## Motion flags (content/boards/*.json)

- `effects`: integer -3..+3 per community key (`shareholders`, `workers`, `customers`, `home`, `public`). Applied the round the motion passes. Players see a fixed strip of five stakeholder icons with up and down arrows, never the numbers.
- `reveal_effects`: same shape as `effects`, applied only at the reveal and hidden until then.
- `lag_payback`: community deltas applied one round after the motion passes.
- `coin_flip`: `{chance, effects, when:"next_round"}` rolled once; effects apply only on success.
- `if_found`: community deltas applied only if the Street catches the motion's consequence (Auditor inspect or Reporter story).
- `resolves_issue`: `true` removes the harm penalty of that round's company issue if it is later caught (the dishonesty penalty still applies); `"partial"` halves it.
- `raises_detect`: added to the Street detection probability for the company issue (current round and later).
- `staff_cut_pct`: percent of frontline staff cut. Read by `staff_cut_pct_gt`.
- `payout_m`: $M paid to owners. Read by `payout_m_gte`.
- `tags`: free labels read by `tag_passed`. Used: `payout`, `sells_user_data`, `factory_squeeze`.
- `founder_wants`: the founder wants this passed. Read by `founder_motion_failed`.
- Each motion also carries a three-word `short` title for the phone row. It is not a flag, and `cost_m` is gone from the content.

## Rounds and the vote

A motion needs a Chair to call it and more yes than no ballots among the board's directors. Any director can vote; the Chair can close the vote early. Each round a board votes on its three motions and on the facts (below). Any motion can be called; there is no money to run out of.

## Company issues (content/boards/*.json, rounds[].issue)

Each issue is `{id, text, facts}`. `facts` is 3 to 5 entries of `{id, text, weight}`. `weight` 1 to 3 is how damaging the fact is (the phone shows it as one to three bars) and how easy it is to find: it sets the Auditor's per-fact detection chance (`factDetect` in config/scoring.js) and the fact's share of the stock move (`factStock`). Each director switches on the facts the board should admit, a fact is admitted when more than half of the ballots switch it on (a tie follows the Chair's ballot), and the Chair locks the vote. The board's one shared statement text (400 characters, never scored) locks with it. Admitting every fact is level `all`, none is `none`, anything between is `some`. Omitted facts can be caught by an Auditor inspect (each omitted fact rolls on its own) or a Reporter story (finds the heaviest omitted fact).

## Waiting room and assignment

Students join on their phones and wait. The host assigns each of them to a board seat (Attorney, Labor director, Fund partner, Founder's friend, Community seat) or to the outside as Reporter or Auditor, by hand or with Assign automatically, and can mark the Chair. Anyone still unplaced when the host starts is dealt a seat. Phones show the placement as soon as the host makes it.
