"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_LINKS = [
  { href: "/table", label: "Таблица" },
  { href: "/matches", label: "Матчи" },
  { href: "/stats", label: "Статистика" },
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoading ? (
            // Skeleton while session loads
            <div className="h-7 w-20 rounded-lg bg-slate-800 animate-pulse" />
          ) : session ? (
            // Logged in
            <>
              <Link
                href="/fantasy"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive("/fantasy")
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
              >
                🎮 Фэнтези
              </Link>

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
      <div className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors
              ${isActive(href)
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-white"
              }`}
          >
            {label}
          </Link>
        ))}
        {session && (
          <Link
            href="/fantasy"
            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors
              ${isActive("/fantasy") ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"}`}
          >
            🎮 Фэнтези
          </Link>
        )}
      </div>
    </header>
  );
}
