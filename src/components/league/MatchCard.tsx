import Link from "next/link";
import type { Match, Goal, Player } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GoalWithPlayers = Goal & {
  scorer: Player;
  assist: Player | null;
};

export type MatchWithGoals = Match & {
  goals: GoalWithPlayers[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function isVotingOpen(match: Match): boolean {
  if (match.votingClosed) return false;
  if (!match.votingEndsAt) return false;
  return new Date(match.votingEndsAt) > new Date();
}

function getMatchStatus(match: Match): "upcoming" | "played" | "voting" {
  if (match.score1 === null || match.score2 === null) return "upcoming";
  if (isVotingOpen(match)) return "voting";
  return "played";
}

// ─── Grouped Goal list item ──────────────────────────────────────────────────

interface GroupedGoal {
  scorer: Player;
  isOwnGoal: boolean;
  count: number;
  assists: string[]; // List of assist names
}

function groupGoals(goals: GoalWithPlayers[]): GroupedGoal[] {
  const grouped: GroupedGoal[] = [];
  for (const g of goals) {
    const existing = grouped.find(
      (item) => item.scorer.id === g.scorer.id && item.isOwnGoal === g.isOwnGoal
    );
    if (existing) {
      existing.count++;
      if (g.assist) existing.assists.push(g.assist.name);
    } else {
      grouped.push({
        scorer: g.scorer,
        isOwnGoal: g.isOwnGoal,
        count: 1,
        assists: g.assist ? [g.assist.name] : [],
      });
    }
  }
  return grouped;
}

function GroupedGoalItem({ item, align }: { item: GroupedGoal; align: "left" | "right" }) {
  const uniqueAssists = Array.from(new Set(item.assists));
  const assistText = uniqueAssists.length > 0 ? `асс. ${uniqueAssists.join(", ")}` : null;

  return (
    <div className={`flex flex-col py-0.5 ${align === "right" ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-100">
        <span>{item.scorer.name}</span>
        {item.isOwnGoal && (
          <span className="text-red-500/90 font-normal text-[11px]">(автогол)</span>
        )}
        <span className="text-slate-400/80 text-xs ml-0.5 mt-[-1px]">
          ⚽{item.count > 1 && <span className="font-semibold text-slate-300 ml-[1px]">x{item.count}</span>}
        </span>
      </div>
      {assistText && (
        <span className={`text-[11px] text-slate-500 mt-0.5 ${align === "right" ? "text-right" : "text-left"}`}>
           {assistText}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchWithGoals;
  linkable?: boolean;
}

export function MatchCard({ match, linkable = false }: MatchCardProps) {
  const status = getMatchStatus(match);
  const isPlayed = status !== "upcoming";

  const team1Goals = groupGoals(match.goals.filter((g) => g.team === match.team1));
  const team2Goals = groupGoals(match.goals.filter((g) => g.team === match.team2));

  const card = (
    <div
      className={`card bg-slate-900/50 backdrop-blur-sm border border-slate-800 shadow-lg shadow-black/20 overflow-hidden transition-all duration-200
        ${linkable ? "hover:border-slate-700 hover:scale-[1.015] hover:bg-[#131b26] cursor-pointer" : ""}
      `}
    >
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5 bg-black/10">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{formatDate(match.matchDate)}</span>
        <div className="flex items-center gap-2">
          {status === "upcoming" && (
            <span className="badge bg-slate-800/80 text-slate-400 border border-slate-700/50 text-[10px] shadow-sm">
              Скоро
            </span>
          )}
          {status === "voting" && (
            <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              🗳 Голосование MVP
            </span>
          )}
          {status === "played" && (
            <span className="badge bg-slate-800/50 text-slate-500 border border-slate-800 text-[10px]">
              Завершён
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 pb-5 flex items-start gap-4">
        {/* Team 1 */}
        <div className="flex-1 flex flex-col items-start gap-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-white tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            {match.team1}
          </div>
          {isPlayed && team1Goals.length > 0 && (
            <div className="pl-4 space-y-1.5 mt-2 w-full">
              {team1Goals.map((g, i) => (
                <GroupedGoalItem key={i} item={g} align="left" />
              ))}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-center min-w-[72px] mt-1 relative z-10">
          {isPlayed ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-black tabular-nums text-white drop-shadow-md">
                {match.score1}
              </span>
              <span className="text-lg text-slate-600 font-light mt-[-2px]">:</span>
              <span className="text-3xl font-black tabular-nums text-white drop-shadow-md">
                {match.score2}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="text-xl font-bold text-slate-600/80">vs</span>
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="flex-1 flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-white tracking-wide">
            {match.team2}
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
          </div>
          {isPlayed && team2Goals.length > 0 && (
            <div className="pr-4 space-y-1.5 mt-2 flex flex-col items-end w-full">
              {team2Goals.map((g, i) => (
                <GroupedGoalItem key={i} item={g} align="right" />
              ))}
            </div>
          )}
        </div>
      </div>

      {isPlayed && match.score1 !== match.score2 && (
        <div className="px-5 pb-3">
          <div className="h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent shadow-[0_0_4px_rgba(16,185,129,0.2)]" />
        </div>
      )}
    </div>
  );

  if (linkable) {
    return <Link href={`/matches/${match.id}`} className="block">{card}</Link>;
  }

  return card;
}
