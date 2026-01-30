// ===================================
// FANTASY FOOTBALL CORE
// Unified module: Auth, Tabs, Navigation, Initialization
// Merged from: fantasy_integration.js + fantasy_manager.js
// ===================================

const FANTASY_CONFIG = {
    adminEmail: 'tokkozha.s@gmail.com',
    tabs: ['myteam', 'voting', 'admin', 'results', 'leaderboard'],
    maxPlayers: 3,          // Number of players per squad
    budget: 18.0,           // Budget in millions
    deadlineDay: 5,         // Friday (0=Sun, 5=Fri)
    deadlineHour: 9,        // 09:00
    deadlineMinute: 50      // 09:50
};

// Current active gameweek
var currentGameweekId = null;

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Fantasy Core Initializing...');

    // 1. Initialize Tab Navigation
    initFantasyTabs();

    // 2. Setup Auth Listener
    if (typeof firebase !== 'undefined' && firebase.auth()) {
        firebase.auth().onAuthStateChanged(user => {
            handleAuthChange(user);
        });
    }

    // 3. Load current gameweek
    loadCurrentGameweek();
});

// ===================================
// TAB NAVIGATION
// ===================================

function initFantasyTabs() {
    const tabs = document.querySelectorAll('.fantasy-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = tab.dataset.fantasyTab;
            switchFantasyTab(tabName);
        });
    });

    // Default to 'myteam' if no active
    if (!document.querySelector('.fantasy-tab.active')) {
        switchFantasyTab('myteam');
    }
}

function switchFantasyTab(tabName) {
    // 1. Update Tab Buttons
    document.querySelectorAll('.fantasy-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.fantasyTab === tabName);
    });

    // 2. Update Content Areas
    document.querySelectorAll('.fantasy-content').forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
    });

    const activeContent = document.getElementById(`fantasy-${tabName}`);
    if (activeContent) {
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
        loadFantasyTabContent(tabName);
    }
}

function loadFantasyTabContent(tabName) {
    console.log(`📂 Loading Fantasy tab: ${tabName}`);

    // If gameweek not loaded yet, show loading state (unless it's admin tab, which handles empty state)
    if (!currentGameweekId && tabName !== 'admin') {
        const activeContent = document.getElementById(`fantasy-${tabName}`);
        if (activeContent) {
            activeContent.innerHTML = '<div class="loading-spinner" style="text-align:center; padding:50px;">⏳ Загрузка данных тура...</div>';
        }
        return;
    }

    const gwId = currentGameweekId;

    switch (tabName) {
        case 'myteam':
            if (typeof renderFantasyPlayersList === 'function') renderFantasyPlayersList();
            if (typeof renderSelectedTeam === 'function') renderSelectedTeam();
            break;

        case 'voting':
            if (typeof loadVotingInterface === 'function') {
                loadVotingInterface(gwId);
            }
            break;

        case 'admin':
            console.log('🔧 Admin tab: checking renderAdminPanel...', typeof window.renderAdminPanel);
            if (window.isAdminLoggedIn && typeof window.renderAdminPanel === 'function') {
                console.log('🔧 Admin tab: calling renderAdminPanel()');
                window.renderAdminPanel();
            } else {
                console.log('🔧 Admin tab: NOT calling - isAdmin:', window.isAdminLoggedIn, 'renderAdminPanel:', typeof window.renderAdminPanel);
            }
            break;

        case 'leaderboard':
            if (typeof renderFantasyLeaderboard === 'function') {
                renderFantasyLeaderboard(gwId);
            }
            break;

        case 'results':
            if (typeof renderFantasyResults === 'function') {
                renderFantasyResults(gwId);
            }
            break;
    }
}

// ===================================
// AUTHENTICATION
// ===================================

function handleAuthChange(user) {
    const adminTab = document.getElementById('fantasyAdminTab');

    // Global state
    window.currentUser = user;
    window.isAdminLoggedIn = (user && user.email === FANTASY_CONFIG.adminEmail);

    console.log(`👤 Auth: ${user ? user.email : 'Logged Out'} | Admin: ${window.isAdminLoggedIn}`);

    // Update Admin Tab Visibility
    if (adminTab) {
        if (window.isAdminLoggedIn) {
            adminTab.style.display = 'inline-block';
            adminTab.style.visibility = 'visible';
            adminTab.classList.remove('hidden');
        } else {
            adminTab.style.display = 'none';
        }
    }

    // If on admin tab and logged out, switch away
    if (!window.isAdminLoggedIn && document.querySelector('.fantasy-tab[data-fantasy-tab="admin"].active')) {
        switchFantasyTab('myteam');
    }

    // Re-render admin panel if needed
    if (window.isAdminLoggedIn && typeof renderAdminPanel === 'function') {
        const adminContent = document.getElementById('fantasy-admin');
        if (adminContent && adminContent.style.display !== 'none') {
            renderAdminPanel();
        }
    }
}

// ===================================
// GAMEWEEK LOADING
// ===================================

async function loadCurrentGameweek() {
    if (typeof db === 'undefined') {
        console.error('❌ Database not initialized');
        updateFantasyUIWithError('База данных не подключена');
        return;
    }

    console.log('🔄 Начинаю поиск туров...');

    try {
        // 1. Try to find ACTIVE gameweek
        let snapshot = await db.collection('gameweeks')
            .where('status', 'in', ['voting_open', 'stats_entry'])
            .orderBy('gameweekNumber', 'desc')
            .limit(1)
            .get();

        console.log(`📡 Ответ от базы (активные): найдено ${snapshot.size} документов`);

        // 2. If no active, find ANY gameweek (starting from first available)
        if (snapshot.empty) {
            console.log('⚠️ Активных туров нет. Ищу первый доступный...');
            snapshot = await db.collection('gameweeks')
                .orderBy('gameweekNumber', 'asc') // Find the earliest one (e.g. gw3)
                .limit(1)
                .get();
            console.log(`📡 Ответ от базы (любые): найдено ${snapshot.size} документов`);
        }

        if (!snapshot.empty) {
            currentGameweekId = snapshot.docs[0].id;
            window.currentGameweekId = currentGameweekId;
            const data = snapshot.docs[0].data();

            // Store full gameweek data for deadline checks
            window.currentGameweekData = data;

            // Compute lock status based on deadline and status
            const now = new Date();
            let deadline = null;
            if (data.deadline) {
                deadline = data.deadline.toDate ? data.deadline.toDate() : new Date(data.deadline);
            }
            const status = data.status || '';

            // Lock if: past deadline OR status is active (voting_open, stats_entry)
            // Unlock if: status is 'setup' (pre-match) or 'completed' (post-match)
            window.isTransferWindowLocked = (deadline && now > deadline) ||
                (status === 'voting_open') ||
                (status === 'stats_entry');

            console.log(`✅ Выбран тур: ${currentGameweekId}`, data);
            console.log(`🔒 Transfer window locked: ${window.isTransferWindowLocked}`);

            // Reload current tab content now that we have ID
            const activeTab = document.querySelector('.fantasy-tab.active');
            if (activeTab) {
                // Force reload of content
                loadFantasyTabContent(activeTab.dataset.fantasyTab);
            }
        } else {
            console.warn('❌ Нет доступных туров в базе.');
            updateFantasyUIWithError('Нет доступных туров в базе данных');
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке:', error);
        updateFantasyUIWithError(`Ошибка загрузки: ${error.message}`);
    }
}

function updateFantasyUIWithError(message) {
    const activeTab = document.querySelector('.fantasy-tab.active');
    if (activeTab) {
        const content = document.getElementById(`fantasy-${activeTab.dataset.fantasyTab}`);
        if (content) {
            content.innerHTML = `
                <div class="error-message" style="text-align:center; padding:30px; color: #ff6b6b;">
                    <h3>⚠️ Ошибка</h3>
                    <p>${message}</p>
                    <button class="btn btn-secondary" onclick="location.reload()" style="margin-top:10px;">Обновить</button>
                </div>
            `;
        }
    }
}

// ===================================
// DATABASE INITIALIZATION HELPERS
// ===================================

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

function showInitHelper() {
    const container = document.getElementById('adminStageContent');
    if (container) {
        container.innerHTML = `
            <div class="init-warning">
                <h3>⚠️ База игроков пуста</h3>
                <p>Нужно инициализировать базу данных игроков.</p>
                <button class="btn btn-primary btn-large" onclick="initializePlayers()">
                    🔧 Заполнить базу игроков
                </button>
            </div>
        `;
    }
}

async function initializePlayers() {
    const button = event.target;
    button.disabled = true;
    button.textContent = '⏳ Инициализация...';

    try {
        if (typeof seedPlayersToFirestore === 'function') {
            await seedPlayersToFirestore();
            button.textContent = '✅ Готово!';
            alert('✅ База игроков создана!');
            location.reload();
        } else {
            throw new Error('seedPlayersToFirestore не найдена');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Ошибка: ' + error.message);
        button.disabled = false;
        button.textContent = '🔧 Попробовать снова';
    }
}

// ===================================
// GLOBAL EXPORTS
// ===================================

window.switchFantasyTab = switchFantasyTab;
window.loadFantasyTabContent = loadFantasyTabContent;
window.loadCurrentGameweek = loadCurrentGameweek;
window.checkPlayersInitialized = checkPlayersInitialized;
window.initializePlayers = initializePlayers;
window.currentGameweekId = currentGameweekId;

console.log('✅ Fantasy Core loaded');
