import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/matches/[id]/vote
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });
    }

    // Получаем кандидатов (всех игроков, участвовавших в матче)
    // Участвовали = забивали или ассистировали. 
    // Если этого мало, можно просто выдать всех активных игроков двух команд.
    const match = await db.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    // Вытягиваем всех активных игроков этих двух команд
    const rawCandidates = await db.player.findMany({
      where: {
        isActive: true,
        team: { in: [match.team1, match.team2] },
        position: { not: "COACH" }
      },
      select: { id: true, name: true, position: true, team: true },
    });

    const goalsList = await db.goal.findMany({
       where: { matchId }
    });

    const candidates = rawCandidates.map(c => {
       const goalsCount = goalsList.filter(g => g.scorerPlayerId === c.id && !g.isOwnGoal).length;
       const assistsCount = goalsList.filter(g => g.assistPlayerId === c.id).length;
       return { ...c, goals: goalsCount, assists: assistsCount };
    });

    // Получаем все голоса
    const votes = await db.matchMvpVote.findMany({
      where: { matchId },
    });

    // Агрегируем
    const results = candidates.map(c => {
       const count = votes.filter(v => v.playerId === c.id).length;
       return { ...c, votes: count };
    });

    // Находим голос текущего пользователя
    const userVote = userId ? votes.find(v => v.userId === userId)?.playerId || null : null;

    return NextResponse.json({
      candidates,
      results: results.sort((a, b) => b.votes - a.votes),
      userVote,
      votingEndsAt: match.votingEndsAt,
      votingClosed: match.votingClosed
    }, { status: 200 });

  } catch (error) {
    console.error("[MATCH_VOTE_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/matches/[id]/vote
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    
    if (isNaN(matchId)) return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Для голосования необходима авторизация" }, { status: 401 });
    }

    const body = await req.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json({ error: "Выберите игрока" }, { status: 400 });
    }

    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) return NextResponse.json({ error: "Матч не найден" }, { status: 404 });

    // Проверяем сроки
    if (match.votingClosed) {
      return NextResponse.json({ error: "Голосование официально закрыто" }, { status: 403 });
    }

    if (match.votingEndsAt && new Date(match.votingEndsAt) < new Date()) {
      return NextResponse.json({ error: "Время для голосования истекло" }, { status: 403 });
    }

    // Проверяем, не голосовал ли уже этот юзер
    const existing = await db.matchMvpVote.findUnique({
      where: {
        matchId_userId: {
          matchId: match.id,
          userId: session.user.id
        }
      }
    });

    if (existing) {
       return NextResponse.json({ error: "Вы уже отдали свой голос в этом матче!" }, { status: 400 });
    }

    // Создаем голос
    await db.matchMvpVote.create({
      data: {
        matchId: match.id,
        userId: session.user.id,
        playerId: parseInt(playerId, 10)
      }
    });

    return NextResponse.json({ message: "Голос успешно учтен" }, { status: 200 });
  } catch (error) {
    console.error("[MATCH_VOTE_POST_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
