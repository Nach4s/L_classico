"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

const ADMIN_SECTIONS = [
  {
    href: "/admin/matches",
    icon: "⚽",
    title: "Матчи",
    description: "Добавить матч, ввести статистику (голы, ассисты)",
    color: "hover:border-sky-500/40 hover:shadow-sky-500/10",
    badge: null,
  },
  {
    href: "/admin/gameweeks",
    icon: "📅",
    title: "Туры (Gameweeks)",
    description: "Создать тур, зафиксировать составы, завершить тур и начислить очки",
    color: "hover:border-amber-500/40 hover:shadow-amber-500/10",
    badge: "Lock → Finalize",
  },
  {
    href: "/admin/players",
    icon: "🧑‍🤝‍🧑",
    title: "Игроки",
    description: "Добавить игрока, изменить группу, стоимость или деактивировать",
    color: "hover:border-emerald-500/40 hover:shadow-emerald-500/10",
    badge: "CRUD",
  },
  {
    href: "/admin/seasons",
    icon: "🏆",
    title: "Сезоны",
    description: "Создать новый сезон, архивировать старый",
    color: "hover:border-purple-500/40 hover:shadow-purple-500/10",
    badge: null,
  },
];

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      team1: formData.get("team1"),
      team2: formData.get("team2"),
      score1: formData.get("score1"),
      score2: formData.get("score2"),
      match_date: formData.get("match_date"),
    };

    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Ошибка при сохранении матча");
      }

      toast.success("Матч успешно сохранен в базе данных!");
      setMessage({ type: "success", text: "Матч успешно сохранен в базе данных!" });
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message);
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
            Панель Администратора <span className="text-emerald-500">L Clásico</span>
          </h1>
          <p className="text-slate-500 text-sm">Управление лигой, игроками, турами и статистикой</p>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADMIN_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`group bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start gap-5 transition-all hover:shadow-xl ${section.color}`}
            >
              <div className="text-3xl flex-shrink-0 w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-white">{section.title}</h2>
                  {section.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {section.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{section.description}</p>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 self-center">→</span>
            </Link>
          ))}
        </div>

        {/* Quick Add Match Form */}
        <div className="bg-slate-900 shadow-xl rounded-2xl p-6 sm:p-8 border border-slate-800">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-white">
            ⚡ Быстрое добавление матча
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Для ввода детальной статистики (голов, ассистов, MVP) используйте раздел{" "}
            <Link href="/admin/matches" className="text-emerald-400 hover:underline">Матчи →</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Дата матча */}
            <div>
              <label htmlFor="match_date" className="block text-sm font-medium text-slate-400 mb-2">
                Дата матча
              </label>
              <input
                type="date"
                id="match_date"
                name="match_date"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Команды и счет */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <label className="block text-sm text-center font-medium text-slate-400">Команда 1</label>
                <select
                  name="team1"
                  defaultValue="1 группа"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none text-center"
                >
                  <option value="1 группа">1 группа</option>
                  <option value="2 группа">2 группа</option>
                </select>
                <input
                  type="number"
                  name="score1"
                  min="0"
                  required
                  placeholder="Счет"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-center text-3xl font-bold font-mono placeholder:text-slate-700"
                />
              </div>

              <div className="text-slate-600 font-bold text-4xl pt-8">:</div>

              <div className="flex-1 space-y-3">
                <label className="block text-sm text-center font-medium text-slate-400">Команда 2</label>
                <select
                  name="team2"
                  defaultValue="2 группа"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none text-center"
                >
                  <option value="2 группа">2 группа</option>
                  <option value="1 группа">1 группа</option>
                </select>
                <input
                  type="number"
                  name="score2"
                  min="0"
                  required
                  placeholder="Счет"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-center text-3xl font-bold font-mono placeholder:text-slate-700"
                />
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-lg text-sm font-medium ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-500 border border-red-500/20"
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Сохранение...
                </>
              ) : (
                "Сохранить матч в базу"
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
