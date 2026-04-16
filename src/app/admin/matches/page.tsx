"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface Gameweek {
  id: number;
  number: number;
  status: string;
}

interface Match {
  id: number;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  matchDate: string;
  goals: { id: number }[];
  gameweeks: Gameweek[];
}

interface Season {
  id: number;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  SETUP: "Настройка",
  STATS_ENTRY: "Ввод статы",
  VOTING_OPEN: "Голосование",
  COMPLETED: "Завершён",
};

const STATUS_COLORS: Record<string, string> = {
  SETUP: "text-slate-400 bg-slate-800 border-slate-700",
  STATS_ENTRY: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  VOTING_OPEN: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  COMPLETED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

export default function AdminMatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    team1: "1 группа",
    team2: "2 группа",
    score1: "0",
    score2: "0",
    match_date: today,
  });

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/matches");
      if (!res.ok) throw new Error("Ошибка загрузки матчей");
      const data = await res.json();
      setMatches(data.matches || []);
      setSeason(data.season || null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания матча");

      toast.success("Матч создан! Переходим к вводу голов...");
      // Redirect to match detail page to enter goals
      router.push(`/admin/matches/${data.match.id}`);
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  const handleDeleteMatch = async (matchId: number, e: React.MouseEvent) => {
    e.preventDefault(); // prevent navigating to the match link
    e.stopPropagation();

    if (!confirm("Удалить этот матч? Все голы матча тоже будут удалены.")) return;

    setDeletingId(matchId);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка удаления");
      }
      toast.success("Матч удалён");
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin")}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              ← Назад
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Матчи <span className="text-emerald-500">L Clásico</span>
              </h1>
              {season && (
                <p className="text-sm text-slate-500 mt-1">
                  Активный сезон: <span className="text-slate-300 font-medium">{season.name}</span>
                  {" · "}
                  {matches.length} матч{matches.length === 1 ? "" : matches.length < 5 ? "а" : "ей"}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <span>+</span> Создать матч
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-sky-500/5 border border-sky-500/15 rounded-xl text-sm text-sky-400">
          <span className="text-lg flex-shrink-0">💡</span>
          <p>
            После создания матча вы сразу перейдёте на страницу ввода голов и ассистов.
            Нажмите на любой матч в списке, чтобы открыть его и редактировать статистику.
          </p>
        </div>

        {/* Create Match Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-2">Новый матч</h2>
              <p className="text-sm text-slate-500 mb-6">
                После создания вы перейдёте в интерфейс ввода голов (кто забил, кто отдал пас).
              </p>

              {!season && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  ⚠️ Нет активного сезона. Сначала создайте сезон.
                </div>
              )}

              <form onSubmit={handleCreateMatch} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Команда 1
                    </label>
                    <select
                      value={formData.team1}
                      onChange={(e) => setFormData((p) => ({ ...p, team1: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 focus:border-emerald-500 outline-none text-white text-sm"
                    >
                      <option value="1 группа">1 группа</option>
                      <option value="2 группа">2 группа</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Команда 2
                    </label>
                    <select
                      value={formData.team2}
                      onChange={(e) => setFormData((p) => ({ ...p, team2: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 focus:border-emerald-500 outline-none text-white text-sm"
                    >
                      <option value="2 группа">2 группа</option>
                      <option value="1 группа">1 группа</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                    Итоговый счёт
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={formData.score1}
                      onChange={(e) => setFormData((p) => ({ ...p, score1: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 focus:border-emerald-500 outline-none text-white text-center text-lg font-mono font-bold"
                    />
                    <span className="text-slate-500 font-bold text-xl flex-shrink-0">:</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={formData.score2}
                      onChange={(e) => setFormData((p) => ({ ...p, score2: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 focus:border-emerald-500 outline-none text-white text-center text-lg font-mono font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Голы будете вводить по одному на следующей странице — с автором и ассистом.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                    Дата матча
                  </label>
                  <input
                    type="date"
                    value={formData.match_date}
                    onChange={(e) => setFormData((p) => ({ ...p, match_date: e.target.value }))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 focus:border-emerald-500 outline-none text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !season}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                        Создание...
                      </>
                    ) : (
                      "Создать и ввести голы →"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Match List */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Загрузка...</div>
        ) : matches.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-16 text-center">
            <span className="text-4xl block mb-4">⚽</span>
            <p className="text-slate-500 font-medium">Матчей пока нет.</p>
            <p className="text-slate-600 text-sm mt-1">Создайте первый матч сезона!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              const gw = match.gameweeks[0];
              const gwStatus = gw?.status || null;
              const matchDate = formatter.format(new Date(match.matchDate));
              const isPlayed = match.score1 !== null && match.score2 !== null;
              const isDeleting = deletingId === match.id;

              return (
                <div key={match.id} className="relative group">
                  <Link
                    href={`/admin/matches/${match.id}`}
                    className="block bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 transition-all pr-16"
                  >
                    <div className="flex items-center justify-between gap-4">

                      {/* Left: Teams & Score */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Score */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-xl border ${isPlayed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                            {isPlayed ? match.score1 : "—"}
                          </div>
                          <span className="text-slate-600 font-bold text-lg">:</span>
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-xl border ${isPlayed ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                            {isPlayed ? match.score2 : "—"}
                          </div>
                        </div>

                        {/* Teams & Meta */}
                        <div className="min-w-0">
                          <div className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                            {match.team1} <span className="text-slate-500 font-normal">vs</span> {match.team2}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>📅 {matchDate}</span>
                            <span className="text-slate-700">·</span>
                            <span>
                              ⚽ {match.goals.length} гол{match.goals.length === 1 ? "" : match.goals.length < 5 ? "а" : "ов"}
                            </span>
                            <span className="text-slate-700">·</span>
                            <span className="text-sky-400 font-medium">Нажмите для ввода голов →</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Gameweek Status */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {gw ? (
                          <>
                            <span className="text-xs text-slate-500 font-medium">Тур {gw.number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[gwStatus || "SETUP"]}`}>
                              {STATUS_LABELS[gwStatus || "SETUP"]}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600 italic">Без тура</span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteMatch(match.id, e)}
                    disabled={isDeleting}
                    title="Удалить матч"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all flex items-center justify-center text-sm disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-600 border-t-red-400 animate-spin" />
                    ) : (
                      "✕"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
