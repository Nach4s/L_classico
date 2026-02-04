/**
 * BUDGET MIGRATION SCRIPT
 * 
 * Purpose: Fix negative bank balances for users whose teams were assembled 
 * before player price increases.
 * 
 * Problem: If a user assembled a team for 18.0M, and then players appreciated
 * to 18.1M, the old logic calculated bank as 18.0 - 18.1 = -0.1M
 * 
 * Solution: For existing teams without a saved remainingBudget (or with negative),
 * set remainingBudget to 0 (grandfathering - they bought at the old prices)
 * 
 * Usage: Run in browser console while logged in as admin
 */

async function migrateBudgets() {
    console.log('🔧 Starting budget migration...');

    const snapshot = await db.collection('fantasyTeams').get();
    let fixed = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const userId = doc.id;
        const currentBudget = data.remainingBudget;
        const hasPlayers = data.players && data.players.length > 0;

        console.log(`\n📋 User: ${data.managerName || data.userEmail || userId}`);
        console.log(`   Players: ${hasPlayers ? data.players.length : 0}`);
        console.log(`   Current remainingBudget: ${currentBudget}`);

        // Fix cases where:
        // 1. remainingBudget is null/undefined but user has a team
        // 2. remainingBudget is negative (shouldn't happen for existing teams)
        if (hasPlayers && (currentBudget === null || currentBudget === undefined || currentBudget < 0)) {
            // GRANDFATHERING: Set budget to 0 (they used their full budget at old prices)
            const newBudget = 0;

            console.log(`   ⚡ FIXING: Setting remainingBudget to ${newBudget}`);

            await db.collection('fantasyTeams').doc(userId).update({
                remainingBudget: newBudget,
                budgetMigratedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            fixed++;
        } else {
            console.log(`   ✅ OK - No fix needed`);
            skipped++;
        }
    }

    console.log('\n========================================');
    console.log(`🎉 Migration complete!`);
    console.log(`   Fixed: ${fixed} users`);
    console.log(`   Skipped: ${skipped} users`);
    console.log('========================================');
}

// Quick fix for a specific user (by email)
async function fixUserBudget(email, newBudget = 0) {
    const snapshot = await db.collection('fantasyTeams')
        .where('userEmail', '==', email)
        .get();

    if (snapshot.empty) {
        console.log(`❌ User not found: ${email}`);
        return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log(`📋 User: ${data.managerName || email}`);
    console.log(`   Old remainingBudget: ${data.remainingBudget}`);
    console.log(`   New remainingBudget: ${newBudget}`);

    await db.collection('fantasyTeams').doc(doc.id).update({
        remainingBudget: newBudget,
        budgetMigratedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Fixed! Refresh the page to see changes.`);
}

// Export to window for console access
window.migrateBudgets = migrateBudgets;
window.fixUserBudget = fixUserBudget;

console.log('📦 Budget Migration Script loaded!');
console.log('');
console.log('Available commands:');
console.log('  migrateBudgets()              - Fix ALL users with negative/missing budgets');
console.log('  fixUserBudget("email@x.com")  - Fix specific user, set bank to 0');
console.log('  fixUserBudget("email@x.com", 0.5) - Fix specific user, set bank to 0.5M');
