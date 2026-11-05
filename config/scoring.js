// Principals: every tunable number in one place.
// PROVISIONAL. The scoring math is not decided (spec section 8). These values are a first pass picked so that
// no single choice dominates in the simulation; Steven tunes them after seeing the build.
// Units: stock is an index that starts at 100. Community effects in content run -3..+3 per motion.

export const SCORING = {
  // ---------- timers (seconds); the host can change these in admin ----------
  timers: { shock: 30, play: 240, outside: 60 },

  // ---------- sizing ----------
  boardSize: 5,                 // boards fill to five, everyone after that is the Street
  minBoardSize: 3,              // fewer students than 3 per board shrinks the board count
  // Seat dropped first when a board has fewer than five people (provisional).
  seatDropOrder: ['community', 'founder_friend', 'fund', 'labor', 'attorney'],
  // Board priority when the host picks fewer than five boards (spec: with 4 drop Lumen, with 3 also drop Thread).
  boardPriority: ['heartland', 'summit', 'valley', 'thread', 'lumen'],
  streetPriority: ['activist', 'reporter', 'auditor', 'short_seller', 'plaintiffs_lawyer'], // content/street.json priority wins if present

  // ---------- disclosure ----------
  defaultDisclosure: 'bury',    // round 1, if the Chair never calls the disclosure vote (provisional: silence reads as burying)
  // Stock move by disclosure outcome (spec 8 table). caught = auditor or reporter hit.
  disclosureStock: {
    tell: { clean: -2, caught: 0 },
    spin: { clean: 0, caught: -5 },
    bury: { clean: +2, caught: -12 },
  },
  detectBase: { spin: 0.5, bury: 0.7 },   // used when an issue has no detect_base
  detectVisitBonus: 0.15,                 // a Street member sat at the table this round (no executive session)
  detectInvestigatorBonus: 0.2,           // the board hired an investigator and still spun or buried
  detectRaisesFlag: 0.15,                 // a passed motion with flags.raises_detect
  reporterTrueOn: ['bury', 'spin'],       // a story "they buried it" counts as true on spin or bury
  publicHonesty: { tell: 2, spin: -1, bury: -2 }, // the public's ranking, revealed only at the end

  // ---------- stock ----------
  stockStart: 100,
  stockPerShareholderPoint: 1.5,   // each +1 shareholders effect of a passed motion
  stockPerWorkerPointLag: 0.6,     // workers effect pays back one round later (recognition lag)
  stockRound3WorkerRecognition: 0.8, // in round 3 the market recognizes wage moves from round 1 (Costco arc)
  noise: 1.5,                      // +/- uniform market noise per round
  activistPayoutPush: 1,           // next round shareholders +1 forced (payout lever up one step)
  shortHitIfTrue: -1,              // a short that was right adds a little pressure
  failFloor: 75,                   // stock below this = failed firm
  suitsLostToFail: 2,


  // ---------- suits ----------
  suitLossStock: -6,
  settleStock: -1,

  // ---------- individual actions ----------
  insiderCaughtPenalty: 25,        // director score
  insiderGainPerPoint: 0.5,        // director score per stock point avoided by selling before a drop
  resignPerBoardPerRound: 1,

  // ---------- director score ----------
  secretWeight: 50,                // a fully met secret objective (largest component)
  exposurePenalty: 35,             // exposure fired
  homeRankWeight: 15,              // home community's rank of the board, best = full weight
  failedCap: 15,                   // failed firm caps its directors (unless the secret rewarded failure)

  // ---------- Street ----------
  plaintiffSettleCut: 4,           // plaintiff's score from a settlement

  // ---------- mirrored from content JSON (content author's guesses; THIS file is the tunable source) ----------
  // street.json credibility block
  credTrue: 0.15, credFalse: -0.35, credStart: 1, credMax: 1, credLow: 0.5, credMin: 0.2,
  credResetAfterLow: true,          // after a halved action, credibility resets to credLow
  // street.json per-seat scoring (points per hit)
  streetHit: {
    activist: { true: 2, false: 0 }, reporter: { true: 3, false: -2 }, auditor: { true: 3, false: -1 },
    short_seller: { true: 3, false: -2 }, plaintiffs_lawyer: { true: 3, false: -2 },
  },
  streetSecretBonus: 2,             // street secret met: small bonus (street.json secret_scoring_note)
  activistHit: -1,                  // street.json activist target_stock
  execSessionHit: -1,               // street.json visits.executive_session.stock_hit
  // RULES.md: missing must_save_m takes a provisional stock penalty
  missedSavingsPerM: 0.25,
  // standing_motions.json multipliers (independent_investigator, poison_pill) are read from the JSON flags;
  // these override them when not null.
  investigatorRaisesDetect: null, investigatorTellHitMult: null, investigatorBuryPenaltyMult: null, poisonPillCampaignMult: null,
  // per-round effect while a pay tie stands (after the round it passed)
  payTieEffects: { pay_stock: { shareholders: 0.5, workers: -0.5 }, pay_safety: { shareholders: -0.5, workers: 0.5 } },
  // derived indices (content has no wage tracker; see engine wageIndex/payoutIndex)
  dodgeWageIndexMin: 2,            // Dodge suit wins if the round's wage index >= this ...
  dodgePayoutMMax: 0,              // ... or payout_m that round <= this with shareholders effect <= 0
  harmShareOfCaught: 0.6,          // share of the caught-burial stock hit that is harm (resolves_issue removes it; partial halves it)
  raisesDetectTrue: 0.15,          // raises_detect: true with no number
};
