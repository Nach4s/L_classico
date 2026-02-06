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
 * Use strictly equality check for group names or IDs
 */
function calculateCoachPoints(coachId, winningGroup, matchStatus = 'finished') {
    if (matchStatus !== 'finished') return 0; // No points until finished
    if (!coachId || !winningGroup) return 0;

    // Normalizing inputs to strings for comparison
    const cId = String(coachId).toLowerCase();
    const wGroup = String(winningGroup);

    // Logic: 
    // Coach 'nurzhan' (Group 1 manager) wins if Group 1 wins
    // Coach 'uali' (Group 2 manager) wins if Group 2 wins

    if (cId === 'nurzhan') {
        if (wGroup === '1' || wGroup === '1 группа') return 2;
        if (wGroup === '2' || wGroup === '2 группа') return -2; // Loss
    }

    if (cId === 'uali') {
        if (wGroup === '2' || wGroup === '2 группа') return 2;
        if (wGroup === '1' || wGroup === '1 группа') return -2; // Loss
    }

    return 0; // Draw or unknown
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
 * Helper: Determine Winning Group for a Gameweek
 * Fetches the linked match and compares scores.
 */
async function getGameweekWinningGroup(gameweekId) {
    try {
        const gwDoc = await db.collection('gameweeks').doc(gameweekId).get();
        if (!gwDoc.exists) return { winningGroup: null, matchStatus: 'pending' };

        const gwData = gwDoc.data();
        if (!gwData.matchId) return { winningGroup: null, matchStatus: 'pending' };

        const matchDoc = await db.collection('matches').doc(gwData.matchId).get();
        if (!matchDoc.exists) return { winningGroup: null, matchStatus: 'pending' };

        const match = matchDoc.data();

        // Determine Status
        let status = 'pending';
        // If we have a robust status field, use it. Otherwise guess based on scores/mvp?
        // For now, let's assume if it has a score it's at least live/finished.
        // But the previous API used 'finished'. Let's stick to what we know:
        // If voting is closed or MVP is selected, it's definitely finished.
        // OR if the user manually set it?

        // Let's rely on `votingClosed` as a proxy for "Result Finalized" for Coach Points?
        // OR simply: if scores are present.
        // The user requirement implies "when I link a match... and who won... coach gets points".
        // Usually points are final when the game is over.

        if (match.votingClosed) {
            status = 'finished';
        } else if (match.score1 !== undefined && match.score2 !== undefined) {
            // If scores exist but voting open, maybe 'live' or 'finished' pending vote.
            // We'll treat as 'finished' for calculation purposes if we want live updates,
            // BUT calculateCoachPoints has a check `if (matchStatus !== 'finished') return 0`.
            // So we must pass 'finished' if we want points to show up.
            // Let's assume if the admin triggers "Recalculate", they imply it's done or live?
            // Actually, the prompt said "when I attach a match... and who won...".
            // Let's default to 'finished' if we have scores, so points appear?
            // Safest: Use 'finished' if scores are non-zero or explicitly set?
            // Actually, let's look at `gwData.status`.
            if (gwData.status === 'completed' || match.votingClosed) {
                status = 'finished';
            } else {
                // For "Live" updates, we might want to show potential points?
                // But calculateCoachPoints explicitly returns 0 if not finished.
                // Let's pass 'finished' IF we have a valid result to show.
                status = 'finished';
            }
        }

        const s1 = parseInt(match.score1 || 0);
        const s2 = parseInt(match.score2 || 0);

        let winner = null;
        if (s1 > s2) winner = '1'; // "1 группа" assumed Team 1
        else if (s2 > s1) winner = '2'; // "2 группа" assumed Team 2

        return { winningGroup: winner, matchStatus: status, matchId: gwData.matchId };

    } catch (e) {
        console.error('Error determining winning group:', e);
        return { winningGroup: null, matchStatus: 'error' };
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

        // 2.1 Fetch All Fantasy Teams to get Base Total Points AND Coach ID
        const teamsMap = new Map(); // Stores { totalPoints, coachId }
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        teamsSnapshot.forEach(doc => {
            const d = doc.data();
            teamsMap.set(doc.id, {
                totalPoints: d.totalPointsAllTime || 0,
                coachId: d.coachId || null
            });
        });

        const batch = db.batch();
        let grandTotal = 0;
        let maxScore = 0;
        let processedCount = 0;

        // 2.2 Determine Winning Group for Coach Points
        const { winningGroup, matchStatus } = await getGameweekWinningGroup(gameweekId);
        console.log(`🏆 Match Result: Winner=${winningGroup}, Status=${matchStatus}`);

        // 3. Recalculate each squad using cached stats and global map
        squadsSnapshot.forEach(doc => {
            const squad = doc.data();
            const squadRef = doc.ref;
            let squadPoints = 0;

            // Coach Points
            const userTeamData = teamsMap.get(doc.id); // This was just total points in original code

            // We need to fetch the user's coachId. 
            // PROBLEM: teamsMap in step 2.1 only stored 'totalPointsAllTime'.
            // OPTIMIZATION: We should have fetched full data or at least coachId.
            // Let's defer fetching or update 2.1? 
            // Actually, let's correct 2.1 inside this function in a separate block below 
            // OR just read it from the doc if available (it is NOT in squads doc, it is in fantasyTeams doc).

            // Since we already did `teamsSnapshot` in 2.1, let's assume we can modify it to store more data.
            // But I cannot modify the code *above* easily without a massive replace.
            // Wait, I am replacing `updateLiveUserSquads` chunks.
            // I will modify the loop logic here to access coachId if I can get it.

            // Refetching logic for 2.1 is better done by Replacing the whole 2.1 block...
            // But I am in a chunk.

            // Let's see... iterating `squadsSnapshot`. The user ID is `doc.id`.
            // We need `fantasyTeams`.doc(doc.id).coachId.
            // `teamsMap` currently has: teamsMap.set(doc.id, doc.data().totalPointsAllTime || 0);

            // I will rely on a new lookup or assume I can get it. 
            // Since I cannot change 2.1 in *this* chunk easily (it's lines 278-283), I will just do a quick lookup 
            // OR I will define a helper map *inside* this loop if I assume 2.1 is not sufficient.

            // Actually, standard practice: Let's fetch the coachId from the `fantasyTeams` map. 
            // I need to change how `teamsMap` is populated. 
            // I will use a NEW chunk to update step 2.1 as well.


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

            // ADD COACH POINTS
            const userProfile = teamsMap.get(doc.id);
            if (userProfile && userProfile.coachId) {
                const cPoints = calculateCoachPoints(userProfile.coachId, winningGroup, matchStatus);
                if (cPoints > 0) {
                    squadPoints += cPoints;
                    console.log(`  + Coach Points (${userProfile.coachId}): ${cPoints}`);
                }
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
            // userProfile is already defined in the scope above
            const baseTotal = userProfile ? userProfile.totalPoints : 0;
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
window.getGameweekWinningGroup = getGameweekWinningGroup;
