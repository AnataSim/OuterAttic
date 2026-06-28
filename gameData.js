// gameData.js
const { MONSTERS, getRandomMonster, findMonsterByName, getTierChances, getTXKirinStats } = require('./monsters');
const { WEAPONS, getRandomWeapon, findWeaponByName, getWeaponPassiveDescription } = require('./weapons');
const { getPowerScaling, getUserStats, simulateBattle } = require('./combat');

// Leveling formula: XP to reach NEXT level for the PLAYER
function getXPRequired(level) {
  const base = Math.floor(100 * Math.pow(level, 2.0));
  // Leveling difficulty multiplier starts at 0% at level 1.
  // Increases by 0.8% per level (within 0.2% - 1% range) and caps at 85%.
  const diffPct = Math.min(0.85, (level - 1) * 0.008);
  const stdXp = Math.floor(base / (1 - diffPct));

  if (level >= 80) {
    // Progressive scaling for level 80+ (Exactly 42 million at level 84)
    const multiplier = 1 + Math.pow(level - 80, 2.0) * 1.1875;
    return Math.floor(stdXp * multiplier);
  }

  return stdXp;
}

module.exports = {
  MONSTERS,
  WEAPONS,
  getRandomMonster,
  getRandomWeapon,
  findMonsterByName,
  findWeaponByName,
  getXPRequired,
  getPowerScaling,
  getUserStats,
  simulateBattle,
  getWeaponPassiveDescription,
  getTierChances,
  getTXKirinStats
};
