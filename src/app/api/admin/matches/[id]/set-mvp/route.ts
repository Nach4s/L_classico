import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// POST /api/admin/matches/[id]/set-mvp
// Устанавливает MVP матча (закрепляет победителя голосования)
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

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { gameweeks: true }
    });

    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    // Сохраняем все в транзакции
    await db.$transaction(async (tx) => {
       // 1. Закрываем голосование
       await tx.match.update({
         where: { id: matchId },
         data: { votingClosed: true }
       });

       // 2. Если матч привязан к Gameweek, обновляем статистику этого игрока -> isMvp = true
       if (match.gameweeks && match.gameweeks.length > 0) {
          const gameweekId = match.gameweeks[0].id;
          
          await tx.gameweekPlayerStat.upsert({
            where: {
              gameweekId_playerId: {
                gameweekId: gameweekId,
                playerId: playerId
              }
            },
            create: {
              gameweekId,
              playerId,
              played: true, // раз уж он MVP, он явно играл
              isMvp: true,
            },
            update: {
              isMvp: true
            }
          });
       }
    });

    revalidatePath("/", "layout"); // инвалидируем публичные страницы
    revalidatePath(`/admin/matches/${matchId}`); // инвалидируем админку

    return NextResponse.json({ message: "MVP успешно утвержден, очки обновлены" }, { status: 200 });
  } catch (error) {
    console.error("[SET_MVP_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
