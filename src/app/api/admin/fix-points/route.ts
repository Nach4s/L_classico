import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function GET() {
  try {
    const snapshots = await db.gameweekSquadSnapshot.findMany({
      include: { gameweek: { include: { playerStats: true } } },
    });

    for (const snap of snapshots) {
      let correctTotal = 0;
      
      for (const playerId of snap.playerIds) {
        const stat = snap.gameweek.playerStats.find(s => s.playerId === playerId);
        if (!stat) continue;
        
        let pts = stat.totalPoints;
        if (snap.captainPlayerId === playerId) {
          pts *= 2;
        }
        correctTotal += pts;
      }
      
      correctTotal += snap.coachPoints;

      await db.gameweekSquadSnapshot.update({
        where: { id: snap.id },
        data: { totalPoints: correctTotal },
      });
    }

    const users = await db.user.findMany({
      include: { squadSnapshots: true },
    });

    for (const user of users) {
      const total = user.squadSnapshots.reduce((acc, snap) => acc + snap.totalPoints, 0);
      await db.user.update({
        where: { id: user.id },
        data: { totalPoints: total },
      });
    }

    revalidatePath("/fantasy/leaderboard");
    revalidatePath("/fantasy", "layout");
    revalidatePath("/", "layout");

    return NextResponse.json({ message: "Данные успешно исправлены!" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
