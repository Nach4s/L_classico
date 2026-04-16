export interface PlayerStatsInput {
  goals: number;
  assists: number;
  is_mvp: boolean;
  position: string; // "GK", "DEF", "MID", "FWD"
  own_goals?: number; // -2 per own goal
}

export interface PointsBreakdown {
  participationPoints: number;
  goalsPoints: number;
  assistsPoints: number;
  mvpPoints: number;
  ownGoalsPoints: number; // always <= 0
  totalPoints: number;
}

/**
 * Расчет очков за одного игрока.
 * ПРИМЕЧАНИЕ: Если игрок - капитан, то итоговые очки нужно умножить на 2 снаружи этой функции.
 */
export function calculatePlayerPoints(stats: PlayerStatsInput): PointsBreakdown {
  let goalsPoints = 0;
  let assistsPoints = 0;
  let mvpPoints = 0;
  let participationPoints = 0;
  let ownGoalsPoints = 0;

  participationPoints = 1;

  // Очки за голы (3 за каждый)
  goalsPoints = stats.goals * 3;

  // Очки за ассисты (2 за каждый)
  assistsPoints = stats.assists * 2;

  // Штраф за автоголы (-2 за каждый)
  ownGoalsPoints = -(stats.own_goals ?? 0) * 2;

  // Очки за MVP
  if (stats.is_mvp) {
    switch (stats.position) {
      case "GK":
        mvpPoints = 8;
        break;
      case "DEF":
        mvpPoints = 6;
        break;
      case "MID":
        mvpPoints = 4;
        break;
      case "FWD":
        mvpPoints = 2;
        break;
    }
  }

  const totalPoints = participationPoints + goalsPoints + assistsPoints + mvpPoints + ownGoalsPoints;

  return {
    participationPoints,
    goalsPoints,
    assistsPoints,
    mvpPoints,
    ownGoalsPoints,
    totalPoints,
  };
}

