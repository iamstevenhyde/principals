# Content rules vocabulary

Principals, one-round design (Nov 2026): one decision round, six boards, no scoring. Each board has a one-screen briefing of about 230 words (a setting paragraph plus short fact bullets), four one-line options, six role cards of about 45 words with personal motives, a pre-written "morning after" newspaper story and stock move per option, a real-case reveal and four short debrief questions. The flow follows the Jensen Pharma exercise: read the briefing and your private card, talk out loud with your board (there is no in-app chat), vote for one option, then see the morning-after newspaper and stock screen, then the real case. No Auditor, no outside role, no live press roll, no secret goals, no second round, no points. The earlier source for board text was ONE_ROUND_PACKETS_20261109.html; the board JSON files are now the source of truth.

## Board file (content/boards/*.json)

- `id`, `name`, `short` (one word, used on the debrief), `industry`, `blurb`.
- `directors`: six entries, one per seat in this order: `attorney`, `labor`, `fund`, `founder_friend`, `community`, `audit_chair` (label "Audit chair"). Each has `seat`, `name`, `title`, `home` (who they speak for) and `motive` (the private role card, about 40 to 50 words, "you" voice, a personal stake that pulls against the board's interest).
- `briefing`: `{intro, facts[]}`. `intro` is the setting. `facts` are the bullets. Facts may pull in opposite directions and many are unconfirmed on purpose. All figures inside are fictional for the disguised firm.
- `decision`: `{lead, options[]}`. `options` are `{n, title, text}`, numbered 1 to 4, with `text` a single plain line of about 20 to 28 words that names the option and its own real cost. All four titles are neutral. None is clearly right, and each board needs at least two seats with a private reason to oppose the most transparent option, one seat that gains from each other option, and one private fact that changes which option is least bad.
- `press`: one entry per option, `{n, headline, story, stock{symbol, from, to, pct}}`, written ahead of time and shown after the vote as the morning-after newspaper and stock screen. `ticker` gives the symbol and starting price.
- `reveal`: `{case, text}`. The real case. Shown only in the debrief.
- `questions`: four debrief questions, shown only in the debrief.

The sentence "The board is small, so every director sits on several committees" appears once, in Valley Health. It was removed from the other boards. Thread & Co. was trimmed from 15 to 12 fact bullets (dropped the actress, merged the senior-buyers bullet and the insurer bullet into neighbors; no figure was lost except the actress contract).

## content/game.json

`{title, text, board_text}`: the one line shown on the projector while the boards meet.

## Phases

1. Lobby. Students join on phones. The host assigns each to a board seat (or Assign automatically) and marks the Chair. Anyone unplaced when the host starts is dealt a seat. Six seats per board (room for 36); with more than six students on a board, extras share a seat (a second player on the same role card). Fewer than six drops seats in the order in config/scoring.js.
2. Play (default 15 minutes, host-settable). The host screen also shows a 5-minute "Discuss" countdown from the start of play, then "Voting open"; it is advisory and never locks the vote. Each phone has three tabs: Briefing (one screen), My card (private), Vote. There is no chat; the board talks face to face. Everyone votes for one numbered option and can change it until the Chair locks. The projector shows each board's "n of m have voted" and the choice once locked.
3. Reveal (debrief). The host presses Next screen (or arrow keys). Then each board gets ONE screen with everything at once: the morning-after newspaper and stock move on the left, "what happened" (the real case) and "discuss" (the four questions) on the right. The host picks which board is on the projector; there is no Back/Next.

## The vote

Plurality of ballots. A tie follows the Chair's ballot when it is among the tied options, otherwise the lowest option number. If the clock ends first, every unlocked board is locked the same way; a board with no ballots shows "No decision". Only the Chair can lock early. Ballots are visible as "voted / not yet" dots, never as who chose what, until the debrief.

## Not in this design

Chat, facts vote, public statement, motions, effects, stock, Street roles, Auditor, press roll, front page, community ranking, secret goals, exposures, points. The engine no longer has a rules evaluator.
