async function kickstartLeaderboard_v2() {
    console.log("🚀 STARTING LEADERBOARD FIX V2...");
    const db = firebase.firestore();
    const gwId = "gw1";

    // MAPPING: Legacy Integer ID -> New String ID
    const ID_MAP = {
        1: "mansur_sh", 2: "daulet_e", 3: "sanzhar_a", 4: "aibek_a",
        5: "alisher_a", 6: "shyngys_t", 7: "asan_t", 8: "dimash_a",
        9: "akylbek_a", 10: "yerasyl_k", 11: "daniiar_a", 12: "hamid_t"
    };

    // 1. Live Points
    console.log("1. Fetching Match Stats...");
    const statsSnapshot = await db.collection('match_stats').doc(gwId).collection('players').get();
    const livePointsMap = {};

    statsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const pts = (d.statsPoints || 0) + (d.mvpBonus || 0) + (d.ratingBonus || 0);
        if (pts !== 0) livePointsMap[d.playerId] = pts;
    });

    console.log(`✅ Loaded points for ${Object.keys(livePointsMap).length} players. Sample:`, Object.keys(livePointsMap)[0], livePointsMap[Object.keys(livePointsMap)[0]]);

    // 2. Update Users
    console.log("2. Updating Users...");
    const usersSnapshot = await db.collection('fantasyTeams').get();
    const batch = db.batch();
    let count = 0;

    usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const historyPoints = data.totalPointsAllTime || 0;
        let currentGwPoints = 0;

        if (data.players) {
            data.players.forEach(pid => {
                let stringId = pid;
                // If numeric, map it
                if (ID_MAP[pid]) {
                    stringId = ID_MAP[pid];
                }

                let pts = livePointsMap[stringId] || 0;
                if (pid == data.captainId) pts *= 2;
                currentGwPoints += pts;
            });
        }

        const realTimeTotal = historyPoints + currentGwPoints;

        // Debug first user
        if (count === 0) {
            console.log(`TEST USER [${data.managerName}]: GW Points calculated as ${currentGwPoints}`);
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
    console.log(`✅ SUCCESS! Updated ${count} users. Check Leaderboard now!`);
}
kickstartLeaderboard_v2();
