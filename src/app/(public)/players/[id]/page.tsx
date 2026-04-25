import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MatchHistoryEntry {
  matchId: number;
  matchDate: Date;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  gameweekNumber: number | null;
  goals: number;
  assists: number;
  isMvp: boolean;
  points: number;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id, 10);

  if (isNaN(playerId)) return notFound();

  const [player, activeSeason] = await Promise.all([
    db.player.findUnique({
      where: { id: playerId },
    }),
    db.season.findFirst({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!player) return notFound();

  let history: MatchHistoryEntry[] = [];
  let totalPoints = 0;
  let totalGoals = 0;
  let totalAssists = 0;

  if (activeSeason) {
    // 1. Параллельный запрос всех голов, ассистов и статистики (GameweekPlayerStat)
    const [goalsScored, goalsAssisted, playerStats] = await Promise.all([
      db.goal.findMany({
        where: { scorerPlayerId: playerId, match: { seasonId: activeSeason.id } },
        include: { match: { include: { gameweeks: true } } },
      }),
      db.goal.findMany({
        where: { assistPlayerId: playerId, match: { seasonId: activeSeason.id } },
        include: { match: { include: { gameweeks: true } } },
      }),
      db.gameweekPlayerStat.findMany({
        where: { playerId, gameweek: { seasonId: activeSeason.id } },
        include: { gameweek: { include: { match: true } } },
      })
    ]);

    // 2. Группируем действия по матчам
    const matchMap = new Map<number, MatchHistoryEntry>();

    const getOrCreateMatchEntry = (match: any): MatchHistoryEntry => {
      if (!match) throw new Error("Match missing"); // Guard
      let entry = matchMap.get(match.id);
      if (!entry) {
        entry = {
          matchId: match.id,
          matchDate: match.matchDate,
          team1: match.team1,
          team2: match.team2,
          score1: match.score1,
          score2: match.score2,
          gameweekNumber: match.gameweeks?.[0]?.number || null,
          goals: 0,
          assists: 0,
          isMvp: false,
          points: 0,
        };
        matchMap.set(match.id, entry);
      }
      return entry;
    };

    goalsScored.forEach((g) => {
      const entry = getOrCreateMatchEntry(g.match);
      entry.goals += 1;
      totalGoals += 1;
    });

    goalsAssisted.forEach((g) => {
      const entry = getOrCreateMatchEntry(g.match);
      entry.assists += 1;
      totalAssists += 1;
    });

    playerStats.forEach((ps) => {
      if (ps.gameweek.match) {
        const entry = getOrCreateMatchEntry(ps.gameweek.match);
        if (ps.isMvp) entry.isMvp = true;
        entry.points = ps.totalPoints;
      }
    });

    // Превращаем словарь в массив и сортируем по дате матча (убывание)
    history = Array.from(matchMap.values()).sort(
      (a, b) => b.matchDate.getTime() - a.matchDate.getTime()
    );
  }

  // Formatting helpers
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/stats" className="hover:text-emerald-400 transition-colors">Статистика</Link>
          <span>/</span>
          <span className="text-slate-300">Профиль игрока</span>
        </div>

        {/* Шапка профиля */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center md:items-start justify-between gap-6 shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
          
          <div className="flex items-center gap-6 z-10 w-full md:w-auto flex-col md:flex-row text-center md:text-left">
             <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-emerald-500/20 flex flex-shrink-0 items-center justify-center text-4xl shadow-inner shadow-slate-950 overflow-hidden">
               {player.avatarUrl ? (
                 <img 
                   src={player.avatarUrl} 
                   alt={player.name} 
                   className="w-full h-full object-cover"
                   referrerPolicy="no-referrer"
                 />
               ) : (
                 "🏃"
               )}
             </div>
             <div>
               <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">
                 {player.name}
               </h1>
               <div className="flex items-center gap-3 justify-center md:justify-start">
                 <span className="bg-slate-800 px-2.5 py-1 rounded text-sm font-medium uppercase tracking-widest text-slate-300">
                   {player.position}
                 </span>
                 <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                 <span className="text-sm font-medium text-slate-400">
                   {player.team === "1 группа" ? "Группа 1" : "Группа 2"}
                 </span>
               </div>
             </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl text-center z-10">
            <span className="block text-xs uppercase tracking-wider text-emerald-500 font-bold mb-1">Стоимость</span>
            <span className="text-3xl font-mono font-black text-emerald-400">💰 {player.price.toString()}M</span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 lg:gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Голы</span>
            <span className="text-4xl font-black text-white">{totalGoals}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Ассисты</span>
            <span className="text-4xl font-black text-white">{totalAssists}</span>
          </div>
        </div>

        {/* История матчей */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <span className="text-emerald-500">🔥</span> История выступлений
             </h2>
             <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Сезон {activeSeason?.name}</span>
          </div>

          <div className="p-4 sm:p-6">
             {history.length === 0 ? (
               <div className="text-center py-10 text-slate-500 font-medium">
                 В этом сезоне игрок пока не отметился результативными действиями.
               </div>
             ) : (
               <div className="space-y-4">
                 {history.map((h) => (
                   <div key={h.matchId} className="group bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors hover:bg-slate-950 hover:border-slate-700">
                     
                     <div className="flex flex-col flex-1 w-full text-center md:text-left">
                       <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                           {h.gameweekNumber ? `Тур ${h.gameweekNumber}` : "Матч"}
                         </span>
                         <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                         <span className="text-xs text-slate-500">{formatter.format(h.matchDate)}</span>
                       </div>
                       
                       <Link href={`/matches/${h.matchId}`} className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors">
                         {h.team1} {h.score1 !== null ? `${h.score1}:${h.score2}` : "vs"} {h.team2}
                       </Link>
                     </div>

                     <div className="flex justify-center flex-wrap gap-2 flex-1 w-full md:justify-end">
                       {h.goals > 0 && (
                         <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200">
                           ⚽ Гол {h.goals > 1 ? `x${h.goals}` : ""}
                         </div>
                       )}
                       {h.assists > 0 && (
                         <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200">
                           🎯 Ассист {h.assists > 1 ? `x${h.assists}` : ""}
                         </div>
                       )}
                       {h.isMvp && (
                         <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-500 shadow-sm shadow-amber-500/5">
                           🌟 MVP
                         </div>
                       )}
                     </div>

                      <div className="flex items-center justify-center md:justify-end w-full md:w-32">
                        {h.points !== 0 ? (
                          <div className={`font-black text-sm px-3 py-1.5 border rounded-lg whitespace-nowrap ${h.points > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                            {h.points > 0 ? "+" : ""}{h.points} pts
                          </div>
                        ) : (
                          <div className="bg-slate-800/40 text-slate-500 font-semibold text-[10px] uppercase tracking-wider px-3 py-1.5 border border-slate-800 rounded-lg whitespace-nowrap">
                            Скоро
                          </div>
                        )}
                      </div>

                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
