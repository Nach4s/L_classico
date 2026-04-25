"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

export function AdminMvpPanel({ matchId }: { matchId: string }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [votingClosed, setVotingClosed] = useState(false);
  const [votingEndsAt, setVotingEndsAt] = useState<string | null>(null);
  const [approvedMvpId, setApprovedMvpId] = useState<number | null>(null);
  const [pointsProcessed, setPointsProcessed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);

  const loadVoting = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/vote`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.results || []);
        setVotingClosed(data.votingClosed ?? false);
        setVotingEndsAt(data.votingEndsAt ?? null);
        setApprovedMvpId(data.approvedMvpId ?? null);
        setPointsProcessed(data.pointsProcessed ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadVoting(); }, [loadVoting]);

  const votingActive = !votingClosed && votingEndsAt && new Date(votingEndsAt) > new Date();

  const timeLeft = (() => {
    if (!votingEndsAt || votingClosed) return null;
    const diff = new Date(votingEndsAt).getTime() - Date.now();
    if (diff <= 0) return "Истекло";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}ч ${m}м`;
  })();

  const handleOpenVoting = async () => {
    if (!confirm("Открыть MVP-голосование на 24 часа?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/open-voting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoursOpen: 24 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Голосование открыто на 24 часа!");
      loadVoting();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleCloseVoting = async () => {
    if (!confirm("Закрыть голосование досрочно?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/open-voting`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Голосование закрыто.");
      loadVoting();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleApproveMvp = async () => {
    const leader = candidates[0];
    if (!leader || !confirm(`Утвердить ${leader.name} как MVP матча?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/set-mvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: leader.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("MVP успешно назначен");
      loadVoting();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleAnonVote = async (playerId: number, action: "add" | "remove") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/anon-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadVoting();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); }
  };

  const handleProcessPoints = async () => {
    if (!confirm(pointsProcessed ? "Очки уже были начислены. Пересчитать заново?" : "Начислить очки всем игрокам за этот матч?")) return;
    setPointsLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/process-points`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Очки успешно начислены");
      loadVoting();
    } catch (e: any) { toast.error(e.message); }
    finally { setPointsLoading(false); }
  };

  const handleFinalizeRatings = async () => {
    if (!confirm("Применить народный рейтинг к игрокам? Это добавит бонусы согласно FotMob-системе.")) return;
    setPointsLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/finalize-ratings`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Рейтинги успешно применены");
    } catch (e: any) { toast.error(e.message); }
    finally { setPointsLoading(false); }
  };

  if (loading) return null;

  return (
    <div
      style={{
        background: "rgb(15 23 42)",
        border: "1px solid rgba(168,85,247,0.2)",
        borderRadius: "1.25rem",
        marginTop: "1.5rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgb(30 41 59)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🗳️</span>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "white", margin: 0 }}>
            Голосование за MVP
          </h2>
        </div>
        {votingActive && timeLeft && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "rgb(52 211 153)",
              background: "rgba(52,211,153,0.1)",
              border: "1px solid rgba(52,211,153,0.2)",
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "rgb(52 211 153)",
                animation: "none",
              }}
            />
            Активно · {timeLeft}
          </div>
        )}
        {votingClosed && (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "rgb(100 116 139)",
              background: "rgb(30 41 59)",
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
            }}
          >
            ✓ Закрыто
          </span>
        )}
        {!votingActive && !votingClosed && !votingEndsAt && (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "rgb(245 158 11)",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
            }}
          >
            ⏳ Не открыто
          </span>
        )}
      </div>

      <div style={{ padding: "1.25rem 1.5rem" }}>
        {/* Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {!votingActive && !votingClosed && (
            <button
              onClick={handleOpenVoting}
              disabled={actionLoading}
              style={{
                flex: 1,
                padding: "0.85rem 1rem",
                borderRadius: "0.875rem",
                border: "none",
                background: "rgb(52 211 153)",
                color: "rgb(2 6 23)",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? "Открытие..." : "🟢 Открыть голосование (24ч)"}
            </button>
          )}
          {votingActive && (
            <>
              <button
                onClick={handleCloseVoting}
                disabled={actionLoading}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.875rem",
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.1)",
                  color: "rgb(252 165 165)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                🔴 Закрыть досрочно
              </button>
              <button
                onClick={loadVoting}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.875rem",
                  border: "1px solid rgb(51 65 85)",
                  background: "rgb(30 41 59)",
                  color: "rgb(148 163 184)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ↻ Обновить
              </button>
            </>
          )}

          {/* Process points button */}
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleFinalizeRatings}
              disabled={pointsLoading}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                border: "none",
                background: "rgb(16 185 129)", // emerald-500
                color: "white",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: pointsLoading ? "not-allowed" : "pointer",
                boxShadow: "0 0 15px rgba(16, 185, 129, 0.3)",
              }}
            >
              📊 Применить рейтинг
            </button>
            <button
              onClick={handleProcessPoints}
              disabled={pointsLoading}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                border: "none",
                background: pointsProcessed ? "rgb(30 41 59)" : "rgb(139 92 246)",
                color: pointsProcessed ? "rgb(148 163 184)" : "white",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: pointsLoading ? "not-allowed" : "pointer",
                boxShadow: pointsProcessed ? "none" : "0 0 15px rgba(139, 92, 246, 0.3)",
              }}
            >
              {pointsLoading ? "Обработка..." : pointsProcessed ? "✓ Очки начислены (Пересчитать)" : "⚡ Начислить очки за матч"}
            </button>
          </div>
        </div>

        {/* Results table */}
        {candidates.length > 0 ? (
          <div>
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "rgb(100 116 139)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "0.75rem",
              }}
            >
              Результаты ({candidates.reduce((s: number, c: any) => s + c.votes, 0)} голосов)
            </p>
            {candidates.slice(0, 6).map((c: any, i: number) => {
              const total = candidates.reduce((s: number, x: any) => s + x.votes, 0);
              const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.85rem", width: "1.5rem", textAlign: "center", flexShrink: 0 }}>
                    {i === 0 ? "🥇" : `${i + 1}.`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "white" }}>{c.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "rgb(100 116 139)" }}>{c.votes} · {pct}%</span>
                        {!votingClosed && (
                          <div style={{ display: "flex", gap: "2px" }}>
                            <button
                              onClick={() => handleAnonVote(c.id, "remove")}
                              disabled={actionLoading || c.votes === 0}
                              style={{
                                width: "20px", height: "20px", borderRadius: "4px", border: "1px solid rgb(51 65 85)", background: "rgb(30 41 59)", color: "white", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                              }}
                            >-</button>
                            <button
                              onClick={() => handleAnonVote(c.id, "add")}
                              disabled={actionLoading}
                              style={{
                                width: "20px", height: "20px", borderRadius: "4px", border: "1px solid rgb(51 65 85)", background: "rgb(30 41 59)", color: "white", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                              }}
                            >+</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ height: "6px", background: "rgb(30 41 59)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: i === 0 ? "rgb(245 158 11)" : "rgb(51 65 85)",
                          borderRadius: "4px",
                          transition: "width 0.5s",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {(votingClosed || (votingEndsAt && new Date(votingEndsAt) <= new Date())) && candidates[0] && (
              <div style={{ paddingTop: "1rem", borderTop: "1px solid rgb(30 41 59)", marginTop: "1rem" }}>
                <p style={{ fontSize: "0.8rem", color: "rgb(100 116 139)", marginBottom: "0.75rem" }}>
                  Лидер:{" "}
                  <strong style={{ color: "rgb(245 158 11)" }}>{candidates[0].name}</strong>{" "}
                  ({candidates[0].votes} голосов)
                </p>
                {approvedMvpId ? (
                  <button
                    disabled
                    style={{
                      width: "100%",
                      padding: "0.85rem 1rem",
                      borderRadius: "0.875rem",
                      border: "none",
                      background: "rgb(30 41 59)",
                      color: "rgb(148 163 184)",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: "not-allowed",
                      opacity: 0.8,
                    }}
                  >
                    🌟 MVP Утвержден
                  </button>
                ) : (
                  <button
                    onClick={handleApproveMvp}
                    disabled={actionLoading}
                    style={{
                      width: "100%",
                      padding: "0.85rem 1rem",
                      borderRadius: "0.875rem",
                      border: "none",
                      background: "rgb(245 158 11)",
                      color: "rgb(2 6 23)",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                      opacity: actionLoading ? 0.6 : 1,
                    }}
                  >
                    {actionLoading ? "Сохранение..." : "⭐ Утвердить MVP"}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p style={{ textAlign: "center", color: "rgb(71 85 105)", fontSize: "0.875rem", padding: "1.5rem 0" }}>
            Голосов пока нет. Откройте голосование, чтобы пользователи выбрали MVP.
          </p>
        )}
      </div>
    </div>
  );
}
