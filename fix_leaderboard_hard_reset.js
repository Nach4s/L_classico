(async function hardResetByIds() {
    console.log("🔥 ЗАПУСК: ЖЕСТКАЯ ПРИВЯЗКА (ИНДЕКС + 2)...");

    // Check for Firebase
    if (typeof firebase === 'undefined' || !firebase.auth().currentUser && !window.isAdminLoggedIn) {
        // Allow if admin bypass is active or warn
        if (!confirm("Вы не авторизованы или Firebase недоступен. Продолжить?")) return;
    }

    const db = firebase.firestore();
    const batch = db.batch();
    const gwId = "gw1";

    // ==========================================
    // 1. ТВОЙ МАССИВ (ЭТАЛОН)
    // ==========================================
    // Copied exactly from your snippet/codebase
    const PLAYERS_DATA = [
        // 1 группа
        { id: "mansur_sh", name: "Мансур Ш.", team: "1 группа" }, // Index 0 -> ID 2
        { id: "daulet_e", name: "Даулет Е.", team: "1 группа" },  // Index 1 -> ID 3
        { id: "sanzhar_a", name: "Санжар А.", team: "1 группа" }, // Index 2 -> ID 4
        { id: "aibek_a", name: "Айбек А.", team: "1 группа" },    // Index 3 -> ID 5
        { id: "alisher_a", name: "Алишер А.", team: "1 группа" }, // Index 4 -> ID 6
        { id: "shyngys_t", name: "Шынгыс Т.", team: "1 группа" }, // Index 5 -> ID 7

        // 2 группа
        { id: "asan_t", name: "Асан Т.", team: "2 группа" },      // Index 6 -> ID 8
        { id: "dimash_a", name: "Димаш А.", team: "2 группа" },   // Index 7 -> ID 9
        { id: "akylbek_a", name: "Акылбек А.", team: "2 группа" },// Index 8 -> ID 10
        { id: "yerasyl_k", name: "Ерасыл К.", team: "2 группа" }, // Index 9 -> ID 11
        { id: "daniiar_a", name: "Данияр А.", team: "2 группа" }, // Index 10 -> ID 12
        { id: "hamid_t", name: "Хамид Т.", team: "2 группа" }     // Index 11 -> ID 13
    ];

    // ==========================================
    // 2. СОЗДАЕМ КАРТУ: ЦИФРА -> ID ИГРОКА
    // ==========================================
    const numericMap = {}; // { 2: "mansur_sh", 13: "hamid_t" }

    console.log("📝 Присваиваем ID по схеме (Индекс + 2):");

    for (let i = 0; i < PLAYERS_DATA.length; i++) {
        const p = PLAYERS_DATA[i];
        const correctId = i + 2; // ВОТ ОНА, ТВОЯ ФОРМУЛА

        numericMap[correctId] = p.id;

        // Обновляем самого игрока в базе (чтобы там тоже лежал правильный numericId)
        const pRef = db.collection('players').doc(p.id);
        batch.update(pRef, { numericId: correctId });

        // Лог для проверки (чтобы ты видел глазами)
        if (p.name.includes("Мансур") || p.name.includes("Ерасыл") || p.name.includes("Хамид")) {
            console.log(`   👉 ${p.name} = ID ${correctId}`);
        }
    }

    // ==========================================
    // 3. ЗАГРУЖАЕМ ОЧКИ (Live Stats)
    // ==========================================
    const statsSnapshot = await db.collection('match_stats').doc(gwId).collection('players').get();
    const statsMap = {}; // { "mansur_sh": 6, "shyngys_t": 4 }

    statsSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const total = (d.statsPoints || 0) + (d.mvpBonus || 0) + (d.ratingBonus || 0);
        // NOTE: used d.mvpBonus & d.ratingBonus based on previous files, user had bonusPoints
        if (total !== 0) statsMap[doc.id] = total;
    });

    // ==========================================
    // 4. ПЕРЕСЧИТЫВАЕМ КОМАНДЫ
    // ==========================================
    // IMPORTANT: Collection name is 'fantasyTeams' (camelCase)
    const usersSnapshot = await db.collection('fantasyTeams').get();
    let updatedTeams = 0;

    usersSnapshot.docs.forEach(doc => {
        const user = doc.data();
        let squadPoints = 0;
        let logDetails = [];

        // Если в команде есть игроки (например [2, 11, 13])
        if (user.players && user.players.length > 0) {
            user.players.forEach(pNum => {
                // 1. Берем цифру (2) -> Получаем строку ("mansur_sh")
                // pNum может быть строкой "2", поэтому делаем parseInt
                // Also handle if pNum is ALREADY a string ID ("mansur_sh") from previous fixes
                let realId = null;

                if (typeof pNum === 'string' && isNaN(parseInt(pNum))) {
                    // Already a string ID
                    realId = pNum;
                } else {
                    // It is a number or string number
                    const idNum = parseInt(pNum);
                    realId = numericMap[idNum];
                }

                if (realId) {
                    // 2. Берем очки по строке
                    let pts = statsMap[realId] || 0;

                    // 3. Проверяем Капитана
                    // Captain might be Numeric or String
                    let isCaptain = false;
                    const captNum = parseInt(user.captainId || user.captain);
                    const captStr = user.captainId || user.captain;

                    if (pNum == captStr || pNum == captNum) isCaptain = true;
                    // Also check if current realId matches captain if captain was stored as string
                    if (realId === captStr) isCaptain = true;
                    // Also check if mapped ID matches captain
                    if (numericMap[captNum] === realId) isCaptain = true;

                    if (isCaptain) {
                        pts *= 2;
                        if (pts !== 0) logDetails.push(`(C)${realId}=${pts}`);
                    } else {
                        if (pts !== 0) logDetails.push(`${realId}=${pts}`);
                    }

                    squadPoints += pts;
                }
            });
        }

        // Обновляем Total
        const historyTotal = user.totalPointsAllTime || 0;
        // As per user request, just raw recalc for this GW
        const newLiveTotal = historyTotal + squadPoints;

        const ref = db.collection('fantasyTeams').doc(doc.id);
        batch.update(ref, {
            live_gw_points: squadPoints,
            live_total_points: newLiveTotal,
            // Sync legacy fields
            weekPoints: squadPoints,
            totalPoints: newLiveTotal,
            gameweekPoints: squadPoints
        });

        if (squadPoints > 0) {
            console.log(`🏆 ${user.managerName || user.teamName || 'User'}: ${squadPoints} очков [${logDetails.join(', ')}]`);
            updatedTeams++;
        }
    });

    // ==========================================
    // 5. СОХРАНЯЕМ
    // ==========================================
    if (updatedTeams > 0) {
        await batch.commit();
        console.log(`🎉 ГОТОВО! ID обновлены (Мансур=2, Хамид=13). Пересчитано команд: ${updatedTeams}`);
        alert(`Всё! База синхронизирована по схеме Index+2. Проверяй таблицу.`);
    } else {
        console.log("⚠️ Пересчет завершен, но изменений не найдено. Возможно, уже обновлено.");
    }
})();
