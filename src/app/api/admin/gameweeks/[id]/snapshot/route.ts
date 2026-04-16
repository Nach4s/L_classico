import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/gameweeks/[id]/snapshot
// Фиксирует составы: берёт текущие FantasyTeam и сохраняет в GameweekSquadSnapshot.
// Копирует activeChip из команды в снапшот, затем очищает activeChip у команды.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameweekId = parseInt(id, 10);

    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: "Некорректный ID тура" }, { status: 400 });
    }

    // Проверяем существование тура
    const gameweek = await db.gameweek.findUnique({
      where: { id: gameweekId },
      include: { squadSnapshots: true },
    });

    if (!gameweek) {
      return NextResponse.json({ error: "Тур не найден" }, { status: 404 });
    }

    // Защита от повторной генерации
    if (gameweek.squadSnapshots.length > 0) {
      return NextResponse.json(
        { error: "Составы для этого тура уже зафиксированы!" },
        { status: 400 }
      );
    }

    // Вытягиваем ВСЕ команды сезона с их активными чипами
    const seasonTeams = await db.fantasyTeam.findMany({
      where: { seasonId: gameweek.seasonId },
      include: {
        players: true, // FantasyTeamPlayer
      },
    });

    if (seasonTeams.length === 0) {
      return NextResponse.json(
        { error: "В этом сезоне пока нет созданных команд" },
        { status: 400 }
      );
    }

    // Собираем данные снапшотов
    const snapshotsData = seasonTeams.map((team) => {
      const playerIds = team.players.map((ftp) => ftp.playerId);
      const captainFtp = team.players.find((ftp) => ftp.isCaptain);
      const viceCaptainFtp = team.players.find((ftp) => ftp.isViceCaptain);

      return {
        gameweekId: gameweek.id,
        userId: team.userId,
        playerIds,
        captainPlayerId: captainFtp ? captainFtp.playerId : null,
        viceCaptainPlayerId: viceCaptainFtp ? viceCaptainFtp.playerId : null,
        coachPlayerId: team.coachId ?? null,
        // Копируем activeChip из команды в снапшот
        activeChip: team.activeChip ?? null,
        _teamId: team.id, // для очистки после создания (не идёт в БД)
      };
    });

    await db.$transaction(async (tx) => {
      // 1. Создаём снапшоты (без _teamId — это внутреннее поле)
      await tx.gameweekSquadSnapshot.createMany({
        data: snapshotsData.map(({ _teamId, ...snap }) => snap),
      });

      // 2. Очищаем activeChip у всех команд, чьи чипы были активированы
      const teamIdsWithChip = snapshotsData
        .filter((s) => s.activeChip !== null)
        .map((s) => s._teamId);

      if (teamIdsWithChip.length > 0) {
        await tx.fantasyTeam.updateMany({
          where: { id: { in: teamIdsWithChip } },
          data: { activeChip: null },
        });
      }

      // 3. Меняем статус тура
      await tx.gameweek.update({
        where: { id: gameweek.id },
        data: { status: "STATS_ENTRY" },
      });
    });

    const tripleCaptains = snapshotsData.filter((s) => s.activeChip === "triple").length;

    return NextResponse.json({
      message: `Зафиксировано ${snapshotsData.length} составов для тура №${gameweek.number}${
        tripleCaptains > 0 ? `. Активировано бустов «Тройной Капитан»: ${tripleCaptains}` : ""
      }`,
    }, { status: 200 });

  } catch (error) {
    console.error("[SNAPSHOT_CREATE_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
