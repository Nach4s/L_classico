import { db } from "@/lib/db";
import Link from "next/link";

// Server Component для страницы "Статистика"
export default async function StatsPage() {
  // 1. Получаем активный сезон
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

  // 2. Параллельный запрос получения игроков и голов
  const [playersInDb, seasonGoals] = await Promise.all([
    db.player.findMany(),
    db.goal.findMany({
      where: {
        match: { seasonId: activeSeason.id },
      },
    }),
  ]);

  // 4. Считаем статистику "на лету"
  const statsMap = new Map<number, { goals: number; assists: number }>();
  
  // Инициализируем карту для всех активных игроков
  playersInDb.forEach((p) => {
    if (p.isActive) {
      statsMap.set(p.id, { goals: 0, assists: 0 });
    }
  });

  seasonGoals.forEach((g) => {
    // Голы
    const scorer = statsMap.get(g.scorerPlayerId);
    if (scorer) {
      scorer.goals += 1;
      statsMap.set(g.scorerPlayerId, scorer);
    } else {
      // Игрок мог быть удален или деактивирован, но добавим его стату
      statsMap.set(g.scorerPlayerId, { goals: 1, assists: 0 });
    }

    // Ассисты
    if (g.assistPlayerId) {
      const assist = statsMap.get(g.assistPlayerId);
      if (assist) {
        assist.assists += 1;
        statsMap.set(g.assistPlayerId, assist);
      } else {
        statsMap.set(g.assistPlayerId, { goals: 0, assists: 1 });
      }
    }
  });

  // 5. Формируем единый массив с данными
  const allStats = Array.from(statsMap.entries()).map(([playerId, stats]) => {
    const player = playersInDb.find((p) => p.id === playerId);
    return {
      id: playerId,
      name: player?.name || `Игрок #${playerId}`,
      position: player?.position || "N/A",
      team: player?.team || "Неизвестно",
      avatarUrl: player?.avatarUrl || null,
      goals: stats.goals,
      assists: stats.assists,
      total: stats.goals + stats.assists,
    };
  });

  // 6. Сортируем списки
  // Исключаем нули, чтобы таблица не была засорена
  const topScorers = [...allStats]
    .filter((s) => s.goals > 0)
    .sort((a, b) => b.goals - a.goals);

  const topAssists = [...allStats]
    .filter((s) => s.assists > 0)
    .sort((a, b) => b.assists - a.assists);

  const topGPlusA = [...allStats]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  // Helper function: Медальки
  const getMedalClass = (index: number) => {
    switch (index) {
      case 0: return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"; // Золото
      case 1: return "text-slate-300 bg-slate-300/10 border-slate-300/20";   // Серебро
      case 2: return "text-amber-600 bg-amber-600/10 border-amber-600/20";   // Бронза
      default: return "text-slate-500 bg-slate-800 border-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-semibold mb-4 tracking-wider uppercase">
            Сезон {activeSeason.name}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
            Публичная Статистика
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Анализируйте лучших бомбардиров и ассистентов турнира для принятия стратегических решений в Фэнтези.
          </p>
        </header>

        {/* 3 Колонки со статистикой */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Бомбардиры */}
          <StatColumn 
            title="Бомбардиры" 
            icon="⚽" 
            data={topScorers} 
            valueKey="goals" 
            emptyText="Голов пока нет" 
          />

          {/* Ассистенты */}
          <StatColumn 
            title="Голевые передачи" 
            icon="🎯" 
            data={topAssists} 
            valueKey="assists" 
            emptyText="Ассистов пока нет" 
          />

          {/* Гол+Пас */}
          <StatColumn 
            title="Система Гол+Пас" 
            icon="🔥" 
            data={topGPlusA} 
            valueKey="total" 
            emptyText="Результативных действий пока нет" 
          />

        </div>
      </div>
    </div>
  );
}

// Переиспользуемый компонент для колонок статистики
function StatColumn({ 
  title, 
  icon, 
  data, 
  valueKey,
  emptyText
}: {
  title: string;
  icon: string;
  data: any[];
  valueKey: string;
  emptyText: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center">
      <div className="w-full bg-slate-900 border-b border-slate-800 p-6 flex flex-col items-center justify-center text-center">
        <span className="text-3xl mb-2">{icon}</span>
        <h2 className="text-lg font-bold text-white tracking-widest uppercase">{title}</h2>
      </div>

      <div className="w-full p-4 flex flex-col gap-3">
        {data.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-medium">{emptyText}</div>
        ) : (
          data.slice(0, 10).map((player, index) => {
            let medalColor = "text-slate-600 border-slate-800";
            let nameColor = "text-white";
            let bgStyle = "bg-slate-900/80";

            if (index === 0) {
               medalColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
               nameColor = "text-yellow-50 font-bold";
               bgStyle = "bg-gradient-to-r from-slate-900 to-yellow-950/20 border-yellow-500/30 shadow-lg shadow-yellow-500/5";
            } else if (index === 1) {
               medalColor = "text-slate-300 bg-slate-300/10 border-slate-300/30";
               bgStyle = "bg-gradient-to-r from-slate-900 to-slate-800/50 border-slate-700";
            } else if (index === 2) {
               medalColor = "text-amber-600 bg-amber-600/10 border-amber-600/30";
               bgStyle = "bg-gradient-to-r from-slate-900 to-amber-950/20 border-amber-900/50";
            } else {
               bgStyle = "bg-slate-900/80 border-slate-800";
            }

            return (
              <div 
                key={player.id} 
                className={`flex items-center gap-4 p-3 rounded-2xl border transition-transform hover:-translate-y-0.5 ${bgStyle}`}
              >
                {/* Медалька/Номер */}
                <div className="relative flex-shrink-0">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full border text-xs font-black mx-1 ${medalColor}`}>
                    {index + 1}
                  </span>
                  {player.avatarUrl && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full border border-slate-800 overflow-hidden shadow-sm">
                      <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Инфо игрока */}
                <div className="flex-1 min-w-0">
                  <Link href={`/players/${player.id}`} className={`block text-[15px] truncate ${nameColor} font-semibold mb-0.5 hover:underline decoration-emerald-500`}>
                    {player.name}
                  </Link>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 font-medium uppercase tracking-wider">
                    <span className="text-emerald-500">{player.position}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                    <span className="truncate">{player.team === "1 группа" ? "Гр 1" : "Гр 2"}</span>
                  </div>
                </div>

                {/* Значение (Голы/Ассисты) */}
                <div className="flex-shrink-0 text-2xl font-black font-mono text-emerald-400 pr-2">
                  {player[valueKey]}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
