import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────
// GET /api/admin/matches/[id]
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

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        season: { select: { id: true, name: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    return NextResponse.json({ match });
  } catch (error) {
    console.error("[MATCH_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// ─────────────────────────────────────
// PATCH /api/admin/matches/[id]
// Update match score and/or date
// ─────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.score1 !== undefined) updateData.score1 = parseInt(body.score1, 10);
    if (body.score2 !== undefined) updateData.score2 = parseInt(body.score2, 10);
    if (body.match_date) updateData.matchDate = new Date(body.match_date);
    if (body.backgroundUrl !== undefined) updateData.backgroundUrl = body.backgroundUrl;

    const match = await db.match.update({
      where: { id: matchId },
      data: updateData,
    });

    // Invalidate public match page cache so background/score updates appear immediately
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/matches");

    return NextResponse.json({ match });
  } catch (error) {
    console.error("[MATCH_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// ─────────────────────────────────────
// DELETE /api/admin/matches/[id]
// ─────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
    }

    // Cascade deletes goals automatically (onDelete: Cascade in schema)
    await db.match.delete({ where: { id: matchId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MATCH_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
