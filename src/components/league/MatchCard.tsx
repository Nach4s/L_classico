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

// ─── Goal list item ───────────────────────────────────────────────────────────

function GoalItem({ goal }: { goal: GoalWithPlayers }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-slate-400 py-0.5">
      <span className="text-slate-500 mt-0.5">⚽</span>
      <span>
        <span className="text-slate-200 font-medium">{goal.scorer.name}</span>
        {goal.minute && (
          <span className="text-slate-600 ml-1">{goal.minute}&apos;</span>
        )}
        {goal.assist && (
          <span className="text-slate-600">
            {" "}
            <span className="text-slate-500">(acc.</span> {goal.assist.name}
            <span className="text-slate-500">)</span>
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchWithGoals;
  /** If true, wraps the card in a Link to /matches/[id] */
  linkable?: boolean;
}

export function MatchCard({ match, linkable = false }: MatchCardProps) {
  const status = getMatchStatus(match);
  const isPlayed = status !== "upcoming";

  const team1Goals = match.goals.filter((g) => g.team === match.team1);
  const team2Goals = match.goals.filter((g) => g.team === match.team2);

  const card = (
    <div
      className={`card overflow-hidden transition-all duration-200
        ${linkable ? "hover:border-slate-700 hover:scale-[1.01] cursor-pointer" : ""}
      `}
    >
      {/* Top bar: date + status badges */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-800/60">
        <span className="text-xs text-slate-500">{formatDate(match.matchDate)}</span>
        <div className="flex items-center gap-2">
          {status === "upcoming" && (
            <span className="badge bg-slate-700/50 text-slate-400 border border-slate-700 text-[10px]">
              Скоро
            </span>
          )}
          {status === "voting" && (
            <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
              🗳 MVP Voting Open
            </span>
          )}
          {status === "played" && (
            <span className="badge bg-slate-700/30 text-slate-500 border border-slate-800 text-[10px]">
              Завершён
            </span>
          )}
        </div>
      </div>

      {/* Score row */}
      <div className="px-5 py-5 flex items-center gap-4">
        {/* Team 1 */}
        <div className="flex-1 flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="font-semibold text-sm text-white">{match.team1}</span>
          </div>
          {isPlayed && team1Goals.length > 0 && (
            <div className="pl-4 space-y-0.5 mt-1">
              {team1Goals.map((g) => (
                <GoalItem key={g.id} goal={g} />
              ))}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-center min-w-[72px]">
          {isPlayed ? (
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-3xl font-black tabular-nums text-white">
                {match.score1}
              </span>
              <span className="text-lg text-slate-600 font-light">:</span>
              <span className="text-3xl font-black tabular-nums text-white">
                {match.score2}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-slate-600">vs</span>
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="flex-1 flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white">{match.team2}</span>
            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
          </div>
          {isPlayed && team2Goals.length > 0 && (
            <div className="pr-4 space-y-0.5 mt-1 flex flex-col items-end">
              {team2Goals.map((g) => (
                <GoalItem key={g.id} goal={g} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Winner highlight */}
      {isPlayed && match.score1 !== match.score2 && (
        <div className="px-5 pb-3">
          <div className="h-0.5 rounded-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        </div>
      )}
    </div>
  );

  if (linkable) {
    return <Link href={`/matches/${match.id}`}>{card}</Link>;
  }

  return card;
}
