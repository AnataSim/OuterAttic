// combat.js
const { findMonsterByName } = require('./monsters');
const { findWeaponByName } = require('./weapons');

// Calculate Power Scaling (PS) from 1 to 120
function getPowerScaling(activeTeam, monsterLevels = {}, weaponLevels = {}, playerLevel = 1) {
  if (!activeTeam) return 1;

  let monsterPoints = 0;
  let weaponPoints = 0;

  const getMonsterBasePoints = (monsterName) => {
    if (!monsterName) return 0;
    const m = findMonsterByName(monsterName);
    if (!m) return 0;
    let basePoints = 2;
    if (m.threat === 'threatX') {
      basePoints = 35; // Kirin is Threat X
    } else {
      const threatNum = parseInt(m.threat.replace('threat', ''));
      // Exponential threat points: T1=2, T2=3, T3=5, T4=8, T5=13, T6=22
      const threatPoints = [0, 2, 3, 5, 8, 13, 22];
      basePoints = threatPoints[threatNum] || 2;
    }
    const mData = monsterLevels && monsterLevels[monsterName] ? monsterLevels[monsterName] : {};
    const mLvl = mData.level || 1;
    const mEnchanted = mData.enchanted || mData.forge || 0;
    
    // Scale by level (+5% per level) and Enchanted level (+5% per enchanted level, +50% at E6)
    const levelFactor = 1 + (mLvl - 1) * 0.05;
    const enchantedFactor = 1 + (mEnchanted >= 6 ? 0.50 : mEnchanted * 0.05);
    return basePoints * levelFactor * enchantedFactor;
  };

  const getWeaponBasePoints = (weaponName) => {
    if (!weaponName) return 0;
    const w = findWeaponByName(weaponName);
    if (!w) return 0;
    const rarities = ['basic', 'usual', 'unusual', 'odd', 'exotic', 'mythic', 'supreme', 'secret'];
    const idx = rarities.indexOf(w.rarity);
    // Rarity points: Basic=1, Usual=2, ..., Secret=8
    const basePoints = idx !== -1 ? idx + 1 : 0;
    const wData = weaponLevels && weaponLevels[weaponName] ? weaponLevels[weaponName] : {};
    const wLvl = wData.level || 1;
    const wForge = wData.forge || 0;
    
    // Scale by level (+5% per level) and Forge level (+5% per forge level, +50% at F6)
    const levelFactor = 1 + (wLvl - 1) * 0.05;
    const forgeFactor = 1 + (wForge >= 6 ? 0.50 : wForge * 0.05);
    // Scale by element perfection (+25% at 100% perfection)
    const elementFactor = 1 + (wData.perfection || 0) / 100 * 0.25;
    return basePoints * levelFactor * forgeFactor * elementFactor;
  };

  // On-Field multipliers: 1.5. Off-Field multipliers: 0.75
  if (activeTeam.onfield) {
    monsterPoints += getMonsterBasePoints(activeTeam.onfield.monster) * 1.5;
    weaponPoints += getWeaponBasePoints(activeTeam.onfield.weapon) * 1.5;
  }
  if (activeTeam.offfield1) {
    monsterPoints += getMonsterBasePoints(activeTeam.offfield1.monster) * 0.75;
    weaponPoints += getWeaponBasePoints(activeTeam.offfield1.weapon) * 0.75;
  }
  if (activeTeam.offfield2) {
    monsterPoints += getMonsterBasePoints(activeTeam.offfield2.monster) * 0.75;
    weaponPoints += getWeaponBasePoints(activeTeam.offfield2.weapon) * 0.75;
  }

  // Max raw at fully-maxed: E6 T6 x2 + E6 ThreatX x1 + F6 Secret Lv30 x3 with 100% element perfection
  // Monsters: 22*(1+19*0.05)*1.5 * 1.50 (Onfield) + 35*(1+29*0.05)*0.75 * 1.50 (Kirin) + 22*(1+19*0.05)*0.75 * 1.50 (Offfield T6) = 241.25
  // Weapons:  8*(1+29*0.05)*1.5 * 1.25 * 3.0 = 110.25
  // Total max = 351.50 → scale so maxed team = PS 100 (using 352.0 as MAX_RAW)
  const MAX_RAW = 352.0;
  const totalPoints = monsterPoints + weaponPoints;
  const basePs = 1 + Math.floor(totalPoints * (99 / MAX_RAW));
  const cappedBasePs = Math.min(100, Math.max(1, basePs));

  // Extra PS from player level: 1 point per 5 levels, up to +20 PS
  const levelBonus = Math.min(20, Math.floor(playerLevel / 5));

  return Math.min(120, cappedBasePs + levelBonus);
}

// Compute player stats including level buffs
function getUserStats(level, team, monsterLevels = {}, weaponLevels = {}) {
  const baseHp = 100 + (level - 1) * 15;
  const baseAtk = 10 + (level - 1) * 3;
  const baseDef = 5 + (level - 1) * 2;

  let hp = baseHp;
  let atk = baseAtk;
  let def = baseDef;
  let healAmount = 0;

  // Default starting Crit stats (10% Chance, 50% Damage)
  let critChance = 0.10;
  let critDamage = 0.50;

  let hpMultiplier = 1.0;
  let defMultiplier = 1.0;
  let atkMultiplier = 1.0;
  let healAmountMult = 1.0;

  let flatHp = 0;
  let flatDef = 0;
  let flatAtk = 0;

  let elementResPen = 0;
  let pen = 0; // DEF ignore
  const activeElements = [];
  let element = null;
  let perfection = 0;
  let elementEff = 0;
  
  let dot = 0;
  let tDmg = 0;
  let vul = 0;

  if (team) {
    let kirinEnchanted = 0;
    let kirinLevel = 0;
    let hasKirinOfffield = false;
    if (team.offfield1 && team.offfield1.monster === 'Kirin') {
      const mData = monsterLevels['Kirin'] || {};
      kirinEnchanted = mData.enchanted || mData.forge || 0;
      kirinLevel = mData.level || 1;
      hasKirinOfffield = true;
    }
    if (team.offfield2 && team.offfield2.monster === 'Kirin') {
      const mData = monsterLevels['Kirin'] || {};
      kirinEnchanted = mData.enchanted || mData.forge || 0;
      kirinLevel = mData.level || 1;
      hasKirinOfffield = true;
    }

    // Helper to get monster stats scaled by its level (+5% per level) and Enchanted level (+10% per enchanted level, +100% at enchanted 6)
    const getMonsterStats = (mName) => {
      const baseMonster = findMonsterByName(mName);
      if (!baseMonster) return null;
      const mData = monsterLevels && monsterLevels[baseMonster.name] ? monsterLevels[baseMonster.name] : {};
      const mLvl = mData.level || 1;
      const mEnchanted = mData.enchanted || mData.forge || 0;

      const levelMult = 1 + (mLvl - 1) * 0.05;
      const enchantedMult = 1 + (mEnchanted >= 6 ? 1.00 : mEnchanted * 0.10);
      const finalMult = levelMult * enchantedMult;

      return {
        hp: Math.floor(baseMonster.hp * finalMult),
        atk: Math.floor(baseMonster.atk * finalMult),
        def: Math.floor(baseMonster.def * finalMult),
        enchanted: mEnchanted
      };
    };

    // Helper to get weapon stats scaled by its level (+5% per level) and Forge level (+10% per forge level, +100% at forge 6)
    const getWeaponStats = (wName) => {
      const baseWp = findWeaponByName(wName);
      if (!baseWp) return null;
      const wData = weaponLevels && weaponLevels[baseWp.name] ? weaponLevels[baseWp.name] : {};
      const wLvl = wData.level || 1;
      const wForge = wData.forge || 0;

      const levelMult = 1 + (wLvl - 1) * 0.05;
      const forgeMult = 1 + (wForge >= 6 ? 1.00 : wForge * 0.10);
      const finalStatMult = levelMult * forgeMult;

      return {
        name: baseWp.name,
        atkBonus: Math.floor((baseWp.atkBonus || 0) * finalStatMult),
        defBonus: Math.floor((baseWp.defBonus || 0) * finalStatMult),
        hpBonus: Math.floor((baseWp.hpBonus || 0) * finalStatMult),
        healAmount: Math.floor((baseWp.healAmount || 0) * finalStatMult),
        critChanceBonus: (baseWp.critChanceBonus || 0) * finalStatMult,
        critDamageBonus: (baseWp.critDamageBonus || 0) * finalStatMult,
        level: wLvl,
        forge: wForge,
        element: wData.element || null,
        perfection: wData.perfection || 0,
        rarity: baseWp.rarity
      };
    };

    const applyWeaponElement = (wpStats) => {
      if (!wpStats || !wpStats.element) return;
      
      const rawElement = wpStats.element;
      const elName = (rawElement === 'Fire' ? 'Blast' : rawElement === 'Water' ? 'Liquid' : rawElement === 'Lightning' ? 'Volt' : rawElement === 'Ice' ? 'Blizzard' : rawElement === 'Dark' ? 'Shadow' : rawElement === 'Light' ? 'Radiant' : rawElement);
      let perf = wpStats.perfection || 0;
      if (hasKirinOfffield && kirinEnchanted >= 2) {
        perf = Math.min(100, perf + 20);
      }
      const wForge = wpStats.forge || 0;
      
      let elEff = (perf / 100) * (wForge >= 6 ? 2.0 : 1.0);
      
      // Shadow Tome F4 Shadow Element Effectiveness Boost (+50%)
      const wpNameNorm = wpStats.rarity === 'secret' && wpStats.name === 'Secret' ? "Jester's Staff" : wpStats.name; // normalize naming
      if (wpNameNorm === 'Shadow Tome' && wForge >= 4 && elName === 'Shadow') {
        elEff += 0.50;
      }
      
      activeElements.push({
        element: elName,
        perfection: perf,
        elementEff: elEff,
        forge: wForge,
        wpName: wpNameNorm
      });

      if (elName === 'Blast') {
        critDamage += 0.30 * elEff;
        atkMultiplier += 0.15 * elEff;
      } else if (elName === 'Liquid') {
        atkMultiplier += 0.40 * elEff;
      } else if (elName === 'Volt') {
        critChance += 0.20 * elEff;
        critDamage += 0.20 * elEff;
      } else if (elName === 'Blizzard') {
        pen += 0.25 * elEff;
        atkMultiplier += 0.10 * elEff;
      } else if (elName === 'Shadow') {
        critDamage += 0.40 * elEff;
        pen += 0.10 * elEff;
      } else if (elName === 'Radiant') {
        atkMultiplier += 0.20 * elEff;
        critChance += 0.10 * elEff;
      } else if (elName === 'Void') {
        atkMultiplier += 0.10 * elEff;
        critChance += 0.10 * elEff;
        critDamage += 0.10 * elEff;
        pen += 0.10 * elEff;
      }
    };

    // 1. On-Field Monster
    if (team.onfield && team.onfield.monster) {
      const monsterStats = getMonsterStats(team.onfield.monster);
      if (monsterStats) {
        hp += monsterStats.hp;
        atk += monsterStats.atk;
        def += monsterStats.def;
        if (monsterStats.enchanted >= 6) {
          critChance += 0.10;
          critDamage += 0.20;
        }
      }
    }

    // 2. Off-Field Monsters (HP/Def only)
    if (team.offfield1 && team.offfield1.monster) {
      const monsterStats = getMonsterStats(team.offfield1.monster);
      if (monsterStats) {
        hp += monsterStats.hp;
        def += monsterStats.def;
        if (monsterStats.enchanted >= 6) {
          critChance += 0.10;
          critDamage += 0.20;
        }
      }
    }
    if (team.offfield2 && team.offfield2.monster) {
      const monsterStats = getMonsterStats(team.offfield2.monster);
      if (monsterStats) {
        hp += monsterStats.hp;
        def += monsterStats.def;
        if (monsterStats.enchanted >= 6) {
          critChance += 0.10;
          critDamage += 0.20;
        }
      }
    }

    // Apply Monster Enchanted Passives (Dire Wolf, Gargoyle, Shadow Wyvern, Ancient Dragon)
    const activeMonsters = [];
    if (team.onfield && team.onfield.monster) {
      const mData = monsterLevels[team.onfield.monster] || {};
      activeMonsters.push({ name: team.onfield.monster, enchanted: mData.enchanted || mData.forge || 0 });
    }
    if (team.offfield1 && team.offfield1.monster) {
      const mData = monsterLevels[team.offfield1.monster] || {};
      activeMonsters.push({ name: team.offfield1.monster, enchanted: mData.enchanted || mData.forge || 0 });
    }
    if (team.offfield2 && team.offfield2.monster) {
      const mData = monsterLevels[team.offfield2.monster] || {};
      activeMonsters.push({ name: team.offfield2.monster, enchanted: mData.enchanted || mData.forge || 0 });
    }

    let direWolfEnchanted = 0;
    let gargoyleEnchanted = 0;
    let shadowWyvernEnchanted = 0;
    let ancientDragonEnchanted = 0;

    for (const m of activeMonsters) {
      if (m.name === 'Dire Wolf') direWolfEnchanted += m.enchanted;
      else if (m.name === 'Gargoyle') gargoyleEnchanted += m.enchanted;
      else if (m.name === 'Shadow Wyvern') shadowWyvernEnchanted += m.enchanted;
      else if (m.name === 'Ancient Dragon') ancientDragonEnchanted += m.enchanted;
    }

    if (direWolfEnchanted > 0) {
      critChance += direWolfEnchanted * 0.03;
    }
    if (gargoyleEnchanted > 0) {
      defMultiplier += gargoyleEnchanted * 0.08;
    }
    if (shadowWyvernEnchanted > 0) {
      pen += shadowWyvernEnchanted * 0.05;
    }
    if (ancientDragonEnchanted > 0) {
      hpMultiplier += ancientDragonEnchanted * 0.04;
      atkMultiplier += ancientDragonEnchanted * 0.04;
      defMultiplier += ancientDragonEnchanted * 0.04;
    }

    if (hasKirinOfffield) {
      // 1. Level-based passive traits (cumulative)
      if (kirinLevel >= 5) {
        critChance += 0.05;
      }
      if (kirinLevel >= 10) {
        defMultiplier += 0.10;
      }
      if (kirinLevel >= 15) {
        atkMultiplier += 0.10;
      }
      if (kirinLevel >= 20) {
        hpMultiplier += 0.15;
      }
      if (kirinLevel >= 25) {
        pen += 0.15;
      }
      if (kirinLevel >= 30) {
        atkMultiplier += 0.20;
        defMultiplier += 0.20;
        hpMultiplier += 0.20;
      }

      // 2. Enchantment-based stat implants (E1-E6)
      if (kirinEnchanted >= 1) {
        tDmg += 50 * kirinEnchanted;
        critChance += 0.05 * kirinEnchanted;
      }
      if (kirinEnchanted >= 2) {
        dot += 100 * (kirinEnchanted - 1);
        vul += 0.10 * (kirinEnchanted - 1);
      }
      if (kirinEnchanted >= 3) {
        pen += 0.10 * (kirinEnchanted - 2);
        tDmg += 100 * (kirinEnchanted - 2);
      }
      if (kirinEnchanted >= 4) {
        dot += 200 * (kirinEnchanted - 3);
        critChance += 0.10 * (kirinEnchanted - 3);
        // E4 Special: +20% ATK & +20% Crit Chance implants (revised/buffed)
        atkMultiplier += 0.20 * (kirinEnchanted - 3);
        critChance += 0.20 * (kirinEnchanted - 3);
      }
      if (kirinEnchanted >= 5) {
        vul += 0.15 * (kirinEnchanted - 4);
        pen += 0.15 * (kirinEnchanted - 4);
      }
      if (kirinEnchanted >= 6) {
        // E6 Special: +50% ATK, +50% DEF, and +150% Crit Damage multipliers (Max CDM)
        atkMultiplier += 0.50;
        defMultiplier += 0.50;
        critDamage += 1.50;
      }
    }

    // 3. Apply On-Field Weapon
    if (team.onfield && team.onfield.weapon) {
      const wpStats = getWeaponStats(team.onfield.weapon);
      if (wpStats) {
        flatAtk += wpStats.atkBonus;
        flatDef += wpStats.defBonus;
        flatHp += wpStats.hpBonus;
        critChance += wpStats.critChanceBonus;
        critDamage += wpStats.critDamageBonus;

        // Apply Forge buffs
        const wForge = wpStats.forge || 0;
        const isMythicPlus = ['mythic', 'supreme', 'secret'].includes(wpStats.rarity);
        if (wForge >= 1) {
          elementResPen += 0.15;
        }
        if (wForge >= 2 && isMythicPlus) {
          critChance += 0.05;
          critDamage += 0.15;
        }
        if (wForge >= 3) {
          atkMultiplier += 0.10;
        }
        if (wForge >= 4 && isMythicPlus) {
          elementResPen += 0.20;
          pen += 0.10;
        }
        if (wForge >= 5) {
          critChance += 0.15;
          critDamage += 0.25;
        }
        if (wForge >= 6 && isMythicPlus) {
          atkMultiplier += 0.15;
          defMultiplier += 0.15;
          elementResPen += 0.30;
        }

        // Apply Weapon Forge 2 Special Abilities
        if (isMythicPlus && wForge >= 2) {
          const wpName = wpStats.rarity === 'secret' && wpStats.name === 'Secret' ? "Jester's Staff" : wpStats.name; // normalize naming
          if (wpName === 'Dragon Bow') {
            critChance += 0.10;
          } else if (wpName === 'Archmage Staff') {
            hpMultiplier += 0.15;
            healAmount += 40;
          } else if (wpName === "Archangel's Harp") {
            critChance += 0.15;
            critDamage += 0.40;
          } else if (wpName === 'Shadow Tome') {
            tDmg += 100;
          } else if (wpName === 'Mjolnir') {
            critDamage += 0.50;
          } else if (wpName === 'Divine Bulwark') {
            defMultiplier += 0.30;
          } else if (wpName === 'Secret Elixir') {
            healAmount += 100;
            hpMultiplier += 0.20;
            atkMultiplier += 0.20;
            defMultiplier += 0.20;
          } else if (wpName === 'Asgardian War-Horn') {
            atkMultiplier += 0.30;
            critChance += 0.10;
          } else if (wpName === 'Aegis Breaker') {
            pen += 0.30;
            tDmg += 150;
          } else if (wpName === 'Poison Butterfly Knife') {
            dot += 200;
          } else if (wpName === 'Golden Kukri') {
            defMultiplier += 0.20;
          } else if (wpName === "Jester's Staff") {
            atkMultiplier += 0.30;
            critChance += 0.15;
          } else if (wpName === 'Amrita Bell') {
            dot += 200;
            vul += 0.20;
            atkMultiplier += 0.30;
            critChance += 0.15;
          }
        }

        // Apply Weapon Forge 4 Special Abilities
        if (isMythicPlus && wForge >= 4) {
          const wpName = wpStats.rarity === 'secret' && wpStats.name === 'Secret' ? "Jester's Staff" : wpStats.name; // normalize naming
          if (wpName === 'Dragon Bow') {
            critChance += 0.15;
          } else if (wpName === "Archangel's Harp") {
            defMultiplier += 0.15;
          } else if (wpName === 'Shadow Tome') {
            tDmg += 80;
          } else if (wpName === 'Secret Elixir') {
            healAmount += 80;
            hpMultiplier += 0.15;
            atkMultiplier += 0.15;
            defMultiplier += 0.15;
          } else if (wpName === 'Asgardian War-Horn') {
            atkMultiplier += 0.20;
            defMultiplier += 0.15;
          } else if (wpName === 'Aegis Breaker') {
            pen += 0.40;
          } else if (wpName === 'Poison Butterfly Knife') {
            critChance += 0.15;
          } else if (wpName === 'Amrita Bell') {
            pen += 0.30;
            vul += 0.30;
            tDmg += 200;
          }
        }

        // Apply On-field weapon element buffs
        applyWeaponElement(wpStats);
      }
    }

    // 4. Apply Off-Field Weapons & Passives
    const checkOfffieldWeapon = (wpName) => {
      if (!wpName) return;
      const wpStats = getWeaponStats(wpName);
      if (!wpStats) return;

      flatAtk += wpStats.atkBonus;
      flatDef += wpStats.defBonus;
      flatHp += wpStats.hpBonus;
      critChance += wpStats.critChanceBonus;
      critDamage += wpStats.critDamageBonus;

      // Apply Forge buffs
      const wForge = wpStats.forge || 0;
      const isMythicPlus = ['mythic', 'supreme', 'secret'].includes(wpStats.rarity);
      if (wForge >= 1) {
        elementResPen += 0.15;
      }
      if (wForge >= 2 && isMythicPlus) {
        critChance += 0.05;
        critDamage += 0.15;
      }
      if (wForge >= 3) {
        atkMultiplier += 0.10;
      }
      if (wForge >= 4 && isMythicPlus) {
        elementResPen += 0.20;
        pen += 0.10;
      }
      if (wForge >= 5) {
        critChance += 0.15;
        critDamage += 0.25;
      }
      if (wForge >= 6 && isMythicPlus) {
        atkMultiplier += 0.15;
        defMultiplier += 0.15;
        elementResPen += 0.30;
      }

      // Apply Weapon Forge 2 Special Abilities
      if (isMythicPlus && wForge >= 2) {
        const wpNameNorm = wpStats.rarity === 'secret' && wpStats.name === 'Secret' ? "Jester's Staff" : wpStats.name;
        if (wpNameNorm === 'Dragon Bow') {
          critChance += 0.10;
        } else if (wpNameNorm === 'Archmage Staff') {
          hpMultiplier += 0.15;
          healAmount += 40;
        } else if (wpNameNorm === "Archangel's Harp") {
          critChance += 0.15;
          critDamage += 0.40;
        } else if (wpNameNorm === 'Shadow Tome') {
          tDmg += 100;
        } else if (wpNameNorm === 'Mjolnir') {
          critDamage += 0.50;
        } else if (wpNameNorm === 'Divine Bulwark') {
          defMultiplier += 0.30;
        } else if (wpNameNorm === 'Secret Elixir') {
          healAmount += 100;
          hpMultiplier += 0.20;
          atkMultiplier += 0.20;
          defMultiplier += 0.20;
        } else if (wpNameNorm === 'Asgardian War-Horn') {
          atkMultiplier += 0.30;
          critChance += 0.10;
        } else if (wpNameNorm === 'Aegis Breaker') {
          pen += 0.30;
          tDmg += 150;
        } else if (wpNameNorm === 'Poison Butterfly Knife') {
          dot += 200;
        } else if (wpNameNorm === 'Golden Kukri') {
          defMultiplier += 0.20;
        } else if (wpNameNorm === "Jester's Staff") {
          atkMultiplier += 0.30;
          critChance += 0.15;
        } else if (wpNameNorm === 'Amrita Bell') {
          dot += 200;
          vul += 0.20;
          atkMultiplier += 0.30;
          critChance += 0.15;
        }
      }

      // Apply Weapon Forge 4 Special Abilities
      if (isMythicPlus && wForge >= 4) {
        const wpNameNorm = wpStats.rarity === 'secret' && wpStats.name === 'Secret' ? "Jester's Staff" : wpStats.name;
        if (wpNameNorm === 'Dragon Bow') {
          critChance += 0.15;
        } else if (wpNameNorm === "Archangel's Harp") {
          defMultiplier += 0.15;
        } else if (wpNameNorm === 'Shadow Tome') {
          tDmg += 80;
        } else if (wpNameNorm === 'Secret Elixir') {
          healAmount += 80;
          hpMultiplier += 0.15;
          atkMultiplier += 0.15;
          defMultiplier += 0.15;
        } else if (wpNameNorm === 'Asgardian War-Horn') {
          atkMultiplier += 0.20;
          defMultiplier += 0.15;
        } else if (wpNameNorm === 'Aegis Breaker') {
          pen += 0.40;
        } else if (wpNameNorm === 'Poison Butterfly Knife') {
          critChance += 0.15;
        } else if (wpNameNorm === 'Amrita Bell') {
          pen += 0.30;
          vul += 0.30;
          tDmg += 200;
        }
      }
      
      const pScale = 1 + wForge * 0.1;
      let baseHeal = wpStats.healAmount || 0;
      healAmount += baseHeal;

      const lvl = wpStats.level;
      if (lvl >= 5) {
        if (wpName === 'Buckler Shield') {
          flatDef += 4;
          if (lvl >= 10) flatDef += 8;
          if (lvl >= 25) flatDef += 20;
        } else if (wpName === 'Novice Staff') {
          healAmount -= baseHeal;
          healAmount += 4 * pScale;
          if (lvl >= 10) flatDef += 5;
          if (lvl >= 15) healAmount += 8 * pScale;
          if (lvl >= 25) healAmount += 20 * pScale;
          if (lvl >= 30) {
            hpMultiplier += 0.15;
          }
        } else if (wpName === 'Round Shield') {
          defMultiplier += 0.10;
          if (lvl >= 15) hpMultiplier += 0.10;
          if (lvl >= 20) defMultiplier += 0.20;
          if (lvl >= 25) {
            defMultiplier += 0.15;
            hpMultiplier += 0.15;
          }
        } else if (wpName === 'Apprentice Wand') {
          healAmount -= baseHeal;
          healAmount += 10 * pScale;
          if (lvl >= 10) hpMultiplier += 0.10;
          if (lvl >= 20) {
            healAmount += 25 * pScale;
            atkMultiplier += 0.10;
          }
          if (lvl >= 25) {
            healAmount += 40 * pScale;
            hpMultiplier += 0.15;
          }
          if (lvl >= 30) {
            healAmount += 75 * pScale;
            atkMultiplier += 0.20;
          }
        } else if (wpName === 'Knight\'s Aegis') {
          if (lvl >= 10) {
            flatDef += 40;
            flatHp += 100;
          }
          if (lvl >= 20) {
            healAmount += 20 * pScale;
          }
          if (lvl >= 25) {
            flatDef += 80;
            flatHp += 200;
          }
          if (lvl >= 30) {
            defMultiplier += 0.15;
            healAmount += 30 * pScale;
          }
        } else if (wpName === 'Archmage Staff') {
          healAmount -= baseHeal;
          healAmount += 25 * pScale;
          if (lvl >= 20) {
            healAmount += 50 * pScale;
          }
          if (lvl >= 25) {
            healAmount += 80 * pScale;
          }
          if (lvl >= 30) {
            healAmount += 120 * pScale;
            hpMultiplier += 0.20;
          }
        } else if (wpName === 'Divine Bulwark') {
          if (lvl >= 10) {
            hpMultiplier += 0.20;
            defMultiplier += 0.20;
          }
          if (lvl >= 20) {
            healAmount += 50 * pScale;
          }
          if (lvl >= 25) {
            hpMultiplier += 0.30;
            defMultiplier += 0.30;
          }
          if (lvl >= 30) {
            defMultiplier += 0.40;
            healAmount += 50 * pScale;
          }
        } else if (wpName === 'Secret Elixir') {
          healAmount -= baseHeal;
          healAmount += 60 * pScale;
          if (lvl >= 10) {
            hpMultiplier += 0.25;
            atkMultiplier += 0.25;
            defMultiplier += 0.25;
          }
          if (lvl >= 15) {
            healAmount += 100 * pScale;
          }
          if (lvl >= 20) {
            healAmount += 150 * pScale;
            hpMultiplier += 0.40;
            atkMultiplier += 0.40;
            defMultiplier += 0.40;
          }
          if (lvl >= 25) {
            healAmount += 200 * pScale;
            hpMultiplier += 0.50;
            atkMultiplier += 0.50;
            defMultiplier += 0.50;
          }
          if (lvl >= 30) {
            healAmount += 300 * pScale;
            hpMultiplier += 0.65;
            atkMultiplier += 0.65;
            defMultiplier += 0.65;
          }
        } else if (wpName === 'Worn Warhorn') {
          flatAtk += 2;
          if (lvl >= 10) flatDef += 4;
          if (lvl >= 15) flatAtk += 5;
          if (lvl >= 20) critChance += 0.05;
          if (lvl >= 25) flatAtk += 10;
          if (lvl >= 30) critDamage += 0.15;
        } else if (wpName === 'Commander\'s Banner') {
          flatAtk += 4;
          flatDef += 2;
          if (lvl >= 10) defMultiplier += 0.05;
          if (lvl >= 15) flatAtk += 8;
          if (lvl >= 20) {
            critChance += 0.05;
            critDamage += 0.10;
          }
          if (lvl >= 25) {
            flatAtk += 15;
            flatDef += 5;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.10;
            defMultiplier += 0.10;
          }
        } else if (wpName === 'Focusing Lens') {
          if (lvl >= 5) critChance += 0.03;
          if (lvl >= 10) critChance += 0.06;
          if (lvl >= 15) critDamage += 0.15;
          if (lvl >= 20) {
            critChance += 0.10;
            critDamage += 0.20;
          }
          if (lvl >= 25) critChance += 0.15;
          if (lvl >= 30) {
            critChance += 0.20;
            critDamage += 0.35;
          }
        } else if (wpName === 'Inspiring Scepter') {
          if (lvl >= 5) atkMultiplier += 0.05;
          if (lvl >= 10) critDamage += 0.10;
          if (lvl >= 15) {
            atkMultiplier += 0.10;
            critDamage += 0.15;
          }
          if (lvl >= 20) {
            atkMultiplier += 0.15;
            critChance += 0.05;
          }
          if (lvl >= 25) {
            atkMultiplier += 0.20;
            critDamage += 0.25;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.25;
            critChance += 0.10;
            critDamage += 0.40;
          }
        } else if (wpName === 'Valor Ring') {
          if (lvl >= 5) atkMultiplier += 0.08;
          if (lvl >= 10) {
            critChance += 0.05;
            critDamage += 0.15;
          }
          if (lvl >= 15) {
            atkMultiplier += 0.12;
            defMultiplier += 0.10;
          }
          if (lvl >= 20) {
            atkMultiplier += 0.15;
            critChance += 0.08;
            critDamage += 0.20;
          }
          if (lvl >= 25) {
            atkMultiplier += 0.20;
            defMultiplier += 0.15;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.25;
            critChance += 0.12;
            critDamage += 0.40;
          }
        } else if (wpName === 'Archangel\'s Harp') {
          if (lvl >= 5) critChance += 0.10;
          if (lvl >= 10) critDamage += 0.25;
          if (lvl >= 15) {
            critChance += 0.15;
            critDamage += 0.35;
          }
          if (lvl >= 20) {
            atkMultiplier += 0.15;
            critChance += 0.15;
            critDamage += 0.45;
          }
          if (lvl >= 25) {
            atkMultiplier += 0.20;
            critChance += 0.20;
            critDamage += 0.60;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.30;
            critChance += 0.25;
            critDamage += 0.80;
          }
        } else if (wpName === 'Asgardian War-Horn') {
          if (lvl >= 5) {
            atkMultiplier += 0.15;
            critChance += 0.08;
          }
          if (lvl >= 10) {
            atkMultiplier += 0.20;
            critDamage += 0.30;
          }
          if (lvl >= 15) {
            atkMultiplier += 0.25;
            critChance += 0.12;
            critDamage += 0.40;
          }
          if (lvl >= 20) {
            atkMultiplier += 0.30;
            critChance += 0.15;
            critDamage += 0.60;
          }
          if (lvl >= 25) {
            atkMultiplier += 0.40;
            critChance += 0.20;
            critDamage += 0.75;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.50;
            critChance += 0.25;
            critDamage += 1.00;
          }
        } else if (wpName === 'Jester\'s Staff') {
          if (lvl >= 5) {
            atkMultiplier += 0.20;
            critChance += 0.10;
          }
          if (lvl >= 10) {
            critDamage += 0.30;
          }
          if (lvl >= 15) {
            atkMultiplier += 0.25;
            critChance += 0.12;
            critDamage += 0.45;
          }
          if (lvl >= 20) {
            atkMultiplier += 0.35;
            critChance += 0.15;
            critDamage += 0.60;
          }
          if (lvl >= 25) {
            atkMultiplier += 0.45;
            critChance += 0.20;
            critDamage += 0.80;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.60;
            critChance += 0.25;
            critDamage += 1.20;
          }
        } else if (wpName === 'Amrita Bell') {
          if (lvl >= 5) {
            dot += 100 * pScale;
            vul += 0.10 * pScale;
            atkMultiplier += 0.30;
            critChance += 0.15;
          }
          if (lvl >= 10) {
            pen += 0.25;
            vul += 0.25;
          }
          if (lvl >= 25) {
            pen += 0.40;
            critDamage += 0.50;
          }
          if (lvl >= 30) {
            atkMultiplier += 0.50;
            critChance += 0.20;
            pen += 0.30;
          }
        }
      }
      applyWeaponElement(wpStats);
    };

    if (team.offfield1) checkOfffieldWeapon(team.offfield1.weapon);
    if (team.offfield2) checkOfffieldWeapon(team.offfield2.weapon);

    if (activeElements.length > 0) {
      element = activeElements[0].element;
      perfection = activeElements[0].perfection;
      elementEff = activeElements[0].elementEff;
    }

    // Apply flat adjustments
    hp += flatHp;
    atk += flatAtk;
    def += flatDef;

    // Apply multipliers
    hp = Math.floor(hp * hpMultiplier);
    atk = Math.floor(atk * atkMultiplier);
    def = Math.floor(def * defMultiplier);

    // Golden Kukri On-Field Passive (adds ATK to DEF conversion if weapon level >= 5)
    if (team.onfield && team.onfield.weapon === 'Golden Kukri') {
      const wpStats = getWeaponStats(team.onfield.weapon);
      if (wpStats && wpStats.level >= 5) {
        const ratio = wpStats.level >= 30 ? 0.60 : wpStats.level >= 25 ? 0.50 : wpStats.level >= 20 ? 0.40 : wpStats.level >= 15 ? 0.30 : wpStats.level >= 10 ? 0.25 : 0.20;
        def += Math.floor(atk * ratio);
      }
    }

    // Excalibur On-Field Passive (adds heal at Level 20)
    if (team.onfield && team.onfield.weapon === 'Excalibur') {
      const wpStats = getWeaponStats(team.onfield.weapon);
      if (wpStats && wpStats.level >= 20) {
        const onfieldForge = wpStats.forge || 0;
        const pScale = 1 + onfieldForge * 0.1;
        healAmount += 15 * pScale;
        if (wpStats.level >= 30) {
          healAmount += 15 * pScale; // total +30 HP/rd
        }
      }
    }

    // Apply Radiant element heal scaling
    if (element === 'Radiant') {
      healAmount = Math.floor(healAmount * healAmountMult);
    }

    // Calculate total DOT, True DMG, and Vuln for display
    const checkWeaponMechanics = (wpName, isOfffield) => {
      if (!wpName) return;
      const wpStats = getWeaponStats(wpName);
      if (!wpStats) return;
      const lvl = wpStats.level;
      const wForge = wpStats.forge || 0;
      const pScale = 1 + wForge * 0.1;

      if (!isOfffield) {
        // On-field weapons
        if (wpName === 'Dragon Bow' && lvl >= 5) {
          dot += (lvl >= 25 ? 80 : lvl >= 15 ? 40 : 15) * pScale;
        } else if (wpName === 'Poison Butterfly Knife') {
          if (lvl >= 5) {
            let pDmg = (lvl >= 30 ? 500 : lvl >= 25 ? 300 : lvl >= 20 ? 150 : lvl >= 15 ? 80 : 40) * pScale;
            if (wForge >= 4) pDmg *= 2;
            dot += pDmg;
          }
        } else if (wpName === 'Rusty Dagger' && lvl >= 10) {
          dot += (lvl >= 25 ? 25 : 5) * pScale;
        } else if (wpName === 'Steel Spear' && lvl >= 15) {
          dot += (lvl >= 25 ? 30 : 12) * pScale;
        } else if (wpName === 'Excalibur' && lvl >= 10) {
          dot += (lvl >= 25 ? 75 : 30) * pScale;
        } else if (wpName === 'Mjolnir' && lvl >= 10) {
          dot += (lvl >= 25 ? 120 : 50) * pScale;
        }
      } else {
        // Off-field support weapons
        if (wpName === 'Archmage Staff' && lvl >= 15) {
          dot += 30 * pScale;
        }
        if (wpName === 'Hexing Totem') {
          if (lvl >= 5) vul += (lvl >= 30 ? 0.30 : lvl >= 25 ? 0.25 : lvl >= 15 ? 0.20 : 0.15) * pScale;
          if (lvl >= 10) tDmg += (lvl >= 30 ? 100 : lvl >= 25 ? 50 : 20) * pScale;
        } else if (wpName === 'Shadow Tome') {
          if (lvl >= 15) vul += (lvl >= 30 ? 0.30 : lvl >= 20 ? 0.20 : 0.15) * pScale;
          if (lvl >= 5) tDmg += (lvl >= 30 ? 250 : lvl >= 25 ? 150 : lvl >= 20 ? 100 : lvl >= 10 ? 60 : 30) * pScale;
        } else if (wpName === 'Aegis Breaker') {
          if (lvl >= 5) vul += (lvl >= 30 ? 0.50 : lvl >= 20 ? 0.40 : 0.30) * pScale;
          if (lvl >= 10) tDmg += (lvl >= 30 ? 500 : lvl >= 25 ? 350 : lvl >= 20 ? 200 : 100) * pScale;
        } else if (wpName === 'Amrita Bell') {
          if (lvl >= 5) {
            dot += 100 * pScale;
            vul += 0.10 * pScale;
          }
          if (lvl >= 10) {
            vul += 0.25 * pScale;
          }
          if (wForge >= 2) {
            dot += 200 * pScale;
            vul += 0.20 * pScale;
          }
          if (wForge >= 4) {
            vul += 0.30 * pScale;
            tDmg += 200 * pScale;
          }
        }
      }
    };

    if (team.onfield) checkWeaponMechanics(team.onfield.weapon, false);
    if (team.offfield1) checkWeaponMechanics(team.offfield1.weapon, true);
    if (team.offfield2) checkWeaponMechanics(team.offfield2.weapon, true);

    // Calculate total DEF Ignore (pen)
    const checkWeaponDefIgnore = (wpName, isOfffield) => {
      if (!wpName) return;
      const wpStats = getWeaponStats(wpName);
      if (!wpStats) return;
      const lvl = wpStats.level;
      const wForge = wpStats.forge || 0;
      if (!isOfffield) {
        if (wpName === 'Steel Spear' && lvl >= 5) {
          pen += lvl >= 25 ? 0.35 : 0.20;
        } else if (wpName === 'Iron Broadsword' && lvl >= 10) {
          pen += lvl >= 30 ? 0.30 : 0.15;
        } else if (wpName === 'Gungnir' && lvl >= 10) {
          pen += lvl >= 25 ? 0.75 : 0.50;
        } else if (wpName === 'Poison Butterfly Knife' && lvl >= 10) {
          pen += lvl >= 25 ? 0.45 : 0.30;
        }
      } else {
        if (wpName === 'Shadow Tome' && lvl >= 30) {
          pen += 0.20;
        } else if (wpName === 'Aegis Breaker') {
          if (lvl >= 30) pen += 0.60;
          else if (lvl >= 15) pen += 0.40;
        } else if (wpName === 'Amrita Bell') {
          if (lvl >= 10) pen += 0.25;
          if (lvl >= 25) pen += 0.40;
          if (lvl >= 30) pen += 0.30;
          if (wForge >= 4) pen += 0.30;
        }
      }
    };
    if (team.onfield) checkWeaponDefIgnore(team.onfield.weapon, false);
    if (team.offfield1) checkWeaponDefIgnore(team.offfield1.weapon, true);
    if (team.offfield2) checkWeaponDefIgnore(team.offfield2.weapon, true);
  }

  const levelMultiplier = 1 + (level - 1) * 0.1;
  atk = Math.floor(atk * levelMultiplier);

  return { hp, atk, def, healAmount, level, critChance, critDamage, pen, elementResPen, element, perfection, elementEff, activeElements, dot, tDmg, vul };
}

/// Simulates round-by-round battle
function simulateBattle(playerStats, monster, activeTeam, weaponLevels = {}, monsterLevels = {}) {
  let playerHp = playerStats.hp;
  let playerMaxHp = playerStats.hp;

  let hasKirin = false;
  let kirinE = 0;
  let kirinL = 1;
  if (activeTeam) {
    if (activeTeam.offfield1 && activeTeam.offfield1.monster === 'Kirin') {
      hasKirin = true;
      const mData = monsterLevels['Kirin'] || {};
      kirinE = mData.enchanted || mData.forge || 0;
      kirinL = mData.level || 1;
    }
    if (activeTeam.offfield2 && activeTeam.offfield2.monster === 'Kirin') {
      hasKirin = true;
      const mData = monsterLevels['Kirin'] || {};
      kirinE = mData.enchanted || mData.forge || 0;
      kirinL = mData.level || 1;
    }
  }
  
  // Scale monster HP and ATK based on player's Power Scaling (PS) and Tier
  const ps = getPowerScaling(activeTeam, monsterLevels, weaponLevels, playerStats.level || 1);

  let tierHpMult = 1.0;
  let tierAtkMult = 1.0;
  let tierDefMult = 1.0;
  if (monster.tier === 'blessed') {
    tierHpMult = 1.5;
    tierAtkMult = 1.3;
    tierDefMult = 1.2;
  } else if (monster.tier === 'enchanted') {
    tierHpMult = 2.0;
    tierAtkMult = 1.6;
    tierDefMult = 1.3;
  } else if (monster.tier === 'overpowered') {
    tierHpMult = 3.0;
    tierAtkMult = 2.5;
    tierDefMult = 1.5;
  } else if (monster.tier === 'chronicle') {
    tierHpMult = 6.0;
    tierAtkMult = 15.0;
    tierDefMult = 8.0;
  } else if (monster.tier === 'prodigy') {
    tierHpMult = 15.0;
    tierAtkMult = 35.0;
    tierDefMult = 15.0;
  } else if (monster.tier === 'beyond') {
    tierHpMult = 30.0;
    tierAtkMult = 60.0;
    tierDefMult = 30.0;
  }

  // Scale HP dynamically using a hybrid curve (+14% mult + 75 flat HP per PS above 1, scaled by level factor) to ensure balance
  const pLvl = playerStats.level || 1;
  const hpMult = 1 + (ps - 1) * 0.14;
  const levelMultiplier = 1 + (pLvl - 1) * 0.1;
  let maxMonsterHp = Math.floor((monster.hp * hpMult + (ps - 1) * 75 * (pLvl / 20)) * tierHpMult * levelMultiplier);
  if (hasKirin) {
    maxMonsterHp = Math.floor(maxMonsterHp * 2.5); // Kirin makes enemy HP 2.5x thicker
  }
  let monsterHp = maxMonsterHp;

  // Scale ATK moderately (+6% per PS point above 1)
  const atkMult = 1 + (ps - 1) * 0.06;
  const monsterScaledAtk = Math.floor(monster.atk * atkMult * tierAtkMult);
  let currentMonsterAtk = monsterScaledAtk;

  const enemyBaseDef = Math.floor(monster.def * tierDefMult);
  
  let healAmount = playerStats.healAmount || 0;

  const rounds = [];
  let roundNum = 1;

  // Resolve equipped weapons for passives
  const getWpLvl = (wpName) => {
    if (!wpName) return 1;
    return (weaponLevels && weaponLevels[wpName] ? weaponLevels[wpName].level : 1) || 1;
  };
  const getWpForge = (wpName) => {
    if (!wpName) return 0;
    return (weaponLevels && weaponLevels[wpName] ? weaponLevels[wpName].forge : 0) || 0;
  };

  const onfieldWeapon = activeTeam && activeTeam.onfield ? findWeaponByName(activeTeam.onfield.weapon) : null;
  const onfieldLvl = onfieldWeapon ? getWpLvl(onfieldWeapon.name) : 1;
  const onfieldForge = onfieldWeapon ? getWpForge(onfieldWeapon.name) : 0;

  const off1Weapon = activeTeam && activeTeam.offfield1 ? findWeaponByName(activeTeam.offfield1.weapon) : null;
  const off1Lvl = off1Weapon ? getWpLvl(off1Weapon.name) : 1;
  const off1Forge = off1Weapon ? getWpForge(off1Weapon.name) : 0;

  const off2Weapon = activeTeam && activeTeam.offfield2 ? findWeaponByName(activeTeam.offfield2.weapon) : null;
  const off2Lvl = off2Weapon ? getWpLvl(off2Weapon.name) : 1;
  const off2Forge = off2Weapon ? getWpForge(off2Weapon.name) : 0;

  // Detect if monster is an Elite Tier Monster
  const isEliteMonster = ['overpowered', 'chronicle', 'prodigy', 'beyond'].includes(monster.tier);

  // Weapon Special Ability states
  let isMonsterHealingDisabled = false;
  let amritaBellReviveUsed = false;
  let monsterStunnedTurns = 0;
  let playerTrueDmgMultiplier = 1.0;
  let scytheEliteExecuteActive = false;
  let doubleAttackChanceForge6 = 0;
  let archmageStaffEliteRed = 0.0;
  let secretElixirEliteRevived = false;
  
  // Amrita Bell and base stats overrides
  let baseDot = playerStats.dot || 0;
  let baseVul = playerStats.vul || 0;
  let baseTDmg = playerStats.tDmg || 0;
  let hasAmritaBellF2 = false;
  let dotTrueDmgMultiplier = 1.0;
  let amritaBellVulnStacks = 0;

  // Element-based next round carryover stats
  let nextRoundElementAtkMult = 0;
  let nextRoundElementCritChance = 0;
  let nextRoundElementCritDamage = 0;
  let nextRoundElementPen = 0;
  let nextRoundElementVuln = 0;
  let nextRoundElementTrueDmg = 0;

  // Gather equipped weapons list with secret normalization
  const equippedWeapons = [];
  const normalizeName = (name, rarity) => (rarity === 'secret' && name === 'Secret' ? "Jester's Staff" : name);
  if (onfieldWeapon) equippedWeapons.push({ name: normalizeName(onfieldWeapon.name, onfieldWeapon.rarity), forge: onfieldForge, rarity: onfieldWeapon.rarity, slot: 'onfield' });
  if (off1Weapon) equippedWeapons.push({ name: normalizeName(off1Weapon.name, off1Weapon.rarity), forge: off1Forge, rarity: off1Weapon.rarity, slot: 'offfield1' });
  if (off2Weapon) equippedWeapons.push({ name: normalizeName(off2Weapon.name, off2Weapon.rarity), forge: off2Forge, rarity: off2Weapon.rarity, slot: 'offfield2' });

  const onfieldWpName = onfieldWeapon ? normalizeName(onfieldWeapon.name, onfieldWeapon.rarity) : '';
  const off1WpName = off1Weapon ? normalizeName(off1Weapon.name, off1Weapon.rarity) : '';
  const off2WpName = off2Weapon ? normalizeName(off2Weapon.name, off2Weapon.rarity) : '';

  // Evaluate Weapon Forge Special Abilities (Restricted to Mythic+)
  for (const wp of equippedWeapons) {
    const isMythicPlus = ['mythic', 'supreme', 'secret'].includes(wp.rarity);
    if (!isMythicPlus) continue;

    if (wp.name === 'Amrita Bell' && wp.forge >= 2) {
      hasAmritaBellF2 = true;
    }

    // Forge 6 Ability (Active against Elite Monsters)
    if (wp.forge >= 6 && isEliteMonster) {
      if (wp.name === "Jester's Staff" || wp.name === "Aegis Breaker") {
        playerMaxHp = playerStats.hp * 3;
        playerHp = playerMaxHp;
        playerTrueDmgMultiplier = 2.2;
        rounds.push(`✨ **[Forge 6] ${wp.name} Elite Slayer**: Player Max HP increased to ${playerMaxHp} (+200%) and True Damage increased by +120%!`);
      } else if (wp.name === "Dragon Bow") {
        // Handled inside round loop (dmgMultiplier and DEF ignore)
      } else if (wp.name === "Archmage Staff") {
        archmageStaffEliteRed = 0.30;
      } else if (wp.name === "Archangel's Harp") {
        playerStats.critChance += 0.30;
        playerStats.critDamage += 1.00;
        playerStats.def = Math.floor(playerStats.def * 1.5);
        rounds.push(`✨ **[Forge 6] Archangel's Harp Elite Slayer**: Player DEF +50%, Crit Chance +30%, Crit Damage +100%!`);
      } else if (wp.name === "Shadow Tome") {
        playerStats.atk = Math.floor(playerStats.atk * 1.5);
        playerStats.pen += 0.50;
        rounds.push(`✨ **[Forge 6] Shadow Tome Elite Slayer**: Player ATK +50%, ignores +50% DEF, and Curse deals +300 True Damage/rd!`);
      } else if (wp.name === "Mjolnir") {
        playerStats.critChance += 0.30;
      } else if (wp.name === "Gungnir") {
        doubleAttackChanceForge6 = 0.50;
      } else if (wp.name === "Divine Bulwark") {
        playerMaxHp = playerStats.hp * 3;
        playerHp = playerMaxHp;
        playerStats.def = playerStats.def * 2;
        rounds.push(`✨ **[Forge 6] Divine Bulwark Elite Slayer**: Player Max HP +200%, DEF +100%, and reflects 50% of damage taken!`);
      } else if (wp.name === "Secret Elixir") {
        playerStats.atk = playerStats.atk * 2;
        rounds.push(`✨ **[Forge 6] Secret Elixir Elite Slayer**: Player ATK +100% and will revive with 50% Max HP!`);
      } else if (wp.name === "Asgardian War-Horn") {
        playerStats.atk = Math.floor(playerStats.atk * 2.2);
        playerStats.def = Math.floor(playerStats.def * 1.4);
        playerStats.critChance += 0.20;
        rounds.push(`✨ **[Forge 6] Asgardian War-Horn Elite Slayer**: Player ATK +120%, DEF +40%, Crit Chance +20%!`);
      } else if (wp.name === "Lethalized Dark Scythe") {
        scytheEliteExecuteActive = true;
      } else if (wp.name === "Poison Butterfly Knife") {
        playerStats.critChance += 0.40;
        playerStats.critDamage += 1.20;
        playerStats.pen += 0.50;
        rounds.push(`✨ **[Forge 6] Poison Butterfly Knife Elite Slayer**: Crit Chance +40%, Crit Damage +120%, ignores +50% DEF!`);
      } else if (wp.name === "Golden Kukri") {
        playerStats.atk = playerStats.atk * 2;
        playerStats.critChance += 0.50;
        rounds.push(`✨ **[Forge 6] Golden Kukri Elite Slayer**: Player ATK +100%, Crit Chance +50%, reflects 50% of damage taken!`);
      } else if (wp.name === "Amrita Bell") {
        playerStats.atk = playerStats.atk * 2;
        playerStats.critChance += 0.20;
        playerStats.critDamage += 1.00;
        playerStats.pen += 0.50;
        dotTrueDmgMultiplier = 2.0;
        isMonsterHealingDisabled = true;
        rounds.push(`✨ **[Forge 6] Amrita Bell Cosmic Resonance**: Against Elite, Player ATK +100%, Crit Chance +20%, Crit Damage +100%, DOT/True Damage +100%, ignores 50% monster DEF, and disables monster passive regeneration!`);
      }
    }
  }

  // Gather active monsters for enchanted passives
  const activeMonsters = [];
  if (activeTeam) {
    if (activeTeam.onfield && activeTeam.onfield.monster) {
      const mData = monsterLevels[activeTeam.onfield.monster] || {};
      activeMonsters.push({ name: activeTeam.onfield.monster, enchanted: mData.enchanted || mData.forge || 0 });
    }
    if (activeTeam.offfield1 && activeTeam.offfield1.monster) {
      const mData = monsterLevels[activeTeam.offfield1.monster] || {};
      activeMonsters.push({ name: activeTeam.offfield1.monster, enchanted: mData.enchanted || mData.forge || 0 });
    }
    if (activeTeam.offfield2 && activeTeam.offfield2.monster) {
      const mData = monsterLevels[activeTeam.offfield2.monster] || {};
      activeMonsters.push({ name: activeTeam.offfield2.monster, enchanted: mData.enchanted || mData.forge || 0 });
    }
  }

  let slimeEnchanted = 0;
  let wildBoarEnchanted = 0;
  let orcEnchanted = 0;
  let golemEnchanted = 0;
  let griffinEnchanted = 0;
  let phoenixEnchanted = 0;
  let behemothEnchanted = 0;

  for (const m of activeMonsters) {
    if (m.name === 'Slime') slimeEnchanted += m.enchanted;
    else if (m.name === 'Wild Boar') wildBoarEnchanted += m.enchanted;
    else if (m.name === 'Orc Warrior') orcEnchanted += m.enchanted;
    else if (m.name === 'Golem') golemEnchanted += m.enchanted;
    else if (m.name === 'Griffin') griffinEnchanted += m.enchanted;
    else if (m.name === 'Phoenix') phoenixEnchanted += m.enchanted;
    else if (m.name === 'Behemoth') behemothEnchanted += m.enchanted;
  }

  // Apply Slime enchanted passive (reduces enemy ATK by 2% per enchanted level)
  if (slimeEnchanted > 0) {
    const atkRed = slimeEnchanted * 0.02;
    currentMonsterAtk = Math.max(1, Math.floor(currentMonsterAtk * (1 - atkRed)));
  }

  // Apply start of battle support weapon ATK debuffs
  let atkDebuffRatio = 0.0;
  const checkAtkDebuff = (wp, lvl, forge) => {
    if (!wp) return;
    const scale = 1 + forge * 0.1;
    if (wp.name === 'Hexing Totem') {
      if (lvl >= 30) atkDebuffRatio += 0.15 * scale;
      else if (lvl >= 20) atkDebuffRatio += 0.10 * scale;
    } else if (wp.name === 'Aegis Breaker') {
      if (lvl >= 30) atkDebuffRatio += 0.20 * scale;
    } else if (wp.name === 'Amrita Bell') {
      // Removed defensive ATK debuff to keep weapon fully offensive/debuffer
    }
  };
  checkAtkDebuff(off1Weapon, off1Lvl, off1Forge);
  checkAtkDebuff(off2Weapon, off2Lvl, off2Forge);
  if (atkDebuffRatio > 0) {
    currentMonsterAtk = Math.max(1, Math.floor(currentMonsterAtk * (1 - atkDebuffRatio)));
  }

  // Generate monster element affinity, resistances, and weakness cycle
  const ELEMENTS = ['Blast', 'Liquid', 'Volt', 'Blizzard', 'Shadow', 'Radiant', 'Void'];
  const monsterAffinity = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
  
  const ELEMENT_COUNTERS = {
    Blast: 'Liquid',
    Liquid: 'Volt',
    Volt: 'Blizzard',
    Blizzard: 'Blast',
    Shadow: 'Radiant',
    Radiant: 'Shadow',
    Void: 'Void'
  };
  const monsterWeakness = ELEMENT_COUNTERS[monsterAffinity];

  // Set resistances: monster resists its own Affinity + 1 other random element
  const monsterResistances = [monsterAffinity];
  if (monsterAffinity !== 'Void') {
    const otherElements = ELEMENTS.filter(e => e !== monsterAffinity && e !== 'Void');
    const randomResist = otherElements[Math.floor(Math.random() * otherElements.length)];
    monsterResistances.push(randomResist);
  }

  rounds.push(`⚔️ Battle Starts! Monster Affinity: **${monsterAffinity}** (Weak to: **${monsterWeakness}** [1.5x DMG], Resists: **${monsterResistances.join(', ')}** [40% damage reduction]).`);
  if (isMonsterHealingDisabled) {
    rounds.push(`✨ **Abilities Enabled**: Monster healing is completely disabled!`);
  }

  // Amrita Bell Level 20 Nirvana Blessing: Start of battle debuff
  let hasAmritaBellL20 = false;
  for (const wp of equippedWeapons) {
    if (wp.name === "Amrita Bell" && getWpLvl(wp.name) >= 20) {
      hasAmritaBellL20 = true;
    }
  }
  if (hasAmritaBellL20) {
    baseDot += 300;
    baseVul += 0.30;
    rounds.push(`✨ **[Nirvana Blessing] Amrita Bell**: Inflicts 300 Poison DOT and +30% Vulnerability on the monster for the rest of the battle!`);
  }

  // Revive state trackers
  let archmageHealUsed = false;
  let noviceReviveUsed = false;
  let elixirReviveUsed = false;
  let phoenixReviveUsed = false;
  let totalDamageDealt = 0;
  let nextRoundStunned = false;

  const maxRounds = monster.tier === 'beyond' ? 25 : (monster.tier === 'prodigy' || monster.tier === 'overpowered') ? 20 : monster.tier === 'chronicle' ? 15 : 10;
  
  // Carryover variables active for this round
  let roundElementAtkMult = 0;
  let roundElementCritChance = 0;
  let roundElementCritDamage = 0;
  let roundElementPen = 0;
  let roundElementVuln = 0;
  let roundElementTrueDmg = 0;

  while (playerHp > 0 && monsterHp > 0 && roundNum <= maxRounds) {
    // Ticks at the start of the round (e.g. shadow true damage carried over from last round)
    if (roundElementTrueDmg > 0 && monsterHp > 0) {
      monsterHp -= roundElementTrueDmg;
      totalDamageDealt += roundElementTrueDmg;
      rounds.push(`Round ${roundNum} (Shadow Curse Tick): Deals ${roundElementTrueDmg} true damage from the previous round's Curse! Monster HP: ${Math.max(0, monsterHp)}`);
      if (monsterHp <= 0) break;
    }

    // Capture the current round element stats
    roundElementAtkMult = nextRoundElementAtkMult;
    roundElementCritChance = nextRoundElementCritChance;
    roundElementCritDamage = nextRoundElementCritDamage;
    roundElementPen = nextRoundElementPen;
    roundElementVuln = nextRoundElementVuln;
    roundElementTrueDmg = nextRoundElementTrueDmg;

    // Reset next round elements
    nextRoundElementAtkMult = 0;
    nextRoundElementCritChance = 0;
    nextRoundElementCritDamage = 0;
    nextRoundElementPen = 0;
    nextRoundElementVuln = 0;
    nextRoundElementTrueDmg = 0;

    // 1. Player attacks monster
    let dmgMultiplier = 1.0;
    let passiveLabel = '';
    let flatBonusDmg = 0;
    let isCrit = false;

    // Check stun
    let monsterStunnedThisRound = false;
    if (monsterStunnedTurns > 0) {
      monsterStunnedTurns--;
      monsterStunnedThisRound = true;
    }
    if (nextRoundStunned) {
      monsterStunnedThisRound = true;
      nextRoundStunned = false;
    }

    const isEliteTier = ['overpowered', 'chronicle', 'prodigy', 'beyond'].includes(monster.tier);
    if (isEliteTier && roundNum === 1) {
      const passiveName = monster.tier === 'beyond' ? 'Existential Terror' : monster.tier === 'prodigy' ? 'Transcended Form' : 'Dread Presence';
      const atkCut = monster.tier === 'beyond' ? 30 : 20;
      rounds.push(`Round 1 (${passiveName}): Player is overwhelmed, reducing their ATK by ${atkCut}%!`);
    }
    if (roundNum === 1 && atkDebuffRatio > 0) {
      rounds.push(`Round 1 (Weakening Aura): Support weapons reduce the monster's ATK by ${Math.round(atkDebuffRatio * 100)}%!`);
    }

    let playerAtk = playerStats.atk;
    
    // Apply weakness-based ATK boost and baseline element damage multiplier for all active elements
    if (playerStats.activeElements && playerStats.activeElements.length > 0) {
      for (const elObj of playerStats.activeElements) {
        const elName = elObj.element;
        const elEff = elObj.elementEff;
        
        if (elEff > 0) {
          // Weakness boost: +80% * elEff ATK
          if (elName === monsterWeakness) {
            playerAtk = Math.floor(playerAtk * (1 + 0.80 * elEff));
            passiveLabel += ` (${elName} Weakness ATK +${Math.round(0.80 * elEff * 100)}%)`;
          }
          // Baseline element damage multiplier: +40% * elEff
          dmgMultiplier += 0.40 * elEff;
        }
      }
    } else if (playerStats.element && playerStats.elementEff > 0) {
      // Fallback
      if (playerStats.element === monsterWeakness) {
        playerAtk = Math.floor(playerAtk * (1 + 0.80 * playerStats.elementEff));
        passiveLabel += ` (Element Weakness ATK +${Math.round(0.80 * playerStats.elementEff * 100)}%)`;
      }
      dmgMultiplier += 0.40 * playerStats.elementEff;
    }

    // Apply carried-over ATK multiplier from Liquid/Void element
    if (roundElementAtkMult > 0) {
      dmgMultiplier += roundElementAtkMult;
      passiveLabel += ` (Element Buff ATK +${Math.round(roundElementAtkMult * 100)}%)`;
    }

    // Apply Wild Boar passive (+5% ATK per enchanted level in Round 1 & 2)
    if (wildBoarEnchanted > 0 && roundNum <= 2) {
      dmgMultiplier += wildBoarEnchanted * 0.05;
      passiveLabel += ` (Wild Boar ATK +${wildBoarEnchanted * 5}%)`;
    }

    // Apply Orc Warrior passive (up to +10% ATK per enchanted level based on missing HP)
    if (orcEnchanted > 0) {
      const orcBonus = orcEnchanted * 0.10 * (1 - playerHp / playerMaxHp);
      if (orcBonus > 0) {
        dmgMultiplier += orcBonus;
        passiveLabel += ` (Orc Warrior ATK +${Math.round(orcBonus * 100)}%)`;
      }
    }

    // Dragon Bow Forge 6 elite bonus
    if (onfieldWeapon && onfieldWeapon.name === 'Dragon Bow' && onfieldForge >= 6 && isEliteMonster) {
      dmgMultiplier += 0.80;
      playerStats.pen += 0.30;
      passiveLabel += ` (Dragon Bow Forge 6: DMG +80%, Ignore DEF +30%)`;
    }

    // Archmage Staff player ATK debuff cleanse (Forge 4 cleanses)
    let hasCleanse = false;
    for (const wp of equippedWeapons) {
      if (wp.forge >= 4 && wp.name === 'Archmage Staff') {
        hasCleanse = true;
      }
    }
    if (hasKirin && kirinE >= 4) {
      hasCleanse = true;
    }

    // Apply standard elite tier ATK reduction if not cleansed
    if (!hasCleanse) {
      if (monster.tier === 'overpowered' || monster.tier === 'chronicle' || monster.tier === 'prodigy') {
        playerAtk = Math.floor(playerAtk * 0.80);
        const pName = monster.tier === 'chronicle' ? 'Awakened Memory' : 'Dread Presence';
        passiveLabel += ` (${pName}: ATK -20%)`;
      } else if (monster.tier === 'beyond') {
        playerAtk = Math.floor(playerAtk * 0.70);
        passiveLabel += ` (Existential Terror: ATK -30%)`;
      }
    }

    // Excalibur Holy Blessing (Lv 5) check
    if (onfieldWeapon && onfieldLvl >= 5 && onfieldWeapon.name === 'Excalibur') {
      if (playerHp > (playerMaxHp * 0.50)) {
        playerAtk = Math.floor(playerAtk * 1.20);
        passiveLabel += ` (Holy Blessing ATK +20%)`;
      }
    }

    // Iron Broadsword Iron Will (Lv 20) check
    if (onfieldWeapon && onfieldLvl >= 20 && onfieldWeapon.name === 'Iron Broadsword') {
      if (playerHp < (playerMaxHp * 0.30)) {
        playerAtk = Math.floor(playerAtk * 1.30);
        passiveLabel += ` (Iron Will ATK +30%)`;
      }
    }

    // Calculate enemy DEF after ignores
    let playerPen = playerStats.pen || 0;
    if (roundElementPen > 0) {
      playerPen += roundElementPen;
      passiveLabel += ` (Element Buff PEN +${Math.round(roundElementPen * 100)}%)`;
    }
    let enemyDef = enemyBaseDef;
    enemyDef = Math.max(0, Math.floor(enemyDef * (1 - playerPen)));
    if (playerPen > 0) {
      passiveLabel += ` (Ignores ${Math.round(Math.min(1.0, playerPen) * 100)}% DEF)`;
    }

    // Crit chances
    let critChance = playerStats.critChance || 0.10;
    let critDamage = playerStats.critDamage || 0.50;

    if (roundElementCritChance > 0) {
      critChance += roundElementCritChance;
      passiveLabel += ` (Element Buff CR +${Math.round(roundElementCritChance * 100)}%)`;
    }
    if (roundElementCritDamage > 0) {
      critDamage += roundElementCritDamage;
      passiveLabel += ` (Element Buff CDM +${Math.round(roundElementCritDamage * 100)}%)`;
    }

    // Mjolnir Thundering Tempest (Forge 4) Crit Damage Bonus on stunned targets
    if (monsterStunnedThisRound && onfieldWpName === 'Mjolnir' && onfieldForge >= 4) {
      critDamage += 0.35;
      passiveLabel += ` (Thundering Tempest Crit Damage +35%)`;
    }

    if (onfieldWeapon && onfieldLvl >= 5) {
      if (onfieldWeapon.name === 'Iron Broadsword') {
        critChance += 0.15;
        if (onfieldLvl >= 25) critDamage += 0.40;
      } else if (onfieldWeapon.name === 'Steel Spear') {
        if (onfieldLvl >= 20) { critChance += 0.20; critDamage += 0.50; }
        if (onfieldLvl >= 30) { critChance += 0.25; critDamage += 0.75; }
      } else if (onfieldWeapon.name === 'Excalibur') {
        if (onfieldLvl >= 15) { critChance += 0.15; critDamage += 0.50; }
        if (onfieldLvl >= 25) critChance += 0.20;
        if (onfieldLvl >= 30) critDamage += 0.80;
      } else if (onfieldWeapon.name === 'Dragon Bow') {
        if (onfieldLvl >= 20) { critChance += 0.25; critDamage += 1.00; }
        if (onfieldLvl >= 25) critChance += 0.15;
        if (onfieldLvl >= 30) { critChance += 0.30; critDamage += 1.20; }
      } else if (onfieldWeapon.name === 'Wooden Sword') {
        if (onfieldLvl >= 25) { critChance += 0.10; critDamage += 0.20; }
      }
    }

    let critMultiplier = 1.0;
    if (critChance > 1.0) {
      isCrit = true;
      critMultiplier = (1 + critDamage) * critChance;
      dmgMultiplier *= critMultiplier;
    } else if (Math.random() < critChance) {
      isCrit = true;
      critMultiplier = (1 + critDamage);
      dmgMultiplier *= critMultiplier;
    }

    // Jester's Staff Forge 4 Chaos Bolt heal on crit strike
    let hasChaosBolt = false;
    for (const wp of equippedWeapons) {
      if (wp.name === "Jester's Staff" && wp.forge >= 4) {
        hasChaosBolt = true;
      }
    }
    if (hasChaosBolt && isCrit && playerHp > 0) {
      playerHp = Math.min(playerMaxHp, playerHp + 150);
      rounds.push(`Round ${roundNum} (Chaos Bolt Heal): Healed +150 HP on critical strike! Player HP: ${playerHp}/${playerMaxHp}`);
    }

    // Mjolnir Static Charge passive
    if (monsterStunnedThisRound && onfieldWeapon && onfieldWeapon.name === 'Mjolnir') {
      const extraStunDmg = onfieldLvl >= 30 ? 0.75 : 0.20;
      dmgMultiplier += extraStunDmg;
      passiveLabel += ` (Static Charge +${extraStunDmg * 100}%)`;
    }


    // Roll special multipliers (Gungnir, Golden Kukri, Mjolnir)
    let specialChance = 0;
    let specialMult = 1.0;
    let specialName = '';
    if (onfieldWeapon && onfieldLvl >= 5) {
      if (onfieldWeapon.name === 'Gungnir') {
        specialChance = onfieldLvl >= 30 ? 0.45 : onfieldLvl >= 20 ? 0.35 : 0.25;
        specialMult = onfieldLvl >= 30 ? 3.0 : onfieldLvl >= 20 ? 2.5 : 2.0;
        specialName = onfieldLvl >= 30 ? 'Celestial Spear' : onfieldLvl >= 20 ? 'Sure Hit' : "Odin's Precision";
      } else if (onfieldWeapon.name === 'Golden Kukri') {
        specialChance = onfieldLvl >= 30 ? 0.40 : onfieldLvl >= 20 ? 0.30 : 0.20;
        specialMult = onfieldLvl >= 30 ? 3.0 : onfieldLvl >= 20 ? 2.5 : 2.0;
        specialName = onfieldLvl >= 30 ? 'Aurum Sovereign' : onfieldLvl >= 20 ? 'Aurum Strike' : 'Golden Guard';
      } else if (onfieldWeapon.name === 'Mjolnir') {
        if (onfieldLvl >= 30) {
          specialChance = 0.30;
          specialMult = 3.5;
          specialName = 'Ragnarok Hammer';
        } else if (onfieldLvl >= 20) {
          specialChance = 0.20;
          specialMult = 3.0;
          specialName = 'God of Thunder';
        }
      } else if (onfieldWpName === "Jester's Staff") {
        if (onfieldForge >= 4) {
          specialChance = 0.15;
          specialMult = 4.0;
          specialName = 'Chaos Bolt';
        }
      }
    }

    let isSpecialTriggered = false;
    if (specialChance > 0 && Math.random() < specialChance) {
      dmgMultiplier *= specialMult;
      isSpecialTriggered = true;
    }

    // Execute Threshold checks
    let isExecuteTriggered = false;
    if (onfieldWeapon && onfieldLvl >= 5) {
      if (onfieldWeapon.name === 'Lethalized Dark Scythe') {
        if (scytheEliteExecuteActive && isEliteMonster) {
          if (monsterHp < (maxMonsterHp * 0.75)) {
            dmgMultiplier = 5.0;
            isExecuteTriggered = true;
            rounds.push(`Round ${roundNum} (Forge 6 Scythe Execute): Strikes for 5x DMG against low HP Elite!`);
          } else {
            dmgMultiplier += 0.80;
          }
        } else {
          const threshold = onfieldLvl >= 30 ? 0.60 : onfieldLvl >= 20 ? 0.50 : 0.30;
          const mult = onfieldLvl >= 30 ? 5.0 : onfieldLvl >= 20 ? 4.0 : 3.0;
          if (monsterHp < (maxMonsterHp * threshold)) {
            dmgMultiplier = mult;
            isExecuteTriggered = true;
            rounds.push(`Round ${roundNum} (Death's Embrace): Execute threshold triggered (${mult}x DMG)!`);
            passiveLabel += ' (Scythe EXECUTE)';
          } else {
            const scytheBonus = onfieldLvl >= 30 ? 0.60 : onfieldLvl >= 20 ? 0.40 : 0.25;
            dmgMultiplier += scytheBonus;
          }
        }
      } else if (onfieldWeapon.name === 'Rusty Dagger' && onfieldLvl >= 20) {
        if (monsterHp < (maxMonsterHp * 0.40)) {
          dmgMultiplier *= 2.0;
          passiveLabel += ' (Assassination 2.0x DMG)';
        }
      } else if (onfieldWeapon.name === 'Poison Butterfly Knife' && onfieldLvl >= 20) {
        const mult = onfieldLvl >= 30 ? 2.5 : 2.0;
        dmgMultiplier *= mult;
        passiveLabel += ` (Assassinate ${mult}x DMG)`;
      }
    }

    // Other flat adjustments
    if (onfieldWeapon && onfieldLvl >= 5) {
      if (onfieldWeapon.name === 'Wooden Sword') {
        dmgMultiplier += 0.05;
        if (onfieldLvl >= 10) flatBonusDmg += 10;
        if (onfieldLvl >= 20) dmgMultiplier += 0.15;
        if (onfieldLvl >= 30) dmgMultiplier += 0.20;
      } else if (onfieldWeapon.name === 'Steel Spear') {
        if (onfieldLvl >= 10 && roundNum === 1) {
          flatBonusDmg += 20;
          passiveLabel += ' (Lunge +20)';
        }
      } else if (onfieldWeapon.name === 'Excalibur') {
        if (onfieldLvl >= 20) dmgMultiplier += 0.30;
        if (onfieldLvl >= 30) dmgMultiplier += 0.50;
      } else if (onfieldWeapon.name === 'Dragon Bow') {
        if (onfieldLvl >= 10) dmgMultiplier += 0.15;
        if (onfieldLvl >= 30) dmgMultiplier += 0.35;
      } else if (onfieldWeapon.name === 'Mjolnir') {
        if (onfieldLvl >= 20) dmgMultiplier += 0.35;
        if (onfieldLvl >= 30) dmgMultiplier += 0.50;
      }
    }

    // Apply Mjolnir/Gungnir Forge 6 elite multipliers
    if (isEliteMonster) {
      if (onfieldWeapon && onfieldWeapon.name === 'Mjolnir' && onfieldForge >= 6) {
        dmgMultiplier += 1.0;
      } else if (onfieldWeapon && onfieldWeapon.name === 'Gungnir' && onfieldForge >= 6) {
        dmgMultiplier += 1.2;
      }
    }

    if (isCrit) {
      rounds.push(`Round ${roundNum} (Critical Hit): Strikes for ${critMultiplier.toFixed(2)}x damage!`);
      passiveLabel += ' (CRITICAL)';
    }

    if (isSpecialTriggered) {
      rounds.push(`Round ${roundNum} (${specialName}): Weapon special effect triggered (${specialMult}x DMG)!`);
      passiveLabel += ` (${specialName})`;
    }

    // Calculate player damage
    let playerDmg = Math.max(1, Math.floor(playerAtk * dmgMultiplier) - enemyDef) + flatBonusDmg;

    // Aegis Breaker Forge 4: Shattering Blows (10% chance to deal 3.5x playerAtk as True Damage)
    let hasShatteringBlows = false;
    for (const wp of equippedWeapons) {
      if (wp.name === 'Aegis Breaker' && wp.forge >= 4) {
        hasShatteringBlows = true;
      }
    }
    if (hasShatteringBlows && Math.random() < 0.10) {
      playerDmg = Math.floor(playerAtk * 3.5);
      passiveLabel += ` (Shattering Blows: 3.5x True DMG!)`;
    }

    // Gungnir damage floor
    if (onfieldWeapon && onfieldLvl >= 5 && onfieldWeapon.name === 'Gungnir') {
      const floor = onfieldLvl >= 30 ? 600 : onfieldLvl >= 20 ? 300 : 150;
      let finalFloor = floor;
      if (playerDmg < finalFloor) {
        playerDmg = finalFloor;
        passiveLabel += ` (Gungnir Floor: ${finalFloor})`;
      }
    }

    // Apply support weapon Vulnerability
    let vulnRatio = baseVul;
    const checkVuln = (wp, lvl, forge) => {
      if (!wp) return;
      const scale = 1 + forge * 0.1;
      if (wp.name === 'Hexing Totem') {
        if (lvl >= 30) vulnRatio += 0.30 * scale;
        else if (lvl >= 25) vulnRatio += 0.25 * scale;
        else if (lvl >= 15) vulnRatio += 0.20 * scale;
        else if (lvl >= 5) vulnRatio += 0.15 * scale;
      } else if (wp.name === 'Shadow Tome') {
        if (lvl >= 30) vulnRatio += 0.30 * scale;
        else if (lvl >= 20) vulnRatio += 0.20 * scale;
        else if (lvl >= 15) vulnRatio += 0.15 * scale;
      } else if (wp.name === 'Aegis Breaker') {
        if (lvl >= 30) vulnRatio += 0.50 * scale;
        else if (lvl >= 20) vulnRatio += 0.40 * scale;
        else if (lvl >= 5) vulnRatio += 0.30 * scale;
      } else if (wp.name === 'Amrita Bell') {
        if (lvl >= 10) vulnRatio += 0.25 * scale;
      }
    };
    checkVuln(off1Weapon, off1Lvl, off1Forge);
    checkVuln(off2Weapon, off2Lvl, off2Forge);

    if (vulnRatio > 0) {
      playerDmg = Math.floor(playerDmg * (1 + vulnRatio));
      passiveLabel += ` (Vulnerability +${Math.round(vulnRatio * 100)}%)`;
    }

    if (hasAmritaBellF2 && (vulnRatio > 0 || baseDot > 0 || baseTDmg > 0 || nextRoundElementTrueDmg > 0 || nextRoundElementVuln > 0)) {
      playerDmg = Math.floor(playerDmg * 1.20);
      passiveLabel += ` (Resonance Bell +20%)`;
    }

    // Apply elemental resistance cycle
    // Apply elemental resistance cycle
    let hasWeaknessCounter = false;
    let weaknessElement = '';
    let resistantElements = [];

    if (playerStats.activeElements && playerStats.activeElements.length > 0) {
      for (const elObj of playerStats.activeElements) {
        const elName = elObj.element;
        if (elName === monsterWeakness) {
          hasWeaknessCounter = true;
          weaknessElement = elName;
        }
        if (monsterResistances.includes(elName)) {
          resistantElements.push(elName);
        }
      }
    } else {
      // Fallback
      if (playerStats.element === monsterWeakness) {
        hasWeaknessCounter = true;
        weaknessElement = playerStats.element;
      }
      if (playerStats.element && monsterResistances.includes(playerStats.element)) {
        resistantElements.push(playerStats.element);
      }
    }

    if (hasWeaknessCounter) {
      playerDmg = Math.floor(playerDmg * 1.5);
      passiveLabel += ` (Weakness Counter Matchup [${weaknessElement}]: 1.5x DMG!)`;
    }
    
    if (resistantElements.length > 0) {
      let netRes = Math.max(0, 0.40 - (playerStats.elementResPen || 0));
      let hasIgnoreRes = false;
      for (const wp of equippedWeapons) {
        if (wp.name === 'Gungnir' && wp.forge >= 4) {
          hasIgnoreRes = true;
        }
      }
      if (hasIgnoreRes) {
        netRes = 0;
        passiveLabel += ` (Odin's Piercing: Elemental Res [${resistantElements.join(', ')}] ignored!)`;
      }
      playerDmg = Math.floor(playerDmg * (1 - netRes));
      if (netRes > 0) {
        passiveLabel += ` (Resisted [${resistantElements.join(', ')}]: -${Math.round(netRes * 100)}% DMG)`;
      } else if (!hasIgnoreRes) {
        passiveLabel += ` (Resisted [${resistantElements.join(', ')}]: Bypassed by RES PEN!)`;
      }
    }

    // Deal damage
    monsterHp -= playerDmg;
    totalDamageDealt += playerDmg;
    rounds.push(`Round ${roundNum}: Player deals ${playerDmg} damage${passiveLabel}. Monster HP: ${Math.max(0, monsterHp)}`);

    // Amrita Bell Level 30: Celestial Resonance (+40% bonus True Damage)
    let hasAmritaBellL30 = false;
    for (const wp of equippedWeapons) {
      if (wp.name === 'Amrita Bell' && getWpLvl(wp.name) >= 30) {
        hasAmritaBellL30 = true;
      }
    }
    if (hasAmritaBellL30 && playerDmg > 0 && monsterHp > 0) {
      const bonusTrue = Math.floor(playerDmg * 0.40);
      monsterHp -= bonusTrue;
      totalDamageDealt += bonusTrue;
      rounds.push(`Round ${roundNum} (Celestial Resonance): Deals ${bonusTrue} bonus True Damage to the monster (+40%). Monster HP: ${Math.max(0, monsterHp)}`);
    }

    // --- Unified Elemental Special Effect Trigger ---
    if (monsterHp > 0) {
      const processElementTrigger = (elName, perf, elEff, forge, wpName) => {
        if (monsterHp <= 0) return;
        if (elEff <= 0) return;
        
        const G = perf / 100;
        const scale = forge >= 6 ? 2.0 : 1.0;
        const triggerChance = 0.10 + 0.05 * G; // 10% to 15%

        if (Math.random() < triggerChance) {
          const flatDmg = Math.floor((25 + 25 * G) * scale);
          monsterHp -= flatDmg;
          totalDamageDealt += flatDmg;
          const viaLabel = wpName ? ` via ${wpName}` : '';

          if (elName === 'Blast') {
            nextRoundElementVuln += 0.10 * scale;
            rounds.push(`🔥 Round ${roundNum} (Blast Burn${viaLabel}): Burn deals ${flatDmg} damage and inflicts +${Math.round(0.10 * scale * 100)}% Vulnerability for next round! Monster HP: ${Math.max(0, monsterHp)}`);
          } else if (elName === 'Liquid') {
            nextRoundElementAtkMult += 0.15 * scale;
            rounds.push(`💧 Round ${roundNum} (Liquid Splash${viaLabel}): Splash deals ${flatDmg} damage and increases player ATK by +${Math.round(0.15 * scale * 100)}% for next round! Monster HP: ${Math.max(0, monsterHp)}`);
          } else if (elName === 'Volt') {
            nextRoundElementCritChance += 0.15 * scale;
            rounds.push(`⚡ Round ${roundNum} (Volt Shock${viaLabel}): Shock deals ${flatDmg} damage and increases player Crit Chance by +${Math.round(0.15 * scale * 100)}% for next round! Monster HP: ${Math.max(0, monsterHp)}`);
          } else if (elName === 'Blizzard') {
            nextRoundElementPen += 0.20 * scale;
            rounds.push(`❄️ Round ${roundNum} (Blizzard Freeze${viaLabel}): Freeze deals ${flatDmg} damage and increases player DEF ignore (PEN) by +${Math.round(0.20 * scale * 100)}% for next round! Monster HP: ${Math.max(0, monsterHp)}`);
          } else if (elName === 'Shadow') {
            const tDmgAdd = Math.floor(30 * scale);
            nextRoundElementTrueDmg += tDmgAdd;
            rounds.push(`🌑 Round ${roundNum} (Shadow Curse${viaLabel}): Curse deals ${flatDmg} damage and will inflict +${tDmgAdd} True Damage next round! Monster HP: ${Math.max(0, monsterHp)}`);
          } else if (elName === 'Radiant') {
            nextRoundElementCritDamage += 0.30 * scale;
            rounds.push(`☀️ Round ${roundNum} (Radiant Glow${viaLabel}): Glow deals ${flatDmg} damage and increases player Crit Damage (CDM) by +${Math.round(0.30 * scale * 100)}% for next round! Monster HP: ${Math.max(0, monsterHp)}`);
          } else if (elName === 'Void') {
            nextRoundElementAtkMult += 0.10 * scale;
            nextRoundElementPen += 0.10 * scale;
            rounds.push(`🌌 Round ${roundNum} (Void Rift${viaLabel}): Void deals ${flatDmg} damage and increases player ATK by +${Math.round(0.10 * scale * 100)}% and PEN by +${Math.round(0.10 * scale * 100)}% for next round! Monster HP: ${Math.max(0, monsterHp)}`);
          }
        }
      };

      if (playerStats.activeElements && playerStats.activeElements.length > 0) {
        for (const elObj of playerStats.activeElements) {
          processElementTrigger(elObj.element, elObj.perfection, elObj.elementEff, elObj.forge, elObj.wpName);
        }
      } else if (playerStats.element && playerStats.elementEff > 0) {
        processElementTrigger(playerStats.element, playerStats.perfection || 0, playerStats.elementEff, onfieldForge, onfieldWpName);
      }
    }

    // Golem Behemoth Splash True Damage (15% per enchanted level)
    if (behemothEnchanted > 0 && monsterHp > 0) {
      const splash = Math.floor(playerDmg * behemothEnchanted * 0.15);
      if (splash > 0) {
        monsterHp -= splash;
        totalDamageDealt += splash;
        rounds.push(`Round ${roundNum} (Behemoth Splash): Deals ${splash} bonus Splash True Damage. Monster HP: ${Math.max(0, monsterHp)}`);
      }
    }

    // Soul Feast healing
    if (onfieldWeapon && onfieldWpName === 'Lethalized Dark Scythe' && onfieldLvl >= 10) {
      let ratio = onfieldLvl >= 25 ? 0.18 : 0.10;
      if (onfieldForge >= 2 && ['mythic', 'supreme', 'secret'].includes(onfieldWeapon.rarity)) {
        ratio += 0.10; // Forge 2 bonus
      }
      if (onfieldForge >= 4) {
        ratio += 0.05; // Forge 4 Reaper's Harvest
      }
      const soulFeastHeal = Math.floor(playerDmg * ratio);
      if (soulFeastHeal > 0) {
        playerHp = Math.min(playerMaxHp, playerHp + soulFeastHeal);
        rounds.push(`Round ${roundNum} (Soul Feast): Healed +${soulFeastHeal} HP from damage. Player HP: ${playerHp}/${playerMaxHp}`);
      }
    }

    // Double Attack calculation
    let doubleAttackChance = 0;
    if (onfieldWeapon && onfieldLvl >= 5) {
      if (onfieldWeapon.name === 'Wooden Sword' && onfieldLvl >= 15) {
        doubleAttackChance = onfieldLvl >= 30 ? 0.25 : 0.10;
      } else if (onfieldWeapon.name === 'Rusty Dagger') {
        doubleAttackChance = onfieldLvl >= 30 ? 0.35 : onfieldLvl >= 15 ? 0.20 : 0.10;
      } else if (onfieldWeapon.name === 'Gungnir') {
        if (onfieldForge >= 6 && isEliteMonster) {
          doubleAttackChance = doubleAttackChanceForge6;
        } else {
          doubleAttackChance = onfieldLvl >= 30 ? 0.35 : onfieldLvl >= 25 ? 0.30 : onfieldLvl >= 20 ? 0.20 : 0.0;
        }
      } else if (onfieldWeapon.name === 'Lethalized Dark Scythe' && onfieldLvl >= 15) {
        doubleAttackChance = onfieldLvl >= 30 ? 0.30 : onfieldLvl >= 25 ? 0.25 : 0.15;
        if (onfieldForge >= 4) {
          doubleAttackChance += 0.20; // Forge 4 Reaper's Harvest
        }
      } else if (onfieldWeapon.name === 'Poison Butterfly Knife') {
        doubleAttackChance = onfieldLvl >= 30 ? 0.35 : onfieldLvl >= 20 ? 0.25 : onfieldLvl >= 15 ? 0.20 : 0.10;
      }
    }

    // Add Forge 2 double strike bonuses
    if (onfieldWeapon && onfieldForge >= 2 && ['mythic', 'supreme', 'secret'].includes(onfieldWeapon.rarity)) {
      if (['Lethalized Dark Scythe', 'Poison Butterfly Knife', 'Gungnir'].includes(onfieldWeapon.name)) {
        doubleAttackChance += 0.15;
      }
    }

    if (doubleAttackChance > 0 && Math.random() < doubleAttackChance && monsterHp > 0) {
      let finalDoubleDmg = playerDmg;
      monsterHp -= finalDoubleDmg;
      totalDamageDealt += finalDoubleDmg;
      const extraAttackName = onfieldWeapon.name === 'Wooden Sword' ? 'Double Splinter' :
                              onfieldWeapon.name === 'Rusty Dagger' ? 'Desperate Flurry' :
                              onfieldWeapon.name === 'Gungnir' ? 'Wind Rider' :
                              onfieldWeapon.name === 'Lethalized Dark Scythe' ? "Reaper's Dance" :
                              'Fluttering Blades';
      rounds.push(`Round ${roundNum} (${extraAttackName}): Player strikes again for ${finalDoubleDmg} damage! Monster HP: ${Math.max(0, monsterHp)}`);

      // Soul Feast on double attack
      if (onfieldWeapon && onfieldWpName === 'Lethalized Dark Scythe' && onfieldLvl >= 10) {
        let ratio = onfieldLvl >= 25 ? 0.18 : 0.10;
        if (onfieldForge >= 2 && ['mythic', 'supreme', 'secret'].includes(onfieldWeapon.rarity)) {
          ratio += 0.10;
        }
        if (onfieldForge >= 4) {
          ratio += 0.05; // Forge 4 Reaper's Harvest
        }
        const soulFeastHeal = Math.floor(finalDoubleDmg * ratio);
        if (soulFeastHeal > 0) {
          playerHp = Math.min(playerMaxHp, playerHp + soulFeastHeal);
          rounds.push(`Round ${roundNum} (Soul Feast): Healed +${soulFeastHeal} HP from double attack. Player HP: ${playerHp}/${playerMaxHp}`);
        }
      }
    }

    // Ticks & Dot Damage
    if (monsterHp > 0) {
      // Dragon Fire
      let burn = 0;
      if (onfieldWeapon && onfieldWpName === 'Dragon Bow' && onfieldLvl >= 5) {
        let mult = 1 + onfieldForge * 0.1;
        if (onfieldForge >= 4) {
          mult *= 2.5; // +150% burn damage (2.5x)
        }
        burn = Math.floor((onfieldLvl >= 25 ? 80 : onfieldLvl >= 15 ? 40 : 15) * mult);
      }
      if (burn > 0) {
        burn = Math.floor(burn * dotTrueDmgMultiplier);
        monsterHp -= burn;
        totalDamageDealt += burn;
        rounds.push(`Round ${roundNum} (Dragon Fire): Burn deals ${burn} damage. Monster HP: ${Math.max(0, monsterHp)}`);
      }

      // Poison
      let poison = baseDot;
      if (onfieldWeapon && onfieldWpName === 'Poison Butterfly Knife' && onfieldLvl >= 5) {
        let pBase = (onfieldLvl >= 30 ? 500 : onfieldLvl >= 25 ? 300 : onfieldLvl >= 20 ? 150 : onfieldLvl >= 15 ? 80 : 40) * (1 + onfieldForge * 0.1);
        if (onfieldForge >= 4) {
          pBase = (pBase + 120) * 2; // Increases base DOT by 120 and doubles it
        }
        poison += Math.floor(pBase);
      } else if (onfieldWeapon && onfieldWeapon.name === 'Rusty Dagger' && onfieldLvl >= 10) {
        poison += (onfieldLvl >= 25 ? 25 : 5) * (1 + onfieldForge * 0.1);
      }
      if (poison > 0) {
        poison = Math.floor(poison * dotTrueDmgMultiplier);
        monsterHp -= poison;
        totalDamageDealt += poison;
        rounds.push(`Round ${roundNum} (Poison): Poison deals ${poison} damage. Monster HP: ${Math.max(0, monsterHp)}`);
      }

      // Bleeding
      let bleed = 0;
      if (onfieldWeapon && onfieldWeapon.name === 'Steel Spear' && onfieldLvl >= 15) {
        bleed = (onfieldLvl >= 25 ? 30 : 12) * (1 + onfieldForge * 0.1);
      }
      if (bleed > 0) {
        bleed = Math.floor(bleed * dotTrueDmgMultiplier);
        monsterHp -= bleed;
        totalDamageDealt += bleed;
        rounds.push(`Round ${roundNum} (Bleed): Bleeding deals ${bleed} damage. Monster HP: ${Math.max(0, monsterHp)}`);
      }

      // Light Spark
      let light = 0;
      if (onfieldWeapon && onfieldWeapon.name === 'Excalibur' && onfieldLvl >= 10) {
        light = (onfieldLvl >= 25 ? 75 : 30) * (1 + onfieldForge * 0.1);
      } else if (onfieldWeapon && onfieldWeapon.name === 'Mjolnir' && onfieldLvl >= 10) {
        light = (onfieldLvl >= 25 ? 120 : 50) * (1 + onfieldForge * 0.1);
      }
      if (light > 0) {
        light = Math.floor(light * dotTrueDmgMultiplier);
        monsterHp -= light;
        totalDamageDealt += light;
        rounds.push(`Round ${roundNum} (Light Spark): Spark deals ${light} damage. Monster HP: ${Math.max(0, monsterHp)}`);
      }

      // Arcane Nova
      let magic = 0;
      const checkNova = (wp, lvl, forge) => {
        if (wp && wp.name === 'Archmage Staff' && lvl >= 15) {
          magic = 30 * (1 + forge * 0.1);
        }
      };
      checkNova(off1Weapon, off1Lvl, off1Forge);
      checkNova(off2Weapon, off2Lvl, off2Forge);
      if (magic > 0) {
        magic = Math.floor(magic * dotTrueDmgMultiplier);
        monsterHp -= magic;
        totalDamageDealt += magic;
        rounds.push(`Round ${roundNum} (Arcane Nova): Shock deals ${magic} damage. Monster HP: ${Math.max(0, monsterHp)}`);
      }

    }

    if (monsterHp <= 0) break;

    // 2. Monster attacks player
    let monsterStunned = monsterStunnedThisRound;

    // Weapon stuns
    if (!monsterStunned && onfieldWeapon && onfieldLvl >= 5) {
      if (onfieldWeapon.name === 'Mjolnir') {
        let stunChance = (onfieldLvl >= 30 ? 0.50 : onfieldLvl >= 15 ? 0.40 : 0.30) * (1 + onfieldForge * 0.1);
        if (onfieldForge >= 4) {
          stunChance *= 2.0; // doubled stun chance for Thundering Tempest
        }
        if (Math.random() < Math.min(1.0, stunChance)) {
          monsterStunned = true;
          nextRoundStunned = true;
          rounds.push(`Round ${roundNum} (Thunder Strike): Monster is stunned by lightning!`);
        }
      } else if (onfieldWeapon.name === 'Iron Broadsword' && onfieldLvl >= 15) {
        const stunChance = (onfieldLvl >= 30 ? 0.20 : onfieldLvl >= 15 ? 0.10 : 0) * (1 + onfieldForge * 0.1);
        if (Math.random() < Math.min(1.0, stunChance)) {
          monsterStunned = true;
          nextRoundStunned = true;
          rounds.push(`Round ${roundNum} (Staggering Blow): Monster is staggered and unable to attack!`);
        }
      } else if (onfieldWeapon.name === 'Dragon Bow' && onfieldLvl >= 20 && isCrit) {
        monsterStunned = true;
        nextRoundStunned = true;
        rounds.push(`Round ${roundNum} (Dragon's Gaze): Monster is blinded and unable to attack!`);
      }
    }


    // Elite tiers stun immunity
    if (monsterStunned && ['chronicle', 'prodigy', 'beyond'].includes(monster.tier)) {
      rounds.push(`Round ${roundNum} (Unstoppable): ${monster.displayName || monster.name} overpowers the stun!`);
      monsterStunned = false;
      nextRoundStunned = false;
    }

    if (monsterStunned) {
      rounds.push(`Round ${roundNum}: Monster is stunned and unable to attack.`);
    } else {
      // Check dodge (Griffin enchanted passive)
      if (griffinEnchanted > 0 && Math.random() < griffinEnchanted * 0.05) {
        rounds.push(`Round ${roundNum} (Griffin Dodge): Player dodged the monster's attack!`);
      } else {
        let monsterDmg = Math.max(1, currentMonsterAtk - playerStats.def);
        let dmgRedLabels = [];

        // Perfect Block
        let isPerfectBlock = false;
        const checkBucklerBlock = (wp, lvl, forge) => {
          if (wp && wp.name === 'Buckler Shield' && lvl >= 20) {
            const cap = (lvl >= 30 ? 0.20 : 0.10) * (1 + forge * 0.1);
            if (Math.random() < Math.min(1.0, cap)) {
              isPerfectBlock = true;
            }
          }
        };
        checkBucklerBlock(off1Weapon, off1Lvl, off1Forge);
        checkBucklerBlock(off2Weapon, off2Lvl, off2Forge);

        if (isPerfectBlock) {
          rounds.push(`Round ${roundNum} (Perfect Block): Player blocked all incoming damage!`);
          monsterDmg = 0;
        } else {
          // Golem passive damage reduction (3% per level)
          if (golemEnchanted > 0) {
            monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - golemEnchanted * 0.03)));
            dmgRedLabels.push(`Golem Enchanted -${golemEnchanted * 3}%`);
          }

          // Archmage Staff Forge 6 Elite Matchup damage reduction
          if (archmageStaffEliteRed > 0) {
            monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - archmageStaffEliteRed)));
            dmgRedLabels.push(`Archmage Staff Forge 6 -30%`);
          }

          // Support weapon reductions
          const checkRed = (wp, lvl, forge) => {
            if (!wp) return;
            if (wp.name === "Knight's Aegis" && lvl >= 5) {
              const red = lvl >= 30 ? 0.40 : lvl >= 20 ? 0.30 : 0.15;
              monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - red)));
              dmgRedLabels.push(`Aegis Shield -${red*100}%`);
            }
            if (wp.name === "Divine Bulwark" && lvl >= 5) {
              const red = lvl >= 30 ? 0.55 : lvl >= 20 ? 0.45 : 0.30;
              monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - red)));
              dmgRedLabels.push(`Divine Protection -${red*100}%`);
            }
            if (wp.name === "Apprentice Wand" && lvl >= 15) {
              const red = lvl >= 30 ? 0.15 : 0.08;
              monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - red)));
              dmgRedLabels.push(`Magic Shield -${red*100}%`);
            }
            if (wp.name === "Round Shield" && lvl >= 20) {
              const red = lvl >= 30 ? 0.20 : 0.10;
              monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - red)));
              dmgRedLabels.push(`Indomitable Bulwark -${red*100}%`);
            }
            if (wp.name === "Amrita Bell" && lvl >= 30) {
              monsterDmg = Math.max(1, Math.floor(monsterDmg * 0.60));
              dmgRedLabels.push(`Amrita Sanctuary -40%`);
            }
          };
          checkRed(off1Weapon, off1Lvl, off1Forge);
          checkRed(off2Weapon, off2Lvl, off2Forge);

          // Golden Kukri Gilded Aegis
          if (onfieldWeapon && onfieldWeapon.name === 'Golden Kukri' && onfieldLvl >= 15) {
            const red = onfieldLvl >= 30 ? 0.35 : onfieldLvl >= 25 ? 0.25 : 0.15;
            monsterDmg = Math.max(1, Math.floor(monsterDmg * (1 - red)));
            dmgRedLabels.push(`Gilded Aegis -${red*100}%`);
          }

          playerHp -= monsterDmg;
          const reductionString = dmgRedLabels.length ? ` (reduced by ${dmgRedLabels.join(', ')})` : '';
          rounds.push(`Round ${roundNum}: Monster deals ${monsterDmg} damage${reductionString}. Player HP: ${Math.max(0, playerHp)}`);

          // Reflections / Deflection
          let deflectedDmg = 0;
          const checkDeflection = (wp, lvl) => {
            if (wp && wp.name === 'Round Shield' && lvl >= 10) {
              const cap = lvl >= 30 ? 0.25 : 0.15;
              if (Math.random() < cap) {
                deflectedDmg += Math.floor(monsterDmg * 0.50);
              }
            }
          };
          checkDeflection(off1Weapon, off1Lvl);
          checkDeflection(off2Weapon, off2Lvl);
          if (deflectedDmg > 0) {
            monsterHp -= deflectedDmg;
            totalDamageDealt += deflectedDmg;
            rounds.push(`Round ${roundNum} (Deflection): Deflected ${deflectedDmg} damage back to monster. Monster HP: ${Math.max(0, monsterHp)}`);
          }

          let reflectDmg = 0;
          const checkShieldBash = (wp, lvl) => {
            if (wp && wp.name === 'Buckler Shield' && lvl >= 15) {
              reflectDmg += lvl >= 30 ? 30 : 15;
            }
          };
          checkShieldBash(off1Weapon, off1Lvl);
          checkShieldBash(off2Weapon, off2Lvl);

          const checkSpikedArmor = (wp, lvl) => {
            if (wp && wp.name === "Knight's Aegis" && lvl >= 15) {
              const ratio = lvl >= 25 ? 0.30 : 0.20;
              reflectDmg += Math.floor(monsterDmg * ratio);
            }
          };
          checkSpikedArmor(off1Weapon, off1Lvl);
          checkSpikedArmor(off2Weapon, off2Lvl);

          const checkRetribution = (wp, lvl) => {
            if (wp && wp.name === "Divine Bulwark" && lvl >= 15) {
              const ratio = lvl >= 25 ? 0.45 : 0.35;
              reflectDmg += Math.floor(monsterDmg * ratio);
            }
          };
          checkRetribution(off1Weapon, off1Lvl);
          checkRetribution(off2Weapon, off2Lvl);

          if (onfieldWeapon && onfieldWeapon.name === 'Golden Kukri' && onfieldLvl >= 20) {
            const ratio = onfieldLvl >= 30 ? 0.30 : 0.20;
            reflectDmg += Math.floor(monsterDmg * ratio);
          }

          // Divine Bulwark Forge 4 reflect (40%)
          let hasBulwarkF4 = false;
          for (const wp of equippedWeapons) {
            if (wp.name === 'Divine Bulwark' && wp.forge >= 4) {
              hasBulwarkF4 = true;
            }
          }
          if (hasBulwarkF4) {
            reflectDmg += Math.floor(monsterDmg * 0.40);
          }

          // Golden Kukri Forge 4 reflect (25%)
          let hasKukriF4 = false;
          for (const wp of equippedWeapons) {
            if (wp.name === 'Golden Kukri' && wp.forge >= 4) {
              hasKukriF4 = true;
            }
          }
          if (hasKukriF4) {
            reflectDmg += Math.floor(monsterDmg * 0.25);
          }

          // Divine Bulwark and Golden Kukri Forge 6 Elite Matchup reflect
          if (isEliteMonster) {
            if (off1Weapon && off1Weapon.name === 'Divine Bulwark' && off1Forge >= 6) {
              reflectDmg += Math.floor(monsterDmg * 0.50);
            }
            if (off2Weapon && off2Weapon.name === 'Divine Bulwark' && off2Forge >= 6) {
              reflectDmg += Math.floor(monsterDmg * 0.50);
            }
            if (onfieldWeapon && onfieldWeapon.name === 'Golden Kukri' && onfieldForge >= 6) {
              reflectDmg += Math.floor(monsterDmg * 0.50);
            }
          }

          // Kirin E6 Reflect 50%
          if (hasKirin && kirinE >= 6) {
            reflectDmg += Math.floor(monsterDmg * 0.50);
          }

          // Amrita Bell Level 30 reflect removed to keep weapon offensive

          if (reflectDmg > 0 && monsterHp > 0) {
            monsterHp -= reflectDmg;
            totalDamageDealt += reflectDmg;
            rounds.push(`Round ${roundNum} (Reflect): Monster takes ${reflectDmg} reflected damage. Monster HP: ${Math.max(0, monsterHp)}`);
          }
        }
      }
    }

    // Death Prevention / Revive
    if (playerHp <= 0) {
      let revived = false;
      let reviveHp = 0;
      let reviveName = '';

      // Phoenix Enchanted Passive Revive
      if (phoenixEnchanted > 0 && !phoenixReviveUsed) {
        phoenixReviveUsed = true;
        revived = true;
        reviveHp = Math.floor(playerMaxHp * phoenixEnchanted * 0.10);
        reviveName = `Phoenix Rebirth (Enchanted ${phoenixEnchanted})`;
      }

      // Secret Elixir Forge 6 Elite Matchup Revive
      if (!revived && isEliteMonster && !secretElixirEliteRevived) {
        let hasElixirForge6 = false;
        for (const wp of equippedWeapons) {
          if (wp.name === 'Secret Elixir' && wp.forge >= 6) {
            hasElixirForge6 = true;
          }
        }
        if (hasElixirForge6) {
          secretElixirEliteRevived = true;
          revived = true;
          reviveHp = Math.floor(playerMaxHp * 0.50);
          reviveName = 'Secret Elixir Forge 6 Immortality';
        }
      }

      const checkElixirRevive = (wp, lvl) => {
        if (wp && wp.name === 'Secret Elixir' && lvl >= 20 && !elixirReviveUsed) {
          elixirReviveUsed = true;
          revived = true;
          reviveHp = lvl >= 30 ? 250 : 100;
          reviveName = lvl >= 30 ? 'Immortality Elixir' : "Philosopher's Stone";
        }
      };
      if (!revived) checkElixirRevive(off1Weapon, off1Lvl);
      if (!revived) checkElixirRevive(off2Weapon, off2Lvl);

      const checkStaffRevive = (wp, lvl) => {
        if (wp && wp.name === 'Novice Staff' && lvl >= 20 && !noviceReviveUsed) {
          noviceReviveUsed = true;
          revived = true;
          reviveHp = lvl >= 30 ? 150 : 50;
          reviveName = lvl >= 30 ? 'Miracle Spark' : 'Resurrection Spark';
        }
      };
      if (!revived) checkStaffRevive(off1Weapon, off1Lvl);
      if (!revived) checkStaffRevive(off2Weapon, off2Lvl);

      // Amrita Bell Level 20+ Nirvana Blessing Revive removed (converted to start-of-battle offensive debuff)

      if (revived && reviveHp > 0) {
        playerHp = reviveHp;
        rounds.push(`Round ${roundNum} (${reviveName}): Player was defeated but revived with ${playerHp} HP!`);
      }
    }

    // 3. Healing tick at the end of the round
    if (playerHp > 0 && healAmount > 0 && playerHp < playerMaxHp) {
      let extraRegen = 0;
      const checkElixirRegen = (wp, lvl) => {
        if (wp && wp.name === 'Secret Elixir' && lvl >= 15) {
          extraRegen += Math.floor(playerMaxHp * 0.05);
        }
      };
      checkElixirRegen(off1Weapon, off1Lvl);
      checkElixirRegen(off2Weapon, off2Lvl);

      const totalHeal = healAmount + extraRegen;
      const actualHeal = Math.min(totalHeal, playerMaxHp - playerHp);
      playerHp += actualHeal;
      rounds.push(`Round ${roundNum} (End): Player heals for +${actualHeal} HP. Player HP: ${playerHp}/${playerMaxHp}`);
    }

    // Archangel's Harp Forge 4: Celestial Requiem healing
    let hasHarpF4 = false;
    for (const wp of equippedWeapons) {
      if (wp.name === "Archangel's Harp" && wp.forge >= 4) {
        hasHarpF4 = true;
      }
    }
    if (hasHarpF4 && playerHp > 0 && playerHp < playerMaxHp) {
      const harpHeal = Math.min(150, Math.floor((playerMaxHp - playerHp) * 0.10));
      if (harpHeal > 0) {
        playerHp += harpHeal;
        rounds.push(`Round ${roundNum} (Celestial Requiem): Player heals for +${harpHeal} HP (10% missing HP). Player HP: ${playerHp}/${playerMaxHp}`);
      }
    }

    // Amrita Bell Level 15: Samsara Echo (Deals 200 True Damage and stacks +5% Vulnerability)
    let hasAmritaBellL15 = false;
    for (const wp of equippedWeapons) {
      if (wp.name === "Amrita Bell" && getWpLvl(wp.name) >= 15) {
        hasAmritaBellL15 = true;
      }
    }
    if (hasAmritaBellL15 && monsterHp > 0) {
      amritaBellVulnStacks = Math.min(5, amritaBellVulnStacks + 1);
      vulnRatio += amritaBellVulnStacks * 0.05;
      const sEchoDmg = 200;
      monsterHp -= sEchoDmg;
      totalDamageDealt += sEchoDmg;
      rounds.push(`Round ${roundNum} (Samsara Echo): Deals ${sEchoDmg} bonus True Damage and increases monster Vulnerability by +5% (Current stacks: +${amritaBellVulnStacks * 5}%). Monster HP: ${Math.max(0, monsterHp)}`);
    }

    // Elite tier end-of-round regens (disabled if healing disabled)
    if (!isMonsterHealingDisabled && monsterHp > 0) {
      if (monster.tier === 'overpowered') {
        const regen = Math.floor(maxMonsterHp * 0.03);
        const prevHp = monsterHp;
        monsterHp = Math.min(maxMonsterHp, monsterHp + regen);
        currentMonsterAtk = Math.floor(currentMonsterAtk + monsterScaledAtk * 0.05);
        rounds.push(`Round ${roundNum} (Dread Presence): Monster regens +${monsterHp - prevHp} HP and ATK increases!`);
      } else if (monster.tier === 'chronicle') {
        const regen = Math.floor(maxMonsterHp * 0.02);
        const prevHp = monsterHp;
        monsterHp = Math.min(maxMonsterHp, monsterHp + regen);
        rounds.push(`Round ${roundNum} (Awakened Memory): Monster regens +${monsterHp - prevHp} HP!`);
      } else if (monster.tier === 'prodigy') {
        const regen = Math.floor(maxMonsterHp * 0.03);
        const prevHp = monsterHp;
        monsterHp = Math.min(maxMonsterHp, monsterHp + regen);
        currentMonsterAtk = Math.floor(currentMonsterAtk + monsterScaledAtk * 0.05);
        rounds.push(`Round ${roundNum} (Transcended Form): Monster regens +${monsterHp - prevHp} HP and ATK surges!`);
      } else if (monster.tier === 'beyond') {
        const regen = Math.floor(maxMonsterHp * 0.05);
        const prevHp = monsterHp;
        monsterHp = Math.min(maxMonsterHp, monsterHp + regen);
        currentMonsterAtk = Math.floor(currentMonsterAtk + monsterScaledAtk * 0.08);
        rounds.push(`Round ${roundNum} (Existential Terror): Monster regens +${monsterHp - prevHp} HP and ATK erupts!`);
      }
    }

    // Support weapons true damage ticks
    if (monsterHp > 0 && playerHp > 0) {
      let trueDmg = 0;
      const checkCurse = (wp, lvl, forge) => {
        if (!wp) return;
        const scale = 1 + forge * 0.1;
        if (wp.name === 'Hexing Totem') {
          if (lvl >= 30) trueDmg += 100 * scale;
          else if (lvl >= 25) trueDmg += 50 * scale;
          else if (lvl >= 10) trueDmg += 20 * scale;
        } else if (wp.name === 'Shadow Tome') {
          if (lvl >= 30) trueDmg += 250 * scale;
          else if (lvl >= 25) trueDmg += 150 * scale;
          else if (lvl >= 20) trueDmg += 100 * scale;
          else if (lvl >= 10) trueDmg += 60 * scale;
          else if (lvl >= 5) trueDmg += 30 * scale;
        } else if (wp.name === 'Aegis Breaker') {
          if (lvl >= 30) trueDmg += 500 * scale;
          else if (lvl >= 25) trueDmg += 350 * scale;
          else if (lvl >= 20) trueDmg += 200 * scale;
          else if (lvl >= 10) trueDmg += 100 * scale;
        }
      };
      checkCurse(off1Weapon, off1Lvl, off1Forge);
      checkCurse(off2Weapon, off2Lvl, off2Forge);

      // Support weapon Curse true damage multipliers
      trueDmg = (trueDmg + baseTDmg) * playerTrueDmgMultiplier * dotTrueDmgMultiplier;

      // Jester's Staff True DMG custom forge / special abilities
      let jestersStaffTrueDmg = 0;
      let jestersStaffLabel = '';
      const checkJestersStaffTrueDmg = (wpName) => {
        if (wpName === 'Jester\'s Staff') {
          const wData = weaponLevels[wpName] || {};
          const forge = wData.forge || 0;
          if (forge > 0) {
            if (forge >= 6) {
              jestersStaffTrueDmg += 1500;
              jestersStaffLabel = "Jester's Staff Chaos";
            } else if (roundNum <= 3) {
              jestersStaffTrueDmg += 250 * forge;
              jestersStaffLabel = `Jester's Staff Forge ${forge}`;
            }
          }
        }
      };
      if (activeTeam.onfield) checkJestersStaffTrueDmg(activeTeam.onfield.weapon);
      if (activeTeam.offfield1) checkJestersStaffTrueDmg(activeTeam.offfield1.weapon);
      if (activeTeam.offfield2) checkJestersStaffTrueDmg(activeTeam.offfield2.weapon);

      jestersStaffTrueDmg = jestersStaffTrueDmg * playerTrueDmgMultiplier * dotTrueDmgMultiplier;

      const finalTrueDmg = Math.floor(trueDmg + jestersStaffTrueDmg);
      if (finalTrueDmg > 0) {
        monsterHp -= finalTrueDmg;
        totalDamageDealt += finalTrueDmg;
        rounds.push(`Round ${roundNum} (True Damage): Curse/Jester deals ${finalTrueDmg} true damage (ignores DEF). Monster HP: ${Math.max(0, monsterHp)}`);
      }

    }

    // Archmage Staff Sanctuary emergency heal (once per battle)
    const checkArchmage = (wp, lvl, forge) => {
      if (wp && lvl >= 5 && wp.name === 'Archmage Staff') {
        const threshold = (wp.forge >= 6 && isEliteMonster) ? 0.50 : (lvl >= 20 ? 0.35 : 0.30);
        const baseHealAmt = (wp.forge >= 6 && isEliteMonster) ? 800 : (lvl >= 20 ? 250 : lvl >= 15 ? 220 : lvl >= 10 ? 150 : 100);
        const scale = 1 + forge * 0.1;
        const emergencyHeal = baseHealAmt * scale;
        if (playerHp > 0 && playerHp < (playerMaxHp * threshold) && !archmageHealUsed) {
          archmageHealUsed = true;
          const actualEmergency = Math.min(Math.floor(emergencyHeal), playerMaxHp - playerHp);
          playerHp += actualEmergency;
          rounds.push(`Round ${roundNum} (Sanctuary): Emergency heal restores +${actualEmergency} HP! Player HP: ${playerHp}/${playerMaxHp}`);
        }
      }
    };
    checkArchmage(off1Weapon, off1Lvl, off1Forge);
    checkArchmage(off2Weapon, off2Lvl, off2Forge);

    roundNum++;
  }

  const won = monsterHp <= 0;
  let result = won ? 'victory' : (playerHp > 0 ? 'draw' : 'defeat');
  if (!won && playerHp > 0) {
    rounds.push(`💨 Draw! ${monster.displayName || monster.name} ran away after ${maxRounds} rounds!`);
  }

  return {
    won,
    result,
    rounds: rounds,
    damageTaken: playerMaxHp - playerHp,
    totalDamageDealt: totalDamageDealt,
    roundsPlayed: Math.min(maxRounds, roundNum - 1),
    monsterResistances: monsterResistances
  };
}

module.exports = {
  getPowerScaling,
  getUserStats,
  simulateBattle
};
