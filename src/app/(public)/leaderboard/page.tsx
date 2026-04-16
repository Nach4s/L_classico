"use client";

import { useEffect, useState } from "react";

interface ManagerStat {
  manager_name: string;
  totalPoints: number;
  players: {
    id: number;
    name: string;
    isCaptain: boolean;
    points: number;
    stats: { goals: number; assists: number };
  }[];
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<ManagerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("Не удалось загрузить таблицу");
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      } catch (err: any) {
         setError(err.message);
      } finally {
         setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
         <div className="flex flex-col items-center gap-4">
           <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
           <p className="text-slate-400 font-medium">Зачисляем очки...</p>
         </div>
       </div>
     );
  }

  if (error) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
         <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
           ⚠️ {error}
         </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 mb-4 shadow-xl shadow-emerald-500/10">
            <span className="text-3xl text-emerald-400">🏆</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
            Таблица Лидеров
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Рейтинг Фэнтези-менеджеров в текущем сезоне. Очки начисляются за голевые действия ваших игроков и удваиваются для Капитана.
          </p>
        </header>

        <div className="space-y-4">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
              <p className="text-slate-400">Пока нет ни одной собранной команды.</p>
            </div>
          ) : (
            leaderboard.map((manager, index) => {
              const position = index + 1;
              let isTop3 = false;
              let medalClass = "text-slate-500 bg-slate-800 border-slate-700";
              let cardGlow = "";

              if (position === 1) {
                isTop3 = true;
                medalClass = "text-yellow-600 bg-yellow-500/20 border-yellow-500/30";
                cardGlow = "shadow-lg shadow-emerald-500/20 border-emerald-500/40 relative transform hover:-translate-y-1 transition-all";
              } else if (position === 2) {
                isTop3 = true;
                medalClass = "text-gray-400 bg-gray-400/20 border-gray-400/30";
                cardGlow = "shadow-md shadow-white/5 border-slate-700/80";
              } else if (position === 3) {
                 isTop3 = true;
                 medalClass = "text-amber-700 bg-amber-700/20 border-amber-700/30";
                 cardGlow = "shadow-sm border-slate-800";
              } else {
                 cardGlow = "border-slate-800/60 opacity-90";
              }

              return (
                <div 
                  key={index} 
                  className={`bg-slate-900 border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-6 ${cardGlow} transition-all`}
                >
                  
                  {/* Position Badge */}
                  <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl border text-xl font-bold font-mono ${medalClass}`}>
                    {position}
                  </div>

                  {/* Manager Info */}
                  <div className="flex-grow">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      {manager.manager_name}
                      {position === 1 && <span className="text-sm">👑</span>}
                    </h2>

                    {/* Players breakdown */}
                    <div className="flex flex-wrap gap-2 text-sm mt-3">
                      {manager.players.map(p => (
                        <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
                           <span className={p.isCaptain ? "font-bold text-amber-400" : "text-slate-300"}>
                             {p.name} {p.isCaptain && "(C)"}
                           </span>
                           <span className="text-slate-500 font-mono text-xs border-l border-slate-700 pl-2">
                             +{p.points}
                           </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Points */}
                  <div className="flex-shrink-0 flex flex-col items-center sm:items-end border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                    <span className="text-xs uppercase tracking-widest text-slate-500 mb-1 font-semibold">Очки</span>
                    <span className={`text-4xl font-mono font-black tracking-tighter ${position === 1 ? "text-emerald-400" : "text-slate-200"}`}>
                      {manager.totalPoints}
                    </span>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
