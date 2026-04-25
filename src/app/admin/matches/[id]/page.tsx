"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminMvpPanel } from "@/components/admin/AdminMvpPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  position: string;
  team: string;
  slug: string;
}

interface Goal {
  id: number;
  team: string;
  isOwnGoal: boolean;
  scorer: { id: number; name: string; team: string };
  assist: { id: number; name: string; team: string } | null;
}

interface Match {
  id: number;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  matchDate: string;
  season: { name: string };
  backgroundUrl: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.5rem",
        height: "2.5rem",
        borderRadius: "0.5rem",
        background: "rgb(15 23 42)",
        border: "1px solid rgb(51 65 85)",
        fontSize: "1.25rem",
        fontWeight: 700,
        color: score !== null ? "rgb(52 211 153)" : "rgb(100 116 139)",
      }}
    >
      {score !== null ? score : "—"}
    </span>
  );
}

function GoalItem({ goal, index, onDelete }: { goal: Goal; index: number; onDelete?: (id: number) => void }) {
  const teamColor =
    goal.team === "1 группа" ? "rgb(52 211 153)" : "rgb(251 146 60)";

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        background: "rgb(15 23 42)",
        border: "1px solid rgb(30 41 59)",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      {/* Goal number */}
      <span
        style={{
          flexShrink: 0,
          width: "1.5rem",
          height: "1.5rem",
          borderRadius: "50%",
          background: "rgb(30 41 59)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "rgb(100 116 139)",
        }}
      >
        {index + 1}
      </span>

      {/* Team dot */}
      <span
        style={{
          flexShrink: 0,
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "50%",
          background: teamColor,
          boxShadow: `0 0 8px ${teamColor}`,
        }}
      />

      {/* Scorer + assist */}
      <span style={{ flex: 1, fontSize: "0.95rem", color: "rgb(226 232 240)" }}>
        <strong style={{ color: "white", fontWeight: 600 }}>
          {goal.scorer.name}
          {goal.isOwnGoal && (
            <span style={{ color: "rgb(239 68 68)", fontWeight: 400, fontSize: "0.85rem", marginLeft: "0.3rem" }}>
              (автогол)
            </span>
          )}
        </strong>
        {goal.assist && (
          <span style={{ color: "rgb(100 116 139)", fontSize: "0.85rem" }}>
            {" "}
            <span style={{ color: "rgb(71 85 105)" }}>пас:</span>{" "}
            <span style={{ color: "rgb(148 163 184)" }}>{goal.assist.name}</span>
          </span>
        )}
      </span>

      {onDelete && (
        <button
          onClick={() => onDelete(goal.id)}
          title="Удалить гол"
          style={{
            flexShrink: 0,
            marginRight: "0.5rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "rgb(239 68 68)",
            borderRadius: "0.4rem",
            width: "1.8rem",
            height: "1.8rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 68, 68, 0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 68, 68, 0.1)";
          }}
        >
          ✕
        </button>
      )}

      {/* Team label */}
      <span
        style={{
          flexShrink: 0,
          fontSize: "0.7rem",
          fontWeight: 600,
          padding: "0.2rem 0.5rem",
          borderRadius: "0.375rem",
          border: `1px solid ${teamColor}33`,
          color: teamColor,
          background: `${teamColor}11`,
        }}
      >
        {goal.team === "1 группа" ? "Гр. 1" : "Гр. 2"}
      </span>
    </li>
  );
}

// ─── Select component ─────────────────────────────────────────────────────────

function StyledSelect({
  id,
  value,
  onChange,
  children,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        background: "rgb(15 23 42)",
        border: "1px solid rgb(51 65 85)",
        color: value ? "white" : "rgb(100 116 139)",
        fontSize: "0.9rem",
        outline: "none",
        transition: "border-color 0.2s",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.75rem center",
        backgroundSize: "1.25rem",
        paddingRight: "2.5rem",
      }}
    >
      {children}
    </select>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  // Data state
  const [match, setMatch] = useState<Match | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<"1 группа" | "2 группа">("1 группа");
  const [scorerPlayerId, setScorerPlayerId] = useState("");
  const [assistPlayerId, setAssistPlayerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isOwnGoal, setIsOwnGoal] = useState(false);

  // Background URL state
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [savingBg, setSavingBg] = useState(false);

  // ── Fetch goals ──────────────────────────────────────────────────────────────
  const fetchGoals = useCallback(async () => {
    const res = await fetch(`/api/admin/matches/${matchId}/goals`);
    if (res.ok) {
      const data = await res.json();
      setGoals(data.goals);
    }
  }, [matchId]);

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [matchRes, playersRes, goalsRes] = await Promise.all([
          fetch(`/api/admin/matches/${matchId}`),
          fetch("/api/players"),
          fetch(`/api/admin/matches/${matchId}/goals`),
        ]);

        if (!matchRes.ok) throw new Error("Матч не найден");

        const [matchData, playersData, goalsData] = await Promise.all([
          matchRes.json(),
          playersRes.json(),
          goalsRes.json(),
        ]);

        setMatch(matchData.match);
        setBackgroundUrl(matchData.match.backgroundUrl ?? "");
        setPlayers(playersData.players ?? []);
        setGoals(goalsData.goals ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [matchId]);

  // ── Add goal ──────────────────────────────────────────────────────────────
  const handleDeleteGoal = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить этот гол?")) return;
    try {
      const res = await fetch(`/api/admin/goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка при удалении гола");
      fetchGoals();
      toast.success("Гол успешно удален!");
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scorerPlayerId) {
      setSubmitError("Выберите автора гола");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`/api/admin/matches/${matchId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: selectedTeam,
          scorer_player_id: scorerPlayerId,
          assist_player_id: assistPlayerId || null,
          is_own_goal: isOwnGoal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");

      // Update goals list optimistically
      setGoals((prev) => [...prev, data.goal]);
      setSubmitSuccess(true);
      toast.success("Гол успешно добавлен!");
      setScorerPlayerId("");
      setAssistPlayerId("");
      setTimeout(() => setSubmitSuccess(false), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка сервера";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Save background URL ───────────────────────────────────────────────────
  const handleSaveBackground = async () => {
    setSavingBg(true);
    try {
      const urlToSave = backgroundUrl.trim() || null;

      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundUrl: urlToSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      toast.success("Фон сохранён!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingBg(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSavingBg(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");

      // Store the relative path as-is (/match-previews/filename.jpg).
      // Using window.location.origin here causes the image to break
      // when the page is viewed on a different host or port.
      const relativeUrl = data.url; // e.g. "/match-previews/1234-photo.jpg"

      setBackgroundUrl(relativeUrl);

      const patchRes = await fetch(`/api/admin/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundUrl: relativeUrl }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error ?? "Ошибка при привязке фона к матчу");

      toast.success("Фон загружен и сохранён!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingBg(false);
      if (e.target) e.target.value = "";
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // Filter players by selected team for scorer/assist selects
  const teamPlayers = players.filter((p) => p.team === selectedTeam);
  const oppositeTeam = selectedTeam === "1 группа" ? "2 группа" : "1 группа";
  const opponentPlayers = players.filter((p) => p.team === oppositeTeam);
  
  const scorerPlayers = isOwnGoal ? opponentPlayers : teamPlayers;

  // Count goals per team
  const goals1 = goals.filter((g) => g.team === "1 группа").length;
  const goals2 = goals.filter((g) => g.team === "2 группа").length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(2 6 23)",
        }}
      >
        <div style={{ textAlign: "center", color: "rgb(100 116 139)" }}>
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              border: "3px solid rgb(51 65 85)",
              borderTopColor: "rgb(52 211 153)",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 0.75rem",
            }}
          />
          Загрузка матча...
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "rgb(2 6 23)",
        }}
      >
        <p style={{ color: "rgb(239 68 68)", fontSize: "1.1rem" }}>
          ⚠️ {error ?? "Матч не найден"}
        </p>
        <button className="btn-secondary" onClick={() => router.push("/admin")}>
          ← Назад в админку
        </button>
      </div>
    );
  }

  const matchDateFormatted = new Date(match.matchDate).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Global animation keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        select:focus { border-color: rgb(52 211 153) !important; box-shadow: 0 0 0 3px rgba(52,211,153,0.15); }
      `}</style>

      <main
        style={{
          minHeight: "100vh",
          background: "rgb(2 6 23)",
          padding: "2rem 1rem",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {/* ── Back link ── */}
          <button
            onClick={() => router.push("/admin")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "rgb(100 116 139)",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.15s",
              padding: 0,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgb(226 232 240)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgb(100 116 139)")}
          >
            ← Назад в админку
          </button>

          {/* ── Match header card ── */}
          <div
            style={{
              background: "rgb(15 23 42)",
              border: "1px solid rgb(30 41 59)",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              marginBottom: "1.5rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative glow */}
            <div
              style={{
                position: "absolute",
                top: "-40px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "200px",
                height: "80px",
                background: "radial-gradient(ellipse, rgba(52,211,153,0.15) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            <div style={{ textAlign: "center", position: "relative" }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "rgb(52 211 153)",
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "999px",
                  marginBottom: "1rem",
                  textTransform: "uppercase",
                }}
              >
                {match.season?.name ?? "Сезон"} · {matchDateFormatted}
              </span>

              {/* Score display */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1.25rem",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontSize: "0.8rem", color: "rgb(100 116 139)", marginBottom: "0.3rem" }}>
                    {match.team1}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "rgb(52 211 153)",
                      fontWeight: 600,
                    }}
                  >
                    {goals1} гол{goals1 === 1 ? "" : goals1 < 5 ? "а" : "ов"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <ScoreBadge score={match.score1} />
                  <span style={{ color: "rgb(71 85 105)", fontWeight: 700, fontSize: "1.1rem" }}>:</span>
                  <ScoreBadge score={match.score2} />
                </div>

                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: "0.8rem", color: "rgb(100 116 139)", marginBottom: "0.3rem" }}>
                    {match.team2}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "rgb(251 146 60)",
                      fontWeight: 600,
                    }}
                  >
                    {goals2} гол{goals2 === 1 ? "" : goals2 < 5 ? "а" : "ов"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Add goal form ── */}
          <div
            style={{
              background: "rgb(15 23 42)",
              border: "1px solid rgb(30 41 59)",
              borderRadius: "1.25rem",
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid rgb(30 41 59)",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>⚽</span>
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "white",
                  margin: 0,
                }}
              >
                Добавить гол
              </h2>
            </div>

            <form onSubmit={handleAddGoal} style={{ padding: "1.25rem 1.5rem" }}>
              <div
                style={{
                  display: "grid",
                  gap: "1rem",
                  gridTemplateColumns: "1fr",
                }}
              >
                {/* Team select */}
                <div>
                  <label
                    htmlFor="select-team"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgb(148 163 184)",
                      marginBottom: "0.4rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Команда
                  </label>
                  <StyledSelect
                    id="select-team"
                    value={selectedTeam}
                    onChange={(v) => {
                      setSelectedTeam(v as "1 группа" | "2 группа");
                      setScorerPlayerId("");
                      setAssistPlayerId("");
                    }}
                  >
                    <option value="1 группа">⚽ 1 группа</option>
                    <option value="2 группа">⚽ 2 группа</option>
                  </StyledSelect>
                </div>

                {/* Own Goal Checkbox */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "-0.2rem", marginBottom: "0.2rem" }}>
                  <input
                    type="checkbox"
                    id="is-own-goal"
                    checked={isOwnGoal}
                    onChange={(e) => {
                      setIsOwnGoal(e.target.checked);
                      setScorerPlayerId("");
                      setAssistPlayerId("");
                    }}
                    style={{
                      width: "1.1rem",
                      height: "1.1rem",
                      accentColor: "rgb(52 211 153)",
                      cursor: "pointer",
                      background: "rgb(15 23 42)",
                      border: "1px solid rgb(51 65 85)",
                      borderRadius: "0.25rem",
                    }}
                  />
                  <label
                    htmlFor="is-own-goal"
                    style={{
                      fontSize: "0.85rem",
                      color: "rgb(226 232 240)",
                      cursor: "pointer",
                      userSelect: "none"
                    }}
                  >
                    Это автогол (мяч забит в свои ворота)
                  </label>
                </div>

                {/* Scorer select */}
                <div>
                  <label
                    htmlFor="select-scorer"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgb(148 163 184)",
                      marginBottom: "0.4rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {isOwnGoal ? "Автор автогола (Игрок соперника) *" : "Автор гола *"}
                  </label>
                  <StyledSelect
                    id="select-scorer"
                    value={scorerPlayerId}
                    onChange={setScorerPlayerId}
                    disabled={scorerPlayers.length === 0}
                  >
                    <option value="">— Выберите игрока —</option>
                    {scorerPlayers.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} ({p.position})
                      </option>
                    ))}
                  </StyledSelect>
                  {scorerPlayers.length === 0 && (
                    <p
                      style={{
                        marginTop: "0.4rem",
                        fontSize: "0.75rem",
                        color: "rgb(239 68 68)",
                      }}
                    >
                      В базе нет игроков для «{isOwnGoal ? oppositeTeam : selectedTeam}».
                    </p>
                  )}
                </div>

                {/* Assist select */}
                {!isOwnGoal && (
                  <div>
                    <label
                      htmlFor="select-assist"
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "rgb(148 163 184)",
                        marginBottom: "0.4rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Ассистент{" "}
                      <span style={{ color: "rgb(71 85 105)", fontWeight: 400, textTransform: "none" }}>
                        (необязательно)
                      </span>
                    </label>
                    <StyledSelect
                      id="select-assist"
                      value={assistPlayerId}
                      onChange={setAssistPlayerId}
                      disabled={teamPlayers.length === 0}
                    >
                      <option value="">— Без ассиста —</option>
                      {teamPlayers
                        .filter((p) => String(p.id) !== scorerPlayerId)
                        .map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} ({p.position})
                          </option>
                        ))}
                    </StyledSelect>
                  </div>
                )}
              </div>

              {/* Error / success feedback */}
              {submitError && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.6rem 1rem",
                    borderRadius: "0.6rem",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "rgb(252 165 165)",
                    fontSize: "0.85rem",
                  }}
                >
                  ⚠️ {submitError}
                </div>
              )}

              {submitSuccess && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.6rem 1rem",
                    borderRadius: "0.6rem",
                    background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.25)",
                    color: "rgb(110 231 183)",
                    fontSize: "0.85rem",
                  }}
                >
                  ✓ Гол успешно добавлен!
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting || !scorerPlayerId}
                style={{
                  marginTop: "1.25rem",
                  width: "100%",
                  padding: "0.85rem 1.5rem",
                  borderRadius: "0.875rem",
                  border: "none",
                  background:
                    submitting || !scorerPlayerId
                      ? "rgb(30 41 59)"
                      : "rgb(52 211 153)",
                  color:
                    submitting || !scorerPlayerId ? "rgb(71 85 105)" : "rgb(2 6 23)",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: submitting || !scorerPlayerId ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
                onMouseEnter={(e) => {
                  if (!submitting && scorerPlayerId) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgb(110 231 183)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting && scorerPlayerId) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgb(52 211 153)";
                  }
                }}
              >
                {submitting ? (
                  <>
                    <span
                      style={{
                        width: "1rem",
                        height: "1rem",
                        borderRadius: "50%",
                        border: "2px solid rgba(2,6,23,0.3)",
                        borderTopColor: "rgb(2 6 23)",
                        animation: "spin 0.7s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Добавление...
                  </>
                ) : (
                  <>⚽ Добавить гол</>
                )}
              </button>
            </form>
          </div>

          {/* ── Goals list ── */}
          <div
            style={{
              background: "rgb(15 23 42)",
              border: "1px solid rgb(30 41 59)",
              borderRadius: "1.25rem",
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid rgb(30 41 59)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1rem" }}>📋</span>
                <h2
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "white",
                    margin: 0,
                  }}
                >
                  Голы матча
                </h2>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.6rem",
                  borderRadius: "999px",
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  color: "rgb(52 211 153)",
                }}
              >
                {goals.length}
              </span>
            </div>

            <div style={{ padding: "1rem 1.5rem" }}>
              {goals.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2.5rem 1rem",
                    color: "rgb(71 85 105)",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏃</div>
                  <p style={{ fontSize: "0.9rem" }}>Голов пока нет. Добавьте первый!</p>
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {goals.map((goal, i) => (
                    <GoalItem key={goal.id} goal={goal} index={i} onDelete={handleDeleteGoal} />
                  ))}
                </ul>
              )}
            </div>
          </div>

          <AdminMvpPanel matchId={matchId} />

          {/* ── Background Image Card ── */}
          <div
            style={{
              background: "rgb(15 23 42)",
              border: "1px solid rgb(30 41 59)",
              borderRadius: "1.25rem",
              overflow: "hidden",
              marginTop: "1.5rem",
            }}
          >
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid rgb(30 41 59)",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>🖼️</span>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "white", margin: 0 }}>
                Фон страницы матча
              </h2>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              <p style={{ fontSize: "0.8rem", color: "rgb(100 116 139)", marginBottom: "0.75rem" }}>
                Загрузите фото для фона страницы матча (рекомендуется формат 9:16)
              </p>
              {backgroundUrl && (
                <div
                  style={{
                    marginBottom: "0.75rem",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    height: "120px",
                    background: `url(${backgroundUrl}) center/cover no-repeat`,
                    border: "1px solid rgb(51 65 85)",
                    position: "relative",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
                  <span style={{ position: "absolute", bottom: "0.5rem", right: "0.75rem", fontSize: "0.7rem", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                    Предпросмотр
                  </span>
                </div>
              )}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={backgroundUrl}
                  onChange={(e) => setBackgroundUrl(e.target.value)}
                  placeholder="Или URL-адрес фото..."
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.75rem",
                    background: "rgb(2 6 23)",
                    border: "1px solid rgb(51 65 85)",
                    color: "white",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
                
                <label
                  htmlFor="bg-file-upload"
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderRadius: "0.75rem",
                    background: savingBg ? "rgb(51 65 85)" : "rgba(59, 130, 246, 0.1)",
                    border: savingBg ? "1px solid rgb(51 65 85)" : "1px solid rgba(59, 130, 246, 0.3)",
                    color: savingBg ? "rgb(148 163 184)" : "rgb(96 165 250)",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    cursor: savingBg ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/*
                    iOS Safari ignores display:none inputs even with htmlFor.
                    Using opacity:0 + position:absolute makes it physically
                    present (so iOS triggers it) but visually invisible.
                  */}
                  <input
                    id="bg-file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={savingBg}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                      fontSize: 0,
                    }}
                  />
                  {savingBg ? "Загрузка..." : "📤 Загрузить фото"}
                </label>

                <button
                  onClick={handleSaveBackground}
                  disabled={savingBg}
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderRadius: "0.75rem",
                    background: savingBg ? "rgb(51 65 85)" : "rgb(52 211 153)",
                    color: "rgb(2 6 23)",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    border: "none",
                    cursor: savingBg ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.2s",
                  }}
                >
                  {savingBg ? "..." : "💾 Сохранить URL"}
                </button>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              onClick={fetchGoals}
              style={{
                background: "none",
                border: "none",
                color: "rgb(71 85 105)",
                fontSize: "0.8rem",
                cursor: "pointer",
                padding: "0.4rem 0.75rem",
                borderRadius: "0.5rem",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgb(148 163 184)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgb(71 85 105)")}
            >
              ↻ Обновить список голов
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Admin MVP Section ────────────────────────────────────────────────────────
function AdminMvpSection({ matchId }: { matchId: string }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState(false);

  const loadMvp = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/vote`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.results || []);
        setClosed(data.votingClosed);
      }
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadMvp() }, [loadMvp]);

  const handleApprove = async () => {
    if (!confirm("Утвердить MVP? Будут начислены бонусы в Points Engine.")) return;
    setSetting(true);
    try {
      const leader = candidates[0];
      if (!leader) throw new Error("Нет кандидата");
      const res = await fetch(`/api/admin/matches/${matchId}/set-mvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: leader.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("MVP успешно утвержден!");
      loadMvp();
    } catch(e:any) {
      toast.error("Ошибка: " + e.message);
    } finally {
      setSetting(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ background: "rgb(15 23 42)", border: "1px solid rgb(30 41 59)", borderRadius: "1.25rem", marginTop: "1.5rem" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgb(30 41 59)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
         <span style={{ fontSize: "1rem" }}>⭐</span>
         <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "white", margin: 0 }}>Результаты голосования MVP</h2>
      </div>
      <div style={{ padding: "1.25rem 1.5rem" }}>
         {candidates.length > 0 ? (
           <div style={{ marginBottom: "1rem" }}>
             <p style={{ color: "rgb(148 163 184)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Текущий лидер (будет назначен):</p>
             <div style={{ color: "rgb(52 211 153)", fontSize: "1.1rem", fontWeight: "bold" }}>
               {candidates[0].name} — {candidates[0].votes} {candidates[0].votes === 1 ? "голос" : "голосов"}
             </div>
           </div>
         ) : (
           <p style={{ color: "rgb(148 163 184)", fontSize: "0.9rem", marginBottom: "1rem" }}>Голосов пока нет</p>
         )}
         
         {!closed ? (
           <button 
             onClick={handleApprove} 
             disabled={setting || candidates.length === 0}
             style={{ background: "rgb(245 158 11)", color: "rgb(2 6 23)", padding: "0.85rem 1rem", borderRadius: "0.875rem", fontWeight: "bold", border: "none", cursor: candidates.length === 0 ? "not-allowed" : "pointer", width: "100%", opacity: (setting || candidates.length === 0) ? 0.7 : 1, transition: "background 0.2s" }}
           >
             {setting ? "Утверждение..." : "Утвердить MVP"}
           </button>
         ) : (
           <div style={{ padding: "0.75rem", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "rgb(52 211 153)", textAlign: "center", borderRadius: "0.5rem", fontWeight: "bold" }}>
             ✓ MVP утвержден и закрыт
           </div>
         )}
      </div>
    </div>
  );
}
