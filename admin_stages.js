// ===================================
// ADMIN STAGES - GAMEWEEK WORKFLOW
// Merged from: match_integration.js + stage3_finalize.js
// Stage 2: Match binding + open rating voting
// Stage 3: Close voting + calculate fantasy points
// ===================================

// ===================================
// STAGE 2: MATCH BINDING
// ===================================

window.renderStage2_StatsInput = async function () {
    const container = document.getElementById('adminStageContent');
    if (!container || !currentGameweekData) return;

    const matchesSnapshot = await db.collection('matches').orderBy('date', 'desc').limit(20).get();
    const matches = [];

    matchesSnapshot.forEach(doc => {
        matches.push({ id: doc.id, ...doc.data() });
    });

    container.innerHTML = `
        <div class="admin-stage">
            <h3>📊 Этап 2: Привязка Матча</h3>
            <p class="stage-description">
                Выберите матч из базы данных. Статистика загрузится автоматически.
            </p>

            <div class="match-selector-section">
                <label for="matchSelect">Выберите матч:</label>
                <select id="matchSelect" class="form-select" onchange="loadMatchData(this.value)">
                    <option value="">-- Выберите матч --</option>
                    ${matches.map(match => `
                        <option value="${match.id}">
                            ${match.team1} ${match.score1} - ${match.score2} ${match.team2} 
                            (${new Date(match.date).toLocaleDateString('ru-RU')})
                        </option>
                    `).join('')}
                </select>
            </div>

            <div id="matchStatsDisplay" style="margin: 20px 0;"></div>

            <div id="saveMatchSection" style="display: none; margin-top: 24px;">
                <button class="btn btn-primary btn-large" onclick="saveStage2_OpenRating()">
                    ✅ Открыть Голосование за Рейтинги
                </button>
                <p class="stage-description" style="margin-top: 12px;">
                    Пользователи смогут ставить оценки игрокам
                </p>
            </div>

            <button class="btn btn-secondary" onclick="forceEditStage1()" style="margin-top: 20px; margin-right: 10px;">
                👥 Изменить Состав (Этап 1)
            </button>
            <button class="btn btn-secondary" onclick="renderGameweekSelector()" style="margin-top: 20px;">
                ← Выбрать Другой Тур
            </button>
        </div>
    `;
};

window.loadMatchData = async function (matchId) {
    if (!matchId) {
        document.getElementById('matchStatsDisplay').innerHTML = '';
        document.getElementById('saveMatchSection').style.display = 'none';
        return;
    }

    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
        alert('Матч не найден');
        return;
    }

    const match = matchDoc.data();
    console.log('📊 Match data loaded:', match);

    const playerStats = new Map();

    const processScorers = (scorers, fieldName) => {
        console.log(`Processing ${fieldName}:`, scorers);

        if (!scorers) return;

        // Handle array of scorers
        if (Array.isArray(scorers)) {
            scorers.forEach(scorer => {
                let name, assist;

                if (typeof scorer === 'string') {
                    // Format: "Player Name (пас: Assist Name)"
                    name = scorer.split(' (')[0].trim();
                    const assistMatch = scorer.match(/пас:\s*([^)]+)/i);
                    assist = assistMatch ? assistMatch[1].trim() : null;
                } else if (typeof scorer === 'object' && scorer !== null) {
                    // Format: { name: "Player", assist: "Assister" } or { player: "Player" }
                    name = scorer.name || scorer.player || scorer.scorer;
                    assist = scorer.assist || scorer.assister;
                }

                if (name) {
                    if (!playerStats.has(name)) {
                        playerStats.set(name, { goals: 0, assists: 0 });
                    }
                    playerStats.get(name).goals++;
                    console.log(`⚽ Goal by: ${name}`);

                    if (assist) {
                        if (!playerStats.has(assist)) {
                            playerStats.set(assist, { goals: 0, assists: 0 });
                        }
                        playerStats.get(assist).assists++;
                        console.log(`🅰️ Assist by: ${assist}`);
                    }
                }
            });
        }
    };

    // Try different possible field names for scorers
    processScorers(match.team1Scorers, 'team1Scorers');
    processScorers(match.team2Scorers, 'team2Scorers');
    processScorers(match.scorers1, 'scorers1');
    processScorers(match.scorers2, 'scorers2');
    processScorers(match.goalScorers, 'goalScorers');

    // Alternative: goals stored separately
    if (match.goals && Array.isArray(match.goals)) {
        match.goals.forEach(goal => {
            const name = goal.scorer || goal.player || goal.name;
            const assist = goal.assist || goal.assister;

            if (name) {
                if (!playerStats.has(name)) {
                    playerStats.set(name, { goals: 0, assists: 0 });
                }
                playerStats.get(name).goals++;

                if (assist) {
                    if (!playerStats.has(assist)) {
                        playerStats.set(assist, { goals: 0, assists: 0 });
                    }
                    playerStats.get(assist).assists++;
                }
            }
        });
    }

    console.log('📋 Final player stats:', Object.fromEntries(playerStats));

    window.selectedMatchId = matchId;
    window.matchPlayerStats = playerStats;

    displayMatchStats(playerStats, match);
    document.getElementById('saveMatchSection').style.display = 'block';
};

function displayMatchStats(playerStats, match) {
    const container = document.getElementById('matchStatsDisplay');

    if (playerStats.size === 0) {
        // Show all available match fields for debugging
        const fields = Object.keys(match || {}).join(', ');
        container.innerHTML = `
            <p class="info-message">В этом матче нет забитых голов в нужном формате.</p>
            <p style="font-size: 12px; color: #888;">Доступные поля: ${fields}</p>
        `;
        return;
    }

    let html = '<div class="voting-summary"><h4>📋 Статистика матча:</h4><div class="summary-stats">';

    playerStats.forEach((stats, playerName) => {
        html += `
            <div class="summary-stat-item">
                <div class="summary-stat-label">${playerName}</div>
                <div class="summary-stat-value">`;
        if (stats.goals > 0) html += `⚽${stats.goals} `;
        if (stats.assists > 0) html += `🅰️${stats.assists}`;
        html += `</div></div>`;
    });

    html += '</div></div>';
    container.innerHTML = html;
}

window.saveStage2_OpenRating = async function () {
    if (!window.selectedMatchId || !window.matchPlayerStats) {
        alert('❌ Сначала выберите матч');
        return;
    }

    try {
        const batch = db.batch();

        // 1. Save Match Data to match_stats/{gameweekId}/matches/{matchId}
        const matchStatsRef = db.collection('match_stats')
            .doc(currentGameweekId)
            .collection('matches')
            .doc(window.selectedMatchId);

        // Convert Map to Object for Firestore
        const matchDataToSave = {
            matchId: window.selectedMatchId,
            linkedAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Store raw stats map: { "Player Name": { goals: 1, assists: 0 } }
            playerStats: Object.fromEntries(window.matchPlayerStats)
        };

        batch.set(matchStatsRef, matchDataToSave);


        // 2. Update Players in match_stats/{gameweekId}/players/{playerId}
        // We need to map Player Names (from match stats) to Player IDs (from our DB)
        // We iterate through ALL players who played (from Stage 1)
        const playersSnapshot = await db.collection('match_stats')
            .doc(currentGameweekId)
            .collection('players')
            .get(); // We might want to filter where('played', '==', true) if we only care about them

        for (const doc of playersSnapshot.docs) {
            const playerId = doc.data().playerId;
            // Get Name to match
            const playerDoc = await db.collection('players').doc(playerId).get();
            if (!playerDoc.exists) continue;

            const playerName = playerDoc.data().name;
            const stats = window.matchPlayerStats.get(playerName) || { goals: 0, assists: 0 };

            // Update player doc
            batch.update(doc.ref, {
                goals: stats.goals,
                assists: stats.assists,
                isMVP: false,
                statsPoints: (stats.goals * 3) + (stats.assists * 2), // Basic calc, will be refined by engine
                totalPoints: (stats.goals * 3) + (stats.assists * 2)
            });
        }

        const gwRef = db.collection('gameweeks').doc(currentGameweekId);
        batch.update(gwRef, {
            status: 'voting_open',
            matchId: window.selectedMatchId
        });

        await batch.commit();

        alert('✅ Голосование за рейтинги открыто!\nМатч привязан, статистика обновлена.');

        if (typeof loadGameweek === 'function') await loadGameweek(currentGameweekId);
        if (typeof renderAdminPanel === 'function') renderAdminPanel();

    } catch (error) {
        console.error('Error:', error);
        alert('❌ Ошибка: ' + error.message);
    }
};

// ===================================
// STAGE 3: FINALIZE VOTING
// ===================================

window.renderStage3_OpenVoting = async function () {
    const container = document.getElementById('adminStageContent');
    if (!container || !currentGameweekData) return;

    const matchId = currentGameweekData.matchId;
    let mvpName = null;

    if (matchId) {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (matchDoc.exists) {
            mvpName = matchDoc.data().mvp;
        }
    }

    const votesSnapshot = await db.collection('votes')
        .where('gameweekId', '==', currentGameweekId)
        .get();

    const voteCount = votesSnapshot.size;

    container.innerHTML = `
        <div class="admin-stage">
            <h3>🎯 Этап 3: Завершение Голосования</h3>
            <p class="stage-description">
                Закройте голосование, чтобы подсчитать итоговые очки всех игроков.
            </p>

            <div class="voting-summary">
                <h4>📊 Статус голосования:</h4>
                <div class="summary-stats">
                    <div class="summary-stat-item">
                        <div class="summary-stat-label">Проголосовало</div>
                        <div class="summary-stat-value">${voteCount}</div>
                    </div>
                    <div class="summary-stat-item">
                        <div class="summary-stat-label">MVP (из матча)</div>
                        <div class="summary-stat-value">${mvpName || '❌ Не определен'}</div>
                    </div>
                </div>
            </div>

            ${!mvpName ? `
                <p class="info-message" style="background: var(--admin-bg-secondary); border-left-color: var(--admin-warning);">
                    ⚠️ MVP еще не выбран в голосовании матча. Дождитесь результатов.
                </p>
            ` : ''}

            <button class="btn btn-primary btn-large" onclick="closeVotingAndFinalize()" ${!mvpName ? 'disabled' : ''}>
                ✅ Закрыть Голосование и Начислить Очки
            </button>

            <button class="btn btn-secondary" onclick="backToStage2()" style="margin-top: 12px;">
                ← Вернуться к Этапу 2
            </button>
        </div>
    `;
};

window.closeVotingAndFinalize = async function () {
    if (!currentGameweekId || !currentGameweekData) {
        alert('❌ Gameweek не загружен');
        return;
    }

    const matchId = currentGameweekData.matchId;
    if (!matchId) {
        alert('❌ Матч не привязан');
        return;
    }

    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const mvpName = matchDoc.data().mvp;

        if (!mvpName) {
            alert('❌ MVP еще не определен в голосовании матча');
            return;
        }

        const batch = db.batch();

        const statsSnapshot = await db.collection('match_stats')
            .doc(currentGameweekId)
            .collection('players')
            .where('played', '==', true)
            .get();

        for (const doc of statsSnapshot.docs) {
            const playerId = doc.data().playerId;
            const statsData = doc.data();

            const playerDoc = await db.collection('players').doc(playerId).get();
            const playerData = playerDoc.data();
            const playerName = playerData.name;
            const playerPosition = playerData.position;

            const isMVP = (playerName === mvpName);
            const goals = statsData.goals || 0;
            const assists = statsData.assists || 0;

            // Calculate average rating from votes
            const votesSnapshot = await db.collection('votes')
                .where('gameweekId', '==', currentGameweekId)
                .get();

            let totalRating = 0;
            let ratingCount = 0;

            votesSnapshot.forEach(voteDoc => {
                const ratings = voteDoc.data().ratings || {};
                if (ratings[playerId] !== undefined) {
                    totalRating += ratings[playerId];
                    ratingCount++;
                }
            });

            const avgRating = ratingCount > 0 ? totalRating / ratingCount : 6.0;

            // Use points_engine.js functions
            const statsPoints = typeof calculateStatsPoints === 'function'
                ? calculateStatsPoints(goals, assists)
                : (goals * 3) + (assists * 2);
            const mvpBonus = typeof getMVPBonus === 'function'
                ? getMVPBonus(playerPosition, isMVP)
                : (isMVP ? getLocalMVPBonus(playerPosition) : 0);
            const ratingBonus = typeof getRatingBonus === 'function'
                ? getRatingBonus(avgRating, playerPosition)
                : getLocalRatingBonus(avgRating, playerPosition);
            const totalPoints = statsPoints + mvpBonus + ratingBonus;

            batch.update(doc.ref, {
                isMVP: isMVP,
                statsPoints: statsPoints,
                mvpBonus: mvpBonus,
                ratingBonus: ratingBonus,
                averageRating: Math.round(avgRating * 10) / 10,
                totalPoints: Math.round(totalPoints * 10) / 10
            });
        }

        const gwRef = db.collection('gameweeks').doc(currentGameweekId);
        batch.update(gwRef, {
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Recalculate all player points with final votes
        await recalculateAllPlayersInGameweek(currentGameweekId);

        // NEW: Aggregate all user points for global leaderboard
        if (typeof aggregateAllUsersPoints === 'function') {
            await aggregateAllUsersPoints(currentGameweekId);
        } else {
            console.warn('aggregateAllUsersPoints function not found');
        }

        alert(`✅ Голосование закрыто!\n\nMVP: ${mvpName}\nОчки начислены.\nТаблица лидеров обновлена.`);

        if (typeof loadGameweek === 'function') await loadGameweek(currentGameweekId);
        if (typeof renderAdminPanel === 'function') renderAdminPanel();

    } catch (error) {
        console.error('Error:', error);
        alert('❌ Ошибка: ' + error.message);
    }
};

window.backToStage2 = async function () {
    if (!currentGameweekId) return;

    await db.collection('gameweeks').doc(currentGameweekId).update({
        status: 'stats_entry'
    });

    if (typeof loadGameweek === 'function') await loadGameweek(currentGameweekId);
    if (typeof renderAdminPanel === 'function') renderAdminPanel();
};

// Local fallback functions if points_engine is not loaded
function getLocalMVPBonus(position) {
    const bonuses = { 'GK': 8, 'DEF': 6, 'MID': 4, 'FWD': 2 };
    return bonuses[position] || 0;
}

function getLocalRatingBonus(avgRating, position) {
    const isDefensive = (position === 'GK' || position === 'DEF');

    if (avgRating >= 9.0) return isDefensive ? 8 : 5;
    if (avgRating >= 8.0) return isDefensive ? 5 : 3;
    if (avgRating >= 7.0) return isDefensive ? 2 : 1;
    if (avgRating >= 6.0) return 0;
    if (avgRating >= 4.5) return -2;
    return -4;
}

console.log('✅ Admin Stages (2 & 3) loaded');
