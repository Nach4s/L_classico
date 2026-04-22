import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Бонус MVP по позиции
const MVP_BONUS: Record<string, number> = {
  GK: 8,
  DEF: 6,
  MID: 4,
  FWD: 2,
};

// POST /api/admin/matches/[id]/set-mvp
// Устанавливает MVP матча + начисляет бонусные fantasy-очки
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    const body = await req.json();
    const { playerId } = body;

    if (isNaN(matchId) || !playerId) {
      return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
    }

    // ── 1. Получаем матч + gameweek + снапшоты ───────────────────────────────
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        gameweeks: {
          include: { squadSnapshots: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    // ── 2. Получаем игрока MVP и определяем бонус ───────────────────────────
    const mvpPlayer = await db.player.findUnique({ where: { id: playerId } });
    if (!mvpPlayer) {
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }

    const baseBonus = MVP_BONUS[mvpPlayer.position] ?? 2;

    await db.$transaction(async (tx) => {
      // ── 3. Откат предыдущего MVP-бонуса если был назначен ─────────────────
      if (match.mvpBonusProcessed && match.mvpId) {
        const oldMvp = await tx.player.findUnique({ where: { id: match.mvpId } });
        const oldBonus = oldMvp ? (MVP_BONUS[oldMvp.position] ?? 2) : 2;

        const gameweek = match.gameweeks?.[0];
        if (gameweek) {
          for (const snap of gameweek.squadSnapshots) {
            if (!snap.playerIds.includes(match.mvpId)) continue;

            const isCaptain = snap.captainPlayerId === match.mvpId;
            const earned = isCaptain ? oldBonus * 2 : oldBonus;

            await tx.gameweekSquadSnapshot.update({
              where: { id: snap.id },
              data: { totalPoints: { decrement: earned } },
            });
            await tx.user.update({
              where: { id: snap.userId },
              data: { totalPoints: { decrement: earned } },
            });
          }
        }
      }

      // ── 4. Закрываем голосование, сохраняем mvpId ─────────────────────────
      await tx.match.update({
        where: { id: matchId },
        data: {
          votingClosed: true,
          mvpId: playerId,
          mvpBonusProcessed: true,
        },
      });

      // ── 5. Помечаем isMvp в GameweekPlayerStat ────────────────────────────
      const gameweek = match.gameweeks?.[0];
      if (gameweek) {
        await tx.gameweekPlayerStat.upsert({
          where: {
            gameweekId_playerId: {
              gameweekId: gameweek.id,
              playerId: playerId,
            },
          },
          create: {
            gameweekId: gameweek.id,
            playerId,
            played: true,
            isMvp: true,
            mvpBonus: baseBonus,
          },
          update: {
            isMvp: true,
            mvpBonus: baseBonus,
          },
        });

        // ── 6. Начисляем бонус всем снапшотам где есть этот MVP ─────────────
        for (const snap of gameweek.squadSnapshots) {
          if (!snap.playerIds.includes(playerId)) continue;

          const isCaptain = snap.captainPlayerId === playerId;
          const earned = isCaptain ? baseBonus * 2 : baseBonus;

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

    console.log("MVP Updated:", matchId, playerId, `bonus=${baseBonus}`);

    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/fantasy/leaderboard");
    revalidatePath("/admin");
    revalidatePath("/", "layout");

    return NextResponse.json({
      message: "MVP успешно утвержден, очки начислены",
      bonus: baseBonus,
    });
  } catch (error) {
    console.error("[SET_MVP_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
