"use client";

import { useState } from "react";
import Link from "next/link";

type PlayerStat = {
  id: number;
  name: string;
  position: string;
  team: string;
  goals: number;
  assists: number;
  total: number;
};

type Tab = "goals" | "assists" | "combined";

const TABS: { key: Tab; label: string; icon: string; valueKey: keyof PlayerStat; emptyText: string }[] = [
  { key: "goals",    label: "Бомбардиры", icon: "⚽", valueKey: "goals",   emptyText: "Голов пока нет" },
  { key: "assists",  label: "Передачи",   icon: "🎯", valueKey: "assists", emptyText: "Ассистов пока нет" },
  { key: "combined", label: "Гол+Пас",   icon: "🔥", valueKey: "total",   emptyText: "Результативных действий нет" },
];

export function StatsTabs({
  topScorers,
  topAssists,
  topGPlusA,
}: {
  topScorers: PlayerStat[];
  topAssists: PlayerStat[];
  topGPlusA: PlayerStat[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("goals");

  const dataMap: Record<Tab, PlayerStat[]> = {
    goals:    topScorers,
    assists:  topAssists,
    combined: topGPlusA,
  };

  const currentTab = TABS.find((t) => t.key === activeTab)!;
  const currentData = dataMap[activeTab];

  return (
    <div className="flex flex-col items-center gap-6">

      {/* Tab switcher */}
      <div className="bg-slate-800/50 rounded-full p-1 inline-flex gap-1 border border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* List card */}
      <div className="w-full max-w-2xl bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-center gap-2 py-5 border-b border-white/5">
          <span className="text-xl">{currentTab.icon}</span>
          <h2 className="text-sm font-black tracking-[0.2em] uppercase text-white">
            {currentTab.label}
          </h2>
        </div>

        {/* Rows */}
        <div className="px-6 py-3">
          {currentData.length === 0 ? (
            <div className="py-14 text-center text-slate-600 text-sm">
              {currentTab.emptyText}
            </div>
          ) : (
            currentData.slice(0, 10).map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-4 py-3.5 ${
                  index < currentData.slice(0, 10).length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                {/* Rank */}
                <span className={`w-5 text-right text-sm font-black flex-shrink-0 ${
                  index === 0 ? "text-yellow-500" :
                  index === 1 ? "text-slate-400"  :
                  index === 2 ? "text-amber-600"  :
                  "text-slate-600"
                }`}>
                  {index + 1}
                </span>

                {/* Medal accent line for top 3 */}
                {index < 3 && (
                  <div className={`w-0.5 h-8 rounded-full flex-shrink-0 ${
                    index === 0 ? "bg-yellow-500/60" :
                    index === 1 ? "bg-slate-400/40" :
                    "bg-amber-600/50"
                  }`} />
                )}

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/players/${player.id}`}
                    className="block text-[15px] font-bold text-white truncate hover:text-emerald-400 transition-colors"
                  >
                    {player.name}
                  </Link>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {player.position} · {player.team === "1 группа" ? "Гр. 1" : "Гр. 2"}
                  </div>
                </div>

                {/* Stat value */}
                <span className="text-2xl font-black text-emerald-400 font-mono flex-shrink-0 tabular-nums">
                  {player[currentTab.valueKey]}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
