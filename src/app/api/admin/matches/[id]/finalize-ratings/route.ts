import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ── Формула очков за рейтинг ──────────────────────────────────────────────────
// Применяется к полевым игрокам. GK и DEF получают повышенные бонусы.
function calcRatingBonus(avgRating: number, position: string): number {
  const isDefender = position === "GK" || position === "DEF";

  if (avgRating >= 9.0) return isDefender ? 8 : 5;
  if (avgRating >= 8.0) return isDefender ? 5 : 3;
  if (avgRating >= 7.0) return 1;
  if (avgRating >= 6.0) return 0;
  if (avgRating >= 4.5) return -2;
  return -4;
}

// POST /api/admin/matches/[id]/finalize-ratings
// Применяет бонусы за народный рейтинг к GameweekPlayerStat и снапшотам.
// Идемпотентно: если уже применялось — откатывает и применяет заново.
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

    // ── 1. Получаем матч, тур, снапшоты и статистику ──────────────────────────
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        gameweeks: {
          include: {
            squadSnapshots: true,
            playerStats: { include: { player: true } },
            ratingVotes: {
              include: { player: true },
            },
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    const gameweek = match.gameweeks?.[0];
    if (!gameweek) {
      return NextResponse.json({ error: "Матч не привязан к туру" }, { status: 400 });
    }

    if (gameweek.ratingVotes.length === 0) {
      return NextResponse.json({ error: "Голосов за рейтинг пока нет" }, { status: 400 });
    }

    // ── 2. Агрегируем средний рейтинг по каждому игроку ──────────────────────
    const ratingMap = new Map<number, { sum: number; count: number; position: string }>();
    for (const vote of gameweek.ratingVotes) {
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

    // ── 3. Считаем бонус за рейтинг для каждого игрока ───────────────────────
    const bonusMap = new Map<number, number>(); // playerId → ratingBonus
    const avgMap = new Map<number, number>();   // playerId → avgRating

    for (const [playerId, data] of ratingMap.entries()) {
      const avg = data.sum / data.count;
      const bonus = calcRatingBonus(avg, data.position);
      bonusMap.set(playerId, bonus);
      avgMap.set(playerId, avg);
    }

    await db.$transaction(async (tx) => {
      // ── 4. Откат предыдущих рейтинговых бонусов если уже применялись ────────
      const existingStats = gameweek.playerStats.filter(
        (s) => s.ratingBonus !== 0
      );

      for (const stat of existingStats) {
        // Убираем старый бонус из снапшотов
        for (const snap of gameweek.squadSnapshots) {
          if (!snap.playerIds.includes(stat.playerId)) continue;
          const isCap = snap.captainPlayerId === stat.playerId;
          const oldEarned = isCap ? stat.ratingBonus * 2 : stat.ratingBonus;

          await tx.gameweekSquadSnapshot.update({
            where: { id: snap.id },
            data: { totalPoints: { decrement: oldEarned } },
          });
          await tx.user.update({
            where: { id: snap.userId },
            data: { totalPoints: { decrement: oldEarned } },
          });
        }

        // Сбрасываем ratingBonus в GameweekPlayerStat
        await tx.gameweekPlayerStat.update({
          where: { id: stat.id },
          data: {
            ratingBonus: 0,
            avgRating: 0,
            totalPoints: { decrement: stat.ratingBonus },
          },
        });
      }

      // ── 5. Применяем новые бонусы ─────────────────────────────────────────
      for (const [playerId, bonus] of bonusMap.entries()) {
        const avg = avgMap.get(playerId)!;

        // Обновляем/создаём GameweekPlayerStat
        await tx.gameweekPlayerStat.upsert({
          where: { gameweekId_playerId: { gameweekId: gameweek.id, playerId } },
          update: {
            ratingBonus: bonus,
            avgRating: parseFloat(avg.toFixed(1)),
            totalPoints: { increment: bonus },
          },
          create: {
            gameweekId: gameweek.id,
            playerId,
            ratingBonus: bonus,
            avgRating: parseFloat(avg.toFixed(1)),
            totalPoints: bonus,
          },
        });

        // Начисляем бонус всем снапшотам с этим игроком
        for (const snap of gameweek.squadSnapshots) {
          if (!snap.playerIds.includes(playerId)) continue;

          const isCap = snap.captainPlayerId === playerId;
          const earned = isCap ? bonus * 2 : bonus;

          if (earned === 0) continue;

          await tx.gameweekSquadSnapshot.update({
            where: { id: snap.id },
            data: { totalPoints: { increment: earned } },
          });
          await tx.user.update({
            where: { id: snap.userId },
            data: { totalPoints: { increment: earned } },
          });
        }
      }
    });

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/fantasy/leaderboard");
    revalidatePath("/", "layout");

    return NextResponse.json({
      message: `Рейтинговые бонусы применены для ${bonusMap.size} игроков`,
      playersProcessed: bonusMap.size,
    });
  } catch (error) {
    console.error("[FINALIZE_RATINGS_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
