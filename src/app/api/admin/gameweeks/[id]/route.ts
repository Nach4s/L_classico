import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// PATCH /api/admin/gameweeks/[id]
// Обновляет дедлайн и/или привязанный матч тура
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameweekId = parseInt(id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: "Некорректный ID тура" }, { status: 400 });
    }

    const body = await req.json();
    const { deadline, matchId } = body;

    const gameweek = await db.gameweek.findUnique({ where: { id: gameweekId } });
    if (!gameweek) {
      return NextResponse.json({ error: "Тур не найден" }, { status: 404 });
    }

    const updated = await db.gameweek.update({
      where: { id: gameweekId },
      data: {
        deadline: deadline ? new Date(deadline) : null,
        matchId: matchId ? parseInt(matchId) : null,
      },
    });

    revalidatePath("/admin/gameweeks");
    revalidatePath("/fantasy");

    return NextResponse.json({ gameweek: updated, message: "Тур обновлён" });
  } catch (error) {
    console.error("[GAMEWEEK_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
