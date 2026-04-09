import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { GoalWithPlayers } from "@/components/league/MatchCard";

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getMatch(id: number) {
  const match = await db.match.findUnique({
    where: { id },
    include: {
      goals: {
        include: {
          scorer: true,
          assist: true,
        },
        orderBy: { minute: "asc" },
      },
      mvpVotes: {
        include: { player: true },
      },
      season: true,
    },
  });

  return match;
}

// ─── SEO ──────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatch(Number(id));
  if (!match) return { title: "Матч не найден" };

  const score =
    match.score1 !== null
      ? `${match.score1}:${match.score2}`
      : "vs";

  return {
    title: `${match.team1} ${score} ${match.team2}`,
    description: `Детали матча: голы, ассисты и MVP — L Clásico`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getMvpPlayer(mvpVotes: { player: { name: string }; playerId: number }[]) {
  if (!mvpVotes.length) return null;
  // Count votes per player
  const counts = new Map<number, { name: string; count: number }>();
  for (const vote of mvpVotes) {
    const entry = counts.get(vote.playerId);
    if (entry) entry.count++;
    else counts.set(vote.playerId, { name: vote.player.name, count: 1 });
  }
  // Find max
  let mvp = null;
  let max = 0;
  for (const [, data] of counts) {
    if (data.count > max) {
      max = data.count;
      mvp = data;
    }
  }
  return mvp;
}

// ─── Goal row ─────────────────────────────────────────────────────────────────

function GoalRow({ goal, align }: { goal: GoalWithPlayers; align: "left" | "right" }) {
  const content = (
    <>
      <span className="text-[13px] text-slate-500 w-7 text-center flex-shrink-0">
        {goal.minute ? `${goal.minute}'` : "—"}
      </span>
      <div className={`flex flex-col ${align === "right" ? "items-end" : ""}`}>
        <span className="text-sm font-medium text-slate-100">{goal.scorer.name}</span>
        {goal.assist && (
          <span className="text-[11px] text-slate-500">
            acc. {goal.assist.name}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={`flex items-center gap-2 py-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <span className="text-base flex-shrink-0">⚽</span>
      {content}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatch(Number(id));

  if (!match) notFound();

  const isPlayed = match.score1 !== null && match.score2 !== null;
  const isVotingOpen =
    !match.votingClosed &&
    match.votingEndsAt &&
    new Date(match.votingEndsAt) > new Date();

  const team1Goals = match.goals.filter((g) => g.team === match.team1);
  const team2Goals = match.goals.filter((g) => g.team === match.team2);
  const mvpPlayer = getMvpPlayer(match.mvpVotes);
  const totalGoals = match.goals.length;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-8">
        <a href="/matches" className="hover:text-slate-300 transition-colors">
          Матчи
        </a>
        <span>/</span>
        <span className="text-slate-400">{match.season.name}</span>
      </div>

      {/* Score hero */}
      <div className="card overflow-hidden mb-6 animate-slide-up">
        <div className="px-6 py-8">
          {/* Date */}
          <p className="text-center text-xs text-slate-500 mb-6 capitalize">
            {formatDate(match.matchDate)}
          </p>

          {/* Teams + Score */}
          <div className="flex items-center gap-4 justify-between">
            {/* Team 1 */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">
                🔵
              </div>
              <span className="font-bold text-white text-center">{match.team1}</span>
            </div>

            {/* Score */}
            <div className="flex-shrink-0 text-center px-4">
              {isPlayed ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-5xl font-black text-white tabular-nums">
                      {match.score1}
                    </span>
                    <span className="text-2xl text-slate-600">:</span>
                    <span className="text-5xl font-black text-white tabular-nums">
                      {match.score2}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {totalGoals} {totalGoals === 1 ? "гол" : totalGoals < 5 ? "гола" : "голов"}
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl font-black text-slate-600">vs</span>
                  <span className="text-xs text-slate-600">Матч не сыгран</span>
                </div>
              )}
            </div>

            {/* Team 2 */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl">
                🟠
              </div>
              <span className="font-bold text-white text-center">{match.team2}</span>
            </div>
          </div>

          {/* Winner banner */}
          {isPlayed && match.score1 !== match.score2 && (
            <div className="mt-6 text-center">
              <span className="badge-emerald text-xs px-3 py-1">
                🏆 Победа:{" "}
                {(match.score1 ?? 0) > (match.score2 ?? 0) ? match.team1 : match.team2}
              </span>
            </div>
          )}
          {isPlayed && match.score1 === match.score2 && (
            <div className="mt-6 text-center">
              <span className="badge badge-slate text-xs px-3 py-1">Ничья</span>
            </div>
          )}
        </div>
      </div>

      {/* Goals — two columns */}
      {isPlayed && totalGoals > 0 && (
        <div className="card mb-6 animate-slide-up" style={{ animationDelay: "80ms" }}>
          <div className="card-header">
            <h2 className="text-sm font-semibold text-white">Голы</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-800">
            {/* Team 1 goals */}
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">{match.team1}</p>
              {team1Goals.length > 0 ? (
                team1Goals.map((g) => (
                  <GoalRow key={g.id} goal={g} align="left" />
                ))
              ) : (
                <p className="text-xs text-slate-600 py-2">—</p>
              )}
            </div>
            {/* Team 2 goals */}
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-2 font-medium text-right">
                {match.team2}
              </p>
              {team2Goals.length > 0 ? (
                team2Goals.map((g) => (
                  <GoalRow key={g.id} goal={g} align="right" />
                ))
              ) : (
                <p className="text-xs text-slate-600 py-2 text-right">—</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MVP Block */}
      <div className="card animate-slide-up" style={{ animationDelay: "160ms" }}>
        <div className="card-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">MVP матча</h2>
          {isVotingOpen && (
            <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
              🗳 Голосование открыто
            </span>
          )}
        </div>
        <div className="card-body">
          {mvpPlayer ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
                ⭐
              </div>
              <div>
                <p className="font-semibold text-white">{mvpPlayer.name}</p>
                <p className="text-xs text-slate-500">
                  {mvpPlayer.count} {mvpPlayer.count === 1 ? "голос" : "голоса"}
                </p>
              </div>
            </div>
          ) : isPlayed ? (
            <p className="text-sm text-slate-500">
              {isVotingOpen
                ? "Идёт голосование. Результаты появятся после закрытия."
                : "MVP не определён."}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Голосование откроется после завершения матча.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
