import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─────────────────────────────────────
// GET /api/players
// Returns all active players, ordered by team then name
// ─────────────────────────────────────
export async function GET() {
  try {
    const players = await db.player.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        position: true,
        team: true,
        slug: true,
        price: true,
        avatarUrl: true,
      },
      orderBy: [{ team: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ players });
  } catch (error) {
    console.error("[PLAYERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
