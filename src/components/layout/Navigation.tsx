"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_LINKS = [
  { href: "/table", label: "Таблица" },
  { href: "/matches", label: "Матчи" },
  { href: "/stats", label: "Статистика" },
  { href: "/rules", label: "Правила" },
];

export function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="font-black text-lg tracking-tight text-white hover:text-emerald-400 transition-colors flex-shrink-0"
        >
          L{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
            Clásico
          </span>
        </Link>

        {/* Main nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive(href)
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side: auth */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {isLoading ? (
            // Skeleton while session loads
            <div className="h-7 w-20 rounded-lg bg-slate-800 animate-pulse" />
          ) : session ? (
            // Logged in
            <>
              <Link
                href="/profile"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive("/profile")
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
              >
                👤 Профиль
              </Link>
              <Link
                href="/fantasy"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive("/fantasy") && !pathname.startsWith("/fantasy/leaderboard")
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
              >
                🎮 Фэнтези
              </Link>
              <Link
                href="/fantasy/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive("/fantasy/leaderboard")
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
              >
                🏆 Рейтинг
              </Link>

              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${isActive("/admin")
                      ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                      : "text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10"
                    }`}
                >
                  ★ Админка
                </Link>
              )}

              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <span className="text-xs text-slate-500 hidden md:block max-w-[120px] truncate">
                  {session.user.managerName ?? session.user.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700
                             text-slate-400 hover:text-white border border-slate-700/50
                             transition-all duration-150"
                >
                  Выйти
                </button>
              </div>
            </>
          ) : (
            // Logged out
            <>
              <Link
                href="/auth/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium
                           text-slate-400 hover:text-white hover:bg-slate-800/50
                           transition-all duration-150"
              >
                Войти
              </Link>
              <Link
                href="/auth/register"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold
                           bg-emerald-500 hover:bg-emerald-400 text-slate-950
                           transition-all duration-150 active:scale-[0.97]"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Mobile: bottom nav links for small screens */}
      <div className="sm:hidden flex items-center gap-2 px-4 pb-2 pt-1 overflow-x-auto hide-scrollbar border-b border-slate-800/80">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
              ${isActive(href)
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
              }`}
          >
            {label}
          </Link>
        ))}
        {isLoading ? (
          <div className="h-8 w-24 rounded-lg bg-slate-800 animate-pulse ml-2" />
        ) : session ? (
          <>
            <Link
              href="/profile"
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
                ${isActive("/profile") ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
            >
              👤 Профиль
            </Link>
            <Link
              href="/fantasy"
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
                ${isActive("/fantasy") && !pathname.startsWith("/fantasy/leaderboard") ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-white"}`}
            >
              🎮 Фэнтези
            </Link>
            <Link
              href="/fantasy/leaderboard"
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
                ${isActive("/fantasy/leaderboard") ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:text-white"}`}
            >
              🏆 Рейтинг
            </Link>
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
                  ${isActive("/admin") ? "bg-amber-500/20 text-amber-500" : "text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10"}`}
              >
                ★ Админка
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-400 hover:text-white transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/auth/register"
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-emerald-500 text-slate-950 transition-colors"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
