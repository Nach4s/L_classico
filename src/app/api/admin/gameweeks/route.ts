import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/gameweeks
// Возвращает все туры текущего сезона
export async function GET() {
  try {
    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json({ error: "Активный сезон не найден" }, { status: 404 });
    }

    const gameweeks = await db.gameweek.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        match: true,
        squadSnapshots: { select: { id: true }, take: 1 }, // Для проверки зафиксированы ли составы
      },
      orderBy: { number: "asc" },
    });

    // Получаем также матчи сезона без привязанного тура (для формы создания)
    const matches = await db.match.findMany({
      where: { seasonId: activeSeason.id },
      orderBy: { matchDate: "asc" },
    });

    return NextResponse.json({ gameweeks, matches });
  } catch (error) {
    console.error("[GAMEWEEKS_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/admin/gameweeks
// Создает новый тур
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { number, deadline, matchId } = body;

    if (!number || !deadline) {
      return NextResponse.json(
        { error: "Номер тура и дедлайн обязательны" },
        { status: 400 }
      );
    }

    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json({ error: "Активный сезон не найден" }, { status: 404 });
    }

    // Проверяем, нет ли уже такого номера в этом сезоне
    const existing = await db.gameweek.findFirst({
      where: { seasonId: activeSeason.id, number: parseInt(number, 10) },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Тур с номером ${number} уже существует в этом сезоне` },
        { status: 400 }
      );
    }

    const gameweek = await db.gameweek.create({
      data: {
        seasonId: activeSeason.id,
        number: parseInt(number, 10),
        deadline: new Date(deadline),
        matchId: matchId ? parseInt(matchId, 10) : null,
      },
    });

    return NextResponse.json({ gameweek }, { status: 201 });
  } catch (error) {
    console.error("[GAMEWEEK_CREATE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
