import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// POST /api/admin/matches/[id]/process-points
// ─────────────────────────────────────────────────────────────────────────────
// ПРАВИЛО 1: Абсолютная идемпотентность.
//   Перед расчётом — полный сброс всех прошлых данных за этот тур.
//   Никаких increment/decrement. Только SET = 0, DELETE, затем новая запись.
//
// ПРАВИЛО 2: Безопасный парсинг рейтинга.
//   Если avgRating игрока null/undefined/0 — он получает 0 рейтинговых очков.
//   Скрипт НИКОГДА не падает из-за отсутствия оценки.
// ─────────────────────────────────────────────────────────────────────────────

// Бонус за народный рейтинг (FotMob-стиль)
function calcRatingBonus(avgRating: number | null | undefined, position: string): number {
  if (!avgRating || avgRating <= 0) return 0; // Safe fallback
  const isDefender = position === "GK" || position === "DEF";
  if (avgRating >= 9.0) return isDefender ? 8 : 5;
  if (avgRating >= 8.0) return isDefender ? 5 : 3;
  if (avgRating >= 7.0) return 1;
  if (avgRating >= 6.0) return 0;
  if (avgRating >= 4.5) return -2;
  return -4;
}

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

    // ── 1. Загружаем матч со всеми связанными данными ─────────────────────────
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        gameweeks: {
          include: {
            playerStats: { include: { player: true } },
            squadSnapshots: true,
            ratingVotes: { include: { player: true } },
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

    // ── 2. Авто-фиксация составов, если снапшотов нет ────────────────────────
    if (gameweek.squadSnapshots.length === 0) {
      const deadlinePassed =
        !gameweek.deadline || new Date(gameweek.deadline) <= new Date();

      if (!deadlinePassed) {
        return NextResponse.json(
          { error: "Дедлайн ещё не наступил. Нельзя начислять очки до фиксации составов." },
          { status: 400 }
        );
      }

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
          ratingVotes: { include: { player: true } },
        },
      });
      if (!refreshed) {
        return NextResponse.json({ error: "Ошибка обновления тура" }, { status: 500 });
      }
      Object.assign(gameweek, refreshed);
    }

    const snapshots = gameweek.squadSnapshots;

    // ══════════════════════════════════════════════════════════════════════════
    // ПРАВИЛО 1: ПОЛНЫЙ СБРОС — сначала обнуляем всё, потом считаем заново
    // ══════════════════════════════════════════════════════════════════════════
    await db.$transaction(async (tx) => {
      // 1a. Отнимаем старые очки у каждого менеджера и сбрасываем снапшот
      for (const snap of snapshots) {
        if (snap.totalPoints !== 0) {
          await tx.user.update({
            where: { id: snap.userId },
            data: { totalPoints: { decrement: snap.totalPoints } },
          });
        }
        await tx.gameweekSquadSnapshot.update({
          where: { id: snap.id },
          data: { totalPoints: 0, coachPoints: 0 },
        });
      }

      // 1b. Удаляем ВСЕ записи GameweekPlayerStat за этот тур — считаем с нуля
      await tx.gameweekPlayerStat.deleteMany({
        where: { gameweekId: gameweek.id },
      });
    });

    // ── 3. Считаем очки каждого игрока с чистого листа ───────────────────────

    // 3a. Агрегируем средние рейтинги из голосов (safe fallback если нет голосов)
    const ratingMap = new Map<number, { sum: number; count: number; position: string }>();
    for (const vote of (gameweek.ratingVotes ?? [])) {
      const entry = ratingMap.get(vote.playerId);
      if (entry) {
        entry.sum += Number(vote.rating);
        entry.count++;
      } else {
        ratingMap.set(vote.playerId, {
          sum: Number(vote.rating),
          count: 1,
          position: vote.player.position,
        });
      }
    }

    // 3b. Собираем голы и ассисты из событий матча (всегда с нуля!)
    type PlayerCalc = {
      goals: number;
      assists: number;
      played: boolean;
      isMvp: boolean;
      position: string;
    };
    const calcMap = new Map<number, PlayerCalc>();

    // Все игроки в снапшотах считаются сыгравшими по умолчанию
    for (const snap of snapshots) {
      for (const playerId of snap.playerIds) {
        if (!calcMap.has(playerId)) {
          calcMap.set(playerId, { goals: 0, assists: 0, played: true, isMvp: false, position: "FWD" });
        }
      }
    }

    // Голы и ассисты — строго из событий матча
    for (const goal of match.goals) {
      if (goal.scorerPlayerId) {
        const s = calcMap.get(goal.scorerPlayerId) ?? { goals: 0, assists: 0, played: true, isMvp: false, position: "FWD" };
        s.goals += 1;
        s.played = true;
        calcMap.set(goal.scorerPlayerId, s);
      }
      if (goal.assistPlayerId) {
        const s = calcMap.get(goal.assistPlayerId) ?? { goals: 0, assists: 0, played: true, isMvp: false, position: "FWD" };
        s.assists += 1;
        s.played = true;
        calcMap.set(goal.assistPlayerId, s);
      }
    }

    // 3c. Определяем MVP если уже назначен
    const mvpPlayerId = match.mvpId;
    const mvpBonusTable: Record<string, number> = { GK: 8, DEF: 6, MID: 4, FWD: 2 };
    let mvpBonusAmount = 0;
    if (mvpPlayerId) {
      const mvpPlayer = await db.player.findUnique({ where: { id: mvpPlayerId } });
      if (mvpPlayer) {
        mvpBonusAmount = mvpBonusTable[mvpPlayer.position] ?? 2;
        const s = calcMap.get(mvpPlayerId) ?? { goals: 0, assists: 0, played: true, isMvp: false, position: mvpPlayer.position };
        s.isMvp = true;
        s.position = mvpPlayer.position;
        calcMap.set(mvpPlayerId, s);
      }
    }

    // 3d. Обогащаем calcMap позициями игроков из БД
    const allCalcPlayerIds = Array.from(calcMap.keys());
    const allCalcPlayers = await db.player.findMany({
      where: { id: { in: allCalcPlayerIds } },
      select: { id: true, position: true },
    });
    for (const p of allCalcPlayers) {
      const s = calcMap.get(p.id);
      if (s) s.position = p.position;
    }

    // 3e. Тренерский бонус
    const team1Won = match.score1 !== null && match.score2 !== null && match.score1 > match.score2;
    const team2Won = match.score1 !== null && match.score2 !== null && match.score2 > match.score1;
    const isDraw   = match.score1 !== null && match.score2 !== null && match.score1 === match.score2;

    const matchCoaches = await db.player.findMany({
      where: { team: { in: [match.team1, match.team2] }, position: "COACH" },
    });
    const coachPtsMap = new Map<number, number>();
    for (const coach of matchCoaches) {
      let pts = 0;
      if (coach.team === match.team1) {
        if (team1Won) pts = 3; else if (team2Won) pts = -3;
      } else if (coach.team === match.team2) {
        if (team2Won) pts = 3; else if (team1Won) pts = -3;
      }
      coachPtsMap.set(coach.id, pts);
    }

    // ── 4. Применяем новые данные в одной транзакции ─────────────────────────
    await db.$transaction(async (tx) => {

      // 4a. Создаём GameweekPlayerStat для полевых игроков
      for (const [playerId, s] of calcMap.entries()) {
        const statsPoints = (s.played ? 1 : 0) + s.goals * 3 + s.assists * 2;
        const mvpBonus   = s.isMvp ? mvpBonusAmount : 0;

        // ПРАВИЛО 2: Safe fallback для рейтинга
        const ratingData  = ratingMap.get(playerId);
        const avgRating   = ratingData ? parseFloat((ratingData.sum / ratingData.count).toFixed(1)) : 0;
        const ratingBonus = calcRatingBonus(avgRating, s.position);

        const totalPoints = statsPoints + mvpBonus + ratingBonus;

        await tx.gameweekPlayerStat.create({
          data: {
            gameweekId: gameweek.id,
            playerId,
            goals:       s.goals,
            assists:     s.assists,
            played:      s.played,
            isMvp:       s.isMvp,
            mvpBonus,
            avgRating:   avgRating > 0 ? avgRating : undefined,
            ratingBonus,
            statsPoints,
            totalPoints,
          },
        });
      }

      // 4b. Создаём GameweekPlayerStat для тренеров
      for (const [coachId, pts] of coachPtsMap.entries()) {
        await tx.gameweekPlayerStat.create({
          data: {
            gameweekId:  gameweek.id,
            playerId:    coachId,
            played:      false,
            statsPoints: pts,
            totalPoints: pts,
          },
        });
      }

      // 4c. Начисляем очки каждому снапшоту
      for (const snap of snapshots) {
        let snapPoints      = 0;
        let snapCoachPoints = 0;

        for (const playerId of snap.playerIds) {
          // Получаем только что созданные данные из calcMap
          const s = calcMap.get(playerId);
          if (!s) continue;

          const statsPoints = (s.played ? 1 : 0) + s.goals * 3 + s.assists * 2;
          const mvpBonus    = s.isMvp ? mvpBonusAmount : 0;

          const ratingData  = ratingMap.get(playerId);
          const avgRating   = ratingData ? ratingData.sum / ratingData.count : 0;
          const ratingBonus = calcRatingBonus(avgRating, s.position);

          const playerTotal = statsPoints + mvpBonus + ratingBonus;
          if (playerTotal === 0) continue;

          const isCaptain = snap.captainPlayerId === playerId;
          snapPoints += isCaptain ? playerTotal * 2 : playerTotal;
        }

        // Тренер
        if (snap.coachPlayerId && coachPtsMap.has(snap.coachPlayerId)) {
          const coachPts  = coachPtsMap.get(snap.coachPlayerId)!;
          snapCoachPoints = coachPts;
          snapPoints     += coachPts;
        }

        // Устанавливаем (SET, не increment!) — мы уже обнулили выше
        await tx.gameweekSquadSnapshot.update({
          where: { id: snap.id },
          data: { totalPoints: snapPoints, coachPoints: snapCoachPoints },
        });

        if (snapPoints !== 0) {
          await tx.user.update({
            where: { id: snap.userId },
            data: { totalPoints: { increment: snapPoints } },
          });
        }
      }

      // 4d. Помечаем матч как обработанный
      await tx.match.update({
        where: { id: matchId },
        data: { pointsProcessed: true, mvpBonusProcessed: !!mvpPlayerId },
      });
    });

    console.log(`[process-points] Match ${matchId} processed. Snapshots: ${snapshots.length}`);

    revalidatePath("/fantasy/leaderboard");
    revalidatePath("/fantasy", "layout");
    revalidatePath("/players", "layout");
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
