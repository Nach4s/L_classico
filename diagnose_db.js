async function diagnoseDB() {
    console.log("🔍 DIAGNOSING DATABASE...");
    const db = firebase.firestore();
    const gwId = "gw1";

    // 1. CHECK MATCH STATS
    console.log(`\n--- MATCH STATS (${gwId}) ---`);
    const statsSnap = await db.collection('match_stats').doc(gwId).collection('players').get();
    if (statsSnap.empty) {
        console.log("❌ No players found in match_stats for this gameweek via collection group!");
    } else {
        console.log(`✅ Found ${statsSnap.size} entries in match_stats.`);
        const first = statsSnap.docs[0].data();
        console.log("First Player Stat Data:", JSON.stringify(first, null, 2));
    }

    // 2. CHECK FANTASY TEAMS
    console.log(`\n--- FANTASY TEAMS ---`);
    const teamsSnap = await db.collection('fantasyTeams').limit(1).get();
    if (teamsSnap.empty) {
        console.log("❌ No fantasy teams found!");
    } else {
        const team = teamsSnap.docs[0];
        console.log(`✅ Team ID: ${team.id}`);
        console.log("Team Data:", JSON.stringify(team.data(), null, 2));
    }
}
diagnoseDB();
