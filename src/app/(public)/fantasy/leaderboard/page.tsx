import Link from "next/link";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Лидерборд Fantasy | L Clásico",
  description: "Турнирная таблица Fantasy-лиги L Clásico",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MedalBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span className="text-sm font-bold text-slate-500 tabular-nums w-6 text-center">
      {rank}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);

  // Получаем последний тур (любой статус, даже SETUP)
  const latestGameweek = await db.gameweek.findFirst({
    orderBy: [{ seasonId: "desc" }, { number: "desc" }],
    include: {
      squadSnapshots: {
        select: { userId: true, totalPoints: true, coachPoints: true },
      },
    },
  });

  // Получаем всех юзеров отсортированных по totalPoints
  const users = await db.user.findMany({
    where: { managerName: { not: null } },
    orderBy: { totalPoints: "desc" },
    select: {
      id: true,
      managerName: true,
      totalPoints: true,
    },
  });

  // Карта: userId -> очки за текущий тур
  const gwPointsMap = new Map<string, number>();
  if (latestGameweek) {
    for (const snap of latestGameweek.squadSnapshots) {
      gwPointsMap.set(snap.userId, snap.totalPoints);
    }
  }

  // Сортировка: totalPoints DESC, затем gwPoints DESC
  const sorted = [...users].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const gwA = gwPointsMap.get(a.id) ?? 0;
    const gwB = gwPointsMap.get(b.id) ?? 0;
    return gwB - gwA;
  });

  return (
    <main className="min-h-screen bg-[#0a0f1a] py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              🏆 Лидерборд Fantasy
            </h1>
            {latestGameweek && (
              <p className="text-sm text-slate-500 mt-1">
                Тур {latestGameweek.number} — очки обновляются после каждого матча
              </p>
            )}
          </div>
          <Link
            href="/fantasy"
            className="text-xs font-semibold text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
          >
            ← Мой состав
          </Link>
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="card p-10 text-center text-slate-500 text-sm">
            Пока нет зарегистрированных менеджеров. Создайте состав, чтобы попасть в таблицу.
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem] gap-2 px-5 py-3 border-b border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <div>#</div>
              <div>Менеджер</div>
              <div className="text-right">Тур</div>
              <div className="text-right">Всего</div>
            </div>

            {sorted.map((user, i) => {
              const rank = i + 1;
              const gwPts = gwPointsMap.get(user.id) ?? 0;
              const isMe = session?.user?.id === user.id;

              return (
                <div
                  key={user.id}
                  className={`grid grid-cols-[2.5rem_1fr_5rem_5rem] gap-2 px-5 py-4 items-center border-b border-slate-800/50 last:border-0 transition-colors hover:bg-slate-800/30
                    ${isMe ? "bg-emerald-500/5 border-l-2 border-l-emerald-500" : ""}
                    ${rank === 1 ? "bg-amber-500/5" : ""}
                  `}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-start">
                    <MedalBadge rank={rank} />
                  </div>

                  {/* Manager name */}
                  <Link
                    href={`/fantasy/squad/${user.id}`}
                    className="font-semibold text-sm text-white hover:text-emerald-400 transition-colors truncate group"
                  >
                    {user.managerName}
                    {isMe && (
                      <span className="ml-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        ВЫ
                      </span>
                    )}
                  </Link>

                  {/* Gameweek points */}
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-300 tabular-nums">
                      {gwPts}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-0.5">оч.</span>
                  </div>

                  {/* Total points */}
                  <div className="text-right">
                    <span className={`text-sm font-black tabular-nums ${rank === 1 ? "text-amber-400" : "text-white"}`}>
                      {user.totalPoints}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-0.5">оч.</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 px-1 text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>⚽ Участие в матче: +1</span>
          <span>🎯 Гол: +3</span>
          <span>👟 Ассист: +2</span>
          <span>🌟 MVP (FWD/MID/DEF/GK): +2/+4/+6/+8</span>
          <span>🅲 Капитан: очки ×2</span>
          <span>🧑‍💼 Тренер (победа): +2</span>
        </div>

      </div>
    </main>
  );
}
