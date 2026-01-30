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
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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
 * Render Stage 1: Player Selection UI
 */
/**
 * Render Stage 1: Player Selection UI
 */
async function renderStage1_PlayerSelection() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    const players = await getAllPlayers();

    // Get existing match stats to show who's already marked
    // NEW STRUCTURE: match_stats/{gameweekId}/players/{playerId}
    const existingStats = new Map();
    const statsSnapshot = await db.collection('match_stats')
        .doc(currentGameweekId)
        .collection('players')
        .get();

    statsSnapshot.forEach(doc => {
        const data = doc.data();
        existingStats.set(data.playerId, data.played);
    });

    container.innerHTML = `
        <div class="admin-stage">
            <h3>📋 Этап 1: Фиксация Состава</h3>
            <p class="stage-description">Отметьте галочками игроков, которые вышли на поле в этом туре.</p>
            
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

            <div class="admin-stage-actions">
                <button class="btn btn-primary" onclick="saveStage1_PlayedPlayers()">
                    ✅ Сохранить и Перейти к Этапу 2
                </button>
            </div>
        </div>
    `;
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

            const docId = `${currentGameweekId}_${playerId}`;
            const docRef = db.collection('match_stats').doc(docId);

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

        showAlert('✅ Статистика сохранена!', 'success');

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
async function forceEditStage1() {
    if (!currentGameweekId) return;
    if (!confirm('Вернуться к Этапу 1 (Выбор Игроков)?\n\nТекущий статус тура будет сброшен на "setup".\nСтатистика матча НЕ удалится, но вам нужно будет пройти этапы сохранения снова.')) return;

    await db.collection('gameweeks').doc(currentGameweekId).update({
        status: 'setup',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadGameweek(currentGameweekId);
}

function renderVotingOpenStatus() {
    const container = document.getElementById('adminStageContent');

    if (!container) return;

    container.innerHTML = `
        <div class="admin-stage">
            <h3>✅ Голосование Открыто</h3>
            <p class="stage-description success-message">
                Пользователи могут голосовать за игроков. Результаты обновляются автоматически.
            </p>

            <div class="admin-stage-actions">
                <button class="btn btn-secondary" onclick="backToStage2()">
                    ← Изменить Статистику
                </button>
                <button class="btn btn-secondary" onclick="forceEditStage1()">
                    👥 Изменить Состав (Этап 1)
                </button>
                <button class="btn btn-danger" onclick="closeVoting()">
                    🔒 Закрыть Голосование
                </button>
            </div>
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
