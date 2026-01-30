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
