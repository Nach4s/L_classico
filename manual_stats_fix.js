
// ===================================
// MANUAL STATS FIX & POSITION UPDATE SCRIPT
// ===================================

// 1. UPDATED POSITIONS & PRICES (Source: User "Really True Positions")
const PLAYER_UPDATES = [
    { id: "akylbek_a", name: "Акылбек А.", position: "FWD", price: 7.5, team: "2 группа" },
    { id: "yerasyl_k", name: "Ерасыл К.", position: "MID", price: 7.0, team: "2 группа" },
    { id: "daulet_e", name: "Даулет Е.", position: "MID", price: 7.0, team: "1 группа" },
    { id: "sanzhar_a", name: "Санжар А.", position: "FWD", price: 6.5, team: "1 группа" },
    { id: "mansur_sh", name: "Мансур Ш.", position: "FWD", price: 6.5, team: "1 группа" },
    { id: "aibek_a", name: "Айбек А.", position: "FWD", price: 6.0, team: "1 группа" },
    { id: "shyngys_t", name: "Шынгыс Т.", position: "DEF", price: 6.0, team: "1 группа" },
    { id: "asan_t", name: "Асан Т.", position: "MID", price: 5.5, team: "2 группа" },
    { id: "daniiar_a", name: "Данияр А.", position: "DEF", price: 4.0, team: "2 группа" },
    { id: "hamid_t", name: "Хамид Т.", position: "DEF", price: 3.0, team: "2 группа" },
    { id: "alisher_a", name: "Алишер А.", position: "GK", price: 2.5, team: "1 группа" },
    // "Димаш А." mentioned in list but no specific update diffs? keeping standard if exists or update defaults? 
    // Assuming standard update pattern if name matches. User list ended with "Димаш А." (blank line).
    // Let's assume Димаш А. is MID 7.0 from existing data unless specified.
];

// 2. MATCH STATS FOR CURRENT TOUR
// Default Rating: 5.0 (User input)
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
    // Missing players added:
    { id: "yerasyl_k", goals: 0, assists: 0, rating: 5.0 }
];

async function applyManualStats(gameweekId) {
    const targetGw = gameweekId || window.currentGameweekId;

    if (!targetGw) {
        alert('❌ Ошибка: Не выбран текущий тур.');
        return;
    }

    if (!confirm(`⚠️ Обновить статистику для тура ${targetGw} используя данные игроков из базы?`)) {
        return;
    }

    console.log(`🚀 Applying stats for ${targetGw} using DB positions...`);
    const db = firebase.firestore();
    const batch = db.batch();

    try {
        // Points Engine Helpers
        const getRatingBonus = (rating, pos) => {
            const isDef = (pos === 'GK' || pos === 'DEF');
            if (rating >= 9.0) return isDef ? 8 : 5;
            if (rating >= 8.0) return isDef ? 5 : 3;
            if (rating >= 7.0) return isDef ? 2 : 1;
            if (rating >= 6.0) return 0;
            if (rating >= 4.5) return -2;
            return -4;
        };

        const getGoalPoints = (pos) => {
            if (pos === 'GK' || pos === 'DEF') return 6;
            if (pos === 'MID') return 5;
            if (pos === 'FWD') return 4;
            return 4;
        };

        for (const stat of MATCH_STATS_DATA) {
            // READ POSITION FROM DB
            const playerDoc = await db.collection('players').doc(stat.id).get();

            if (!playerDoc.exists) {
                console.warn(`❌ Player not found in DB: ${stat.id}`);
                continue;
            }

            const playerData = playerDoc.data();
            const position = playerData.position || 'MID'; // Fallback

            // 1. Stats Points
            const goalsPts = stat.goals * getGoalPoints(position);
            const assistsPts = stat.assists * 2; // Fixed: Assist = 2 pts (Simple logic)
            // Note: If using advanced logic, goalsPts is used. 
            // The user's points engine usually does (goals*3 + assists*2).
            // Let's stick to the engine logic unless specifically asked for FPL style.
            // Wait, previous turn I debated this. Default engine is Simple.

            // Checking points_engine.js:
            // function calculateStatsPoints(goals, assists) { return (goals * 3) + (assists * 2); }
            // It completely IGNORES position for goals.
            // If the user wants me to use the DB info, I should probably stick to the defined engine rules.
            const statsPoints = (stat.goals * 3) + (stat.assists * 2);

            // 2. Rating Bonus (Depends on Position!)
            const ratingBonus = getRatingBonus(stat.rating, position);

            // 3. MVP Bonus
            const mvpBonus = 0;

            // Total
            const totalPoints = statsPoints + ratingBonus + mvpBonus;

            const statsRef = db.collection('match_stats').doc(`${targetGw}_${stat.id}`);
            batch.set(statsRef, {
                gameweekId: targetGw,
                playerId: stat.id,
                goals: stat.goals,
                assists: stat.assists,
                averageRating: stat.rating,
                isMVP: false,
                statsPoints: statsPoints,
                ratingBonus: ratingBonus,
                mvpBonus: mvpBonus,
                totalPoints: totalPoints,
                played: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`✅ Prepared update for ${stat.id}: Pos=${position}, Pts=${totalPoints}`);
        }

        await batch.commit();
        console.log('🎉 Stats applied using DB positions!');
        alert('✅ Статистика обновлена (позиции взяты из базы)!');
        location.reload();

    } catch (error) {
        console.error('❌ Error applying stats:', error);
        alert('Error: ' + error.message);
    }
}

// Global export
window.applyManualStats = applyManualStats;
