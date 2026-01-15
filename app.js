// ===================================
// FOOTBALL LEAGUE - APPLICATION LOGIC
// ===================================

// === CONFIGURATION ===
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

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
        form: [] // Last 5 matches: 'W', 'D', 'L'
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
let isLoggedIn = false;
let editingMatchId = null;

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    checkLoginStatus();
    renderLeagueTable();
    renderMatches();
    initializeEventListeners();
});

// === DATA MANAGEMENT ===
function loadData() {
    const savedTeams = localStorage.getItem('teams');
    const savedMatches = localStorage.getItem('matches');
    
    if (savedTeams) {
        teams = JSON.parse(savedTeams);
    }
    
    if (savedMatches) {
        matches = JSON.parse(savedMatches);
    } else {
        // Add sample data if no matches exist
        addSampleData();
    }
}

function saveData() {
    localStorage.setItem('teams', JSON.stringify(teams));
    localStorage.setItem('matches', JSON.stringify(matches));
}

function addSampleData() {
    const sampleMatches = [
        {
            id: Date.now() + 1,
            team1: '1 группа',
            team2: '2 группа',
            score1: 3,
            score2: 1,
            date: '2026-01-10'
        },
        {
            id: Date.now() + 2,
            team1: '2 группа',
            team2: '1 группа',
            score1: 2,
            score2: 2,
            date: '2026-01-12'
        }
    ];
    
    sampleMatches.forEach(match => {
        matches.push(match);
    });
    
    calculateStandings();
    saveData();
}

// === AUTHENTICATION ===
function checkLoginStatus() {
    const loginStatus = sessionStorage.getItem('isLoggedIn');
    isLoggedIn = loginStatus === 'true';
    updateAdminUI();
}

function login(username, password) {
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        isLoggedIn = true;
        sessionStorage.setItem('isLoggedIn', 'true');
        updateAdminUI();
        closeModal('loginModal');
        showAlert('Вход выполнен успешно!', 'success');
        return true;
    }
    return false;
}

function logout() {
    isLoggedIn = false;
    sessionStorage.removeItem('isLoggedIn');
    updateAdminUI();
    showAlert('Вы вышли из системы', 'success');
}

function updateAdminUI() {
    const adminPanel = document.getElementById('adminPanel');
    const adminBtn = document.getElementById('adminBtn');
    
    if (isLoggedIn) {
        adminPanel.classList.add('active');
        adminBtn.textContent = 'Админ ✓';
        adminBtn.style.background = 'var(--color-primary)';
    } else {
        adminPanel.classList.remove('active');
        adminBtn.textContent = 'Админ';
        adminBtn.style.background = '';
    }
}

// === LEAGUE TABLE CALCULATIONS ===
function calculateStandings() {
    // Reset all team stats
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
    
    // Calculate stats from matches
    matches.forEach(match => {
        const team1 = teams.find(t => t.name === match.team1);
        const team2 = teams.find(t => t.name === match.team2);
        
        if (!team1 || !team2) return;
        
        // Update matches played
        team1.matches++;
        team2.matches++;
        
        // Update goals
        team1.goalsFor += match.score1;
        team1.goalsAgainst += match.score2;
        team2.goalsFor += match.score2;
        team2.goalsAgainst += match.score1;
        
        // Determine result
        if (match.score1 > match.score2) {
            // Team 1 wins
            team1.wins++;
            team1.points += 3;
            team2.losses++;
            team1.form.unshift('W');
            team2.form.unshift('L');
        } else if (match.score1 < match.score2) {
            // Team 2 wins
            team2.wins++;
            team2.points += 3;
            team1.losses++;
            team1.form.unshift('L');
            team2.form.unshift('W');
        } else {
            // Draw
            team1.draws++;
            team2.draws++;
            team1.points += 1;
            team2.points += 1;
            team1.form.unshift('D');
            team2.form.unshift('D');
        }
        
        // Keep only last 5 matches in form
        team1.form = team1.form.slice(0, 5);
        team2.form = team2.form.slice(0, 5);
    });
    
    // Sort teams by points, then goal difference
    teams.sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        return gdB - gdA;
    });
    
    saveData();
}

// === RENDERING ===
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
    
    // Sort matches by date (newest first)
    const sortedMatches = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedMatches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        
        const formattedDate = new Date(match.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        card.innerHTML = `
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
            ${isLoggedIn ? `
                <div class="match-actions">
                    <button class="btn btn-secondary btn-small" onclick="editMatch(${match.id})">✏️ Изменить</button>
                    <button class="btn btn-danger btn-small" onclick="deleteMatch(${match.id})">🗑️ Удалить</button>
                </div>
            ` : ''}
        `;
        
        grid.appendChild(card);
    });
}

// === MATCH MANAGEMENT ===
function addMatch(matchData) {
    // Validate that teams are different
    if (matchData.team1 === matchData.team2) {
        showAlert('Команды должны быть разными!', 'error');
        return false;
    }
    
    const newMatch = {
        id: Date.now(),
        team1: matchData.team1,
        team2: matchData.team2,
        score1: parseInt(matchData.score1),
        score2: parseInt(matchData.score2),
        date: matchData.date
    };
    
    matches.push(newMatch);
    calculateStandings();
    renderLeagueTable();
    renderMatches();
    showAlert('Матч успешно добавлен!', 'success');
    return true;
}

function editMatch(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    editingMatchId = matchId;
    
    // Fill form with match data
    document.getElementById('matchId').value = match.id;
    document.getElementById('team1').value = match.team1;
    document.getElementById('team2').value = match.team2;
    document.getElementById('score1').value = match.score1;
    document.getElementById('score2').value = match.score2;
    document.getElementById('matchDate').value = match.date;
    
    document.getElementById('matchModalTitle').textContent = 'Изменить Матч';
    openModal('matchModal');
}

function updateMatch(matchId, matchData) {
    // Validate that teams are different
    if (matchData.team1 === matchData.team2) {
        showAlert('Команды должны быть разными!', 'error');
        return false;
    }
    
    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return false;
    
    matches[matchIndex] = {
        id: matchId,
        team1: matchData.team1,
        team2: matchData.team2,
        score1: parseInt(matchData.score1),
        score2: parseInt(matchData.score2),
        date: matchData.date
    };
    
    calculateStandings();
    renderLeagueTable();
    renderMatches();
    showAlert('Матч успешно обновлён!', 'success');
    return true;
}

function deleteMatch(matchId) {
    if (!confirm('Вы уверены, что хотите удалить этот матч?')) {
        return;
    }
    
    matches = matches.filter(m => m.id !== matchId);
    calculateStandings();
    renderLeagueTable();
    renderMatches();
    showAlert('Матч удалён', 'success');
}

// === MODAL MANAGEMENT ===
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    
    // Reset forms
    if (modalId === 'loginModal') {
        document.getElementById('loginForm').reset();
        document.getElementById('loginError').innerHTML = '';
    } else if (modalId === 'matchModal') {
        document.getElementById('matchForm').reset();
        document.getElementById('matchError').innerHTML = '';
        editingMatchId = null;
        document.getElementById('matchModalTitle').textContent = 'Добавить Матч';
    }
}

// === ALERTS ===
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

// === EVENT LISTENERS ===
function initializeEventListeners() {
    // Admin button
    document.getElementById('adminBtn').addEventListener('click', () => {
        if (!isLoggedIn) {
            openModal('loginModal');
        }
    });
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (login(username, password)) {
            document.getElementById('loginForm').reset();
        } else {
            document.getElementById('loginError').innerHTML = '<div class="alert alert-error">Неверный логин или пароль</div>';
        }
    });
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Add match button
    document.getElementById('addMatchBtn').addEventListener('click', () => {
        editingMatchId = null;
        document.getElementById('matchForm').reset();
        document.getElementById('matchModalTitle').textContent = 'Добавить Матч';
        openModal('matchModal');
    });
    
    // Match form
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
    
    // Modal close buttons
    document.getElementById('closeLoginModal').addEventListener('click', () => closeModal('loginModal'));
    document.getElementById('cancelLogin').addEventListener('click', () => closeModal('loginModal'));
    document.getElementById('closeMatchModal').addEventListener('click', () => closeModal('matchModal'));
    document.getElementById('cancelMatch').addEventListener('click', () => closeModal('matchModal'));
    
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Make functions globally accessible for inline event handlers
window.editMatch = editMatch;
window.deleteMatch = deleteMatch;
