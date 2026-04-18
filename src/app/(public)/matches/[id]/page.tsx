import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { GoalWithPlayers } from "@/components/league/MatchCard";
import { MvpVoting } from "@/components/league/MvpVoting";
import { PlayerRatingForm } from "@/components/league/PlayerRatingForm";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({ 
  subsets: ["cyrillic", "latin"], 
  weight: ["400", "600", "700", "900"] 
});

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
      gameweeks: true,
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

// ─── Grouped Goal list item ──────────────────────────────────────────────────

interface GroupedGoal {
  scorer: { id: number; name: string };
  isOwnGoal: boolean;
  count: number;
  assists: string[];
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

function GoalRow({ item, align }: { item: GroupedGoal; align: "left" | "right" }) {
  if (align === "left") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex flex-nowrap items-center gap-1.5 text-sm sm:text-base font-bold">
          <span className={`whitespace-nowrap truncate ${item.isOwnGoal ? "text-red-500" : "text-white"}`}>
            {item.scorer.name}
          </span>
          {/* Ball icon + multiplier */}
          <div className="flex flex-nowrap items-center text-slate-300 gap-0.5">
            ⚽
            {item.count > 1 && (
              <span className="text-[10px] sm:text-xs text-slate-500 font-normal whitespace-nowrap">
                x{item.count}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <div className="flex flex-nowrap items-center gap-1.5 text-sm sm:text-base font-bold">
          {/* Ball icon + multiplier */}
          <div className="flex flex-nowrap items-center text-slate-300 gap-0.5">
            {item.count > 1 && (
              <span className="text-[10px] sm:text-xs text-slate-500 font-normal whitespace-nowrap">
                x{item.count}
              </span>
            )}
            ⚽
          </div>
          <span className={`whitespace-nowrap truncate ${item.isOwnGoal ? "text-red-500" : "text-white"}`}>
            {item.scorer.name}
          </span>
        </div>
      </div>
    );
  }
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
  const hasVotingBeenOpened = match.votingStartedAt !== null || match.votingEndsAt !== null;
  const showVotingBlocks = isPlayed && hasVotingBeenOpened;
  const hasGameweek = match.gameweeks && match.gameweeks.length > 0;

  const team1Goals = groupGoals(match.goals.filter((g) => g.team === match.team1));
  const team2Goals = groupGoals(match.goals.filter((g) => g.team === match.team2));
  const totalGoals = match.goals.length;

  const bgImage = match.backgroundUrl;

  return (
    <main 
      className="relative min-h-screen py-8 sm:py-16 flex flex-col items-center animate-fade-in bg-[#0a0f1a]"
    >
      <div className="w-full max-w-3xl px-4 relative z-10 flex flex-col gap-8 items-center">
        
        {/* Breadcrumb */}
        <div className="w-full flex items-center gap-2 text-xs text-white/50 uppercase tracking-widest font-bold mb-2">
          <a href="/matches" className="hover:text-white transition-colors">
            Матчи
          </a>
          <span>/</span>
          <span className="text-white/80">{match.season.name}</span>
        </div>

        {/* 433 GRAPHIC CARD */}
        <div
          className={`w-full max-w-lg mx-auto rounded-3xl overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/10 ${montserrat.className} ${
            bgImage 
              ? "aspect-[9/16] min-h-[600px] sm:min-h-[800px] flex flex-col justify-end bg-cover bg-top" 
              : "min-h-[350px] sm:min-h-[450px] pb-8 pt-16 flex flex-col justify-center bg-slate-900/80 backdrop-blur-md"
          }`}
          style={bgImage ? { backgroundImage: `url('${bgImage}')` } : {}}
        >
          {/* Smart gradient overlay ONLY if photo exists */}
          {bgImage && (
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-[#0a0f16]/60 to-transparent z-0" />
          )}

          {/* BRANDING LOGO - TOP LEFT */}
          <div className="absolute top-6 left-6 z-20 flex items-center gap-1.5 opacity-90">
            <span className="text-sm font-black text-white uppercase tracking-tighter">L</span>
            <span className="text-sm font-black text-emerald-500 uppercase tracking-tighter">Clásico</span>
          </div>

          {/* Content */}
          <div className={`relative z-10 w-full px-4 sm:px-8 ${bgImage ? "mb-8 mt-auto" : "mt-8"}`}>

            {/* TEAMS AND SCORE */}
            <div className="flex items-center justify-center gap-4 sm:gap-10 px-2">
              {/* TEAM 1 */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 p-0.5 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                  <div className="w-full h-full bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-3xl sm:text-4xl border border-white/20">
                    🔵
                  </div>
                </div>
                <span className="font-black text-white text-xs sm:text-sm uppercase tracking-wider drop-shadow-md max-w-[80px] text-center leading-tight">
                  {match.team1}
                </span>
              </div>

              {/* SCORE */}
              <div className="flex flex-col items-center">
                {isPlayed ? (
                  <>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="text-[3.5rem] sm:text-[5rem] leading-none font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        {match.score1}
                      </span>
                      <span className="text-[2.5rem] sm:text-[3rem] font-light text-white/40 mb-1">-</span>
                      <span className="text-[3.5rem] sm:text-[5rem] leading-none font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        {match.score2}
                      </span>
                    </div>
                    {match.score1 !== match.score2 ? (
                      <div className="mt-2 text-yellow-400 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                        Победа: {(match.score1 ?? 0) > (match.score2 ?? 0) ? match.team1 : match.team2}
                      </div>
                    ) : (
                      <div className="mt-2 text-slate-300 font-black text-[11px] sm:text-xs tracking-[0.2em] uppercase">
                        Ничья
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[2.5rem] sm:text-[4rem] font-black text-white/80 italic tracking-tighter">VS</span>
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-[0.2em]">  Предстоит</span>
                  </div>
                )}
              </div>

              {/* TEAM 2 */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 p-0.5 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                  <div className="w-full h-full bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-3xl sm:text-4xl border border-white/20">
                    🟠
                  </div>
                </div>
                <span className="font-black text-white text-xs sm:text-sm uppercase tracking-wider drop-shadow-md max-w-[80px] text-center leading-tight">
                  {match.team2}
                </span>
              </div>
            </div>

            {/* GOALSCORERS */}
            {isPlayed && totalGoals > 0 && (
              <div className="mt-6 px-1 sm:px-2">
                <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6 w-full">
                  {/* Team 1 Goals */}
                  <div className="flex flex-col gap-3 sm:gap-4 py-1">
                    {team1Goals.map((g, i) => <GoalRow key={i} item={g} align="left" />)}
                  </div>
                  {/* Team 2 Goals */}
                  <div className="flex flex-col gap-3 sm:gap-4 py-1">
                    {team2Goals.map((g, i) => <GoalRow key={i} item={g} align="right" />)}
                  </div>
                </div>
              </div>
            )}

          </div> {/* end bottom content */}
        </div> {/* end 9:16 card */}

        {/* Voting UI Modules (Standard UI below Graphic) */}
        <div className="w-full max-w-3xl flex flex-col gap-6">
          {showVotingBlocks ? (
            <MvpVoting
              matchId={match.id}
              votingEndsAt={match.votingEndsAt?.toISOString() || null}
            />
          ) : (
            <div className="card bg-black/40 backdrop-blur-md border border-white/10 shadow-xl mt-4">
              <div className="p-6 text-sm font-semibold tracking-wider text-white/50 text-center uppercase">
                {isPlayed 
                  ? "Сбор данных... Скоро откроется голосование за MVP."
                  : "Голосование за MVP откроется после завершения матча."}
              </div>
            </div>
          )}

          {showVotingBlocks && hasGameweek && (
            <PlayerRatingForm
              matchId={match.id}
              team1={match.team1}
              team2={match.team2}
              votingEndsAt={match.votingEndsAt?.toISOString() || null}
              votingClosed={match.votingClosed ?? false}
            />
          )}
        </div>

      </div>
    </main>
  );
}
