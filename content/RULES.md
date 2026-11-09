# Content rules vocabulary

Principals "Option B": two rounds (The Warning, The Hard Choice), five boards, exactly ONE headline motion per board per round (a yes/no vote), one private conflicted card per director with a two-sentence motive, a fact vote plus one public statement, and one outside role (the Auditor). The game plays the press: the projector shows an auto-written newspaper front page, and a background press roll can find hidden facts. There are no budgets, no standing motions, no Reporter, no resigning, no executive session, no leaks, no suits, no insider sales, no Activist or short seller, no board visits and no seat leagues.

Every `trigger` (director exposure) and `check` (director secret, Street secret) is a small JSON object with a `type`. All are evaluated once, at the reveal, against the final game log for that director's board. "Board" means the director's board at the end of the game. Rules are pure true/false. A trigger that is true means the exposure FIRED. A check that is true means the secret objective was MET. A motion that was voted down or never voted on is "not passed", so `not` of `motion_passed` covers both.

## Rule types (director triggers and checks)

- `motion_passed` `{id}`: a motion with this id passed in either round.
- `motion_passed_any` `{ids:[...]}`: at least one listed motion passed.
- `tag_passed` `{tag, round?}`: at least one passed motion carries `tag` in `flags.tags` (optionally only in `round`).
- `staff_cut_pct_gt` `{value}`: the SUM of `flags.staff_cut_pct` over all passed motions is greater than `value`.
- `payout_m_gte` `{value}`: in some single round, the SUM of `flags.payout_m` over motions passed that round is at least `value` ($M).
- `disclosure_choice` `{round, choice}`: the board's locked facts in `round` were `choice`: `all` (every fact admitted), `some`, or `none`. "Board failed to decide" counts as the previous round's level (round 1: `none`).
- `facts_caught` `{min?, weight?, round?}`: the Auditor or the press caught omitted facts. Default is at least one caught fact. `min` asks for that many caught facts. `weight` asks for caught facts whose weights total at least that. `round` optional.
- `stock_end_below_start`, `stock_end_above_start`: final stock vs starting stock.
- `stock_rank_bottom_half`: final stock rank is in the bottom half of the boards in play (rank > ceil(boards/2)).
- `founder_motion_failed`: a motion with `flags.founder_wants` was voted on and failed.
- `all` `{of:[...]}`, `any` `{of:[...]}`, `not` `{of:rule}`: combinators.

## Street checks (street.json secrets only)

- `street_never_caught_on` `{board:"consulted"}`: the member never landed a true hit on the board dealt to them as "consulted" (the Auditor's firm).

## Board file fields (content/boards/*.json)

- Field `short`: one-word board name for the front page and the debrief tables.
- Field `real`: `{cases:[{round, event, years, line}], fix}`. The real governance event behind each round and one fix line. Shown only in the debrief. Sources and caveats are in content/REAL_CASES.md.
- Each director: `motive` (two sentences, "you" voice, shown on the card), `exposure {text, label, trigger}`, and two `secrets {id, text, label, check}`. `label` is a six-word version used on the debrief screen. Points are fixed in config/scoring.js: goal +50, penalty -35, up to +15 for the board's rank with the director's home group.
- Each motion: `title` (the full question), `short` (three words), `motive` (one-line pitch), `effects`, `flags`, and `headline {passed, failed}`, the front-page headline for each outcome. A motion that is never voted on prints "[Board] board stalls with no decision".

## Motion flags

- `effects`: integer -3..+3 per community key (`shareholders`, `workers`, `customers`, `home`, `public`). Applied the round the motion passes. Players see a fixed strip of five stakeholder icons with the same five words on every board (Owners, Workers, Customers, Community, Public) and up and down arrows, never the numbers. The board's own names for the five groups appear in a small line under the open motion.
- `reveal_effects`: same shape as `effects`, applied only at the reveal and hidden until then.
- `lag_payback`: community deltas applied one round after the motion passes.
- `coin_flip`: `{chance, effects, when:"next_round"}` rolled once; effects apply only on success.
- `if_found`: community deltas applied only if the Auditor or press catches a hidden fact.
- `resolves_issue`: `true` removes the harm penalty of that round's company issue if it is later caught (the dishonesty penalty still applies); `"partial"` halves it.
- `raises_detect`: added to the Auditor's detection probability for the company issue (current round and later).
- `staff_cut_pct`: percent of frontline staff cut. Read by `staff_cut_pct_gt`.
- `payout_m`: $M paid to owners. Read by `payout_m_gte`.
- `tags`: free labels read by `tag_passed`.
- `founder_wants`: the founder wants this passed. Read by `founder_motion_failed`.

## Rounds and the vote

A motion needs a Chair to call it and more yes than no ballots among the board's directors. Any director can vote; the Chair can close the vote early. Each round a board votes on its one motion and on the facts (below). The round length is set by the host in minutes (default 8, `timers.play` in config/scoring.js).

## Company issues (content/boards/*.json, rounds[].issue)

Each issue is `{id, text, case_for_silence, facts}`. `text` is a briefing of about 45 words that stays honestly uncertain (a draft review, a contested estimate), so hiding a fact feels defensible. `case_for_silence` is the one-sentence argument for keeping quiet, shown on the facts step. `facts` is 3 to 5 entries of `{id, text, weight}`. `weight` 1 to 3 is how bad the fact is if it comes out (the phone shows one to three bars with the label "how bad if it comes out"). Heavier facts are also easier to find: weight sets the Auditor's per-fact detection chance (`factDetect`) and the fact's share of the stock move (`factStock`). The phone shows the cost of admitting each fact ("tell -0.8" share price points) and the range of the price move from the facts. Each director switches on the facts the board should admit, a fact is admitted when more than half of the ballots switch it on (a tie follows the Chair's ballot), and the Chair locks the vote. The board's one shared statement text (400 characters) locks with it and is printed on the front page as the board's quote. Admitting every fact is level `all`, none is `none`, anything between is `some`. Omitted facts can be caught by an Auditor inspect (each omitted fact rolls on its own) or by the press (a small background roll per fact, `pressDetect`).

## Waiting room and assignment

Students join on their phones and wait. The host assigns each of them to a board seat (Attorney, Labor director, Fund partner, Founder's friend, Community seat) or to the outside as Auditor, by hand or with Assign automatically, and can mark the Chair. Anyone still unplaced when the host starts is dealt a seat. Phones show the placement as soon as the host makes it.

## Projector

Play: the front page of The Principal Times. Each board's story fills in as it decides: headline from its motion result, "told n of m" squares, the statement as the pull quote, share price with its change, and an Auditor or press catch below. Debrief (host presses Next screen, or arrow keys): Reactions, Side by side, Governance, Fixes (real cases), then one Ethics screen per board. Each screen stays under about 150 words.
