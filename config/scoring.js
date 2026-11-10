// Principals: the few numbers that are left after the one-round redesign.
// There is no scoring. One decision, one vote, then the debrief.

export const SCORING = {
  // ---------- timer (seconds); the host can change it in admin ----------
  timers: { play: 900 },        // 15 minutes to read, talk and vote

  // ---------- sizing ----------
  boardSize: 6,                 // one seat per role card; a seventh student shares a seat with a partner
  minBoardSize: 3,              // fewer than 3 students per board shrinks the board count
  // Seat dropped first when a board has fewer than six people.
  seatDropOrder: ['audit_chair', 'community', 'founder_friend', 'fund', 'labor', 'attorney'],
  // Board priority when the host picks fewer than five boards.
  boardPriority: ['heartland', 'summit', 'valley', 'thread', 'lumen', 'aurum'],
};
