const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// ==========================================
// 1. DATA DEFINITIONS
// ==========================================

const PLAYERS_DATA = [
    // 1 группа
    { id: "mansur_sh", name: "Мансур Ш.", position: "FWD", price: 6.5, team: "1 группа" },
    { id: "daulet_e", name: "Даулет Е.", position: "MID", price: 7.0, team: "1 группа" },
    { id: "sanzhar_a", name: "Санжар А.", position: "FWD", price: 6.5, team: "1 группа" },
    { id: "aibek_a", name: "Айбек А.", position: "FWD", price: 6.0, team: "1 группа" },
    { id: "alisher_a", name: "Алишер А.", position: "GK", price: 2.5, team: "1 группа" },
    { id: "shyngys_t", name: "Шынгыс Т.", position: "FWD", price: 6.0, team: "1 группа" },

    // 2 группа
    { id: "asan_t", name: "Асан Т.", position: "MID", price: 6.0, team: "2 группа" }, // Price updated via older tasks context if needed, but keeping safe default
    { id: "dimash_a", name: "Димаш А.", position: "GK", price: 7.0, team: "2 группа" },
    { id: "akylbek_a", name: "Акылбек А.", position: "FWD", price: 7.5, team: "2 группа" },
    { id: "yerasyl_k", name: "Ерасыл К.", position: "MID", price: 7.0, team: "2 группа" },
    { id: "daniiar_a", name: "Данияр А.", position: "DEF", price: 5.0, team: "2 группа" },
    { id: "hamid_t", name: "Хамид Т.", position: "DEF", price: 4.5, team: "2 группа" }
];

// Helper to get String ID from Numeric (1-based index)
function getPlayerId(val) {
    // If it's already a string and arguably valid (contains underscores or is in our list)
    if (typeof val === 'string' && isNaN(parseInt(val))) {
        return val;
    }

    // Convert to number
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= PLAYERS_DATA.length) {
        return PLAYERS_DATA[num - 1].id;
    }

    console.warn(`⚠️ Unknown ID format: ${val}`);
    return null;
}

// ==========================================
// 2. MAIN LOGIC
// ==========================================

async function fixSquadsAndRecalc() {
    console.log("🚀 Starting Squad Fix & Point Recalculation...");
    const gwId = 'gw1';

    try {
        // A. Fetch All Stats for GW1 (Optimization)
        const statsMap = new Map();
        const statsSnapshot = await db.collection('match_stats').doc(gwId).collection('players').get();

        statsSnapshot.forEach(doc => {
            const data = doc.data();
            const total = (data.statsPoints || 0) + (data.mvpBonus || 0) + (data.ratingBonus || 0);
            statsMap.set(doc.id, total);
        });
        console.log(`📊 Loaded stats for ${statsMap.size} players.`);

        // B. Fetch All Fantasy Teams
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        console.log(`👥 Found ${teamsSnapshot.size} teams to process.`);

        const batch = db.batch();
        let updatedCount = 0;

        for (const doc of teamsSnapshot.docs) {
            const data = doc.data();
            const originalSquad = data.squads ? data.squads[gwId] : null;

            // Check if user has a squad for gw1
            if (!originalSquad || !originalSquad.players || !Array.isArray(originalSquad.players)) {
                console.log(`⏭️ Skipping ${data.managerName || doc.id} (No GW1 squad)`);
                continue;
            }

            // 1. Convert IDs
            const fixedPlayers = [];
            let hasChanges = false;

            for (const pid of originalSquad.players) {
                const newId = getPlayerId(pid);
                if (newId) {
                    fixedPlayers.push(newId);
                    if (newId !== pid) hasChanges = true;
                }
            }

            // Handle Captain ID
            let fixedCaptainId = getPlayerId(originalSquad.captainId);
            if (fixedCaptainId !== originalSquad.captainId) hasChanges = true;

            // Ensure we have 3 valid players
            if (fixedPlayers.length !== 3) {
                console.warn(`⚠️ Warning: ${data.managerName} has valid player count mismatch: ${fixedPlayers.length}`);
            }

            // 2. Recalculate Points
            let newTotalPoints = 0;
            fixedPlayers.forEach(pid => {
                const pPoints = statsMap.get(pid) || 0;
                let multiplier = 1;
                if (pid === fixedCaptainId) multiplier = 2;
                newTotalPoints += (pPoints * multiplier);
            });

            console.log(`📝 ${data.managerName || 'Anon'}: [${fixedPlayers.join(', ')}] (C: ${fixedCaptainId}) -> ${newTotalPoints} pts. (Was: ${data.live_gw_points})`);

            // 3. Queue Update
            const updateData = {
                [`squads.${gwId}.players`]: fixedPlayers,
                [`squads.${gwId}.captainId`]: fixedCaptainId,
                [`players`]: fixedPlayers, // Legacy root field
                [`captainId`]: fixedCaptainId, // Legacy root field
                live_gw_points: newTotalPoints,
                live_total_points: newTotalPoints, // Assuming gw1 is total history for now
                livePointsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.update(doc.ref, updateData);
            updatedCount++;
        }

        // C. Commit
        if (updatedCount > 0) {
            await batch.commit();
            console.log(`✅ Successfully updated ${updatedCount} teams!`);
        } else {
            console.log("No teams needed updates.");
        }

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

fixSquadsAndRecalc();
