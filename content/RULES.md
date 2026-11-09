# Content rules vocabulary

Principals, one-round design (Nov 2026): one decision round, five boards, no scoring. Each board has a ~950-word briefing (a setting paragraph plus 12 to 14 fact bullets), four numbered options, five role cards with personal motives, a real-case reveal and four debrief questions. The flow follows the Jensen Pharma exercise: read the briefing and your private role card, discuss, the board votes for one option, then the debrief reveals the real case. There is no Auditor, no outside role, no press, no newspaper, no stock price, no secret goals, no second round. The approved source for all board text is ONE_ROUND_PACKETS_20261109.html (two repeats fixed afterwards, see below).

## Board file (content/boards/*.json)

- `id`, `name`, `short` (one word, used on the debrief), `industry`, `blurb`.
- `directors`: five entries, one per seat in this order: `attorney`, `labor`, `fund`, `founder_friend`, `community`. Each has `seat`, `name`, `title`, `home` (who they speak for) and `motive` (the private role card, 55 to 80 words, "you" voice, a personal stake that pulls against the board's interest).
- `briefing`: `{intro, facts[]}`. `intro` is the setting. `facts` are the bullets. Facts may pull in opposite directions and many are unconfirmed on purpose. All figures inside are fictional for the disguised firm.
- `decision`: `{lead, options[]}`. `options` are `{n, title, text}`, numbered 1 to 4. None is clearly right.
- `reveal`: `{case, text}`. The real case. Shown only in the debrief.
- `questions`: four debrief questions, shown only in the debrief.

The sentence "The board is small, so every director sits on several committees" appears once, in Valley Health. It was removed from the other boards. Thread & Co. was trimmed from 15 to 12 fact bullets (dropped the actress, merged the senior-buyers bullet and the insurer bullet into neighbors; no figure was lost except the actress contract).

## content/game.json

`{title, text, board_text}`: the one line shown on the projector while the boards meet.

## Phases

1. Lobby. Students join on phones. The host assigns each to a board seat (or Assign automatically) and marks the Chair. Anyone unplaced when the host starts is dealt a seat. Five seats per board; with more than five students on a board, extras share a seat (a second player on the same role card). Fewer than five drops seats in the order in config/scoring.js.
2. Play (default 15 minutes, host-settable). Each phone has three tabs: Briefing (one page at a time, or all at once), My card (private), Vote. Chat is a large labelled button on every screen: a board channel plus private messages inside the board. Everyone votes for one numbered option and can change it until the Chair locks. The projector shows each board's "n of m have voted" and the choice once locked.
3. Reveal (debrief). The host presses Next screen (or arrow keys). Screen 1 lists each board's choice and vote count. Then each board gets two screens: "what happened" (the real case) and "discuss" (the four questions).

## The vote

Plurality of ballots. A tie follows the Chair's ballot when it is among the tied options, otherwise the lowest option number. If the clock ends first, every unlocked board is locked the same way; a board with no ballots shows "No decision". Only the Chair can lock early. Ballots are visible as "voted / not yet" dots, never as who chose what, until the debrief.

## Not in this design

Facts vote, public statement, motions, effects, stock, Street roles, Auditor, press roll, front page, community ranking, secret goals, exposures, points. The engine no longer has a rules evaluator.
