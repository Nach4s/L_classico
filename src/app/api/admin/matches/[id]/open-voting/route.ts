import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/matches/[id]/open-voting
// Открывает MVP-голосование для матча на 24 часа
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);

    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    // Можно передать кастомное время завершения, иначе +24 часа
    const hoursOpen = body.hoursOpen ? parseInt(body.hoursOpen, 10) : 24;

    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    if (match.votingClosed) {
      return NextResponse.json({ error: "Голосование для этого матча уже закрыто" }, { status: 400 });
    }

    const votingEndsAt = new Date();
    votingEndsAt.setHours(votingEndsAt.getHours() + hoursOpen);

    const updated = await db.match.update({
      where: { id: matchId },
      data: {
        votingEndsAt,
        votingClosed: false,
        votingStartedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Голосование за MVP открыто до ${votingEndsAt.toLocaleString("ru-RU")}`,
      votingEndsAt: updated.votingEndsAt,
    });
  } catch (error) {
    console.error("[OPEN_VOTING_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/admin/matches/[id]/open-voting (close variant)
// PATCH — закрыть голосование досрочно
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);

    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });
    }

    await db.match.update({
      where: { id: matchId },
      data: { votingClosed: true },
    });

    return NextResponse.json({ message: "Голосование закрыто" });
  } catch (error) {
    console.error("[CLOSE_VOTING_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
