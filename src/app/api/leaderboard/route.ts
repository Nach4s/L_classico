import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculatePlayerPoints } from "@/lib/points-engine";

export async function GET() {
  try {
    // 1. Находим текущий активный сезон
    const activeSeason = await db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSeason) {
      return NextResponse.json({ error: "Активный сезон не найден" }, { status: 404 });
    }

    // 2. Получаем все туры (Gameweek) и матчи, привязанные к ним
    const gameweeks = await db.gameweek.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        match: {
          include: { goals: true } // вытягиваем голы
        }
      }
    });

    // 3. Создаем словарь голов: statsMap[gameweekId][playerId] = { goals, assists }
    const statsMap = new Map<number, Map<number, { goals: number; assists: number }>>();

    gameweeks.forEach((gw) => {
      const gwMap = new Map<number, { goals: number; assists: number }>();
      
      // Если к туру привязан матч и там есть голы
      if (gw.match && gw.match.goals) {
        gw.match.goals.forEach((g) => {
          // Авторы голов
          const scorer = gwMap.get(g.scorerPlayerId) || { goals: 0, assists: 0 };
          scorer.goals += 1;
          gwMap.set(g.scorerPlayerId, scorer);

          // Ассистенты
          if (g.assistPlayerId) {
            const assist = gwMap.get(g.assistPlayerId) || { goals: 0, assists: 0 };
            assist.assists += 1;
            gwMap.set(g.assistPlayerId, assist);
          }
        });
      }
      statsMap.set(gw.id, gwMap);
    });

    // 4. Достаем все Фэнтези команды
    const teams = await db.fantasyTeam.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        user: { select: { id: true, managerName: true, email: true } },
      },
    });

    // Достаем все снапшоты (зафиксированные туры)
    const snapshots = await db.gameweekSquadSnapshot.findMany({
      where: { gameweek: { seasonId: activeSeason.id } },
    });

    // Достаем всех MVP игроков в турах текущего сезона
    const playerStats = await db.gameweekPlayerStat.findMany({
      where: {
        gameweek: { seasonId: activeSeason.id },
        isMvp: true
      }
    });

    const isPlayerMvp = (gameweekId: number, playerId: number) => {
      return playerStats.some(ps => ps.gameweekId === gameweekId && ps.playerId === playerId && ps.isMvp);
    };

    // Достаем всех игроков для словаря (чтобы брать имя и позицию)
    const allPlayers = await db.player.findMany();
    const playerMap = new Map<number, any>();
    allPlayers.forEach(p => playerMap.set(p.id, p));

    // 5. РАСЧЕТ ИСТОРИЧЕСКИХ ОЧКОВ
    const leaderboard = teams.map((team) => {
      // Ищем все снапшоты конкретного юзера
      const userSnapshots = snapshots.filter((s) => s.userId === team.userId);
      
      let overallTotalPoints = 0;
      // Сохраняем агрегированную стату игрока специально для UI
      const playersDetailedMap = new Map<number, any>();

      userSnapshots.forEach((snap) => {
        const gwMap = statsMap.get(snap.gameweekId);
        if (!gwMap) return; // Нет матча в туре - очки не идут

        // Для каждого игрока в зафиксированном составе
        snap.playerIds.forEach((playerId) => {
          const pStats = gwMap.get(playerId) || { goals: 0, assists: 0 };
          const pDetails = playerMap.get(playerId);
          
          if (!pDetails) return;

          // Рассчитываем очки для этого игрока ИМЕННО В ЭТОМ ТУРЕ
          const ptsSplit = calculatePlayerPoints({
            goals: pStats.goals,
            assists: pStats.assists,
            position: pDetails.position,
            is_mvp: isPlayerMvp(snap.gameweekId, playerId), 
          });

          let ptsForGameweek = ptsSplit.totalPoints;
          
          // Капитанское удвоение
          const isCap = snap.captainPlayerId === playerId;
          if (isCap) {
            ptsForGameweek *= 2;
          }

          overallTotalPoints += ptsForGameweek;

          // Складываем в историю игроков, чтобы отобразить на фронте
          const existing = playersDetailedMap.get(playerId) || {
             id: playerId,
             name: pDetails.name,
             isCaptain: false,
             points: 0,
             stats: { goals: 0, assists: 0 }
          };

          existing.points += ptsForGameweek;
          existing.stats.goals += pStats.goals;
          existing.stats.assists += pStats.assists;
          if (isCap) existing.isCaptain = true; // Если он хоть раз был кэпом и принес очки, ставим флаг для красоты

          playersDetailedMap.set(playerId, existing);
        });
      });

      // Переводим Map в массив и сортируем по полезности (кто принес юзеру больше всего очков)
      const topPlayers = Array.from(playersDetailedMap.values()).sort((a, b) => b.points - a.points);

      return {
        manager_name: team.user.managerName || team.user.email.split("@")[0],
        totalPoints: overallTotalPoints,
        players: topPlayers, // Отдаем исторически полезных игроков
      };
    });

    // 6. Сортируем лидеров по убыванию очков
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ leaderboard }, { status: 200 });
  } catch (error) {
    console.error("[LEADERBOARD_GET_ERROR]", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
