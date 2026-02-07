// ===================================
// FOOTBALL LEAGUE - APPLICATION LOGIC
// L Clasico with MVP Voting System
// ===================================

// === CONFIGURATION ===
// Admin access by email (Firebase Auth)
const ADMIN_EMAIL = 'tokkozha.s@gmail.com';

// Voting duration is defined in match_voting.js

// Allowed players for voting
const ALLOWED_PLAYERS = [
    "Мансур Ш.", "Даулет Е.", "Санжар А.", "Айбек А.", "Алишер А.",
    "Шынгыс Т.", "Асан Т.", "Димаш А.", "Акылбек А.", "Ерасыл К.", "Данияр А.", "Хамид Т."
];

// === DATA STRUCTURES ===
let teams = [
    {
        name: '1 группа',
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: []
    },
    {
        name: '2 группа',
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: []
    }
];

let matches = [];
var isAdminLoggedIn = false;
var currentUser = null;
let editingMatchId = null;
let selectedVotePlayer = null;
let currentVotingMatchId = null;
let unsubscribeMatches = null;
let currentStatsFilter = 'goals';

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    initializeFirestore();
    initializeEventListeners();
});

// ===================================
// FIREBASE AUTHENTICATION
// ===================================

function initializeAuth() {
    // Set language to Russian for emails/SMS
    auth.languageCode = 'ru';

    // Listen to auth state changes
    auth.onAuthStateChanged((user) => {
        currentUser = user;

        // Check if user is admin by email
        if (user && user.email === ADMIN_EMAIL) {
            isAdminLoggedIn = true;
            console.log('Admin logged in:', user.email);
        } else {
            isAdminLoggedIn = false;
        }

        // Make globally accessible
        window.isAdminLoggedIn = isAdminLoggedIn;
        window.currentUser = user;

        updateAuthUI();
        updateAdminUI();

        if (user) {
            console.log('User logged in:', user.email);
            // Reload fantasy team now that we have user context
            loadFantasyTeam().then(() => {
                console.log('🔄 Re-rendering after auth...');
                renderSelectedTeam();
                updateFantasyBudget();
            });
        } else {
            console.log('User logged out');
        }
    });
}

// Register new user
async function registerUser(email, password) {
    try {
        console.log('Attempting to register user:', email);
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('Registration successful:', userCredential.user.uid);
        showAlert('Регистрация успешна! Добро пожаловать!', 'success');
        closeModal('authModal');
        return userCredential.user;
    } catch (error) {
        console.error('Registration error code:', error.code);
        console.error('Registration error message:', error.message);
        console.error('Full error:', error);
        throw error;
    }
}

// Login user
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        showAlert('Вход выполнен успешно!', 'success');
        closeModal('authModal');
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Logout user
async function logoutUser() {
    try {
        await auth.signOut();
        showAlert('Вы вышли из аккаунта', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showAlert('Ошибка при выходе', 'error');
    }
}

// Recover password
async function recoverPassword(email) {
    try {
        console.log('Initiating password reset for:', email);
        await auth.sendPasswordResetEmail(email);
        console.log('Password reset email sent successfully');
        showAlert('Инструкции отправлены на email', 'success');
        document.getElementById('recoveryFormError').innerHTML = `
            <div class="alert alert-success">Инструкции по сбросу пароля отправлены на ваш email. Проверьте папку "Входящие" или "Спам".</div>
        `;
    } catch (error) {
        console.error('Recovery error:', error);
        throw error;
    }
}

// Update UI based on auth state
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');

    if (currentUser) {
        authButtons.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userEmail.textContent = currentUser.email;
    } else {
        authButtons.classList.remove('hidden');
        userInfo.classList.add('hidden');
        userEmail.textContent = '';
    }

    // Re-render matches to update voting buttons
    renderMatches();
}

// Helper for Russian declension
function getDeclension(number, titles) {
    const n = Math.abs(parseInt(number, 10)); // Ensure integer
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[(n % 10 < 5) ? n % 10 : 5]];
}

// Get Firebase error message in Russian
function getAuthErrorMessage(errorCode) {
    const messages = {
        'auth/email-already-in-use': 'Этот email уже используется',
        'auth/invalid-email': 'Неверный формат email',
        'auth/operation-not-allowed': 'Операция не разрешена',
        'auth/weak-password': 'Пароль слишком слабый (минимум 6 символов)',
        'auth/user-disabled': 'Аккаунт заблокирован',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/invalid-credential': 'Неверный email или пароль',
        'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже'
    };
    return messages[errorCode] || 'Произошла ошибка. Попробуйте снова';
}

// ===================================
// ADMIN UI
// ===================================

function updateAdminUI() {
    const adminPanel = document.getElementById('adminPanel');

    if (isAdminLoggedIn) {
        adminPanel.classList.add('active');
    } else {
        adminPanel.classList.remove('active');
    }

    // Re-render matches to show/hide edit buttons
    renderMatches();
}

// ===================================
// FIREBASE / DATA MANAGEMENT
// ===================================

function initializeFirestore() {
    if (typeof db === 'undefined') {
        console.error('Firebase not initialized! Using localStorage fallback.');
        loadDataFromLocalStorage();
        return;
    }

    // Listen to matches collection in real-time
    unsubscribeMatches = db.collection('matches')
        .orderBy('date', 'desc')
        .onSnapshot((snapshot) => {
            matches = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                matches.push({
                    id: doc.id,
                    ...data
                });
            });

            // Check and close expired voting
            checkExpiredVoting();

            calculateStandings();
            renderLeagueTable();
            renderMatches();
            renderPlayerStats();
        }, (error) => {
            console.error('Error loading matches:', error);
            showAlert('Ошибка загрузки данных', 'error');
            loadDataFromLocalStorage();
        });
}

function loadDataFromLocalStorage() {
    const savedTeams = localStorage.getItem('teams');
    const savedMatches = localStorage.getItem('matches');

    if (savedTeams) {
        teams = JSON.parse(savedTeams);
    }

    if (savedMatches) {
        matches = JSON.parse(savedMatches);
    }

    calculateStandings();
    renderLeagueTable();
    renderMatches();
    renderPlayerStats();
}

function saveDataToLocalStorage() {
    localStorage.setItem('teams', JSON.stringify(teams));
    localStorage.setItem('matches', JSON.stringify(matches));
}

// ===================================
// MVP VOTING LOGIC
// ===================================

// Check if voting is still open for a match
function isVotingOpen(match) {
    if (!match.votingEndsAt || match.votingClosed) {
        return false;
    }

    const now = new Date();
    const votingEndsAt = match.votingEndsAt.toDate ? match.votingEndsAt.toDate() : new Date(match.votingEndsAt);

    return now < votingEndsAt;
}

// Get time remaining for voting
function getVotingTimeRemaining(match) {
    if (!match.votingEndsAt) return null;

    const now = new Date();
    const votingEndsAt = match.votingEndsAt.toDate ? match.votingEndsAt.toDate() : new Date(match.votingEndsAt);
    const remaining = votingEndsAt - now;

    if (remaining <= 0) return null;

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, total: remaining };
}

// Check if current user has voted for a match
async function checkUserVoted(matchId) {
    if (!currentUser) return false;

    try {
        const voteDoc = await db.collection('matches').doc(matchId)
            .collection('votes').doc(currentUser.uid).get();
        return voteDoc.exists;
    } catch (error) {
        console.error('Error checking vote:', error);
        return false;
    }
}

// Open voting modal for a match
async function openVotingModal(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    currentVotingMatchId = matchId;
    selectedVotePlayer = null;

    const playersList = document.getElementById('playersList');
    const votingTimer = document.getElementById('votingTimer');
    const votingError = document.getElementById('votingError');
    const votingSuccess = document.getElementById('votingSuccess');
    const submitBtn = document.getElementById('submitVoteBtn');

    // Reset state
    votingError.innerHTML = '';
    votingSuccess.classList.add('hidden');
    submitBtn.disabled = true;

    // Check if user is logged in
    if (!currentUser) {
        playersList.innerHTML = `
            <div class="voting-login-prompt">
                <p>Для голосования необходимо войти в аккаунт</p>
                <button class="btn btn-primary" onclick="closeModal('votingModal'); openModal('authModal');">
                    Войти
                </button>
            </div>
        `;
        votingTimer.innerHTML = '';
        openModal('votingModal');
        return;
    }

    // Check if voting is still open
    if (!isVotingOpen(match)) {
        playersList.innerHTML = `
            <div class="voting-closed-message">
                <span class="closed-icon">⏰</span>
                <p>Голосование завершено</p>
                ${match.mvp ? `<p class="mvp-result">🏆 MVP: ${match.mvp.player} (${match.mvp.votes} ${getDeclension(match.mvp.votes, ['голос', 'голоса', 'голосов'])})</p>` : ''}
            </div>
        `;
        votingTimer.innerHTML = '';
        openModal('votingModal');
        return;
    }

    // Check if user already voted
    const hasVoted = await checkUserVoted(matchId);
    if (hasVoted) {
        playersList.innerHTML = `
            <div class="already-voted-message">
                <span class="voted-icon">✅</span>
                <p>Вы уже проголосовали в этом матче</p>
            </div>
        `;
        votingTimer.innerHTML = '';
        openModal('votingModal');
        return;
    }

    // Show timer
    const timeRemaining = getVotingTimeRemaining(match);
    if (timeRemaining) {
        votingTimer.innerHTML = `
            <span class="timer-icon">⏱️</span>
            Осталось: ${timeRemaining.hours}ч ${timeRemaining.minutes}мин
        `;
    }

    // Build players list from ALLOWED_PLAYERS
    playersList.innerHTML = ALLOWED_PLAYERS.map(player => `
        <div class="player-option" data-player="${player}" data-team="General">
            <div class="player-info">
                <span class="player-name">${player}</span>
            </div>
        </div>
    `).join('');

    // Add click handlers to player options
    document.querySelectorAll('.player-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.player-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedVotePlayer = {
                player: option.dataset.player,
                team: option.dataset.team
            };
            submitBtn.disabled = false;
        });
    });

    openModal('votingModal');
}

// Submit vote
async function submitVote() {
    if (!currentUser || !currentVotingMatchId || !selectedVotePlayer) {
        return;
    }

    const match = matches.find(m => m.id === currentVotingMatchId);
    if (!match || !isVotingOpen(match)) {
        showVotingError('Голосование уже завершено');
        return;
    }

    const submitBtn = document.getElementById('submitVoteBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
        // Check one more time if user already voted
        const hasVoted = await checkUserVoted(currentVotingMatchId);
        if (hasVoted) {
            showVotingError('Вы уже голосовали');
            return;
        }

        if (!currentUser.email) {
            console.error('User email is missing!');
            showVotingError('Ошибка: отсутствиет email пользователя. Попробуйте перевойти.');
            submitBtn.disabled = false;
            return;
        }

        console.log('Submitting vote for:', currentUser.email);

        // Submit vote
        await db.collection('matches').doc(currentVotingMatchId)
            .collection('votes').doc(currentUser.uid).set({
                player: selectedVotePlayer.player,
                team: selectedVotePlayer.team,
                userEmail: currentUser.email,
                votedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        // Show success
        document.getElementById('playersList').classList.add('hidden');
        document.getElementById('votingSuccess').classList.remove('hidden');
        showAlert('Ваш голос учтён!', 'success');

        setTimeout(() => {
            closeModal('votingModal');
        }, 1500);

    } catch (error) {
        console.error('Vote submission error:', error);
        showVotingError('Ошибка при голосовании. Попробуйте снова.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Проголосовать';
    }
}

function showVotingError(message) {
    document.getElementById('votingError').innerHTML = `
        <div class="alert alert-error">${message}</div>
    `;
}

// ===================================
// AUTO-CLOSE VOTING & MVP CALCULATION
// ===================================

async function checkExpiredVoting() {
    for (const match of matches) {
        if (!match.votingClosed && match.votingEndsAt && !isVotingOpen(match)) {
            await closeVotingAndCalculateMVP(match.id);
        }
    }
}

async function closeVotingAndCalculateMVP(matchId) {
    try {
        // Get all votes for this match
        const votesSnapshot = await db.collection('matches').doc(matchId)
            .collection('votes').get();

        // Count votes per player
        // Count votes per player
        const voteCount = new Map();
        const playerTeams = new Map();

        votesSnapshot.forEach(doc => {
            const vote = doc.data();
            const key = vote.player; // Group by player ONLY

            voteCount.set(key, (voteCount.get(key) || 0) + 1);

            // Store a team for this player (prefer "General" or last seen)
            if (!playerTeams.has(key) || vote.team === "General") {
                playerTeams.set(key, vote.team || "General");
            }
        });

        // Find MVP (player with most votes)
        let mvp = null;
        let maxVotes = 0;

        voteCount.forEach((votes, player) => {
            if (votes > maxVotes) {
                const team = playerTeams.get(player);
                maxVotes = votes;
                mvp = { player, team, votes };
            }
        });

        // Update match document
        await db.collection('matches').doc(matchId).update({
            votingClosed: true,
            mvp: mvp
        });

        console.log(`Voting closed for match ${matchId}. MVP: ${mvp?.player || 'No votes'}`);

    } catch (error) {
        console.error('Error closing voting:', error);
    }
}

// Reset/Reopen voting for a match (Admin only)
async function resetVoting(matchId) {
    console.log('🔄 Attempting to reset voting for match:', matchId);

    if (!isAdminLoggedIn) {
        showAlert('Только админ может возобновить голосование', 'error');
        return;
    }

    if (!confirm('Возобновить голосование на 24 часа? Все предыдущие голоса будут сохранены.')) {
        return;
    }

    try {
        const now = new Date();
        // Fallback if constant is missing
        const duration = (typeof VOTING_DURATION_MS !== 'undefined') ? VOTING_DURATION_MS : (24 * 60 * 60 * 1000);
        const votingEndsAt = new Date(now.getTime() + duration);

        await db.collection('matches').doc(matchId).update({
            votingStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
            votingEndsAt: firebase.firestore.Timestamp.fromDate(votingEndsAt),
            votingClosed: false,
            mvp: null
        });

        showAlert('Голосование возобновлено на 24 часа!', 'success');

        // Refresh matches
        renderMatches();

    } catch (error) {
        console.error('Error resetting voting:', error);
        showAlert('Ошибка при возобновлении голосования: ' + error.message, 'error');
    }
}

// Ensure it's globally available
window.resetVoting = resetVoting;

// Force recalculate MVP and finalize Fantasy points (Admin only)
// SIMPLIFIED VERSION - skips rating calculation, focuses on MVP bonus
async function recalculateMVP(matchId) {
    console.log('🔄 [STEP 0] Starting MVP recalculation for match:', matchId);

    if (!isAdminLoggedIn) {
        showAlert('Только админ может пересчитать MVP', 'error');
        return;
    }

    if (!confirm('Пересчитать MVP и начислить очки?')) {
        return;
    }

    try {
        // === STEP 1: Calculate MVP from match votes ===
        console.log('📌 [STEP 1] Fetching MVP votes from matches collection...');
        const votesSnapshot = await db.collection('matches').doc(matchId)
            .collection('votes').get();

        let mvp = null;
        let mvpName = null;

        if (!votesSnapshot.empty) {
            const voteCount = new Map();
            const playerTeams = new Map();

            votesSnapshot.forEach(doc => {
                const vote = doc.data();
                const key = vote.player;
                voteCount.set(key, (voteCount.get(key) || 0) + 1);
                if (!playerTeams.has(key) || vote.team === "General") {
                    playerTeams.set(key, vote.team || "General");
                }
            });

            let maxVotes = 0;
            voteCount.forEach((votes, player) => {
                if (votes > maxVotes) {
                    maxVotes = votes;
                    mvp = { player, team: playerTeams.get(player), votes };
                    mvpName = player;
                }
            });
            console.log('✅ [STEP 1] MVP determined:', mvpName, 'with', maxVotes, 'votes');
        } else {
            console.log('⚠️ [STEP 1] No MVP votes found');
        }

        // === STEP 1.5: Update match document with MVP ===
        console.log('📌 [STEP 1.5] Updating match document...');
        await db.collection('matches').doc(matchId).update({
            votingClosed: true,
            mvp: mvp
        });
        console.log('✅ [STEP 1.5] Match updated with MVP');

        // === STEP 2: Find linked Gameweek ===
        console.log('📌 [STEP 2] Finding linked gameweek...');
        const gameweeksSnapshot = await db.collection('gameweeks')
            .where('matchId', '==', matchId)
            .get();

        if (gameweeksSnapshot.empty) {
            showAlert(`MVP: ${mvpName || 'Не определен'}\nНет привязанного тура.`, 'warning');
            renderMatches();
            return;
        }

        const gameweekId = gameweeksSnapshot.docs[0].id;
        console.log('✅ [STEP 2] Found gameweek:', gameweekId);

        // === STEP 3: Get player stats ===
        console.log('📌 [STEP 3] Fetching player stats...');
        const statsSnapshot = await db.collection('match_stats')
            .doc(gameweekId)
            .collection('players')
            .where('played', '==', true)
            .get();

        if (statsSnapshot.empty) {
            console.warn('⚠️ [STEP 3] No player stats found');
            showAlert('Нет статистики игроков для этого тура', 'warning');
            return;
        }
        console.log('✅ [STEP 3] Found', statsSnapshot.size, 'player stats');

        // === STEP 3.5: Fetch rating votes from player_votes collection ===
        console.log('📌 [STEP 3.5] Fetching player rating votes...');
        let ratingVotesSnapshot = null;
        try {
            ratingVotesSnapshot = await db.collection('player_votes')
                .where('gameweekId', '==', gameweekId)
                .get();
            console.log('✅ [STEP 3.5] Found', ratingVotesSnapshot.size, 'rating votes');
        } catch (votesError) {
            console.warn('⚠️ [STEP 3.5] Could not fetch rating votes:', votesError.message);
            // Continue without ratings
        }

        // === STEP 4: Update each player's points ===
        console.log('📌 [STEP 4] Calculating and updating player points...');
        let updatedCount = 0;

        for (const statDoc of statsSnapshot.docs) {
            try {
                const statsData = statDoc.data();
                const playerId = statsData.playerId;

                // Get player info
                const playerDoc = await db.collection('players').doc(playerId).get();
                if (!playerDoc.exists) {
                    console.warn('  ⚠️ Player not found:', playerId);
                    continue;
                }

                const playerData = playerDoc.data();
                const playerName = playerData.name;
                const playerPosition = playerData.position;
                const isMVP = (playerName === mvpName);

                // Calculate stats points
                const goals = statsData.goals || 0;
                const assists = statsData.assists || 0;
                const statsPoints = (goals * 3) + (assists * 2);
                const mvpBonus = isMVP ? getLocalMVPBonusFallback(playerPosition) : 0;

                // Calculate average rating from player_votes
                let avgRating = 6.0;
                if (ratingVotesSnapshot && !ratingVotesSnapshot.empty) {
                    let totalRating = 0;
                    let ratingCount = 0;
                    ratingVotesSnapshot.forEach(voteDoc => {
                        const voteData = voteDoc.data();
                        if (voteData.playerId === playerId) {
                            totalRating += voteData.rating || 6.0;
                            ratingCount++;
                        }
                    });
                    if (ratingCount > 0) {
                        avgRating = totalRating / ratingCount;
                    }
                }

                // Calculate rating bonus (can be negative!)
                const ratingBonus = getLocalRatingBonusFallback(avgRating, playerPosition);
                const totalPoints = statsPoints + mvpBonus + ratingBonus;

                // Update player stats document
                await statDoc.ref.update({
                    isMVP: isMVP,
                    statsPoints: statsPoints,
                    mvpBonus: mvpBonus,
                    ratingBonus: ratingBonus,
                    averageRating: Math.round(avgRating * 10) / 10,
                    totalPoints: totalPoints
                });

                console.log(`  📈 ${playerName}: ${totalPoints} pts (MVP: ${isMVP}, Rating: ${avgRating.toFixed(1)}, Bonus: ${ratingBonus})`);
                updatedCount++;
            } catch (playerError) {
                console.error('  ❌ Error updating player:', playerError);
            }
        }
        console.log('✅ [STEP 4] Updated', updatedCount, 'players');

        // === STEP 5: Update gameweek status ===
        console.log('📌 [STEP 5] Updating gameweek status to completed...');
        await db.collection('gameweeks').doc(gameweekId).update({
            status: 'completed',
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ [STEP 5] Gameweek status updated');

        // === STEP 6: Recalculate user squad points ===
        console.log('📌 [STEP 6] Recalculating user squad points...');
        if (typeof updateLiveUserSquads === 'function') {
            await updateLiveUserSquads(gameweekId);
            console.log('✅ [STEP 6] User squads updated');
        } else {
            console.warn('⚠️ [STEP 6] updateLiveUserSquads not found');
        }

        // === STEP 7: Aggregate points for leaderboard ===
        console.log('📌 [STEP 7] Aggregating user points...');
        if (typeof aggregateAllUsersPoints === 'function') {
            await aggregateAllUsersPoints(gameweekId);
            console.log('✅ [STEP 7] User points aggregated');
        } else {
            console.warn('⚠️ [STEP 7] aggregateAllUsersPoints not found');
        }

        // === SUCCESS ===
        showAlert(`✅ Готово!\n\nMVP: ${mvpName || 'Не определен'}\nОчки начислены: ${updatedCount} игроков`, 'success');
        renderMatches();

        if (typeof renderGlobalLeaderboard === 'function') {
            renderGlobalLeaderboard();
        }

    } catch (error) {
        console.error('❌ [ERROR] recalculateMVP failed:', error);
        showAlert('Ошибка: ' + error.message, 'error');
    }
}

// Recalculate ONLY points (skips MVP determination)
async function recalculatePointsOnly(matchId) {
    if (!isAdminLoggedIn) return;
    if (!confirm('Пересчитать только очки (Frontend fix)?')) return;

    try {
        console.log('🔄 Recalculating points for match:', matchId);

        // Find Gameweek
        const gameweeksSnapshot = await db.collection('gameweeks')
            .where('matchId', '==', matchId)
            .get();

        if (gameweeksSnapshot.empty) {
            showAlert('Тур не найден', 'error');
            return;
        }

        const gameweekId = gameweeksSnapshot.docs[0].id;

        // Force update all squads
        if (typeof updateLiveUserSquads === 'function') {
            await updateLiveUserSquads(gameweekId);
        }

        // Aggregate for leaderboard
        if (typeof aggregateAllUsersPoints === 'function') {
            await aggregateAllUsersPoints(gameweekId);
        }

        showAlert('✅ Очки пересчитаны!', 'success');
        if (typeof renderGlobalLeaderboard === 'function') renderGlobalLeaderboard();

    } catch (e) {
        console.error(e);
        showAlert('Ошибка: ' + e.message, 'error');
    }
}

window.recalculateMVP = recalculateMVP;
window.recalculatePointsOnly = recalculatePointsOnly;

// Local fallback for MVP bonus
function getLocalMVPBonusFallback(position) {
    const bonuses = { 'GK': 8, 'DEF': 6, 'MID': 4, 'FWD': 2 };
    return bonuses[position] || 0;
}

// Local fallback for rating bonus (can be negative!)
function getLocalRatingBonusFallback(avgRating, position) {
    const isDefensive = (position === 'GK' || position === 'DEF');
    if (avgRating >= 9.0) return isDefensive ? 8 : 5;
    if (avgRating >= 8.0) return isDefensive ? 5 : 3;
    if (avgRating >= 7.0) return isDefensive ? 2 : 1;
    if (avgRating >= 6.0) return 0;
    if (avgRating >= 4.5) return -2;
    return -4;
}

window.recalculateMVP = recalculateMVP;

// Get vote statistics for admin
async function getVoteStatistics(matchId) {
    try {
        const votesSnapshot = await db.collection('matches').doc(matchId)
            .collection('votes').get();

        const voteData = new Map(); // Key: "player", Value: { team: "", votes: 0, voters: [] }
        let totalVotes = 0;

        votesSnapshot.forEach(doc => {
            const vote = doc.data();
            // Group by player name only to handle legacy team names
            const key = vote.player;

            if (!voteData.has(key)) {
                // Prefer "General" or the most recent team, but for now just take the first one found
                // If the player is in ALLOWED_PLAYERS, we can force "General" or their specific group if we knew it
                // For simplified display, we'll use the team from the vote, defaulting to "General" if it matches the current logic
                voteData.set(key, {
                    team: vote.team === "General" ? "General" : vote.team,
                    votes: 0,
                    voters: []
                });
            }

            const data = voteData.get(key);

            // Update team if we encounter "General" (preferred for new consistency)
            if (vote.team === "General") {
                data.team = "General";
            }

            data.votes++;
            // Include all voters, even if email is missing (for old votes)
            data.voters.push(vote.userEmail || 'Аноним');
            totalVotes++;
        });

        const stats = Array.from(voteData.entries()).map(([player, data]) => {
            return {
                player,
                team: data.team,
                votes: data.votes,
                voters: data.voters,
                percentage: totalVotes > 0 ? Math.round((data.votes / totalVotes) * 100) : 0
            };
        }).sort((a, b) => b.votes - a.votes);

        return { stats, totalVotes };

    } catch (error) {
        console.error('Error getting vote stats:', error);
        return { stats: [], totalVotes: 0 };
    }
}

// ===================================
// MATCH MANAGEMENT
// ===================================

function addMatch(matchData) {
    if (matchData.team1 === matchData.team2) {
        showAlert('Команды должны быть разными!', 'error');
        return false;
    }

    const scorers = collectScorerData();
    const goals = buildGoalsArray(matchData.team1, matchData.team2, scorers);

    // Calculate voting end time (24 hours from now)
    const now = new Date();
    const votingEndsAt = new Date(now.getTime() + VOTING_DURATION_MS);

    const newMatch = {
        team1: matchData.team1,
        team2: matchData.team2,
        score1: parseInt(matchData.score1),
        score2: parseInt(matchData.score2),
        date: matchData.date,
        scorers: scorers,
        goals: goals,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        votingStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
        votingEndsAt: firebase.firestore.Timestamp.fromDate(votingEndsAt),
        votingClosed: false,
        mvp: null
    };

    db.collection('matches')
        .add(newMatch)
        .then(() => {
            showAlert('Матч успешно добавлен!', 'success');
        })
        .catch((error) => {
            console.error('Error adding match:', error);
            showAlert('Ошибка при добавлении матча', 'error');
        });

    return true;
}

function buildGoalsArray(team1, team2, scorers) {
    const goals = [];

    if (scorers.team1) {
        scorers.team1.forEach(item => {
            const scorerName = typeof item === 'string' ? item : item.scorer;
            const assistName = typeof item === 'string' ? null : item.assist;

            if (scorerName && scorerName.trim()) {
                goals.push({
                    player: scorerName.trim(),
                    assist: assistName ? assistName.trim() : null,
                    team: team1
                });
            }
        });
    }

    if (scorers.team2) {
        scorers.team2.forEach(item => {
            const scorerName = typeof item === 'string' ? item : item.scorer;
            const assistName = typeof item === 'string' ? null : item.assist;

            if (scorerName && scorerName.trim()) {
                goals.push({
                    player: scorerName.trim(),
                    assist: assistName ? assistName.trim() : null,
                    team: team2
                });
            }
        });
    }

    return goals;
}

function updateMatch(matchId, matchData) {
    if (matchData.team1 === matchData.team2) {
        showAlert('Команды должны быть разными!', 'error');
        return false;
    }

    const scorers = collectScorerData();
    const goals = buildGoalsArray(matchData.team1, matchData.team2, scorers);

    const updatedMatch = {
        team1: matchData.team1,
        team2: matchData.team2,
        score1: parseInt(matchData.score1),
        score2: parseInt(matchData.score2),
        date: matchData.date,
        scorers: scorers,
        goals: goals,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('matches')
        .doc(matchId)
        .update(updatedMatch)
        .then(() => {
            showAlert('Матч успешно обновлён!', 'success');
        })
        .catch((error) => {
            console.error('Error updating match:', error);
            showAlert('Ошибка при обновлении матча', 'error');
        });

    return true;
}

function deleteMatch(matchId) {
    if (!confirm('Вы уверены, что хотите удалить этот матч?')) {
        return;
    }

    db.collection('matches')
        .doc(matchId)
        .delete()
        .then(() => {
            showAlert('Матч удалён', 'success');
        })
        .catch((error) => {
            console.error('Error deleting match:', error);
            showAlert('Ошибка при удалении матча', 'error');
        });
}

function editMatch(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    editingMatchId = matchId;

    document.getElementById('matchId').value = match.id;
    document.getElementById('team1').value = match.team1;
    document.getElementById('team2').value = match.team2;
    document.getElementById('score1').value = match.score1;
    document.getElementById('score2').value = match.score2;
    document.getElementById('matchDate').value = match.date;

    updateScorerInputs();

    if (match.scorers) {
        const team1ScorerInputs = document.querySelectorAll('#team1Scorers .scorer-select');
        const team1AssistInputs = document.querySelectorAll('#team1Scorers .assist-select');
        const team2ScorerInputs = document.querySelectorAll('#team2Scorers .scorer-select');
        const team2AssistInputs = document.querySelectorAll('#team2Scorers .assist-select');

        team1ScorerInputs.forEach((input, index) => {
            const item = match.scorers.team1 && match.scorers.team1[index];
            if (item) {
                input.value = typeof item === 'string' ? item : item.scorer;
            }
        });
        team1AssistInputs.forEach((input, index) => {
            const item = match.scorers.team1 && match.scorers.team1[index];
            if (item && typeof item !== 'string') {
                input.value = item.assist;
            }
        });

        team2ScorerInputs.forEach((input, index) => {
            const item = match.scorers.team2 && match.scorers.team2[index];
            if (item) {
                input.value = typeof item === 'string' ? item : item.scorer;
            }
        });
        team2AssistInputs.forEach((input, index) => {
            const item = match.scorers.team2 && match.scorers.team2[index];
            if (item && typeof item !== 'string') {
                input.value = item.assist;
            }
        });
    }

    document.getElementById('matchModalTitle').textContent = 'Изменить Матч';
    openModal('matchModal');
}

// ===================================
// PLAYER STATISTICS
// ===================================

function calculatePlayerStats() {
    const playerStats = new Map();

    matches.forEach(match => {
        // Process Team 1 Goals
        if (match.scorers?.team1) {
            match.scorers.team1.forEach(item => {
                processStatsItem(item, playerStats);
            });
        }

        // Process Team 2 Goals
        if (match.scorers?.team2) {
            match.scorers.team2.forEach(item => {
                processStatsItem(item, playerStats);
            });
        }
    });

    const statsArray = Array.from(playerStats.values());

    // Sort based on filter
    statsArray.sort((a, b) => {
        if (currentStatsFilter === 'goals') {
            return b.goals - a.goals || b.assists - a.assists;
        } else if (currentStatsFilter === 'assists') {
            return b.assists - a.assists || b.goals - a.goals;
        } else { // g_a
            return (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals;
        }
    });

    return statsArray;
}

function processStatsItem(item, statsMap) {
    // Handle both string (legacy) and object (new) formats
    let scorerName, assistName;

    if (typeof item === 'string') {
        scorerName = item;
        assistName = null;
    } else {
        scorerName = item.scorer;
        assistName = item.assist;
    }

    // Update Scorer
    if (scorerName) {
        if (!statsMap.has(scorerName)) {
            statsMap.set(scorerName, { name: scorerName, goals: 0, assists: 0 });
        }
        statsMap.get(scorerName).goals++;
    }

    // Update Assistant
    if (assistName) {
        if (!statsMap.has(assistName)) {
            statsMap.set(assistName, { name: assistName, goals: 0, assists: 0 });
        }
        statsMap.get(assistName).assists++;
    }
}

function renderPlayerStats() {
    const tbody = document.getElementById('statsTableBody');
    const theadRow = document.querySelector('#tab-stats .league-table thead tr');

    // Update Headers
    if (currentStatsFilter === 'goals') {
        theadRow.innerHTML = `
            <th>#</th>
            <th>Игрок</th>
            <th class="text-center">Голы</th>
        `;
    } else if (currentStatsFilter === 'assists') {
        theadRow.innerHTML = `
            <th>#</th>
            <th>Игрок</th>
            <th class="text-center">Ассисты</th>
        `;
    } else { // g_a
        theadRow.innerHTML = `
            <th>#</th>
            <th>Игрок</th>
            <th class="text-center col-optional">Голы</th>
            <th class="text-center col-optional">Ассисты</th>
            <th class="text-center">Г+П</th>
        `;
    }

    tbody.innerHTML = '';

    const stats = calculatePlayerStats();

    stats.forEach((player, index) => {
        // Skip players with 0 stats for the current filter
        if (currentStatsFilter === 'goals' && player.goals === 0) return;
        if (currentStatsFilter === 'assists' && player.assists === 0) return;
        if (currentStatsFilter === 'g_a' && (player.goals + player.assists) === 0) return;

        const row = document.createElement('tr');

        let cells = `
            <td class="text-center">${index + 1}</td>
            <td class="font-weight-bold">${player.name}</td>
        `;

        if (currentStatsFilter === 'goals') {
            cells += `<td class="text-center font-weight-bold">${player.goals}</td>`;
        } else if (currentStatsFilter === 'assists') {
            cells += `<td class="text-center font-weight-bold">${player.assists}</td>`;
        } else {
            cells += `
                <td class="text-center col-optional">${player.goals}</td>
                <td class="text-center col-optional">${player.assists}</td>
                <td class="text-center font-weight-bold">${player.goals + player.assists}</td>
            `;
        }

        row.innerHTML = cells;
        tbody.appendChild(row);
    });
}

// ===================================
// LEAGUE TABLE CALCULATIONS
// ===================================

function calculateStandings() {
    teams.forEach(team => {
        team.matches = 0;
        team.wins = 0;
        team.draws = 0;
        team.losses = 0;
        team.goalsFor = 0;
        team.goalsAgainst = 0;
        team.points = 0;
        team.form = [];
    });

    matches.forEach(match => {
        const team1 = teams.find(t => t.name === match.team1);
        const team2 = teams.find(t => t.name === match.team2);

        if (!team1 || !team2) return;

        team1.matches++;
        team2.matches++;

        team1.goalsFor += match.score1;
        team1.goalsAgainst += match.score2;
        team2.goalsFor += match.score2;
        team2.goalsAgainst += match.score1;

        if (match.score1 > match.score2) {
            team1.wins++;
            team1.points += 3;
            team2.losses++;
            team1.form.unshift('W');
            team2.form.unshift('L');
        } else if (match.score1 < match.score2) {
            team2.wins++;
            team2.points += 3;
            team1.losses++;
            team1.form.unshift('L');
            team2.form.unshift('W');
        } else {
            team1.draws++;
            team2.draws++;
            team1.points += 1;
            team2.points += 1;
            team1.form.unshift('D');
            team2.form.unshift('D');
        }

        team1.form = team1.form.slice(0, 5);
        team2.form = team2.form.slice(0, 5);
    });

    teams.sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        return gdB - gdA;
    });

    saveDataToLocalStorage();
}

// ===================================
// RENDERING
// ===================================

function renderLeagueTable() {
    const tbody = document.getElementById('leagueTableBody');
    tbody.innerHTML = '';

    teams.forEach((team, index) => {
        const row = document.createElement('tr');
        const goalDifference = team.goalsFor - team.goalsAgainst;
        const gdSign = goalDifference > 0 ? '+' : '';

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div class="team-name">
                    <div class="team-icon">${team.name.charAt(0)}</div>
                    ${team.name}
                </div>
            </td>
            <td>${team.matches}</td>
            <td>${team.wins}</td>
            <td>${team.draws}</td>
            <td>${team.losses}</td>
            <td class="goals">${team.goalsFor}:${team.goalsAgainst} <small>(${gdSign}${goalDifference})</small></td>
            <td class="points">${team.points}</td>
            <td>
                <div class="form">
                    ${team.form.map(result => `
                        <div class="form-badge ${result === 'W' ? 'win' : result === 'D' ? 'draw' : 'loss'}">
                            ${result}
                        </div>
                    `).join('')}
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function renderMatches() {
    const grid = document.getElementById('matchesGrid');
    grid.innerHTML = '';

    if (matches.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center">Матчи пока не добавлены</p>';
        return;
    }

    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';

        const formattedDate = new Date(match.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // MVP Badge
        const mvpBadge = match.mvp && match.votingClosed ? `
            <div class="mvp-badge">
                🏆 MVP: ${match.mvp.player}
            </div>
        ` : '';

        // Voting status
        const votingStatus = getVotingStatusHTML(match);

        // Scorers HTML
        const scorersHTML = renderScorers(match);

        card.innerHTML = `
            ${mvpBadge}
            <div class="match-date">${formattedDate}</div>
            <div class="match-teams">
                <div class="match-team">
                    <div class="match-team-name">${match.team1}</div>
                </div>
                <div class="match-score">
                    <span>${match.score1}</span>
                    <span class="match-score-separator">:</span>
                    <span>${match.score2}</span>
                </div>
                <div class="match-team">
                    <div class="match-team-name">${match.team2}</div>
                </div>
            </div>
            
            <div class="match-details" id="details-${match.id}">
                ${scorersHTML}
                ${votingStatus}
                
                <!-- Live Rating Block -->
                <div id="matchVotingContainer_${match.id}" class="match-voting-wrapper"></div>
            </div>
            
            <div class="match-footer">
                ${isVotingOpen(match) ? `
                <button class="btn btn-voting btn-small" onclick="event.stopPropagation(); openVotingModal('${match.id}')">
                    🏆 Голосовать за MVP
                </button>
                ` : ''}
                ${isAdminLoggedIn ? `
                    <div class="match-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-secondary btn-small" onclick="editMatch('${match.id}')" title="Редактировать">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="deleteMatch('${match.id}')" title="Удалить">🗑️</button>
                        <button class="btn btn-info btn-small" onclick="showMatchDetails('${match.id}')" title="Статистика">📊</button>
                        <button class="btn btn-warning btn-small" onclick="resetVoting('${match.id}')" title="Возобновить голосование">🔄</button>
                        <button class="btn btn-success btn-small" onclick="recalculateMVP('${match.id}')" title="Закрыть голосование и пересчитать MVP">🏆</button>
                        <button class="btn btn-info btn-small" onclick="recalculatePointsOnly('${match.id}')" title="Пересчитать только очки (без MVP)">🔢</button>
                    </div>
                ` : ''}
            </div>
        `;

        card.onclick = () => toggleMatchDetails(match.id);
        grid.appendChild(card);
    });
}

function getVotingStatusHTML(match) {
    if (match.votingClosed && match.mvp) {
        return `
            <div class="voting-status closed">
                <span class="status-icon">🏆</span>
                <span>MVP: ${match.mvp.player} (${match.mvp.votes} ${getDeclension(match.mvp.votes, ['голос', 'голоса', 'голосов'])})</span>
            </div>
        `;
    } else if (match.votingClosed && !match.mvp) {
        // Voting closed but no MVP was determined (no votes or calculation failed)
        return `
            <div class="voting-status closed" style="color: #f59e0b;">
                <span class="status-icon">⚠️</span>
                <span>MVP: Не определен (нет голосов)</span>
            </div>
        `;
    } else if (isVotingOpen(match)) {
        const time = getVotingTimeRemaining(match);
        return `
            <div class="voting-status open">
                <span class="status-icon">⏱️</span>
                <span>Голосование: ${time ? `${time.hours}ч ${time.minutes}мин` : 'идёт'}</span>
            </div>
        `;
    } else if (match.votingEndsAt) {
        return `
            <div class="voting-status closed">
                <span class="status-icon">⏰</span>
                <span>Голосование завершено</span>
            </div>
        `;
    }
    return '';
}

function renderScorers(match) {
    if (!match.scorers || (!match.scorers.team1?.length && !match.scorers.team2?.length)) {
        return '<p class="text-muted text-center" style="font-size: 0.85rem; margin: var(--spacing-sm) 0;">Нет данных о голах</p>';
    }

    const team1Scorers = match.scorers.team1 || [];
    const team2Scorers = match.scorers.team2 || [];

    return `
        <div class="scorers-section">
            <div class="team-scorers">
                <div class="team-scorers-title">${match.team1}</div>
                ${team1Scorers.map(item => {
        const scorer = typeof item === 'string' ? item : item.scorer;
        const assist = typeof item === 'string' ? null : item.assist;
        return `
                    <div class="goal-scorer">
                        <span class="goal-icon">⚽</span>
                        <span class="scorer-name">
                            ${scorer} ${assist ? `<span class="text-muted" style="font-size: 0.8em;">(пас: ${assist})</span>` : ''}
                        </span>
                    </div>
                `}).join('') || '<span class="text-muted" style="font-size: 0.85rem;">—</span>'}
            </div>
            <div class="team-scorers">
                <div class="team-scorers-title">${match.team2}</div>
                ${team2Scorers.map(item => {
            const scorer = typeof item === 'string' ? item : item.scorer;
            const assist = typeof item === 'string' ? null : item.assist;
            return `
                    <div class="goal-scorer">
                        <span class="goal-icon">⚽</span>
                        <span class="scorer-name">
                            ${scorer} ${assist ? `<span class="text-muted" style="font-size: 0.8em;">(пас: ${assist})</span>` : ''}
                        </span>
                    </div>
                `}).join('') || '<span class="text-muted" style="font-size: 0.85rem;">—</span>'}
            </div>
        </div>
    `;
}

function toggleMatchDetails(matchId) {
    const detailsElement = document.getElementById(`details-${matchId}`);
    if (detailsElement) {
        detailsElement.classList.toggle('expanded');

        // Load voting block when expanded
        if (detailsElement.classList.contains('expanded')) {
            const votingContainer = document.getElementById(`matchVotingContainer_${matchId}`);
            if (votingContainer && typeof renderMatchVotingBlock === 'function') {
                renderMatchVotingBlock(matchId, `#matchVotingContainer_${matchId}`);
            }
        }
    }
}

// Show match details modal with voting stats (admin only)
async function showMatchDetails(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const content = document.getElementById('matchDetailsContent');
    document.getElementById('matchDetailsTitle').textContent = `${match.team1} vs ${match.team2}`;

    // Get voting statistics
    const { stats, totalVotes } = await getVoteStatistics(matchId);

    const formattedDate = new Date(match.date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    content.innerHTML = `
        <div class="match-details-info">
            <p><strong>Дата:</strong> ${formattedDate}</p>
            <p><strong>Счёт:</strong> ${match.score1} : ${match.score2}</p>
            <p><strong>Статус голосования:</strong> ${match.votingClosed ? 'Завершено' : 'Активно'}</p>
            <p><strong>Всего голосов:</strong> ${totalVotes}</p>
        </div>
        
        <h4>Статистика голосования:</h4>
        ${stats.length > 0 ? `
            <div class="vote-stats">
                ${stats.map(s => `
                    <div class="vote-stat-item">
                        <div class="vote-stat-player">
                            <span class="player-name">${s.player}</span>
                            <span class="player-team">(${s.team})</span>
                        </div>
                        <div class="vote-stat-bar-container">
                            <div class="vote-stat-bar" style="width: ${s.percentage}%"></div>
                            <span class="vote-stat-value">${s.votes} ${getDeclension(s.votes, ['голос', 'голоса', 'голосов'])} (${s.percentage}%)</span>
                        </div>
                        ${s.voters && s.voters.length > 0 ? `
                            <div class="voters-list" style="margin-top: 8px; font-size: 0.85rem;">
                                <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Голосовали:</div>
                                <ul style="list-style: none; padding-left: 0; color: var(--text-muted);">
                                    ${s.voters.map(email => `<li style="margin-bottom: 2px;">• ${email}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : '<p class="text-muted">Пока нет голосов</p>'}
        
        ${match.mvp ? `
            <div class="mvp-result-block">
                <h4>🏆 MVP матча</h4>
                <p class="mvp-name">${match.mvp.player}</p>
                <p class="mvp-team">${match.mvp.team}</p>
                <p class="mvp-votes">${match.mvp.votes} ${getDeclension(match.mvp.votes, ['голос', 'голоса', 'голосов'])}</p>
            </div>
        ` : ''}
    `;

    openModal('matchDetailsModal');
}

// ===================================
// SCORER INPUTS MANAGEMENT
// ===================================

function updateScorerInputs() {
    const score1 = parseInt(document.getElementById('score1').value) || 0;
    const score2 = parseInt(document.getElementById('score2').value) || 0;

    const team1Name = document.getElementById('team1').value;
    const team2Name = document.getElementById('team2').value;

    createScorerFields('team1Scorers', 'team1ScorersContainer', score1, team1Name);
    createScorerFields('team2Scorers', 'team2ScorersContainer', score2, team2Name);
}

function createScorerFields(containerId, containerWrapperId, count, teamName) {
    const container = document.getElementById(containerId);
    const containerWrapper = document.getElementById(containerWrapperId);

    if (count === 0) {
        containerWrapper.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    containerWrapper.style.display = 'block';

    const existingInputs = container.querySelectorAll('select');
    const existingValues = Array.from(existingInputs).map(input => input.value);

    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'scorer-input-group';
        inputGroup.style.display = 'grid';
        inputGroup.style.gridTemplateColumns = 'auto 1fr 1fr';
        inputGroup.style.alignItems = 'center';

        const scorerOptions = ['<option value="">Гол забил</option>', ...ALLOWED_PLAYERS.map(p =>
            `<option value="${p}">${p}</option>`
        )].join('');

        const assistOptions = ['<option value="">Ассистент</option>', ...ALLOWED_PLAYERS.map(p =>
            `<option value="${p}">${p}</option>`
        )].join('');

        inputGroup.innerHTML = `
            <label style="min-width: 20px;">${i + 1}.</label>
            <select class="scorer-select">
                ${scorerOptions}
            </select>
            <select class="assist-select">
                ${assistOptions}
            </select>
        `;

        container.appendChild(inputGroup);
    }
}

function collectScorerData() {
    const team1Groups = document.querySelectorAll('#team1Scorers .scorer-input-group');
    const team2Groups = document.querySelectorAll('#team2Scorers .scorer-input-group');

    const team1Scorers = Array.from(team1Groups).map(group => {
        const scorer = group.querySelector('.scorer-select').value;
        const assist = group.querySelector('.assist-select').value;
        if (scorer) return { scorer, assist };
        return null;
    }).filter(item => item !== null);

    const team2Scorers = Array.from(team2Groups).map(group => {
        const scorer = group.querySelector('.scorer-select').value;
        const assist = group.querySelector('.assist-select').value;
        if (scorer) return { scorer, assist };
        return null;
    }).filter(item => item !== null);

    return {
        team1: team1Scorers,
        team2: team2Scorers
    };
}

// ===================================
// MODAL MANAGEMENT
// ===================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');

    // Reset forms based on modal type
    if (modalId === 'loginModal') {
        document.getElementById('loginForm').reset();
        document.getElementById('loginError').innerHTML = '';
    } else if (modalId === 'matchModal') {
        document.getElementById('matchForm').reset();
        document.getElementById('matchError').innerHTML = '';
        document.getElementById('team1Scorers').innerHTML = '';
        document.getElementById('team2Scorers').innerHTML = '';
        document.getElementById('team1ScorersContainer').style.display = 'none';
        document.getElementById('team2ScorersContainer').style.display = 'none';
        editingMatchId = null;
        document.getElementById('matchModalTitle').textContent = 'Добавить Матч';
    } else if (modalId === 'authModal') {
        document.getElementById('userLoginForm').reset();
        document.getElementById('userRegisterForm').reset();
        document.getElementById('userRecoveryForm').reset();
        document.getElementById('loginFormError').innerHTML = '';
        document.getElementById('registerFormError').innerHTML = '';
        document.getElementById('recoveryFormError').innerHTML = '';
        switchAuthTab('login'); // Reset to login tab on close
    } else if (modalId === 'votingModal') {
        document.getElementById('playersList').classList.remove('hidden');
        document.getElementById('votingSuccess').classList.add('hidden');
        document.getElementById('votingError').innerHTML = '';
        selectedVotePlayer = null;
        currentVotingMatchId = null;
    }
}

// ===================================
// ALERTS
// ===================================

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// ===================================
// EVENT LISTENERS
// ===================================

function initializeEventListeners() {
    // === User Auth Events ===
    document.getElementById('loginBtn').addEventListener('click', () => {
        openModal('authModal');
    });

    document.getElementById('userLogoutBtn').addEventListener('click', logoutUser);

    // Auth tabs
    document.getElementById('loginTab').addEventListener('click', () => {
        switchAuthTab('login');
    });

    document.getElementById('registerTab').addEventListener('click', () => {
        switchAuthTab('register');
    });

    document.getElementById('recoveryTab').addEventListener('click', () => {
        switchAuthTab('recovery');
    });

    // User login form
    document.getElementById('userLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await loginUser(email, password);
        } catch (error) {
            document.getElementById('loginFormError').innerHTML = `
                <div class="alert alert-error">${getAuthErrorMessage(error.code)}</div>
            `;
        }
    });

    // User register form
    document.getElementById('userRegisterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerPasswordConfirm').value;

        if (password !== confirmPassword) {
            document.getElementById('registerFormError').innerHTML = `
                <div class="alert alert-error">Пароли не совпадают</div>
            `;
            return;
        }

        try {
            await registerUser(email, password);
        } catch (error) {
            document.getElementById('registerFormError').innerHTML = `
                <div class="alert alert-error">${getAuthErrorMessage(error.code)}</div>
            `;
        }
    });

    // Auth modal close buttons
    document.getElementById('closeAuthModal').addEventListener('click', () => closeModal('authModal'));
    document.getElementById('cancelAuthLogin').addEventListener('click', () => closeModal('authModal'));
    document.getElementById('cancelAuthRegister').addEventListener('click', () => closeModal('authModal'));
    document.getElementById('cancelAuthRecovery').addEventListener('click', () => closeModal('authModal'));

    // User recovery form
    document.getElementById('userRecoveryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value;

        try {
            await recoverPassword(email);
        } catch (error) {
            document.getElementById('recoveryFormError').innerHTML = `
                <div class="alert alert-error">${getAuthErrorMessage(error.code)}</div>
            `;
        }
    });

    // === Match Management Events ===
    document.getElementById('addMatchBtn').addEventListener('click', () => {
        editingMatchId = null;
        document.getElementById('matchForm').reset();
        document.getElementById('matchModalTitle').textContent = 'Добавить Матч';
        document.getElementById('team1Scorers').innerHTML = '';
        document.getElementById('team2Scorers').innerHTML = '';
        document.getElementById('team1ScorersContainer').style.display = 'none';
        document.getElementById('team2ScorersContainer').style.display = 'none';
        openModal('matchModal');
    });

    document.getElementById('score1').addEventListener('input', updateScorerInputs);
    document.getElementById('score2').addEventListener('input', updateScorerInputs);
    document.getElementById('team1').addEventListener('change', updateScorerInputs);
    document.getElementById('team2').addEventListener('change', updateScorerInputs);

    document.getElementById('matchForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const matchData = {
            team1: document.getElementById('team1').value,
            team2: document.getElementById('team2').value,
            score1: document.getElementById('score1').value,
            score2: document.getElementById('score2').value,
            date: document.getElementById('matchDate').value
        };

        let success;
        if (editingMatchId) {
            success = updateMatch(editingMatchId, matchData);
        } else {
            success = addMatch(matchData);
        }

        if (success) {
            closeModal('matchModal');
        }
    });

    document.getElementById('closeMatchModal').addEventListener('click', () => closeModal('matchModal'));
    document.getElementById('cancelMatch').addEventListener('click', () => closeModal('matchModal'));

    // === Voting Modal Events ===
    document.getElementById('closeVotingModal').addEventListener('click', () => closeModal('votingModal'));
    document.getElementById('cancelVoting').addEventListener('click', () => closeModal('votingModal'));
    document.getElementById('submitVoteBtn').addEventListener('click', submitVote);

    // === Match Details Modal Events ===
    document.getElementById('closeMatchDetailsModal').addEventListener('click', () => closeModal('matchDetailsModal'));
    document.getElementById('closeMatchDetails').addEventListener('click', () => closeModal('matchDetailsModal'));

    // === Close modals on background click ===
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // === Main Tabs ===
    const mainTabs = document.querySelectorAll('.main-tab');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            mainTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Activate clicked
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // === Stats Filter ===
    const statsFilters = document.querySelectorAll('.stats-filter-btn');
    statsFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            statsFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatsFilter = btn.dataset.filter;
            renderPlayerStats();
        });
    });
}

// Switch between login and register tabs
function switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const recoveryTab = document.getElementById('recoveryTab');
    const loginForm = document.getElementById('userLoginForm');
    const registerForm = document.getElementById('userRegisterForm');
    const recoveryForm = document.getElementById('userRecoveryForm');
    const modalTitle = document.getElementById('authModalTitle');

    // Reset basics
    loginTab.classList.remove('active');
    registerTab.classList.remove('active');
    recoveryTab.classList.remove('active');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    recoveryForm.classList.add('hidden');

    if (tab === 'login') {
        loginTab.classList.add('active');
        loginForm.classList.remove('hidden');
        modalTitle.textContent = 'Вход';
    } else if (tab === 'register') {
        registerTab.classList.add('active');
        registerForm.classList.remove('hidden');
        modalTitle.textContent = 'Регистрация';
    } else if (tab === 'recovery') {
        recoveryTab.classList.add('active');
        recoveryForm.classList.remove('hidden');
        modalTitle.textContent = 'Восстановление пароля';
    }
}

// NEW: Extend Match Voting (1 Hour)
async function extendMatchVoting(matchId) {
    if (!confirm('Продлить голосование за этот матч на 1 час?')) return;

    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) return;

        const currentEnd = matchDoc.data().votingEndsAt ? matchDoc.data().votingEndsAt.toDate() : new Date();
        const baseTime = (currentEnd < new Date()) ? new Date() : currentEnd;
        const newEnd = new Date(baseTime.getTime() + (1 * 60 * 60 * 1000)); // +1 hour

        await db.collection('matches').doc(matchId).update({
            votingEndsAt: firebase.firestore.Timestamp.fromDate(newEnd),
            votingClosed: false
        });

        showAlert('✅ Голосование продлено на 1 час!', 'success');
        loadMatches(); // Reload UI

    } catch (e) {
        console.error(e);
        showAlert('Ошибка: ' + e.message, 'error');
    }
}

// Make functions globally accessible for inline event handlers
window.editMatch = editMatch;
window.deleteMatch = deleteMatch;
window.toggleMatchDetails = toggleMatchDetails;
window.openVotingModal = openVotingModal;
window.showMatchDetails = showMatchDetails;
window.resetVoting = resetVoting;
// window.forceEndVoting removed
window.extendMatchVoting = extendMatchVoting;

// ===================================
// FANTASY FOOTBALL MODULE
// El Clasico Fantasy System
// ===================================

// Fantasy Players Data (with team colors)
// NOTE: IDs must match PLAYERS_DATA in players_data.js for price lookup
let FANTASY_PLAYERS = [
    // Team A (Red Jerseys) 🔴 - 1 группа
    { id: "mansur_sh", name: "Мансур Ш.", position: "FWD", price: 6.5, team: "A" },
    { id: "daulet_e", name: "Даулет Е.", position: "MID", price: 7.0, team: "A" },
    { id: "sanzhar_a", name: "Санжар А.", position: "MID", price: 7.0, team: "A" },
    { id: "aibek_a", name: "Айбек А.", position: "FWD", price: 6.7, team: "A" },
    { id: "alisher_a", name: "Алишер А.", position: "DEF", price: 3.0, team: "A" },
    { id: "shyngys_t", name: "Шынгыс Т.", position: "FWD", price: 6.3, team: "A" },

    // Team B (Blue Jerseys) 🔵 - 2 группа
    { id: "asan_t", name: "Асан Т.", position: "DEF", price: 6.2, team: "B" },
    { id: "dimash_a", name: "Димаш А.", position: "GK", price: 2.5, team: "B" },
    { id: "akylbek_a", name: "Акылбек А.", position: "FWD", price: 9.0, team: "B" },
    { id: "yerasyl_k", name: "Ерасыл К.", position: "FWD", price: 7.5, team: "B" },
    { id: "daniiar_a", name: "Данияр А.", position: "MID", price: 5.6, team: "B" },
    { id: "hamid_t", name: "Хамид Т.", position: "DEF", price: 2.5, team: "B" }
];


// Fantasy Configuration (team building)
const FANTASY_TEAM_CONFIG = {
    maxPlayers: 3,
    budget: 18.0,
    deadlineDay: 5, // Friday (0 = Sunday, 5 = Friday)
    deadlineHour: 9,
    deadlineMinute: 50
};

// Fantasy State
let fantasyTeam = {
    players: [], // Array of player IDs
    captainId: null,
    viceCaptainId: null, // NEW: Vice-captain for snapshot model
    managerName: '', // User's nickname
    remainingBudget: null // Dynamic budget (bank balance)
};
let fantasyCurrentFilter = 'ALL';

// ===================================
// FANTASY INITIALIZATION
// ===================================

// ===================================
// FANTASY INITIALIZATION (Simplified & Robust)
// ===================================

/**
 * Fetch latest player data (including prices) from Firestore.
 * Updates the global FANTASY_PLAYERS array with current prices.
 */
async function fetchFantasyPlayers() {
    if (typeof db === 'undefined') {
        console.warn('⚠️ Firestore not available, using static player data');
        return;
    }

    try {
        const snapshot = await db.collection('players').get();
        if (snapshot.empty) {
            console.warn('⚠️ No players in Firestore, using static data');
            return;
        }

        // Update FANTASY_PLAYERS with Firestore data
        snapshot.forEach(doc => {
            const data = doc.data();
            // Find matching player in FANTASY_PLAYERS by name or id
            const idx = FANTASY_PLAYERS.findIndex(p =>
                p.name === data.name ||
                p.id === doc.id ||
                String(p.id) === doc.id
            );

            if (idx !== -1) {
                // Update price from database
                if (data.price !== undefined) {
                    FANTASY_PLAYERS[idx].price = data.price;
                }
                // Also update other fields if needed
                if (data.position) FANTASY_PLAYERS[idx].position = data.position;
                if (data.team) FANTASY_PLAYERS[idx].team = data.team === '1 группа' ? 'A' : 'B';
            }
        });

        console.log('✅ Fantasy players updated from Firestore');
    } catch (error) {
        console.error('❌ Error fetching fantasy players:', error);
    }
}

async function initFantasy() {
    console.log('🎮 Initializing Fantasy Football...');

    try {
        // 0. Fetch latest player prices from Firestore
        await fetchFantasyPlayers();

        // 1. Load saved data (wait for async load to complete)
        await loadFantasyTeam();
        loadManagerName();

        // 2. Setup all event listeners
        setupFantasyTabs();
        setupPositionFilter();
        setupSquadListToggle();
        setupManagerNameInput();
        setupSaveButton();
        setupGameweekNavigation();

        // 3. Initial render
        console.log('📊 Rendering initial state...');
        renderFantasyPlayersList();
        renderSelectedTeam();
        updateFantasyBudget();
        updateDeadlineDisplay();
        updateGameweekLabel();

        // 4. Update deadline every minute
        setInterval(updateDeadlineDisplay, 60000);

        console.log('✅ Fantasy Football initialized successfully!');
    } catch (err) {
        console.error('❌ Fantasy init error:', err);
        showAlert('Ошибка загрузки Fantasy', 'error');
    }
}


// Load Manager Name
function loadManagerName() {
    const saved = localStorage.getItem('fantasyManagerName');
    const nameContainer = document.getElementById('managerNameContainer');
    const savedNameDisplay = document.getElementById('savedManagerName');

    if (saved) {
        fantasyTeam.managerName = saved;
        if (nameContainer) nameContainer.classList.add('hidden');
        if (savedNameDisplay) {
            const spanEl = savedNameDisplay.querySelector('span');
            if (spanEl) spanEl.textContent = `👤 Менеджер: ${saved}`;
            savedNameDisplay.classList.remove('hidden');
        }
    } else {
        if (nameContainer) nameContainer.classList.remove('hidden');
        if (savedNameDisplay) savedNameDisplay.classList.add('hidden');
    }
}

// Setup Manager Name Input
function setupManagerNameInput() {
    const input = document.getElementById('managerName');
    const saveBtn = document.getElementById('saveManagerName');
    const nameContainer = document.getElementById('managerNameContainer');
    const savedNameDisplay = document.getElementById('savedManagerName');
    const editBtn = document.getElementById('editManagerName');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = input?.value.trim();
            if (name) {
                fantasyTeam.managerName = name;
                localStorage.setItem('fantasyManagerName', name);
                showAlert(`✅ Имя сохранено: ${name}`, 'success');

                if (nameContainer) nameContainer.classList.add('hidden');
                if (savedNameDisplay) {
                    const spanEl = savedNameDisplay.querySelector('span');
                    if (spanEl) spanEl.textContent = `👤 Менеджер: ${name}`;
                    savedNameDisplay.classList.remove('hidden');
                }
            } else {
                showAlert('Введите имя менеджера', 'error');
            }
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (nameContainer) nameContainer.classList.remove('hidden');
            if (savedNameDisplay) savedNameDisplay.classList.add('hidden');
            if (input) input.focus();
        });
    }

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveBtn?.click();
        });
    }
}

// Setup Fantasy Sub-tabs (SIMPLIFIED)
function setupFantasyTabs() {
    console.log('🔧 Setting up Fantasy tabs...');

    const tabs = document.querySelectorAll('.fantasy-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-fantasy-tab');
            console.log('👆 Tab clicked:', targetTab);

            // Remove all active classes
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.fantasy-content').forEach(c => c.classList.remove('active'));

            // Add active to clicked tab and content
            this.classList.add('active');
            const contentEl = document.getElementById(`fantasy-${targetTab}`);
            if (contentEl) {
                contentEl.classList.add('active');
                // Reset any inline display style
                contentEl.style.display = '';
                console.log('✅ Switched to tab:', targetTab);

                // Render content for specific tabs
                if (targetTab === 'results') {
                    renderFantasyResults();
                } else if (targetTab === 'leaderboard') {
                    // CONFLICT FIX: Let fantasy_core.js/leaderboard.js handle this!
                    // renderFantasyLeaderboard();
                    console.log("👉 Leaderboard rendering delegated to fantasy_core.js");
                }
            } else {
                console.error('❌ Tab content not found:', `fantasy-${targetTab}`);
            }
        });
    });
}

// Setup Position Filter
function setupPositionFilter() {
    console.log('🔧 Setting up position filter...');

    document.querySelectorAll('.fpl-pos-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const position = this.getAttribute('data-position');
            console.log('🎯 Filter:', position);

            fantasyCurrentFilter = position;

            // Update active button
            document.querySelectorAll('.fpl-pos-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Re-render players list
            renderFantasyPlayersList();
        });
    });
}

// Setup Squad/List Toggle
function setupSquadListToggle() {
    console.log('🔧 Setting up squad/list toggle...');

    document.querySelectorAll('.fpl-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const view = this.getAttribute('data-view');
            console.log('📋 View:', view);

            // Update buttons
            document.querySelectorAll('.fpl-toggle-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Toggle views
            const pitchView = document.getElementById('fplPitchView');
            const listView = document.getElementById('fplListView');

            if (view === 'squad') {
                if (pitchView) pitchView.classList.remove('hidden');
                if (listView) listView.classList.add('hidden');
            } else {
                if (pitchView) pitchView.classList.add('hidden');
                if (listView) listView.classList.remove('hidden');
                renderListView();
            }
        });
    });
}

// Setup Save Button
function setupSaveButton() {
    const saveBtn = document.getElementById('saveFantasyTeam');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveFantasyTeam);
    }
}

// Render List View (alternative to pitch)
function renderListView() {
    const container = document.getElementById('fantasyListPlayers');
    if (!container) return;

    container.innerHTML = fantasyTeam.players.map((playerId, index) => {
        const player = FANTASY_PLAYERS.find(p => p.id === playerId);
        if (!player) return '';

        const isCaptain = fantasyTeam.captainId === playerId;

        return `
            <div class="list-player-row ${isCaptain ? 'captain' : ''}">
                <div class="list-player-info">
                    <span class="list-player-emoji">${getPositionEmoji(player.position)}</span>
                    <span class="list-player-name">${player.name}</span>
                    <span class="list-player-pos">${player.position}</span>
                </div>
                <div class="list-player-price">${player.price.toFixed(1)}M</div>
                ${isCaptain ? '<span class="captain-badge">C</span>' : ''}
            </div>
        `;
    }).join('') || '<p class="text-muted text-center">Выберите игроков</p>';
}

// ===================================
// DEADLINE CHECK
// ===================================

function checkTransferDeadline() {
    // Use global lock status computed from gameweek data
    return window.isTransferWindowLocked === true;
}

function updateDeadlineDisplay() {
    const deadlineEl = document.getElementById('fantasyDeadline');
    const deadlineTextEl = document.getElementById('fantasyDeadlineText');

    if (!deadlineEl || !deadlineTextEl) return;

    const isLocked = checkTransferDeadline();

    if (isLocked) {
        deadlineEl.classList.add('locked');
        deadlineTextEl.textContent = '🔒 Трансферное окно закрыто до завершения тура';
    } else {
        deadlineEl.classList.remove('locked');

        // Use actual gameweek deadline if available
        if (window.currentGameweekData?.deadline) {
            const deadline = window.currentGameweekData.deadline.toDate ?
                window.currentGameweekData.deadline.toDate() : new Date(window.currentGameweekData.deadline);
            const timeUntil = getTimeUntilDeadlineFromDate(deadline);
            deadlineTextEl.textContent = `Дедлайн: ${deadline.toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (${timeUntil})`;
        } else {
            // Fallback to generic message
            const timeUntil = getTimeUntilDeadline();
            deadlineTextEl.textContent = `Дедлайн: Пятница 09:50 (осталось ${timeUntil})`;
        }
    }

    // Update save button state
    updateSaveButtonState();
}

// Helper function to calculate time until a specific deadline date
function getTimeUntilDeadlineFromDate(deadline) {
    const now = new Date();
    const diff = deadline - now;

    if (diff <= 0) return 'Прошел';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}д ${hours}ч`;
    }
    return `${hours}ч ${minutes}мин`;
}

function getTimeUntilDeadline() {
    const now = new Date();
    const deadline = getNextDeadline();
    const diff = deadline - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}д ${hours}ч`;
    }
    return `${hours}ч ${minutes}мин`;
}

function getNextDeadline() {
    const now = new Date();
    const deadline = new Date(now);

    // Find next Friday
    const daysUntilFriday = (FANTASY_CONFIG.deadlineDay - now.getDay() + 7) % 7;
    deadline.setDate(deadline.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
    deadline.setHours(FANTASY_CONFIG.deadlineHour, FANTASY_CONFIG.deadlineMinute, 0, 0);

    // If deadline is in the past today, move to next week
    if (deadline <= now) {
        deadline.setDate(deadline.getDate() + 7);
    }

    return deadline;
}

// ===================================
// TEAM SELECTION
// ===================================

// Store pending buy player ID for modal confirmation
let pendingBuyPlayerId = null;

function selectFantasyPlayer(playerId) {
    if (checkTransferDeadline()) {
        showAlert('Трансферы закрыты!', 'error');
        return;
    }

    const player = FANTASY_PLAYERS.find(p => p.id === playerId);
    if (!player) return;

    // Check if already selected (toggle off - show sell modal)
    if (fantasyTeam.players.includes(playerId)) {
        removeFantasyPlayer(playerId);
        return;
    }

    // Check max players
    if (fantasyTeam.players.length >= FANTASY_CONFIG.maxPlayers) {
        showAlert(`Максимум ${FANTASY_CONFIG.maxPlayers} игрока!`, 'error');
        return;
    }

    // Show buy confirmation modal
    pendingBuyPlayerId = playerId;

    // Update modal content
    document.getElementById('buyPlayerName').textContent = player.name;
    document.getElementById('buyPlayerPrice').textContent = player.price.toFixed(1);
    document.getElementById('buyPlayerBank').textContent = fantasyTeam.remainingBudget.toFixed(1);

    // Update bank color based on affordability
    const bankEl = document.getElementById('buyPlayerBank');
    if (fantasyTeam.remainingBudget >= player.price) {
        bankEl.style.color = '#22c55e'; // Green - can afford
    } else {
        bankEl.style.color = '#ef4444'; // Red - cannot afford
    }

    openModal('buyPlayerModal');
}

// Confirm buy player from modal
function confirmBuyPlayer() {
    if (!pendingBuyPlayerId) return;

    const player = FANTASY_PLAYERS.find(p => p.id === pendingBuyPlayerId);
    if (!player) {
        closeModal('buyPlayerModal');
        pendingBuyPlayerId = null;
        return;
    }

    // Check if enough money
    if (fantasyTeam.remainingBudget < player.price) {
        closeModal('buyPlayerModal');
        showAlert(`Недостаточно средств! Нужно: ${player.price}M, У вас: ${fantasyTeam.remainingBudget.toFixed(1)}M`, 'error');
        pendingBuyPlayerId = null;
        return;
    }

    // BUY: Subtract player's price from remaining budget
    fantasyTeam.remainingBudget = parseFloat((fantasyTeam.remainingBudget - player.price).toFixed(1));

    // Add player
    fantasyTeam.players.push(pendingBuyPlayerId);

    // Set first player as captain by default
    if (fantasyTeam.players.length === 1) {
        fantasyTeam.captainId = pendingBuyPlayerId;
    }

    console.log(`💰 Bought ${player.name} for ${player.price}M. Bank: ${fantasyTeam.remainingBudget.toFixed(1)}M`);

    // Close modal and reset
    closeModal('buyPlayerModal');
    pendingBuyPlayerId = null;

    // Update UI
    renderFantasyPlayersList();
    renderSelectedTeam();
    updateFantasyBudget();
    updateSaveButtonState();

    showAlert(`✅ ${player.name} куплен!`, 'success');
}

// Make confirmBuyPlayer globally available
window.confirmBuyPlayer = confirmBuyPlayer;


// Store pending sell player ID for modal confirmation
let pendingSellPlayerId = null;

function removeFantasyPlayer(playerId) {
    if (checkTransferDeadline()) {
        showAlert('Трансферы закрыты!', 'error');
        return;
    }

    // 1. Find player in FANTASY_PLAYERS or PLAYERS_DATA to get CURRENT price
    const numericId = parseInt(playerId);
    const stringId = String(playerId);

    let player = FANTASY_PLAYERS.find(p =>
        p.id === numericId ||
        p.id === playerId ||
        String(p.id) === stringId
    );

    // If not found in FANTASY_PLAYERS, try PLAYERS_DATA (string IDs)
    if (!player && typeof PLAYERS_DATA !== 'undefined') {
        player = PLAYERS_DATA.find(p =>
            p.id === stringId ||
            p.id === playerId
        );
    }

    if (!player) {
        console.warn(`⚠️ removeFantasyPlayer: Player not found for ID "${playerId}"`);
        // Still remove from array even if price unknown
        fantasyTeam.players = fantasyTeam.players.filter(id => id !== playerId);
        renderFantasyPlayersList();
        renderSelectedTeam();
        updateFantasyBudget();
        updateSaveButtonState();
        return;
    }

    // 2. Store player ID and show custom modal instead of browser confirm
    pendingSellPlayerId = playerId;

    // Update modal content
    document.getElementById('sellPlayerName').textContent = player.name;
    document.getElementById('sellPlayerPrice').textContent = player.price.toFixed(1);

    // Set team color for icon
    const iconEl = document.getElementById('sellPlayerIcon');
    if (player.team === 'A' || player.team === '1 группа') {
        iconEl.style.background = 'linear-gradient(135deg, #ff4444 0%, #ff6666 100%)';
    } else {
        iconEl.style.background = 'linear-gradient(135deg, #4a9eff 0%, #6bb0ff 100%)';
    }

    // Open the modal and RETURN - actual sale happens in confirmSellPlayer()
    openModal('sellPlayerModal');
}


/**
 * Called when user confirms the sale in the modal
 */
function confirmSellPlayer() {
    if (!pendingSellPlayerId) return;

    const playerId = pendingSellPlayerId;
    pendingSellPlayerId = null;

    // Close modal first
    closeModal('sellPlayerModal');

    // Find player again to get price
    const numericId = parseInt(playerId);
    const stringId = String(playerId);

    let player = FANTASY_PLAYERS.find(p =>
        p.id === numericId ||
        p.id === playerId ||
        String(p.id) === stringId
    );

    if (!player && typeof PLAYERS_DATA !== 'undefined') {
        player = PLAYERS_DATA.find(p =>
            p.id === stringId ||
            p.id === playerId
        );
    }

    // SELL: Add player's CURRENT price back to remaining budget
    if (player) {
        fantasyTeam.remainingBudget = parseFloat((fantasyTeam.remainingBudget + player.price).toFixed(1));
        console.log(`💰 Sold ${player.name} for ${player.price}M. Bank: ${fantasyTeam.remainingBudget}M`);
        showAlert(`${player.name} продан за ${player.price} млн!`, 'success');
    }

    // Remove player from squad
    fantasyTeam.players = fantasyTeam.players.filter(id => id !== playerId);

    // Reset captain if removed
    if (fantasyTeam.captainId === playerId) {
        fantasyTeam.captainId = fantasyTeam.players[0] || null;
    }

    // Reset vice-captain if removed
    if (fantasyTeam.viceCaptainId === playerId) {
        fantasyTeam.viceCaptainId = null;
    }

    // Update UI
    renderFantasyPlayersList();
    renderSelectedTeam();
    updateFantasyBudget();
    updateSaveButtonState();
}

// Make confirmSellPlayer globally accessible
window.confirmSellPlayer = confirmSellPlayer;


function setCaptain(playerId) {
    if (!fantasyTeam.players.includes(playerId)) return;

    if (checkTransferDeadline()) {
        showAlert('Трансферное окно закрыто! Капитана менять нельзя.', 'warning');
        return;
    }

    // If setting new captain on current vice-captain, swap them
    if (fantasyTeam.viceCaptainId === playerId) {
        fantasyTeam.viceCaptainId = fantasyTeam.captainId;
    }

    fantasyTeam.captainId = playerId;
    renderSelectedTeam();
}

function setViceCaptain(playerId) {
    if (!fantasyTeam.players.includes(playerId)) return;

    if (checkTransferDeadline()) {
        showAlert('Трансферное окно закрыто! Вайс-капитана менять нельзя.', 'warning');
        return;
    }

    // Cannot be same as captain
    if (fantasyTeam.captainId === playerId) {
        showAlert('Выберите другого игрока. Капитан и вайс-капитан должны быть разными.', 'warning');
        return;
    }

    fantasyTeam.viceCaptainId = playerId;
    renderSelectedTeam();
}

function calculateSpentBudget() {
    return fantasyTeam.players.reduce((total, playerId) => {
        // Convert to number for comparison (Firebase may store as string)
        const numericId = parseInt(playerId);
        const player = FANTASY_PLAYERS.find(p => p.id === numericId);
        return total + (player ? player.price : 0);
    }, 0);
}

// ===================================
// FANTASY UI RENDERING (Simplified)
// ===================================

function renderFantasyPlayersList() {
    console.log('🎨 Rendering fantasy players list...');

    const container = document.getElementById('fantasyPlayersList');
    if (!container) {
        console.error('❌ Element #fantasyPlayersList not found!');
        return;
    }

    // Filter players by position
    let filteredPlayers = FANTASY_PLAYERS;
    if (fantasyCurrentFilter && fantasyCurrentFilter !== 'ALL') {
        filteredPlayers = FANTASY_PLAYERS.filter(p => p.position === fantasyCurrentFilter);
        console.log(`🔍 Filtered to ${filteredPlayers.length} ${fantasyCurrentFilter} players`);
    }

    // Sort by price descending
    filteredPlayers.sort((a, b) => b.price - a.price);

    // Check if we have players to show
    if (filteredPlayers.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Нет игроков в этой позиции</p>';
        return;
    }

    // If transfer window is locked, show message instead of player cards
    if (checkTransferDeadline()) {
        container.innerHTML = `
            <div class="transfer-locked-message" style="text-align: center; padding: 30px; color: #ff9800;">
                <div style="font-size: 3rem; margin-bottom: 15px;">🔒</div>
                <h3>Трансферное окно закрыто</h3>
                <p>Изменения состава будут доступны после завершения текущего тура.</p>
            </div>
        `;
        return;
    }

    // Render each player
    const playersHTML = filteredPlayers.map(player => {
        const isSelected = fantasyTeam.players.includes(player.id);
        // Use remainingBudget for affordability check
        const canAfford = fantasyTeam.remainingBudget >= player.price || isSelected;
        const teamFull = fantasyTeam.players.length >= FANTASY_CONFIG.maxPlayers && !isSelected;
        const isDisabled = !canAfford || teamFull;

        // Only add onclick if not disabled, or if already selected (to allow selling)
        // Wrap player.id in quotes since IDs can be strings like "alisher_a"
        const clickHandler = (isDisabled && !isSelected) ? '' : `onclick="selectFantasyPlayer('${player.id}')"`;

        return `
            <div class="fpl-player-card ${isSelected ? 'selected' : ''} ${isDisabled && !isSelected ? 'disabled' : ''}" 
                 ${clickHandler}>
                <div class="fpl-card-header">
                    <span class="fpl-position-badge ${player.position}">${player.position}</span>
                    <span class="fpl-price-badge">${player.price.toFixed(1)}</span>
                </div>
                <div class="fpl-card-body">
                    <div class="fpl-jersey team-${player.team}">👕</div>
                    <div class="fpl-player-name">${player.name}</div>
                    <div class="fpl-team-name">${player.team === 'A' ? '1 группа' : '2 группа'}</div>
                </div>
                ${isSelected ? '<div class="fpl-selected-overlay">✔</div>' : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = playersHTML;
    console.log(`✅ Rendered ${filteredPlayers.length} players, remainingBudget: ${fantasyTeam.remainingBudget}`);
}

function getPositionEmoji(position) {
    const emojis = {
        'GK': '🧤',
        'DEF': '🛡️',
        'MID': '⚡',
        'FWD': '⚽'
    };
    return emojis[position] || '👤';
}

async function renderSelectedTeam(pointsMap = null) {
    const container = document.getElementById('fantasySelectedPlayers');
    if (!container) return;

    // Use Global Map for Hydration
    const playerMap = await window.getGlobalPlayerMap();

    // Generate pitch-style rows
    let row1 = ''; // First player (GK usually, but here 1st slot)
    let row2 = ''; // Second and third players

    // 2. Бежим по игрокам команды
    for (let index = 0; index < FANTASY_CONFIG.maxPlayers; index++) {
        let p = fantasyTeam.players[index];
        console.log(`🔍 Processing Player ${index}:`, p);

        let playerId = null;
        let historyPoints = null;

        // --- ЛОГИКА ПОИСКА ID (ДЕТЕКТИВ) ---
        if (p) {
            if (typeof p === 'string') {
                // Случай А: Это просто ID (Live режим)
                playerId = p;
            } else if (typeof p === 'object' && p !== null) {
                // Случай Б: Это объект (История)
                // Проверяем все возможные варианты названия поля ID
                playerId = p.id || p.playerId || p.player_id || p.uid;

                // Пытаемся достать очки
                if (p.points !== undefined) historyPoints = p.points;
                if (p.roundPoints !== undefined) historyPoints = p.roundPoints;
            }
        }

        // --- НОРМАЛИЗАЦИЯ ID ---
        // Если ID всё еще нет, или он странный - чистим его
        if (playerId && typeof playerId === 'string') {
            playerId = playerId.trim().toLowerCase(); // Приводим к формату базы
        }

        // --- ПОИСК В БАЗЕ ---
        let playerData = null;
        if (playerId) {
            playerData = playerMap.get(playerId);
        }

        // ПОПЫТКА СПАСЕНИЯ: Если по ID не нашли, ищем по Имени (если оно сохранилось в истории)
        if (!playerData && p && typeof p === 'object' && p.name) {
            console.warn(`⚠️ Поиск по ID (${playerId}) не дал результата. Ищем по имени: ${p.name}`);
            for (let [key, val] of playerMap) {
                if (val.name === p.name || val.appName === p.name) {
                    playerData = val;
                    playerId = key; // Нашли настоящий ID!
                    break;
                }
            }
        }

        // --- ОТОБРАЖЕНИЕ (РЕНДЕР) ---
        let slotHtml = '';

        if (playerData || (p && (typeof p === 'string' || (typeof p === 'object' && p.name)))) {
            // Если всё еще Unknown - ставим заглушку, но красивую
            const displayName = playerData ? (playerData.appName || playerData.name) : ((p && p.name) || "Unknown");
            const displayPos = playerData ? playerData.position : "??";
            // Determine kit or jersey image
            // Existing logic uses team_a/team_b.png based on team name
            let jerseyImage = 'assets/jerseys/team_b.png'; // Default
            if (playerData && playerData.team) {
                jerseyImage = playerData.team.includes('1') ? 'assets/jerseys/team_a.png' : 'assets/jerseys/team_b.png';
            }

            // Очки: Берем из истории, если есть. Если нет - берем 0 (для истории это правильнее, чем live очки)
            // Also check pointsMap (Live Mode) if historyPoints is null
            let displayPoints = historyPoints !== null ? historyPoints : 0;

            if (historyPoints === null && pointsMap) {
                if (playerId && pointsMap[playerId] !== undefined) {
                    displayPoints = pointsMap[playerId];
                }
            }

            console.log(`✅ Result for ${index}: Name=${displayName}, ID=${playerId}, Points=${displayPoints}`);

            // Captain Logic
            const isCaptain = (fantasyTeam.captainId === playerId || (playerData && fantasyTeam.captainId === playerData.id));
            if (isCaptain) displayPoints *= 2;

            // Check Locked (for actions)
            const isLocked = checkTransferDeadline();

            // --- HTML ГЕНЕРАЦИЯ (Сlass-Based) ---
            slotHtml = `
                <div class="pitch-player-slot ${isCaptain ? 'captain' : ''}">
                    
                    <div class="live-points-badge ${displayPoints < 0 ? 'negative' : ''}">
                        ${displayPoints > 0 ? '+' + displayPoints : displayPoints}
                    </div>

                    <div class="player-kit">
                        <img src="${jerseyImage}" class="player-jersey-img" alt="Jersey">
                    </div>

                    <div class="player-info">
                        <div class="player-name">${displayName}</div>
                        <div class="player-pos">${displayPos}</div>
                    </div>
                    
                    ${isCaptain ? '<div class="captain-badge">👑</div>' : ''}
                    
                    <div class="player-slot-actions">
                         ${!isLocked && !isCaptain && playerId ? `
                            <button class="slot-action-btn" onclick="event.stopPropagation(); setCaptain('${playerId}')" title="Капитан">C</button>
                         ` : ''}
                         ${!isLocked && playerId ? `
                            <button class="slot-action-btn remove" onclick="event.stopPropagation(); removeFantasyPlayer('${playerId}')" title="Удалить">✕</button>
                         ` : ''}
                    </div>
                </div>
            `;
        }

        if (!slotHtml) {
            slotHtml = `
                    <div class="pitch-player-slot empty">
                        <div class="player-jersey-placeholder">+</div>
                        <div class="player-slot-name">Пусто</div>
                    </div>
                `;
        }

        const pitchContainer = container;

        if (pitchContainer) {
            if (index === 0) pitchContainer.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.className = 'pitch-player-slot-dynamic';
            wrapper.innerHTML = slotHtml;
            pitchContainer.appendChild(wrapper);
        }
    }
}
// REMOVED: container.innerHTML = ... row1/row2 logic
// because we are now appending directly in the loop.


function updateFantasyBudget() {
    const budgetValueEl = document.getElementById('fantasyBudgetRemaining');
    const budgetBarEl = document.getElementById('fantasyBudgetBar');
    const teamValueEl = document.getElementById('fantasyTeamValue');

    // Calculate current values
    const bank = fantasyTeam.remainingBudget !== null ? fantasyTeam.remainingBudget : 0;
    const teamValue = calculateTeamValue();

    // Update Bank display
    if (budgetValueEl) {
        budgetValueEl.textContent = bank.toFixed(1);

        // Color coding: Green if >= 0, Red if < 0
        if (bank < 0) {
            budgetValueEl.classList.add('over-budget');
            budgetValueEl.style.color = '#ef4444'; // Red
        } else {
            budgetValueEl.classList.remove('over-budget');
            budgetValueEl.style.color = '#22c55e'; // Green
        }
    }

    // Update Team Value display (if element exists)
    if (teamValueEl) {
        teamValueEl.textContent = teamValue.toFixed(1);
    }

    // Update budget bar (visual indicator)
    if (budgetBarEl) {
        // Bar shows team value as a percentage of total purchasing power
        const totalPower = teamValue + Math.max(0, bank);
        const percentage = totalPower > 0 ? (teamValue / totalPower) * 100 : 0;
        budgetBarEl.style.width = `${Math.min(100, percentage)}%`;

        if (bank < 0) {
            budgetBarEl.classList.add('over-budget');
        } else {
            budgetBarEl.classList.remove('over-budget');
        }
    }
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById('saveFantasyTeam');
    if (!saveBtn) return;

    const isValidTeam = fantasyTeam.players.length === FANTASY_CONFIG.maxPlayers;
    const isWithinBudget = fantasyTeam.remainingBudget >= 0; // Use remainingBudget instead of fixed budget
    const hasCaptain = fantasyTeam.captainId !== null;
    const isLocked = checkTransferDeadline();

    if (isLocked) {
        saveBtn.disabled = true;
        saveBtn.textContent = '🔒 Тур идет (Изменения закрыты)';
    } else if (!isWithinBudget) {
        saveBtn.disabled = true;
        saveBtn.textContent = '❌ Недостаточно средств';
    } else if (!isValidTeam) {
        saveBtn.disabled = true;
        saveBtn.textContent = `⚠️ Выберите ${FANTASY_CONFIG.maxPlayers} игроков`;
    } else if (!hasCaptain) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⚠️ Выберите капитана';
    } else {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Сохранить команду';
    }
}


// ===================================
// FANTASY POINT CALCULATION
// ===================================

/**
 * Calculate fantasy points for a player
 * @param {Object} stats - Player statistics { goals: number, assists: number, isMVP: boolean }
 * @param {number} userRating - Average user rating (1-10)
 * @param {boolean} isCaptain - Whether the player is captain (x2 multiplier)
 * @returns {Object} - { total: number, breakdown: { goals, assists, mvp, rating } }
 */
function calculateFantasyPoints(stats, userRating, isCaptain = false) {
    let points = 0;
    const breakdown = {
        goals: 0,
        assists: 0,
        mvp: 0,
        rating: 0
    };

    // Goals: +3 per goal
    if (stats.goals) {
        breakdown.goals = stats.goals * 3;
        points += breakdown.goals;
    }

    // Assists: +2 per assist
    if (stats.assists) {
        breakdown.assists = stats.assists * 2;
        points += breakdown.assists;
    }

    // MVP: +3
    if (stats.isMVP) {
        breakdown.mvp = 3;
        points += breakdown.mvp;
    }

    // Rating Bonus
    if (userRating >= 9.0) {
        breakdown.rating = 5;
    } else if (userRating >= 8.0) {
        breakdown.rating = 3;
    } else if (userRating >= 7.0) {
        breakdown.rating = 1;
    } else if (userRating < 6.0) {
        breakdown.rating = -1;
    }
    points += breakdown.rating;

    // Captain multiplier (x2)
    if (isCaptain) {
        points *= 2;
    }

    return {
        total: points,
        breakdown,
        isCaptain
    };
}

/**
 * Get rating color class based on FotMob style
 * @param {number} rating - Rating from 1-10
 * @returns {string} - CSS class for color
 */
function getRatingColorClass(rating) {
    if (rating >= 9.0) return 'rating-blue';
    if (rating >= 8.0) return 'rating-green';
    if (rating >= 6.0) return 'rating-orange';
    return 'rating-red';
}

// ===================================
// FANTASY RESULTS RENDERING
// ===================================

async function renderFantasyResults() {
    const container = document.getElementById('fantasyResults');
    if (!container) return;

    // Show loading
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⏳</div>
            <h3>Загрузка...</h3>
        </div>
    `;

    try {
        // Fetch all completed gameweeks (remove orderBy to avoid filtering docs without 'number')
        const gwSnapshot = await db.collection('gameweeks').get();

        if (gwSnapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>Результатов пока нет</h3>
                    <p>Туры еще не созданы</p>
                </div>
            `;
            return;
        }

        // Sort manually by number or ID
        const docs = gwSnapshot.docs.sort((a, b) => {
            const numA = a.data().number || 0;
            const numB = b.data().number || 0;
            return numA - numB;
        });

        // Build gameweek selector
        let selectorHtml = '<div class="gw-selector">';
        docs.forEach((doc, index) => {
            const data = doc.data();
            // Fallback for number: try to parse from ID (gw1 -> 1)
            let gwNum = data.number;
            if (!gwNum && doc.id.startsWith('gw')) {
                gwNum = parseInt(doc.id.replace('gw', ''));
            }
            gwNum = gwNum || (index + 1);

            const isFirst = index === 0;
            selectorHtml += `
                <button class="gw-btn ${isFirst ? 'active' : ''}" 
                        data-gwid="${doc.id}" 
                        onclick="loadGameweekResults('${doc.id}', this)">
                    Тур ${gwNum}
                </button>
            `;
        });
        selectorHtml += '</div>';

        // Add results container
        container.innerHTML = selectorHtml + '<div id="gwResultsTable"></div>';

        // Load first gameweek by default
        if (docs.length > 0) {
            loadGameweekResults(docs[0].id);
        }

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Load results for a specific gameweek
async function loadGameweekResults(gwId, clickedBtn = null) {
    const tableContainer = document.getElementById('gwResultsTable');
    if (!tableContainer) return;

    // Update active button
    if (clickedBtn) {
        document.querySelectorAll('.gw-btn').forEach(btn => btn.classList.remove('active'));
        clickedBtn.classList.add('active');
    }

    tableContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Загрузка статистики...</div>';

    try {
        // Fetch player stats for this gameweek
        const statsSnapshot = await db.collection('match_stats')
            .doc(gwId)
            .collection('players')
            .get();

        if (statsSnapshot.empty) {
            tableContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Нет данных для этого тура</div>';
            return;
        }

        // Collect all stats
        const playerStats = [];
        for (const doc of statsSnapshot.docs) {
            const data = doc.data();

            // Get player info from players collection
            let playerName = data.playerName || 'Unknown';
            let position = data.position || '?';

            if (data.playerId) {
                try {
                    const playerDoc = await db.collection('players').doc(data.playerId).get();
                    if (playerDoc.exists) {
                        const pData = playerDoc.data();
                        playerName = pData.name || playerName;
                        position = pData.position || position;
                    }
                } catch (e) { /* use fallback */ }
            }

            playerStats.push({
                name: playerName,
                position: position,
                goals: data.goals || 0,
                assists: data.assists || 0,
                isMVP: data.isMVP || false,
                statsPoints: data.statsPoints || 0,
                mvpBonus: data.mvpBonus || 0,
                ratingBonus: data.ratingBonus || 0,
                averageRating: data.averageRating || 6.0,
                totalPoints: data.totalPoints || 0,
                played: data.played || false
            });
        }

        // Sort by total points descending
        playerStats.sort((a, b) => b.totalPoints - a.totalPoints);

        // Render table
        renderResultsTable(tableContainer, playerStats);

    } catch (error) {
        console.error('Error loading gameweek results:', error);
        tableContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #ef4444;">Ошибка: ${error.message}</div>`;
    }
}

// Render the results table
function renderResultsTable(container, stats) {
    if (stats.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Нет статистики</div>';
        return;
    }

    let html = `
        <div class="results-table-wrapper">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Игрок</th>
                        <th>⚽</th>
                        <th>🅰️</th>
                        <th>⭐</th>
                        <th>📊</th>
                        <th class="formula-cell">Формула</th>
                        <th>Итого</th>
                    </tr>
                </thead>
                <tbody>
    `;

    stats.forEach(player => {
        if (!player.played) return; // Skip players who didn't play

        const mvpIcon = player.isMVP ? '⭐' : '';
        const totalClass = player.totalPoints > 0 ? 'positive' : (player.totalPoints < 0 ? 'negative' : 'zero');
        const rowClass = player.isMVP ? 'mvp-row' : '';

        // Build formula string
        let formulaParts = [];
        if (player.goals > 0) formulaParts.push(`${player.goals}G×3`);
        if (player.assists > 0) formulaParts.push(`${player.assists}A×2`);
        if (player.mvpBonus > 0) formulaParts.push(`MVP+${player.mvpBonus}`);
        if (player.ratingBonus !== 0) {
            const sign = player.ratingBonus > 0 ? '+' : '';
            formulaParts.push(`R${sign}${player.ratingBonus}`);
        }
        const formula = formulaParts.length > 0 ? formulaParts.join(' ') : '0';

        html += `
            <tr class="${rowClass}">
                <td>
                    <div class="player-info-cell">
                        <span class="player-pos-badge ${player.position}">${player.position}</span>
                        <span class="player-name-cell">${player.name}</span>
                    </div>
                </td>
                <td class="stat-cell goals">${player.goals || '-'}</td>
                <td class="stat-cell assists">${player.assists || '-'}</td>
                <td class="stat-cell mvp">${mvpIcon}</td>
                <td class="stat-cell">${player.averageRating.toFixed(1)}</td>
                <td class="formula-cell">${formula}</td>
                <td class="total-cell ${totalClass}">${player.totalPoints}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Make functions globally available
window.loadGameweekResults = loadGameweekResults;
window.renderResultsTable = renderResultsTable;

// ===================================
// FANTASY LEADERBOARD
// ===================================

async function renderFantasyLeaderboard() {
    const container = document.getElementById('fantasyLeaderboard');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <tr>
            <td colspan="4" class="text-center" style="padding: 1rem;">
                Загрузка...
            </td>
        </tr>
    `;

    // This flag would be set based on match completion status
    const isRoundComplete = false; // Set to true after match is played

    try {
        // Fetch all teams from Firebase
        const snapshot = await db.collection('fantasyTeams').get();

        const leaderboardData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            leaderboardData.push({
                id: doc.id,
                manager: data.managerName || data.userEmail?.split('@')[0] || 'Аноним',
                players: data.players || [],
                captainId: data.captainId,
                weekPoints: data.weekPoints || 0, // Will be calculated after match
                totalPoints: data.totalPoints || 0
            });
        });

        // Sort by total points
        leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

        if (leaderboardData.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted" style="padding: 2rem;">
                        <div class="empty-state-icon">🏆</div>
                        <p>Таблица лидеров пока пуста.</p>
                        <p style="font-size: 0.8rem;">Сохраните свою команду, чтобы участвовать!</p>
                    </td>
                </tr>
            `;
            return;
        }

        const myName = fantasyTeam.managerName || currentUser?.email?.split('@')[0] || 'Вы';

        container.innerHTML = leaderboardData.map((entry, index) => `
            <tr class="leaderboard-row ${entry.manager === myName ? 'highlight-row' : ''} ${isRoundComplete ? 'clickable' : ''}" 
                ${isRoundComplete ? `onclick="viewTeamSquad('${entry.id}', '${entry.manager}')"` : ''}>
                <td>${index + 1}</td>
                <td class="team-name">
                    ${entry.manager}
                    ${isRoundComplete ? '<span class="view-hint">👁</span>' : ''}
                </td>
                <td class="text-center">${entry.weekPoints}</td>
                <td class="text-center points">${entry.totalPoints}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        container.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted" style="padding: 2rem;">
                    Ошибка загрузки. Попробуйте позже.
                </td>
            </tr>
        `;
    }
}

// View another manager's team squad (only after round is complete)
window.viewTeamSquad = async function (managerId, managerName) {
    const modal = document.getElementById('teamViewModal');
    if (!modal) return;

    document.getElementById('viewManagerName').textContent = managerName;
    document.getElementById('viewTeamSquad').innerHTML = `
        <div class="empty-state">
            <p>Загрузка состава...</p>
        </div>
    `;
    openModal('teamViewModal');

    try {
        // Fetch team data from Firebase
        const doc = await db.collection('fantasyTeams').doc(managerId).get();

        if (!doc.exists) {
            document.getElementById('viewTeamSquad').innerHTML = `
                <div class="empty-state">
                    <p>Команда не найдена</p>
                </div>
            `;
            return;
        }

        const teamData = doc.data();
        const players = teamData.players || [];
        const captainId = teamData.captainId;

        // Render team squad
        const squadHtml = players.map(playerId => {
            const player = FANTASY_PLAYERS.find(p => p.id === playerId);
            if (!player) return '';

            const isCaptain = captainId === playerId;
            return `
                <div class="team-view-player ${isCaptain ? 'captain' : ''}">
                    <span class="player-emoji">${getPositionEmoji(player.position)}</span>
                    <div class="player-info">
                        <div class="player-name">${player.name}</div>
                        <div class="player-pos">${player.position}</div>
                    </div>
                    ${isCaptain ? '<span class="captain-badge">C</span>' : ''}
                </div>
            `;
        }).join('');

        document.getElementById('viewTeamSquad').innerHTML = squadHtml || '<p class="text-center text-muted">Команда пуста</p>';

    } catch (error) {
        console.error('Error loading team:', error);
        document.getElementById('viewTeamSquad').innerHTML = `
            <div class="empty-state">
                <p>Ошибка загрузки команды</p>
            </div>
        `;
    }
};

// ===================================
// FANTASY SAVE/LOAD
// ===================================

async function saveFantasyTeam() {
    if (!currentUser) {
        showAlert('Войдите для сохранения команды', 'error');
        openModal('authModal');
        return;
    }

    if (checkTransferDeadline()) {
        showAlert('Трансферы закрыты!', 'error');
        return;
    }

    if (fantasyTeam.players.length !== FANTASY_CONFIG.maxPlayers) {
        showAlert(`Выберите ${FANTASY_CONFIG.maxPlayers} игроков (Выбрано: ${fantasyTeam.players.length})`, 'error');
        return;
    }

    // NEW: Check remainingBudget instead of fixed budget
    if (fantasyTeam.remainingBudget < 0) {
        showAlert('Недостаточно средств! Продайте игроков.', 'error');
        return;
    }

    if (!fantasyTeam.captainId) {
        showAlert('Выберите капитана (C)', 'error');
        return;
    }

    try {
        const currentGw = window.currentGameweekId || 'gw1';
        const teamValue = calculateTeamValue();

        // NEW: Flat structure - no nested squads.gwX
        // The snapshot_squads.js script will copy this to locked collection at deadline
        await db.collection('fantasyTeams').doc(currentUser.uid).set({
            // Core squad data (flat)
            players: fantasyTeam.players,
            captainId: fantasyTeam.captainId,
            viceCaptainId: fantasyTeam.viceCaptainId || null,

            // Coach selection
            coachId: document.getElementById('fantasyCoachSelect')?.value || null,

            // NEW: Save dynamic budget data
            remainingBudget: fantasyTeam.remainingBudget,
            teamValue: teamValue,
            totalBudget: teamValue + fantasyTeam.remainingBudget, // Total purchasing power

            // Meta
            managerName: fantasyTeam.managerName || currentUser.email.split('@')[0],
            userEmail: currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),

            // Also save to legacy nested structure for backwards compatibility
            squads: {
                [currentGw]: {
                    players: fantasyTeam.players,
                    captainId: fantasyTeam.captainId,
                    viceCaptainId: fantasyTeam.viceCaptainId || null,
                    remainingBudget: fantasyTeam.remainingBudget,
                    savedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            }
        }, { merge: true });

        // Update local storage
        localStorage.setItem('fantasyTeam', JSON.stringify(fantasyTeam));

        console.log(`💾 Saved team. Bank: ${fantasyTeam.remainingBudget.toFixed(1)}M, Team Value: ${teamValue.toFixed(1)}M`);

        // Show success confirmation modal
        showSaveConfirmation(true, 'Ваша команда успешно сохранена!');
    } catch (error) {
        console.error('Error saving fantasy team:', error);
        // Show error confirmation modal
        showSaveConfirmation(false, 'Произошла ошибка при сохранении. Попробуйте ещё раз.');
    }
}


// Show Save Confirmation Modal
function showSaveConfirmation(isSuccess, message) {
    const modal = document.getElementById('saveConfirmModal');
    const titleEl = document.getElementById('saveConfirmTitle');
    const iconEl = document.getElementById('saveConfirmIcon');
    const messageEl = document.getElementById('saveConfirmMessage');

    if (!modal || !titleEl || !iconEl || !messageEl) {
        // Fallback to showAlert if modal elements not found
        showAlert(message, isSuccess ? 'success' : 'error');
        return;
    }

    if (isSuccess) {
        modal.classList.remove('error');
        titleEl.textContent = '✅ Команда сохранена!';
        iconEl.textContent = '✅';
        messageEl.textContent = message;
    } else {
        modal.classList.add('error');
        titleEl.textContent = '❌ Ошибка сохранения';
        iconEl.textContent = '❌';
        messageEl.textContent = message;
    }

    openModal('saveConfirmModal');
}

async function loadFantasyTeam() {
    console.log('📥 loadFantasyTeam called, currentUser:', currentUser?.email || 'null');

    // 0. Prepare Normalizer
    const playerMap = await window.getGlobalPlayerMap();
    const normalizeId = (id) => {
        if (!id) return null;
        const p = playerMap.get(id);
        return p ? p.id : id; // Return canonical String ID if found
    };

    let loadedRemainingBudget = null;

    // Try localStorage first
    const savedTeam = localStorage.getItem('fantasyTeam');
    if (savedTeam) {
        try {
            const parsed = JSON.parse(savedTeam);
            // Normalize localStorage data too
            fantasyTeam.players = (parsed.players || []).map(normalizeId);
            fantasyTeam.captainId = normalizeId(parsed.captainId);
            fantasyTeam.viceCaptainId = normalizeId(parsed.viceCaptainId);
            loadedRemainingBudget = parsed.remainingBudget;
            console.log('📥 Loaded from localStorage:', fantasyTeam.players);
        } catch (e) {
            console.error('Error parsing saved team:', e);
        }
    }

    // If user is logged in, try Firebase (Source of Truth)
    if (currentUser && typeof db !== 'undefined') {
        try {
            console.log('📥 Loading from Firebase for uid:', currentUser.uid);
            const doc = await db.collection('fantasyTeams').doc(currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                console.log('📥 Firebase data (raw):', data);

                const rawPlayers = data.players || [];

                // SMART MERGE: Only overwrite if Firebase has valid data
                if (rawPlayers.length > 0) {
                    // Firebase has save data - use it (it's the source of truth)
                    fantasyTeam.players = rawPlayers.map(normalizeId);
                    fantasyTeam.captainId = normalizeId(data.captainId);
                    fantasyTeam.viceCaptainId = normalizeId(data.viceCaptainId);

                    // Load remainingBudget from Firestore
                    if (data.remainingBudget !== undefined && data.remainingBudget !== null) {
                        loadedRemainingBudget = data.remainingBudget;
                        console.log('📥 Loaded remainingBudget from Firebase:', loadedRemainingBudget);
                    }

                    // Load coachId and restore UI
                    if (data.coachId) {
                        fantasyTeam.coachId = data.coachId;
                        const coachSelect = document.getElementById('fantasyCoachSelect');
                        if (coachSelect) coachSelect.value = data.coachId;
                        console.log('📥 Loaded coachId from Firebase:', data.coachId);
                    }

                    console.log('📥 Loaded & Normalized from Firebase:', fantasyTeam.players);
                } else {
                    // Firebase is empty - keep local draft if it exists
                    console.log('📥 Firebase has empty squad. Keeping local draft:', fantasyTeam.players);
                }
            } else {
                console.log('📥 No saved team found in Firebase. Keeping local draft:', fantasyTeam.players);
            }
        } catch (error) {
            console.error('Error loading fantasy team from Firebase:', error);
        }
    } else {
        console.log('📥 Skipping Firebase load - no user or db');
    }

    // *** CRITICAL FIX: Always calculate team value AFTER players are loaded ***
    const currentTeamValue = calculateTeamValue();
    console.log('📥 Calculated Team Value:', currentTeamValue, 'from players:', fantasyTeam.players);

    // *** SIMPLE BUDGET LOGIC ***
    // bank = 18.0 - teamValue, if negative then 0
    const DEFAULT_BUDGET = FANTASY_TEAM_CONFIG.budget; // 18.0

    if (fantasyTeam.players.length > 0 && currentTeamValue > 0) {
        // Calculate bank from team value
        let calculatedBank = DEFAULT_BUDGET - currentTeamValue;

        // If negative (players appreciated), cap at 0
        if (calculatedBank < 0) {
            calculatedBank = 0;
            console.log('📥 Team value exceeds budget, capping bank at 0');
        }

        fantasyTeam.remainingBudget = parseFloat(calculatedBank.toFixed(1));
        console.log('📥 Calculated remainingBudget:', fantasyTeam.remainingBudget);
    } else {
        // New user with no team: give full budget
        fantasyTeam.remainingBudget = DEFAULT_BUDGET;
        console.log('📥 New user, starting with full budget:', DEFAULT_BUDGET);
    }

    // Save normalized state back to localStorage
    localStorage.setItem('fantasyTeam', JSON.stringify(fantasyTeam));
    console.log('📥 Final fantasyTeam.players:', fantasyTeam.players, 'remainingBudget:', fantasyTeam.remainingBudget, 'teamValue:', currentTeamValue);
}



/**
 * Calculate the current team value based on CURRENT player prices.
 * Uses the latest prices from FANTASY_PLAYERS or PLAYERS_DATA.
 * Handles both numeric IDs (legacy) and string IDs (new format).
 */
function calculateTeamValue() {
    let total = 0;

    console.log('🧮 calculateTeamValue called with players:', fantasyTeam.players);
    console.log('🧮 FANTASY_PLAYERS available:', FANTASY_PLAYERS.map(p => ({ id: p.id, price: p.price })));

    fantasyTeam.players.forEach(playerId => {
        if (!playerId) return;

        const numericId = parseInt(playerId);
        const stringId = String(playerId);

        console.log(`🔍 Looking for player: "${playerId}" (stringId: "${stringId}", numericId: ${numericId})`);

        // First try FANTASY_PLAYERS
        let player = FANTASY_PLAYERS.find(p =>
            p.id === numericId ||
            p.id === playerId ||
            String(p.id) === stringId
        );

        // If not found, try PLAYERS_DATA (string IDs like "asan_t")
        if (!player && typeof PLAYERS_DATA !== 'undefined') {
            player = PLAYERS_DATA.find(p =>
                p.id === stringId ||
                p.id === playerId
            );
            if (player) console.log(`✅ Found in PLAYERS_DATA: ${player.name} = ${player.price}`);
        } else if (player) {
            console.log(`✅ Found in FANTASY_PLAYERS: ${player.name} = ${player.price}`);
        }

        if (player) {
            total += player.price;
        } else {
            console.warn(`❌ Player NOT FOUND for ID "${playerId}"`);
        }
    });

    console.log(`🧮 Total team value: ${total}`);

    // Round to 1 decimal place to avoid floating-point issues
    return parseFloat(total.toFixed(1));
}




// Make fantasy functions globally accessible
window.selectFantasyPlayer = selectFantasyPlayer;
window.removeFantasyPlayer = removeFantasyPlayer;
window.setCaptain = setCaptain;
window.setViceCaptain = setViceCaptain;
window.openRatingModal = openRatingModal; // Expose for testing/admin
window.loadGameweekStats = loadGameweekStats; // Explicitly expose for Tab Switching
window.renderSelectedTeam = renderSelectedTeam;


// ===================================
// RATING SYSTEM UI
// ===================================

function openRatingModal() {
    renderRatingPlayers();
    openModal('ratingModal');
}

function updateGameweekLabel() {
    const el = document.querySelector('.fpl-gameweek');
    if (el) {
        // Use global currentGameweekData if available, else default
        const gwNum = window.currentGameweekData?.gameweekNumber || '1';
        el.textContent = `Тур ${gwNum}`;
    }
}

function renderRatingPlayers() {
    const container = document.getElementById('ratingPlayersList');
    if (!container) return;

    // Use FANTASY_PLAYERS as the source for now
    container.innerHTML = FANTASY_PLAYERS.map(player => `
        <div class="rating-player-row">
            <div class="rating-player-info">
                <span class="rating-player-name">${player.name}</span>
                <span class="rating-player-pos">${player.position}</span>
            </div>
            <div class="rating-control">
                <div id="rating-val-${player.id}" class="rating-value-display rating-orange">6.0</div>
                <input type="range" min="1.0" max="10.0" step="0.1" value="6.0" 
                       class="rating-slider" 
                       oninput="updateRatingColor(this.value, ${player.id})">
            </div>
        </div>
    `).join('');
}

window.updateRatingColor = function (value, playerId) {
    const display = document.getElementById(`rating-val-${playerId}`);
    const floatVal = parseFloat(value);

    display.textContent = floatVal.toFixed(1);

    // Remove old classes
    display.classList.remove('rating-blue', 'rating-green', 'rating-orange', 'rating-red');

    // Add new class based on value
    if (floatVal >= 9.0) display.classList.add('rating-blue');
    else if (floatVal >= 8.0) display.classList.add('rating-green');
    else if (floatVal >= 6.0) display.classList.add('rating-orange');
    else display.classList.add('rating-red');
};

// Initialize Fantasy when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 DOM loaded, initializing Fantasy...');

    // Initialize Fantasy Football immediately
    // (No timeout needed - DOM is fully loaded)
    try {
        initFantasy();
    } catch (err) {
        console.error('❌ Failed to initialize Fantasy:', err);
    }

    // Rating Modal Events
    const closeRatingBtn = document.getElementById('closeRatingModal');
    const cancelRatingBtn = document.getElementById('cancelRating');
    const submitRatingBtn = document.getElementById('submitRating');

    if (closeRatingBtn) closeRatingBtn.addEventListener('click', () => closeModal('ratingModal'));
    if (cancelRatingBtn) cancelRatingBtn.addEventListener('click', () => closeModal('ratingModal'));

    if (submitRatingBtn) {
        submitRatingBtn.addEventListener('click', async () => {
            // Here we would collect all inputs and send to Firebase
            // For now just show success
            showAlert('Спасибо! Ваши оценки приняты.', 'success');
            closeModal('ratingModal');
        });
    }
});

// ===================================
// GAMEWEEK NAVIGATION & STATS
// ===================================

let currentViewGwNum = 1;

function setupGameweekNavigation() {
    const prevBtn = document.getElementById('prevGameweek');
    const nextBtn = document.getElementById('nextGameweek');

    // Initialize with current active gameweek
    const activeGwId = window.currentGameweekId || 'gw1';
    currentViewGwNum = parseInt(activeGwId.replace('gw', '')) || 1;
    console.log(`🧭 Init Gameweek Navigation: Start at GW${currentViewGwNum}`);

    // Load initial data (for the active week)
    loadGameweekStats(`gw${currentViewGwNum}`);

    // Remove old listeners (by cloning) to prevent duplicates if function called multiple times
    if (prevBtn) {
        const newPrev = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        newPrev.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            changeGameweek(-1);
        });
    }

    if (nextBtn) {
        const newNext = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        newNext.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            changeGameweek(1);
        });
    }
}

function changeGameweek(offset) {
    const newGwNum = currentViewGwNum + offset;
    if (newGwNum < 1) return; // Can't go below 1

    // Optional: limit upper bound if needed, e.g. current active gameweek + 1
    // For now allow browsing forward freely or limit to some reasonable max (e.g. 38)
    if (newGwNum > 38) return;

    console.log(`🧭 Navigation: ${currentViewGwNum} -> ${newGwNum}`);
    currentViewGwNum = newGwNum;
    loadGameweekStats(`gw${currentViewGwNum}`);
}

async function loadGameweekStats(gwId) {
    // 1. Synchronize state (Critical for external calls)
    const num = parseInt(gwId.replace('gw', '')) || 1;
    currentViewGwNum = num;

    const gwLabel = document.querySelector('.fpl-gameweek');
    if (gwLabel) {
        gwLabel.textContent = `Тур ${num}`;
    }

    // UI Elements
    const avgEl = document.getElementById('fplAveragePoints');
    const ptsEl = document.getElementById('fplTotalPoints');
    const highEl = document.getElementById('fplHighestPoints');

    // Reset to loading state
    if (avgEl) avgEl.textContent = '...';
    if (ptsEl) ptsEl.textContent = '...';
    if (highEl) highEl.textContent = '...';

    try {
        // 1. Fetch Global Stats from Gameweek Doc
        const gwDoc = await db.collection('gameweeks').doc(gwId).get();
        let stats = { averagePoints: 0, highestPoints: 0 };
        let isActive = false;

        if (gwDoc.exists) {
            const data = gwDoc.data();
            if (data.stats) {
                stats = data.stats;
            }
            isActive = (data.status === 'voting_open' || data.status === 'stats_entry' || data.status === 'setup');
        } else {
            isActive = true;
        }

        // 2. Fetch User Personal Points (Sync with Leaderboard)
        let myPoints = null; // Default to null (not participating)
        let snapshotSquad = null;
        let playerPointsMap = {};

        if (currentUser) {
            // A. Try fetching LIVE stats from fantasyTeams (Leaderboard source)
            try {
                const teamDoc = await db.collection('fantasyTeams').doc(currentUser.uid).get();
                if (teamDoc.exists) {
                    const tData = teamDoc.data();
                    if (gwId === 'gw1') { // TODO: dynamic check based on current active GW
                        if (tData.live_gw_points !== undefined) {
                            myPoints = tData.live_gw_points;
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching fantasyTeam:", err);
            }

            // B. Fallback/Snapshot for Pitch Rendering & Points if live failed
            const squadDoc = await db.collection('gameweeks').doc(gwId)
                .collection('squads').doc(currentUser.uid).get();
            if (squadDoc.exists) {
                const data = squadDoc.data();
                // If myPoints is still null (didn't get live stats), use snapshot
                if (myPoints === null && data.totalPoints !== undefined) {
                    myPoints = data.totalPoints;
                } else if (myPoints === null) {
                    // Squad exists but totalPoints not set? Assume 0 start.
                    myPoints = 0;
                }
                snapshotSquad = data;
            }
        }

        // 2. LIVE STATS FETCH (Frontend Mesh)
        const liveStatsMap = {};
        const liveStatsByName = {};

        try {
            const statsSnapshot = await db.collection('match_stats')
                .doc(gwId)
                .collection('players')
                .get();

            statsSnapshot.forEach(doc => {
                const data = doc.data();
                const total = (data.statsPoints || 0) + (data.mvpBonus || 0) + (data.ratingBonus || 0);
                liveStatsMap[data.playerId] = total;

                if (data.name) {
                    const clean = data.name.trim().toLowerCase();
                    liveStatsByName[clean] = total;
                }
            });
        } catch (e) {
            console.error('Error fetching live stats for UI:', e);
        }

        // Helper to get points (ID -> Name Fallback)
        const getPointsForPlayer = (pid, pName) => {
            if (liveStatsMap[pid] !== undefined) return liveStatsMap[pid];
            if (pName) {
                const cleanName = pName.trim().toLowerCase();
                if (liveStatsByName[cleanName] !== undefined) return liveStatsByName[cleanName];
            }
            return 0;
        };

        // 2.1 Pass live stats to playerPointsMap
        // FIX: Use Global Map to handle Numeric IDs in snapshot data
        const playerMap = await window.getGlobalPlayerMap();

        if (snapshotSquad && snapshotSquad.players) {
            snapshotSquad.players.forEach(pid => {
                let pName = null;
                // Try resolving ID (works for both "mansur_sh" and 9)
                const pObj = playerMap.get(pid);

                // If resolved, retrieve proper String ID (for points lookup) and Name
                let lookupId = pid;
                if (pObj) {
                    pName = pObj.name;
                    lookupId = pObj.id || pid; // Use canonical ID if available
                }

                let total = getPointsForPlayer(lookupId, pName);
                if (snapshotSquad.captainId === pid) total *= 2;
                playerPointsMap[pid] = total;
            });
        }

        // 2.2 Create a map for RenderSelectedTeam (Draft View)
        const draftPointsMap = {};
        FANTASY_PLAYERS.forEach(p => {
            const pts = getPointsForPlayer(p.id, p.name);
            if (pts !== 0) draftPointsMap[p.id] = pts;
        });

        // 3. Update UI
        // If myPoints is null (no squad), show dash for personal points.
        // For Average/Highest - show values if they exist, otherwise dash.

        console.log('📊 Stats from GW doc:', stats);
        console.log('📊 My Points:', myPoints, '| Is Active:', isActive);

        // Average Points - only show if we have valid data
        if (avgEl) {
            if (stats.averagePoints !== undefined && stats.averagePoints !== null && stats.averagePoints > 0) {
                avgEl.textContent = stats.averagePoints;
            } else {
                avgEl.textContent = '—';
            }
        }

        // My Points - show dash if null (not participating)
        if (ptsEl) {
            if (myPoints !== null) {
                ptsEl.textContent = myPoints;
            } else {
                ptsEl.textContent = '—';
            }
        }

        // Highest Points - only show if we have valid data
        if (highEl) {
            if (stats.highestPoints !== undefined && stats.highestPoints !== null && stats.highestPoints > 0) {
                highEl.textContent = stats.highestPoints;
            } else {
                highEl.textContent = '—';
            }
        }

        // Pitch Rendering
        if (snapshotSquad) {
            // If we have a snapshot (past or current active locked), show it with points
            // Pass playerMap for robust rendering
            renderHistoricalTeam(snapshotSquad, playerPointsMap, playerMap);
        } else {
            // No snapshot -> Show editable team (for Setup phase or future)
            // or empty state if completed.
            if (isActive) {
                renderSelectedTeam(draftPointsMap);
            } else {
                document.getElementById('fantasySelectedPlayers').innerHTML = '<div style="text-align:center; padding:50px; color:#777;">Нет команды в этом туре</div>';
            }
        }

    } catch (error) {
        console.error('Error loading gameweek stats:', error);
        if (avgEl) avgEl.textContent = '-';
        if (ptsEl) ptsEl.textContent = '-';
        if (highEl) highEl.textContent = '-';
    }
}

/**
 * Render historical squad with points
 */
function renderHistoricalTeam(squad, pointsMap, playerMap) {
    const container = document.getElementById('fantasySelectedPlayers');
    if (!container) return;

    // We assume maxPlayers = 3
    for (let i = 0; i < 3; i++) {
        const playerId = squad.players[i];
        let slotHtml = '';

        if (playerId) {
            // Find player details (from global cache passed in)
            const player = playerMap ? playerMap.get(playerId) : FANTASY_PLAYERS.find(p => p.id === playerId);

            const displayName = player ? (player.appName || player.name) : 'Unknown';
            const displayPos = player ? player.position : '??';
            const team = player ? player.team : '1';
            const jerseyImage = team && team.includes('1') ? 'assets/jerseys/team_a.png' : 'assets/jerseys/team_b.png';

            const isCaptain = squad.captainId === playerId;
            const displayPoints = pointsMap[playerId] || 0;

            // --- HTML ГЕНЕРАЦИЯ (Premium FUT Card Structure) ---
            slotHtml = `
                <div class="pitch-player-slot ${isCaptain ? 'captain' : ''}">
                    
                    <div class="live-points-badge ${displayPoints < 0 ? 'negative' : ''}">
                        ${displayPoints > 0 ? '+' + displayPoints : displayPoints}
                    </div>

                    <div class="player-kit">
                        <img src="${jerseyImage}" class="player-jersey-img" alt="Jersey">
                    </div>

                    <div class="player-info">
                        <div class="player-name">${displayName}</div>
                        <div class="player-pos">${displayPos}</div>
                    </div>
                    
                    ${isCaptain ? '<div class="captain-badge">👑</div>' : ''}
                </div>
            `;
        } else {
            slotHtml = `
                <div class="pitch-player-slot empty">
                    <div class="player-jersey-placeholder">+</div>
                    <div class="player-slot-name">Пусто</div>
                </div>
            `;
        }

        if (i === 0) container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'pitch-player-slot-dynamic';
        wrapper.innerHTML = slotHtml;
        container.appendChild(wrapper);
    }
}
