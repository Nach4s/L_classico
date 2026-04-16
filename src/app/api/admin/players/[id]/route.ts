import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/admin/players/[id] — обновить игрока
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Некорректный ID игрока" }, { status: 400 });
    }

    const body = await req.json();
    const { name, position, team, price, isActive, avatarUrl } = body;

    const existing = await db.player.findUnique({ where: { id: playerId } });
    if (!existing) {
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (position !== undefined) updateData.position = position;
    if (team !== undefined) updateData.team = team;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl ? avatarUrl.trim() : null;

    const player = await db.player.update({
      where: { id: playerId },
      data: updateData,
    });

    return NextResponse.json({ player });
  } catch (error) {
    console.error("[ADMIN_PLAYER_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/admin/players/[id] — деактивировать игрока (soft delete)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Некорректный ID игрока" }, { status: 400 });
    }

    // Soft delete — просто деактивируем, не удаляем (другие зависимые записи сохранятся)
    const player = await db.player.update({
      where: { id: playerId },
      data: { isActive: false },
    });

    return NextResponse.json({ player, message: "Игрок деактивирован" });
  } catch (error) {
    console.error("[ADMIN_PLAYER_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
