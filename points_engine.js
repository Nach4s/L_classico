// ===================================
// FANTASY FOOTBALL POINTS CALCULATION ENGINE
// L Clasico - Automatic Points Calculator
// ===================================

// ===================================
// POINTS CALCULATION FORMULAS
// ===================================

/**
 * Calculate Stats Points from goals and assists
 * Formula: (goals × 3) + (assists × 2)
 */
function calculateStatsPoints(goals, assists) {
    return (goals * 3) + (assists * 2);
}

/**
 * Calculate MVP Bonus based on player position
 * GK: +8, DEF: +6, MID: +4, FWD: +2
 */
function getMVPBonus(playerPosition, isMVP) {
    if (!isMVP) return 0;

    const bonuses = {
        'GK': 8,
        'DEF': 6,
        'MID': 4,
        'FWD': 2
    };

    return bonuses[playerPosition] || 0;
}

/**
 * Calculate Rating Bonus based on average user rating
 * Includes position multipliers for GK/DEF
 */
function getRatingBonus(avgRating, playerPosition) {
    const isDefensive = (playerPosition === 'GK' || playerPosition === 'DEF');

    if (avgRating >= 9.0) return isDefensive ? 8 : 5;
    if (avgRating >= 8.0) return isDefensive ? 5 : 3;
    if (avgRating >= 7.0) return isDefensive ? 2 : 1;
    if (avgRating >= 6.0) return 0;
    if (avgRating >= 4.5) return -2;
    return -4; // Below 4.5
}

// ===================================
// DATABASE OPERATIONS
// ===================================

/**
 * Calculate average rating from all user votes for a player
 */
async function calculateAverageRating(gameweekId, playerId) {
    try {
        const votesSnapshot = await db.collection('player_votes')
            .where('gameweekId', '==', gameweekId)
            .where('playerId', '==', playerId)
            .get();

        if (votesSnapshot.empty) return 0;

        let sum = 0;
        let count = 0;

        votesSnapshot.forEach(doc => {
            sum += doc.data().rating;
            count++;
        });

        return count > 0 ? sum / count : 0;
    } catch (error) {
        console.error('Error calculating average rating:', error);
        return 0;
    }
}


/**
 * Get match stats for a specific player in a gameweek
 */
async function getMatchStats(gameweekId, playerId) {
    try {
        const doc = await db.collection('match_stats')
            .doc(gameweekId)
            .collection('players')
            .doc(playerId)
            .get();

        if (!doc.exists) {
            return {
                played: false,
                goals: 0,
                assists: 0,
                isMVP: false,
                statsPoints: 0,
                mvpBonus: 0,
                ratingBonus: 0,
                totalPoints: 0,
                averageRating: 0
            };
        }

        return doc.data();
    } catch (error) {
        console.error('Error getting match stats:', error);
        return null;
    }
}

/**
 * Main function: Recalculate all points for a player in a gameweek
 * Triggered when votes change or stats are updated
 */
async function recalculatePlayerPoints(gameweekId, playerId) {
    try {
        const docRef = db.collection('match_stats')
            .doc(gameweekId)
            .collection('players')
            .doc(playerId);

        // Get current match stats
        const statsDoc = await docRef.get();
        if (!statsDoc.exists) {
            console.warn(`No match stats found for ${playerId} in ${gameweekId}`);
            return;
        }

        const matchStats = statsDoc.data();

        // Get player data for position
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) {
            console.warn(`Player ${playerId} not found`);
            return;
        }

        const playerData = playerDoc.data();

        // 1. Calculate Stats Points
        const statsPoints = calculateStatsPoints(
            matchStats.goals || 0,
            matchStats.assists || 0
        );

        // 2. Calculate MVP Bonus
        const mvpBonus = getMVPBonus(playerData.position, matchStats.isMVP || false);

        // 3. Calculate Average Rating
        const avgRating = await calculateAverageRating(gameweekId, playerId);

        // 4. Calculate Rating Bonus
        const ratingBonus = getRatingBonus(avgRating, playerData.position);

        // 5. Calculate Total Points
        const totalPoints = statsPoints + mvpBonus + ratingBonus;

        // 6. Update match_stats document
        await docRef.update({
            statsPoints,
            mvpBonus,
            ratingBonus,
            totalPoints,
            averageRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Points recalculated for ${playerData.name}:`, {
            statsPoints,
            mvpBonus,
            ratingBonus,
            totalPoints,
            avgRating: Math.round(avgRating * 10) / 10
        });

        return {
            statsPoints,
            mvpBonus,
            ratingBonus,
            totalPoints,
            averageRating: avgRating
        };

    } catch (error) {
        console.error('Error recalculating player points:', error);
        throw error;
    }
}

/**
 * Recalculate points for all players who played in a gameweek
 */
async function recalculateAllPlayersInGameweek(gameweekId) {
    try {
        const statsSnapshot = await db.collection('match_stats')
            .doc(gameweekId)
            .collection('players')
            .where('played', '==', true)
            .get();

        const promises = [];
        statsSnapshot.forEach(doc => {
            const playerId = doc.data().playerId;
            promises.push(recalculatePlayerPoints(gameweekId, playerId));
        });

        await Promise.all(promises);
        console.log(`✅ All players recalculated for gameweek ${gameweekId}`);

    } catch (error) {
        console.error('Error recalculating all players:', error);
    }
}

/**
 * Get top scorers for a gameweek
 */
async function getTopScorers(gameweekId, limit = 10) {
    try {
        const snapshot = await db.collection('match_stats')
            .doc(gameweekId)
            .collection('players')
            .where('played', '==', true)
            .orderBy('totalPoints', 'desc')
            .limit(limit)
            .get();


        const topScorers = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const playerDoc = await db.collection('players').doc(data.playerId).get();

            if (playerDoc.exists) {
                topScorers.push({
                    ...data,
                    playerName: playerDoc.data().name,
                    playerTeam: playerDoc.data().team
                });
            }
        }

        return topScorers;
    } catch (error) {
        console.error('Error getting top scorers:', error);
        return [];
    }

    // ===================================
    // USER POINTS AGGREGATION
    // ===================================

    /**
     * Calculate total points for a single user's squad in a gameweek
     * Returns total squad points
     */
    async function calculateUserSquadPoints(userId, gameweekId) {
        try {
            const teamDoc = await db.collection('fantasyTeams').doc(userId).get();
            if (!teamDoc.exists) return 0;

            const data = teamDoc.data();
            const squad = data.squads ? data.squads[gameweekId] : null;

            if (!squad || !squad.players) return 0;

            let totalSquadPoints = 0;

            // Fetch stats for each player in squad
            for (const playerId of squad.players) {
                const stats = await getMatchStats(gameweekId, playerId);
                if (stats) {
                    totalSquadPoints += (stats.totalPoints || 0);
                }
            }

            return totalSquadPoints;
        } catch (error) {
            console.error(`Error calculating squad points for ${userId}:`, error);
            return 0;
        }
    }

    /**
     * Aggregate points for ALL users for a specific gameweek
     * Updates 'fantasyTeams' collection: 
     * - sets gw_points (latests score)
     * - updates totalPointsAllTime (recalculated from history)
     */
    async function aggregateAllUsersPoints(gameweekId) {
        try {
            console.log(`📊 Aggregating user points for ${gameweekId}...`);

            const teamsSnapshot = await db.collection('fantasyTeams').get();

            // Chunking for batch limits
            const chunkArray = (arr, size) => {
                return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                    arr.slice(i * size, i * size + size)
                );
            };

            const chunks = chunkArray(teamsSnapshot.docs, 400);

            for (const chunk of chunks) {
                const batch = db.batch();
                const operations = [];

                for (const teamDoc of chunk) {
                    const userId = teamDoc.id;

                    // We perform async calcs in parallel for speed within the chunk
                    operations.push((async () => {
                        const gwPoints = await calculateUserSquadPoints(userId, gameweekId);
                        const totalPointsAllTime = await recalculateUserTotalHistory(userId);

                        const userRef = db.collection('fantasyTeams').doc(userId);
                        batch.update(userRef, {
                            gw_points: gwPoints,
                            totalPointsAllTime: totalPointsAllTime,
                            lastUpdatedGameweek: gameweekId,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    })());
                }

                // Wait for all calculations in this chunk
                await Promise.all(operations);

                // Commit batch
                await batch.commit();
                console.log(`✅ Processed batch of ${chunk.length} users`);
            }

            console.log('✅ User points aggregation complete.');

        } catch (error) {
            console.error('Error aggregating user points:', error);
            throw error;
        }
    }

    /**
     * Helper to recalculate total points from all gameweeks
     * Ensures 100% accuracy vs increment drift
     */
    async function recalculateUserTotalHistory(userId) {
        try {
            const teamDoc = await db.collection('fantasyTeams').doc(userId).get();
            if (!teamDoc.exists) return 0;

            const data = teamDoc.data();
            const squads = data.squads || {};

            let total = 0;
            for (const gwId of Object.keys(squads)) {
                total += await calculateUserSquadPoints(userId, gwId);
            }
            return total;
        } catch (error) {
            console.error(`Error recalculating history for ${userId}:`, error);
            return 0;
        }
    }
