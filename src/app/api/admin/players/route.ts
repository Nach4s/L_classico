import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Valid positions for API checking
const VALID_POSITIONS = ["GK", "DEF", "MID", "FWD", "COACH"];

// GET /api/admin/players — список всех игроков
export async function GET() {
  try {
    const players = await db.player.findMany({
      orderBy: [{ team: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ players });
  } catch (error) {
    console.error("[ADMIN_PLAYERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/admin/players — создать игрока
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, slug, position, team, price, avatarUrl } = body;

    if (!name || !slug || !position || !team || price === undefined) {
      return NextResponse.json(
        { error: "Поля name, slug, position, team, price обязательны" },
        { status: 400 }
      );
    }

    if (!VALID_POSITIONS.includes(position)) {
      return NextResponse.json({ error: "Позиция должна быть: GK, DEF, MID, FWD или COACH" }, { status: 400 });
    }

    const validTeams = ["1 группа", "2 группа"];
    if (!validTeams.includes(team)) {
      return NextResponse.json({ error: "Команда должна быть: '1 группа' или '2 группа'" }, { status: 400 });
    }

    // Проверяем уникальность slug
    const existing = await db.player.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `Игрок с slug "${slug}" уже существует` }, { status: 400 });
    }

    const player = await db.player.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        position,
        team,
        price: parseFloat(price),
        avatarUrl: avatarUrl ? avatarUrl.trim() : null,
        isActive: true,
      },
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_PLAYERS_POST_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
