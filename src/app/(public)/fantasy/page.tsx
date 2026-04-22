"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Pos = "GK" | "DEF" | "MID" | "FWD" | "COACH";

interface Player {
  id: number;
  name: string;
  position: Pos;
  team: string;
  price: string;
  slug: string;
  avatarUrl?: string | null;
}

interface TeamPlayer { player: Player; isCaptain: boolean; isViceCaptain: boolean; }

interface FantasyTeam {
  id: number;
  remainingBudget: string;
  coachId: number | null;
  coach: Player | null;
  players: TeamPlayer[];
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const BUDGET      = 18.0;
const MAX_PLAYERS = 3;

const POS_META: Record<string, { label: string; pill: string }> = {
  GK:    { label: "Вратарь",      pill: "bg-amber-500/15   text-amber-400    border-amber-500/30" },
  DEF:   { label: "Защитник",     pill: "bg-blue-500/15    text-blue-400     border-blue-500/30" },
  MID:   { label: "Полузащитник", pill: "bg-violet-500/15  text-violet-400   border-violet-500/30" },
  FWD:   { label: "Нападающий",   pill: "bg-rose-500/15    text-rose-400     border-rose-500/30" },
  COACH: { label: "Тренер",       pill: "bg-purple-500/15  text-purple-400   border-purple-500/30" },
};

const pill = (pos: string) => POS_META[pos]?.pill ?? "bg-slate-700 text-slate-400 border-slate-600";

// ─── Player Drawer (slide-over) ───────────────────────────────────────────────

function PlayerDrawer({
  player,
  isSelected,
  onClose,
  onAdd,
  onRemove,
}: {
  player: Player | null;
  isSelected: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  // Trap ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isOpen = !!player;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity duration-300
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[380px] bg-slate-900 border-l border-slate-800
                    z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out
                    ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {player && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${pill(player.position)}`}>
                {POS_META[player.position]?.label}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                {player.avatarUrl ? (
                  <img
                    src={player.avatarUrl}
                    alt={player.name}
                    className="w-20 h-20 rounded-2xl object-cover border border-slate-700 flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black border flex-shrink-0 ${pill(player.position)}`}>
                    {player.position}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-black text-white leading-tight">{player.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{player.team}</p>
                  {player.position === "COACH" ? (
                    <div className="mt-2 inline-flex border border-purple-500/20 bg-purple-500/10 text-purple-400 font-medium text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                      +2 за победу / -2 за поражение
                    </div>
                  ) : (
                    <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                      {Number(player.price).toFixed(1)}<span className="text-sm text-slate-500 font-normal">M</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              {player.position !== "COACH" && (
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">Характеристики</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Позиция",  value: POS_META[player.position]?.label },
                      { label: "Команда",  value: player.team },
                      { label: "Стоимость", value: `${Number(player.price).toFixed(1)}M` },
                      { label: "Slug",      value: `/${player.slug}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-3">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-slate-200 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tip */}
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {player.position === "COACH" 
                    ? "Тренер не тратит бюджет. Его результат целиком зависит от исхода реального матча команды."
                    : `Выбери до ${MAX_PLAYERS} игроков в состав. Назначь одного капитаном — его очки удвоятся.`
                  }
                </p>
              </div>

              {/* Detailed Stats Link */}
              <Link
                href={`/players/${player.id}`}
                className="w-full py-3 flex justify-center items-center rounded-xl font-bold transition-all bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm"
              >
                Подробная статистика
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>

            {/* Footer CTA */}
            <div className="px-5 py-4 border-t border-slate-800">
              {isSelected ? (
                <button
                  onClick={() => { onRemove(); onClose(); }}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                >
                  {player.position === "COACH" ? "Убрать тренера" : "Убрать из состава"}
                </button>
              ) : (
                <button
                  onClick={() => { onAdd(); onClose(); }}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {player.position === "COACH" ? "+ Выбрать тренера" : "+ Добавить в состав"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Squad slot ───────────────────────────────────────────────────────────────

function SquadSlot({
  index,
  player,
  isCaptain,
  onRemove,
  onToggleCaptain,
}: {
  index: number;
  player?: Player;
  isCaptain?: boolean;
  onRemove?: () => void;
  onToggleCaptain?: () => void;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-800 opacity-40">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-700 text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <p className="text-sm text-slate-700 italic">Слот свободен</p>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
      ${isCaptain
        ? "border-amber-500/40 bg-amber-500/5 shadow-inner shadow-amber-500/5"
        : "border-slate-700/60 bg-slate-800/30 hover:border-slate-700"
      }`}
    >
      {/* Slot number */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0
        ${isCaptain ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-600"}`}>
        {isCaptain ? "C" : index + 1}
      </div>

      {/* Name + position */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${isCaptain ? "text-amber-400" : "text-slate-100"}`}>
          {player.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[9px] font-bold px-1 rounded border ${pill(player.position)}`}>
            {player.position}
          </span>
          <span className="text-[10px] text-slate-600">{player.team}</span>
        </div>
      </div>

      {/* Price */}
      <span className="text-sm font-mono font-bold text-emerald-400 flex-shrink-0">
        {Number(player.price).toFixed(1)}M
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onToggleCaptain}
          title={isCaptain ? "Снять капитана" : "Назначить капитаном"}
          className={`w-6 h-6 rounded text-xs transition-colors flex items-center justify-center
            ${isCaptain ? "text-amber-400 hover:text-amber-300" : "text-slate-600 hover:text-amber-400"}`}
        >
          ★
        </button>
        <button
          onClick={onRemove}
          title="Убрать"
          className="w-6 h-6 rounded text-xs text-slate-600 hover:text-red-400 transition-colors flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FantasyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches]       = useState<Player[]>([]);
  const [myTeam, setMyTeam]         = useState<FantasyTeam | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedIds,    setSelectedIds]    = useState<number[]>([]);
  const [captainId,      setCaptainId]      = useState<number | null>(null);
  const [selectedCoach,  setSelectedCoach]  = useState<number | null>(null);

  const [drawerPlayer, setDrawerPlayer] = useState<Player | null>(null);
  const [activeGroup,  setActiveGroup]  = useState<1 | 2>(1);
  const [posFilter,    setPosFilter]    = useState<string>("ALL");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const [pr, tr] = await Promise.all([fetch("/api/players"), fetch("/api/fantasy/team")]);
      if (pr.ok) {
        const d = await pr.json();
        const all = (d.players ?? []) as Player[];
        setAllPlayers(all.filter((p) => p.position !== "COACH"));
        setCoaches(all.filter((p) => p.position === "COACH"));
      }
      if (tr.ok) {
        const d = await tr.json();
        const t: FantasyTeam = d.team;
        setMyTeam(t);
        if (t) {
          setSelectedIds(t.players.map((tp) => tp.player.id));
          setCaptainId(t.players.find((tp) => tp.isCaptain)?.player.id ?? null);
          setSelectedCoach(t.coachId);
        }
      }
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { if (status === "authenticated") loadData(); }, [status, loadData]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const byGroup   = (g: 1 | 2) => allPlayers.filter((p) => p.team === `${g} группа`);
  const positions = ["ALL", ...Array.from(new Set(byGroup(activeGroup).map((p) => p.position)))];
  const visible   = byGroup(activeGroup).filter((p) => posFilter === "ALL" || p.position === posFilter);

  const selected     = allPlayers.filter((p) => selectedIds.includes(p.id));
  const totalCost    = selected.reduce((s, p) => s + Number(p.price), 0);
  const remaining    = BUDGET - totalCost;
  const isOverBudget = totalCost > BUDGET;
  const canSave      = selectedIds.length === MAX_PLAYERS && !!captainId && !isOverBudget;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function addPlayer(p: Player) {
    if (selectedIds.includes(p.id)) return;
    if (selectedIds.length >= MAX_PLAYERS) { toast.error(`Максимум ${MAX_PLAYERS} игрока`); return; }
    setSelectedIds((prev) => [...prev, p.id]);
  }

  function removePlayer(id: number) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (captainId === id) setCaptainId(null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/fantasy/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_ids: selectedIds, captain_id: captainId, coach_id: selectedCoach }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(d.message ?? "Команда сохранена!");
      loadData();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (status === "loading" || loadingData) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Загрузка...</p>
        </div>
      </main>
    );
  }
  if (!session) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Slide-over Drawer ────────────────────────────────────────────── */}
      <PlayerDrawer
        player={drawerPlayer}
        isSelected={drawerPlayer ? (drawerPlayer.position === "COACH" ? selectedCoach === drawerPlayer.id : selectedIds.includes(drawerPlayer.id)) : false}
        onClose={() => setDrawerPlayer(null)}
        onAdd={() => {
          if (drawerPlayer) {
            if (drawerPlayer.position === "COACH") setSelectedCoach(drawerPlayer.id);
            else addPlayer(drawerPlayer);
          }
        }}
        onRemove={() => {
          if (drawerPlayer) {
            if (drawerPlayer.position === "COACH") setSelectedCoach(null);
            else removePlayer(drawerPlayer.id);
          }
        }}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>🎮</span> Fantasy лига
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Менеджер: <span className="text-emerald-400 font-medium">{session.user.managerName ?? session.user.email}</span>
            </p>
          </div>

        {/* Budget widget + leaderboard link */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Link
              href="/fantasy/leaderboard"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all text-sm font-semibold"
            >
              🏆 Рейтинг
            </Link>
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 min-w-[240px]">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-slate-600 uppercase tracking-widest font-semibold">Бюджет</span>
                <span className={`font-mono ${isOverBudget ? "text-red-400" : "text-slate-500"}`}>
                  {totalCost.toFixed(1)} / {BUDGET}M
                </span>
              </div>
              <div className="h-1 rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (totalCost / BUDGET) * 100)}%` }}
                />
              </div>
            </div>
            <p className={`text-2xl font-black font-mono tabular-nums flex-shrink-0 ${isOverBudget ? "text-red-400" : "text-emerald-400"}`}>
              {remaining.toFixed(1)}<span className="text-slate-600 text-sm font-normal">M</span>
            </p>
          </div>
          </div>
        </div>

        {/* ── Two-column layout ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT — Player Browser ─────────────────────────────────────────── */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">

            {/* Group tabs */}
            <div className="flex border-b border-slate-800">
              {([1, 2] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => { setActiveGroup(g); setPosFilter("ALL"); }}
                  className={`flex-1 relative py-3.5 text-sm font-semibold transition-colors
                    ${activeGroup === g ? "text-white" : "text-slate-600 hover:text-slate-400"}`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${g === 1 ? "bg-blue-400" : "bg-orange-400"}`} />
                    {g} группа
                    <span className="text-xs text-slate-700">({byGroup(g).length})</span>
                  </span>
                  {activeGroup === g && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Position filter chips */}
            <div className="flex gap-1.5 px-4 py-3 border-b border-slate-800/60 overflow-x-auto flex-shrink-0">
              {positions.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all
                    ${posFilter === pos
                      ? pos === "ALL"
                        ? "bg-slate-700 border-slate-600 text-white"
                        : `${pill(pos)} text-xs`
                      : "border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400"
                    }`}
                >
                  {pos === "ALL" ? "Все" : pos}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-slate-800/40">
              <span className="col-span-2 text-[10px] text-slate-700 uppercase tracking-widest font-semibold">Поз</span>
              <span className="col-span-7 text-[10px] text-slate-700 uppercase tracking-widest font-semibold">Игрок</span>
              <span className="col-span-3 text-[10px] text-slate-700 uppercase tracking-widest font-semibold text-right">Цена</span>
            </div>

            {/* Player rows */}
            <div className="overflow-y-auto flex-1" style={{ maxHeight: "440px" }}>
              {visible.length === 0 ? (
                <p className="text-center text-slate-700 text-sm py-10">Нет игроков</p>
              ) : (
                visible.map((player) => {
                  const isSelected = selectedIds.includes(player.id);
                  const isDisabled = !isSelected && selectedIds.length >= MAX_PLAYERS;
                  return (
                    <div
                      key={player.id}
                      onClick={() => !isDisabled && setDrawerPlayer(player)}
                      className={`grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-slate-800/30 transition-colors
                        ${isDisabled
                          ? "opacity-30 cursor-not-allowed"
                          : "cursor-pointer hover:bg-slate-800/40 active:bg-slate-800/60"
                        }`}
                    >
                      {/* Position */}
                      <div className="col-span-2">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${pill(player.position)}`}>
                          {player.position}
                        </span>
                      </div>

                      {/* Name */}
                      <div className="col-span-7 flex items-center gap-2 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? "text-emerald-400" : "text-slate-200"}`}>
                          {player.name}
                        </p>
                        {isSelected && (
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-[7px] text-emerald-400 font-bold">✓</span>
                          </div>
                        )}
                      </div>

                      {/* Price */}
                      <div className="col-span-3 text-right">
                        <span className="text-sm font-mono font-bold text-slate-300">
                          {Number(player.price).toFixed(1)}<span className="text-slate-600 text-xs">M</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-slate-800/60">
              <p className="text-[11px] text-slate-700">
                Нажми на игрока, чтобы посмотреть инфо и добавить в состав
              </p>
            </div>
          </div>

          {/* RIGHT — Dashboard ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* My Squad */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-bold text-white">Мой состав</p>
                <span className="text-xs text-slate-600 font-mono">
                  {selectedIds.length}<span className="text-slate-700">/{MAX_PLAYERS}</span>
                </span>
              </div>
              <div className="p-3 space-y-2">
                {Array.from({ length: MAX_PLAYERS }).map((_, i) => (
                  <SquadSlot
                    key={i}
                    index={i}
                    player={selected[i]}
                    isCaptain={selected[i] ? captainId === selected[i].id : false}
                    onRemove={selected[i] ? () => removePlayer(selected[i].id) : undefined}
                    onToggleCaptain={
                      selected[i]
                        ? () => setCaptainId((prev) => (prev === selected[i].id ? null : selected[i].id))
                        : undefined
                    }
                  />
                ))}
              </div>

              {selectedIds.length === MAX_PLAYERS && !captainId && (
                <div className="mx-3 mb-3 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15 text-amber-400 text-[11px] flex items-center gap-1.5">
                  <span>★</span>
                  <span>Наведи на игрока и нажми ★ чтобы назначить капитана</span>
                </div>
              )}
            </div>

            {/* Coach */}
            {coaches.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800">
                  <p className="text-sm font-bold text-white">Тренер</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">+2 очка за победу / -2 за поражение</p>
                </div>
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => setSelectedCoach(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2
                      ${selectedCoach === null
                        ? "bg-slate-800 border-slate-700 text-slate-400"
                        : "border-slate-800/50 text-slate-700 hover:border-slate-800"
                      }`}
                  >
                    <span className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-sm flex-shrink-0">—</span>
                    Без тренера
                  </button>
                  {coaches.map((coach) => (
                    <div
                      key={coach.id}
                      onClick={() => setDrawerPlayer(coach)}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                        ${selectedCoach === coach.id
                          ? "bg-violet-500/8 border-violet-500/30"
                          : "border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700/80"
                        }`}
                    >
                      {coach.avatarUrl ? (
                        <img src={coach.avatarUrl} alt={coach.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-base flex-shrink-0">
                          🧑‍💼
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-violet-400 transition-colors">{coach.name}</p>
                        <p className="text-[10px] text-slate-600">{coach.team}</p>
                      </div>
                      {selectedCoach === coach.id && (
                        <span className="text-violet-400 text-sm font-bold flex-shrink-0">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {isOverBudget && (
              <div className="px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span>⚠</span> Превышен бюджет на {(totalCost - BUDGET).toFixed(1)}M
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]
                         bg-emerald-500 hover:bg-emerald-400 text-slate-950
                         disabled:opacity-30 disabled:cursor-not-allowed
                         shadow-lg shadow-emerald-500/10"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Сохранение...
                </span>
              ) : !canSave && selectedIds.length < MAX_PLAYERS
                ? `Выбери ещё ${MAX_PLAYERS - selectedIds.length} ${MAX_PLAYERS - selectedIds.length === 1 ? "игрока" : "игроков"}`
                : !captainId
                ? "Назначь капитана ★"
                : myTeam ? "Обновить команду" : "Сохранить команду"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}