// ===================================
// DB RESTORE & MANUAL STATS SCRIPT
// ===================================

const MATCH_STATS_DATA = [
    { id: "aibek_a", goals: 1, assists: 0, rating: 5.0 },
    { id: "akylbek_a", goals: 2, assists: 0, rating: 5.0 },
    { id: "asan_t", goals: 0, assists: 1, rating: 5.0 },
    { id: "daniiar_a", goals: 0, assists: 1, rating: 5.0 },
    { id: "daulet_e", goals: 1, assists: 1, rating: 5.0 },
    { id: "dimash_a", goals: 0, assists: 0, rating: 5.0 },
    { id: "hamid_t", goals: 0, assists: 0, rating: 5.0 },
    { id: "mansur_sh", goals: 0, assists: 0, rating: 5.0 },
    { id: "sanzhar_a", goals: 1, assists: 0, rating: 5.0 },
    { id: "shyngys_t", goals: 0, assists: 0, rating: 5.0 },
    { id: "yerasyl_k", goals: 0, assists: 0, rating: 5.0 }
];

/**
 * 1. RESTORE DATABASE (Use this if you deleted collections)
 * - Seeds players
 * - Creates Gameweek 1 if missing
 */
async function restoreDatabase() {
    console.log('🔄 Starting Database Restore...');

    // 1. Seed Players
    if (typeof seedPlayersToFirestore === 'function') {
        console.log('🌱 Seeding players...');
        await seedPlayersToFirestore();
    } else {
        console.warn('⚠️ seedPlayersToFirestore not found. Skipping player seed.');
    }

    // 2. Create Gameweek 1 if it doesn't exist
    try {
        const gw1Ref = db.collection('gameweeks').doc('gw1');
        const doc = await gw1Ref.get();

        if (!doc.exists) {
            console.log('📅 Creating Gameweek 1...');
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + 24); // Deadline tomorrow

            await gw1Ref.set({
                gameweekNumber: 1,
                deadline: firebase.firestore.Timestamp.fromDate(deadline),
                status: 'voting_open', // Open immediately for testing
                playersWhoPlayed: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Gameweek 1 created!');
        } else {
            console.log('ℹ️ Gameweek 1 already exists.');
        }

        // 3. Apply Stats
        await applyManualStats('gw1');

        alert('✅ База данных восстановлена! (Игроки + GW1 + Статистика)');
        location.reload();

    } catch (error) {
        console.error('Error in restore:', error);
        alert('Error restoring DB: ' + error.message);
    }
}

/**
 * 2. APPLY STATS (New Structure Compatible)
 */
async function applyManualStats(gameweekId) {
    const targetGw = gameweekId || window.currentGameweekId || 'gw1';
    console.log(`🚀 Applying stats for ${targetGw}...`);

    const batch = db.batch();

    try {
        for (const stat of MATCH_STATS_DATA) {
            // Get Player Data
            const playerDoc = await db.collection('players').doc(stat.id).get();
            const position = playerDoc.exists ? playerDoc.data().position : 'MID';

            // Calculate Points (Simple Engine)
            const statsPoints = (stat.goals * 3) + (stat.assists * 2);

            // Rating Bonus
            const getBonus = (r, pos) => {
                const isDef = (pos === 'GK' || pos === 'DEF');
                if (r >= 9) return isDef ? 8 : 5;
                if (r >= 8) return isDef ? 5 : 3;
                if (r >= 7) return isDef ? 2 : 1;
                return r < 4.5 ? -4 : 0;
            };
            const ratingBonus = getBonus(stat.rating, position);
            const totalPoints = statsPoints + ratingBonus;

            // NEW STRUCTURE: match_stats/{gwId}/players/{playerId}
            const statRef = db.collection('match_stats')
                .doc(targetGw)
                .collection('players')
                .doc(stat.id);

            batch.set(statRef, {
                gameweekId: targetGw, // Redundant but safe
                playerId: stat.id,
                goals: stat.goals,
                assists: stat.assists,
                averageRating: stat.rating,
                isMVP: false,
                statsPoints: statsPoints,
                ratingBonus: ratingBonus,
                mvpBonus: 0,
                totalPoints: totalPoints,
                played: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();
        console.log('✅ Stats applied successfully to new structure!');

    } catch (error) {
        console.error('❌ Error applying stats:', error);
        throw error;
    }
}

window.restoreDatabase = restoreDatabase;
window.applyManualStats = applyManualStats;
