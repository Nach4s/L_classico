import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculatePlayerPoints } from "@/lib/points-engine";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
    }

    const [player, activeSeason] = await Promise.all([
      db.player.findUnique({ where: { id: playerId } }),
      db.season.findFirst({ where: { isArchived: false }, orderBy: { createdAt: "desc" } }),
    ]);

    if (!player) {
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }

    let totalGoals = 0;
    let totalAssists = 0;
    let totalPoints = 0;
    let history: any[] = [];

    if (activeSeason) {
      const [goalsScored, goalsAssisted, mvpStats] = await Promise.all([
        db.goal.findMany({
          where: { scorerPlayerId: playerId, match: { seasonId: activeSeason.id } },
          include: { match: { include: { gameweeks: true } } },
        }),
        db.goal.findMany({
          where: { assistPlayerId: playerId, match: { seasonId: activeSeason.id } },
          include: { match: { include: { gameweeks: true } } },
        }),
        db.gameweekPlayerStat.findMany({
          where: { playerId, isMvp: true, gameweek: { seasonId: activeSeason.id } },
          include: { gameweek: { include: { match: true } } },
        }),
      ]);

      const matchMap = new Map<number, any>();

      const getEntry = (match: any) => {
        if (!matchMap.has(match.id)) {
          matchMap.set(match.id, {
            matchId: match.id,
            matchDate: match.matchDate,
            team1: match.team1,
            team2: match.team2,
            score1: match.score1,
            score2: match.score2,
            gameweekNumber: match.gameweeks?.[0]?.number || null,
            goals: 0,
            assists: 0,
            isMvp: false,
            points: 0,
          });
        }
        return matchMap.get(match.id)!;
      };

      goalsScored.forEach((g) => { getEntry(g.match).goals += 1; totalGoals += 1; });
      goalsAssisted.forEach((g) => { getEntry(g.match).assists += 1; totalAssists += 1; });
      mvpStats.forEach((ps) => { if (ps.gameweek.match) getEntry(ps.gameweek.match).isMvp = true; });

      matchMap.forEach((entry) => {
        const pts = calculatePlayerPoints({
          position: player.position,
          goals: entry.goals,
          assists: entry.assists,
          is_mvp: entry.isMvp,
        });
        entry.points = pts.totalPoints;
        totalPoints += pts.totalPoints;
      });

      history = Array.from(matchMap.values())
        .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
    }

    return NextResponse.json({
      player: {
        ...player,
        price: player.price.toString(),
      },
      stats: { totalGoals, totalAssists, totalPoints },
      history,
      seasonName: activeSeason?.name || null,
    });
  } catch (error) {
    console.error("[PLAYER_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
