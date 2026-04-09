// ===================================
// L CLASICO V2.0 — Players Configuration
// Season 2 Player Registry
// ===================================
//
// This file is the SINGLE SOURCE OF TRUTH for player data.
// Edit prices, positions, and names here before running `prisma db seed`.
// Changes here are reflected in the database after re-seeding.
// ===================================

import { Position } from "@prisma/client";

export interface PlayerConfig {
  slug: string;        // Unique identifier (URL-safe, DB key)
  name: string;        // Display name (Cyrillic)
  position: Position;  // GK | DEF | MID | FWD
  group: 1 | 2;        // Team group (1 = "1 группа", 2 = "2 группа")
  price: number;       // Fantasy price in millions (e.g., 6.5)
}

// ===================================
// SEASON 2 — Player Roster
// ===================================
// 12 players: 6 per group
// Prices are approximate — edit as needed before seeding
// ===================================

export const SEASON_2_PLAYERS: PlayerConfig[] = [
  // ─────────────────────────────────
  // 1 ГРУППА (Team 1)
  // ─────────────────────────────────
  {
    slug: "mansur_sh",
    name: "Мансур Ш.",
    position: "FWD",
    group: 1,
    price: 6.5,
  },
  {
    slug: "daulet_e",
    name: "Даулет Е.",
    position: "MID",
    group: 1,
    price: 7.0,
  },
  {
    slug: "sanzhar_a",
    name: "Санжар А.",
    position: "MID",
    group: 1,
    price: 7.0,
  },
  {
    slug: "aibek_a",
    name: "Айбек А.",
    position: "FWD",
    group: 1,
    price: 6.7,
  },
  {
    slug: "alisher_a",
    name: "Алишер А.",
    position: "DEF",
    group: 1,
    price: 3.0,
  },
  {
    slug: "shyngys_t",
    name: "Шынгыс Т.",
    position: "FWD",
    group: 1,
    price: 6.3,
  },

  // ─────────────────────────────────
  // 2 ГРУППА (Team 2)
  // ─────────────────────────────────
  {
    slug: "asan_t",
    name: "Асан Т.",
    position: "DEF",
    group: 2,
    price: 6.2,
  },
  {
    slug: "dimash_a",
    name: "Димаш А.",
    position: "GK",
    group: 2,
    price: 2.5,
  },
  {
    slug: "akylbek_a",
    name: "Акылбек А.",
    position: "FWD",
    group: 2,
    price: 9.0,
  },
  {
    slug: "yerasyl_k",
    name: "Ерасыл К.",
    position: "FWD",
    group: 2,
    price: 7.5,
  },
  {
    slug: "daniiar_a",
    name: "Данияр А.",
    position: "MID",
    group: 2,
    price: 5.6,
  },
  {
    slug: "hamid_t",
    name: "Хамид Т.",
    position: "DEF",
    group: 2,
    price: 2.5,
  },
];

// ===================================
// HELPERS
// ===================================

/** Get team string from group number */
export function getTeamName(group: 1 | 2): string {
  return `${group} группа`;
}

/** Fantasy config constants */
export const FANTASY_CONFIG = {
  MAX_SQUAD_SIZE: 3,        // Players per squad
  STARTING_BUDGET: 18.0,    // Budget in millions
  CAPTAIN_MULTIPLIER: 2,    // Captain points multiplier
  TRIPLE_CAPTAIN_MULTIPLIER: 3, // Triple Captain chip

  // Coaches
  COACHES: {
    nurzhan: { name: "Нуржан", group: 1 as const },
    uali: { name: "Уали", group: 2 as const },
  },

  // Points formulas
  POINTS: {
    GOAL: 3,
    ASSIST: 2,
    PARTICIPATION: 1,
    MVP_BONUS: {
      GK: 8,
      DEF: 6,
      MID: 4,
      FWD: 2,
    } as Record<Position, number>,
    COACH_WIN: 2,
    COACH_LOSS: -2,
  },

  // Rating bonus tiers
  RATING_BONUS: [
    { min: 9.0, defensive: 8, offensive: 5 },
    { min: 8.0, defensive: 5, offensive: 3 },
    { min: 7.0, defensive: 2, offensive: 1 },
    { min: 6.0, defensive: 0, offensive: 0 },
    { min: 4.5, defensive: -2, offensive: -2 },
    { min: 0.0, defensive: -4, offensive: -4 },
  ],

  // League standings
  LEAGUE: {
    WIN_POINTS: 3,
    DRAW_POINTS: 1,
    LOSS_POINTS: 0,
  },
} as const;
