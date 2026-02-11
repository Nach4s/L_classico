// ===================================
// ADMIN PANEL - MATCH MANAGEMENT
// 3-Stage Workflow for Fantasy Football
// ===================================

var currentGameweekId = null;
let currentGameweekData = null;

// Helper: Check if players are initialized
async function checkPlayersInitialized() {
    if (typeof db === 'undefined') return false;
    try {
        const snapshot = await db.collection('players').limit(1).get();
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking players:', error);
        return false;
    }
}

// ===================================
// GAMEWEEK MANAGEMENT
// ===================================

/**
 * Create a new gameweek
 */
async function createGameweek(gameweekNumber, deadlineDate) {
    if (!isAdminLoggedIn) {
        showAlert('Только администратор может создать тур', 'error');
        return;
    }

    try {
        const gameweekId = `gw${gameweekNumber}`;

        await db.collection('gameweeks').doc(gameweekId).set({
            gameweekNumber,
            deadline: firebase.firestore.Timestamp.fromDate(deadlineDate),
            status: 'setup', // setup | stats_entry | voting_open | completed
            playersWhoPlayed: [],
            linkedMatches: [],    // NEW: Linked match IDs
            active_players: [],   // NEW: Players for voting
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Reset weekPoints to 0 for all users
        console.log('🔄 Resetting weekPoints for all users...');
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        const batch = db.batch();

        teamsSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                weekPoints: 0
            });
        });

        await batch.commit();
        console.log(`✅ Reset weekPoints for ${teamsSnapshot.size} users`);

        showAlert(`Тур ${gameweekNumber} создан!`, 'success');
        loadGameweek(gameweekId);

    } catch (error) {
        console.error('Error creating gameweek:', error);
        showAlert('Ошибка при создании тура', 'error');
    }
}

/**
 * Load gameweek data
 */
async function loadGameweek(gameweekId) {
    try {
        const doc = await db.collection('gameweeks').doc(gameweekId).get();

        if (!doc.exists) {
            console.warn(`Gameweek ${gameweekId} not found`);
            return null;
        }

        currentGameweekId = gameweekId;
        currentGameweekData = { id: doc.id, ...doc.data() };

        renderAdminPanel();
        return currentGameweekData;

    } catch (error) {
        console.error('Error loading gameweek:', error);
        return null;
    }
}

/**
 * Get all gameweeks
 */
async function getAllGameweeks() {
    try {
        const snapshot = await db.collection('gameweeks')
            .orderBy('gameweekNumber', 'desc')
            .get();

        const gameweeks = [];
        snapshot.forEach(doc => {
            gameweeks.push({ id: doc.id, ...doc.data() });
        });

        return gameweeks;
    } catch (error) {
        console.error('Error getting gameweeks:', error);
        return [];
    }
}

// ===================================
// STAGE 1: PLAYER SELECTION (WHO PLAYED)
// ===================================

/**
 * Render Stage 1: Unified Gameweek Setup
 * Combines: Deadline settings, Match selection, Player selection
 */
async function renderStage1_PlayerSelection() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    // Show loading
    container.innerHTML = '<div style="text-align:center; padding:30px;">⏳ Загрузка настроек тура...</div>';

    const players = await getAllPlayers();

    // Fetch recent matches for linking
    let recentMatches = [];
    try {
        const matchesSnapshot = await db.collection('matches')
            .orderBy('date', 'desc')
            .limit(20)
            .get();
        matchesSnapshot.forEach(doc => {
            recentMatches.push({ id: doc.id, ...doc.data() });
        });
    } catch (e) {
        console.warn('Could not fetch matches:', e);
    }

    // Get existing match stats to show who's already marked
    const existingStats = new Map();
    const statsSnapshot = await db.collection('match_stats')
        .doc(currentGameweekId)
        .collection('players')
        .get();

    statsSnapshot.forEach(doc => {
        const data = doc.data();
        existingStats.set(data.playerId, data.played);
    });

    // Get current gameweek data for pre-populating fields
    const gwData = currentGameweekData || {};
    const currentDeadline = gwData.deadline?.toDate ? gwData.deadline.toDate() : (gwData.deadline ? new Date(gwData.deadline) : null);
    const linkedMatches = gwData.linkedMatches || [];

    // Format deadline for input
    let deadlineValue = '';
    if (currentDeadline) {
        deadlineValue = currentDeadline.toISOString().slice(0, 16);
    } else {
        // Default to next Friday 09:50
        const nextFriday = getNextFriday();
        nextFriday.setHours(9, 50, 0, 0);
        deadlineValue = nextFriday.toISOString().slice(0, 16);
    }

    container.innerHTML = `
        <div class="admin-stage">
            <h3>📋 Настройка Тура ${gwData.gameweekNumber || ''}</h3>
            
            <!-- SECTION 1: Gameweek Settings -->
            <div class="gameweek-settings-section" style="background: #1a1a2e; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin-top: 0;">⚙️ Настройки Тура</h4>
                
                <div class="form-row" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #ccc;">📅 Fantasy Дедлайн (блокировка трансферов):</label>
                    <input 
                        type="datetime-local" 
                        id="gameweekDeadlineInput" 
                        class="form-input"
                        value="${deadlineValue}"
                        style="width: 100%; max-width: 300px;"
                    >
                </div>

                ${recentMatches.length > 0 ? `
                <div class="form-row" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #ccc;">⚽ Матчи Тура (выберите):</label>
                    <div class="matches-selection-grid" style="max-height: 150px; overflow-y: auto; background: #0f0f1a; padding: 10px; border-radius: 6px;">
                        ${recentMatches.map(match => {
        const matchDate = match.date?.toDate ? match.date.toDate() : new Date(match.date);
        const dateStr = matchDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const isLinked = linkedMatches.includes(match.id);
        return `
                                <label style="display: flex; align-items: center; gap: 8px; padding: 5px; cursor: pointer;">
                                    <input type="checkbox" class="match-link-checkbox" data-match-id="${match.id}" ${isLinked ? 'checked' : ''}>
                                    <span>${match.homeTeam || 'Команда'} vs ${match.awayTeam || 'Команда'}</span>
                                    <span style="color: #888; font-size: 0.85em;">(${dateStr})</span>
                                </label>
                            `;
    }).join('')}
                    </div>
                </div>
                ` : ''}

                <button class="btn btn-secondary" onclick="saveGameweekSettings()" style="margin-top: 10px;">
                    💾 Сохранить Настройки Тура
                </button>
            </div>

            <!-- SECTION 2: Player Selection -->
            <div class="player-selection-section" style="background: #1a1a2e; padding: 15px; border-radius: 8px;">
                <h4 style="margin-top: 0;">👥 Игроки Тура (для голосования)</h4>
                <p class="stage-description" style="color: #888; margin-bottom: 15px;">Отметьте игроков, которые вышли на поле.</p>
                
                <div class="players-selection-grid">
                    ${players.map(player => `
                        <div class="player-selection-item">
                            <label class="player-checkbox-label">
                                <input 
                                    type="checkbox" 
                                    class="player-played-checkbox" 
                                    data-player-id="${player.id}"
                                    ${existingStats.get(player.id) ? 'checked' : ''}
                                >
                                <span class="player-selection-name">${player.name}</span>
                                <span class="player-selection-position">${player.position}</span>
                                <span class="player-selection-team">${player.team}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>

                <div class="admin-stage-actions" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-success" onclick="freezeSquadsForVoting()">
                        ✅ Зафиксировать Состав
                    </button>
                    <button class="btn btn-primary" onclick="saveStage1_PlayedPlayers()">
                        ➡️ Сохранить и Перейти к Этапу 2
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Save gameweek settings (deadline + linked matches)
 */
async function saveGameweekSettings() {
    if (!isAdminLoggedIn || !currentGameweekId) {
        showAlert('Ошибка: нет доступа или тур не выбран', 'error');
        return;
    }

    try {
        // Get deadline value
        const deadlineInput = document.getElementById('gameweekDeadlineInput');
        const deadlineValue = deadlineInput ? new Date(deadlineInput.value) : null;

        // Get selected matches
        const matchCheckboxes = document.querySelectorAll('.match-link-checkbox:checked');
        const linkedMatches = [];
        matchCheckboxes.forEach(cb => {
            linkedMatches.push(cb.dataset.matchId);
        });

        // Update gameweek document
        await db.collection('gameweeks').doc(currentGameweekId).update({
            deadline: deadlineValue ? firebase.firestore.Timestamp.fromDate(deadlineValue) : null,
            linkedMatches: linkedMatches,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Refresh local data
        currentGameweekData.deadline = deadlineValue ? firebase.firestore.Timestamp.fromDate(deadlineValue) : null;
        currentGameweekData.linkedMatches = linkedMatches;

        showAlert('✅ Настройки тура сохранены!', 'success');

    } catch (error) {
        console.error('Error saving gameweek settings:', error);
        showAlert('Ошибка сохранения настроек: ' + error.message, 'error');
    }
}

/**
 * Freeze squads for voting - saves active_players array
 * Does NOT advance to Stage 2
 */
async function freezeSquadsForVoting() {
    if (!isAdminLoggedIn || !currentGameweekId) {
        showAlert('Ошибка: нет доступа или тур не выбран', 'error');
        return;
    }

    try {
        const checkboxes = document.querySelectorAll('.player-played-checkbox:checked');

        if (checkboxes.length === 0) {
            showAlert('Выберите хотя бы одного игрока!', 'error');
            return;
        }

        const activePlayersObjects = [];

        // Fetch all players to get details
        const playersSnapshot = await db.collection('players').get();
        const playersMap = new Map();
        playersSnapshot.forEach(doc => playersMap.set(doc.id, doc.data()));

        for (const checkbox of checkboxes) {
            const playerId = checkbox.dataset.playerId;
            const playerDetails = playersMap.get(playerId) || {};

            activePlayersObjects.push({
                id: playerId,
                name: playerDetails.name || 'Unknown',
                position: playerDetails.position || 'MID',
                team: playerDetails.team || 'Unknown'
            });
        }

        // Update gameweek with active_players
        await db.collection('gameweeks').doc(currentGameweekId).update({
            active_players: activePlayersObjects,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local data
        currentGameweekData.active_players = activePlayersObjects;

        showAlert(`✅ Состав зафиксирован! ${activePlayersObjects.length} игроков готовы для голосования.`, 'success');

    } catch (error) {
        console.error('Error freezing squads:', error);
        showAlert('Ошибка фиксации состава: ' + error.message, 'error');
    }
}

/**
 * Save Stage 1: Mark who played
 */
async function saveStage1_PlayedPlayers() {
    if (!isAdminLoggedIn || !currentGameweekId) return;

    try {
        const checkboxes = document.querySelectorAll('.player-played-checkbox');
        const playersWhoPlayed = [];
        const activePlayersObjects = []; // New array for rich data
        const batch = db.batch();

        // Fetch all players to get details (Position, Name)
        const playersSnapshot = await db.collection('players').get();
        const playersMap = new Map();
        playersSnapshot.forEach(doc => playersMap.set(doc.id, doc.data()));

        for (const checkbox of checkboxes) {
            const playerId = checkbox.dataset.playerId;
            const played = checkbox.checked;
            const playerDetails = playersMap.get(playerId) || {};

            if (played) {
                playersWhoPlayed.push(playerId);
                activePlayersObjects.push({
                    id: playerId,
                    name: playerDetails.name || 'Unknown',
                    position: playerDetails.position || 'MID',
                    team: playerDetails.team || 'Unknown'
                });
            }

            // Create/update match_stats document
            // NEW STRUCTURE: match_stats/{gameweekId}/players/{playerId}
            const docRef = db.collection('match_stats')
                .doc(currentGameweekId)
                .collection('players')
                .doc(playerId);

            batch.set(docRef, {
                gameweekId: currentGameweekId, // Redundant but good for double-check
                playerId,
                played,
                // Snapshot player details
                name: playerDetails.name || 'Unknown',
                position: playerDetails.position || 'MID',
                team: playerDetails.team || 'Unknown',
                // Initial values for points
                statsPoints: 0,
                mvpBonus: 0,
                ratingBonus: 0,
                totalPoints: 0,
                averageRating: 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // Update gameweek status
        const gameweekRef = db.collection('gameweeks').doc(currentGameweekId);
        batch.update(gameweekRef, {
            status: 'stats_entry',
            playersWhoPlayed, // Keep legacy array of IDs
            active_players: activePlayersObjects, // NEW: Full objects for voting/display
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        showAlert('✅ Состав сохранён! Переход к вводу статистики.', 'success');
        await loadGameweek(currentGameweekId);

    } catch (error) {
        console.error('Error saving played players:', error);
        showAlert('Ошибка при сохранении состава', 'error');
    }
}

// ===================================
// STAGE 2: STATS INPUT (GOALS, ASSISTS, MVP)
// ===================================

/**
 * Render Stage 2: Stats Input UI
 */
async function renderStage2_StatsInput() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    // Get only players who played
    const statsSnapshot = await db.collection('match_stats')
        .where('gameweekId', '==', currentGameweekId)
        .where('played', '==', true)
        .get();

    const playersWithStats = [];
    for (const doc of statsSnapshot.docs) {
        const data = doc.data();
        const playerDoc = await db.collection('players').doc(data.playerId).get();

        if (playerDoc.exists) {
            playersWithStats.push({
                ...data,
                playerName: playerDoc.data().name,
                playerPosition: playerDoc.data().position,
                playerTeam: playerDoc.data().team
            });
        }
    }

    container.innerHTML = `
        <div class="admin-stage">
            <h3>📊 Этап 2: Ввод Статистики</h3>
            <p class="stage-description">Введите голы и ассисты для каждого игрока. Выберите одного MVP.</p>
            
            <div class="stats-input-grid">
                ${playersWithStats.map(player => `
                    <div class="stats-input-row">
                        <div class="stats-player-info">
                            <span class="stats-player-name">${player.playerName}</span>
                            <span class="stats-player-badge">${player.playerPosition}</span>
                            <span class="stats-player-team">${player.playerTeam}</span>
                        </div>
                        <div class="stats-inputs">
                            <div class="stats-input-group">
                                <label>Голы</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="20"
                                    class="stats-input goals-input" 
                                    data-player-id="${player.playerId}"
                                    value="${player.goals || 0}"
                                >
                            </div>
                            <div class="stats-input-group">
                                <label>Ассисты</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="20"
                                    class="stats-input assists-input" 
                                    data-player-id="${player.playerId}"
                                    value="${player.assists || 0}"
                                >
                            </div>
                            <div class="stats-input-group mvp-group">
                                <label>MVP</label>
                                <input 
                                    type="radio" 
                                    name="mvp_player" 
                                    class="mvp-radio" 
                                    data-player-id="${player.playerId}"
                                    ${player.isMVP ? 'checked' : ''}
                                >
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="admin-stage-actions">
                <button class="btn btn-secondary" onclick="backToStage1()">
                    ← Вернуться к Этапу 1
                </button>
                <button class="btn btn-primary" onclick="saveStage2_Stats()">
                    ✅ Сохранить и Открыть Голосование
                </button>
            </div>
        </div>
    `;
}

/**
 * Save Stage 2: Stats and MVP
 */
async function saveStage2_Stats() {
    if (!isAdminLoggedIn || !currentGameweekId) return;

    try {
        const goalsInputs = document.querySelectorAll('.goals-input');
        const assistsInputs = document.querySelectorAll('.assists-input');
        const mvpRadio = document.querySelector('.mvp-radio:checked');

        const batch = db.batch();
        let mvpPlayerId = mvpRadio ? mvpRadio.dataset.playerId : null;

        // Update all players' stats
        for (let i = 0; i < goalsInputs.length; i++) {
            const playerId = goalsInputs[i].dataset.playerId;
            const goals = parseInt(goalsInputs[i].value) || 0;
            const assists = parseInt(assistsInputs[i].value) || 0;
            const isMVP = (playerId === mvpPlayerId);

            // CORRECT PATH: match_stats/{gameweekId}/players/{playerId}
            const docRef = db.collection('match_stats')
                .doc(currentGameweekId)
                .collection('players')
                .doc(playerId);

            // Get player position for MVP bonus calculation
            const playerDoc = await db.collection('players').doc(playerId).get();
            const playerPosition = playerDoc.exists ? playerDoc.data().position : 'MID';

            const statsPoints = calculateStatsPoints(goals, assists);
            const mvpBonus = getMVPBonus(playerPosition, isMVP);

            batch.update(docRef, {
                goals,
                assists,
                isMVP,
                statsPoints,
                mvpBonus,
                // totalPoints will be recalculated after votes
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        showAlert('✅ Статистика сохранена! Обновление очков пользователей...', 'success');

        // LIVE UPDATE: Recalculate user scores immediately
        if (typeof updateLiveUserSquads === 'function') {
            await updateLiveUserSquads(currentGameweekId);
        }

        // Move to stage 3
        renderStage3_OpenVoting();

    } catch (error) {
        console.error('Error saving stats:', error);
        showAlert('Ошибка при сохранении статистики', 'error');
    }
}

/**
 * Back to Stage 1
 */
async function backToStage1() {
    if (!currentGameweekId) return;

    await db.collection('gameweeks').doc(currentGameweekId).update({
        status: 'setup',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadGameweek(currentGameweekId);
}

// ===================================
// STAGE 3: OPEN VOTING
// ===================================

/**
 * Render Stage 3: Open Voting
 */
function renderStage3_OpenVoting() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    container.innerHTML = `
        <div class="admin-stage">
            <h3>🗳️ Этап 3: Открытие Голосования</h3>
            <p class="stage-description">
                Статистика сохранена. Нажмите кнопку ниже, чтобы открыть голосование для пользователей.
            </p>

            <div class="stage3-info">
                <div class="info-box">
                    <span class="info-icon">✅</span>
                    <p>Состав зафиксирован</p>
                </div>
                <div class="info-box">
                    <span class="info-icon">📊</span>
                    <p>Статистика введена</p>
                </div>
                <div class="info-box pending">
                    <span class="info-icon">⏳</span>
                    <p>Ожидает открытия голосования</p>
                </div>
            </div>

            <div class="admin-stage-actions">
                <button class="btn btn-secondary" onclick="backToStage2()">
                    ← Вернуться к Этапу 2
                </button>
                <button class="btn btn-primary btn-large" onclick="openVoting()">
                    🚀 Открыть Голосование
                </button>
            </div>
        </div>
    `;
}

/**
 * Back to Stage 2
 */
async function backToStage2() {
    if (!currentGameweekId) return;

    await db.collection('gameweeks').doc(currentGameweekId).update({
        status: 'stats_entry',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await loadGameweek(currentGameweekId);
}

/**
 * Open voting for users
 */
async function openVoting() {
    if (!isAdminLoggedIn || !currentGameweekId) return;

    try {
        const now = new Date();
        const votingEndsAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now

        await db.collection('gameweeks').doc(currentGameweekId).update({
            status: 'voting_open',
            votingOpenedAt: firebase.firestore.FieldValue.serverTimestamp(),
            votingEndsAt: firebase.firestore.Timestamp.fromDate(votingEndsAt),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('🗳️ Голосование открыто на 24 часа! Таймер запущен.', 'success');
        await loadGameweek(currentGameweekId);

    } catch (error) {
        console.error('Error opening voting:', error);
        showAlert('Ошибка при открытии голосования', 'error');
    }
}

/**
 * Close voting (Admin can manually close)
 */
async function closeVoting() {
    if (!isAdminLoggedIn || !currentGameweekId) return;

    if (!confirm('Закрыть голосование и зафиксировать результаты?')) {
        return;
    }

    try {
        await db.collection('gameweeks').doc(currentGameweekId).update({
            status: 'completed',
            votingClosedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Recalculate all player points with final votes
        await recalculateAllPlayersInGameweek(currentGameweekId);

        // LIVE UPDATE: Recalculate user scores with MVP/Votes
        if (typeof updateLiveUserSquads === 'function') {
            await updateLiveUserSquads(currentGameweekId);
        }

        showAlert('✅ Голосование закрыто! Результаты зафиксированы.', 'success');
        await loadGameweek(currentGameweekId);

    } catch (error) {
        console.error('Error closing voting:', error);
        showAlert('Ошибка при закрытии голосования', 'error');
    }
}

// ===================================
// MAIN ADMIN PANEL RENDERER
// ===================================

/**
 * Render admin panel based on current gameweek status
 */
function renderAdminPanel() {
    // Check global admin state
    const isUserAdmin = window.isAdminLoggedIn ||
        (window.currentUser && window.currentUser.email === 'tokkozha.s@gmail.com');

    if (!isUserAdmin) {
        return;
    }

    if (!currentGameweekData) {
        renderGameweekSelector();
        return;
    }

    const status = currentGameweekData.status;

    switch (status) {
        case 'setup':
            renderStage1_PlayerSelection();
            break;
        case 'stats_entry':
            renderStage2_StatsInput();
            break;
        case 'voting_open':
            renderVotingOpenStatus();
            break;
        case 'completed':
            renderCompletedStatus();
            break;
        default:
            renderGameweekSelector();
    }
}

/**
 * Render gameweek selector
 */
async function renderGameweekSelector() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    // CHECK: Are players initialized?
    const playersExist = await checkPlayersInitialized();

    if (!playersExist) {
        container.innerHTML = `
            <div class="init-warning">
                <h3>⚠️ База игроков не инициализирована</h3>
                <p>Перед созданием туров нужно добавить игроков в базу данных.</p>
                <p>Это делается один раз и занимает несколько секунд.</p>
                <button class="btn btn-primary btn-large" onclick="initializePlayers()">
                    🔧 Инициализировать базу игроков
                </button>
            </div>
        `;
        return;
    }

    const gameweeks = await getAllGameweeks();

    container.innerHTML = `
        <div class="admin-stage">
            <h3>🏆 Управление Турами</h3>
            
            <div class="gameweek-selector">
                <h4>Выберите тур:</h4>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="gameweekSelect" class="form-select" style="flex: 1;">
                        <option value="">-- Выберите тур --</option>
                        ${gameweeks.map(gw => `
                            <option value="${gw.id}">
                                Тур ${gw.gameweekNumber} - ${gw.status === 'completed' ? '✅ Завершён' : '🔄 Активен'}
                            </option>
                        `).join('')}
                    </select>
                    <button class="btn btn-primary" onclick="selectGameweek()">
                        Загрузить
                    </button>
                    <button class="btn btn-warning" onclick="manualRecalcWrapper()" title="Принудительный пересчет очков">
                        ♻️
                    </button>
                    <button class="btn btn-info" onclick="startTestVoting()" title="Тестовое голосование без сохранения">
                        🧪 ТестUI
                    </button>
                    <button class="btn btn-danger" onclick="deleteSelectedGameweek()" title="Удалить тур и все данные">
                        🗑️
                    </button>
                </div>
            </div>

            <div class="create-gameweek-section">
                <h4>Или создайте новый тур:</h4>
                <div class="form-row">
                    <input 
                        type="number" 
                        id="newGameweekNumber" 
                        placeholder="Номер тура" 
                        min="1"
                        class="form-input"
                    >
                    <input 
                        type="datetime-local" 
                        id="newGameweekDeadline" 
                        class="form-input"
                    >
                    <button class="btn btn-secondary" onclick="createNewGameweek()">
                        ➕ Создать Тур
                    </button>
                </div>
            </div>
            
            <div class="utility-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #333;">
                <h4>🛠️ Служебные функции:</h4>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-warning" onclick="resetWeekPoints()" title="Сбросить weekPoints для всех пользователей">
                        🔄 Сбросить Очки Тура
                    </button>
                </div>
                <p style="font-size: 0.85em; color: #888; margin-top: 8px;">
                    ⚠️ Используйте "Сбросить Очки Тура" если новый тур показывает старые очки
                </p>
            </div>


        </div>
    `;

    // Set default deadline to Friday 09:50
    const deadlineInput = document.getElementById('newGameweekDeadline');
    if (deadlineInput) {
        const nextFriday = getNextFriday();
        nextFriday.setHours(9, 50, 0, 0);
        deadlineInput.value = nextFriday.toISOString().slice(0, 16);
    }
}

/**
 * Delete selected gameweek
 */
async function deleteSelectedGameweek() {
    const select = document.getElementById('gameweekSelect');
    const gameweekId = select.value;

    if (!gameweekId) {
        showAlert('Выберите тур для удаления', 'error');
        return;
    }

    if (!confirm(`⚠️ ВНИМАНИЕ! \n\nВы собираетесь удалить ${gameweekId}.\nЭто действие удалит:\n- Сам тур\n- Всю статистику матчей этого тура\n- Все голоса пользователей за этот тур\n\nЭто действие НЕОБРАТИМО. Продолжить?`)) {
        return;
    }

    // Double confirmation
    const verifyCode = Math.floor(1000 + Math.random() * 9000);
    const userInput = prompt(`Для подтверждения введите код: ${verifyCode}`);

    if (userInput != verifyCode) {
        alert('Код неверен. Удаление отменено.');
        return;
    }

    await deleteGameweekFull(gameweekId);
}

/**
 * Perform full deletion of gameweek data
 */
async function deleteGameweekFull(gameweekId) {
    try {
        // Show loading state implies checking/deleting many docs
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'deleteLoading';
        loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;z-index:9999;';
        loadingMsg.innerHTML = '⏳ Удаление данных... Пожалуйста, подождите.';
        document.body.appendChild(loadingMsg);

        // Helper to delete in batches
        const deleteCollectionByQuery = async (queryText, query) => {
            let deletedTotal = 0;
            while (true) {
                // Fetch small batches to delete
                const snapshot = await query.limit(400).get();
                if (snapshot.empty) break;

                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                deletedTotal += snapshot.size;
                console.log(`Deleted ${snapshot.size} docs from ${queryText}`);
            }
            return deletedTotal;
        };

        const batch = db.batch();

        // 1. Delete Gameweek Doc
        const gwRef = db.collection('gameweeks').doc(gameweekId);
        batch.delete(gwRef);

        // 2. Delete Match Stats Subcollections (NEW)
        console.log('Deleting match_stats/matches...');
        await deleteCollectionByQuery('match_stats/matches',
            db.collection('match_stats').doc(gameweekId).collection('matches')
        );

        console.log('Deleting match_stats/players...');
        await deleteCollectionByQuery('match_stats/players',
            db.collection('match_stats').doc(gameweekId).collection('players')
        );

        // Delete the parent match_stats document
        await db.collection('match_stats').doc(gameweekId).delete();

        // 3. Delete Player Votes
        const votesSnapshot = await db.collection('player_votes')
            .where('gameweekId', '==', gameweekId)
            .get();

        votesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 4. Delete Votes (legacy/alternative collection check)
        const legacyVotesSnapshot = await db.collection('votes')
            .where('gameweekId', '==', gameweekId)
            .get();

        legacyVotesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        showAlert(`✅ Тур ${gameweekId} и все данные удалены`, 'success');

        // Reset state if current was deleted
        if (currentGameweekId === gameweekId) {
            currentGameweekId = null;
            currentGameweekData = null;
        }

        // Refresh selector
        renderGameweekSelector();

    } catch (error) {
        console.error('Error deleting gameweek:', error);
        showAlert('Ошибка при удалении: ' + error.message, 'error');
    }
}

/**
 * Select existing gameweek
 */
async function selectGameweek() {
    const select = document.getElementById('gameweekSelect');
    const gameweekId = select.value;

    if (!gameweekId) {
        showAlert('Выберите тур', 'error');
        return;
    }

    await loadGameweek(gameweekId);
}

/**
 * Create new gameweek
 */
async function createNewGameweek() {
    const numberInput = document.getElementById('newGameweekNumber');
    const deadlineInput = document.getElementById('newGameweekDeadline');

    const gameweekNumber = parseInt(numberInput.value);
    const deadline = new Date(deadlineInput.value);

    if (!gameweekNumber || isNaN(gameweekNumber)) {
        showAlert('Введите номер тура', 'error');
        return;
    }

    if (!deadlineInput.value) {
        showAlert('Выберите дедлайн', 'error');
        return;
    }

    await createGameweek(gameweekNumber, deadline);
}

/**
 * Get next Friday
 */
function getNextFriday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    return nextFriday;
}

/**
 * Render voting open status
 */
// NEW: Extend Voting
async function extendVoting() {
    if (!currentGameweekId) return;

    try {
        const gwDoc = await db.collection('gameweeks').doc(currentGameweekId).get();
        if (!gwDoc.exists) return;

        const currentEnd = gwDoc.data().votingEndsAt.toDate();
        const newEnd = new Date(currentEnd.getTime() + (1 * 60 * 60 * 1000)); // +1h

        await db.collection('gameweeks').doc(currentGameweekId).update({
            votingEndsAt: firebase.firestore.Timestamp.fromDate(newEnd),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('✅ Голосование продлено на 1 час!', 'success');
        await loadGameweek(currentGameweekId);

    } catch (e) {
        console.error(e);
        showAlert('Ошибка продления: ' + e.message, 'error');
    }
}

// NEW: Go to Voting Page
function goToVotingPage() {
    // Switch tab to 'voting' (assuming it exists in app structure)
    // Or just alert user where to go if outside admin panel scope
    const votingTab = document.querySelector('[data-tab="voting"]'); // Main nav tab
    if (votingTab) {
        votingTab.click();
        // Hide admin panel if needed? No, just switch view.
    } else {
        showAlert('Перейдите на вкладку "Голосование" в главном меню', 'info');
    }
}

function renderVotingOpenStatus() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    // Calculate remaining time for display
    let timeRemaining = "Загрузка...";
    if (currentGameweekData && currentGameweekData.votingEndsAt) {
        const end = currentGameweekData.votingEndsAt.toDate();
        const now = new Date();
        const diff = end - now;
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timeRemaining = `${hours}ч ${mins}м`;
        } else {
            timeRemaining = "Завершено";
        }
    }

    container.innerHTML = `
        <div class="admin-stage">
            <h3>✅ Голосование Открыто</h3>
            <p class="stage-description success-message">
                Пользователи могут голосовать. <br>
                ⏳ Осталось: <strong>${timeRemaining}</strong>
            </p>

            <div class="admin-stage-actions">
                <button class="btn btn-primary" onclick="extendVoting()">
                    ⏰ Продлить (+1ч)
                </button>
                
                <button class="btn btn-secondary" onclick="goToVotingPage()">
                    🗳️ Оценить Игроков (Перейти)
                </button>

                <!-- 
                <button class="btn btn-danger" onclick="closeVoting()">
                    🔒 Закрыть Голосование
                </button>
                -->
            </div>
            
            <button class="btn btn-secondary btn-sm" onclick="renderGameweekSelector()" style="margin-top:20px">
                ← Назад к списку туров
            </button>
        </div>
    `;
}

/**
 * Render completed status
 */
function renderCompletedStatus() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    container.innerHTML = `
        <div class="admin-stage">
            <h3>🏁 Тур Завершён</h3>
            <p class="stage-description">Голосование закрыто. Результаты зафиксированы.</p>

            <div class="admin-stage-actions">
                <button class="btn btn-secondary" onclick="forceEditStage1()">
                    👥 Редактировать (Открыть заново)
                </button>
                <button class="btn btn-secondary" onclick="renderGameweekSelector()">
                    ← Выбрать Другой Тур
                </button>
            </div>
    `;
}

// NEW: Recalculate Wrapper (Full Update: Ratings -> MVP -> Points)
async function manualRecalcWrapper() {
    const gwId = document.getElementById('gameweekSelect')?.value;
    if (!gwId) {
        alert('Выберите тур из списка!');
        return;
    }

    if (!confirm(`⚠️ ПОЛНЫЙ ПЕРЕСЧЕТ для ${gwId}?\n\nЭто действие:\n1. 📊 Пересчитает рейтинг игроков (из базы голосов)\n2. 🏆 Переопределит MVP и бонусы\n3. 👥 Обновит очки всех фэнтези команд\n\nИспользуйте это, если вы правили голоса в базе вручную.\nПродолжить?`)) {
        return;
    }

    const btn = document.querySelector('button[onclick="manualRecalcWrapper()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳';
    }

    try {
        // 1. Get Match ID linked to this gameweek
        const gwDoc = await db.collection('gameweeks').doc(gwId).get();
        if (!gwDoc.exists) throw new Error('Gameweek not found');

        const matchId = gwDoc.data().matchId;

        if (matchId && typeof recalculateMVP === 'function') {
            // This function does everything: MVP, Ratings, Points, User Squads
            console.log(`🔄 Calling recalculateMVP for match ${matchId} (GW: ${gwId})`);
            await recalculateMVP(matchId);
        } else if (typeof updateLiveUserSquads === 'function') {
            // Fallback if no match linked or function missing
            console.warn('⚠️ No matchId found, falling back to updateLiveUserSquads');
            await updateLiveUserSquads(gwId);
            alert('✅ Очки команд пересчитаны (НО рейтинги матча не обновлены, т.к. матч не найден)');
        } else {
            throw new Error('Функции пересчета не найдены');
        }

    } catch (e) {
        console.error(e);
        alert('❌ Ошибка: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '♻️';
        }
    }
}

// NEW: Manual Reset Week Points
async function resetWeekPoints() {
    if (!isAdminLoggedIn) {
        alert('Только администратор может сбросить очки');
        return;
    }

    if (!confirm('⚠️ СБРОСИТЬ ОЧКИ ТУРА для всех пользователей?\n\nЭто установит weekPoints = 0 для всех менеджеров.\n\nИспользуйте это для нового тура, если очки не сбросились автоматически.\n\nПродолжить?')) {
        return;
    }

    try {
        console.log('🔄 Resetting weekPoints for all users...');
        const teamsSnapshot = await db.collection('fantasyTeams').get();
        const batch = db.batch();

        teamsSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                weekPoints: 0
            });
        });

        await batch.commit();
        console.log(`✅ Reset weekPoints for ${teamsSnapshot.size} users`);
        alert(`✅ Очки тура сброшены для ${teamsSnapshot.size} пользователей!`);

    } catch (error) {
        console.error('Error resetting week points:', error);
        alert('❌ Ошибка при сбросе очков: ' + error.message);
    }
}

// ===================================
// GLOBAL EXPORTS
// ===================================
window.renderAdminPanel = renderAdminPanel;
window.manualRecalcWrapper = manualRecalcWrapper;
window.resetWeekPoints = resetWeekPoints;
window.renderGameweekSelector = renderGameweekSelector;
window.loadGameweek = loadGameweek;
window.createNewGameweek = createNewGameweek;
window.selectGameweek = selectGameweek;
window.saveGameweekSettings = saveGameweekSettings;
window.freezeSquadsForVoting = freezeSquadsForVoting;
window.saveStage1_PlayedPlayers = saveStage1_PlayedPlayers;
window.forceEditStage1 = forceEditStage1;
window.extendVoting = extendVoting;
window.goToVotingPage = goToVotingPage;

console.log('✅ Admin Panel loaded');

async function snapshotSquadsForGameweek() {
    if (!currentGameweekId) { alert('Тур не выбран!'); return; }

    // Prevent accidental clicks with strong confirmation
    const confirmMsg = `📸 СДЕЛАТЬ СНЭПШОТ?\n\nВы собираетесь скопировать текущий активный состав КАЖДОГО пользователя в архив тура "${currentGameweekId}".\n\n📌 ЗАЧЕМ ЭТО НУЖНО:\n- Это фиксирует команды для подсчета очков.\n- После этого изменения в "Моя Команда" не повлияют на этот тур.\n\nПродолжить?`;

    if (!confirm(confirmMsg)) return;

    try {
        const loaderBtn = event.target;
        const originalText = loaderBtn.innerText;
        loaderBtn.innerText = '⏳ Копирование...';
        loaderBtn.disabled = true;

        const snapshot = await db.collection('fantasyTeams').get();
        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.players && data.players.length > 0) {
                // Target: gameweeks/{gwId}/squads/{userId}
                const squadRef = db.collection('gameweeks').doc(currentGameweekId)
                    .collection('squads').doc(doc.id);

                batch.set(squadRef, {
                    userId: doc.id,
                    teamName: data.teamName || 'Team ' + doc.id,
                    managerName: data.managerName || 'Unknown',
                    players: data.players,
                    captainId: data.captainId || null,
                    viceCaptainId: data.viceCaptainId || null,
                    chips: data.activeChips || {},
                    totalPoints: 0, // Will be calculated by points engine
                    snapshotAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                count++;
            }
        });

        await batch.commit();
        alert(`✅ Успешно! Заархивировано ${count} команд в ${currentGameweekId}.`);
    } catch (e) {
        console.error(e);
        alert('Ошибка при создании снэпшота: ' + e.message);
    } finally {
        // Reload UI to reset button state (or just reset manually)
        const loaderBtn = document.querySelector('button[onclick="snapshotSquadsForGameweek()"]');
        if (loaderBtn) {
            loaderBtn.innerText = '📸 Создать Снэпшот Составов';
            loaderBtn.disabled = false;
        }
    }
}

window.snapshotSquadsForGameweek = snapshotSquadsForGameweek;
