import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Игроки",
  description: "Состав команд L Clasico — все игроки, позиции и статистика.",
};

export const revalidate = 300;

const POSITION_LABELS: Record<string, string> = {
  GK: "Вратарь",
  DEF: "Защитник",
  MID: "Полузащитник",
  FWD: "Нападающий",
  COACH: "Тренер",
};

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  DEF: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MID: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  FWD: "bg-red-500/10 text-red-400 border-red-500/20",
  COACH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

async function getPlayers() {
  const players = await db.player.findMany({
    where: { isActive: true },
    orderBy: [{ team: "asc" }, { position: "asc" }, { name: "asc" }],
  });
  return players;
}

export default async function PlayersPage() {
  const players = await getPlayers();

  const coaches = players.filter((p) => p.position === "COACH");
  const group1 = players.filter((p) => p.team === "1 группа" && p.position !== "COACH");
  const group2 = players.filter((p) => p.team === "2 группа" && p.position !== "COACH");

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 sm:py-16 animate-fade-in">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">👥</span>
          <h1 className="section-title">Игроки</h1>
        </div>
        <p className="section-subtitle">{players.length} участников в текущем сезоне</p>
      </div>

      {/* Coaches */}
      {coaches.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">
            Тренеры
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="card p-4 flex flex-col items-center gap-3 text-center"
              >
                {coach.avatarUrl ? (
                  <img
                    src={coach.avatarUrl}
                    alt={coach.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/30"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 border-2 border-purple-500/20 flex items-center justify-center text-2xl">
                    🧑‍💼
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white text-sm">{coach.name}</p>
                  <p className="text-xs text-slate-500">{coach.team}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    COACH
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[
          { label: "1 группа", color: "bg-blue-400", players: group1 },
          { label: "2 группа", color: "bg-orange-400", players: group2 },
        ].map(({ label, color, players: groupPlayers }) => (
          <div key={label}>
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label}
              <span className="text-xs text-slate-500 font-normal">({groupPlayers.length})</span>
            </h2>

            <div className="space-y-2">
              {groupPlayers.map((player) => (
                <div
                  key={player.id}
                  className="card px-4 py-3 flex items-center gap-3"
                >
                  {player.avatarUrl ? (
                    <img
                      src={player.avatarUrl}
                      alt={player.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border text-[10px] font-bold ${
                        POSITION_COLORS[player.position] ?? "bg-slate-700 text-slate-400 border-slate-600"
                      }`}
                    >
                      {player.position}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{player.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {POSITION_LABELS[player.position] ?? player.position}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        POSITION_COLORS[player.position] ?? "bg-slate-700 text-slate-400 border-slate-600"
                      }`}
                    >
                      {player.position}
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      {Number(player.price).toFixed(1)}M
                    </span>
                  </div>
                </div>
              ))}

              {groupPlayers.length === 0 && (
                <div className="card card-body text-center py-8 text-slate-600 text-sm">
                  Игроков нет
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}