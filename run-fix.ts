import { PrismaClient } from "@prisma/client";

// Подключаемся напрямую к рабочей базе
const db = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.eqhlfhwxumwaofnxeoaf:Xy34wLdLQncECBzw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function fix() {
  console.log("Подключаемся к рабочей БД и исправляем очки...");

  const snapshots = await db.gameweekSquadSnapshot.findMany({
    include: { gameweek: { include: { playerStats: true } } },
  });

  for (const snap of snapshots) {
    let correctTotal = 0;
    
    // Считаем правильные очки за тур (включая ratingBonus)
    for (const playerId of snap.playerIds) {
      const stat = snap.gameweek.playerStats.find(s => s.playerId === playerId);
      if (!stat) continue;
      
      let pts = stat.totalPoints;
      if (snap.captainPlayerId === playerId) {
        pts *= 2;
      }
      correctTotal += pts;
    }
    
    // Добавляем очки тренера
    correctTotal += snap.coachPoints;

    console.log(`Тур ${snap.gameweek.number}, Менеджер (ID ${snap.userId}): правильные очки = ${correctTotal}, было = ${snap.totalPoints}`);
    
    await db.gameweekSquadSnapshot.update({
      where: { id: snap.id },
      data: { totalPoints: correctTotal },
    });
  }

  // Чиним общие очки пользователя
  const users = await db.user.findMany({
    include: { squadSnapshots: true },
  });

  for (const user of users) {
    const total = user.squadSnapshots.reduce((acc, snap) => acc + snap.totalPoints, 0);
    console.log(`Пользователь ${user.email}: правильные общие очки = ${total}, было = ${user.totalPoints}`);
    
    await db.user.update({
      where: { id: user.id },
      data: { totalPoints: total },
    });
  }

  console.log("Данные успешно исправлены! Можете обновлять страницу на сайте.");
}

fix()
  .catch(e => console.error(e))
  .finally(() => db.$disconnect());
