import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─────────────────────────────────────
// GET /api/admin/matches/[id]/goals
// ─────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);

    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });
    }

    const goals = await db.goal.findMany({
      where: { matchId },
      include: {
        scorer: { select: { id: true, name: true, team: true } },
        assist: { select: { id: true, name: true, team: true } },
      },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ goals });
  } catch (error) {
    console.error("[GOALS_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// ─────────────────────────────────────
// POST /api/admin/matches/[id]/goals
// Body: { scorer_player_id, assist_player_id?, team, is_own_goal? }
// For own goals: team = opposing team (credited to), assist = null, is_own_goal = true
// ─────────────────────────────────────
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

    const body = await req.json();
    const { scorer_player_id, assist_player_id, team, is_own_goal } = body;

    if (!scorer_player_id || !team) {
      return NextResponse.json(
        { error: "Обязательные поля: scorer_player_id, team" },
        { status: 400 }
      );
    }

    if (team !== "1 группа" && team !== "2 группа") {
      return NextResponse.json(
        { error: 'Поле team должно быть "1 группа" или "2 группа"' },
        { status: 400 }
      );
    }

    // Verify match exists
    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    const isOwnGoal = !!is_own_goal;

    const goal = await db.goal.create({
      data: {
        matchId,
        scorerPlayerId: parseInt(scorer_player_id, 10),
        // Own goals have no assist
        assistPlayerId: isOwnGoal ? null : (assist_player_id ? parseInt(assist_player_id, 10) : null),
        team,
        isOwnGoal,
      },
      include: {
        scorer: { select: { id: true, name: true, team: true } },
        assist: { select: { id: true, name: true, team: true } },
      },
    });

    return NextResponse.json({ message: "Гол добавлен!", goal }, { status: 201 });
  } catch (error) {
    console.error("[GOAL_CREATE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// ─────────────────────────────────────
// DELETE /api/admin/matches/[id]/goals
// Body: { goal_id }
// ─────────────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID матча" }, { status: 400 });
    }

    const body = await req.json();
    const goalId = parseInt(body.goal_id, 10);
    if (isNaN(goalId)) {
      return NextResponse.json({ error: "Некорректный ID гола" }, { status: 400 });
    }

    await db.goal.delete({ where: { id: goalId, matchId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[GOAL_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
