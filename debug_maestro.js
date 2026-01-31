async function debugMaestro() {
    console.log("🕵️‍♂️ DEBUGGING USER: Maestro");
    const db = firebase.firestore();
    const gwId = "gw1";

    // Squad: [10, 6, 8] -> Yerasyl(C), Shyngys, Dimash
    const squad = [10, 6, 8];
    const ID_MAP = { 10: "yerasyl_k", 6: "shyngys_t", 8: "dimash_a" };
    const captainId = 10;

    let total = 0;

    console.log("--- BREAKDOWN ---");
    for (let pid of squad) {
        let stringId = ID_MAP[pid];
        const doc = await db.collection('match_stats').doc(gwId).collection('players').doc(stringId).get();
        if (doc.exists) {
            const s = doc.data();
            let pts = (s.statsPoints || 0) + (s.mvpBonus || 0) + (s.ratingBonus || 0);
            let final = (pid == captainId) ? pts * 2 : pts;

            console.log(`👤 ${s.name}: ${pts} pts ${pid == captainId ? '(x2 CAPTAIN)' : ''} = ${final}`);
            console.log(`   └─ Stats: G=${s.goals}, A=${s.assists}, Rating=${s.averageRating} (Bonus: ${s.ratingBonus}), MVP=${s.mvpBonus}`);
            total += final;
        }
    }
    console.log(`📊 TOTAL: ${total}`);
}
debugMaestro();
