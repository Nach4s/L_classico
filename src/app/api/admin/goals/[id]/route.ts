import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const goalId = parseInt(params.id, 10);
    if (isNaN(goalId)) {
      return NextResponse.json({ error: "Неверный ID гола" }, { status: 400 });
    }

    await db.goal.delete({
      where: { id: goalId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[GOAL_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
