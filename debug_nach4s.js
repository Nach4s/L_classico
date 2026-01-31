async function debugNach4s() {
    console.log("🕵️‍♂️ DEBUGGING USER: Nach4s");
    const db = firebase.firestore();
    const gwId = "gw1";

    // 1. Get User Data
    const snapshot = await db.collection('fantasyTeams').where('managerName', '==', 'Nach4s').get();
    if (snapshot.empty) {
        console.error("❌ User Nach4s not found!");
        return;
    }
    const doc = snapshot.docs[0];
    const data = doc.data();
    console.log("👤 User Data:", data);
    console.log("📋 Players Array:", data.players);
    console.log("©️ Captain ID:", data.captainId);

    // 2. ID Mapping
    const ID_MAP = {
        1: "mansur_sh", 2: "daulet_e", 3: "sanzhar_a", 4: "aibek_a",
        5: "alisher_a", 6: "shyngys_t", 7: "asan_t", 8: "dimash_a",
        9: "akylbek_a", 10: "yerasyl_k", 11: "daniiar_a", 12: "hamid_t"
    };

    // 3. Check Stats for each player
    if (!data.players || data.players.length === 0) {
        console.warn("⚠️ No players in squad!");
        return;
    }

    for (let pid of data.players) {
        let stringId = pid;
        if (typeof pid === 'number' || (typeof pid === 'string' && !isNaN(pid))) {
            stringId = ID_MAP[pid];
            console.log(`🔄 Mapping Numeric ID ${pid} -> ${stringId}`);
        } else {
            console.log(`ℹ️ ID is already String: ${pid}`);
        }

        if (!stringId) {
            console.error(`❌ Could not map ID: ${pid}`);
            continue;
        }

        const statDoc = await db.collection('match_stats').doc(gwId).collection('players').doc(stringId).get();
        if (statDoc.exists) {
            const s = statDoc.data();
            const total = (s.statsPoints || 0) + (s.mvpBonus || 0) + (s.ratingBonus || 0);
            console.log(`✅ Stats for ${stringId} (${s.name}): Goals=${s.goals}, Assists=${s.assists}, MVP=${s.isMVP}, PTS=${total}`);
        } else {
            console.warn(`⚠️ No stats found for ${stringId}`);
        }
    }
}
debugNach4s();
