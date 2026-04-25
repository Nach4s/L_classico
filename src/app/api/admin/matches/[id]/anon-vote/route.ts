import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

    const { playerId, action } = await req.json();

    if (!playerId || !action) {
      return NextResponse.json({ error: "Не указаны данные игрока или действие" }, { status: 400 });
    }

    // Ищем анонимные голоса (у них manager_name = null и специфичный email)
    // чтобы при удалении мы убирали именно фейковые голоса
    
    if (action === "add") {
      const anonUserId = `anon_vote_${matchId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      await db.$transaction(async (tx) => {
        // Создаем пользователя-призрака
        const anonUser = await tx.user.create({
          data: {
            id: anonUserId,
            email: `${anonUserId}@anon.com`,
            passwordHash: "",
            managerName: null, // Игнорируется в лидерборде
            role: "USER"
          }
        });

        // Отдаем голос
        await tx.matchMvpVote.create({
          data: {
            matchId,
            userId: anonUser.id,
            playerId: parseInt(playerId, 10)
          }
        });
      });
      
    } else if (action === "remove") {
      // Ищем все голоса за этого игрока в этом матче
      const votes = await db.matchMvpVote.findMany({
        where: { matchId, playerId: parseInt(playerId, 10) },
        include: { user: true }
      });

      // Ищем среди них фейковый голос (созданный через эту функцию)
      const anonVote = votes.find(v => v.user.email.startsWith(`anon_vote_${matchId}_`));

      if (anonVote) {
        await db.$transaction(async (tx) => {
          await tx.matchMvpVote.delete({
            where: { id: anonVote.id }
          });
          // Удаляем пользователя-призрака
          await tx.user.delete({
            where: { id: anonVote.userId }
          });
        });
      } else {
        return NextResponse.json({ error: "Нет анонимных голосов для удаления. (Нельзя удалить голос реального пользователя)" }, { status: 400 });
      }
    }

    revalidatePath(`/matches/${matchId}`);
    return NextResponse.json({ message: "Успешно" });

  } catch (error) {
    console.error("[ANON_VOTE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
