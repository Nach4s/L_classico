// ===================================
// FOOTBALL LEAGUE - APPLICATION LOGIC
// L Clasico with MVP Voting System
// ===================================

// === CONFIGURATION ===
// Admin access by email (Firebase Auth)
const ADMIN_EMAIL = 'tokkozha.s@gmail.com';

// Voting duration in milliseconds (24 hours)
const VOTING_DURATION_MS = 24 * 60 * 60 * 1000;

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
let isAdminLoggedIn = false;
let currentUser = null;
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

        updateAuthUI();
        updateAdminUI();

        if (user) {
            console.log('User logged in:', user.email);
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
    if (!isAdminLoggedIn) {
        showAlert('Только админ может возобновить голосование', 'error');
        return;
    }

    if (!confirm('Возобновить голосование на 24 часа? Все предыдущие голоса будут сохранены.')) {
        return;
    }

    try {
        const now = new Date();
        const votingEndsAt = new Date(now.getTime() + VOTING_DURATION_MS);

        await db.collection('matches').doc(matchId).update({
            votingStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
            votingEndsAt: firebase.firestore.Timestamp.fromDate(votingEndsAt),
            votingClosed: false,
            mvp: null
        });

        showAlert('Голосование возобновлено на 24 часа!', 'success');
    } catch (error) {
        console.error('Error resetting voting:', error);
        showAlert('Ошибка при возобновлении голосования', 'error');
    }
}

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
                        <button class="btn btn-danger btn-small" onclick="forceEndVoting('${match.id}')" title="Принудительно завершить и пересчитать">🛑</button>
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

// Force End Voting (Recalculate MVP)
async function forceEndVoting(matchId) {
    if (!isAdminLoggedIn) {
        showAlert('Только админ может завершить голосование', 'error');
        return;
    }

    if (!confirm('Принудительно завершить голосование и пересчитать MVP?')) {
        return;
    }

    try {
        await closeVotingAndCalculateMVP(matchId);
        showAlert('Голосование завершено и MVP пересчитан!', 'success');
    } catch (error) {
        console.error('Error forcing end voting:', error);
        showAlert('Ошибка при завершении голосования', 'error');
    }
}

// Make functions globally accessible for inline event handlers
window.editMatch = editMatch;
window.deleteMatch = deleteMatch;
window.toggleMatchDetails = toggleMatchDetails;
window.openVotingModal = openVotingModal;
window.showMatchDetails = showMatchDetails;
window.resetVoting = resetVoting;
window.forceEndVoting = forceEndVoting;

// ===================================
// FANTASY FOOTBALL MODULE
// El Clasico Fantasy System
// ===================================

// Fantasy Players Data
const FANTASY_PLAYERS = [
    { id: 2, name: "Мансур Ш.", position: "FWD", price: 6.5 },
    { id: 3, name: "Даулет Е.", position: "MID", price: 7.0 },
    { id: 4, name: "Санжар А.", position: "MID", price: 7.0 },
    { id: 5, name: "Айбек А.", position: "FWD", price: 6.5 },
    { id: 6, name: "Алишер А.", position: "DEF", price: 3.0 },
    { id: 7, name: "Шынгыс Т.", position: "FWD", price: 6.0 },
    { id: 8, name: "Асан Т.", position: "DEF", price: 6.0 },
    { id: 9, name: "Димаш А.", position: "GK", price: 2.5 },
    { id: 10, name: "Акылбек А.", position: "FWD", price: 9.0 },
    { id: 11, name: "Ерасыл К.", position: "FWD", price: 7.5 },
    { id: 12, name: "Данияр А.", position: "MID", price: 5.5 },
    { id: 13, name: "Хамид Т.", position: "DEF", price: 4.0 }
];

// Fantasy Configuration
const FANTASY_CONFIG = {
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
    managerName: '' // User's nickname
};
let fantasyCurrentFilter = 'ALL';

// ===================================
// FANTASY INITIALIZATION
// ===================================

function initFantasy() {
    try {
        console.log('Initializing Fantasy Football module...');

        // Load saved team from localStorage/Firebase
        loadFantasyTeam();

        // Load manager name
        loadManagerName();

        // Setup Fantasy Tab Navigation
        setupFantasyTabs();

        // Setup Position Filter (FPL-style)
        setupFantasyFilter();

        // Setup Squad/List Toggle
        setupFPLToggle();

        // Setup Manager Name Save
        setupManagerName();

        // Initial Render
        renderFantasyPlayersList();
        renderSelectedTeam();
        updateFantasyBudget();
        updateDeadlineDisplay();

        // Update deadline every minute
        setInterval(updateDeadlineDisplay, 60000);
    } catch (e) {
        alert('Ошибка запуска Fantasy: ' + e.message);
        console.error('Critical Error in initFantasy:', e);
    }
}

// Load Manager Name
function loadManagerName() {
    const saved = localStorage.getItem('fantasyManagerName');
    const nameContainer = document.getElementById('managerNameContainer');
    const savedNameDisplay = document.getElementById('savedManagerName');

    if (saved) {
        fantasyTeam.managerName = saved;
        // Hide input, show saved name
        if (nameContainer) nameContainer.classList.add('hidden');
        if (savedNameDisplay) {
            const spanEl = savedNameDisplay.querySelector('span');
            if (spanEl) spanEl.textContent = `👤 Менеджер: ${saved}`;
            savedNameDisplay.classList.remove('hidden');
        }
    } else {
        // Show input for first-time users
        if (nameContainer) nameContainer.classList.remove('hidden');
        if (savedNameDisplay) savedNameDisplay.classList.add('hidden');
    }
}

// Setup Manager Name
function setupManagerName() {
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
                showAlert(`Имя менеджера сохранено: ${name}`, 'success');

                // Hide input, show saved name
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

    // Edit button to change name
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (nameContainer) nameContainer.classList.remove('hidden');
            if (savedNameDisplay) savedNameDisplay.classList.add('hidden');
            if (input) input.focus();
        });
    }

    // Also save on Enter key
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn?.click();
            }
        });
    }
}

// Setup Fantasy Sub-tabs
function setupFantasyTabs() {
    document.querySelectorAll('.fantasy-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.fantasyTab;

            // Update tab buttons
            document.querySelectorAll('.fantasy-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update content
            document.querySelectorAll('.fantasy-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`fantasy-${targetTab}`).classList.add('active');

            // Render content if needed
            if (targetTab === 'results') {
                renderFantasyResults();
            } else if (targetTab === 'leaderboard') {
                renderFantasyLeaderboard();
            }
        });
    });

    // Save button
    const saveBtn = document.getElementById('saveFantasyTeam');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveFantasyTeam);
    }
}

// Setup Position Filter (FPL-style tabs)
function setupFantasyFilter() {
    document.querySelectorAll('.fpl-pos-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            fantasyCurrentFilter = btn.dataset.position;

            document.querySelectorAll('.fpl-pos-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            renderFantasyPlayersList();
        });
    });
}

// Setup Squad/List Toggle
function setupFPLToggle() {
    document.querySelectorAll('.fpl-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;

            // Update toggle buttons
            document.querySelectorAll('.fpl-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show/hide views
            const pitchView = document.getElementById('fplPitchView');
            const listView = document.getElementById('fplListView');

            if (view === 'squad') {
                pitchView?.classList.remove('hidden');
                listView?.classList.add('hidden');
            } else {
                pitchView?.classList.add('hidden');
                listView?.classList.remove('hidden');
                renderListView();
            }
        });
    });
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
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if it's Friday 09:50 or later until end of day
    if (day === FANTASY_CONFIG.deadlineDay) {
        if (hour > FANTASY_CONFIG.deadlineHour ||
            (hour === FANTASY_CONFIG.deadlineHour && minute >= FANTASY_CONFIG.deadlineMinute)) {
            return true; // Transfers locked
        }
    }

    return false; // Transfers open
}

function updateDeadlineDisplay() {
    const deadlineEl = document.getElementById('fantasyDeadline');
    const deadlineTextEl = document.getElementById('fantasyDeadlineText');

    if (!deadlineEl || !deadlineTextEl) return;

    const isLocked = checkTransferDeadline();

    if (isLocked) {
        deadlineEl.classList.add('locked');
        deadlineTextEl.textContent = '🔒 Трансферы закрыты до следующей недели';
    } else {
        deadlineEl.classList.remove('locked');
        const timeUntil = getTimeUntilDeadline();
        deadlineTextEl.textContent = `Дедлайн: Пятница 09:50 (осталось ${timeUntil})`;
    }

    // Update save button state
    updateSaveButtonState();
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

function selectFantasyPlayer(playerId) {
    if (checkTransferDeadline()) {
        showAlert('Трансферы закрыты!', 'error');
        return;
    }

    const player = FANTASY_PLAYERS.find(p => p.id === playerId);
    if (!player) return;

    // Check if already selected
    if (fantasyTeam.players.includes(playerId)) {
        removeFantasyPlayer(playerId);
        return;
    }

    // Check max players
    if (fantasyTeam.players.length >= FANTASY_CONFIG.maxPlayers) {
        showAlert(`Максимум ${FANTASY_CONFIG.maxPlayers} игрока!`, 'error');
        return;
    }

    // Check budget
    const currentSpent = calculateSpentBudget();
    if (currentSpent + player.price > FANTASY_CONFIG.budget) {
        showAlert('Недостаточно бюджета!', 'error');
        return;
    }

    // Add player
    fantasyTeam.players.push(playerId);

    // Set first player as captain by default
    if (fantasyTeam.players.length === 1) {
        fantasyTeam.captainId = playerId;
    }

    // Update UI
    renderFantasyPlayersList();
    renderSelectedTeam();
    updateFantasyBudget();
    updateSaveButtonState();
}

function removeFantasyPlayer(playerId) {
    if (checkTransferDeadline()) {
        showAlert('Трансферы закрыты!', 'error');
        return;
    }

    fantasyTeam.players = fantasyTeam.players.filter(id => id !== playerId);

    // Reset captain if removed
    if (fantasyTeam.captainId === playerId) {
        fantasyTeam.captainId = fantasyTeam.players[0] || null;
    }

    renderFantasyPlayersList();
    renderSelectedTeam();
    updateFantasyBudget();
    updateSaveButtonState();
}

function setCaptain(playerId) {
    if (!fantasyTeam.players.includes(playerId)) return;

    fantasyTeam.captainId = playerId;
    renderSelectedTeam();
}

function calculateSpentBudget() {
    return fantasyTeam.players.reduce((total, playerId) => {
        const player = FANTASY_PLAYERS.find(p => p.id === playerId);
        return total + (player ? player.price : 0);
    }, 0);
}

// ===================================
// FANTASY UI RENDERING
// ===================================

function renderFantasyPlayersList() {
    const container = document.getElementById('fantasyPlayersList');
    if (!container) {
        console.error('Fantasy players container not found!');
        return;
    }

    let filteredPlayers = FANTASY_PLAYERS;
    if (fantasyCurrentFilter !== 'ALL') {
        filteredPlayers = FANTASY_PLAYERS.filter(p => p.position === fantasyCurrentFilter);
    }

    // Sort by price descending
    filteredPlayers.sort((a, b) => b.price - a.price);

    container.innerHTML = filteredPlayers.map(player => {
        const isSelected = fantasyTeam.players.includes(player.id);
        const canAfford = calculateSpentBudget() + player.price <= FANTASY_CONFIG.budget || isSelected;
        const teamFull = fantasyTeam.players.length >= FANTASY_CONFIG.maxPlayers && !isSelected;
        const isDisabled = !canAfford || teamFull;

        return `
            <div class="fpl-player-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                 onclick="${isDisabled && !isSelected ? '' : `selectFantasyPlayer(${player.id})`}">
                <div class="fpl-card-header">
                    <span class="fpl-position-badge ${player.position}">${player.position}</span>
                    <span class="fpl-price-badge">${player.price.toFixed(1)}</span>
                </div>
                <div class="fpl-card-body">
                    <div class="fpl-jersey">👕</div>
                    <div class="fpl-player-name">${player.name}</div>
                    <div class="fpl-team-name">L Clasico</div>
                </div>
                ${isSelected ? '<div class="fpl-selected-overlay">✔</div>' : ''}
            </div>
        `;
    }).join('');
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

function renderSelectedTeam() {
    const container = document.getElementById('fantasySelectedPlayers');
    if (!container) return;

    // Generate pitch-style rows
    let row1 = ''; // First player (GK usually, but here 1st slot)
    let row2 = ''; // Second and third players

    for (let i = 0; i < FANTASY_CONFIG.maxPlayers; i++) {
        const playerId = fantasyTeam.players[i];
        let slotHtml = '';

        if (playerId) {
            const player = FANTASY_PLAYERS.find(p => p.id === playerId);
            if (player) {
                const isCaptain = fantasyTeam.captainId === playerId;

                slotHtml = `
                    <div class="pitch-player-slot filled ${isCaptain ? 'captain' : ''}">
                        <div class="player-jersey-icon">👕</div>
                        <div class="player-slot-name">${player.name}</div>
                        <div class="player-slot-pos">${player.position}</div>
                        <div class="player-slot-actions">
                            <button class="slot-action-btn ${isCaptain ? 'captain-active' : ''}" 
                                    onclick="event.stopPropagation(); setCaptain(${player.id})" 
                                    title="Назначить капитаном">
                                    ${isCaptain ? '👑' : 'C'}
                            </button>
                            <button class="slot-action-btn remove" 
                                    onclick="event.stopPropagation(); removeFantasyPlayer(${player.id})" 
                                    title="Удалить">
                                    ✕
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        if (!slotHtml) {
            slotHtml = `
                <div class="pitch-player-slot empty">
                    <div class="player-jersey">+</div>
                    <div class="player-slot-name">Пусто</div>
                    <div class="player-slot-points">—</div>
                </div>
            `;
        }

        if (i === 0) row1 = slotHtml;
        else row2 += slotHtml;
    }

    container.innerHTML = `
        <div class="pitch-row">${row1}</div>
        <div class="pitch-row">${row2}</div>
    `;
}

function updateFantasyBudget() {
    const budgetValueEl = document.getElementById('fantasyBudgetRemaining');
    const budgetBarEl = document.getElementById('fantasyBudgetBar');

    if (!budgetValueEl || !budgetBarEl) return;

    const spent = calculateSpentBudget();
    const remaining = FANTASY_CONFIG.budget - spent;
    const percentage = (spent / FANTASY_CONFIG.budget) * 100;

    budgetValueEl.textContent = remaining.toFixed(1);
    budgetBarEl.style.width = `${percentage}%`;

    if (remaining < 0) {
        budgetValueEl.classList.add('over-budget');
        budgetBarEl.classList.add('over-budget');
    } else {
        budgetValueEl.classList.remove('over-budget');
        budgetBarEl.classList.remove('over-budget');
    }
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById('saveFantasyTeam');
    if (!saveBtn) return;

    const isValidTeam = fantasyTeam.players.length === FANTASY_CONFIG.maxPlayers;
    const isWithinBudget = calculateSpentBudget() <= FANTASY_CONFIG.budget;
    const isNotLocked = !checkTransferDeadline();

    saveBtn.disabled = !(isValidTeam && isWithinBudget && isNotLocked);
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

function renderFantasyResults() {
    const container = document.getElementById('fantasyResults');
    if (!container) return;

    // TODO: In production, fetch real match results from Firebase
    // For now, show empty state - no random demo data
    const hasMatchResults = false; // This will be true when real match data exists

    if (!hasMatchResults) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h3>Результатов пока нет</h3>
                <p>Результаты появятся после завершения матча Тура 3</p>
            </div>
        `;
        return;
    }

    // Real results rendering will go here when match data is available
    // container.innerHTML = realResults.map(result => ...).join('');
}

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
        showAlert(`Выберите ${FANTASY_CONFIG.maxPlayers} игроков`, 'error');
        return;
    }

    if (calculateSpentBudget() > FANTASY_CONFIG.budget) {
        showAlert('Превышен бюджет!', 'error');
        return;
    }

    try {
        await db.collection('fantasyTeams').doc(currentUser.uid).set({
            players: fantasyTeam.players,
            captainId: fantasyTeam.captainId,
            managerName: fantasyTeam.managerName || currentUser.email.split('@')[0],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: currentUser.email
        });

        showAlert('Команда сохранена!', 'success');
    } catch (error) {
        console.error('Error saving fantasy team:', error);
        showAlert('Ошибка сохранения', 'error');
    }
}

async function loadFantasyTeam() {
    // Try localStorage first
    const savedTeam = localStorage.getItem('fantasyTeam');
    if (savedTeam) {
        try {
            const parsed = JSON.parse(savedTeam);
            fantasyTeam.players = parsed.players || [];
            fantasyTeam.captainId = parsed.captainId || null;
        } catch (e) {
            console.error('Error parsing saved team:', e);
        }
    }

    // If user is logged in, try Firebase
    if (currentUser && typeof db !== 'undefined') {
        try {
            const doc = await db.collection('fantasyTeams').doc(currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                fantasyTeam.players = data.players || [];
                fantasyTeam.captainId = data.captainId || null;
            }
        } catch (error) {
            console.error('Error loading fantasy team from Firebase:', error);
        }
    }

    // Save to localStorage for offline access
    localStorage.setItem('fantasyTeam', JSON.stringify(fantasyTeam));
}

// Make fantasy functions globally accessible
window.selectFantasyPlayer = selectFantasyPlayer;
window.removeFantasyPlayer = removeFantasyPlayer;
window.setCaptain = setCaptain;
window.openRatingModal = openRatingModal; // Expose for testing/admin

// ===================================
// RATING SYSTEM UI
// ===================================

function openRatingModal() {
    renderRatingPlayers();
    openModal('ratingModal');
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
    // Delay fantasy init slightly to ensure main app is loaded
    setTimeout(initFantasy, 100);

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
