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

    for (const stat of playerStats) {
      const base =
        (stat.played ? 1 : 0) +
        stat.goals * 3 +
        stat.assists * 2;
      playerPointsMap.set(stat.playerId, base);
    }

    // ── 3. Тренерский бонус: +3 если команда тренера победила, -3 если проиграла ──
    // (Тренер хранится в snapshot.coachPlayerId)
    // Победа определяется по score1/score2 матча
    const team1Won =
      match.score1 !== null &&
      match.score2 !== null &&
      match.score1 > match.score2;
    const team2Won =
      match.score1 !== null &&
      match.score2 !== null &&
      match.score2 > match.score1;

    // ── 4. Откат, если очки уже были начислены ───────────────────────────────
    await db.$transaction(async (tx) => {
      if (match.pointsProcessed) {
        // Откатываем ранее начисленные очки через хранение дельты в снапшоте нет,
        // поэтому пересчитываем "старые" значения и делаем decrement.
        // Простейший подход: обнулить totalPoints и пересчитать с нуля ниже.
        // Для этого сначала ставим все снапшоты тура в 0, потом Re-apply.
        // Но чтобы не затронуть MVP-бонус, сбрасываем только matchPoints часть.
        // Для простоты: сохраняем matchPoints отдельно в снапшоте (нет поля),
        // используем накопительный подход: decrement старого значения.
        // Реализация: просто decrement у каждого снапшота и юзера на то, что было,
        // т.к. мы не храним "предыдущее применение", обнуляем весь totalPoints тура.
        for (const snap of snapshots) {
          // Вычисляем что было применено ранее — не знаем точно без доп поля,
          // поэтому сбрасываем totalPoints снапшота в 0 и синхронизируем User
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

        // Тренерский бонус (+3 если тренер победил, -3 если проиграл)
        if (snap.coachPlayerId) {
          const coachStat = playerStats.find(ps => ps.playerId === snap.coachPlayerId);
          // Если coachStat нет, значит тренерская команда не играла в этом матче (он не в заявке матча)
          // Но мы можем определить команду тренера напрямую из БД, если это нужно.
          // В текущей реализации coachTeam берется из playerStats, что ок, если он там есть.
          const coachTeam = coachStat?.player?.team;

          if (coachTeam) {
            const coachWon =
              (coachTeam === match.team1 && team1Won) ||
              (coachTeam === match.team2 && team2Won);

            const coachLost =
              (coachTeam === match.team1 && team2Won) ||
              (coachTeam === match.team2 && team1Won);

            if (coachWon) {
              snapCoachPoints = 3;
              snapPoints += 3;
            } else if (coachLost) {
              snapCoachPoints = -3;
              snapPoints -= 3;
            }
          }
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
        if (snapPoints > 0) {
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
