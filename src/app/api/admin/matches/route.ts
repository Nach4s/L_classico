import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json({ matches: [] });
    }

    const matches = await db.match.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        goals: { include: { scorer: true, assist: true } },
        gameweeks: { select: { id: true, number: true, status: true } },
      },
      orderBy: { matchDate: "desc" },
    });

    return NextResponse.json({ matches, season: activeSeason });
  } catch (error) {
    console.error("[ADMIN_MATCHES_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team1, team2, score1, score2, match_date } = body;

    // Валидация входных данных
    if (!team1 || !team2 || score1 === undefined || score2 === undefined || !match_date) {
      return NextResponse.json(
        { error: "Пожалуйста, заполните все обязательные поля." },
        { status: 400 }
      );
    }

    // Ищем текущий активный сезон
    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json(
        { error: "Активный сезон не найден. Сначала создайте сезон." },
        { status: 404 }
      );
    }

    // Создаем матч и привязываем к активному сезону
    const match = await db.match.create({
      data: {
        seasonId: activeSeason.id,
        team1,
        team2,
        score1: parseInt(score1, 10),
        score2: parseInt(score2, 10),
        matchDate: new Date(match_date),
      },
    });

    return NextResponse.json(
      { message: "Матч успешно создан!", match },
      { status: 201 }
    );
  } catch (error) {
    console.error("[MATCH_CREATE_ERROR]", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
