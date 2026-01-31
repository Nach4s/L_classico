async function kickstartLeaderboard() {
    console.log("🚀 Запускаем инициализацию (с исправлением ID)...");
    const db = firebase.firestore();
    const gwId = "gw1";

    // MAPPING: Legacy Integer ID (Index+1) -> New String ID
    // Based on players_data.js order
    const ID_MAP = {
        1: "mansur_sh",
        2: "daulet_e",
        3: "sanzhar_a",
        4: "aibek_a",
        5: "alisher_a",
        6: "shyngys_t",
        7: "asan_t",
        8: "dimash_a",
        9: "akylbek_a",
        10: "yerasyl_k",
        11: "daniiar_a",
        12: "hamid_t"
    };

    // 1. Live Points (String IDs)
    const statsSnapshot = await db.collection('match_stats').doc(gwId).collection('players').get();
    const livePointsMap = {}; // { "aibek_a": 5, ... }

    statsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const pts = (d.statsPoints || 0) + (d.mvpBonus || 0) + (d.ratingBonus || 0);
        if (pts !== 0) livePointsMap[d.playerId] = pts;
    });

    console.log("📊 Live-очки (по String ID):", JSON.stringify(livePointsMap, null, 2));

    // 2. Update Users (Numeric IDs -> String IDs)
    const usersSnapshot = await db.collection('fantasyTeams').get();
    const batch = db.batch();
    let count = 0;

    usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const historyPoints = data.totalPointsAllTime || 0;
        let currentGwPoints = 0;

        if (data.players && Array.isArray(data.players)) {
            data.players.forEach(numericId => {
                // CONVERT NUMERIC TO STRING ID
                const stringId = ID_MAP[numericId];

                if (stringId) {
                    let pts = livePointsMap[stringId] || 0;

                    // Captain Check (Numeric match)
                    if (numericId == data.captainId) pts *= 2;

                    currentGwPoints += pts;
                }
            });
        }

        const realTimeTotal = historyPoints + currentGwPoints;

        // Log check for first user
        if (count === 0) {
            console.log(`Processing ${data.managerName}: GW Points=${currentGwPoints}, Total=${realTimeTotal}`);
        }

        const ref = db.collection('fantasyTeams').doc(doc.id);
        batch.update(ref, {
            live_gw_points: currentGwPoints,
            live_total_points: realTimeTotal,
            livePointsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        count++;
    });

    await batch.commit();
    console.log(`✅ ГОТОВО! Обновлено ${count} пользователей.`);
}
kickstartLeaderboard();
