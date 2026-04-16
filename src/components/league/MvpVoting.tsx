"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Candidate {
  id: number;
  name: string;
  position: string;
  team: string;
  votes: number;
}

export function MvpVoting({ 
  matchId, 
  votingEndsAt, 
}: { 
  matchId: number; 
  votingEndsAt: string | null;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const isDeadlinePassed = votingEndsAt 
    ? new Date(votingEndsAt).getTime() < new Date().getTime()
    : false;

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/vote`);
      if (!res.ok) {
         if (res.status === 401) {
            // Not authenticated, that's fine, they just can't vote
            setCandidates([]);
            setLoading(false);
            return;
         }
         throw new Error("Ошибка при загрузке голосования");
      }
      const data = await res.json();
      setCandidates(data.results || []);
      setUserVote(data.userVote);
      setClosed(data.votingClosed || isDeadlinePassed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [matchId]);

  const handleVote = async (playerId: number) => {
    setVoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/vote`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ playerId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refresh to see updated bars
      await fetchResults();
      toast.success("Ваш голос учтен!");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
     return <div className="p-4 text-center text-sm text-slate-500 animate-pulse">Загрузка модуля голосования...</div>;
  }

  if (candidates.length === 0 && !error) {
     // По дефолту спрячем, если например юзер не авторизован и мы не вернули список,
     // либо матч без игроков
     return (
       <div className="p-4 text-center rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-500">
         Войдите в аккаунт, чтобы голосовать за MVP.
       </div>
     );
  }

  // Расчет максимального кол-ва голосов для плашек
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
  const maxVotes = Math.max(...candidates.map(c => c.votes), 1); // protect from div by 0

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden mt-6">
      
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span>⭐</span> 
          Голосование за Man of the Match
        </h3>
        {closed ? (
           <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400">Закрыто</span>
        ) : (
           <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">Открыто</span>
        )}
      </div>

      <div className="p-5">
        {error && (
           <div className="mb-4 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
             ⚠️ {error}
           </div>
        )}

        {/* Если юзер уже голосовал ИЛИ голосование закрыто -> Показываем прогресс бары */}
        {userVote || closed ? (
          <div className="space-y-4">
             {candidates.map((c, i) => {
                const percentage = totalVotes === 0 ? 0 : Math.round((c.votes / totalVotes) * 100);
                const isWinner = c.votes === maxVotes && c.votes > 0;
                const isMyVote = userVote === c.id;

                return (
                  <div key={c.id} className="relative">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-semibold ${isMyVote ? "text-emerald-400" : "text-slate-300"}`}>
                        {c.name} {isMyVote && " (Ваш голос)"}
                      </span>
                      <span className="text-slate-500 font-medium">
                        {c.votes} {c.votes === 1 ? "голос" : "голосов"} ({percentage}%)
                      </span>
                    </div>
                    {/* Progress Bar Track */}
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex items-center">
                       {/* Progress Bar Fill */}
                       <div 
                         className={`h-full rounded-full transition-all duration-1000 ${
                           isWinner ? "bg-amber-500" : (isMyVote ? "bg-emerald-500" : "bg-slate-600")
                         }`} 
                         style={{ width: `${percentage}%` }}
                       />
                    </div>
                  </div>
                )
             })}
          </div>
        ) : (
          /* Если юзер не голосовал и открыто -> Сетка кнопок */
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Выберите лучшего игрока этого матча. Ваш голос повлияет на статус MVP!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
               {candidates.map(c => (
                 <button
                    key={c.id}
                    onClick={() => handleVote(c.id)}
                    disabled={voting}
                    className="p-3 text-left border border-slate-800 rounded-xl bg-slate-900/50 hover:bg-slate-800 hover:border-emerald-500/50 transition-all disabled:opacity-50 group"
                 >
                    <div className="font-semibold text-sm text-slate-200 group-hover:text-emerald-400 transition-colors">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase mt-1">
                      {c.position} · {c.team === "1 группа" ? "Гр 1" : "Гр 2"}
                    </div>
                 </button>
               ))}
            </div>
            {voting && <div className="mt-4 text-center text-xs text-emerald-400 animate-pulse">Отправка голоса...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
