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

    // Get players who played
    const statsSnapshot = await db.collection('match_stats')
        .where('gameweekId', '==', currentVotingGameweekId)
        .where('played', '==', true)
        .get();

    const playersToVote = [];
    for (const doc of statsSnapshot.docs) {
        const data = doc.data();
        const playerDoc = await db.collection('players').doc(data.playerId).get();

        if (playerDoc.exists) {
            playersToVote.push({
                id: data.playerId,
                name: playerDoc.data().name,
                position: playerDoc.data().position,
                team: playerDoc.data().team,
                goals: data.goals || 0,
                assists: data.assists || 0,
                isMVP: data.isMVP || false
            });
        }
    }

    renderVotingUI(playersToVote);
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
                                <span class="voting-player-name">${player.name}</span>
                                <span class="voting-player-badge ${player.position.toLowerCase()}">${player.position}</span>
                                ${player.isMVP ? '<span class="mvp-badge">⭐ MVP</span>' : ''}
                            </div>
                            <div class="voting-player-stats">
                                ${player.goals > 0 ? `<span class="stat-badge">⚽ ${player.goals}</span>` : ''}
                                ${player.assists > 0 ? `<span class="stat-badge">🅰️ ${player.assists}</span>` : ''}
                            </div>
                        </div>

                        <div class="voting-slider-container">
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                step="0.1" 
                                value="5.0" 
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
    const rating = parseFloat(slider.value);

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

        showAlert('✅ Ваши оценки сохранены!', 'success');

        // Clear votes and reload
        userVotes.clear();
        await loadVotingInterface(currentVotingGameweekId);

    } catch (error) {
        console.error('Error submitting votes:', error);
        showAlert('Ошибка при сохранении оценок', 'error');
    }
}

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
