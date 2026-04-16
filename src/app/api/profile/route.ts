import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/profile — обновить данные профиля менеджера
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await req.json();
    const { managerName } = body;

    if (!managerName || managerName.trim().length < 2) {
      return NextResponse.json(
        { error: "Имя менеджера должно содержать минимум 2 символа" },
        { status: 400 }
      );
    }

    if (managerName.trim().length > 30) {
      return NextResponse.json(
        { error: "Имя менеджера не должно превышать 30 символов" },
        { status: 400 }
      );
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: { managerName: managerName.trim() },
      select: { id: true, email: true, managerName: true },
    });

    return NextResponse.json({ user, message: "Профиль обновлен" });
  } catch (error) {
    console.error("[PROFILE_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
