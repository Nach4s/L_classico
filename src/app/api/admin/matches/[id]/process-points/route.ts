import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// POST /api/admin/matches/[id]/process-points
// Начисляет fantasy-очки всем снапшотам за данный матч
// Идемпотентно: если уже начислялись — сначала откатывает, потом применяет заново
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });
    }

    // ── 1. Получаем матч со всеми нужными данными ─────────────────────────────
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        gameweeks: {
          include: {
            playerStats: {
              include: { player: true },
            },
            squadSnapshots: true,
          },
        },
        goals: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }
    if (!match.gameweeks || match.gameweeks.length === 0) {
      return NextResponse.json({ error: "Матч не привязан к туру" }, { status: 400 });
    }

    const gameweek = match.gameweeks[0];

    // ── Авто-фиксация составов, если дедлайн прошёл ──────────────────────────
    if (gameweek.squadSnapshots.length === 0) {
      const deadlinePassed =
        !gameweek.deadline || new Date(gameweek.deadline) <= new Date();

      if (!deadlinePassed) {
        return NextResponse.json(
          { error: "Дедлайн ещё не наступил. Нельзя начислять очки до фиксации составов." },
          { status: 400 }
        );
      }

      // Создаём снапшоты автоматически
      const seasonTeams = await db.fantasyTeam.findMany({
        where: { seasonId: gameweek.seasonId },
        include: { players: true },
      });

      if (seasonTeams.length === 0) {
        return NextResponse.json(
          { error: "Нет команд в этом сезоне — некого фиксировать." },
          { status: 400 }
        );
      }

      const snapshotsData = seasonTeams.map((team) => {
        const captainFtp = team.players.find((p) => p.isCaptain);
        const viceFtp = team.players.find((p) => p.isViceCaptain);
        return {
          gameweekId: gameweek.id,
          userId: team.userId,
          playerIds: team.players.map((p) => p.playerId),
          captainPlayerId: captainFtp?.playerId ?? null,
          viceCaptainPlayerId: viceFtp?.playerId ?? null,
          coachPlayerId: team.coachId ?? null,
          activeChip: team.activeChip ?? null,
          _teamId: team.id,
        };
      });

      await db.$transaction(async (tx) => {
        await tx.gameweekSquadSnapshot.createMany({
          data: snapshotsData.map(({ _teamId, ...snap }) => snap),
        });
        const teamIdsWithChip = snapshotsData
          .filter((s) => s.activeChip !== null)
          .map((s) => s._teamId);
        if (teamIdsWithChip.length > 0) {
          await tx.fantasyTeam.updateMany({
            where: { id: { in: teamIdsWithChip } },
            data: { activeChip: null },
          });
        }
        await tx.gameweek.update({
          where: { id: gameweek.id },
          data: { status: "STATS_ENTRY" },
        });
      });

      // Перезагружаем gameweek со свежими снапшотами
      const refreshed = await db.gameweek.findUnique({
        where: { id: gameweek.id },
        include: {
          playerStats: { include: { player: true } },
          squadSnapshots: true,
        },
      });
      if (!refreshed) {
        return NextResponse.json({ error: "Ошибка обновления тура" }, { status: 500 });
      }
      Object.assign(gameweek, refreshed);
    }

    const snapshots = gameweek.squadSnapshots;
    const playerStats = gameweek.playerStats;

    // ── 2. Считаем очки каждого игрока ───────────────────────────────────────
    // Формула: (played ? 1 : 0) + (goals * 3) + (assists * 2)
    const playerPointsMap = new Map<number, number>();

    // Собираем голы и ассисты из match.goals
    const actualStats = new Map<number, { goals: number, assists: number, played: boolean, isMvp: boolean }>();
    
    // Переносим существующую стату (например, MVP уже мог быть задан)
    for (const stat of playerStats) {
      actualStats.set(stat.playerId, { goals: stat.goals, assists: stat.assists, played: stat.played, isMvp: stat.isMvp });
    }

    // Все игроки, которые были выбраны менеджерами, по умолчанию считаются сыгравшими
    for (const snap of snapshots) {
      for (const playerId of snap.playerIds) {
        if (!actualStats.has(playerId)) {
          actualStats.set(playerId, { goals: 0, assists: 0, played: true, isMvp: false });
        } else {
          actualStats.get(playerId)!.played = true;
        }
      }
    }

    // Добавляем статистику из реальных голов матча
    for (const goal of match.goals) {
      // Автор гола
      if (goal.scorerPlayerId) {
        const s = actualStats.get(goal.scorerPlayerId) || { goals: 0, assists: 0, played: true, isMvp: false };
        s.goals += 1;
        s.played = true; // Раз забил, значит играл
        actualStats.set(goal.scorerPlayerId, s);
      }
      // Ассистент
      if (goal.assistPlayerId) {
        const s = actualStats.get(goal.assistPlayerId) || { goals: 0, assists: 0, played: true, isMvp: false };
        s.assists += 1;
        s.played = true;
        actualStats.set(goal.assistPlayerId, s);
      }
    }

    // Сохраняем в мапу и БД (в транзакции ниже)
    for (const [playerId, st] of actualStats.entries()) {
      const base = (st.played ? 1 : 0) + (st.goals * 3) + (st.assists * 2) + (st.isMvp ? 3 : 0); // MVP бонус 3 очка (или по логике)
      playerPointsMap.set(playerId, base);
    }

    // ── 3. Тренерский бонус: +3 победа, 0 ничья, -3 поражение ───────────────
    // Победа определяется по score1/score2 матча
    const team1Won = match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
    const team2Won = match.score1 !== null && match.score2 !== null && match.score2 > match.score1;
    const isDraw = match.score1 !== null && match.score2 !== null && match.score1 === match.score2;

    // Получаем всех тренеров участвующих команд напрямую из БД, 
    // т.к. в playerStats (статистика на поле) они обычно не попадают
    const matchCoaches = await db.player.findMany({
      where: {
        team: { in: [match.team1, match.team2] },
        position: "COACH"
      }
    });

    const coachMatchPoints = new Map<number, number>();
    for (const coach of matchCoaches) {
      let pts = 0;
      if (coach.team === match.team1) {
        if (team1Won) pts = 3;
        else if (team2Won) pts = -3;
        else if (isDraw) pts = 0;
      } else if (coach.team === match.team2) {
        if (team2Won) pts = 3;
        else if (team1Won) pts = -3;
        else if (isDraw) pts = 0;
      }
      coachMatchPoints.set(coach.id, pts);
      
      // Также добавим очки тренеру в общую мапу, если потребуется
      playerPointsMap.set(coach.id, pts);
    }

    // ── 4. Откат, если очки уже были начислены ───────────────────────────────
    await db.$transaction(async (tx) => {
      if (match.pointsProcessed) {
        for (const snap of snapshots) {
          await tx.user.update({
            where: { id: snap.userId },
            data: { totalPoints: { decrement: snap.totalPoints } },
          });
          await tx.gameweekSquadSnapshot.update({
            where: { id: snap.id },
            data: { totalPoints: 0, coachPoints: 0 },
          });
        }
      }

      // Обновляем/создаем статистику для тренеров в БД, чтобы очки отображались у самого тренера
      for (const [coachId, pts] of coachMatchPoints.entries()) {
        await tx.gameweekPlayerStat.upsert({
          where: { gameweekId_playerId: { gameweekId: gameweek.id, playerId: coachId } },
          update: { totalPoints: pts, statsPoints: pts },
          create: { gameweekId: gameweek.id, playerId: coachId, totalPoints: pts, statsPoints: pts }
        });
      }

      // Обновляем/создаем статистику для полевых игроков
      for (const [playerId, st] of actualStats.entries()) {
        const base = playerPointsMap.get(playerId) ?? 0;
        await tx.gameweekPlayerStat.upsert({
          where: { gameweekId_playerId: { gameweekId: gameweek.id, playerId: playerId } },
          update: { 
            goals: st.goals, 
            assists: st.assists, 
            played: st.played,
            totalPoints: base,
            statsPoints: base
          },
          create: { 
            gameweekId: gameweek.id, 
            playerId: playerId, 
            goals: st.goals, 
            assists: st.assists, 
            played: st.played,
            totalPoints: base,
            statsPoints: base
          }
        });
      }

      // ── 5. Начисляем новые очки каждому снапшоту ──────────────────────────
      for (const snap of snapshots) {
        let snapPoints = 0;
        let snapCoachPoints = 0;

        for (const playerId of snap.playerIds) {
          const base = playerPointsMap.get(playerId) ?? 0;
          if (base === 0) continue;

          // Если этот игрок — капитан, очки x2
          const isCaptain = snap.captainPlayerId === playerId;
          const earned = isCaptain ? base * 2 : base;
          snapPoints += earned;
        }

        // Применяем тренерский бонус, если тренер участвовал в этом матче
        if (snap.coachPlayerId && coachMatchPoints.has(snap.coachPlayerId)) {
          const coachPts = coachMatchPoints.get(snap.coachPlayerId)!;
          snapCoachPoints = coachPts;
          snapPoints += coachPts;
        }

        // Обновляем снапшот
        await tx.gameweekSquadSnapshot.update({
          where: { id: snap.id },
          data: {
            totalPoints: { increment: snapPoints },
            coachPoints: { increment: snapCoachPoints },
          },
        });

        // Обновляем общие очки пользователя
        if (snapPoints !== 0) {
          await tx.user.update({
            where: { id: snap.userId },
            data: { totalPoints: { increment: snapPoints } },
          });
        }
      }

      // ── 6. Помечаем матч как обработанный ────────────────────────────────
      await tx.match.update({
        where: { id: matchId },
        data: { pointsProcessed: true },
      });
    });

    console.log(`[process-points] Match ${matchId} processed. Snapshots updated: ${snapshots.length}`);

    revalidatePath("/fantasy/leaderboard");
    revalidatePath("/", "layout");

    return NextResponse.json({
      message: "Очки успешно начислены",
      snapshotsUpdated: snapshots.length,
    });
  } catch (error) {
    console.error("[PROCESS_POINTS_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
