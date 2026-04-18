import { db } from "@/lib/db";
import { StatsTabs } from "./StatsTabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Статистика — L Clásico",
};

export default async function StatsPage() {
  const activeSeason = await db.season.findFirst({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  if (!activeSeason) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <span className="text-4xl mb-4 block">⚽</span>
          <h2 className="text-xl font-bold text-white mb-2">Сезон не начался</h2>
          <p className="text-slate-400">Нет активного сезона для отображения статистики.</p>
        </div>
      </div>
    );
  }

  const [playersInDb, allSeasonGoals] = await Promise.all([
    db.player.findMany({ where: { isActive: true } }),
    db.goal.findMany({
      where: { match: { seasonId: activeSeason.id } },
    }),
  ]);

  // ── Считаем статистику (автоголы НЕ идут в личную статистику) ──────────────
  const statsMap = new Map<number, { goals: number; assists: number }>();
  playersInDb.forEach((p) => statsMap.set(p.id, { goals: 0, assists: 0 }));

  allSeasonGoals.forEach((g) => {
    if (!g.isOwnGoal) {
      const scorer = statsMap.get(g.scorerPlayerId);
      if (scorer) scorer.goals += 1;
      else statsMap.set(g.scorerPlayerId, { goals: 1, assists: 0 });
    }
    if (!g.isOwnGoal && g.assistPlayerId) {
      const assist = statsMap.get(g.assistPlayerId);
      if (assist) assist.assists += 1;
      else statsMap.set(g.assistPlayerId, { goals: 0, assists: 1 });
    }
  });

  const allStats = Array.from(statsMap.entries()).map(([playerId, stats]) => {
    const player = playersInDb.find((p) => p.id === playerId);
    return {
      id: playerId,
      name: player?.name ?? `Игрок #${playerId}`,
      position: player?.position ?? "N/A",
      team: player?.team ?? "—",
      goals: stats.goals,
      assists: stats.assists,
      total: stats.goals + stats.assists,
    };
  });

  const topScorers = [...allStats].filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals);
  const topAssists = [...allStats].filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists);
  const topGPlusA  = [...allStats].filter((s) => s.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-semibold mb-4 tracking-wider uppercase">
            {activeSeason.name}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-3">
            Статистика
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto text-base">
            Автоголы в личную статистику не учитываются.
          </p>
        </header>

        <StatsTabs
          topScorers={topScorers}
          topAssists={topAssists}
          topGPlusA={topGPlusA}
        />

      </div>
    </div>
  );
}
