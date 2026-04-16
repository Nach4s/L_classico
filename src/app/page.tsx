import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "L Clásico — Футбольное Дерби",
  description: "Официальная платформа футбольного дерби L Clásico. Турнирная таблица, статистика игроков и Fantasy лига.",
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  const navItems = [
    {
      href: "/table",
      icon: "🏆",
      label: "Турнирная таблица",
      description: "Очки, разница мячей, форма команд",
      color: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40",
    },
    {
      href: "/matches",
      icon: "⚽",
      label: "Матчи",
      description: "История матчей, голы, ассисты",
      color: "from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40",
    },
    {
      href: "/stats",
      icon: "📊",
      label: "Статистика",
      description: "Бомбардиры и топ ассистентов",
      color: "from-violet-500/10 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40",
    },
    {
      href: "/fantasy",
      icon: "🎮",
      label: "Fantasy лига",
      description: "Собери команду и набирай очки",
      color: "from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
    },
  ];

  return (
    <main className="min-h-screen bg-dots flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        {/* Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Сезон 2 — В прямом эфире
          </div>

          {/* Logo */}
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-white mb-2">
            L{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
              Clásico
            </span>
          </h1>
          <p className="text-slate-400 text-lg mb-12 max-w-md mx-auto leading-relaxed">
            Официальная платформа футбольного дерби.<br />
            Таблица, статистика, Fantasy лига.
          </p>

          {/* Navigation cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto w-full">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative text-left p-5 rounded-2xl bg-gradient-to-br border
                  transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                  ${item.color}`}
              >
                <div className="text-2xl mb-3">{item.icon}</div>
                <div className="font-semibold text-white text-sm mb-0.5">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {item.description}
                </div>
                <div className="absolute top-4 right-4 text-slate-600 group-hover:text-slate-400 transition-colors text-xs">
                  →
                </div>
              </Link>
            ))}
          </div>

          {/* Auth links */}
          {!session && (
            <div className="mt-10 flex items-center gap-3 justify-center">
              <Link
                href="/auth/login"
                className="btn-secondary text-xs px-4 py-2"
              >
                Войти
              </Link>
              <Link
                href="/auth/register"
                className="btn-primary text-xs px-4 py-2"
              >
                Зарегистрироваться
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-700 border-t border-slate-900">
        L Clásico V2.0 — {new Date().getFullYear()}
      </footer>
    </main>
  );
}
