// test-combat.js
const { getPowerScaling, getUserStats, simulateBattle } = require('./combat');
const { findMonsterByName } = require('./monsters');

// Reconstruct User Sim's profile (level 10)
const baseProfile = {
  id: '661135501226672129',
  level: 10,
  xp: 1500,
  gold: 25000,
  huntMarks: 50,
  monsterLevels: {
    'Phoenix': { level: 5 }
  }
};

const m = findMonsterByName('Phoenix');
const blessedPhoenix = { ...m, tier: 'blessed' };

console.log(`=== TEST 1: Standard Team (No support passives) ===`);
const standardTeam = {
  onfield: { monster: 'Phoenix', weapon: 'Wooden Sword' },
  offfield1: { monster: 'Phoenix', weapon: 'Buckler Shield' },
  offfield2: { monster: 'Phoenix', weapon: 'Rusty Dagger' }
};
const standardWpLevels = {
  'Wooden Sword': { level: 5 },
  'Buckler Shield': { level: 5 },
  'Rusty Dagger': { level: 5 }
};

const ps1 = getPowerScaling(standardTeam, baseProfile.monsterLevels, standardWpLevels);
const stats1 = getUserStats(baseProfile.level, standardTeam, baseProfile.monsterLevels, standardWpLevels);
console.log(`Power Scaling: ${ps1}`);
console.log(`Player Stats:`, JSON.stringify(stats1, null, 2));

const battle1 = simulateBattle(stats1, blessedPhoenix, standardTeam, standardWpLevels, baseProfile.monsterLevels);
console.log(`Result: ${battle1.result}`);
console.log(`Battle Log:`);
battle1.rounds.forEach(r => console.log(`  ${r}`));

console.log(`\n=== TEST 2: Support Synergy Team (Crit Overflow & Debuffs) ===`);
const supportTeam = {
  onfield: { monster: 'Phoenix', weapon: 'Dragon Bow' },
  offfield1: { monster: 'Phoenix', weapon: 'Archangel\'s Harp' },
  offfield2: { monster: 'Phoenix', weapon: 'Aegis Breaker' }
};
const supportWpLevels = {
  'Dragon Bow': { level: 30 },
  'Archangel\'s Harp': { level: 30 },
  'Aegis Breaker': { level: 30 }
};

const ps2 = getPowerScaling(supportTeam, baseProfile.monsterLevels, supportWpLevels);
const stats2 = getUserStats(baseProfile.level, supportTeam, baseProfile.monsterLevels, supportWpLevels);
stats2.hp = 10000000;
console.log(`Power Scaling: ${ps2}`);
console.log(`Player Stats:`, JSON.stringify(stats2, null, 2));


const beyondPhoenix = { ...m, tier: 'beyond' };
const battle2 = simulateBattle(stats2, beyondPhoenix, supportTeam, supportWpLevels, baseProfile.monsterLevels);
console.log(`Result: ${battle2.result}`);
console.log(`Battle Log:`);
battle2.rounds.forEach(r => console.log(`  ${r}`));

console.log(`\n=== TEST 3: Forge & Element System Simulation ===`);
const forgeTeam = {
  onfield: { monster: 'Phoenix', weapon: 'Jester\'s Staff' },
  offfield1: { monster: 'Phoenix', weapon: 'Archangel\'s Harp' },
  offfield2: { monster: 'Phoenix', weapon: 'Aegis Breaker' }
};
const forgeWpLevels = {
  'Jester\'s Staff': { level: 30, forge: 6, element: 'Radiant', perfection: 100 },
  'Archangel\'s Harp': { level: 30, forge: 5, element: 'Blizzard', perfection: 80 },
  'Aegis Breaker': { level: 30, forge: 3, element: 'Volt', perfection: 90 }
};
const forgeMonsterLevels = {
  'Phoenix': { level: 20, enchanted: 6 }
};

const ps3 = getPowerScaling(forgeTeam, forgeMonsterLevels, forgeWpLevels, 35);
const stats3 = getUserStats(35, forgeTeam, forgeMonsterLevels, forgeWpLevels);
console.log(`Power Scaling: ${ps3}`);
console.log(`Player Stats:`, JSON.stringify(stats3, null, 2));

const beyondPhoenix3 = { ...m, tier: 'beyond' };
const battle3 = simulateBattle(stats3, beyondPhoenix3, forgeTeam, forgeWpLevels, forgeMonsterLevels);
console.log(`Result: ${battle3.result}`);
console.log(`Battle Log:`);
battle3.rounds.forEach(r => console.log(`  ${r}`));

console.log(`\n=== TEST 4: Kirin & Amrita Bell Showcase (Offensive Debuffer) ===`);
const kirinTeam = {
  onfield: { monster: 'Phoenix', weapon: 'Jester\'s Staff' },
  offfield1: { monster: 'Kirin', weapon: 'Amrita Bell' },
  offfield2: { monster: 'Slime', weapon: 'Buckler Shield' }
};

const kirinWpLevels = {
  'Jester\'s Staff': { level: 1, forge: 0 },
  'Amrita Bell': { level: 30, forge: 6, element: 'Volt', perfection: 100 },
  'Buckler Shield': { level: 1, forge: 0 }
};

const kirinMonsterLevels = {
  'Phoenix': { level: 1, enchanted: 0 },
  'Kirin': { level: 30, enchanted: 6 },
  'Slime': { level: 1, enchanted: 0 }
};

const ps4 = getPowerScaling(kirinTeam, kirinMonsterLevels, kirinWpLevels, 10);
const stats4 = getUserStats(10, kirinTeam, kirinMonsterLevels, kirinWpLevels);
console.log(`Power Scaling: ${ps4}`);
console.log(`Player Stats:`, JSON.stringify(stats4, null, 2));

const beyondPhoenix4 = { ...m, tier: 'beyond' };
const battle4 = simulateBattle(stats4, beyondPhoenix4, kirinTeam, kirinWpLevels, kirinMonsterLevels);
console.log(`Result: ${battle4.result}`);
console.log(`Battle Log:`);
battle4.rounds.forEach(r => console.log(`  ${r}`));

console.log(`\n=== TEST 5: TX Kirin Boss Fight Simulation (BY Level 1) ===`);
const { getTXKirinStats } = require('./monsters');
const txKirin1 = getTXKirinStats(1, baseProfile.level, ps4);
console.log(`TX Kirin BY1 Stats:`, JSON.stringify(txKirin1, null, 2));

const battle5 = simulateBattle(stats4, txKirin1, kirinTeam, kirinWpLevels, kirinMonsterLevels);
console.log(`Result: ${battle5.result}`);

console.log(`\n=== TEST 6: TX Kirin Boss Fight Simulation (BY Level 2 - Stats Spike!) ===`);
const txKirin2 = getTXKirinStats(2, baseProfile.level, ps4);
console.log(`TX Kirin BY2 Stats:`, JSON.stringify(txKirin2, null, 2));

const battle6 = simulateBattle(stats4, txKirin2, kirinTeam, kirinWpLevels, kirinMonsterLevels);
console.log(`Result: ${battle6.result}`);




