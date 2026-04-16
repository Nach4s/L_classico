"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Position = "GK" | "DEF" | "MID" | "FWD" | "COACH";

interface Player {
  id: number;
  name: string;
  position: Position;
  team: string;
  price: string;
  slug: string;
  avatarUrl?: string | null;
}

interface TeamPlayer {
  player: Player;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

interface FantasyTeam {
  id: number;
  remainingBudget: string;
  coachId: number | null;
  coach: Player | null;
  players: TeamPlayer[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUDGET = 18.0;
const MAX_PLAYERS = 3;

const POSITION_COLORS: Record<string, string> = {
  GK:    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  DEF:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
  MID:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  FWD:   "bg-red-500/15 text-red-400 border-red-500/30",
  COACH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

// ─── Avatar component ─────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = "sm" }: { player: Player; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-xs";
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name}
        className={`${dim} rounded-full object-cover border border-slate-700 flex-shrink-0`}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full flex-shrink-0 flex items-center justify-center font-bold border ${POSITION_COLORS[player.position] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
      {player.position}
    </div>
  );
}

// ─── Player card ──────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  selected,
  isCaptain,
  onToggle,
  onCaptain,
  disabled,
}: {
  player: Player;
  selected: boolean;
  isCaptain: boolean;
  onToggle: () => void;
  onCaptain: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer group
        ${selected
          ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
          : disabled
          ? "bg-slate-900/40 border-slate-800/50 opacity-50 cursor-not-allowed"
          : "bg-slate-900 border-slate-800 hover:border-slate-700"
        }`}
      onClick={disabled && !selected ? undefined : onToggle}
    >
      <PlayerAvatar player={player} />

      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${isCaptain ? "text-amber-400" : "text-white"}`}>
          {player.name} {isCaptain && <span className="text-xs">(C)</span>}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] font-bold px-1 rounded border ${POSITION_COLORS[player.position]}`}>
            {player.position}
          </span>
          <span className="text-[11px] text-slate-500 truncate">{player.team}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="text-sm font-mono font-bold text-emerald-400">
          {Number(player.price).toFixed(1)}M
        </span>
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onCaptain(); }}
            title="Назначить капитаном"
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors
              ${isCaptain
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-slate-800 text-slate-500 border-slate-700 hover:border-amber-500/30 hover:text-amber-400"
              }`}
          >
            {isCaptain ? "★ Капитан" : "Капитан"}
          </button>
        )}
      </div>

      {selected && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">✓</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FantasyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Player[]>([]);
  const [myTeam, setMyTeam] = useState<FantasyTeam | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);


  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  // Load players and team
  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [playersRes, teamRes] = await Promise.all([
        fetch("/api/players"),
        fetch("/api/fantasy/team"),
      ]);

      if (playersRes.ok) {
        const data = await playersRes.json();
        const activePlayers = (data.players ?? []) as Player[];
        setAllPlayers(activePlayers.filter((p) => p.position !== "COACH"));
        setCoaches(activePlayers.filter((p) => p.position === "COACH"));
      }

      if (teamRes.ok) {
        const data = await teamRes.json();
        const team: FantasyTeam = data.team;
        setMyTeam(team);

        if (team) {
          setSelectedIds(team.players.map((tp) => tp.player.id));
          setCaptainId(team.players.find((tp) => tp.isCaptain)?.player.id ?? null);
          setSelectedCoachId(team.coachId);
        }
      }
    } catch (e: any) {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadData();
  }, [status, loadData]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const selectedPlayers = allPlayers.filter((p) => selectedIds.includes(p.id));
  const totalCost = selectedPlayers.reduce((sum, p) => sum + Number(p.price), 0);
  const remaining = BUDGET - totalCost;
  const isOverBudget = totalCost > BUDGET;
  const canSave = selectedIds.length === MAX_PLAYERS && captainId !== null && !isOverBudget;

  const filteredPlayers = allPlayers.filter((p) =>
    searchQuery ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function togglePlayer(id: number) {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (captainId === id) setCaptainId(null);
    } else {
      if (selectedIds.length >= MAX_PLAYERS) {
        toast.error(`Максимум ${MAX_PLAYERS} игрока в команде`);
        return;
      }
      setSelectedIds((prev) => [...prev, id]);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/fantasy/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_ids: selectedIds,
          captain_id: captainId,
          coach_id: selectedCoachId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? "Команда сохранена!");
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading / Auth state ──────────────────────────────────────────────────

  if (status === "loading" || loadingData) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Загрузка...</p>
        </div>
      </main>
    );
  }

  if (!session) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🎮</span>
          <h1 className="section-title">Fantasy лига</h1>
        </div>
        <p className="section-subtitle">
          Менеджер: <span className="text-emerald-400">{session.user.managerName ?? session.user.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Player Selection */}
        <div className="lg:col-span-2 space-y-4">

          {/* Search */}
          <input
            type="text"
            placeholder="Поиск игрока..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input text-sm"
          />

          {/* Players list */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-white">
                Выбери {MAX_PLAYERS} игрока
                <span className="text-slate-500 font-normal ml-2">
                  {selectedIds.length}/{MAX_PLAYERS}
                </span>
              </h2>
            </div>
            <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredPlayers.length === 0 ? (
                <p className="text-center text-slate-600 text-sm py-8">Игроки не найдены</p>
              ) : (
                filteredPlayers.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    selected={selectedIds.includes(player.id)}
                    isCaptain={captainId === player.id}
                    onToggle={() => togglePlayer(player.id)}
                    onCaptain={() => setCaptainId(player.id)}
                    disabled={selectedIds.length >= MAX_PLAYERS && !selectedIds.includes(player.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: My Team Summary */}
        <div className="space-y-4">

          {/* Budget */}
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Бюджет</p>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-black font-mono tabular-nums ${isOverBudget ? "text-red-400" : "text-emerald-400"}`}>
                {remaining.toFixed(1)}M
              </span>
              <span className="text-slate-600 text-sm mb-0.5">/ {BUDGET}M</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isOverBudget ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, (totalCost / BUDGET) * 100)}%` }}
              />
            </div>
          </div>

          {/* My squad */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-white">Мой состав</h2>
            </div>
            <div className="p-3 space-y-2">
              {selectedPlayers.length > 0 ? (
                selectedPlayers.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
                    <PlayerAvatar player={player} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${captainId === player.id ? "text-amber-400" : "text-white"}`}>
                        {player.name} {captainId === player.id && "(C)"}
                      </p>
                      <p className="text-[10px] text-slate-500">{Number(player.price).toFixed(1)}M</p>
                    </div>
                    <button
                      onClick={() => togglePlayer(player.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-600 text-sm py-6">
                  Выбери {MAX_PLAYERS} игрока слева
                </p>
              )}

              {/* Fill remaining slots */}
              {Array.from({ length: MAX_PLAYERS - selectedPlayers.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-slate-800">
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-700 text-xs">
                    +
                  </div>
                  <p className="text-xs text-slate-700">Игрок {selectedPlayers.length + i + 1}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coach Selection */}
          {coaches.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-white">Тренер</h2>
              </div>
              <div className="p-3 space-y-2">
                <button
                  onClick={() => setSelectedCoachId(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                    selectedCoachId === null
                      ? "bg-slate-700 border-slate-600 text-slate-300"
                      : "border-slate-800 text-slate-600 hover:border-slate-700"
                  }`}
                >
                  Без тренера
                </button>
                {coaches.map((coach) => (
                  <div
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id === selectedCoachId ? null : coach.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all
                      ${selectedCoachId === coach.id
                        ? "bg-purple-500/10 border-purple-500/40"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                  >
                    <PlayerAvatar player={coach} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{coach.name}</p>
                      <p className="text-[10px] text-slate-500">{coach.team} · +2/-2 очка</p>
                    </div>
                    {selectedCoachId === coach.id && (
                      <span className="text-purple-400 text-xs font-bold">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* Save button */}
          {isOverBudget && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              ⚠️ Превышен бюджет на {(totalCost - BUDGET).toFixed(1)}M
            </div>
          )}

          {selectedIds.length === MAX_PLAYERS && captainId === null && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              ⚠️ Выбери капитана — нажми «Капитан» на карточке игрока
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Сохранение...
              </span>
            ) : myTeam ? "Обновить команду" : "Сохранить команду"}
          </button>
        </div>
      </div>
    </main>
  );
}