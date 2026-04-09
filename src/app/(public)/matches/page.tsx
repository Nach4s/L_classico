import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MatchCard } from "@/components/league/MatchCard";

export const metadata: Metadata = {
  title: "Матчи",
  description: "История всех матчей футбольного дерби L Clásico — счёт, голы, ассисты.",
};

export const revalidate = 300;

// Derive the exact Prisma return type from the query shape
type MatchWithGoals = Prisma.MatchGetPayload<{
  include: {
    goals: {
      include: { scorer: true; assist: true };
    };
  };
}>;

async function getMatches(): Promise<{
  matches: MatchWithGoals[];
  season: { id: number; name: string; isArchived: boolean; createdAt: Date } | null;
}> {
  const activeSeason = await db.season.findFirst({
    where: { isArchived: false },
    orderBy: { id: "desc" },
  });

  if (!activeSeason) return { matches: [], season: null };

  const matches = await db.match.findMany({
    where: { seasonId: activeSeason.id },
    orderBy: { matchDate: "desc" }, // Newest first
    include: {
      goals: {
        include: {
          scorer: true,
          assist: true,
        },
        orderBy: { minute: "asc" },
      },
    },
  });

  return { matches, season: activeSeason };
}

export default async function MatchesPage() {
  const { matches, season } = await getMatches();

  const played = matches.filter((m: MatchWithGoals) => m.score1 !== null);
  const upcoming = matches.filter((m: MatchWithGoals) => m.score1 === null);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚽</span>
          <h1 className="section-title">Матчи</h1>
        </div>
        <p className="section-subtitle">
          {season?.name ?? "Активный сезон"} — {played.length} сыграно
          {upcoming.length > 0 && `, ${upcoming.length} предстоит`}
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card card-body text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-400 text-sm">Матчи ещё не добавлены.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up" style={{ animationDelay: "60ms" }}>
          {/* Upcoming matches section */}
          {upcoming.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                Предстоящие
              </h2>
              <div className="space-y-3">
                {upcoming.map((match: MatchWithGoals) => (
                  <MatchCard key={match.id} match={match} linkable />
                ))}
              </div>
            </div>
          )}

          {/* Played matches section */}
          {played.length > 0 && (
            <div>
              {upcoming.length > 0 && (
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                  Результаты
                </h2>
              )}
              <div className="space-y-3">
                {played.map((match: MatchWithGoals) => (
                  <MatchCard key={match.id} match={match} linkable />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
