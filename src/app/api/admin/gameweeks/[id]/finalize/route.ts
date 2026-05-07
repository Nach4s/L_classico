import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/gameweeks/[id]/finalize
// Завершает тур, меняя его статус на COMPLETED.
// Очки УЖЕ подсчитаны и записаны через процесс process-points (для каждого матча).
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
      },
    });

    if (!gameweek) {
      return NextResponse.json({ error: "Тур не найден" }, { status: 404 });
    }

    if (gameweek.status === "COMPLETED") {
      return NextResponse.json({ error: "Тур уже завершён" }, { status: 400 });
    }

    if (gameweek.squadSnapshots.length === 0) {
      return NextResponse.json(
        { error: "Сначала зафиксируйте составы и начислите очки за матч" },
        { status: 400 }
      );
    }

    // Просто закрываем тур
    await db.gameweek.update({
      where: { id: gameweekId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({
      message: `Тур №${gameweek.number} успешно завершён.`,
    });
  } catch (error) {
    console.error("[GAMEWEEK_FINALIZE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
