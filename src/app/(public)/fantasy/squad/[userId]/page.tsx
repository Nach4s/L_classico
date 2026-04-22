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
  const user = await db.user.findUnique({ where: { id: userId }, select: { managerName: true } });
  return {
    title: user?.managerName
      ? `Состав: ${user.managerName} | L Clásico Fantasy`
      : "Состав игрока | L Clásico Fantasy",
  };
}

// ─── Position badge ───────────────────────────────────────────────────────────

function PositionBadge({ pos }: { pos: string }) {
  const colors: Record<string, string> = {
    GK: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    DEF: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    MID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    FWD: "bg-red-500/15 text-red-400 border-red-500/30",
    COACH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };
  return (
    <span
      className={`inline-flex items-center justify-center text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border uppercase ${colors[pos] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}
    >
      {pos}
    </span>
  );
}

// ─── Player card ──────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  isCaptain,
  isViceCaptain,
}: {
  player: { id: number; name: string; position: string; team: string; avatarUrl: string | null };
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}) {
  const teamColor = player.team === "1 группа" ? "from-blue-600/20" : "from-orange-600/20";

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-b ${teamColor} to-slate-900/80 border-slate-700/50 p-4 flex flex-col items-center gap-2 text-center shadow-lg
        ${isCaptain ? "ring-2 ring-amber-500/60 border-amber-500/40" : ""}
      `}
    >
      {/* Captain/VC badge */}
      {isCaptain && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
          Капитан ©
        </div>
      )}
      {isViceCaptain && !isCaptain && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          Вице-кап.
        </div>
      )}

      {/* Avatar */}
      <div className="relative mt-2">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt={player.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-slate-700"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl">
            👤
          </div>
        )}
      </div>

      {/* Name */}
      <div className="font-bold text-sm text-white leading-tight mt-1">{player.name}</div>

      {/* Position + team */}
      <div className="flex items-center gap-1.5">
        <PositionBadge pos={player.position} />
        <span className="text-[10px] text-slate-500">
          {player.team === "1 группа" ? "Гр. 1" : "Гр. 2"}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SquadViewPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === userId;

  // Получаем пользователя
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, managerName: true, totalPoints: true },
  });
  if (!user || !user.managerName) notFound();

  // Получаем последний активный тур
  const latestGameweek = await db.gameweek.findFirst({
    orderBy: [{ seasonId: "desc" }, { number: "desc" }],
  });

  if (!latestGameweek) {
    return (
      <main className="min-h-screen bg-[#0a0f1a] py-12 px-4 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-3">📅</div>
          <p>Активных туров пока нет.</p>
        </div>
      </main>
    );
  }

  // Проверяем дедлайн — если дедлайн ещё не наступил, скрываем состав от посторонних
  const deadlinePassed =
    !latestGameweek.deadline || new Date(latestGameweek.deadline) <= new Date();
  const shouldHide = !isOwner && !deadlinePassed;

  // Получаем снапшот
  const snapshot = await db.gameweekSquadSnapshot.findUnique({
    where: {
      gameweekId_userId: {
        gameweekId: latestGameweek.id,
        userId,
      },
    },
  });

  // Получаем игроков из снапшота
  let players: {
    id: number;
    name: string;
    position: string;
    team: string;
    avatarUrl: string | null;
  }[] = [];
  let coachPlayer: typeof players[0] | null = null;
  let captainId: number | null = null;
  let viceCaptainId: number | null = null;
  let totalPts = 0;
  let coachPts = 0;
  let isCurrentSelection = false;

  if (snapshot) {
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
    viceCaptainId = snapshot.viceCaptainPlayerId;
    totalPts = snapshot.totalPoints;
    coachPts = snapshot.coachPoints;
  } else if (isOwner) {
    // Снапшота нет, но это владелец — показываем его текущую команду
    const fantasyTeam = await db.fantasyTeam.findUnique({
      where: { userId_seasonId: { userId, seasonId: latestGameweek.seasonId } },
      include: {
        players: {
          include: {
            player: { select: { id: true, name: true, position: true, team: true, avatarUrl: true } }
          }
        },
        coach: { select: { id: true, name: true, position: true, team: true, avatarUrl: true } }
      }
    });

    if (fantasyTeam && fantasyTeam.players.length > 0) {
      isCurrentSelection = true;
      players = fantasyTeam.players.map(p => p.player);
      coachPlayer = fantasyTeam.coach || null;
      captainId = fantasyTeam.players.find(p => p.isCaptain)?.player.id || null;
      viceCaptainId = fantasyTeam.players.find(p => p.isViceCaptain)?.player.id || null;
      totalPts = 0;
      coachPts = 0;
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0f1a] py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <a
            href="/fantasy/leaderboard"
            className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-wider mb-4 inline-block"
          >
            ← Лидерборд
          </a>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-black text-white">
                {user.managerName}
              </h1>
              <p className="text-sm text-slate-500">Тур {latestGameweek.number}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-amber-400">{totalPts}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">очков за тур</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Всего: <span className="text-white font-semibold">{user.totalPoints}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Squad */}
        {shouldHide ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <p className="font-semibold text-slate-400 text-sm">Состав скрыт до дедлайна тура</p>
            <p className="text-xs text-slate-600 mt-1">
              Составы открываются после{" "}
              {latestGameweek.deadline
                ? new Date(latestGameweek.deadline).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "начала тура"}
            </p>
          </div>
        ) : !snapshot && !isCurrentSelection ? (
          <div className="card p-10 text-center text-slate-500 text-sm">
            <div className="text-4xl mb-3">📋</div>
            {isOwner
              ? "Вы ещё не собрали состав."
              : "Менеджер не зафиксировал состав на этот тур."}
          </div>
        ) : (
          <>
            {isCurrentSelection && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-center">
                <span className="font-bold">Вы ещё не зафиксировали состав на этот тур.</span>
                <br />
                Ниже показан ваш текущий выбранный состав:
              </div>
            )}
            {/* Players grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isCaptain={captainId === p.id}
                  isViceCaptain={viceCaptainId === p.id}
                />
              ))}
            </div>

            {/* Coach */}
            {coachPlayer && (
              <div className="card p-4 flex items-center gap-4 border border-purple-500/20 bg-purple-500/5">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                  🧑‍💼
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-0.5">Тренер</div>
                  <div className="font-bold text-sm text-white truncate">{coachPlayer.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {coachPlayer.team === "1 группа" ? "Гр. 1" : "Гр. 2"}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-black ${coachPts < 0 ? "text-red-400" : "text-purple-400"}`}>
                    {coachPts > 0 ? "+" : ""}{coachPts}
                  </div>
                  <div className="text-[10px] text-slate-600">бонус</div>
                </div>
              </div>
            )}

            {/* Points breakdown */}
            <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>⚽ Участие: +1</span>
              <span>🎯 Гол: +3</span>
              <span>👟 Ассист: +2</span>
              <span>🌟 MVP-бонус: +2 — +8</span>
              <span>🅲 Капитан: очки ×2</span>
              <span>🧑‍💼 Тренер: ±3 очка</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
