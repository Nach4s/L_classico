// ===================================
// L CLASICO V2.0 — Database Seed Script
// Creates: Seasons (S1 archived + S2 active) + Players from config
// ===================================
//
// Usage:
//   npx prisma db seed
//
// Prerequisites:
//   1. DATABASE_URL set in .env
//   2. npx prisma migrate dev (tables created)
//   3. This file registered in package.json:
//      "prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }
// ===================================

import { PrismaClient } from "@prisma/client";
import { SEASON_2_PLAYERS, getTeamName } from "../src/lib/constants/players_config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ─────────────────────────────────
  // 1. Create Seasons
  // ─────────────────────────────────
  console.log("📅 Creating seasons...");

  const season1 = await prisma.season.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Сезон 1",
      isArchived: true,
    },
  });
  console.log(`  ✅ ${season1.name} (archived: ${season1.isArchived})`);

  const season2 = await prisma.season.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "Сезон 2",
      isArchived: false,
    },
  });
  console.log(`  ✅ ${season2.name} (archived: ${season2.isArchived})`);

  // ─────────────────────────────────
  // 2. Create Players from Config
  // ─────────────────────────────────
  console.log("\n⚽ Seeding players...");

  let created = 0;
  let skipped = 0;

  for (const playerConfig of SEASON_2_PLAYERS) {
    const teamName = getTeamName(playerConfig.group);

    const player = await prisma.player.upsert({
      where: { slug: playerConfig.slug },
      update: {
        // Update existing player data if re-seeding
        name: playerConfig.name,
        position: playerConfig.position,
        team: teamName,
        price: playerConfig.price,
        isActive: true,
      },
      create: {
        slug: playerConfig.slug,
        name: playerConfig.name,
        position: playerConfig.position,
        team: teamName,
        price: playerConfig.price,
        isActive: true,
      },
    });

    // Check if this was a create or update
    const wasCreated = player.createdAt.getTime() > Date.now() - 5000;
    if (wasCreated) {
      created++;
      console.log(`  ✅ Created: ${player.name} (${player.position}, ${teamName}, ${player.price}M)`);
    } else {
      skipped++;
      console.log(`  🔄 Updated: ${player.name} (${player.position}, ${teamName}, ${player.price}M)`);
    }
  }

  // ─────────────────────────────────
  // 3. Summary
  // ─────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("📊 Seed Summary:");
  console.log(`  Seasons:  2 (1 archived, 1 active)`);
  console.log(`  Players:  ${created} created, ${skipped} updated`);
  console.log(`  Total:    ${SEASON_2_PLAYERS.length} players in registry`);
  console.log("═".repeat(50));

  // Verify data
  const playerCount = await prisma.player.count();
  const seasonCount = await prisma.season.count();
  console.log(`\n🔍 Verification:`);
  console.log(`  Players in DB: ${playerCount}`);
  console.log(`  Seasons in DB: ${seasonCount}`);

  // Print player breakdown by group
  const group1 = await prisma.player.count({ where: { team: "1 группа" } });
  const group2 = await prisma.player.count({ where: { team: "2 группа" } });
  console.log(`  Group 1: ${group1} players`);
  console.log(`  Group 2: ${group2} players`);

  console.log("\n✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
