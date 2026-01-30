// ===================================
// VOTING CRON - AUTO-CLOSE & CALCULATE
// Checks every 5 minutes for expired voting
// ===================================

(function () {
    const CRON_INTERVAL = 5 * 60 * 1000; // 5 minutes

    async function checkAndCloseExpiredVoting() {
        if (typeof db === 'undefined' || typeof firebase === 'undefined') {
            return;
        }

        console.log('🔄 Checking for expired voting sessions...');

        try {
            const now = firebase.firestore.Timestamp.now();

            const expiredMatches = await db.collection('matches')
                .where('votingOpen', '==', true)
                .where('votingClosed', '==', false)
                .where('votingEndsAt', '<=', now)
                .get();

            if (expiredMatches.empty) {
                console.log('✅ No expired voting sessions');
                return;
            }

            console.log(`📋 Found ${expiredMatches.size} expired voting sessions`);

            for (const matchDoc of expiredMatches.docs) {
                await closeAndCalculateMatchVoting(matchDoc.id, matchDoc.data());
            }

        } catch (error) {
            console.error('❌ Error in voting cron:', error);
        }
    }

    async function closeAndCalculateMatchVoting(matchId, matchData) {
        console.log(`🔒 Closing voting for match: ${matchId}`);

        try {
            const votesSnapshot = await db.collection('match_votes')
                .where('matchId', '==', matchId)
                .get();

            const ratingSums = {};
            const ratingCounts = {};

            votesSnapshot.forEach(doc => {
                const ratings = doc.data().ratings || {};
                Object.entries(ratings).forEach(([playerName, rating]) => {
                    if (!ratingSums[playerName]) {
                        ratingSums[playerName] = 0;
                        ratingCounts[playerName] = 0;
                    }
                    ratingSums[playerName] += rating;
                    ratingCounts[playerName]++;
                });
            });

            const finalRatings = {};
            Object.keys(ratingSums).forEach(playerName => {
                finalRatings[playerName] = ratingSums[playerName] / ratingCounts[playerName];
            });

            // Find MVP
            let mvpName = null;
            let mvpRating = 0;

            Object.entries(finalRatings).forEach(([playerName, rating]) => {
                if (rating > mvpRating) {
                    mvpRating = rating;
                    mvpName = playerName;
                }
            });

            console.log(`⭐ MVP determined: ${mvpName} (${mvpRating.toFixed(1)})`);

            // Update match
            await db.collection('matches').doc(matchId).update({
                votingOpen: false,
                votingClosed: true,
                votingClosedAt: firebase.firestore.FieldValue.serverTimestamp(),
                finalRatings: finalRatings,
                mvp: mvpName,
                mvpRating: mvpRating
            });

            // Find linked gameweek
            const gameweeksSnapshot = await db.collection('gameweeks')
                .where('matchId', '==', matchId)
                .limit(1)
                .get();

            if (!gameweeksSnapshot.empty) {
                const gameweekDoc = gameweeksSnapshot.docs[0];
                await calculateGameweekFantasyPoints(gameweekDoc.id, finalRatings, mvpName);
            }

            console.log(`✅ Voting closed for match ${matchId}`);
            return { success: true, mvpName, finalRatings };

        } catch (error) {
            console.error(`❌ Error closing voting for ${matchId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async function calculateGameweekFantasyPoints(gameweekId, playerRatings, mvpName) {
        console.log(`🎮 Calculating fantasy points for gameweek: ${gameweekId}`);

        try {
            const batch = db.batch();

            const statsSnapshot = await db.collection('match_stats')
                .where('gameweekId', '==', gameweekId)
                .where('played', '==', true)
                .get();

            for (const doc of statsSnapshot.docs) {
                const statsData = doc.data();
                const playerId = statsData.playerId;

                const playerDoc = await db.collection('players').doc(playerId).get();
                if (!playerDoc.exists) continue;

                const playerData = playerDoc.data();
                const playerName = playerData.name;
                const playerPosition = playerData.position;

                const avgRating = playerRatings[playerName] || 6.0;
                const isMVP = (playerName === mvpName);

                const goals = statsData.goals || 0;
                const assists = statsData.assists || 0;

                const statsPoints = (goals * 3) + (assists * 2);
                const mvpBonus = isMVP ? getCronMVPBonus(playerPosition) : 0;
                const ratingBonus = getCronRatingBonus(avgRating, playerPosition);
                const totalPoints = statsPoints + mvpBonus + ratingBonus;

                batch.update(doc.ref, {
                    isMVP: isMVP,
                    averageRating: Math.round(avgRating * 10) / 10,
                    statsPoints: statsPoints,
                    mvpBonus: mvpBonus,
                    ratingBonus: ratingBonus,
                    totalPoints: Math.round(totalPoints * 10) / 10
                });

                console.log(`  ${playerName}: ${totalPoints} pts`);
            }

            const gwRef = db.collection('gameweeks').doc(gameweekId);
            batch.update(gwRef, {
                status: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();
            console.log(`✅ Fantasy points calculated for gameweek ${gameweekId}`);

        } catch (error) {
            console.error('❌ Error calculating fantasy points:', error);
        }
    }

    function getCronMVPBonus(position) {
        const bonuses = { 'GK': 8, 'DEF': 6, 'MID': 4, 'FWD': 2 };
        return bonuses[position] || 0;
    }

    function getCronRatingBonus(avgRating, position) {
        const isDefensive = (position === 'GK' || position === 'DEF');

        if (avgRating >= 9.0) return isDefensive ? 8 : 5;
        if (avgRating >= 8.0) return isDefensive ? 5 : 3;
        if (avgRating >= 7.0) return isDefensive ? 2 : 1;
        if (avgRating >= 6.0) return 0;
        if (avgRating >= 4.5) return -2;
        return -4;
    }

    function startVotingCron() {
        console.log('🚀 Starting voting cron job');
        checkAndCloseExpiredVoting();
        setInterval(checkAndCloseExpiredVoting, CRON_INTERVAL);
    }

    // Admin manual trigger
    window.forceCloseVoting = async function (matchId) {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) {
            alert('Матч не найден');
            return;
        }

        const result = await closeAndCalculateMatchVoting(matchId, matchDoc.data());

        if (result.success) {
            alert(`✅ Голосование закрыто!\nMVP: ${result.mvpName}`);
        } else {
            alert(`❌ Ошибка: ${result.error}`);
        }
    };

    // Start cron after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(startVotingCron, 5000);
        });
    } else {
        setTimeout(startVotingCron, 5000);
    }

    console.log('✅ Voting cron module loaded');
})();
