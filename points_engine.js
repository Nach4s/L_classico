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

/**
 * Calculate Coach Points based on group victory
 * @param {string} coachId - 'nurzhan' (Group 1) or 'uali' (Group 2) or null
 * @param {number} winningGroup - 1, 2, or null (draw/no result)
 * @returns {number} - Points awarded (0 or 2)
 */
function calculateCoachPoints(coachId, winningGroup) {
    if (!coachId || !winningGroup) return 0;

    if (coachId === 'nurzhan' && winningGroup === 1) return 2;
    if (coachId === 'uali' && winningGroup === 2) return 2;

    return 0; // Loss or Draw
}

// Export for Admin Panel
window.calculateStatsPoints = calculateStatsPoints;
window.getMVPBonus = getMVPBonus;
window.getRatingBonus = getRatingBonus;
window.calculateCoachPoints = calculateCoachPoints;

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
 * LIVE SCORING: Update ALL user squads with latest stats
 * This is triggered immediately after Admin saves stats or closes voting.
 */
async function updateLiveUserSquads(gameweekId) {
    console.log(`🔄 LIVE SCORING: Updating all squads for ${gameweekId}...`);
    try {
        // 0. Load Global Player Map (Crucial Fix for ID Mismatch)
        const playerMap = await window.getGlobalPlayerMap();

        // 1. Fetch ALL Player Stats for this Gameweek (Optimization: Single Read)
        const statsMap = new Map();
        const statsSnapshot = await db.collection('match_stats')
            .doc(gameweekId)
            .collection('players')
            .get();

        statsSnapshot.forEach(doc => {
            const data = doc.data();
            statsMap.set(doc.id, {
                points: (data.statsPoints || 0) + (data.mvpBonus || 0) + (data.ratingBonus || 0),
                isMVP: data.isMVP || false
            });
        });

        // 2. Fetch ALL User Squads (Snapshots)
        const squadsSnapshot = await db.collection('gameweeks')
            .doc(gameweekId)
            .collection('squads')
            .get();

        if (squadsSnapshot.empty) {
            console.log('⚠️ No squads found for live update.');
            return;
        }

        // 2.1 Fetch All Fantasy Teams to get Base Total Points (Optimization: Single Read)
        const teamsMap = new Map();
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        teamsSnapshot.forEach(doc => {
            teamsMap.set(doc.id, doc.data().totalPointsAllTime || 0);
        });

        const batch = db.batch();
        let grandTotal = 0;
        let maxScore = 0;
        let processedCount = 0;

        // 3. Recalculate each squad using cached stats and global map
        squadsSnapshot.forEach(doc => {
            const squad = doc.data();
            const squadRef = doc.ref;
            let squadPoints = 0;

            if (squad.players && Array.isArray(squad.players)) {
                squad.players.forEach(pid => {
                    // ID Mismatch Fix: Use Global Map to find the canonical String ID
                    let stringId = pid;

                    const pData = playerMap.get(pid);
                    if (pData) {
                        stringId = pData.id;
                    }

                    const stat = statsMap.get(stringId);

                    if (stat) {
                        let pts = stat.points;
                        // Captain Multiplier
                        if (squad.captainId === pid || squad.captainId === stringId) {
                            pts *= 2;
                        }
                        squadPoints += pts;
                    }
                });
                console.log(`Squad Total for ${doc.id}: ${squadPoints}`);
            }

            // Update Max/Avg tracking
            grandTotal += squadPoints;
            if (squadPoints > maxScore) maxScore = squadPoints;
            processedCount++;

            // Queue update
            batch.update(squadRef, {
                totalPoints: squadPoints,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // NEW: Update user's main profile for Real-Time Leaderboard
            // Calculates LIVE Total = Historical Total + Current Live GW Points
            const userRef = db.collection('fantasyTeams').doc(doc.id);
            const baseTotal = teamsMap.get(doc.id) || 0;
            const liveTotal = baseTotal + squadPoints;

            batch.update(userRef, {
                // Fields used by Leaderboard UI (leaderboard.js uses weekPoints & totalPoints)
                weekPoints: squadPoints,
                totalPoints: liveTotal,

                // Detailed fields for debugging/live tracking
                live_gw_points: squadPoints,
                live_total_points: liveTotal,

                livePointsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        // 4. Commit Squad Updates
        await batch.commit();

        // 5. Update Gameweek Global Stats immediately
        if (processedCount > 0) {
            const averagePoints = Math.round(grandTotal / processedCount);
            await db.collection('gameweeks').doc(gameweekId).update({
                stats: {
                    averagePoints: averagePoints,
                    highestPoints: maxScore,
                    lastLiveUpdate: firebase.firestore.FieldValue.serverTimestamp()
                }
            });
            console.log(`✅ Live Stats Updated: Avg ${averagePoints}, Max ${maxScore}`);
        }

    } catch (e) {
        console.error('❌ Error in updateLiveUserSquads:', e);
        throw e;
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
        // Read from SNAPSHOT archive (immutable history)
        const squadDoc = await db.collection('gameweeks').doc(gameweekId)
            .collection('squads').doc(userId).get();

        if (!squadDoc.exists) return 0;

        const squad = squadDoc.data();
        if (!squad || !squad.players) return 0;

        let totalSquadPoints = 0;

        // Fetch stats for each player in squad
        for (const playerId of squad.players) {
            const stats = await getMatchStats(gameweekId, playerId);
            if (stats) {
                // TODO: Add Captain logic (x2)
                let points = stats.totalPoints || 0;
                if (squad.captainId === playerId) {
                    points *= 2;
                }
                totalSquadPoints += points;
            }
        }

        // Update the snapshot doc with the calculated total for easy reference
        await squadDoc.ref.update({ totalPoints: totalSquadPoints });

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
/**
 * FINAL AGGREGATION: Just syncs final scores to user profiles
 * (Scores are already calculated by updateLiveUserSquads)
 */
async function aggregateAllUsersPoints(gameweekId) {
    try {
        console.log(`📊 Finalizing user points for ${gameweekId}...`);

        // Iterate over SNAPSHOTS only
        const snapshotsSnapshot = await db.collection('gameweeks').doc(gameweekId)
            .collection('squads').get();

        const batch = db.batch();
        let processed = 0;

        for (const squadDoc of snapshotsSnapshot.docs) {
            const userId = squadDoc.id;
            const data = squadDoc.data();
            const points = data.totalPoints || 0; // Already calculated

            // Update main user profile with new total
            const userRef = db.collection('fantasyTeams').doc(userId);

            batch.update(userRef, {
                [`history.${gameweekId}`]: {
                    points: points,
                    rank: 0
                },
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            processed++;
        }

        await batch.commit();
        console.log(`✅ Finalized points for ${processed} users.`);
        return processed;

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

window.updateLiveUserSquads = updateLiveUserSquads;
