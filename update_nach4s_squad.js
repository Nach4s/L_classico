const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateNach4sStringIds() {
    try {
        const OLD_NAME = 'Nach4s';
        const NEW_NAME = 'шынгыса кэп асана и данияра';

        console.log(`🔍 Searching for '${OLD_NAME}' or '${NEW_NAME}'...`);

        let snapshot = await db.collection('fantasyTeams')
            .where('managerName', '==', OLD_NAME)
            .get();

        let needsRename = false;

        if (snapshot.empty) {
            console.log(`❌ '${OLD_NAME}' not found. Checking for '${NEW_NAME}'...`);
            snapshot = await db.collection('fantasyTeams')
                .where('managerName', '==', NEW_NAME)
                .get();
        } else {
            needsRename = true;
        }

        if (snapshot.empty) {
            console.log("❌ No manager found with either name.");
            return;
        }

        const doc = snapshot.docs[0];
        const ref = doc.ref;
        console.log(`✅ Found Manager (ID: ${doc.id})`);

        if (needsRename) {
            console.log(`🔄 Renaming '${OLD_NAME}' to '${NEW_NAME}'...`);
            await ref.update({ managerName: NEW_NAME });
        }

        // IDs: Shyngys (7), Asan (8), Daniyar (12)
        // Captain: Shyngys (7)
        const newPlayers = [7, 8, 12];
        const newCaptain = 7;

        console.log(`📝 Updating Squad to: [${newPlayers.join(', ')}], Captain: ${newCaptain}`);

        await ref.update({
            players: newPlayers,
            captainId: newCaptain,
            // Also update the squad map for history if it exists
            'squads.gw1.players': newPlayers,
            'squads.gw1.captainId': newCaptain
        });

        // Recalculate Live Points for GW1
        // Fetch stats for these players
        let newPoints = 0;
        for (const pid of newPlayers) {
            const stats = await db.collection('match_stats').doc('gw1').collection('players').doc(String(pid)).get();
            if (stats.exists) {
                const s = stats.data();
                let p = (s.statsPoints || 0) + (s.mvpBonus || 0) + (s.ratingBonus || 0);
                if (pid === newCaptain) p *= 2;
                newPoints += p;
                console.log(`   + Player ${pid}: ${p} pts`);
            } else {
                console.log(`   - Player ${pid}: No stats found (0 pts)`);
            }
        }

        console.log(`📊 New Live GW Points: ${newPoints}`);
        await ref.update({
            live_gw_points: newPoints,
            live_total_points: newPoints // Assuming gw1 is total for now, or fetch old total
        });

        console.log("🚀 Update Complete!");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

updateNach4sStringIds();
