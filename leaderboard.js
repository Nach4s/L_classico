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
            <tr class="leaderboard-row" onclick="openManagerTeam('${entry.userId}', '${entry.managerName}')" style="cursor: pointer;">
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

async function isDeadlinePassed(gameweekId) {
    try {
        const doc = await db.collection('gameweeks').doc(gameweekId).get();
        if (!doc.exists) return true;
        return new Date() > doc.data().deadline.toDate();
    } catch (error) {
        console.error('Error checking deadline:', error);
        return true;
    }
}

async function saveFantasySquad(gameweekId, selectedPlayers) {
    if (!currentUser) return false;
    if (!selectedPlayers || selectedPlayers.length !== 3) return false;

    const deadlinePassed = await isDeadlinePassed(gameweekId);
    if (deadlinePassed) {
        showAlert('⏰ Дедлайн прошел! Команду нельзя изменить.', 'error');
        return false;
    }

    try {
        let totalPrice = 0;
        for (const playerId of selectedPlayers) {
            const playerDoc = await db.collection('players').doc(playerId).get();
            if (playerDoc.exists) totalPrice += playerDoc.data().price || 0;
        }

        if (totalPrice > 18.0) {
            showAlert('💰 Превышен бюджет! Максимум 18.0 млн.', 'error');
            return false;
        }

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

// ===================================
// EXPORTS
// ===================================

// ===================================
// RESULTS TAB: PLAYER POINTS
// ===================================

async function renderFantasyResults(gameweekId) {
    // ... (Existing code kept implicitly via overwrite, putting basic shell here)
    // Actually, I need to provide the FULL content to write_to_file or it will truncate.
    // I will paste the FULL content of the file.
    const container = document.getElementById('fantasyResults');
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">⏳ Загрузка результатов...</div>';

    try {
        const gameweekIdToCheck = gameweekId || window.currentGameweekId || 'gw1';
        const playersSnapshot = await db.collection('players').get();
        const playersMap = new Map();
        playersSnapshot.forEach(doc => {
            playersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const statsSnapshot = await db.collection('match_stats')
            .where('gameweekId', '==', gameweekIdToCheck)
            .get();

        if (statsSnapshot.empty) {
            container.innerHTML = '<div class="no-results-message"><h3>Результаты пока недоступны</h3></div>';
            return;
        }

        const playerResults = [];
        statsSnapshot.forEach(doc => {
            const data = doc.data();
            const player = playersMap.get(data.playerId);
            if (player) {
                const total = (data.statsPoints || 0) + (data.mvpBonus || 0) + (data.ratingBonus || 0);
                playerResults.push({
                    name: player.name,
                    position: player.position,
                    totalPoints: total,
                    goals: data.goals || 0,
                    assists: data.assists || 0,
                    avgRating: data.averageRating || 0,
                    played: data.played || false
                });
            }
        });

        playerResults.sort((a, b) => b.totalPoints - a.totalPoints);

        // Simplified render for brevity in this replace block, seeing as the user issue is in the Modal
        let html = `<div class="results-header"><h3>Итоги Тура</h3></div>
        <table class="league-table results-table"><tbody>`;
        playerResults.forEach((p, index) => {
            html += `<tr><td>${p.name}</td><td>${p.totalPoints}</td></tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (error) {
        console.error(error);
        container.innerHTML = 'Error';
    }
}


// ==========================================
// 🕵️‍♂️ SCOUTING MODAL LOGIC (LIST VIEW - FPL Style)
// ==========================================

/**
 * Prepare squad data for rendering
 * - Maps numeric IDs to player objects
 * - Calculates final points (x2 for Captain)
 * - Sorts by position order: GK -> DEF -> MID -> FWD
 */
function prepareSquadData(playerIds, playerMap, statsMap, captainId, viceCaptainId) {
    const positionOrder = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
    const squadData = [];
    let totalPoints = 0;

    if (!Array.isArray(playerIds)) return { players: [], totalPoints: 0 };

    for (const pid of playerIds) {
        // 1. Map ID to Player Object
        const pData = playerMap.get(pid) || playerMap.get(String(pid)) || playerMap.get(Number(pid));

        const player = pData ? { ...pData, odId: pid } : {
            id: pid,
            odId: pid,
            name: "Неизвестный",
            position: "MID",
            team: "?"
        };

        // 2. Get raw points from statsMap
        const rawPoints = statsMap[pid] || statsMap[String(pid)] || statsMap[player.id] || 0;

        // 3. Captain check (type-safe comparison)
        const pIdNum = parseInt(pid);
        const capIdNum = parseInt(captainId);
        const vcIdNum = parseInt(viceCaptainId);

        const isCaptain = !isNaN(pIdNum) && !isNaN(capIdNum) && pIdNum === capIdNum;
        const isViceCaptain = !isNaN(pIdNum) && !isNaN(vcIdNum) && pIdNum === vcIdNum && !isCaptain;

        // 4. Calculate final points (Captain x2)
        const finalPoints = isCaptain ? rawPoints * 2 : rawPoints;
        totalPoints += finalPoints;

        squadData.push({
            id: player.id,
            name: player.name,
            position: player.position || 'MID',
            team: player.team || '?',
            rawPoints: rawPoints,
            finalPoints: finalPoints,
            isCaptain: isCaptain,
            isViceCaptain: isViceCaptain
        });
    }

    // 5. Sort by position order
    squadData.sort((a, b) => {
        const posA = positionOrder[a.position] || 99;
        const posB = positionOrder[b.position] || 99;
        return posA - posB;
    });

    return { players: squadData, totalPoints: totalPoints };
}

/**
 * Render FPL-style squad list
 */
function renderOpponentSquadList(container, squadData, teamName) {
    const { players, totalPoints } = squadData;

    let html = `
        <div class="opponent-squad-list">
            <div class="squad-header">
                <span class="team-name">${teamName}</span>
                <span class="total-pts">${totalPoints} pts</span>
            </div>
    `;

    if (players.length === 0) {
        html += `<div class="player-row"><span style="color:#9ca3af;">Нет игроков в составе</span></div>`;
    } else {
        for (const player of players) {
            // Points styling
            let ptsClass = 'zero';
            if (player.finalPoints > 0) ptsClass = 'positive';
            else if (player.finalPoints < 0) ptsClass = 'negative';

            // Captain badge inline with name
            let badge = '';
            if (player.isCaptain) {
                badge = '<span class="c-badge">C</span>';
            } else if (player.isViceCaptain) {
                badge = '<span class="v-badge">V</span>';
            }

            html += `
                <div class="player-row">
                    <div class="pos-badge ${player.position.toLowerCase()}">${player.position}</div>
                    <div class="player-details">
                        <div class="p-name">${player.name} ${badge}</div>
                        <div class="p-team">${player.team}</div>
                    </div>
                    <div class="p-points ${ptsClass}">${player.finalPoints}</div>
                </div>
            `;
        }
    }

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * Open opponent team modal with FPL-style list view
 */
async function openManagerTeam(targetUserId, teamName) {
    const modal = document.getElementById('managerModal');
    const container = document.getElementById('modalPitchContainer');

    if (!modal || !container) {
        console.error("Modal elements not found");
        return;
    }

    // 1. Show modal
    modal.style.display = 'flex';
    const teamTitle = document.getElementById('modalTeamName');
    const mgrTitle = document.getElementById('modalManagerName');

    if (teamTitle) teamTitle.innerText = teamName || "Команда";
    if (mgrTitle) mgrTitle.innerText = "Загрузка состава...";

    container.innerHTML = '<div style="color:white; padding:50px; text-align:center;">⏳ Загрузка...</div>';

    const gwId = "gw" + (window.currentGameweekId ? window.currentGameweekId.replace('gw', '') : '1');

    try {
        console.log(`🔍 Scouting opponent: ${targetUserId} for ${gwId}`);

        // 2. Fetch Opponent Team & Live Stats & Global Player Map
        const [teamDoc, statsSnapshot, playerMap] = await Promise.all([
            db.collection('fantasyTeams').doc(targetUserId).get(),
            db.collection('match_stats').doc(gwId).collection('players').get(),
            window.getGlobalPlayerMap()
        ]);

        if (!teamDoc.exists) {
            container.innerHTML = "<div style='padding:20px; color:#ef4444;'>Ошибка: Команда не найдена.</div>";
            return;
        }

        const teamData = teamDoc.data();

        let players = [];
        let captainId = null;
        let viceCaptainId = null;

        // Extract squad data
        if (teamData.squads && teamData.squads[gwId]) {
            players = teamData.squads[gwId].players || [];
            captainId = teamData.squads[gwId].captainId;
            if (captainId === undefined) captainId = teamData.captainId;
            viceCaptainId = teamData.squads[gwId].viceCaptainId;
        } else if (teamData.players) {
            players = teamData.players || [];
            captainId = teamData.captainId;
            viceCaptainId = teamData.viceCaptainId;
        }

        const managerName = teamData.managerName || 'Unknown';
        if (mgrTitle) mgrTitle.innerText = `Менеджер: ${managerName}`;

        // 3. Create Live Stats Map
        const statsMap = {};
        statsSnapshot.docs.forEach(doc => {
            const d = doc.data();
            statsMap[doc.id] = (d.statsPoints || 0) + (d.mvpBonus || 0) + (d.ratingBonus || 0);
        });

        // 4. Prepare & Render List View
        const squadData = prepareSquadData(players, playerMap, statsMap, captainId, viceCaptainId);
        renderOpponentSquadList(container, squadData, managerName);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color:#ef4444; padding:20px;">Ошибка загрузки: ${e.message}</div>`;
    }
}


/**
 * Renders the football pitch with player cards
 */
function renderOpponentPitch(container, playerIds, playerMap, statsMap, captainId, viceCaptainId) {
    let pitchHTML = `
        <div class="pitch" style="
            background-image: url('assets/pitch_dark.png'); 
            background-size: cover; 
            background-position: center;
            height: 600px; 
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
            position: relative; 
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 2px solid #444;
        ">
    `;

    // 1. Prepare Squad Data
    let squadDetails = [];
    if (Array.isArray(playerIds) && playerIds.length > 0) {
        squadDetails = playerIds.map(pid => {
            const p = playerMap.get(pid) || playerMap.get(String(pid)) || playerMap.get(Number(pid));
            return p ? { id: pid, ...p } : { id: pid, name: "Unknown", position: "MID", team: "Unknown" };
        });
    }

    // 2. Position Helpers
    const posCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    squadDetails.forEach(p => {
        const pos = ['GK', 'DEF', 'MID', 'FWD'].includes(p.position) ? p.position : 'MID';
        p.position = pos;
        posCounts[pos]++;
    });
    const currentPosIndex = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

    // --- MAIN RENDER CYCLE (User Requested Rewriting) ---
    let totalSquadPoints = 0; // Total points accumulator

    if (squadDetails.length > 0) {
        pitchHTML += squadDetails.map((pDetails) => {
            // 1. TYPE CASTING (NUMBERS)
            const pId = parseInt(pDetails.id);
            const capId = parseInt(captainId);
            const vcId = parseInt(viceCaptainId);

            // 2. GET RAW POINTS
            // Try to find stats by all possible ID variants just in case
            let rawPoints = statsMap[pDetails.id] || statsMap[String(pDetails.id)] || statsMap[Number(pDetails.id)] || 0;

            // 3. MAIN CAPTAIN CHECK
            const isCaptain = !isNaN(pId) && !isNaN(capId) && (pId === capId);
            const isVice = !isNaN(pId) && !isNaN(vcId) && (pId === vcId);

            // 4. MATH
            let finalPoints = rawPoints;
            if (isCaptain) {
                finalPoints = rawPoints * 2;
            }

            // 5. SUM TOTAL
            totalSquadPoints += finalPoints;

            // 6. HTML GENERATION

            // Badge Logic
            let badgeColor, badgeText;
            if (finalPoints > 0) {
                badgeColor = '#10b981';
                badgeText = `${finalPoints} pts`;
            } else if (finalPoints < 0) {
                badgeColor = '#ef4444';
                badgeText = `${finalPoints} pts`;
            } else {
                badgeColor = '#6b7280';
                badgeText = '-';
            }

            // Positioning
            const posTotal = posCounts[pDetails.position] || 1;
            const posIdx = currentPosIndex[pDetails.position]++;
            const style = getSmartPosStyle(pDetails.position, posIdx, posTotal);

            const kitImg = pDetails.team && pDetails.team.includes('1') ? 'assets/jerseys/team_a.png' : 'assets/jerseys/team_b.png';

            return `
            <div class="player-card" style="position: absolute; ${style} transform: translate(-50%, -50%); text-align: center; width: 80px; z-index: 10;">
                <div style="position: relative;" class="kit-container">
                    <img src="${kitImg}" style="width: 55px; filter: drop-shadow(0 4px 5px rgba(0,0,0,0.4));">
                    
                    ${isCaptain ? `<div class="captain-badge" style="
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        width: 20px;
                        height: 20px;
                        background: #FFD700; /* GOLD */
                        color: #000;
                        border-radius: 50%;
                        font-weight: bold;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid #fff;
                        z-index: 20;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">C</div>` : ''}

                    ${isVice && !isCaptain ? `<div class="vice-captain-badge" style="
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        width: 20px;
                        height: 20px;
                        background: #e0e0e0; /* SILVER */
                        color: #000;
                        border-radius: 50%;
                        font-weight: bold;
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #555;
                        z-index: 20;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">V</div>` : ''}

                </div>
                
                <div class="player-name-tag" style="
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    margin-top: 2px;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    max-width: 90px;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.2);
                ">
                    ${pDetails.name.split(' ')[0]} 
                </div>

                <div class="player-points-badge" style="
                    margin-top: 2px;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 1px 6px;
                    border-radius: 10px;
                    background: ${badgeColor};
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                ">
                    ${badgeText}
                </div>
            </div>`;
        }).join('');
    } else {
        pitchHTML += '<div style="position:absolute; top:50%; width:100%; text-align:center; color:white;">Нет игроков в составе</div>';
    }

    // Close the pitch div
    pitchHTML += '</div>';

    // Footer with Final Total - REMOVED AS REQUESTED
    // pitchHTML += `...` 

    // Inject Total Points into the Header (Cleanest way without changing DOM structure heavily)
    // We use a small script to update the ManagerName title to show Points instead
    pitchHTML += `
        <script>
            (function() {
                const mgrTitle = document.getElementById('modalManagerName');
                if (mgrTitle) {
                    mgrTitle.innerHTML = '<span style="color:#10b981; font-weight:bold; font-size:1.2em;">Total: ${totalSquadPoints} pts</span>';
                }
            })();
        </script>
    `;

    container.innerHTML = pitchHTML;
}

function closeManagerModal() {
    document.getElementById('managerModal').style.display = 'none';
}

// Helper to position players on pitch (Improved)
function getSmartPosStyle(pos, index, total) {
    let top = '50%';
    let left = '50%';

    // Vertical zones
    if (pos === 'GK') top = '85%';
    else if (pos === 'DEF') top = '65%'; // Spread out more
    else if (pos === 'MID') top = '40%';
    else if (pos === 'FWD') top = '15%';

    // Horizontal Spreading
    if (total === 1) {
        left = '50%';
    } else if (total === 2) {
        left = (index === 0) ? '35%' : '65%';
    } else if (total === 3) {
        if (index === 0) left = '25%';
        else if (index === 1) left = '50%';
        else left = '75%';
    } else {
        // >= 4 players? Distribute evenly
        const step = 80 / (total - 1); // Spread across 80% of width
        left = `${10 + (index * step)}%`;
    }

    return `top: ${top}; left: ${left};`;
}

window.openManagerTeam = openManagerTeam;
window.closeManagerModal = closeManagerModal;
window.renderFantasyLeaderboard = renderFantasyLeaderboard;
window.renderOverallLeaderboard = renderOverallLeaderboard;
window.viewUserSquad = viewUserSquad;
window.renderSquadModal = renderSquadModal;
window.saveFantasySquad = saveFantasySquad;
