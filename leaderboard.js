// ===================================
// FANTASY LEADERBOARD & SQUAD VIEWING
// Display rankings and view user squads
// ===================================

// ===================================
// LEADERBOARD RENDERING
// ===================================

/**
 * Render Fantasy Leaderboard for a specific gameweek
 */
async function renderFantasyLeaderboard(gameweekId) {
    const tbody = document.getElementById('fantasyLeaderboard');

    if (!tbody) return;

    try {
        // Get all fantasy teams
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        const leaderboardData = [];

        for (const teamDoc of teamsSnapshot.docs) {
            const data = teamDoc.data();
            const gwSquad = data.squads ? data.squads[gameweekId] : null;

            if (!gwSquad || !gwSquad.players) continue;

            // Calculate total points for this gameweek (LIVE calculation)
            let gwPoints = 0;
            for (const playerId of gwSquad.players) {
                const stats = await getMatchStats(gameweekId, playerId);
                if (stats) {
                    // Use components for Live Scoring
                    let playerPoints = (stats.statsPoints || 0) + (stats.mvpBonus || 0) + (stats.ratingBonus || 0);
                    // Apply Captain multiplier
                    if (gwSquad.captainId === playerId) playerPoints *= 2;
                    gwPoints += playerPoints;
                }
            }

            leaderboardData.push({
                userId: teamDoc.id,
                managerName: data.managerName || 'Анонимный менеджер',
                gameweekPoints: gwPoints,
                totalPoints: data.totalPointsAllTime || 0,
                squad: gwSquad
            });
        }

        // Sort by gameweek points descending
        leaderboardData.sort((a, b) => b.gameweekPoints - a.gameweekPoints);

        // Render table
        if (leaderboardData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px;">
                        Нет данных для отображения
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = leaderboardData.map((entry, idx) => `
            <tr class="leaderboard-row" onclick="viewUserSquad('${entry.userId}', '${gameweekId}')">
                <td class="rank-cell">
                    ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td class="manager-cell">
                    <span class="manager-name-link">${entry.managerName}</span>
                </td>
                <td class="text-center points-cell">${entry.gameweekPoints}</td>
                <td class="text-center total-points-cell">${entry.totalPoints}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error rendering leaderboard:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: var(--color-error);">
                    Ошибка загрузки данных
                </td>
            </tr>
        `;
    }
}

/**
 * Render overall leaderboard (Real-Time Hybrid)
 * Listens to BOTH fantasyTeams (users) and match_stats (live scores)
 */
/**
 * Render overall leaderboard (Real-Time DB-Side)
 * Listens ONLY to fantasyTeams and trusts 'live_total_points' for sorting.
 */
function renderOverallLeaderboard() {
    const tbody = document.getElementById('fantasyLeaderboard');
    if (!tbody) return;

    console.log('📡 Start Real-Time Leaderboard (DB Mode)...');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Initializing Live Data...</td></tr>';

    // Unsubscribe from previous listener if exists
    if (window.leaderboardUnsubscribe) {
        window.leaderboardUnsubscribe();
    }

    // Listen to changes in fantasyTeams
    // ORDER BY live_total_points DESC
    // Note: This requires an index in Firestore: fantasyTeams [live_total_points: DESC]
    // If index is missing, it might throw error in console, but basic sorting in JS handles it too if dataset is small.
    // For safety with small datasets (<100), we can just get all and sort in JS to avoid index errors blocking the view.

    window.leaderboardUnsubscribe = db.collection('fantasyTeams')
        .onSnapshot(snapshot => {
            const leaderboardData = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                // DEBUG: Check what we are receiving
                console.log(`Leaderboard Data for ${data.managerName}:`, data);

                // Use stored calculated values or fallback to 0
                const teamName = data.managerName || 'Аноним';
                const liveGw = data.live_gw_points || 0;
                const liveTotal = (data.live_total_points !== undefined) ? data.live_total_points : (data.totalPointsAllTime || 0);

                leaderboardData.push({
                    userId: doc.id,
                    managerName: teamName,
                    livePoints: liveGw,      // Show in "GW" column
                    realTimeTotal: liveTotal // Show in "Total" column
                });
            });

            // Client-side Sort (Robust)
            leaderboardData.sort((a, b) => b.realTimeTotal - a.realTimeTotal);

            // Render
            renderLeaderboardTable(tbody, leaderboardData);
        }, error => {
            console.error('Error in leaderboard listener:', error);
            tbody.innerHTML = `<tr><td colspan="4" class="error-text">Ошибка обновления: ${error.message}</td></tr>`;
        });
}

/**
 * Helper to render the table rows
 */
function renderLeaderboardTable(tbody, data) {
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((entry, idx) => {
        const icon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1;
        const isLive = entry.livePoints > 0;

        return `
            <tr class="leaderboard-row" onclick="viewUserSquad('${entry.userId}', '${window.currentGameweekId || 'gw1'}')">
                <td class="rank-cell">${icon}</td>
                <td class="manager-cell">
                    <span class="manager-name">${entry.managerName}</span>
                </td>
                <td class="text-center points-cell">
                    ${isLive ? `<span class="live-indicator">🔴</span>` : ''} 
                    <span class="live-points">${entry.livePoints > 0 ? '+' + entry.livePoints : '0'}</span>
                </td>
                <td class="text-center total-points-cell">
                    <strong>${entry.realTimeTotal}</strong>
                </td>
            </tr>
        `;
    }).join('');
}

// ===================================
// SQUAD VIEWING MODAL
// ===================================

/**
 * View a user's squad for a specific gameweek
 */
async function viewUserSquad(userId, gameweekId) {
    try {
        // Get team data
        const teamDoc = await db.collection('fantasyTeams').doc(userId).get();

        if (!teamDoc.exists) {
            showAlert('Команда не найдена', 'error');
            return;
        }

        const data = teamDoc.data();
        const squad = data.squads ? data.squads[gameweekId] : null;

        if (!squad || !squad.players) {
            showAlert('Состав для этого тура не найден', 'error');
            return;
        }

        // Get player details and stats
        const squadPlayers = [];
        let totalPoints = 0;

        for (const playerId of squad.players) {
            const playerDoc = await db.collection('players').doc(playerId).get();
            const stats = await getMatchStats(gameweekId, playerId);

            if (playerDoc.exists && stats) {
                // Live Score calculation
                const livePts = (stats.statsPoints || 0) + (stats.mvpBonus || 0) + (stats.ratingBonus || 0);

                const playerData = {
                    name: playerDoc.data().name,
                    position: playerDoc.data().position,
                    team: playerDoc.data().team,
                    goals: stats.goals || 0,
                    assists: stats.assists || 0,
                    avgRating: stats.averageRating || 0,
                    totalPoints: livePts, // LIVE
                    statsPoints: stats.statsPoints || 0,
                    mvpBonus: stats.mvpBonus || 0,
                    ratingBonus: stats.ratingBonus || 0
                };

                squadPlayers.push(playerData);
                // Apply Captain multiplier for the squad total
                const multiplier = (squad.captainId === playerId ? 2 : 1);
                totalPoints += (livePts * multiplier);
            }
        }

        // Render modal
        renderSquadModal(data.managerName, gameweekId, squadPlayers, totalPoints);
        openModal('teamViewModal');

    } catch (error) {
        console.error('Error viewing squad:', error);
        showAlert('Ошибка при загрузке состава', 'error');
    }
}

/**
 * Render squad viewing modal
 */
function renderSquadModal(managerName, gameweekId, players, totalPoints) {
    document.getElementById('viewManagerName').textContent = managerName;

    const squadContainer = document.getElementById('viewTeamSquad');

    squadContainer.innerHTML = `
        <div class="squad-modal-container">
            <div class="squad-modal-header">
                <h4>Тур ${gameweekId.replace('gw', '')}</h4>
                <div class="squad-total-points">
                    <span class="total-label">Очки тура:</span>
                    <span class="total-value">${totalPoints}</span>
                </div>
            </div>

            <div class="squad-modal-players">
                ${players.map(player => `
                    <div class="squad-modal-player-card">
                        <div class="squad-player-header">
                            <div class="squad-player-info">
                                <span class="squad-player-name">${player.name}</span>
                                <span class="squad-player-badge ${player.position.toLowerCase()}">${player.position}</span>
                            </div>
                            <div class="squad-player-points">
                                <span class="points-big">${player.totalPoints}</span>
                                <span class="points-label">pts</span>
                            </div>
                        </div>

                        <div class="squad-player-stats">
                            <div class="stat-item">
                                <span class="stat-icon">⚽</span>
                                <span class="stat-value">${player.goals}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-icon">🅰️</span>
                                <span class="stat-value">${player.assists}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-icon">⭐</span>
                                <span class="stat-value" style="${player.avgRating >= 9.0 ? 'color: #2196F3; font-weight: bold;' : ''}">${player.avgRating.toFixed(1)}</span>
                            </div>
                        </div>

                        <div class="squad-player-breakdown">
                            <div class="breakdown-item">
                                <span class="breakdown-label">Статистика:</span>
                                <span class="breakdown-value">+${player.statsPoints}</span>
                            </div>
                            ${player.mvpBonus > 0 ? `
                                <div class="breakdown-item">
                                    <span class="breakdown-label">MVP бонус:</span>
                                    <span class="breakdown-value">+${player.mvpBonus}</span>
                                </div>
                            ` : ''}
                            <div class="breakdown-item">
                                <span class="breakdown-label">Рейтинг:</span>
                                <span class="breakdown-value ${player.ratingBonus >= 0 ? 'positive' : 'negative'}">
                                    ${player.ratingBonus >= 0 ? '+' : ''}${player.ratingBonus}
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ===================================
// DEADLINE LOCKING
// ===================================

/**
 * Check if deadline has passed for a gameweek
 */
async function isDeadlinePassed(gameweekId) {
    try {
        const doc = await db.collection('gameweeks').doc(gameweekId).get();

        if (!doc.exists) return true;

        const deadline = doc.data().deadline.toDate();
        return new Date() > deadline;

    } catch (error) {
        console.error('Error checking deadline:', error);
        return true;
    }
}

/**
 * Save fantasy squad with deadline check
 */
async function saveFantasySquad(gameweekId, selectedPlayers) {
    if (!currentUser) {
        showAlert('Войдите, чтобы сохранить команду', 'error');
        return false;
    }

    if (!selectedPlayers || selectedPlayers.length !== 3) {
        showAlert('Выберите 3 игроков', 'error');
        return false;
    }

    // Check deadline
    const deadlinePassed = await isDeadlinePassed(gameweekId);

    if (deadlinePassed) {
        showAlert('⏰ Дедлайн прошел! Команду нельзя изменить.', 'error');
        return false;
    }

    try {
        // Calculate total price
        let totalPrice = 0;
        for (const playerId of selectedPlayers) {
            const playerDoc = await db.collection('players').doc(playerId).get();
            if (playerDoc.exists) {
                totalPrice += playerDoc.data().price || 0;
            }
        }

        if (totalPrice > 18.0) {
            showAlert('💰 Превышен бюджет! Максимум 18.0 млн.', 'error');
            return false;
        }

        // Save squad
        await db.collection('fantasyTeams').doc(currentUser.uid).set({
            managerName: window.currentManagerName || currentUser.email,
            [`squads.${gameweekId}`]: {
                players: selectedPlayers,
                savedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isLocked: false,
                totalBudget: totalPrice
            }
        }, { merge: true });

        showAlert('✅ Команда сохранена!', 'success');
        openModal('saveConfirmModal');

        return true;

    } catch (error) {
        console.error('Error saving squad:', error);
        showAlert('Ошибка при сохранении команды', 'error');
        return false;
    }
}

/**
 * Lock all squads after deadline (called by admin or automatically)
 */
async function lockSquadsAfterDeadline(gameweekId) {
    try {
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        const batch = db.batch();

        teamsSnapshot.forEach(teamDoc => {
            const data = teamDoc.data();
            const squad = data.squads ? data.squads[gameweekId] : null;

            if (squad && !squad.isLocked) {
                batch.update(teamDoc.ref, {
                    [`squads.${gameweekId}.isLocked`]: true
                });
            }
        });

        await batch.commit();
        console.log(`✅ All squads locked for gameweek ${gameweekId}`);

    } catch (error) {
        console.error('Error locking squads:', error);
    }
}

/**
 * Update total points across all gameweeks for a user
 */
async function updateUserTotalPoints(userId) {
    try {
        const teamDoc = await db.collection('fantasyTeams').doc(userId).get();

        if (!teamDoc.exists) return;

        const data = teamDoc.data();
        const squads = data.squads || {};

        let totalPointsAllTime = 0;

        for (const [gameweekId, squad] of Object.entries(squads)) {
            if (!squad.players) continue;

            let gwPoints = 0;
            for (const playerId of squad.players) {
                const stats = await getMatchStats(gameweekId, playerId);
                gwPoints += stats ? (stats.totalPoints || 0) : 0;
            }

            totalPointsAllTime += gwPoints;
        }

        // Update in database
        await db.collection('fantasyTeams').doc(userId).update({
            totalPointsAllTime
        });

        console.log(`Updated total points for ${userId}: ${totalPointsAllTime}`);

    } catch (error) {
        console.error('Error updating total points:', error);
    }
}

/**
 * Update total points for all users
 */
async function updateAllUsersTotalPoints() {
    try {
        const teamsSnapshot = await db.collection('fantasyTeams').get();

        for (const teamDoc of teamsSnapshot.docs) {
            await updateUserTotalPoints(teamDoc.id);
        }

        console.log('✅ All user total points updated');

    } catch (error) {
        console.error('Error updating all total points:', error);
    }
}

// ===================================
// RESULTS TAB: PLAYER POINTS
// ===================================

/**
 * Render Fantasy Results (Player Points) for a specific gameweek
 */
async function renderFantasyResults(gameweekId) {
    const container = document.getElementById('fantasyResults');

    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="loading-spinner">⏳ Загрузка результатов...</div>';

    try {
        const gameweekIdToCheck = gameweekId || window.currentGameweekId || 'gw1';

        // Get all players first
        const playersSnapshot = await db.collection('players').get();
        const playersMap = new Map();
        playersSnapshot.forEach(doc => {
            playersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        // Get match stats for this gameweek
        const statsSnapshot = await db.collection('match_stats')
            .where('gameweekId', '==', gameweekIdToCheck)
            .get();

        if (statsSnapshot.empty) {
            container.innerHTML = `
                <div class="no-results-message">
                    <h3>Результаты пока недоступны</h3>
                    <p>Матчи тура еще не сыграны или статистика не внесена.</p>
                </div>
            `;
            return;
        }

        const playerResults = [];
        statsSnapshot.forEach(doc => {
            const data = doc.data();
            const player = playersMap.get(data.playerId);
            if (player) {
                // Live calculation components
                const total = (data.statsPoints || 0) + (data.mvpBonus || 0) + (data.ratingBonus || 0);

                playerResults.push({
                    name: player.name,
                    position: player.position,
                    team: player.team,
                    price: player.price,
                    goals: data.goals || 0,
                    assists: data.assists || 0,
                    avgRating: data.averageRating || 0,
                    totalPoints: total,
                    played: data.played || false
                });
            }
        });

        // Sort by total points (desc)
        playerResults.sort((a, b) => b.totalPoints - a.totalPoints);

        // Render HTML
        let html = `
            <div class="results-header">
                <h3>Итоги Тура ${gameweekIdToCheck.replace('gw', '')}</h3>
                <p>Очки, набранные игроками в этом туре</p>
            </div>
            <div class="league-table-wrapper">
                <table class="league-table results-table">
                    <thead>
                        <tr>
                            <th>Игрок</th>
                            <th class="text-center">Поз.</th>
                            <th class="text-center">Голы</th>
                            <th class="text-center">Асс.</th>
                            <th class="text-center">Рейт.</th>
                            <th class="text-center">Очки</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        playerResults.forEach((p, index) => {
            const rowClass = index < 3 ? 'top-performer' : '';
            const rankIcon = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';

            html += `
                <tr class="${rowClass}">
                    <td class="player-cell">
                        <span class="rank-icon">${rankIcon}</span>
                        <span class="player-name">${p.name}</span>
                        ${p.played ? '' : '<span class="did-not-play" title="Не играл">(DNP)</span>'}
                    </td>
                    <td class="text-center position-badge ${p.position.toLowerCase()}">${p.position}</td>
                    <td class="text-center stats-highlight">${p.goals}</td>
                    <td class="text-center stats-highlight">${p.assists}</td>
                    <td class="text-center stats-secondary" style="${p.avgRating >= 9.0 ? 'color: #2196F3; font-weight: bold;' : ''}">${p.avgRating.toFixed(1)}</td>
                    <td class="text-center points-final">${p.totalPoints}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error rendering results:', error);
        container.innerHTML = '<div class="error-message">❌ Ошибка загрузки результатов</div>';
    }
}
// ===================================
// EXPORTS
// ===================================
window.renderFantasyLeaderboard = renderFantasyLeaderboard;
window.renderOverallLeaderboard = renderOverallLeaderboard;
window.viewUserSquad = viewUserSquad;
window.renderSquadModal = renderSquadModal;
window.saveFantasySquad = saveFantasySquad;
// window.lockSquadsAfterDeadline = lockSquadsAfterDeadline; // Admin only, usually called via console or admin panel
