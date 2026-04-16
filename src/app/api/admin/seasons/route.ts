import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/seasons — список сезонов
export async function GET() {
  try {
    const seasons = await db.season.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { matches: true, gameweeks: true, fantasyTeams: true },
        },
      },
    });
    return NextResponse.json({ seasons });
  } catch (error) {
    console.error("[ADMIN_SEASONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// POST /api/admin/seasons — создать новый сезон
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Название сезона обязательно" }, { status: 400 });
    }

    const season = await db.season.create({
      data: {
        name: name.trim(),
        isArchived: false,
      },
    });

    return NextResponse.json({ season }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_SEASONS_POST_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
