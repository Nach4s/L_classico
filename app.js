// ===================================
// FOOTBALL LEAGUE - APPLICATION LOGIC
// L Clasico with MVP Voting System
// ===================================

// === CONFIGURATION ===
// Admin access by email (Firebase Auth)
const ADMIN_EMAIL = 'tokkozha.s@gmail.com';

// Voting duration in milliseconds (24 hours)
const VOTING_DURATION_MS = 24 * 60 * 60 * 1000;

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
                ${match.mvp ? `<p class="mvp-result">🏆 MVP: ${match.mvp.player} (${match.mvp.votes} голосов)</p>` : ''}
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

    // Build players list from goals
    const goals = match.goals || [];
    if (goals.length === 0) {
        playersList.innerHTML = `
            <div class="no-goals-message">
                <p>Нет забивших игроков для голосования</p>
            </div>
        `;
        openModal('votingModal');
        return;
    }

    // Get unique players with their goal counts
    const playerMap = new Map();
    goals.forEach(goal => {
        const key = `${goal.player}|${goal.team}`;
        if (playerMap.has(key)) {
            playerMap.get(key).goalCount++;
        } else {
            playerMap.set(key, {
                player: goal.player,
                team: goal.team,
                goalCount: 1
            });
        }
    });

    playersList.innerHTML = Array.from(playerMap.values()).map(p => `
        <div class="player-option" data-player="${p.player}" data-team="${p.team}">
            <div class="player-info">
                <span class="player-name">${p.player}</span>
                <span class="player-team">${p.team}</span>
            </div>
            <div class="player-goals">
                ⚽ ${p.goalCount}
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

        // Submit vote
        await db.collection('matches').doc(currentVotingMatchId)
            .collection('votes').doc(currentUser.uid).set({
                player: selectedVotePlayer.player,
                team: selectedVotePlayer.team,
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
        const voteCount = new Map();
        votesSnapshot.forEach(doc => {
            const vote = doc.data();
            const key = `${vote.player}|${vote.team}`;
            voteCount.set(key, (voteCount.get(key) || 0) + 1);
        });

        // Find MVP (player with most votes)
        let mvp = null;
        let maxVotes = 0;

        voteCount.forEach((votes, key) => {
            if (votes > maxVotes) {
                const [player, team] = key.split('|');
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

        const voteCount = new Map();
        let totalVotes = 0;

        votesSnapshot.forEach(doc => {
            const vote = doc.data();
            const key = `${vote.player}|${vote.team}`;
            voteCount.set(key, (voteCount.get(key) || 0) + 1);
            totalVotes++;
        });

        const stats = Array.from(voteCount.entries()).map(([key, votes]) => {
            const [player, team] = key.split('|');
            return {
                player,
                team,
                votes,
                percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
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
        scorers.team1.forEach(player => {
            if (player.trim()) {
                goals.push({ player: player.trim(), team: team1 });
            }
        });
    }

    if (scorers.team2) {
        scorers.team2.forEach(player => {
            if (player.trim()) {
                goals.push({ player: player.trim(), team: team2 });
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
        const team1Inputs = document.querySelectorAll('#team1Scorers input');
        const team2Inputs = document.querySelectorAll('#team2Scorers input');

        team1Inputs.forEach((input, index) => {
            if (match.scorers.team1 && match.scorers.team1[index]) {
                input.value = match.scorers.team1[index];
            }
        });

        team2Inputs.forEach((input, index) => {
            if (match.scorers.team2 && match.scorers.team2[index]) {
                input.value = match.scorers.team2[index];
            }
        });
    }

    document.getElementById('matchModalTitle').textContent = 'Изменить Матч';
    openModal('matchModal');
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
                <button class="btn btn-voting btn-small" onclick="event.stopPropagation(); openVotingModal('${match.id}')">
                    🏆 Голосовать за MVP
                </button>
                ${isAdminLoggedIn ? `
                    <div class="match-actions" onclick="event.stopPropagation()">
                        <button class="btn btn-secondary btn-small" onclick="editMatch('${match.id}')" title="Редактировать">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="deleteMatch('${match.id}')" title="Удалить">🗑️</button>
                        <button class="btn btn-info btn-small" onclick="showMatchDetails('${match.id}')" title="Статистика">📊</button>
                        <button class="btn btn-warning btn-small" onclick="resetVoting('${match.id}')" title="Возобновить голосование">🔄</button>
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
                <span>MVP: ${match.mvp.player} (${match.mvp.votes} голосов)</span>
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
                ${team1Scorers.map(scorer => `
                    <div class="goal-scorer">
                        <span class="goal-icon">⚽</span>
                        <span class="scorer-name">${scorer}</span>
                    </div>
                `).join('') || '<span class="text-muted" style="font-size: 0.85rem;">—</span>'}
            </div>
            <div class="team-scorers">
                <div class="team-scorers-title">${match.team2}</div>
                ${team2Scorers.map(scorer => `
                    <div class="goal-scorer">
                        <span class="goal-icon">⚽</span>
                        <span class="scorer-name">${scorer}</span>
                    </div>
                `).join('') || '<span class="text-muted" style="font-size: 0.85rem;">—</span>'}
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
                            <span class="vote-stat-value">${s.votes} голосов (${s.percentage}%)</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '<p class="text-muted">Пока нет голосов</p>'}
        
        ${match.mvp ? `
            <div class="mvp-result-block">
                <h4>🏆 MVP матча</h4>
                <p class="mvp-name">${match.mvp.player}</p>
                <p class="mvp-team">${match.mvp.team}</p>
                <p class="mvp-votes">${match.mvp.votes} голосов</p>
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

    const existingInputs = container.querySelectorAll('input');
    const existingValues = Array.from(existingInputs).map(input => input.value);

    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'scorer-input-group';

        inputGroup.innerHTML = `
            <label>Гол ${i + 1}:</label>
            <input 
                type="text" 
                placeholder="Имя игрока (например: Даулет E.)"
                value="${existingValues[i] || ''}"
                data-scorer-index="${i}"
            >
        `;

        container.appendChild(inputGroup);
    }
}

function collectScorerData() {
    const team1Inputs = document.querySelectorAll('#team1Scorers input');
    const team2Inputs = document.querySelectorAll('#team2Scorers input');

    const team1Scorers = Array.from(team1Inputs)
        .map(input => input.value.trim())
        .filter(value => value !== '');

    const team2Scorers = Array.from(team2Inputs)
        .map(input => input.value.trim())
        .filter(value => value !== '');

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
        document.getElementById('loginFormError').innerHTML = '';
        document.getElementById('registerFormError').innerHTML = '';
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
}

// Switch between login and register tabs
function switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('userLoginForm');
    const registerForm = document.getElementById('userRegisterForm');
    const modalTitle = document.getElementById('authModalTitle');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        modalTitle.textContent = 'Вход';
    } else {
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        modalTitle.textContent = 'Регистрация';
    }
}

// Make functions globally accessible for inline event handlers
window.editMatch = editMatch;
window.deleteMatch = deleteMatch;
window.toggleMatchDetails = toggleMatchDetails;
window.openVotingModal = openVotingModal;
window.showMatchDetails = showMatchDetails;
window.resetVoting = resetVoting;
