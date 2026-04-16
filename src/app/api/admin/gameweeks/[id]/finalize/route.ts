import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculatePlayerPoints } from "@/lib/points-engine";

// POST /api/admin/gameweeks/[id]/finalize
// Считает и записывает fantasy очки за тур для ВСЕХ менеджеров.
// Требует: составы зафиксированы (snapshot), статистика введена (GameweekPlayerStat).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameweekId = parseInt(id, 10);

    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: "Некорректный ID тура" }, { status: 400 });
    }

    // Загружаем тур
    const gameweek = await db.gameweek.findUnique({
      where: { id: gameweekId },
      include: {
        squadSnapshots: true,
        match: true,
        playerStats: {
          include: { player: true },
        },
      },
    });

    if (!gameweek) {
      return NextResponse.json({ error: "Тур не найден" }, { status: 404 });
    }

    if (gameweek.status === "COMPLETED") {
      return NextResponse.json({ error: "Тур уже завершён и очки посчитаны" }, { status: 400 });
    }

    if (gameweek.squadSnapshots.length === 0) {
      return NextResponse.json(
        { error: "Сначала зафиксируйте составы (создайте снапшот) перед подсчётом очков" },
        { status: 400 }
      );
    }

    // Строим карту статистики по игрокам: playerId => stats
    const statsMapByPlayer = new Map<
      number,
      { goals: number; assists: number; isMvp: boolean; played: boolean; position: string }
    >();

    for (const stat of gameweek.playerStats) {
      statsMapByPlayer.set(stat.playerId, {
        goals: stat.goals,
        assists: stat.assists,
        isMvp: stat.isMvp,
        played: stat.played,
        position: stat.player.position,
      });
    }

    // --- COACH LOGIC START ---
    let winnerTeam: string | null = null;
    let loserTeam: string | null = null;

    if (gameweek.match && gameweek.match.score1 !== null && gameweek.match.score2 !== null) {
      if (gameweek.match.score1 > gameweek.match.score2) {
        winnerTeam = gameweek.match.team1;
        loserTeam = gameweek.match.team2;
      } else if (gameweek.match.score2 > gameweek.match.score1) {
        winnerTeam = gameweek.match.team2;
        loserTeam = gameweek.match.team1;
      }
    }

    // Pre-fetch all coaches data mentioned in snapshots to know their teams
    const coachIds = Array.from(new Set(gameweek.squadSnapshots.map(s => s.coachPlayerId).filter(id => id !== null))) as number[];
    const coachesInDb = await db.player.findMany({
      where: { id: { in: coachIds } },
      select: { id: true, team: true }
    });
    const coachTeamMap = new Map(coachesInDb.map(c => [c.id, c.team]));
    // --- COACH LOGIC END ---

    // Подсчёт очков для КАЖДОГО снапшота (команды менеджера)
    const snapshotUpdates: { snapshotId: number; totalPoints: number; coachPoints: number }[] = [];

    for (const snap of gameweek.squadSnapshots) {
      let totalManagerPoints = 0;
      let coachPoints = 0;

      // 1. Calculate player points
      for (const playerId of snap.playerIds) {
        const stat = statsMapByPlayer.get(playerId);
        if (!stat || !stat.played) continue; // Не играл — 0 очков

        const pts = calculatePlayerPoints({
          position: stat.position,
          goals: stat.goals,
          assists: stat.assists,
          is_mvp: stat.isMvp,
        });

        let playerPoints = pts.totalPoints;

        // Умножаем капитана на 2
        if (snap.captainPlayerId === playerId) {
          playerPoints *= 2;
        }

        totalManagerPoints += playerPoints;
      }

      // 2. Calculate coach points
      if (snap.coachPlayerId && winnerTeam) {
        const coachTeam = coachTeamMap.get(snap.coachPlayerId);
        if (coachTeam === winnerTeam) {
          coachPoints = 3;
        } else if (coachTeam === loserTeam) {
          coachPoints = -3;
        }
      }

      totalManagerPoints += coachPoints;

      snapshotUpdates.push({
        snapshotId: snap.id,
        totalPoints: totalManagerPoints,
        coachPoints: coachPoints,
      });
    }

    // Фиксируем очки в транзакции и помечаем тур как COMPLETED
    await db.$transaction(async (tx) => {
      for (const update of snapshotUpdates) {
        await tx.gameweekSquadSnapshot.update({
          where: { id: update.snapshotId },
          data: { 
            totalPoints: update.totalPoints,
            coachPoints: update.coachPoints 
          },
        });
      }

      // Закрываем тур
      await tx.gameweek.update({
        where: { id: gameweekId },
        data: { status: "COMPLETED" },
      });
    });

    return NextResponse.json({
      message: `Тур №${gameweek.number} завершён. Очки начислены ${snapshotUpdates.length} менеджерам.`,
      results: snapshotUpdates,
    });
  } catch (error) {
    console.error("[GAMEWEEK_FINALIZE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
