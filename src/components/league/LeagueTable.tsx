import type { TeamStanding, FormResult } from "@/lib/standings";

// ===================================
// Form badge: W / D / L indicator
// ===================================

function FormBadge({ result }: { result: FormResult }) {
  const styles = {
    W: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
    D: "bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/50",
    L: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  };

  const labels = { W: "П", D: "Н", L: "П" }; // Победа / Ничья / Поражение
  const title = { W: "Победа", D: "Ничья", L: "Поражение" };

  return (
    <span
      title={title[result]}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${styles[result]}`}
    >
      {result}
    </span>
  );
}

// ===================================
// Stat cell — compact number column
// ===================================

function StatCell({
  value,
  highlight = false,
  positive = false,
}: {
  value: number | string;
  highlight?: boolean;
  positive?: boolean;
}) {
  let colorClass = "text-slate-400";
  if (highlight && typeof value === "number") {
    if (value > 0) colorClass = "text-emerald-400";
    else if (value < 0) colorClass = "text-red-400";
    else colorClass = "text-slate-400";
  }
  if (positive) colorClass = "text-white font-semibold";

  return (
    <td className={`px-3 py-4 text-center text-sm tabular-nums ${colorClass}`}>
      {value}
    </td>
  );
}

// ===================================
// Main Component
// ===================================

interface LeagueTableProps {
  standings: TeamStanding[];
  season?: string; // e.g. "Сезон 2"
}

export function LeagueTable({ standings, season }: LeagueTableProps) {
  if (standings.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-400 text-sm">
            Матчи ещё не сыграны. Таблица появится после первого матча.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="card-header flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Турнирная таблица</h2>
          {season && (
            <p className="text-xs text-slate-500 mt-0.5">{season}</p>
          )}
        </div>
        <span className="badge-emerald">⚽ L Clásico</span>
      </div>

      {/* Table — scrollable on mobile */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="pl-5 pr-3 py-3 text-left w-8">#</th>
              <th className="px-3 py-3 text-left min-w-[140px]">Команда</th>
              <th className="px-3 py-3 text-center" title="Сыграно">И</th>
              <th className="px-3 py-3 text-center" title="Победы">В</th>
              <th className="px-3 py-3 text-center" title="Ничьи">Н</th>
              <th className="px-3 py-3 text-center" title="Поражения">П</th>
              <th className="px-3 py-3 text-center" title="Голы">Г</th>
              <th className="px-3 py-3 text-center" title="Разница мячей">±</th>
              <th className="px-3 py-3 text-center font-bold text-slate-300" title="Очки">О</th>
              <th className="px-3 py-3 text-left" title="Форма (последние 5)">Форма</th>
            </tr>
          </thead>

          <tbody>
            {standings.map((team, index) => {
              const isLeader = index === 0;
              const rowClass = isLeader
                ? "border-l-2 border-l-emerald-500"
                : "";

              return (
                <tr key={team.team} className={rowClass}>
                  {/* Position */}
                  <td className="pl-5 pr-3 py-4">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${isLeader
                          ? "bg-emerald-500 text-slate-950"
                          : "text-slate-500"
                        }`}
                    >
                      {index + 1}
                    </span>
                  </td>

                  {/* Team name */}
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0
                          ${team.team === "1 группа"
                            ? "bg-blue-400"
                            : "bg-orange-400"
                          }`}
                      />
                      <span className={`font-medium text-sm ${isLeader ? "text-white" : "text-slate-300"}`}>
                        {team.team}
                      </span>
                    </div>
                  </td>

                  <StatCell value={team.played} />
                  <StatCell value={team.won} />
                  <StatCell value={team.drawn} />
                  <StatCell value={team.lost} />

                  {/* Goals: GF:GA */}
                  <td className="px-3 py-4 text-center text-sm tabular-nums text-slate-400">
                    <span className="text-slate-300">{team.goalsFor}</span>
                    <span className="text-slate-600 mx-0.5">:</span>
                    <span>{team.goalsAgainst}</span>
                  </td>

                  {/* Goal difference */}
                  <StatCell
                    value={team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                    highlight
                  />

                  {/* Points */}
                  <StatCell value={team.points} positive />

                  {/* Form */}
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1">
                      {team.form.length > 0 ? (
                        team.form.map((result, i) => (
                          <FormBadge key={i} result={result} />
                        ))
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 sm:px-5 py-3 border-t border-slate-800/50 flex items-center gap-x-3 gap-y-2.5 flex-wrap">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Форма:</span>
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          {(["W", "D", "L"] as FormResult[]).map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <FormBadge result={r} />
              <span className="text-[11px] text-slate-500">
                {r === "W" ? "Победа" : r === "D" ? "Ничья" : "Поражение"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
