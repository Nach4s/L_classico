"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Season {
  id: number;
  name: string;
  isArchived: boolean;
  createdAt: string;
  _count: {
    matches: number;
    gameweeks: number;
    fantasyTeams: number;
  };
}

export default function AdminSeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/seasons");
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setSeasons(data.seasons || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSeasonName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Сезон "${data.season.name}" создан!`);
      setNewSeasonName("");
      fetchSeasons();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (season: Season) => {
    const action = season.isArchived ? "разархивировать" : "заархивировать";
    if (!confirm(`Вы уверены, что хотите ${action} сезон "${season.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/seasons/${season.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !season.isArchived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Сезон "${season.name}" ${season.isArchived ? "восстановлен" : "заархивирован"}`);
      fetchSeasons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const activeSeason = seasons.find((s) => !s.isArchived);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            ← Назад
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Управление Сезонами
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeSeason
                ? `Активный сезон: ${activeSeason.name}`
                : "⚠️ Активный сезон не выбран"}
            </p>
          </div>
        </div>

        {/* Create New Season */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-400">➕</span> Создать новый сезон
          </h2>
          <form onSubmit={handleCreate} className="flex gap-4">
            <input
              type="text"
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="Например: Сезон 3 — Весна 2026"
              required
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white transition-colors"
            />
            <button
              type="submit"
              disabled={creating || !newSeasonName.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50 whitespace-nowrap shadow-lg shadow-emerald-500/20"
            >
              {creating ? "Создание..." : "Создать"}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-3">
            ⚠️ При создании нового сезона убедитесь, что старый заархивирован.
            Fantasy-команды привязаны к конкретному сезону.
          </p>
        </div>

        {/* Seasons List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Все сезоны</h2>

          {loading ? (
            <div className="text-center py-12 text-slate-500">Загрузка...</div>
          ) : seasons.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              Сезонов пока нет. Создайте первый!
            </div>
          ) : (
            seasons.map((season) => (
              <div
                key={season.id}
                className={`bg-slate-900 border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  season.isArchived
                    ? "border-slate-800/50 opacity-60"
                    : "border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-white">{season.name}</h3>
                    {!season.isArchived ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ✓ Активный
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-500">
                        Архив
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-5 text-xs text-slate-500">
                    <span>⚽ Матчей: <strong className="text-slate-300">{season._count.matches}</strong></span>
                    <span>📅 Туров: <strong className="text-slate-300">{season._count.gameweeks}</strong></span>
                    <span>🛡️ Команд: <strong className="text-slate-300">{season._count.fantasyTeams}</strong></span>
                    <span>
                      Создан:{" "}
                      <strong className="text-slate-300">
                        {new Date(season.createdAt).toLocaleDateString("ru-RU")}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleArchive(season)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      season.isArchived
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-slate-700"
                    }`}
                  >
                    {season.isArchived ? "🔄 Восстановить" : "📦 Архивировать"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
