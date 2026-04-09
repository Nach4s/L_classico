// ===================================
// League Standings Calculator
// L Clásico V2.0
// ===================================

// Minimal match type — only what we need to calculate standings
export interface StandingsMatch {
  score1: number | null; // Team 1 goals
  score2: number | null; // Team 2 goals
  team1: string;         // "1 группа"
  team2: string;         // "2 группа"
  matchDate: Date;
}

export type FormResult = "W" | "D" | "L";

export interface TeamStanding {
  team: string;       // "1 группа" / "2 группа"
  played: number;     // Matches played
  won: number;        // Wins
  drawn: number;      // Draws
  lost: number;       // Losses
  goalsFor: number;   // Goals scored
  goalsAgainst: number; // Goals conceded
  goalDifference: number; // GF - GA
  points: number;     // W×3 + D×1
  form: FormResult[]; // Last 5 results (newest first)
}

// ===================================
// Main function
// ===================================

/**
 * Calculates league standings from an array of completed matches.
 * Only matches with non-null scores are counted.
 * Sorted by: points (desc) → goal difference (desc) → goals scored (desc)
 */
export function calculateStandings(matches: StandingsMatch[]): TeamStanding[] {
  // Collect all unique team names
  const teamNames = new Set<string>();
  matches.forEach((m) => {
    teamNames.add(m.team1);
    teamNames.add(m.team2);
  });

  // Init empty standing for each team
  const standingsMap = new Map<string, TeamStanding>();
  teamNames.forEach((team) => {
    standingsMap.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    });
  });

  // Process only matches with actual scores, sorted by date (oldest first)
  const completedMatches = matches
    .filter((m) => m.score1 !== null && m.score2 !== null)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  for (const match of completedMatches) {
    const s1 = match.score1 as number;
    const s2 = match.score2 as number;

    const team1 = standingsMap.get(match.team1)!;
    const team2 = standingsMap.get(match.team2)!;

    // Update match counts
    team1.played++;
    team2.played++;

    // Update goals
    team1.goalsFor += s1;
    team1.goalsAgainst += s2;
    team2.goalsFor += s2;
    team2.goalsAgainst += s1;

    // Determine result
    if (s1 > s2) {
      // Team 1 wins
      team1.won++;
      team1.points += 3;
      team1.form.push("W");
      team2.lost++;
      team2.form.push("L");
    } else if (s2 > s1) {
      // Team 2 wins
      team2.won++;
      team2.points += 3;
      team2.form.push("W");
      team1.lost++;
      team1.form.push("L");
    } else {
      // Draw
      team1.drawn++;
      team1.points += 1;
      team1.form.push("D");
      team2.drawn++;
      team2.points += 1;
      team2.form.push("D");
    }
  }

  // Finalize: calculate GD and trim form to last 5 (newest first)
  const standings = Array.from(standingsMap.values()).map((s) => ({
    ...s,
    goalDifference: s.goalsFor - s.goalsAgainst,
    form: [...s.form].reverse().slice(0, 5), // newest 5 first
  }));

  // Sort: Points → GD → Goals For
  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}
