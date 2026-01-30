// ===================================
// MATCH VOTING MODULE
// Live voting on match pages with 24h timer
// ===================================

const VOTING_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// List of players who can be voted for (fixed list)
const VOTING_PLAYERS = [
    'Мансур Ш.', 'Даулет Е.', 'Санжар А.', 'Айбек А.', 'Алишер А.',
    'Шынгыс Т.', 'Асан Т.', 'Димаш А.', 'Акылбек А.', 'Ерасыл К.',
    'Данияр А.', 'Хамид Т.'
];

/**
 * Render voting block inside match details
 */
async function renderMatchVotingBlock(matchId, containerSelector) {
    if (typeof db === 'undefined') {
        console.warn('Database not ready for voting block');
        return;
    }

    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error('Voting container not found:', containerSelector);
        return;
    }

    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) {
            container.innerHTML = '<p>Матч не найден</p>';
            return;
        }

        const match = matchDoc.data();
        const votingStatus = await getMatchVotingStatus(matchId, match);

        if (votingStatus.status === 'not_started') {
            container.innerHTML = '<p class="voting-info">Голосование откроется после завершения матча</p>';
            return;
        }

        if (votingStatus.status === 'closed') {
            await renderVotingResultsBlock(matchId, container);
            return;
        }

        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            container.innerHTML = '<p class="voting-info">Войдите, чтобы голосовать</p>';
            return;
        }

        const userVote = await getMatchUserVote(matchId, currentUser.uid);
        const averageRatings = await getMatchAverageRatings(matchId);

        container.innerHTML = `
            <div class="match-voting-block">
                <div class="voting-header">
                    <h3>⭐ Оцените игроков</h3>
                    <div class="voting-timer" id="votingTimer_${matchId}">
                        ⏱️ ${formatVotingTimeRemaining(votingStatus.endsAt)}
                    </div>
                </div>
                
                <p class="voting-description">
                    Поставьте оценку каждому игроку от 1.0 до 10.0
                </p>

                <div class="players-rating-grid" id="playersRatingGrid_${matchId}">
                    ${VOTING_PLAYERS.map(playerName => {
            const avgRating = averageRatings[playerName] || 0;
            const userRating = userVote && userVote.ratings ? userVote.ratings[playerName] : null;

            return `
                            <div class="player-rating-card" data-player="${playerName}">
                                <div class="player-rating-info">
                                    <span class="player-rating-name">${playerName}</span>
                                    <span class="player-avg-rating">Средняя: ${avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
                                </div>
                                <div class="player-rating-input">
                                    <input type="range" 
                                           min="1" max="10" step="0.1" 
                                           value="${userRating || 6}" 
                                           class="rating-slider"
                                           data-player="${playerName}"
                                           ${userVote ? 'disabled' : ''}
                                           oninput="updateVotingRatingDisplay(this)">
                                    <span class="rating-value">${userRating || 6.0}</span>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>

                ${userVote ? `
                    <p class="voting-submitted">✅ Вы уже проголосовали</p>
                ` : `
                    <button class="btn btn-primary btn-large" onclick="submitMatchVoteRatings('${matchId}')">
                        ✅ Отправить Оценки
                    </button>
                `}
            </div>
        `;

        startMatchVotingTimer(matchId, votingStatus.endsAt);

    } catch (error) {
        console.error('Error rendering voting block:', error);
        container.innerHTML = '<p class="voting-info">Ошибка загрузки голосования</p>';
    }
}

function updateVotingRatingDisplay(slider) {
    const valueSpan = slider.parentElement.querySelector('.rating-value');
    if (valueSpan) {
        valueSpan.textContent = parseFloat(slider.value).toFixed(1);
    }
}

async function getMatchVotingStatus(matchId, matchData) {
    const now = Date.now();

    if (matchData.votingStartedAt) {
        const startTime = matchData.votingStartedAt.toMillis ? matchData.votingStartedAt.toMillis() : matchData.votingStartedAt;
        const endTime = matchData.votingEndsAt ?
            (matchData.votingEndsAt.toMillis ? matchData.votingEndsAt.toMillis() : matchData.votingEndsAt) :
            startTime + VOTING_DURATION_MS;

        if (matchData.votingClosed || now > endTime) {
            return { status: 'closed', endsAt: endTime };
        }

        return { status: 'open', endsAt: endTime };
    }

    // All matches are considered to have voting open (no status check needed)
    const matchDate = matchData.date ? new Date(matchData.date) : new Date();
    const startTime = matchDate.getTime();
    const endTime = startTime + VOTING_DURATION_MS;

    if (now > endTime) {
        return { status: 'closed', endsAt: endTime };
    }

    return { status: 'open', endsAt: endTime };
}

async function getMatchUserVote(matchId, userId) {
    try {
        const voteDoc = await db.collection('match_votes')
            .where('matchId', '==', matchId)
            .where('userId', '==', userId)
            .limit(1)
            .get();

        if (voteDoc.empty) return null;
        return voteDoc.docs[0].data();
    } catch (error) {
        console.error('Error getting user vote:', error);
        return null;
    }
}

async function getMatchAverageRatings(matchId) {
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

        const averages = {};
        Object.keys(ratingSums).forEach(playerName => {
            averages[playerName] = ratingSums[playerName] / ratingCounts[playerName];
        });

        return averages;
    } catch (error) {
        console.error('Error getting average ratings:', error);
        return {};
    }
}

async function submitMatchVoteRatings(matchId) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        alert('Войдите, чтобы голосовать');
        return;
    }

    const existingVote = await getMatchUserVote(matchId, currentUser.uid);
    if (existingVote) {
        alert('Вы уже проголосовали');
        return;
    }

    const ratings = {};
    const sliders = document.querySelectorAll(`#playersRatingGrid_${matchId} .rating-slider`);

    sliders.forEach(slider => {
        const playerName = slider.dataset.player;
        ratings[playerName] = parseFloat(slider.value);
    });

    try {
        await db.collection('match_votes').add({
            matchId: matchId,
            userId: currentUser.uid,
            ratings: ratings,
            votedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // alert('✅ Ваши оценки сохранены!');
        showMatchSuccessModal();

        renderMatchVotingBlock(matchId, `#matchVotingContainer_${matchId}`);

    } catch (error) {
        console.error('Error submitting vote:', error);
        alert('Ошибка при сохранении: ' + error.message);
    }
}

async function renderVotingResultsBlock(matchId, container) {
    const averageRatings = await getMatchAverageRatings(matchId);

    const sortedPlayers = Object.entries(averageRatings)
        .sort((a, b) => b[1] - a[1]);

    container.innerHTML = `
        <div class="match-voting-block voting-closed">
            <div class="voting-header">
                <h3>📊 Результаты Голосования</h3>
                <span class="voting-closed-badge">Голосование закрыто</span>
            </div>
            
            <div class="voting-results-list">
                ${sortedPlayers.length > 0 ? sortedPlayers.map(([playerName, avgRating], index) => `
                    <div class="voting-result-item ${index === 0 ? 'top-rated' : ''}">
                        <span class="result-rank">${index + 1}</span>
                        <span class="result-name">${playerName}</span>
                        <span class="result-rating">${avgRating.toFixed(1)}</span>
                    </div>
                `).join('') : '<p class="voting-info">Нет голосов</p>'}
            </div>
        </div>
    `;
}

function formatVotingTimeRemaining(endTimeMs) {
    const now = Date.now();
    const remaining = endTimeMs - now;

    if (remaining <= 0) return 'Завершено';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
}

function startMatchVotingTimer(matchId, endTimeMs) {
    const timerElement = document.getElementById(`votingTimer_${matchId}`);
    if (!timerElement) return;

    const updateTimer = () => {
        const remaining = endTimeMs - Date.now();
        if (remaining <= 0) {
            timerElement.textContent = '⏱️ Завершено';
            clearInterval(timerInterval);
            return;
        }
        timerElement.textContent = `⏱️ ${formatVotingTimeRemaining(endTimeMs)}`;
    };

    const timerInterval = setInterval(updateTimer, 60000);
    updateTimer();
}

// Global exports
window.renderMatchVotingBlock = renderMatchVotingBlock;
window.submitMatchVoteRatings = submitMatchVoteRatings;
window.updateVotingRatingDisplay = updateVotingRatingDisplay;

console.log('✅ Match voting module loaded');

/**
 * Show success modal for MATCH votes
 */
function showMatchSuccessModal() {
    let modal = document.getElementById('voteMatchSuccessModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'voteMatchSuccessModal';
        modal.className = 'modal';
        // Reuse same styling or similar
        modal.innerHTML = `
            <div class="modal-content" style="text-align: center; max-width: 400px;">
                <span class="close" onclick="document.getElementById('voteMatchSuccessModal').style.display='none'">&times;</span>
                <div style="font-size: 4rem; margin-bottom: 15px;">✅</div>
                <h2 style="color: #4CAF50; margin-bottom: 10px;">Оценки Отправлены!</h2>
                <p style="color: #ccc; margin-bottom: 20px;">Спасибо за ваш голос.</p>
                <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1em;" onclick="document.getElementById('voteMatchSuccessModal').style.display='none'">
                    Отлично
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    }

    modal.style.display = 'block';
}
