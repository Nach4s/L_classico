// ===================================
// USER VOTING SYSTEM
// Rating players 1.0-10.0 with live visualization
// ===================================

let currentVotingGameweekId = null;
let userVotes = new Map(); // Map<playerId, rating>

// ===================================
// VOTING UI
// ===================================

/**
 * Load and render voting interface
 */
async function loadVotingInterface(gameweekId) {
    // Use global current gameweek if not provided
    currentVotingGameweekId = gameweekId || window.currentGameweekId || currentGameweekId;

    // PROTECT TEST MODE: If test mode was just triggered, block this load
    if (window.votingTestMode) {
        console.log('🧪 Skipping loadVotingInterface (Test Mode Active)');
        window.votingTestMode = false; // Reset for next time
        return;
    }

    console.log('🗳️ Loading voting interface for gameweek:', currentVotingGameweekId);

    if (!currentVotingGameweekId) {
        // Try to find active gameweek
        try {
            const activeGw = await db.collection('gameweeks')
                .where('status', '==', 'voting_open')
                .limit(1)
                .get();

            if (!activeGw.empty) {
                currentVotingGameweekId = activeGw.docs[0].id;
                console.log('🗳️ Found active gameweek:', currentVotingGameweekId);
            }
        } catch (e) {
            console.error('Error finding gameweek:', e);
        }
    }

    if (!currentVotingGameweekId) {
        document.getElementById('fantasyVotingContent').innerHTML = `
            <div class="voting-empty">
                <p>Нет активного тура для голосования</p>
            </div>
        `;
        return;
    }

    // Check if user is logged in
    if (!currentUser && !window.currentUser) {
        document.getElementById('fantasyVotingContent').innerHTML = `
            <div class="voting-login-required">
                <h3>Войдите, чтобы голосовать</h3>
                <button class="btn btn-primary" onclick="openModal('authModal')">Войти</button>
            </div>
        `;
        return;
    }

    // Check gameweek status
    console.log('🗳️ Checking gameweek doc:', currentVotingGameweekId);
    const gameweekDoc = await db.collection('gameweeks').doc(currentVotingGameweekId).get();

    if (!gameweekDoc.exists) {
        console.error('❌ Gameweek not found:', currentVotingGameweekId);
        document.getElementById('fantasyVotingContent').innerHTML = `
            <div class="voting-empty">
                <p>Тур не найден: ${currentVotingGameweekId}</p>
                <p style="font-size: 12px; color: #888;">Попробуйте обновить страницу</p>
            </div>
        `;
        return;
    }

    const gameweek = gameweekDoc.data();

    // Check for deadline
    if (gameweek.votingEndsAt) {
        const endsAt = gameweek.votingEndsAt.toDate ? gameweek.votingEndsAt.toDate() : new Date(gameweek.votingEndsAt);
        const now = new Date();

        if (now > endsAt) {
            // Voting expired - show results instead of closed message
            // Ideally should trigger a close status update, but for now just show results
            console.log('⏳ Voting time expired. Showing results.');
            // Only show results if user has voted OR if we want to show global results
            // For now, let's just show "Closed" but maybe with results if available
            document.getElementById('fantasyVotingContent').innerHTML = `
                <div class="voting-closed">
                    <h3>⏰ Время голосования истекло</h3>
                    <p>Результаты обрабатываются...</p>
                </div>
            `;
            // Trigger auto-close check if admin? Not here.
            return;
        }
    }

    if (gameweek.status !== 'voting_open') {
        document.getElementById('fantasyVotingContent').innerHTML = `
            <div class="voting-closed">
                <h3>Голосование ${gameweek.status === 'completed' ? 'завершено' : 'еще не открыто'}</h3>
            </div>
        `;
        return;
    }

    // Check if user already voted
    const hasVoted = await checkIfUserVoted(currentVotingGameweekId);

    if (hasVoted) {
        await renderVotingResults(currentVotingGameweekId);
        return;
    }

    // DYNAMIC LOADING: Fetch players who actually played in this gameweek
    console.log('🗳️ Fetching players for gameweek:', currentVotingGameweekId);

    try {
        // 1. Get stats from match_stats/{gwId}/players
        // We can filter by 'played' field if we store it.
        // In Admin Panel saveStage1, we set 'played: true'.
        const statsSnapshot = await db.collection('match_stats')
            .doc(currentVotingGameweekId)
            .collection('players')
            .where('played', '==', true)
            .get();

        if (statsSnapshot.empty) {
            document.getElementById('fantasyVotingContent').innerHTML = `
                <div class="voting-empty">
                    <p>Список игроков еще не сформирован администратором.</p>
                </div>
            `;
            return;
        }

        const playersToVote = [];

        // 2. Fetch Player Details and construct list
        // Use Promise.all for parallel fetching
        const playerPromises = statsSnapshot.docs.map(async (doc) => {
            const stats = doc.data();
            const playerId = stats.playerId;

            // OPTIMIZATION: Use snapshot data from match_stats if available (saved by Admin Panel Stage 1)
            if (stats.name && stats.position) {
                return {
                    id: playerId,
                    name: stats.name,
                    position: stats.position,
                    goals: stats.goals || 0,
                    assists: stats.assists || 0,
                    isMVP: stats.isMVP || false
                };
            }

            // Fallback: Get static player data (Name, Position) from 'players' collection
            // Optimally, we could cache this or use a global Players map if available
            let playerDoc = null;
            if (typeof PLAYERS_DATA !== 'undefined') {
                // Try finding in local constant first to save reads
                const localP = PLAYERS_DATA.find(p => p.id === playerId);
                if (localP) playerDoc = { data: () => localP, exists: true };
            }

            if (!playerDoc) {
                playerDoc = await db.collection('players').doc(playerId).get();
            }

            if (playerDoc.exists) {
                const pData = playerDoc.data();
                return {
                    id: playerId,
                    name: pData.name,
                    position: pData.position || 'MID', // Fallback
                    goals: stats.goals || 0,
                    assists: stats.assists || 0,
                    isMVP: stats.isMVP || false
                };
            }
            return null;
        });

        const results = await Promise.all(playerPromises);

        // Filter out nulls and sort by position (GK, DEF, MID, FWD) or alphabetical
        const positionOrder = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };

        results.forEach(p => {
            if (p) playersToVote.push(p);
        });

        // Sort: Position first, then Name
        playersToVote.sort((a, b) => {
            const posA = positionOrder[a.position] || 99;
            const posB = positionOrder[b.position] || 99;
            if (posA !== posB) return posA - posB;
            return a.name.localeCompare(b.name);
        });

        renderVotingUI(playersToVote);

    } catch (error) {
        console.error('Error loading voting players:', error);
        document.getElementById('fantasyVotingContent').innerHTML = `
            <div class="error-message">
                ❌ Ошибка загрузки списка игроков: ${error.message}
            </div>
        `;
    }
}

/**
 * Render voting UI with sliders
 */
function renderVotingUI(players) {
    const container = document.getElementById('fantasyVotingContent');

    if (!container) return;

    container.innerHTML = `
        <div class="voting-container">
            <div class="voting-header">
                <div class="header-row" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>🗳️ Оцените игроков</h3>
                    <div id="fantasyVotingTimer" class="voting-timer" style="font-weight: bold; color: var(--accent-color);"></div>
                </div>
                <p class="voting-description">
                    Выставьте оценку каждому игроку от 1.0 до 10.0 на основе их выступления в матче.
                </p>
            </div>

            <div class="voting-players-grid">
                ${players.map(player => `
                    <div class="voting-player-card" data-player-id="${player.id}">
                        <div class="voting-player-header">
                            <div class="voting-player-info">
                                <div class="voting-name-row">
                                    <span class="voting-player-name">${player.name}</span>
                                    <span class="voting-player-badge ${player.position.toLowerCase()}">${player.position}</span>
                                    ${player.isMVP ? '<span class="mvp-badge">⭐ MVP</span>' : ''}
                                </div>
                                <div class="voting-player-stats">
                                    ${player.goals > 0 ? `<span class="stat-badge">⚽ ${player.goals}</span>` : ''}
                                    ${player.assists > 0 ? `<span class="stat-badge">🅰️ ${player.assists}</span>` : ''}
                                </div>
                            </div>
                        </div>

                        <div class="voting-slider-container">
                            <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                step="1" 
                                value="50" 
                                class="voting-slider"
                                data-player-id="${player.id}"
                                oninput="updateVoteDisplay(this)"
                            >
                            <div class="voting-value-display" data-player-id="${player.id}">
                                <span class="vote-value">5.0</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="voting-actions">
                <button class="btn btn-primary btn-large" onclick="submitAllVotes()">
                    ✅ Отправить Оценки
                </button>
            </div>
    `;

    // Start Timer
    startFantasyVotingTimer(currentVotingGameweekId);
}

function startFantasyVotingTimer(gameweekId) {
    const timerEl = document.getElementById('fantasyVotingTimer');
    if (!timerEl) return;

    db.collection('gameweeks').doc(gameweekId).get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        if (!data.votingEndsAt) {
            timerEl.textContent = '';
            return;
        }

        const endsAt = data.votingEndsAt.toDate();

        const update = () => {
            const now = new Date();
            const diff = endsAt - now;

            if (diff <= 0) {
                timerEl.textContent = '⏱️ Время вышло';
                // Optional: Reload to show closed state
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timerEl.textContent = `⏳ Осталось: ${h}ч ${m}м`;
        };

        update();
        setInterval(update, 60000); // Update every minute
    });
}

/**
 * Update vote display with live color visualization
 */
function updateVoteDisplay(slider) {
    const playerId = slider.dataset.playerId;
    const rating = parseInt(slider.value) / 10;

    // Store in memory
    userVotes.set(playerId, rating);

    // Update display
    const valueDisplay = document.querySelector(`.voting-value-display[data-player-id="${playerId}"]`);
    const valueSpan = valueDisplay.querySelector('.vote-value');

    valueSpan.textContent = rating.toFixed(1);

    // Apply color based on rating
    const color = getVotingColor(rating);
    valueDisplay.className = `voting-value-display ${color}`;
    slider.className = `voting-slider ${color}`;
}

/**
 * Get color class based on rating - FotMob style
 */
function getVotingColor(rating) {
    if (rating >= 9.0) return 'excellent';
    if (rating >= 7.5) return 'good';
    if (rating >= 6.0) return 'average';
    if (rating >= 4.5) return 'below-average';
    return 'poor';
}

/**
 * Check if user already voted in this gameweek
 */
async function checkIfUserVoted(gameweekId) {
    if (!currentUser) return false;

    try {
        const snapshot = await db.collection('player_votes')
            .where('gameweekId', '==', gameweekId)
            .where('userId', '==', currentUser.uid)
            .limit(1)
            .get();

        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking if user voted:', error);
        return false;
    }
}

/**
 * Submit all votes
 */
async function submitAllVotes() {
    if (!currentUser || !currentVotingGameweekId) {
        showAlert('Ошибка: пользователь не авторизован', 'error');
        return;
    }

    if (userVotes.size === 0) {
        showAlert('Выставьте оценки игрокам', 'error');
        return;
    }

    try {
        if (currentVotingGameweekId === 'test_mode') {
            showAlert('🧪 [ТЕСТ] Успешно! Оценки "отправлены" (в базу не пишутся)', 'success');
            console.log('Test votes:', Object.fromEntries(userVotes));

            // Allow re-voting in test mode
            setTimeout(() => {
                if (confirm('Очистить и попробовать еще раз?')) {
                    userVotes.clear();
                    startTestVoting();
                } else {
                    document.getElementById('fantasyVotingContent').innerHTML = '<div class="voting-closed"><h3>🧪 Тест завершен</h3></div>';
                }
            }, 1500);
            return;
        }

        const batch = db.batch();

        for (const [playerId, rating] of userVotes.entries()) {
            const voteId = `${currentUser.uid}_${currentVotingGameweekId}_${playerId}`;
            const voteRef = db.collection('player_votes').doc(voteId);

            batch.set(voteRef, {
                gameweekId: currentVotingGameweekId,
                playerId,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                rating,
                votedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        // Recalculate points for all voted players
        const recalcPromises = [];
        for (const playerId of userVotes.keys()) {
            recalcPromises.push(recalculatePlayerPoints(currentVotingGameweekId, playerId));
        }
        await Promise.all(recalcPromises);

        // showAlert('✅ Ваши оценки сохранены!', 'success');
        showVoteSuccessModal();

        // Clear votes and reload
        userVotes.clear();
        await loadVotingInterface(currentVotingGameweekId);

    } catch (error) {
        console.error('Error submitting votes:', error);
        showAlert('Ошибка при сохранении оценок', 'error');
    }
}

/**
 * Start Test Voting Mode (Admin Only, No DB)
 */
function startTestVoting() {
    if (!window.isAdminLoggedIn) {
        alert('Только для админов');
        return;
    }

    // Set flag to block loadVotingInterface from overwriting
    window.votingTestMode = true;

    // Switch to voting tab if needed
    if (window.goToVotingPage) {
        window.goToVotingPage();
    } else {
        // Fallback
        const tab = document.querySelector('[data-fantasy-tab="voting"]');
        if (tab) tab.click();
    }

    console.log('🧪 Starting Test Voting Mode...');
    currentVotingGameweekId = 'test_mode';

    // Generate dummy players
    const dummyPlayers = [
        { id: 'test_1', name: 'Test Player 1', position: 'FWD', team: 'Team A', goals: 1, assists: 0, isMVP: true },
        { id: 'test_2', name: 'Test Player 2', position: 'MID', team: 'Team A', goals: 0, assists: 2, isMVP: false },
        { id: 'test_3', name: 'Test Player 3', position: 'DEF', team: 'Team B', goals: 0, assists: 0, isMVP: false },
        { id: 'test_4', name: 'Test Player 4', position: 'GK', team: 'Team B', goals: 0, assists: 0, isMVP: false },
        { id: 'test_5', name: 'Test Player 5', position: 'FWD', team: 'Team A', goals: 2, assists: 1, isMVP: false }
    ];

    renderVotingUI(dummyPlayers);

    // Add visual indicator
    const container = document.getElementById('fantasyVotingContent');
    if (container) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background: #ff9800; color: #000; padding: 10px; text-align: center; font-weight: bold; margin-bottom: 20px; border-radius: 8px;';
        banner.innerHTML = '🧪 ТЕСТОВЫЙ РЕЖИМ (Данные не сохраняются)';
        container.prepend(banner);
    }

    // Scroll to view
    container.scrollIntoView({ behavior: 'smooth' });
}

window.startTestVoting = startTestVoting;

/**
 * Render voting results after user has voted
 */
async function renderVotingResults(gameweekId) {
    const container = document.getElementById('fantasyVotingContent');

    if (!container) return;

    // Get user's votes
    const votesSnapshot = await db.collection('player_votes')
        .where('gameweekId', '==', gameweekId)
        .where('userId', '==', currentUser.uid)
        .get();

    const userVotesMap = new Map();
    votesSnapshot.forEach(doc => {
        const data = doc.data();
        userVotesMap.set(data.playerId, data.rating);
    });

    // Get player details
    const playersData = [];
    for (const [playerId, rating] of userVotesMap.entries()) {
        const playerDoc = await db.collection('players').doc(playerId).get();
        const statsDoc = await db.collection('match_stats')
            .doc(`${gameweekId}_${playerId}`)
            .get();

        if (playerDoc.exists && statsDoc.exists) {
            playersData.push({
                name: playerDoc.data().name,
                position: playerDoc.data().position,
                yourRating: rating,
                avgRating: statsDoc.data().averageRating || 0,
                totalPoints: statsDoc.data().totalPoints || 0
            });
        }
    }

    container.innerHTML = `
        <div class="voting-results">
            <div class="voting-results-header">
                <h3>✅ Вы проголосовали</h3>
                <p>Ваши оценки сохранены. Результаты обновляются автоматически.</p>
            </div>

            <div class="voting-results-grid">
                ${playersData.map(player => `
                    <div class="voting-result-card">
                        <div class="result-player-info">
                            <span class="result-player-name">${player.name}</span>
                            <span class="result-player-badge ${player.position.toLowerCase()}">${player.position}</span>
                        </div>
                        <div class="result-ratings">
                            <div class="result-rating-item">
                                <span class="rating-label">Ваша оценка:</span>
                                <span class="rating-value ${getVotingColor(player.yourRating)}">${player.yourRating.toFixed(1)}</span>
                            </div>
                            <div class="result-rating-item">
                                <span class="rating-label">Средняя:</span>
                                <span class="rating-value">${player.avgRating.toFixed(1)}</span>
                            </div>
                            <div class="result-rating-item">
                                <span class="rating-label">Очки:</span>
                                <span class="rating-value points">${player.totalPoints}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Show success modal for votes
 */
function showVoteSuccessModal() {
    let modal = document.getElementById('voteSuccessModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'voteSuccessModal';
        modal.className = 'modal';
        modal.innerHTML = `
    < div class="modal-content" style = "text-align: center; max-width: 400px;" >
                <span class="close" onclick="document.getElementById('voteSuccessModal').style.display='none'">&times;</span>
                <div style="font-size: 4rem; margin-bottom: 15px;">✅</div>
                <h2 style="color: #4CAF50; margin-bottom: 10px;">Оценки Отправлены!</h2>
                <p style="color: #ccc; margin-bottom: 20px;">Спасибо за ваше участие в голосовании.</p>
                <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1em;" onclick="document.getElementById('voteSuccessModal').style.display='none'">
                    Продолжить
                </button>
            </div >
    `;
        document.body.appendChild(modal);

        // Add click outside to close
        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    }

    modal.style.display = 'block';
}
