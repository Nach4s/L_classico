// ===================================
// PLAYERS DATABASE SEED DATA
// Fantasy Football - L Clasico
// ===================================

const PLAYERS_DATA = [
    // 1 группа
    {
        id: "mansur_sh",
        name: "Мансур Ш.",
        position: "FWD",
        price: 6.5,
        team: "1 группа"
    },
    {
        id: "daulet_e",
        name: "Даулет Е.",
        position: "MID",
        price: 7.0,
        team: "1 группа"
    },
    {
        id: "sanzhar_a",
        name: "Санжар А.",
        position: "FWD",
        price: 6.5,
        team: "1 группа"
    },
    {
        id: "aibek_a",
        name: "Айбек А.",
        position: "FWD",
        price: 6.0,
        team: "1 группа"
    },
    {
        id: "alisher_a",
        name: "Алишер А.",
        position: "GK",
        price: 2.5,
        team: "1 группа"
    },
    {
        id: "shyngys_t",
        name: "Шынгыс Т.",
        position: "FWD",
        price: 6.0,
        team: "1 группа"
    },

    // 2 группа
    {
        id: "asan_t",
        name: "Асан Т.",
        position: "MID",
        price: 5.5,
        team: "2 группа"
    },
    {
        id: "dimash_a",
        name: "Димаш А.",
        position: "GK",
        price: 7.0,
        team: "2 группа"
    },
    {
        id: "akylbek_a",
        name: "Акылбек А.",
        position: "FWD",
        price: 7.5,
        team: "2 группа"
    },
    {
        id: "yerasyl_k",
        name: "Ерасыл К.",
        position: "MID",
        price: 7.0,
        team: "2 группа"
    },
    {
        id: "daniiar_a",
        name: "Данияр А.",
        position: "DEF",
        price: 4.0,
        team: "2 группа"
    },
    {
        id: "hamid_t",
        name: "Хамид Т.",
        position: "DEF",
        price: 3.0,
        team: "2 группа"
    }
];

// Initialize players collection in Firestore
async function seedPlayersToFirestore() {
    if (typeof db === 'undefined') {
        console.error('Firestore not initialized');
        return;
    }

    try {
        for (const player of PLAYERS_DATA) {
            await db.collection('players').doc(player.id).set(player);
            console.log(`Added player: ${player.name}`);
        }
        console.log('✅ All players seeded successfully!');
    } catch (error) {
        console.error('Error seeding players:', error);
    }
}

// Get player by ID
async function getPlayer(playerId) {
    const doc = await db.collection('players').doc(playerId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

// Get all players
async function getAllPlayers() {
    const snapshot = await db.collection('players').get();
    const players = [];
    snapshot.forEach(doc => {
        players.push({ id: doc.id, ...doc.data() });
    });
    return players;
}

// Get players by team
async function getPlayersByTeam(teamName) {
    const snapshot = await db.collection('players')
        .where('team', '==', teamName)
        .get();
    const players = [];
    snapshot.forEach(doc => {
        players.push({ id: doc.id, ...doc.data() });
    });
    return players;
}

// Get players by position
async function getPlayersByPosition(position) {
    const snapshot = await db.collection('players')
        .where('position', '==', position)
        .get();
    const players = [];
    snapshot.forEach(doc => {
        players.push({ id: doc.id, ...doc.data() });
    });
    return players;
}

// ===================================
// GLOBAL PLAYER MAPPING (HYDRATION)
// ===================================

/**
 * Creates a Map of Players for fast lookup by ID (String) or Index (Number)
 * Solves the issue of mismatched ID types in the database.
 * Returns: Map<string|number, PlayerObject>
 */
async function getGlobalPlayerMap() {
    const playerMap = new Map();

    // 1. Load from DB (Primary Source)
    if (typeof db !== 'undefined') {
        try {
            const snapshot = await db.collection('players').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                // Map by String ID (e.g. "mansur_sh")
                playerMap.set(doc.id, { id: doc.id, ...data });
                // Map by internal 'id' field if different
                if (data.id && data.id !== doc.id) {
                    playerMap.set(data.id, { id: doc.id, ...data });
                }
            });
        } catch (e) {
            console.error("Error loading players from DB for map:", e);
        }
    }

    // 2. Fallback/Augment with Static Data (for numerical indices)
    // Legacy support: Database has numbers [11, 7, 13] which correspond to PLAYERS_DATA indices
    if (typeof PLAYERS_DATA !== 'undefined' && Array.isArray(PLAYERS_DATA)) {
        PLAYERS_DATA.forEach((p, index) => {
            // Map by String ID
            if (!playerMap.has(p.id)) {
                playerMap.set(p.id, p);
            }

            // Map by Numeric Index (1-based or 0-based depending on where it came from)
            // Assuming legacy system used 1-based index (1..12) or 2-based (2..13)
            // We will map BOTH to be safe, if no conflict.

            // Map 0-based index (prevent overlap with string ids if possible, but IDs are usually strings)
            // Warning: If p.id is "7" string, and index is 7, they overlap fine.

            // Standardizing on: Input ID -> Player Object

            // Case A: Index + 1 (1..N)
            const idx1 = index + 1;
            if (!playerMap.has(idx1)) playerMap.set(idx1, p);

            // Case B: Index + 2 (Legacy offset seen in some files)
            const idx2 = index + 2;
            if (!playerMap.has(idx2)) playerMap.set(idx2, p);
        });
    }

    console.log(`🗺️ Global Player Map created with ${playerMap.size} entries.`);
    return playerMap;
}

// Export globally
window.getGlobalPlayerMap = getGlobalPlayerMap;
window.PLAYERS_DATA = PLAYERS_DATA; // Ensure global access

