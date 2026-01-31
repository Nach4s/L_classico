(async function finalFixLeaderboard() {
    const gwId = "gw1"; // ⚠️ CHECK GAMEWEEK
    console.log(`🚀 STARTING FINAL RECALCULATION (${gwId})...`);

    // Check Auth - Required for Write Permissions
    if (!firebase.auth().currentUser && !window.isAdminLoggedIn) {
        console.error("❌ ERROR: You must be logged in to run this script!");
        alert("Ошибка: Вы должны войти в систему (Log In), чтобы менять базу данных.");
        return;
    }

    const db = firebase.firestore();

    // ==========================================
    // 1. CREATE SMART POINTS MAP (Global Hybrid)
    // ==========================================
    const statsSnapshot = await db.collection('match_stats').doc(gwId).collection('players').get();
    const pointsMap = {};

    statsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        // Calculate Total per logic (Stats + MVP + Rating)
        const totalPts = (d.statsPoints || 0) + (d.mvpBonus || 0) + (d.ratingBonus || 0);

        if (totalPts !== 0) {
            // Store by String ID (e.g. "mansur_sh")
            pointsMap[doc.id] = totalPts;

            // Store by Numeric ID (11) if applicable
            // This covers direct numeric lookups
            if (!isNaN(doc.id)) {
                pointsMap[parseInt(doc.id)] = totalPts;
            }
        }
    });

    console.log(`📊 Points Map Ready (${Object.keys(pointsMap).length} entries)`);

    // ==========================================
    // 2. RECALCULATE ALL USERS
    // ==========================================
    // CRITICAL FIX: Collection name is 'fantasyTeams' (camelCase), not 'FantasyTeams'
    const usersSnapshot = await db.collection('fantasyTeams').get(); // <--- FIXED NAME
    const batch = db.batch();
    let updatedCount = 0;

    usersSnapshot.docs.forEach(doc => {
        const user = doc.data();
        let squadPoints = 0;
        let debugNames = [];

        if (!user.players || user.players.length === 0) return;

        // Iterate players (handles numbers [11, 7] and strings ["id1", "id2"])
        user.players.forEach(p => {
            // Determine ID
            let pId;
            if (typeof p === 'object' && p !== null) {
                pId = p.id || p.playerId;
            } else {
                pId = p; // Number or String
            }

            // Lookup Points (Hybrid Map handles both types)
            let pts = pointsMap[pId] || 0;

            // Captain Multiplier
            // Soft comparison needed (11 == "11")
            let isCaptain = (pId == user.captainId || pId == user.captain);
            if (isCaptain) {
                pts *= 2;
                debugNames.push(`(C)${pId}=${pts}`);
            } else if (pts !== 0) {
                debugNames.push(`${pId}=${pts}`);
            }

            squadPoints += pts;
        });

        // CALCULATE TOTALS FOR LEADERBOARD
        const historyTotal = user.totalPointsAllTime || 0;

        // Logic: Live Total = History + Current GW Live Points
        // Warning: If history already includes this GW, this might double count,
        // but for "Live" display it's usually separate.
        // Assuming 'totalPointsAllTime' is finalized history (without current live gw)
        const newLiveTotal = historyTotal + squadPoints;

        // Update DB
        const ref = db.collection('fantasyTeams').doc(doc.id); // <--- FIXED NAME
        batch.update(ref, {
            // Fields expected by leaderboard.js
            weekPoints: squadPoints,
            totalPoints: newLiveTotal,

            // Detailed fields (optional but good)
            live_gw_points: squadPoints,
            live_total_points: newLiveTotal,
            gameweekPoints: squadPoints,

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (squadPoints !== 0 || user.totalPoints !== newLiveTotal) {
            console.log(`✅ ${user.managerName || doc.id}: +${squadPoints} pts -> Total: ${newLiveTotal}`);
            updatedCount++;
        }
    });

    // ==========================================
    // 3. COMMIT
    // ==========================================
    if (updatedCount > 0) {
        await batch.commit();
        console.log(`🎉 SUCCESS! Updated ${updatedCount} teams.`);
        alert(`Пересчет завершен! Обновлено команд: ${updatedCount}`);

        // Reload page to see changes
        // location.reload(); 
    } else {
        console.warn("⚠️ No updates were necessary or no points found.");
    }
})();
