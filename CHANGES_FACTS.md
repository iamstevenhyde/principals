# Facts disclosure (branch facts-disclosure)

Replaces Tell / Spin / Bury with a fact list, a board vote per fact, and a shared public statement.

## What changed
- content/boards/*.json: each of the 15 issues now has 3 to 4 facts `{id, text, weight 1-3}` (old tell/spin/bury/detect_base removed; `text` stays). Migration script: tools/facts_migrate.py (already run, do not rerun).
- Vote: Chair opens a `facts` vote, each director sends the facts they tick, a fact is admitted when more than half of ballots tick it (a tie follows the Chair's ballot), the Chair locks (or all directors have voted, or the timer ends). Any director edits one shared statement (400 chars, last write wins); it locks with the facts and is never scored.
- No lock by the timer: previous round's level stands (round 1: admit nothing, no statement). Partial level repeats the same number of facts, lightest first (my choice, see below).
- Detection: each omitted fact rolls on its own for an Auditor inspect; a Reporter story finds the heaviest omitted fact. Inspect of a board that admitted everything is a false hit.
- Stock: by fact weight share. Rules: `disclosure_caught` replaced by `facts_caught {min?, weight?, round?}`; `disclosure_choice` now takes all/some/none. Attorney exposure fires at caught weight >= 3. Standing flags renamed admit_stock_hit_mult / caught_penalty_mult. Documented in content/RULES.md.
- UI: play.html (tick list, statement box, send picks, Chair locks), projector tickers show the statement with caught facts, reveal shows statement plus full fact list (omitted struck through, caught marked).
- sql/principals.sql needed no change: actions are generic jsonb (limit 2000 bytes; a full ballot plus 400 char statement fits).

## Coefficients (provisional, config/scoring.js)
- factDetect by weight: 1 = 0.30, 2 = 0.50, 3 = 0.70 (old 0.5 spin, 0.7 bury)
- factStock: admitted -2, hidden uncaught +2, caught -12, each times the share of fact weight (old Tell -2, Bury +2, caught Bury -12)
- harmCaughtWeight 3, publicHonesty +2 (admit all) to -2 (hide all), linear
- Detection bonuses (visit, investigator, raises_detect) are added to the per-fact chance as before.

## Uncertain
- Weights and fact wording are mine, written from the old issue text (Summit Chair 7 facts follow Steven's example).
- Fallback partial level rule above.
- Round-3 "no package avoids an exposure" brute force was not re-run (no script in the repo); motion-readable exposures were not touched.
- rules_video (Remotion) still says Tell/Spin/Bury and needs a re-render.
- admin.html now sets window.__host (one line) so headless.mjs can seat a test player as Chair.
