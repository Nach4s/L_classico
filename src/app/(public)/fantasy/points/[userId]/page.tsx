import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { managerName: true },
  });
  return {
    title: user?.managerName
      ? `Очки: ${user.managerName} | L Clásico Fantasy`
      : "Очки менеджера | L Clásico Fantasy",
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerData = {
  id: number;
  name: string;
  position: string;
  team: string;
  avatarUrl: string | null;
};

// ─── Pitch SVG lines ──────────────────────────────────────────────────────────

function PitchLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 560"
      preserveAspectRatio="none"
    >
      <rect x="8" y="8" width="384" height="544" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <line x1="8" y1="280" x2="392" y2="280" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <circle cx="200" cy="280" r="55" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <circle cx="200" cy="280" r="2" fill="rgba(255,255,255,0.15)" />
      <rect x="100" y="8" width="200" height="80" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <rect x="145" y="8" width="110" height="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <rect x="100" y="472" width="200" height="80" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <rect x="145" y="520" width="110" height="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

// ─── Player card on pitch ─────────────────────────────────────────────────────

function PitchPlayerCard({
  player,
  points,
  isCaptain,
}: {
  player: PlayerData;
  points: number;
  isCaptain: boolean;
}) {
  const parts = player.name.split(" ");
  const shortName = parts.length > 1 ? parts[parts.length - 1] : parts[0];

  return (
    <div className="flex flex-col items-center gap-0.5 select-none w-16 sm:w-20">
      <div className="relative">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt={player.name}
            className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white/20 shadow-xl shadow-black/40"
          />
        ) : (
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-lg sm:text-2xl shadow-xl">
            👤
          </div>
        )}
        {isCaptain && (
          <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center text-slate-950 text-[8px] sm:text-[10px] font-black shadow-lg">
            C
          </div>
        )}
      </div>

      <div className="bg-slate-900/90 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-full truncate text-center border border-slate-700/50">
        {shortName}
      </div>

      <div className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full border ${
        points > 0
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : points < 0
          ? "bg-red-500/15 border-red-500/30 text-red-400"
          : "bg-slate-800/80 border-slate-700/50 text-slate-500"
      }`}>
        {isCaptain && points > 0 ? `${points} ×2` : `${points} pts`}
      </div>
    </div>
  );
}

// ─── Coach card on pitch ──────────────────────────────────────────────────────

function PitchCoachCard({ coach, points }: { coach: PlayerData | null; points: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 select-none w-16 sm:w-20">
      <div className="relative">
        {coach?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coach.avatarUrl}
            alt={coach.name}
            className="w-9 h-9 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-purple-500/40 shadow-xl shadow-black/40"
          />
        ) : (
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-slate-800/60 border-2 border-purple-500/20 flex items-center justify-center text-lg opacity-50 shadow-xl">
            🧑‍💼
          </div>
        )}
      </div>
      <div className="text-[8px] sm:text-[9px] text-purple-400 font-bold uppercase tracking-widest">
        Тренер
      </div>
      <div className="bg-slate-900/90 text-white text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-full truncate text-center border border-purple-700/30">
        {coach ? coach.name.split(" ").slice(-1)[0] : "Не выбран"}
      </div>
      <div className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full border ${
        points < 0
          ? "bg-red-500/15 border-red-500/30 text-red-400"
          : points > 0
          ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
          : "bg-slate-800/80 border-slate-700/50 text-slate-500"
      }`}>
        {points > 0 ? "+" : ""}{points} pts
      </div>
    </div>
  );
}

// ─── Stat block ───────────────────────────────────────────────────────────────

function StatBlock({ label, value, large }: { label: string; value: string | number; large?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
      <span className={`font-black text-emerald-400 ${large ? "text-4xl" : "text-2xl"}`}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PointsViewPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === userId;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, managerName: true, totalPoints: true },
  });
  if (!user || !user.managerName) notFound();

  const latestGameweek = await db.gameweek.findFirst({
    orderBy: [{ seasonId: "desc" }, { number: "desc" }],
  });

  if (!latestGameweek) {
    return (
      <main className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-3">📅</div>
          <p>Активных туров нет.</p>
        </div>
      </main>
    );
  }

  const deadlinePassed =
    !latestGameweek.deadline || new Date(latestGameweek.deadline) <= new Date();
  const canView = deadlinePassed || isOwner;

  // Snapshot
  const snapshot = await db.gameweekSquadSnapshot.findUnique({
    where: { gameweekId_userId: { gameweekId: latestGameweek.id, userId } },
  });

  let players: PlayerData[] = [];
  let coachPlayer: PlayerData | null = null;
  let captainId: number | null = null;
  let totalPts = 0;
  let coachPts = 0;
  let hasData = false;
  const playerPtsMap = new Map<number, number>();

  if (snapshot) {
    hasData = true;
    const allIds = [
      ...snapshot.playerIds,
      ...(snapshot.coachPlayerId ? [snapshot.coachPlayerId] : []),
    ];
    const fetched = await db.player.findMany({
      where: { id: { in: allIds } },
      select: { id: true, name: true, position: true, team: true, avatarUrl: true },
    });

    players = fetched.filter((p) => snapshot.playerIds.includes(p.id));
    coachPlayer = snapshot.coachPlayerId
      ? (fetched.find((p) => p.id === snapshot.coachPlayerId) ?? null)
      : null;
    captainId = snapshot.captainPlayerId;
    totalPts = snapshot.totalPoints;
    coachPts = snapshot.coachPoints;

    // Реальные очки из GameweekPlayerStat
    const gwStats = await db.gameweekPlayerStat.findMany({
      where: {
        gameweekId: latestGameweek.id,
        playerId: { in: snapshot.playerIds },
      },
    });

    for (const stat of gwStats) {
      const base =
        (stat.played ? 1 : 0) +
        stat.goals * 3 +
        stat.assists * 2 +
        stat.mvpBonus;
      const isCap = snapshot.captainPlayerId === stat.playerId;
      playerPtsMap.set(stat.playerId, isCap ? base * 2 : base);
    }
  }

  // Среднее и максимум по туру
  const allSnaps = await db.gameweekSquadSnapshot.findMany({
    where: { gameweekId: latestGameweek.id },
    select: { totalPoints: true },
  });
  const avgPts =
    allSnaps.length > 0
      ? Math.round(allSnaps.reduce((s, x) => s + x.totalPoints, 0) / allSnaps.length)
      : null;
  const maxPts =
    allSnaps.length > 0 ? Math.max(...allSnaps.map((x) => x.totalPoints)) : null;

  return (
    <main className="min-h-screen bg-[#0a0f1a] py-8 px-4">
      <div className="max-w-sm mx-auto">

        {/* Nav */}
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/fantasy/leaderboard"
            className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
          >
            ← Лидерборд
          </a>
          <div className="flex gap-2">
            <a
              href={`/fantasy/squad/${userId}`}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            >
              Состав
            </a>
            <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              Очки
            </span>
          </div>
        </div>

        {/* Manager + GW */}
        <div className="mb-5 text-center">
          <h1 className="text-lg font-black text-white">{user.managerName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Тур {latestGameweek.number}
            {!deadlinePassed && " · состав зафиксируется при дедлайне"}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-end gap-2 mb-3 px-2">
          <StatBlock label="Среднее" value={avgPts ?? "—"} />
          <StatBlock label="Очки" value={totalPts} large />
          <StatBlock label="Максимум" value={maxPts ?? "—"} />
        </div>
        <div className="text-center text-xs text-slate-600 mb-6">
          Всего за сезон:{" "}
          <span className="text-white font-semibold">{user.totalPoints}</span>
        </div>

        {/* Content */}
        {!canView ? (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <p className="font-semibold text-slate-300 text-sm">Состав скрыт до дедлайна</p>
            <p className="text-xs text-slate-600 mt-1">
              {latestGameweek.deadline
                ? `Откроется ${new Date(latestGameweek.deadline).toLocaleDateString("ru-RU", {
                    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                  })}`
                : "Откроется после начала тура"}
            </p>
          </div>
        ) : !hasData ? (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-slate-500">
              {isOwner
                ? "Состав ещё не зафиксирован. Он сохранится автоматически при наступлении дедлайна."
                : "Менеджер не зафиксировал состав на этот тур."}
            </p>
          </div>
        ) : (
          /* Pitch */
          <div
            className="relative w-full rounded-2xl overflow-hidden border border-emerald-900/30 shadow-2xl"
            style={{
              background: "linear-gradient(to bottom, rgba(6,78,59,0.5) 0%, rgba(10,15,26,1) 100%)",
              paddingBottom: "140%",
            }}
          >
            <PitchLines />

            {/* Top center */}
            {players[0] && (
              <div className="absolute top-[7%] left-1/2 -translate-x-1/2">
                <PitchPlayerCard
                  player={players[0]}
                  points={playerPtsMap.get(players[0].id) ?? 0}
                  isCaptain={captainId === players[0].id}
                />
              </div>
            )}
            {/* Bottom-left */}
            {players[1] && (
              <div className="absolute top-[48%] left-[8%]">
                <PitchPlayerCard
                  player={players[1]}
                  points={playerPtsMap.get(players[1].id) ?? 0}
                  isCaptain={captainId === players[1].id}
                />
              </div>
            )}
            {/* Bottom-right */}
            {players[2] && (
              <div className="absolute top-[48%] right-[8%]">
                <PitchPlayerCard
                  player={players[2]}
                  points={playerPtsMap.get(players[2].id) ?? 0}
                  isCaptain={captainId === players[2].id}
                />
              </div>
            )}

            {/* Bench divider */}
            <div className="absolute bottom-[20%] left-4 right-4 h-px bg-white/10" />
            <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 text-[9px] text-white/20 font-medium uppercase tracking-widest whitespace-nowrap">
              Скамейка
            </div>

            {/* Coach */}
            <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2">
              <PitchCoachCard coach={coachPlayer} points={coachPts} />
            </div>
          </div>
        )}

        {/* Legend */}
        {hasData && canView && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-[10px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1 justify-center">
            <span>⚽ Участие +1</span>
            <span>🎯 Гол +3</span>
            <span>👟 Ассист +2</span>
            <span>🌟 MVP-бонус</span>
            <span>🅲 Капитан ×2</span>
            <span>🧑‍💼 Тренер ±3</span>
          </div>
        )}

        <div className="h-10" />
      </div>
    </main>
  );
}
