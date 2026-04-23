import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FantasyHub } from "@/components/fantasy/FantasyHub";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fantasy Hub | L Clásico",
};

export default async function FantasyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;

  // Fetch User
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, managerName: true, totalPoints: true },
  });

  if (!user || !user.managerName) {
    redirect("/fantasy/setup");
  }

  // Fetch Gameweeks
  const allGameweeks = await db.gameweek.findMany({
    orderBy: { number: "asc" },
  });

  // Fetch Active Team Draft
  const activeTeam = await db.fantasyTeam.findFirst({
    where: { userId },
    include: {
      coach: true,
      players: { include: { player: true } }
    }
  });

  // Fetch Snapshots for this user
  const snapshots = await db.gameweekSquadSnapshot.findMany({
    where: { userId },
  });

  // Fetch all players for transfers & rendering
  const allPlayers = await db.player.findMany();

  // Fetch Player Stats for all past gameweeks where user had a snapshot
  const snapshotGwIds = snapshots.map((s) => s.gameweekId);
  let playerStats: any[] = [];
  if (snapshotGwIds.length > 0) {
    playerStats = await db.gameweekPlayerStat.findMany({
      where: {
        gameweekId: { in: snapshotGwIds }
      }
    });
  }

  return (
    <FantasyHub
      user={user}
      allGameweeks={allGameweeks}
      allPlayers={allPlayers}
      activeTeam={activeTeam}
      snapshots={snapshots}
      playerStats={playerStats}
    />
  );
}