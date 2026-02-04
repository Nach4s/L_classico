/**
 * SNAPSHOT SQUADS SCRIPT
 * 
 * Run this at gameweek deadline to lock all squads.
 * Copies active squad from FantasyTeams/{userId} to gameweeks/{gwId}/squads/{userId}
 * 
 * Usage: node snapshot_squads.js gw3
 * 
 * Requirements:
 * - Firebase Admin SDK: npm install firebase-admin
 * - Service Account Key: serviceAccountKey.json in project root
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error('❌ Error loading serviceAccountKey.json:', e.message);
    console.log('📋 Instructions:');
    console.log('  1. Go to Firebase Console → Project Settings → Service Accounts');
    console.log('  2. Click "Generate new private key"');
    console.log('  3. Save as "serviceAccountKey.json" in project root');
    process.exit(1);
}

const db = admin.firestore();

/**
 * Snapshot all active squads to locked gameweek collection
 * @param {string} gameweekId - e.g. "gw3"
 */
async function snapshotSquads(gameweekId) {
    console.log(`\n🔒 LOCKING SQUADS FOR ${gameweekId.toUpperCase()}`);
    console.log('='.repeat(50));

    // 1. Verify gameweek exists
    const gwDoc = await db.collection('gameweeks').doc(gameweekId).get();
    if (!gwDoc.exists) {
        console.error(`❌ Gameweek ${gameweekId} not found!`);
        process.exit(1);
    }
    console.log(`✅ Gameweek found: ${gameweekId}`);

    // 2. Get all fantasy teams
    const teamsSnapshot = await db.collection('fantasyTeams').get();
    console.log(`📊 Found ${teamsSnapshot.size} teams to process`);

    if (teamsSnapshot.empty) {
        console.log('⚠️ No teams found. Nothing to snapshot.');
        return;
    }

    // 3. Process in batches (Firestore batch limit = 500)
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;
    let successCount = 0;
    let skipCount = 0;

    for (const teamDoc of teamsSnapshot.docs) {
        const userId = teamDoc.id;
        const data = teamDoc.data();

        // Get players - support both new flat structure and old nested structure
        let players = [];
        let captainId = null;
        let viceCaptainId = null;
        let managerName = data.managerName || 'Аноним';

        // New flat structure
        if (data.players && Array.isArray(data.players)) {
            players = data.players;
            captainId = data.captainId || null;
            viceCaptainId = data.viceCaptainId || null;
        }
        // Old nested structure (backwards compatibility)
        else if (data.squads && data.squads[gameweekId]) {
            const gwSquad = data.squads[gameweekId];
            players = gwSquad.players || [];
            captainId = gwSquad.captainId || data.captainId || null;
            viceCaptainId = gwSquad.viceCaptainId || null;
        }

        // Skip if no valid squad
        if (!players || players.length === 0) {
            console.log(`  ⏭️ ${managerName} (${userId.slice(0, 8)}...) - No squad, skipping`);
            skipCount++;
            continue;
        }

        // Create locked snapshot
        const lockedRef = db
            .collection('gameweeks').doc(gameweekId)
            .collection('squads').doc(userId);

        batch.set(lockedRef, {
            players: players,
            captainId: captainId,
            viceCaptainId: viceCaptainId,
            managerName: managerName,
            lockedAt: admin.firestore.FieldValue.serverTimestamp(),
            originalTeamId: userId
        });

        console.log(`  ✅ ${managerName} - ${players.length} players, Captain: ${captainId}`);
        successCount++;
        batchCount++;

        // Commit batch if reaching limit
        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`  📦 Committed batch of ${batchCount} squads`);
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    // 4. Update gameweek status
    await db.collection('gameweeks').doc(gameweekId).update({
        squadsLocked: true,
        squadsLockedAt: admin.firestore.FieldValue.serverTimestamp(),
        lockedSquadsCount: successCount
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✅ SNAPSHOT COMPLETE`);
    console.log(`   Locked: ${successCount} squads`);
    console.log(`   Skipped: ${skipCount} (no squad)`);
    console.log(`   Gameweek: ${gameweekId}`);
    console.log('='.repeat(50) + '\n');
}

/**
 * View current locked squads for a gameweek
 */
async function viewLockedSquads(gameweekId) {
    console.log(`\n📋 LOCKED SQUADS FOR ${gameweekId.toUpperCase()}`);
    console.log('='.repeat(50));

    const snapshot = await db
        .collection('gameweeks').doc(gameweekId)
        .collection('squads').get();

    if (snapshot.empty) {
        console.log('⚠️ No locked squads found for this gameweek.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  ${data.managerName}: ${data.players?.join(', ') || 'N/A'} (C: ${data.captainId})`);
    });

    console.log(`\nTotal: ${snapshot.size} squads\n`);
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
    case 'lock':
    case 'snapshot':
        const gwId = args[1];
        if (!gwId) {
            console.error('❌ Please provide gameweek ID: node snapshot_squads.js lock gw3');
            process.exit(1);
        }
        snapshotSquads(gwId).then(() => process.exit(0)).catch(e => {
            console.error('Error:', e);
            process.exit(1);
        });
        break;

    case 'view':
        const viewGwId = args[1] || 'gw1';
        viewLockedSquads(viewGwId).then(() => process.exit(0));
        break;

    default:
        console.log(`
📋 SNAPSHOT SQUADS - Admin Script

Commands:
  node snapshot_squads.js lock <gwId>   Lock all squads for gameweek
  node snapshot_squads.js view <gwId>   View locked squads for gameweek

Examples:
  node snapshot_squads.js lock gw3
  node snapshot_squads.js view gw3
        `);
        process.exit(0);
}
