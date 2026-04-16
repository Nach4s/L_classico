import Link from "next/link";

export const metadata = {
  title: "Правила игры | L Clásico",
  description: "Правила Fantasy лиги футбольного турнира L Clásico.",
};

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Хедер */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
            <span className="text-3xl">📖</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Как играть в <span className="text-emerald-500">Fantasy</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Добро пожаловать в менеджерскую лигу L Clásico. Здесь вы собираете свою идеальную команду и соревнуетесь с другими участниками, зарабатывая очки на основе реальных действий игроков на поле.
          </p>
        </div>

        {/* Сетка Правил */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          
          {/* Сборка состава */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-full pointer-events-none group-hover:bg-sky-500/10 transition-colors"></div>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="text-sky-400">🛡️</span> Сборка состава
            </h2>
            <ul className="space-y-4 text-slate-300">
              <li className="flex items-start gap-3">
                <span className="text-sky-500 mt-1">✓</span>
                <span><strong>Состав:</strong> Каждая команда должна состоять ровно из <strong>3-х игроков</strong>. Позиции игроков не имеют жестких ограничений по количеству.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-sky-500 mt-1">✓</span>
                <span><strong>Бюджет:</strong> На сборку состава выделяется виртуальный бюджет в размере <strong>18.0 млн (M)</strong>. Превышать его нельзя.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-sky-500 mt-1">✓</span>
                <span><strong>Капитан (C):</strong> Вы обязаны выбрать одного капитана. Все очки, заработанные капитаном в туре, <strong>умножаются на 2</strong>.</span>
              </li>
            </ul>
          </div>

          {/* Дедлайны и туры */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="text-amber-400">⏳</span> Дедлайны и туры
            </h2>
            <ul className="space-y-4 text-slate-300">
              <li className="flex items-start gap-3">
                <span className="text-amber-500 mt-1">✓</span>
                <span><strong>Туры (Gameweeks):</strong> Соревнование разбито на туры. Каждый тур привязан к одному или нескольким реальным матчам.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-500 mt-1">✓</span>
                <span><strong>Трансферы:</strong> Вы можете бесконечно менять состав, пока окно тура открыто.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-500 mt-1">✓</span>
                <span><strong>Фиксация (Снапшот):</strong> Перед началом первого матча тура наступает Дедлайн. Все ваши текущие составы "замораживаются", и очки считаются <strong>только по зафиксированному составу</strong>. Изменения после дедлайна пойдут уже на следующий тур.</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Система очков (Широкая карточка) */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-bl-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="text-emerald-400">🔥</span> Система начисления очков
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Базовые действия</h3>
               <div className="space-y-3">
                 <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                   <span className="text-slate-300">Выход на поле (Участие)</span>
                   <span className="text-emerald-400 font-bold border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded">+1 очко</span>
                 </div>
                 <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                   <span className="text-slate-300">Забитый гол ⚽</span>
                   <span className="text-emerald-400 font-bold border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded">+3 очка</span>
                 </div>
                 <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                   <span className="text-slate-300">Голевая передача (Ассист) 🎯</span>
                   <span className="text-emerald-400 font-bold border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded">+2 очка</span>
                 </div>
               </div>
            </div>

            <div>
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Бонусы за MVP матча 🌟</h3>
               <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                 Зависит от заявленной позиции игрока (защитникам получать MVP сложнее, поэтому их бонус выше).
               </p>
               <div className="space-y-2 text-sm">
                 <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                   <span className="text-slate-300">Вратарь (GK)</span>
                   <span className="text-amber-500 font-bold">+8 очков</span>
                 </div>
                 <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                   <span className="text-slate-300">Защитник (DEF)</span>
                   <span className="text-amber-500 font-bold">+6 очков</span>
                 </div>
                 <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                   <span className="text-slate-300">Полузащитник (MID)</span>
                   <span className="text-amber-500 font-bold">+4 очка</span>
                 </div>
                 <div className="flex items-center justify-between pb-1">
                   <span className="text-slate-300">Нападающий (FWD)</span>
                   <span className="text-amber-500 font-bold">+2 очка</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Голосование MVP */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <span className="text-purple-400">🗳️</span> Голосование за MVP
          </h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            По окончании каждого матча открывается публичное голосование за звание <strong>Man of the Match</strong> (MVP). На странице матча любой авторизованный пользователь может отдать свой голос за лучшего игрока.
          </p>
          <ul className="text-slate-400 space-y-2 text-sm">
             <li>• У каждого пользователя есть только 1 голос в рамках одного матча.</li>
             <li>• Голосование автоматически закрывается по истечении дедлайна (он отображается на странице).</li>
             <li>• После решения администратора результаты фиксируются, и победитель официально получает бонусные баллы Фэнтези в текущем туре.</li>
          </ul>
        </div>

        {/* Call to action */}
        <div className="text-center pt-6 pb-12">
          <Link href="/fantasy" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
            Собрать команду 🎮
          </Link>
        </div>

      </div>
    </div>
  );
}
