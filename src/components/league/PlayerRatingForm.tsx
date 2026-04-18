"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RatingEntry {
  player: { id: number; name: string; team: string; position: string };
  avgRating: string;
  voteCount: number;
}

const POSITION_COLORS: Record<string, string> = {
  GK: "text-yellow-400",
  DEF: "text-blue-400",
  MID: "text-emerald-400",
  FWD: "text-red-400",
};

export function PlayerRatingForm({
  matchId,
  team1,
  team2,
  votingEndsAt,
  votingClosed,
}: {
  matchId: number;
  team1: string;
  team2: string;
  votingEndsAt: string | null;
  votingClosed: boolean;
}) {
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [existingRatings, setExistingRatings] = useState<RatingEntry[]>([]);
  const [userHasRated, setUserHasRated] = useState(false);
  const [candidates, setCandidates] = useState<{ id: number; name: string; team: string; position: string; goals?: number; assists?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isVotingOpen =
    !votingClosed &&
    votingEndsAt != null &&
    new Date(votingEndsAt) > new Date();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load candidates (players of both teams)
        const [voteRes, ratingRes] = await Promise.all([
          fetch(`/api/matches/${matchId}/vote`),
          fetch(`/api/matches/${matchId}/rate`),
        ]);

        if (voteRes.ok) {
          const voteData = await voteRes.json();
          setCandidates(voteData.candidates || []);
        }

        if (ratingRes.ok) {
          const ratingData = await ratingRes.json();
          setExistingRatings(ratingData.ratings || []);
          setUserHasRated(ratingData.userHasRated || false);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [matchId]);

  const handleRatingChange = (playerId: number, value: number) => {
    setRatings((prev) => ({ ...prev, [playerId]: value }));
  };

  const handleSubmit = async () => {
    const ratingArray = Object.entries(ratings).map(([playerId, rating]) => ({
      playerId: parseInt(playerId),
      rating,
    }));

    if (ratingArray.length === 0) {
      toast.error("Выставьте оценки хотя бы одному игроку.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: ratingArray }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message);
      setUserHasRated(true);

      // Reload ratings
      const ratingRes = await fetch(`/api/matches/${matchId}/rate`);
      if (ratingRes.ok) {
        const ratingData = await ratingRes.json();
        setExistingRatings(ratingData.ratings || []);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  // Group candidates by team and exclude coaches
  const group1 = candidates.filter((c) => c.team === team1 && c.position !== "COACH");
  const group2 = candidates.filter((c) => c.team === team2 && c.position !== "COACH");

  return (
    <div className="card mt-6 overflow-hidden animate-slide-up" style={{ animationDelay: "240ms" }}>
      <div className="card-header flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>⭐</span> Оценки игроков
        </h2>
        {isVotingOpen && !userHasRated && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            Открыто
          </span>
        )}
      </div>

      <div className="p-5">
        {userHasRated || !isVotingOpen ? (
          // Show results
          existingRatings.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-4">
                {userHasRated ? "Вы уже оценили игроков. " : ""}Средние оценки:
              </p>
              {existingRatings.map((r) => (
                <div key={r.player.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[r.player.position] || "text-slate-400"}`}>
                        {r.player.position}
                      </span>
                      <span className="text-sm text-white font-medium truncate">{r.player.name}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0 ml-auto">
                        {r.voteCount} оц.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-400"
                          style={{ width: `${(parseFloat(r.avgRating) / 10) * 100}%`, transition: "width 0.6s" }}
                        />
                      </div>
                      <span className="text-sm font-black text-white w-8 text-right flex-shrink-0">
                        {r.avgRating}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              {isVotingOpen ? "Оценок пока нет. Будьте первым!" : "Оценок для этого матча нет."}
            </p>
          )
        ) : (
          // Voting form
          <div className="space-y-6">
            <p className="text-xs text-slate-500">Выставьте оценку игрокам по шкале 1–10. 10 = легенда матча.</p>

            {[{ team: team1, players: group1 }, { team: team2, players: group2 }].map(({ team, players }) => (
              players.length > 0 && (
                <div key={team}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{team}</p>
                  <div className="space-y-3">
                    {players.map((player) => {
                      const val = ratings[player.id] ?? 5.0;
                      return (
                        <div key={player.id} className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold ${POSITION_COLORS[player.position] || "text-slate-400"}`}>
                                {player.position}
                              </span>
                              <span className="text-sm text-white font-medium">{player.name}</span>
                              {((player.goals && player.goals > 0) || (player.assists && player.assists > 0)) ? (
                                <div className="flex items-center gap-0.5 ml-1">
                                  {player.goals ? Array.from({ length: player.goals }).map((_, i) => <span key={`g-${i}`} title="Гол" className="text-sm leading-none drop-shadow-sm">⚽</span>) : null}
                                  {player.assists ? Array.from({ length: player.assists }).map((_, i) => <span key={`a-${i}`} title="Ассист" className="text-sm leading-none drop-shadow-sm">🎯</span>) : null}
                                </div>
                              ) : null}
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={10}
                              step={0.1}
                              value={val}
                              onChange={(e) => handleRatingChange(player.id, parseFloat(e.target.value))}
                              className="w-full h-1.5 appearance-none rounded-full bg-slate-700 accent-emerald-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 mt-0.5 px-0.5">
                              <span>1</span>
                              <span>5</span>
                              <span>10</span>
                            </div>
                          </div>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 border transition-colors ${
                            val >= 9.0 ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                            val >= 7.5 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            val >= 5.0 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                            "bg-red-500/10 border-red-500/30 text-red-500"
                          }`}>
                            {val.toFixed(1)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}

            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(ratings).length === 0}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? "Отправка..." : `Отправить оценки (${Object.keys(ratings).length} игр.)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
