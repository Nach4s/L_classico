import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await params;
    const gameweekId = parseInt(id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
    }

    const gameweek = await db.gameweek.findUnique({
      where: { id: gameweekId },
      include: {
        squadSnapshots: true,
      },
    });

    if (!gameweek) {
      return NextResponse.json({ error: "Тур не найден" }, { status: 404 });
    }

    if (gameweek.status === "LOCKED") {
      return NextResponse.json({ error: "Тур уже заблокирован" }, { status: 400 });
    }

    // 1. Находим все заполненные составы текущего сезона
    const seasonTeams = await db.fantasyTeam.findMany({
      where: { seasonId: gameweek.seasonId },
      include: { players: true },
    });

    // Фильтруем только те команды, у которых заполнен состав (3 игрока)
    // (Хотя можно фильтровать по FANTASY_MAX_PLAYERS, для гибкости возьмем > 0 или >= 3)
    const validTeams = seasonTeams.filter((team) => team.players.length >= 3);

    if (validTeams.length === 0) {
      return NextResponse.json(
        { error: "Нет заполненных команд в этом сезоне — некого фиксировать." },
        { status: 400 }
      );
    }

    // 2. Формируем данные для снапшотов
    // Проверяем, есть ли уже снапшот для данного пользователя (защита от дублей)
    const existingUserIds = new Set(gameweek.squadSnapshots.map((s) => s.userId));

    const snapshotsData = validTeams
      .filter((team) => !existingUserIds.has(team.userId))
      .map((team) => {
        const captainFtp = team.players.find((p) => p.isCaptain);
        const viceFtp = team.players.find((p) => p.isViceCaptain);
        return {
          gameweekId: gameweek.id,
          userId: team.userId,
          playerIds: team.players.map((p) => p.playerId),
          captainPlayerId: captainFtp?.playerId ?? null,
          viceCaptainPlayerId: viceFtp?.playerId ?? null,
          coachPlayerId: team.coachId ?? null,
          activeChip: team.activeChip ?? null,
          _teamId: team.id, // Временное поле для сброса чипов
        };
      });

    // 3. Выполняем массовое копирование в транзакции
    await db.$transaction(async (tx) => {
      // Создаем недостающие снапшоты
      if (snapshotsData.length > 0) {
        await tx.gameweekSquadSnapshot.createMany({
          data: snapshotsData.map(({ _teamId, ...snap }) => snap),
          skipDuplicates: true,
        });

        // Сбрасываем активные бусты в командах
        const teamIdsWithChip = snapshotsData
          .filter((s) => s.activeChip !== null)
          .map((s) => s._teamId);

        if (teamIdsWithChip.length > 0) {
          await tx.fantasyTeam.updateMany({
            where: { id: { in: teamIdsWithChip } },
            data: { activeChip: null },
          });
        }
      }

      // Меняем статус тура на LOCKED
      await tx.gameweek.update({
        where: { id: gameweek.id },
        data: { status: "LOCKED" },
      });
    });

    revalidatePath("/admin/gameweeks");
    revalidatePath("/fantasy");
    revalidatePath(`/fantasy/squad`);

    return NextResponse.json({
      message: "Тур успешно заблокирован и составы зафиксированы",
      createdSnapshots: snapshotsData.length,
    });
  } catch (error) {
    console.error("[LOCK_GAMEWEEK_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
