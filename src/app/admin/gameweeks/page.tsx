"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Match {
  id: number;
  team1: string;
  team2: string;
  matchDate: string;
}

interface Gameweek {
  id: number;
  number: number;
  deadline: string | null;
  status: "SETUP" | "STATS_ENTRY" | "VOTING_OPEN" | "COMPLETED";
  match: Match | null;
  squadSnapshots: any[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SETUP:       { label: "⏳ Трансферы открыты",    color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  STATS_ENTRY: { label: "📊 Ввод статистики",       color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  VOTING_OPEN: { label: "🗳️ Голосование открыто",  color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  COMPLETED:   { label: "✅ Завершён",              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

// ─── Inline edit form for existing gameweek ───────────────────────────────────

function GameweekEditForm({
  gw,
  matches,
  onSaved,
}: {
  gw: Gameweek;
  matches: Match[];
  onSaved: () => void;
}) {
  const [deadline, setDeadline] = useState(
    gw.deadline ? new Date(gw.deadline).toISOString().slice(0, 16) : ""
  );
  const [matchId, setMatchId] = useState(gw.match ? String(gw.match.id) : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/gameweeks/${gw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline: deadline || null,
          matchId: matchId ? parseInt(matchId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Тур обновлён!");
      onSaved();
    } catch (e: any) {
      toast.error("Ошибка: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
      <div>
        <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">
          Дедлайн трансферов
        </label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">
          Привязать матч
        </label>
        <select
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none text-white text-sm"
        >
          <option value="">— Без матча —</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.team1} vs {m.team2} ({new Date(m.matchDate).toLocaleDateString("ru-RU")})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {saving ? "Сохранение..." : "💾 Сохранить"}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminGameweeksPage() {
  const router = useRouter();

  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Форма создания
  const [formNum, setFormNum] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formMatchId, setFormMatchId] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchGameweeks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/gameweeks");
      if (!res.ok) throw new Error("Ошибка при загрузке туров");
      const data = await res.json();
      setGameweeks(data.gameweeks || []);
      setMatches(data.matches || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGameweeks(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gameweeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: formNum,
          deadline: formDeadline,
          matchId: formMatchId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormNum(""); setFormDeadline(""); setFormMatchId("");
      toast.success("Тур успешно создан");
      fetchGameweeks();
    } catch (e: any) {
      toast.error("Ошибка: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleFinalize = async (gameweekId: number, gwNumber: number) => {
    if (!confirm(`Финализировать тур №${gwNumber}? Очки будут начислены.`)) return;
    try {
      const res = await fetch(`/api/admin/gameweeks/${gameweekId}/finalize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) toast.error("Ошибка: " + data.error);
      else { toast.success(data.message); fetchGameweeks(); }
    } catch (e: any) { toast.error("Сетевая ошибка: " + e.message); }
  };

  if (loading) return <div className="p-8 text-white">Загрузка туров...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Хедер */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/admin")} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors text-sm font-medium">
            ← Назад
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">Управление Турами</h1>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">⚠️ {error}</div>
        )}

        {/* Форма создания */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-6 text-emerald-400 flex items-center gap-2">
            <span>➕</span> Создать новый тур
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Номер тура *</label>
              <input
                type="number" min="1" required value={formNum}
                onChange={(e) => setFormNum(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white"
                placeholder="Например: 5"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Дедлайн трансферов *</label>
              <input
                type="datetime-local" required value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Привязанный матч</label>
              <select
                value={formMatchId} onChange={(e) => setFormMatchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white"
              >
                <option value="">— Без матча —</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.team1} vs {m.team2} ({new Date(m.matchDate).toLocaleDateString("ru-RU")})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit" disabled={creating}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? "Создание..." : "Создать тур"}
              </button>
            </div>
          </form>
        </div>

        {/* Список туров */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-4 text-white">Существующие туры</h2>

          {gameweeks.length === 0 ? (
            <div className="p-8 border border-slate-800 border-dashed rounded-2xl text-center text-slate-500">
              Пока не создано ни одного тура.
            </div>
          ) : (
            gameweeks.map((gw) => {
              const isLocked = gw.squadSnapshots.length > 0;
              const isCompleted = gw.status === "COMPLETED";
              const statusInfo = STATUS_LABELS[gw.status] || STATUS_LABELS["SETUP"];
              const isExpanded = expandedId === gw.id;

              const formattedDeadline = gw.deadline
                ? new Date(gw.deadline).toLocaleString("ru-RU", {
                    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                  })
                : "Не указан";

              return (
                <div
                  key={gw.id}
                  className={`bg-slate-900 border rounded-2xl p-6 transition-colors hover:border-slate-700 ${
                    isCompleted ? "border-emerald-500/20" : "border-slate-800"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info */}
                    <div>
                      <h3 className="text-2xl font-black text-white flex items-center flex-wrap gap-3">
                        Тур №{gw.number}
                        <span className={`text-xs font-bold uppercase tracking-wider border px-2.5 py-1 rounded-md ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </h3>
                      <div className="text-slate-400 text-sm mt-2 flex flex-col gap-1">
                        <span><span className="text-slate-500">Дедлайн:</span> {formattedDeadline}</span>
                        <span>
                          <span className="text-slate-500">Матч:</span>{" "}
                          {gw.match
                            ? `${gw.match.team1} vs ${gw.match.team2} (${new Date(gw.match.matchDate).toLocaleDateString("ru-RU")})`
                            : <span className="text-amber-500/70">Не указан</span>
                          }
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 flex-shrink-0">
                      {/* Edit toggle */}
                      {!isCompleted && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : gw.id)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                            isExpanded
                              ? "bg-slate-700 border-slate-600 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                          }`}
                        >
                          {isExpanded ? "✕ Закрыть" : "✏️ Изменить"}
                        </button>
                      )}

                      {isCompleted ? (
                        <div className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm text-center">
                          ✅ Тур завершён
                        </div>
                      ) : !isLocked ? (
                        <div className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-500 text-xs text-center flex items-center gap-2">
                          <span>⏳</span>
                          <span>Составы зафиксируются автоматически<br/>при начислении очков за матч</span>
                        </div>
                      ) : (
                        <>
                          <div className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-sm text-center">
                            ✓ Зафиксированы ({gw.squadSnapshots.length})
                          </div>
                          <button
                            onClick={() => handleFinalize(gw.id, gw.number)}
                            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                          >
                            🏆 Завершить тур
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isExpanded && (
                    <GameweekEditForm
                      gw={gw}
                      matches={matches}
                      onSaved={() => { setExpandedId(null); fetchGameweeks(); }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
