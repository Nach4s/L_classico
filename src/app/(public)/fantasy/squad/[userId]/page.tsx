import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { FantasyHub } from "@/components/fantasy/FantasyHub";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const user = await db.user.findUnique({ where: { id: userId }, select: { managerName: true } });
  return {
    title: user?.managerName
      ? `Состав: ${user.managerName} | L Clásico Fantasy`
      : "Состав игрока | L Clásico Fantasy",
  };
}

export default async function SquadViewPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === userId;

  // Fetch User
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, managerName: true, totalPoints: true },
  });

  if (!user || !user.managerName) notFound();

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

  // Fetch all players
  const allPlayers = await db.player.findMany();

  // Fetch Player Stats
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
      isOwner={isOwner}
    />
  );
}
