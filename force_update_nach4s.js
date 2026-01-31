async function forceUpdateNach4s() {
    console.log("💪 FORCE UPDATING NACH4S SQUAD...");
    const db = firebase.firestore();
    const gwId = "gw1";

    // TARGET SQUAD:
    // Shyngys T. (ID: "shyngys_t", Legacy: 6) [CAPTAIN]
    // Asan T. (ID: "asan_t", Legacy: 7)
    // Daniiar A. (ID: "daniiar_a", Legacy: 11)

    // Mapping for Legacy IDs
    const newPlayersLegacy = [6, 7, 11];
    const newCaptainLegacy = 6;

    const targetIds = ["shyngys_t", "asan_t", "daniiar_a"];

    // 1. Calculate Points from Stats
    let totalGwPoints = 0;

    for (const playerId of targetIds) {
        const doc = await db.collection('match_stats').doc(gwId).collection('players').doc(playerId).get();
        if (doc.exists) {
            const s = doc.data();
            let pts = (s.statsPoints || 0) + (s.mvpBonus || 0) + (s.ratingBonus || 0);

            // Captain Bonus (Shyngys T.)
            if (playerId === "shyngys_t") {
                console.log(`👑 Captain ${s.name}: ${pts} x 2 = ${pts * 2}`);
                pts *= 2;
            } else {
                console.log(`👤 Player ${s.name}: ${pts}`);
            }

            totalGwPoints += pts;
        } else {
            console.warn(`⚠️ No stats for ${playerId}`);
        }
    }

    console.log(`📊 Calculated Total: ${totalGwPoints}`);

    // 2. Update User
    const snapshot = await db.collection('fantasyTeams').where('managerName', '==', 'Nach4s').get();
    if (snapshot.empty) {
        console.error("❌ User Nach4s not found!");
        return;
    }

    const userDoc = snapshot.docs[0];
    const historyPoints = userDoc.data().totalPointsAllTime || 0;
    const finalTotal = historyPoints + totalGwPoints;

    await userDoc.ref.update({
        players: newPlayersLegacy,
        captainId: newCaptainLegacy,
        live_gw_points: totalGwPoints,
        live_total_points: finalTotal,
        livePointsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ UPDATED NACH4S SUCCESSFULLY!`);
    console.log(`Squad: [${newPlayersLegacy}] (Captain: ${newCaptainLegacy})`);
    console.log(`Points: GW=${totalGwPoints}, Total=${finalTotal}`);
    alert(`Nach4s updated! Total Points: ${finalTotal}`);
}
forceUpdateNach4s();
