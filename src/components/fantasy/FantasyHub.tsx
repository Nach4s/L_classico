"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowRight, Shield, ChevronLeft, ChevronRight, X } from "lucide-react";

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

interface FantasyHubProps {
  user: { id: string; managerName: string; totalPoints: number };
  allGameweeks: any[];
  allPlayers: Player[];
  activeTeam: any | null;
  snapshots: any[];
  playerStats: any[];
  isOwner?: boolean;
}

const BUDGET = 18.0;
const MAX_PLAYERS = 3;

const POS_META: Record<string, { label: string; pill: string }> = {
  GK:    { label: "Вратарь",      pill: "bg-amber-500/15   text-amber-400    border-amber-500/30" },
  DEF:   { label: "Защитник",     pill: "bg-blue-500/15    text-blue-400     border-blue-500/30" },
  MID:   { label: "Полузащитник", pill: "bg-violet-500/15  text-violet-400   border-violet-500/30" },
  FWD:   { label: "Нападающий",   pill: "bg-rose-500/15    text-rose-400     border-rose-500/30" },
  COACH: { label: "Тренер",       pill: "bg-purple-500/15  text-purple-400   border-purple-500/30" },
};

const pill = (pos: string) => POS_META[pos]?.pill ?? "bg-slate-700 text-slate-400 border-slate-600";

// ─── SVG Pitch ────────────────────────────────────────────────────────────────

function PitchLines() {
  return (
    <div className="absolute inset-0 pointer-events-none border-[1.5px] border-white/15 m-2 rounded-lg">
      <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white/10 rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/15 rounded-full" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50%] h-[15%] border-b border-x border-white/10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[25%] h-[6%] border-b border-x border-white/10" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[50%] h-[15%] border-t border-x border-white/10" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[25%] h-[6%] border-t border-x border-white/10" />
    </div>
  );
}

// ─── Pitch Cards ──────────────────────────────────────────────────────────────

function PitchCard({
  player, isCaptain, value, label, isEdit, onRemove, onToggleCaptain
}: {
  player: Player, isCaptain?: boolean, value: string | number, label: string, isEdit?: boolean, onRemove?: () => void, onToggleCaptain?: () => void
}) {
  const parts = player.name.split(" ");
  const shortName = parts.length > 1 ? parts[parts.length - 1] : parts[0];

  return (
    <div className="flex flex-col items-center gap-0.5 select-none w-16 sm:w-20 relative group">
      {isEdit && (
        <div className="absolute -top-3 -right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {player.position !== "COACH" && (
            <button onClick={onToggleCaptain} className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-800 border ${isCaptain ? 'border-amber-400 text-amber-400' : 'border-slate-600 text-slate-400 hover:text-white'}`}>
              C
            </button>
          )}
          <button onClick={onRemove} className="w-6 h-6 rounded-full flex items-center justify-center bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="relative">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt={player.name} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 shadow-xl ${player.position === 'COACH' ? 'border-purple-500/40' : 'border-white/20'}`} />
        ) : (
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 flex items-center justify-center text-xl shadow-xl ${player.position === 'COACH' ? 'border-purple-500/20' : 'border-slate-600'}`}>
            {player.position === 'COACH' ? '🧑‍💼' : '👤'}
          </div>
        )}
        {isCaptain && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center text-slate-950 text-[10px] font-black shadow-lg">
            C
          </div>
        )}
      </div>

      {player.position === 'COACH' && <div className="text-[8px] sm:text-[9px] text-purple-400 font-bold uppercase mt-1">Тренер</div>}
      <div className={`bg-slate-900/90 text-white text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-full truncate text-center border ${player.position === 'COACH' ? 'border-purple-700/30' : 'border-slate-700/50'} mt-1`}>
        {shortName}
      </div>

      <div className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full border mt-1 ${isEdit ? 'bg-slate-800/80 border-slate-700/50 text-slate-300' : Number(value) > 0 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : Number(value) < 0 ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-slate-800/80 border-slate-700/50 text-slate-500'}`}>
        {value} {label}
      </div>
    </div>
  );
}

function EmptySlot({ onAdd, label }: { onAdd: () => void, label: string }) {
  return (
    <button onClick={onAdd} className="flex flex-col items-center gap-1 w-16 sm:w-20 group">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-slate-600 bg-slate-800/40 flex items-center justify-center text-slate-500 group-hover:border-emerald-500 group-hover:text-emerald-400 transition-colors">
        +
      </div>
      <span className="text-[10px] text-slate-500 group-hover:text-emerald-400">{label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FantasyHub({
  user, allGameweeks, allPlayers, activeTeam, snapshots, playerStats, isOwner = true
}: FantasyHubProps) {
  // Sort GWs and find latest active
  const gws = [...allGameweeks].sort((a, b) => a.number - b.number);
  const activeGw = gws.slice().reverse().find(g => g.status === 'SETUP' || g.status === 'STATS_ENTRY') || gws[gws.length - 1];

  const [selectedGwId, setSelectedGwId] = useState(activeGw?.id);
  const selectedGw = gws.find(g => g.id === selectedGwId);
  
  // Is this GW in the past/locked?
  const isTimeUp = selectedGw ? new Date() > new Date(selectedGw.deadline) : false;
  // isPast means the gameweek is officially locked by the admin (snapshots generated) OR we are looking at an old gameweek
  const isPast = selectedGw ? selectedGw.status !== 'SETUP' : false;
  
  // isLocked means the user can no longer edit the squad
  const isLocked = isPast || isTimeUp;

  // Editor State
  const [selectedIds, setSelectedIds] = useState<number[]>(activeTeam?.players.map((p: any) => p.playerId) || []);
  const [captainId, setCaptainId] = useState<number | null>(activeTeam?.players.find((p: any) => p.isCaptain)?.playerId || null);
  const [selectedCoach, setSelectedCoach] = useState<number | null>(activeTeam?.coachId || null);

  const [drawerPlayer, setDrawerPlayer] = useState<Player | null>(null);
  const [activeGroup, setActiveGroup] = useState<1 | 2>(1);
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [saving, setSaving] = useState(false);

  // Derived Selection
  const selectedPlayers = selectedIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
  const totalCost = selectedPlayers.reduce((s, p) => s + Number(p.price), 0);
  const remaining = BUDGET - totalCost;
  const isOverBudget = totalCost > BUDGET;
  const canSave = selectedIds.length === MAX_PLAYERS && !!captainId && !isOverBudget && !isLocked && isOwner;

  // Privacy check
  const shouldHidePitch = !isOwner && !isLocked;
  const shouldHideBudget = !isOwner && !isPast;

  // Derived Snapshot for past gameweek
  const snapshot = snapshots.find(s => s.gameweekId === selectedGwId);
  const snapPlayers = snapshot ? snapshot.playerIds.map((id: number) => allPlayers.find(p => p.id === id)).filter(Boolean) : [];
  const snapCoach = snapshot && snapshot.coachPlayerId ? allPlayers.find(p => p.id === snapshot.coachPlayerId) : null;
  
  // Points Map for snapshot
  const ptsMap = new Map<number, number>();
  if (snapshot) {
    const gwStats = playerStats.filter(s => s.gameweekId === selectedGwId);
    for (const stat of gwStats) {
      const base = (stat.played ? 1 : 0) + stat.goals * 3 + stat.assists * 2 + stat.mvpBonus;
      const isCap = snapshot.captainPlayerId === stat.playerId;
      ptsMap.set(stat.playerId, isCap ? base * 2 : base);
    }
  }

  // Helpers
  const coaches = allPlayers.filter(p => p.position === 'COACH');
  const outfield = allPlayers.filter(p => p.position !== 'COACH');
  // Group 1 includes outfield from team "1 группа" + coaches; Group 2 just outfield
  const byGroup = (g: 1 | 2) => {
    const grp = g === 1 ? "1 группа" : "2 группа";
    const players = outfield.filter(p => p.team === grp);
    return g === 1 ? [...players, ...coaches] : players;
  };
  const positions = ["ALL", ...Array.from(new Set(byGroup(activeGroup).map(p => p.position)))];
  const visible = byGroup(activeGroup).filter(p => posFilter === "ALL" || p.position === posFilter);

  // Gameweek Navigation
  const currentIndex = gws.findIndex(g => g.id === selectedGwId);
  const prevGw = currentIndex > 0 ? gws[currentIndex - 1] : null;
  const nextGw = currentIndex < gws.length - 1 ? gws[currentIndex + 1] : null;

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
      toast.success(d.message ?? "Состав сохранён!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Drawer */}
      <div className={`fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${drawerPlayer ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={() => setDrawerPlayer(null)} />
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[380px] bg-slate-900 border-l border-slate-800 z-50 shadow-2xl flex flex-col transition-transform duration-300 ${drawerPlayer ? "translate-x-0" : "translate-x-full"}`}>
        {drawerPlayer && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${pill(drawerPlayer.position)}`}>{POS_META[drawerPlayer.position]?.label}</span>
              <button onClick={() => setDrawerPlayer(null)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              <div className="flex items-center gap-4">
                {drawerPlayer.avatarUrl ? (
                  <img src={drawerPlayer.avatarUrl} className="w-20 h-20 rounded-2xl object-cover border border-slate-700" />
                ) : (
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black border ${pill(drawerPlayer.position)}`}>{drawerPlayer.position}</div>
                )}
                <div>
                  <h2 className="text-xl font-black text-white">{drawerPlayer.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{drawerPlayer.team}</p>
                  {drawerPlayer.position === 'COACH' ? (
                    <div className="mt-2 text-[10px] sm:text-xs text-purple-400 border border-purple-500/20 bg-purple-500/10 px-2.5 py-1.5 rounded-lg inline-block whitespace-nowrap">±3 очка за матч</div>
                  ) : (
                    <p className="text-2xl font-black text-emerald-400 mt-1">{Number(drawerPlayer.price).toFixed(1)}M</p>
                  )}
                </div>
              </div>

              {/* Form / Stats */}
              <div>
                <h3 className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Форма (последние 5 матчей)</h3>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((_, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/50 flex flex-col items-center justify-center text-slate-400 shadow-inner">
                      <span className="text-xs font-bold">—</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Link */}
              <Link href={`/players/${drawerPlayer.id}`} className="w-full py-3 flex justify-center items-center rounded-xl font-bold transition-all bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm">
                Подробная информация
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              
              {/* Tip */}
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {drawerPlayer.position === "COACH" 
                    ? "Тренер не тратит бюджет. Его результат целиком зависит от исхода реального матча."
                    : `Выбери до ${MAX_PLAYERS} игроков в состав. Капитан получает удвоенные очки.`
                  }
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-800">
              {(drawerPlayer.position === 'COACH' ? selectedCoach === drawerPlayer.id : selectedIds.includes(drawerPlayer.id)) ? (
                <button
                  onClick={() => {
                    if (drawerPlayer.position === 'COACH') setSelectedCoach(null);
                    else {
                      setSelectedIds(selectedIds.filter(id => id !== drawerPlayer.id));
                      if (captainId === drawerPlayer.id) setCaptainId(null);
                    }
                    setDrawerPlayer(null);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                >
                  {drawerPlayer.position === "COACH" ? "Убрать тренера" : "Убрать из состава"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (drawerPlayer.position === 'COACH') {
                      setSelectedCoach(drawerPlayer.id);
                    } else {
                      if (selectedIds.length < MAX_PLAYERS && !selectedIds.includes(drawerPlayer.id)) {
                        setSelectedIds([...selectedIds, drawerPlayer.id]);
                      }
                    }
                    setDrawerPlayer(null);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {drawerPlayer.position === "COACH" ? "+ Выбрать тренера" : "+ Добавить в состав"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Header & Gameweek Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full mb-8">
          <div className="w-full sm:w-auto text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-2">🎮 Fantasy Hub</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 break-words">Менеджер: <span className="text-emerald-400">{user.managerName}</span></p>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto justify-center">
            <button disabled={!prevGw} onClick={() => setSelectedGwId(prevGw?.id)} className="p-2 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
            <div className="px-4 text-center min-w-[120px]">
              <div className="text-sm font-bold text-white">Тур {selectedGw?.number}</div>
              <div className="text-[10px] text-slate-500 uppercase">{isLocked ? 'История' : 'Трансферы'}</div>
            </div>
            <button disabled={!nextGw} onClick={() => setSelectedGwId(nextGw?.id)} className="p-2 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-5 h-5"/></button>
          </div>
          
          <Link href="/fantasy/leaderboard" className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-sm font-semibold">
            🏆 Рейтинг
          </Link>
        </div>

        {/* Dashboard Stats / Budget */}
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
          {isPast ? (
            <div className="flex items-center justify-center gap-8 mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="text-center">
                <div className="text-xs text-slate-500 uppercase tracking-widest">Очки за тур</div>
                <div className="text-4xl font-black text-emerald-400">{snapshot?.totalPoints ?? '—'}</div>
              </div>
            </div>
          ) : shouldHideBudget ? null : (
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 mb-8 gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500 uppercase tracking-widest">Остаток бюджета</span>
                <span className={isOverBudget ? "text-red-400 font-mono" : "text-slate-400 font-mono"}>{totalCost.toFixed(1)} / {BUDGET}M</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800"><div className={`h-full rounded-full ${isOverBudget ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (totalCost/BUDGET)*100)}%` }}/></div>
            </div>
            <div className={`text-3xl font-black font-mono ${isOverBudget ? "text-red-400" : "text-emerald-400"}`}>
              {remaining.toFixed(1)}<span className="text-slate-500 text-lg">M</span>
            </div>
            <button onClick={handleSave} disabled={!canSave || saving} className="px-6 py-3 rounded-xl font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить состав'}
            </button>
          </div>
        )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full">
          
          {/* Main Pitch Area */}
          <div className="w-full max-w-md lg:max-w-lg flex-shrink-0 mx-auto">
            {shouldHidePitch ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-lg font-bold text-white mb-2">Состав скрыт до дедлайна</h3>
                <p className="text-slate-500 text-sm">Вы сможете увидеть состав менеджера после начала тура.</p>
              </div>
            ) : !isPast || snapshot ? (
              <div className="relative w-full max-w-md mx-auto aspect-[3/4] max-h-[600px] rounded-2xl overflow-hidden border border-emerald-900/30 shadow-2xl" style={{ background: "linear-gradient(to bottom, rgba(6,78,59,0.5) 0%, rgba(10,15,26,1) 100%)" }}>
                <PitchLines />
                
                {/* Positions Map */}
                {[
                  "absolute top-[15%] left-1/2 -translate-x-1/2 z-10",
                  "absolute top-[50%] left-[25%] -translate-x-1/2 z-10",
                  "absolute top-[50%] right-[25%] translate-x-1/2 z-10"
                ].map((posClass, i) => {
                  const p = isPast ? snapPlayers[i] : selectedPlayers[i];
                  return (
                    <div key={i} className={posClass}>
                      {p ? (
                        <PitchCard 
                          player={p} 
                          isCaptain={isPast ? snapshot?.captainPlayerId === p.id : captainId === p.id}
                          isEdit={!isLocked}
                          value={isPast ? (ptsMap.get(p.id) ?? 0) : Number(p.price).toFixed(1)}
                          label={isPast ? 'pts' : 'M'}
                          onRemove={() => { setSelectedIds(selectedIds.filter(id => id !== p.id)); if (captainId === p.id) setCaptainId(null); }}
                          onToggleCaptain={() => setCaptainId(captainId === p.id ? null : p.id)}
                        />
                      ) : !isLocked && (
                        <EmptySlot label="Слот" onAdd={() => setDrawerPlayer(null)} />
                      )}
                    </div>
                  );
                })}

                <div className="absolute bottom-[20%] left-4 right-4 h-px bg-white/10" />
                <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 text-[9px] text-white/20 uppercase tracking-widest">Тренер</div>

                <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 z-10">
                  {(isPast ? snapCoach : (selectedCoach ? allPlayers.find(c => c.id === selectedCoach) : null)) ? (
                    <PitchCard
                      player={(isPast ? snapCoach : allPlayers.find(c => c.id === selectedCoach)) as Player}
                      isEdit={!isLocked}
                      value={isPast ? (snapshot?.coachPoints ?? 0) : ''}
                      label={isPast ? 'pts' : ''}
                      onRemove={() => setSelectedCoach(null)}
                    />
                  ) : !isLocked && (
                    <EmptySlot label="Выбрать" onAdd={() => { setActiveGroup(1); }} /> 
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-bold text-white mb-2">Вы не участвовали в этом туре</h3>
                <p className="text-slate-500 text-sm">Снапшот состава для Тура {selectedGw?.number} не найден.</p>
              </div>
            )}
          </div>

          {/* Player Selection Sidebar (Only in Transfer mode & Owner) */}
          {!isLocked && isOwner && !shouldHidePitch && (
            <div className="w-full max-w-md lg:max-w-lg flex-1 mx-auto bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-[400px] max-h-[60vh] lg:h-[600px] lg:max-h-none">
              <div className="flex border-b border-slate-800 flex-shrink-0">
                {([1, 2] as const).map(g => (
                  <button key={g} onClick={() => { setActiveGroup(g); setPosFilter("ALL"); }} className={`flex-1 py-3 text-sm font-semibold border-b-2 ${activeGroup === g ? 'border-emerald-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {g} группа
                  </button>
                ))}
              </div>
              <div className="flex gap-2 p-3 border-b border-slate-800 overflow-x-auto flex-shrink-0">
                {positions.map(pos => (
                  <button key={pos} onClick={() => setPosFilter(pos)} className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${posFilter === pos ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
                    {pos === "ALL" ? "Все" : pos}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {visible.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm">Игроки не найдены</div>
                )}
                {visible.map(p => {
                  const isSel = selectedIds.includes(p.id) || selectedCoach === p.id;
                  const isFull = p.position === 'COACH' ? !!selectedCoach : selectedIds.length >= MAX_PLAYERS;
                  return (
                    <div key={p.id} onClick={() => setDrawerPlayer(p)} className={`flex items-center justify-between p-3 border-b border-slate-800/50 cursor-pointer ${isSel ? 'bg-emerald-500/5' : isFull ? 'opacity-40' : 'hover:bg-slate-800/50'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${pill(p.position)}`}>{p.position}</span>
                        <div>
                          <div className="text-sm font-bold text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-500">{p.team}</div>
                        </div>
                      </div>
                      <div className="text-emerald-400 font-mono text-sm">{Number(p.price).toFixed(1)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
