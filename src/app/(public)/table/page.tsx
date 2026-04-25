import type { Metadata } from "next";
import { db } from "@/lib/db";
import { calculateStandings } from "@/lib/standings";
import { LeagueTable } from "@/components/league/LeagueTable";

export const metadata: Metadata = {
  title: "Турнирная таблица",
  description: "Турнирная таблица футбольного дерби L Clásico. Актуальная статистика команд: победы, голы, очки.",
};

// Revalidate data every 5 minutes
export const revalidate = 300;

async function getStandingsData() {
  // 1. Find the active (non-archived) season
  const activeSeason = await db.season.findFirst({
    where: { isArchived: false },
    orderBy: { id: "desc" },
  });

  if (!activeSeason) return { standings: [], season: null };

  // 2. Fetch all completed matches for this season
  //    "Completed" = score1 and score2 are not null
  const matches = await db.match.findMany({
    where: {
      seasonId: activeSeason.id,
      score1: { not: null },
      score2: { not: null },
    },
    orderBy: { matchDate: "asc" },
    select: {
      score1: true,
      score2: true,
      team1: true,
      team2: true,
      matchDate: true,
    },
  });

  // 3. Run through standings calculator
  const standings = calculateStandings(matches);

  return { standings, season: activeSeason };
}

// ===================================
// Page (Server Component)
// ===================================

export default async function TablePage() {
  const { standings, season } = await getStandingsData();

  return (
    <main className="min-h-screen bg-dots">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        {/* Page Header */}
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏆</span>
            <h1 className="section-title">Турнирная таблица</h1>
          </div>
          {season ? (
            <p className="section-subtitle">
              {season.name} — актуальная статистика команд
            </p>
          ) : (
            <p className="section-subtitle text-red-400">
              Активный сезон не найден
            </p>
          )}
        </div>

        {/* Standings Table */}
        <div className="animate-slide-up" style={{ animationDelay: "80ms" }}>
          <LeagueTable
            standings={standings}
            season={season?.name}
          />
        </div>

        {/* Stats summary cards */}
        {standings.length > 0 && (
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 animate-slide-up"
            style={{ animationDelay: "160ms" }}
          >
            {[
              {
                label: "Сыграно матчей",
                value: standings[0].played,
                icon: "⚽",
              },
              {
                label: "Всего голов",
                value: standings.reduce((sum, t) => sum + t.goalsFor, 0),
                icon: "🥅",
              },
              {
                label: "Лидер",
                value: standings[0]?.team ?? "—",
                icon: "🏅",
              },
              {
                label: "Очков у лидера",
                value: standings[0]?.points ?? 0,
                icon: "📊",
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="card px-4 py-4 text-center">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-lg font-bold text-white tabular-nums">
                  {value}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
