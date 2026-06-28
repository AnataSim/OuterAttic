// monsters.js

const MONSTERS = {
  threat1: [
    { 
      name: 'Slime', hp: 45, atk: 6, def: 2, tameRate: 0.70, goldMin: 10, goldMax: 20, xpMin: 10, xpMax: 15,
      desc: 'A squishy, gelatinous creature that smells faintly of sweet apples. Surprisingly friendly.',
      passiveName: 'Sticky Body',
      passiveDesc: 'Reduces enemy attack speed (flavor effect).'
    },
    { 
      name: 'Goblin', hp: 60, atk: 9, def: 3, tameRate: 0.60, goldMin: 15, goldMax: 25, xpMin: 15, xpMax: 20,
      desc: 'A small, green, mischievous trickster who hoards shiny items and plays pranks.',
      passiveName: 'Thievery',
      passiveDesc: 'Slightly increases gold acquisition (flavor effect).'
    }
  ],
  threat2: [
    { 
      name: 'Wild Boar', hp: 85, atk: 13, def: 4, tameRate: 0.50, goldMin: 25, goldMax: 35, xpMin: 20, xpMax: 30,
      desc: 'A wild forest beast equipped with razor-sharp tusks and a bad temper.',
      passiveName: 'Fierce Charge',
      passiveDesc: 'Deals extra impact damage at the start of battle (flavor effect).'
    },
    { 
      name: 'Dire Wolf', hp: 145, atk: 22, def: 8, tameRate: 0.40, goldMin: 45, goldMax: 65, xpMin: 35, xpMax: 50,
      desc: 'An oversized wolf that hunts in packs with deadly coordination and icy yellow eyes.',
      passiveName: 'Pack Hunter',
      passiveDesc: 'Increases critical strike chance in groups (flavor effect).'
    }
  ],
  threat3: [
    { 
      name: 'Orc Warrior', hp: 210, atk: 28, def: 12, tameRate: 0.30, goldMin: 65, goldMax: 85, xpMin: 50, xpMax: 70,
      desc: 'A hulking brutish soldier wearing crude iron plating, trained to fight to the end.',
      passiveName: 'Enrage',
      passiveDesc: 'Gains attack power as health decreases (flavor effect).'
    },
    { 
      name: 'Gargoyle', hp: 250, atk: 24, def: 20, tameRate: 0.25, goldMin: 75, goldMax: 95, xpMin: 60, xpMax: 80,
      desc: 'A grotesque stone statue that watches silently from high perches, coming to life in darkness.',
      passiveName: 'Stone Skin',
      passiveDesc: 'Greatly increases defense when standing still (flavor effect).'
    }
  ],
  threat4: [
    { 
      name: 'Golem', hp: 410, atk: 42, def: 35, tameRate: 0.18, goldMin: 130, goldMax: 190, xpMin: 120, xpMax: 150,
      desc: 'A massive automaton constructed from solid granite, animated by a glowing magical core.',
      passiveName: 'Unstoppable',
      passiveDesc: 'Immune to stun and knockback effects (flavor effect).'
    },
    { 
      name: 'Griffin', hp: 340, atk: 52, def: 20, tameRate: 0.15, goldMin: 160, goldMax: 210, xpMin: 140, xpMax: 180,
      desc: 'A proud, legendary predator with the front of a golden eagle and the back of a powerful lion.',
      passiveName: 'Swoop',
      passiveDesc: 'Has a high chance to dodge the first attack (flavor effect).'
    }
  ],
  threat5: [
    { 
      name: 'Shadow Wyvern', hp: 520, atk: 75, def: 30, tameRate: 0.10, goldMin: 220, goldMax: 350, xpMin: 200, xpMax: 260,
      desc: 'A dark, bat-winged dragon species that hunts invisibly inside dense shadows and mist.',
      passiveName: 'Shadow Cloak',
      passiveDesc: 'Confuses attackers, causing them to occasionally miss (flavor effect).'
    },
    { 
      name: 'Phoenix', hp: 900, atk: 110, def: 50, tameRate: 0.08, goldMin: 650, goldMax: 950, xpMin: 500, xpMax: 700,
      desc: 'A magnificent bird of fire that burns with the heat of a star and is reborn upon death.',
      passiveName: 'Rebirth',
      passiveDesc: 'Revives with a fraction of health once per battle (flavor effect).'
    }
  ],
  threat6: [
    { 
      name: 'Ancient Dragon', hp: 1550, atk: 180, def: 100, tameRate: 0.04, goldMin: 1200, goldMax: 1800, xpMin: 800, xpMax: 1200,
      desc: 'An ancient, god-like reptile with scales harder than diamond and breath of pure energy.',
      passiveName: 'Dragon Lord',
      passiveDesc: 'Intimidates foes, reducing all their attributes by 10% (flavor effect).'
    },
    { 
      name: 'Behemoth', hp: 1950, atk: 220, def: 130, tameRate: 0.03, goldMin: 1500, goldMax: 2200, xpMin: 1000, xpMax: 1500,
      desc: 'A colossal, walking mountain of muscle and bone. Its steps cause localized earthquakes.',
      passiveName: 'Titan\'s Might',
      passiveDesc: 'Deals splash damage to adjacent targets (flavor effect).'
    }
  ],
  threatX: [
    {
      name: 'Kirin', hp: 2000, atk: 120, def: 100, tameRate: 0, goldMin: 0, goldMax: 0, xpMin: 0, xpMax: 0,
      desc: 'A legendary mystical beast of pure light. Only appears once you have gathered all T1-T6 monsters.',
      passiveName: 'Celestial Grace',
      passiveDesc: 'A support animal (Off-Field only). Levels 5/10/15/20/25/30 unlock cumulative buffs: +5% CR, +10% DEF, +10% ATK, +15% HP, +15% PEN, and +20% Stats. Enchantment E1-E6 implants stats (CR, PEN, TDMG, DOT, VUL), with E2, E4, E6 specials (E4 cleanses ATK debuffs and implants +20% ATK and +20% CR; E6 gives massive +50% ATK/DEF, +150% CDM, and 50% damage reflection).'
    }
  ]
};

// Roll threat level based on player's Power Scaling (PS)
function drawByPowerScaling(ps) {
  const roll = Math.random() * 100;
  if (ps <= 10) {
    if (roll < 65) return 'threat1';
    if (roll < 95) return 'threat2';
    return 'threat3';
  } else if (ps <= 20) {
    if (roll < 30) return 'threat1';
    if (roll < 75) return 'threat2';
    if (roll < 95) return 'threat3';
    return 'threat4';
  } else if (ps <= 30) {
    if (roll < 10) return 'threat1';
    if (roll < 35) return 'threat2';
    if (roll < 75) return 'threat3';
    if (roll < 95) return 'threat4';
    return 'threat5';
  } else if (ps <= 40) {
    // T1 still appears rarely (3%) — elite tier can spawn here!
    if (roll < 3) return 'threat1';
    if (roll < 10) return 'threat2';
    if (roll < 30) return 'threat3';
    if (roll < 70) return 'threat4';
    if (roll < 95) return 'threat5';
    return 'threat6';
  } else if (ps <= 60) { // 41-60
    // T1 very rare (1%) — Beyond can still haunt you!
    if (roll < 1) return 'threat1';
    if (roll < 5) return 'threat2';
    if (roll < 15) return 'threat3';
    if (roll < 35) return 'threat4';
    if (roll < 65) return 'threat5';
    return 'threat6';
  } else if (ps <= 80) { // 61-80
    // High end — T6 dominant, T1 only 0.5%
    if (roll < 0.5) return 'threat1';
    if (roll < 3) return 'threat2';
    if (roll < 8) return 'threat3';
    if (roll < 20) return 'threat4';
    if (roll < 45) return 'threat5';
    return 'threat6';
  } else { // 81-100
    // Endgame — T6 dominant (70%), T1/T2 nearly impossible
    if (roll < 0.2) return 'threat1';
    if (roll < 1.5) return 'threat2';
    if (roll < 4) return 'threat3';
    if (roll < 12) return 'threat4';
    if (roll < 30) return 'threat5';
    return 'threat6';
  }
}

const TIERS = ['basic', 'blessed', 'enchanted', 'overpowered', 'chronicle', 'prodigy', 'beyond'];

const PROGRESSION_STEPS = [];
for (const tier of TIERS) {
  for (let th = 1; th <= 6; th++) {
    PROGRESSION_STEPS.push({ tier, threat: `threat${th}` });
  }
}

function getTierChances(ps, lobbyThreatOffset = 0) {
  let center = 1.5 + Math.pow((ps - 1) / 119, 0.5) * 38.0 + lobbyThreatOffset;
  center = Math.min(39.5, Math.max(1.5, center));
  const sigma = 1.2;
  
  const tierWeights = {
    basic: 0,
    blessed: 0,
    enchanted: 0,
    overpowered: 0,
    chronicle: 0,
    prodigy: 0,
    beyond: 0
  };
  
  let totalWeight = 0;
  for (let i = 0; i < 42; i++) {
    const tier = TIERS[Math.floor(i / 6)];
    const dist = i - center;
    const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
    tierWeights[tier] += weight;
    totalWeight += weight;
  }
  
  return {
    basic: tierWeights.basic / totalWeight,
    blessed: tierWeights.blessed / totalWeight,
    enchanted: tierWeights.enchanted / totalWeight,
    overpowered: tierWeights.overpowered / totalWeight,
    chronicle: tierWeights.chronicle / totalWeight,
    prodigy: tierWeights.prodigy / totalWeight,
    beyond: tierWeights.beyond / totalWeight
  };
}

function getRandomMonster(ps = 1, level = 1, lobbyThreatOffset = 0) {
  // Center maps from PS [1, 120] to step index [1.5, 39.5]
  let center = 1.5 + Math.pow((ps - 1) / 119, 0.5) * 38.0 + lobbyThreatOffset;
  center = Math.min(39.5, Math.max(1.5, center));
  const sigma = 1.2;
  
  // Cap the maximum threat based on player level to prevent low-level players from getting instant-killed
  const maxThreatNum = Math.min(6, Math.floor(level / 2.5) + 1);

  // Calculate weights for all 42 steps
  let totalWeight = 0;
  const weights = [];
  for (let i = 0; i < 42; i++) {
    const step = PROGRESSION_STEPS[i];
    const threatNum = parseInt(step.threat.replace('threat', ''), 10);
    
    // If threat is higher than the player's level cap, set its weight to 0
    if (threatNum > maxThreatNum) {
      weights.push(0);
      continue;
    }
    
    const dist = i - center;
    const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
    weights.push(weight);
    totalWeight += weight;
  }

  // Roll from the weights
  let roll = Math.random() * totalWeight;
  let selectedIndex = 0;
  for (let i = 0; i < 42; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      selectedIndex = i;
      break;
    }
  }

  const selectedStep = PROGRESSION_STEPS[selectedIndex];
  const list = MONSTERS[selectedStep.threat];
  const baseMonster = list[Math.floor(Math.random() * list.length)];
  
  const tier = selectedStep.tier;
  const threat = selectedStep.threat;
  
  // Format displayName with tier icons
  let displayName = baseMonster.name;
  if (tier === 'beyond') displayName = '💀 Beyond ' + baseMonster.name;
  else if (tier === 'prodigy') displayName = '⚡ Prodigy ' + baseMonster.name;
  else if (tier === 'chronicle') displayName = '📖 Chronicle ' + baseMonster.name;
  else if (tier === 'overpowered') displayName = '🔥 Overpowered ' + baseMonster.name;
  else if (tier === 'enchanted') displayName = '🌀 Enchanted ' + baseMonster.name;
  else if (tier === 'blessed') displayName = '✨ Blessed ' + baseMonster.name;

  return { ...baseMonster, displayName, tier, threat };
}

function parseMonsterTierAndName(inputName) {
  let cleanName = inputName.trim().toLowerCase().replace(/_/g, ' ');
  let tier = 'basic';
  
  const prefixes = [
    { prefix: 'beyond', t: 'beyond' },
    { prefix: '💀 beyond', t: 'beyond' },
    { prefix: 'prodigy', t: 'prodigy' },
    { prefix: '⚡ prodigy', t: 'prodigy' },
    { prefix: 'chronicle', t: 'chronicle' },
    { prefix: '📖 chronicle', t: 'chronicle' },
    { prefix: 'overpowered', t: 'overpowered' },
    { prefix: '🔥 overpowered', t: 'overpowered' },
    { prefix: 'op', t: 'overpowered' },
    { prefix: 'blessed', t: 'blessed' },
    { prefix: '✨ blessed', t: 'blessed' },
    { prefix: 'enchanted', t: 'enchanted' },
    { prefix: '🌀 enchanted', t: 'enchanted' }
  ];
  
  for (const p of prefixes) {
    if (cleanName.startsWith(p.prefix + ' ')) {
      tier = p.t;
      cleanName = cleanName.substring(p.prefix.length + 1).trim();
      break;
    }
  }
  
  return { tier, baseName: cleanName };
}

function findMonsterByName(name) {
  if (!name) return null;
  const { tier, baseName } = parseMonsterTierAndName(name);
  
  for (const threat in MONSTERS) {
    const found = MONSTERS[threat].find(m => m.name.toLowerCase() === baseName);
    if (found) {
      let displayName = found.name;
      if (tier === 'overpowered') displayName = '🔥 Overpowered ' + found.name;
      else if (tier === 'blessed') displayName = '✨ Blessed ' + found.name;
      else if (tier === 'enchanted') displayName = '🌀 Enchanted ' + found.name;
      else if (tier === 'chronicle') displayName = '📖 Chronicle ' + found.name;
      else if (tier === 'prodigy') displayName = '⚡ Prodigy ' + found.name;
      else if (tier === 'beyond') displayName = '💀 Beyond ' + found.name;
      
      return { ...found, threat, tier, displayName };
    }
  }
  return null;
}

// Generate TX Kirin boss stats dynamically based on Beyond Level
// This is NOT a random spawn monster — it's a special boss encounter
function getTXKirinStats(byLevel, playerLevel = 1, ps = 1) {
  const baseHp = 25000000;
  const baseAtk = 2000;
  const baseDef = 1500;

  // Exponential scaling: each BY level multiplies the stats exponentially
  // BY1: HP 2.2x, ATK 1.8x, DEF 1.6x
  // BY2: HP 4.84x, ATK 3.24x, DEF 2.56x
  // BY3: HP 10.65x, ATK 5.83x, DEF 4.10x
  const scaleFactor = Math.pow(2.2, byLevel);
  const atkScale = Math.pow(1.8, byLevel);
  const defScale = Math.pow(1.6, byLevel);

  // Additional PS + player level scaling so the boss stays relevant
  const levelMult = 1 + (playerLevel - 1) * 0.1;
  const psMult = 1 + (ps - 1) * 0.05;

  const hp = Math.floor(baseHp * scaleFactor * levelMult * psMult);
  const atk = Math.floor(baseAtk * atkScale * levelMult * psMult);
  const def = Math.floor(baseDef * defScale * levelMult);

  return {
    name: 'Kirin',
    displayName: `⚡ TX Kirin [BY ${byLevel}]`,
    hp, atk, def,
    tameRate: 0,
    goldMin: 0, goldMax: 0,
    xpMin: 0, xpMax: 0,
    tier: 'tx',
    threat: 'threatX',
    byLevel: byLevel,
    desc: `A celestial Kirin at Beyond Level ${byLevel}. Its power transcends mortal comprehension.`,
    passiveName: 'Celestial Judgement',
    passiveDesc: 'Reduces player ATK by 40%. Regens 8% Max HP per round. ATK surges +12% per round. Stun immune. 30 round limit.'
  };
}

module.exports = {
  MONSTERS,
  drawByPowerScaling,
  getRandomMonster,
  findMonsterByName,
  getTierChances,
  getTXKirinStats
};
