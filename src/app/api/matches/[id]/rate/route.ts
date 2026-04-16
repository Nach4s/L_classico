import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/matches/[id]/rate
// Юзер отправляет массив оценок [{ playerId, rating }] для игроков матча.
// Оценки 1.0–10.0. Один юзер — одна итерация за матч.
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

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Для оценки необходима авторизация" }, { status: 401 });
    }

    const body = await req.json();
    const { ratings } = body; // [{ playerId: number, rating: number }]

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json({ error: "Передайте массив оценок [{playerId, rating}]" }, { status: 400 });
    }

    // Validate format
    for (const r of ratings) {
      if (!r.playerId || typeof r.rating !== "number" || r.rating < 1 || r.rating > 10) {
        return NextResponse.json(
          { error: `Некорректная оценка для игрока ${r.playerId}. Допустимо: 1–10.` },
          { status: 400 }
        );
      }
    }

    // Находим матч и его тур (gameweek)
    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    // Проверяем, открыто ли голосование
    if (match.votingClosed) {
      return NextResponse.json({ error: "Голосование закрыто" }, { status: 403 });
    }

    if (match.votingEndsAt && new Date(match.votingEndsAt) < new Date()) {
      return NextResponse.json({ error: "Время для оценки истекло" }, { status: 403 });
    }

    // Находим соответствующий тур через gameweekId на матче
    // Матч может не быть привязан к gameweek — это опционально
    // Используем matchId как ключ в PlayerRatingVote через gameweekId
    // Ищем тур, связанный с этим матчем
    const gameweek = await db.gameweek.findFirst({
      where: { matchId },
    });

    if (!gameweek) {
      return NextResponse.json(
        { error: "Этот матч не привязан к туру. Рейтинг игроков недоступен." },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Проверяем, не голосовал ли уже (берём первый playerId из ratings)
    const existing = await db.playerRatingVote.findFirst({
      where: {
        gameweekId: gameweek.id,
        userId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Вы уже выставили оценки игрокам в этом туре!" },
        { status: 400 }
      );
    }

    // Сохраняем все оценки в транзакции
    await db.$transaction(
      ratings.map((r: { playerId: number; rating: number }) =>
        db.playerRatingVote.create({
          data: {
            gameweekId: gameweek.id,
            playerId: r.playerId,
            userId,
            rating: r.rating.toFixed(1),
          },
        })
      )
    );

    return NextResponse.json({
      message: `Спасибо! Оценки ${ratings.length} игрокам сохранены.`,
    });
  } catch (error) {
    console.error("[MATCH_RATE_POST_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// GET /api/matches/[id]/rate — получить текущие средние оценки
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const gameweek = await db.gameweek.findFirst({ where: { matchId } });

    if (!gameweek) {
      return NextResponse.json({ ratings: [], userHasRated: false });
    }

    // Средние оценки по каждому игроку
    const votes = await db.playerRatingVote.findMany({
      where: { gameweekId: gameweek.id },
      include: { player: { select: { id: true, name: true, team: true, position: true } } },
    });

    // Агрегируем по playerId
    const map = new Map<number, { player: any; sum: number; count: number }>();
    for (const v of votes) {
      const entry = map.get(v.playerId);
      if (entry) {
        entry.sum += Number(v.rating);
        entry.count++;
      } else {
        map.set(v.playerId, { player: v.player, sum: Number(v.rating), count: 1 });
      }
    }

    const ratings = Array.from(map.values()).map(({ player, sum, count }) => ({
      player,
      avgRating: (sum / count).toFixed(1),
      voteCount: count,
    })).sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating));

    const userHasRated = userId
      ? votes.some((v) => v.userId === userId)
      : false;

    return NextResponse.json({ ratings, userHasRated });
  } catch (error) {
    console.error("[MATCH_RATE_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
