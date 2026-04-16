import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { calculatePlayerPoints } from "@/lib/points-engine";
import Link from "next/link";
import { ManagerNameForm } from "./ManagerNameForm";

export default async function ManagerProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/auth/login");
  }

  const userId = session.user.id;

  // 1. Получаем активный сезон
  const activeSeason = await db.season.findFirst({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  if (!activeSeason) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400">
        Нет активного сезона.
      </div>
    );
  }

  // 2. Параллельная загрузка всех связанных данных (Team, Gameweeks, MVP Stats, Snapshots, Players)
  const [fantasyTeam, gameweeks, playerStatsDb, snapshots, allPlayers] = await Promise.all([
    db.fantasyTeam.findUnique({
      where: { userId_seasonId: { userId, seasonId: activeSeason.id } },
      include: {
        players: { include: { player: true } },
      },
    }),
    db.gameweek.findMany({
      where: { seasonId: activeSeason.id },
      include: { match: { include: { goals: true } } },
      orderBy: { number: "asc" },
    }),
    db.gameweekPlayerStat.findMany({
      where: { gameweek: { seasonId: activeSeason.id }, isMvp: true },
    }),
    db.gameweekSquadSnapshot.findMany({
      where: { userId, gameweek: { seasonId: activeSeason.id } },
      include: { gameweek: true },
      orderBy: { gameweek: { number: "desc" } },
    }),
    db.player.findMany(),
  ]);

  // 3. Вычисляем исторические очки по турам
  const statsMap = new Map<number, Map<number, { goals: number; assists: number; isMvp: boolean }>>();

  gameweeks.forEach((gw) => {
    const gwMap = new Map<number, { goals: number; assists: number; isMvp: boolean }>();
    if (gw.match && gw.match.goals) {
      gw.match.goals.forEach((g) => {
        const scorer = gwMap.get(g.scorerPlayerId) || { goals: 0, assists: 0, isMvp: false };
        scorer.goals += 1;
        gwMap.set(g.scorerPlayerId, scorer);

        if (g.assistPlayerId) {
          const assist = gwMap.get(g.assistPlayerId) || { goals: 0, assists: 0, isMvp: false };
          assist.assists += 1;
          gwMap.set(g.assistPlayerId, assist);
        }
      });
    }

    // Подшиваем MVP
    playerStatsDb
      .filter((ps) => ps.gameweekId === gw.id && ps.isMvp)
      .forEach((ps) => {
        const p = gwMap.get(ps.playerId) || { goals: 0, assists: 0, isMvp: false };
        p.isMvp = true;
        gwMap.set(ps.playerId, p);
      });

    statsMap.set(gw.id, gwMap);
  });

  // Подготовка словаря игроков для быстрого доступа
  const playerMap = new Map<number, any>();
  allPlayers.forEach((p) => playerMap.set(p.id, p));

  let totalPoints = 0;
  const history = snapshots.map((snap) => {
    const gwMap = statsMap.get(snap.gameweekId);
    let gwPoints = 0;

    const playerIds: number[] = Array.isArray(snap.playerIds) ? (snap.playerIds as number[]) : [];
    const captainId: number | null = snap.captainPlayerId as number | null;

    const detailedPlayers = playerIds.map((pId) => {
      const isCap = pId === captainId;
      const pDetails = playerMap.get(pId);
      const gwStat = gwMap?.get(pId) || { goals: 0, assists: 0, isMvp: false };
      const pPosition = pDetails?.position || "FWD";
      let playerPoints = calculatePlayerPoints({ goals: gwStat.goals, assists: gwStat.assists, is_mvp: gwStat.isMvp, position: pPosition }).totalPoints;
      if (isCap) playerPoints *= 2;

      gwPoints += playerPoints;

      return {
        id: pId,
        name: pDetails?.name || `Игрок #${pId}`,
        points: playerPoints,
        isCaptain: isCap,
      };
    });

    // COACH Points in history
    let coachInfo = null;
    if (snap.coachPlayerId) {
      const coachDetails = playerMap.get(snap.coachPlayerId);
      coachInfo = {
        id: snap.coachPlayerId,
        name: coachDetails?.name || "Тренер",
        points: snap.coachPoints || 0,
        team: coachDetails?.team || ""
      };
      gwPoints += snap.coachPoints || 0;
    }

    totalPoints += gwPoints;

    return {
      gameweekNumber: snap.gameweek.number,
      lockedAt: snap.lockedAt,
      points: gwPoints,
      players: detailedPlayers,
      coach: coachInfo
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-emerald-400 transition-colors">Главная</Link>
          <span>/</span>
          <span className="text-slate-300">Личный кабинет</span>
        </div>

        {/* Шапка профиля */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center md:items-start justify-between gap-6 shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-sky-500"></div>
          
          <div className="flex items-center gap-6 z-10 w-full md:w-auto flex-col md:flex-row text-center md:text-left">
             <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-600 flex flex-shrink-0 items-center justify-center text-4xl shadow-inner shadow-slate-950">
               👔
             </div>
             <div>
               <h1 className="text-3xl font-black text-white mb-1 tracking-tight">
                 {session.user.managerName || session.user.email?.split("@")[0]}
               </h1>
               <div className="flex items-center gap-3 mb-3">
                 <div className="text-sm font-medium text-slate-400">
                   Менеджер L Clásico Fantasy
                 </div>
                 {session.user.role === "ADMIN" && (
                   <Link
                     href="/admin"
                     className="text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-lg hover:bg-amber-500/20 transition-colors"
                   >
                     ★ Админ-панель
                   </Link>
                 )}
               </div>
               <ManagerNameForm currentName={session.user.managerName || ""} />
             </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl text-center z-10 min-w-[140px]">
            <span className="block text-xs uppercase tracking-wider text-emerald-500 font-bold mb-1">Сумма очков</span>
            <span className="text-4xl font-black text-emerald-400">{totalPoints}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* Левая колонка: История Туров */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-sky-400">📈</span> История по турам
            </h2>

            {history.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm">
                Вы еще не участвовали ни в одном туре.
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((h) => (
                  <div key={h.gameweekNumber} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-black text-white text-lg">Тур {h.gameweekNumber}</span>
                      <span className="bg-emerald-500/10 text-emerald-400 font-bold px-3 py-1 rounded-lg">
                        {h.points} pts
                      </span>
                    </div>
                    
                    {/* Краткий перечень игроков состава */}
                    <div className="text-xs text-slate-400 flex flex-wrap gap-1.5">
                      {h.players.map(p => (
                        <div key={p.id} className="bg-slate-950 border border-slate-800 px-2 py-1 rounded flex items-center gap-1">
                          <Link href={`/players/${p.id}`} className="hover:text-emerald-400 hover:underline">
                            {p.name}
                          </Link>
                          {p.isCaptain && <span className="text-[9px] text-amber-500 font-bold">(C)</span>}
                          <span className={p.points > 0 ? "text-emerald-400 font-bold ml-1" : "text-slate-500 ml-1"}>
                            {p.points}
                          </span>
                        </div>
                      ))}
                      {h.coach && (
                        <div className="bg-purple-900/10 border border-purple-500/20 px-2 py-1 rounded flex items-center gap-1">
                          <span className="text-[9px] text-purple-400 uppercase font-bold">👔</span>
                          <span className="text-slate-200">{h.coach.name}</span>
                          <span className={h.coach.points > 0 ? "text-emerald-400 font-bold ml-1" : h.coach.points < 0 ? "text-red-400 font-bold ml-1" : "text-slate-500 ml-1"}>
                            {h.coach.points > 0 ? `+${h.coach.points}` : h.coach.points}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Правая колонка: Текущий состав */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-500">🛡️</span> Ваш текущий состав
            </h2>

            {(!fantasyTeam || fantasyTeam.players.length === 0) ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center">
                 <span className="text-3xl mb-3">🎮</span>
                 <p className="text-slate-400 text-sm mb-4">Вы еще не собрали команду.</p>
                 <Link href="/fantasy" className="btn-primary py-2.5 px-6 text-sm">В Fantasy</Link>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2">
                {fantasyTeam.players.map((ftp) => (
                  <div key={ftp.playerId} className="flex items-center justify-between p-3 border-b border-slate-800/50 last:border-0 rounded-xl hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700 overflow-hidden">
                        {ftp.player.avatarUrl ? (
                          <img src={ftp.player.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          ftp.player.position
                        )}
                      </div>
                      <div>
                        <Link href={`/players/${ftp.player.id}`} className="font-bold text-white text-sm block hover:text-emerald-400 hover:underline">
                          {ftp.player.name}
                        </Link>
                        <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1.5 mt-0.5">
                          <span>{ftp.player.team === "1 группа" ? "Гр 1" : "Гр 2"}</span>
                          {ftp.isCaptain && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                              <span className="text-amber-500 font-bold tracking-wider text-[9px] bg-amber-500/10 px-1 py-0.5 rounded">Капитан</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-emerald-400 font-mono font-bold text-sm">
                      {ftp.player.price.toString()}M
                    </div>
                  </div>
                ))}
                
                {/* Coach in Current Squad */}
                {fantasyTeam.coachId && (
                  <div className="mt-2 mx-1 p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-900/20 flex items-center justify-center text-[10px] font-bold text-purple-400 border border-purple-500/30">
                        👔
                      </div>
                      <div>
                        {(() => {
                          const c = playerMap.get(fantasyTeam.coachId!);
                          return (
                            <>
                              <div className="font-bold text-white text-sm">{c?.name || "Тренер"}</div>
                              <div className="text-[9px] text-purple-400/80 uppercase tracking-wider">{c?.team}</div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20 font-bold whitespace-nowrap">
                      ±3 PTS
                    </div>
                  </div>
                )}
                
                <div className="p-3 mt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Остаток бюджета</span>
                  <span className="text-sm font-mono font-bold text-white">{fantasyTeam.remainingBudget.toString()}M</span>
                </div>
                <div className="p-2">
                  <Link href="/fantasy" className="block w-full text-center py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 hover:text-white rounded-lg transition-colors">
                    Редактировать состав
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
