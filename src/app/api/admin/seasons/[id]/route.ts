import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/admin/seasons/[id] — архивировать сезон или переименовать
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const seasonId = parseInt(id, 10);

    if (isNaN(seasonId)) {
      return NextResponse.json({ error: "Некорректный ID сезона" }, { status: 400 });
    }

    const body = await req.json();
    const { isArchived, name } = body;

    const existing = await db.season.findUnique({ where: { id: seasonId } });
    if (!existing) {
      return NextResponse.json({ error: "Сезон не найден" }, { status: 404 });
    }

    const updateData: any = {};
    if (isArchived !== undefined) updateData.isArchived = Boolean(isArchived);
    if (name !== undefined && name.trim().length > 0) updateData.name = name.trim();

    const season = await db.season.update({
      where: { id: seasonId },
      data: updateData,
    });

    return NextResponse.json({ season });
  } catch (error) {
    console.error("[ADMIN_SEASON_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
