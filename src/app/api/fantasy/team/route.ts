import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { FANTASY_BUDGET, FANTASY_MAX_PLAYERS } from "@/lib/constants/fantasy";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;

    // Находим активный сезон
    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json({ error: "Активный сезон не найден" }, { status: 404 });
    }

    // Ищем команду пользователя на текущий сезон
    const team = await db.fantasyTeam.findUnique({
      where: {
        userId_seasonId: {
          userId,
          seasonId: activeSeason.id,
        },
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                position: true,
                team: true,
                price: true,
                slug: true,
              },
            },
          },
        },
        coachId: true,
      },
    });

    // Проверяем, использовал ли юзер Triple Captain в этом сезоне
    const usedTripleChip = await db.gameweekSquadSnapshot.findFirst({
      where: {
        userId,
        activeChip: "triple",
        gameweek: { seasonId: activeSeason.id },
      },
    });

    let coachData = null;
    if (team?.coachId) {
      coachData = await db.player.findUnique({
        where: { id: team.coachId },
        select: {
          id: true,
          name: true,
          position: true,
          team: true,
          price: true,
          slug: true,
          avatarUrl: true,
        }
      });
    }

    const latestGameweek = await db.gameweek.findFirst({
      where: { seasonId: activeSeason.id },
      orderBy: { number: "desc" },
    });

    return NextResponse.json({
      team: {
        ...team,
        coach: coachData,
      },
      usedChips: {
        triple: !!usedTripleChip,
      },
      gameweekStatus: latestGameweek?.status || "SETUP",
    });
  } catch (error) {
    console.error("[FANTASY_TEAM_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { player_ids, captain_id, active_chip, coach_id } = body;

    // 1. Базовая валидация
    if (!Array.isArray(player_ids) || player_ids.length !== FANTASY_MAX_PLAYERS) {
      return NextResponse.json(
        { error: `Команда должна состоять ровно из ${FANTASY_MAX_PLAYERS} игроков.` },
        { status: 400 }
      );
    }

    if (!captain_id || !player_ids.includes(captain_id)) {
      return NextResponse.json(
        { error: "Капитан должен быть выбран из состава команды." },
        { status: 400 }
      );
    }

    const uniquePlayerIds = new Set(player_ids);
    if (uniquePlayerIds.size !== FANTASY_MAX_PLAYERS) {
      return NextResponse.json(
        { error: "Игроки в команде не должны повторяться." },
        { status: 400 }
      );
    }

    // Валидация буста
    const validChips = [null, undefined, "triple"];
    if (active_chip !== undefined && active_chip !== null && !validChips.includes(active_chip)) {
      return NextResponse.json({ error: "Неизвестный тип буста." }, { status: 400 });
    }

    // Находим активный сезон
    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json({ error: "Активный сезон не найден" }, { status: 404 });
    }

    const latestGameweek = await db.gameweek.findFirst({
      where: { seasonId: activeSeason.id },
      orderBy: { number: "desc" },
    });

    if (latestGameweek) {
      if (latestGameweek.status !== "SETUP") {
        return NextResponse.json(
          { error: "Тур заблокирован. Изменения вступят в силу со следующего тура." },
          { status: 400 }
        );
      }
      if (new Date() > new Date(latestGameweek.deadline)) {
        return NextResponse.json(
          { error: "Дедлайн тура уже прошел. Изменения не сохранены." },
          { status: 400 }
        );
      }
    }

    // Проверяем, не использован ли уже буст в этом сезоне
    if (active_chip === "triple") {
      const alreadyUsed = await db.gameweekSquadSnapshot.findFirst({
        where: {
          userId,
          activeChip: "triple",
          gameweek: { seasonId: activeSeason.id },
        },
      });
      if (alreadyUsed) {
        return NextResponse.json(
          { error: "Буст «Тройной Капитан» уже был использован в этом сезоне!" },
          { status: 400 }
        );
      }
    }

    // 2. Получаем данные игроков из БД
    const playersIdsToCheck = [...player_ids];
    if (coach_id) playersIdsToCheck.push(coach_id);

    const playersInDb = await db.player.findMany({
      where: {
        id: { in: playersIdsToCheck },
        isActive: true,
      },
    });

    const mainPlayersInDb = playersInDb.filter(p => player_ids.includes(p.id));
    
    if (mainPlayersInDb.length !== FANTASY_MAX_PLAYERS) {
      return NextResponse.json(
        { error: "Один или несколько игроков (основы) не найдены или неактивны." },
        { status: 400 }
      );
    }

    if (coach_id) {
      const coachInDb = playersInDb.find(p => p.id === coach_id);
      if (!coachInDb) {
        return NextResponse.json({ error: "Указанный тренер не найден или неактивен." }, { status: 400 });
      }
      if (coachInDb.position !== "COACH") {
        return NextResponse.json({ error: "Выбранный тренер имеет неверную позицию." }, { status: 400 });
      }
    }

    // 3. Проверяем бюджет
    const totalCost = mainPlayersInDb.reduce((sum, p) => sum + Number(p.price), 0);
    if (totalCost > FANTASY_BUDGET) {
      return NextResponse.json(
        { error: `Превышен бюджет! Сумма: ${totalCost.toFixed(1)}M, Лимит: ${FANTASY_BUDGET}M.` },
        { status: 400 }
      );
    }

    const remainingBudget = FANTASY_BUDGET - totalCost;

    // 4. Сохраняем команду в транзакции
    await db.$transaction(async (tx) => {
      const team = await tx.fantasyTeam.upsert({
        where: {
          userId_seasonId: {
            userId,
            seasonId: activeSeason.id,
          },
        },
        create: {
          userId,
          seasonId: activeSeason.id,
          remainingBudget: remainingBudget,
          activeChip: active_chip || null,
          coachId: coach_id || null,
        },
        update: {
          remainingBudget: remainingBudget,
          activeChip: active_chip || null,
          coachId: coach_id || null,
        },
      });

      // Удаляем старых игроков команды
      await tx.fantasyTeamPlayer.deleteMany({
        where: { fantasyTeamId: team.id },
      });

      // Добавляем новых игроков
      const teamPlayersData = player_ids.map((id) => ({
        fantasyTeamId: team.id,
        playerId: id,
        isCaptain: id === captain_id,
        isViceCaptain: false,
      }));

      await tx.fantasyTeamPlayer.createMany({
        data: teamPlayersData,
      });
    });

    return NextResponse.json(
      {
        message: active_chip === "triple"
          ? "Команда сохранена! Буст «Тройной Капитан» будет активирован на следующий тур. 🚀"
          : "Команда успешно сохранена!",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[FANTASY_TEAM_POST_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
