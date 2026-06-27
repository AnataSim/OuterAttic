// weapons.js

const WEAPONS = {
  basic: [
    { 
      name: 'Wooden Sword', 
      category: 'dps', 
      atkBonus: 4, 
      defBonus: 0, 
      hpBonus: 0, 
      sellValue: 20,
      critChanceBonus: 0.02,
      critDamageBonus: 0.05,
      passiveName: 'Sharpened Edge',
      passiveDesc: 'Deals +5% extra damage during battle.'
    },
    { 
      name: 'Buckler Shield', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 4, 
      hpBonus: 0, 
      sellValue: 20,
      critChanceBonus: 0.01,
      critDamageBonus: 0.02,
      passiveName: 'Vigilance',
      passiveDesc: 'Adds +4 DEF to total stats.'
    },
    {
      name: 'Worn Warhorn',
      category: 'support',
      atkBonus: 2,
      defBonus: 0,
      hpBonus: 10,
      sellValue: 20,
      critChanceBonus: 0.01,
      critDamageBonus: 0.02,
      passiveName: 'Rallying Call',
      passiveDesc: 'Adds +2 ATK to total stats.'
    }
  ],
  usual: [
    { 
      name: 'Rusty Dagger', 
      category: 'dps', 
      atkBonus: 8, 
      defBonus: 0, 
      hpBonus: 0, 
      sellValue: 40,
      critChanceBonus: 0.03,
      critDamageBonus: 0.08,
      passiveName: 'Quick Stab',
      passiveDesc: '10% chance to strike a second time in a round.'
    },
    { 
      name: 'Novice Staff', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 2, 
      hpBonus: 20, 
      healAmount: 4, 
      sellValue: 40,
      critChanceBonus: 0.015,
      critDamageBonus: 0.04,
      passiveName: 'Faith',
      passiveDesc: 'Restores +4 HP to the player at the end of each round.'
    },
    {
      name: 'Commander\'s Banner',
      category: 'support',
      atkBonus: 4,
      defBonus: 2,
      hpBonus: 20,
      sellValue: 40,
      critChanceBonus: 0.015,
      critDamageBonus: 0.03,
      passiveName: 'Marching Banner',
      passiveDesc: 'Adds +4 ATK and +2 DEF to total stats.'
    }
  ],
  unusual: [
    { 
      name: 'Iron Broadsword', 
      category: 'dps', 
      atkBonus: 18, 
      defBonus: 2, 
      hpBonus: 0, 
      sellValue: 100,
      critChanceBonus: 0.05,
      critDamageBonus: 0.12,
      passiveName: 'Heavy Strike',
      passiveDesc: '15% chance to land a Critical Hit (1.5x damage).'
    },
    { 
      name: 'Round Shield', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 12, 
      hpBonus: 10, 
      sellValue: 100,
      critChanceBonus: 0.02,
      critDamageBonus: 0.05,
      passiveName: 'Fortress',
      passiveDesc: 'Increases total DEF stats by 10%.'
    },
    {
      name: 'Focusing Lens',
      category: 'support',
      atkBonus: 6,
      defBonus: 0,
      hpBonus: 30,
      sellValue: 100,
      critChanceBonus: 0.03,
      critDamageBonus: 0.06,
      passiveName: 'Focus Aura',
      passiveDesc: 'Increases player Crit Chance by +3% during battle.'
    }
  ],
  odd: [
    { 
      name: 'Steel Spear', 
      category: 'dps', 
      atkBonus: 28, 
      defBonus: 0, 
      hpBonus: 0, 
      sellValue: 180,
      critChanceBonus: 0.06,
      critDamageBonus: 0.15,
      passiveName: 'Armor Pierce',
      passiveDesc: 'Ignores 20% of the target\'s DEF when attacking.'
    },
    { 
      name: 'Apprentice Wand', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 4, 
      hpBonus: 40, 
      healAmount: 10, 
      sellValue: 180,
      critChanceBonus: 0.025,
      critDamageBonus: 0.06,
      passiveName: 'Renew',
      passiveDesc: 'Restores +10 HP per round and increases total HP by 10%.'
    },
    {
      name: 'Inspiring Scepter',
      category: 'support',
      atkBonus: 8,
      defBonus: 4,
      hpBonus: 40,
      sellValue: 180,
      critChanceBonus: 0.04,
      critDamageBonus: 0.08,
      passiveName: 'Aura of Inspiration',
      passiveDesc: 'Increases player ATK by 5% during battle.'
    }
  ],
  exotic: [
    { 
      name: 'Excalibur', 
      category: 'dps', 
      atkBonus: 60, 
      defBonus: 10, 
      hpBonus: 0, 
      sellValue: 450,
      critChanceBonus: 0.08,
      critDamageBonus: 0.20,
      passiveName: 'Holy Blessing',
      passiveDesc: 'Increases player ATK by 20% while player HP is above 50%.'
    },
    { 
      name: 'Knight\'s Aegis', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 45, 
      hpBonus: 30, 
      sellValue: 450,
      critChanceBonus: 0.03,
      critDamageBonus: 0.08,
      passiveName: 'Aegis Shield',
      passiveDesc: 'Reduces all incoming damage by 15% (can stack).'
    },
    {
      name: 'Valor Ring',
      category: 'support',
      atkBonus: 15,
      defBonus: 10,
      hpBonus: 60,
      sellValue: 450,
      critChanceBonus: 0.05,
      critDamageBonus: 0.10,
      passiveName: 'Ring of Courage',
      passiveDesc: 'Increases player ATK by 8% during battle.'
    },
    {
      name: 'Hexing Totem',
      category: 'support',
      atkBonus: 10,
      defBonus: 5,
      hpBonus: 80,
      sellValue: 450,
      critChanceBonus: 0.03,
      critDamageBonus: 0.08,
      passiveName: 'Hex Vulnerability',
      passiveDesc: 'Applies +15% Vulnerability to the monster, causing it to take extra damage.'
    }
  ],
  mythic: [
    { 
      name: 'Dragon Bow', 
      category: 'dps', 
      atkBonus: 90, 
      defBonus: 0, 
      hpBonus: 0, 
      sellValue: 800,
      critChanceBonus: 0.10,
      critDamageBonus: 0.25,
      passiveName: 'Dragon Fire',
      passiveDesc: 'Inflicts 15 fixed burn damage to the monster every round.'
    },
    { 
      name: 'Archmage Staff', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 8, 
      hpBonus: 100, 
      healAmount: 25, 
      sellValue: 800,
      critChanceBonus: 0.04,
      critDamageBonus: 0.10,
      passiveName: 'Sanctuary',
      passiveDesc: 'Heals +25 HP per round. Restores +100 HP once per battle when HP drops below 30%.'
    },
    {
      name: 'Archangel\'s Harp',
      category: 'support',
      atkBonus: 25,
      defBonus: 15,
      hpBonus: 120,
      sellValue: 800,
      critChanceBonus: 0.06,
      critDamageBonus: 0.15,
      passiveName: 'Serenade of War',
      passiveDesc: 'Increases player Crit Chance by +10% during battle.'
    },
    {
      name: 'Shadow Tome',
      category: 'support',
      atkBonus: 20,
      defBonus: 10,
      hpBonus: 100,
      sellValue: 800,
      critChanceBonus: 0.04,
      critDamageBonus: 0.12,
      passiveName: 'Shadow Curse',
      passiveDesc: 'Inflicts 30 fixed true damage (ignores DEF) to the monster every round.'
    }
  ],
  supreme: [
    { 
      name: 'Mjolnir', 
      category: 'dps', 
      atkBonus: 160, 
      defBonus: 15, 
      hpBonus: 0, 
      sellValue: 1800,
      critChanceBonus: 0.12,
      critDamageBonus: 0.30,
      passiveName: 'Thunder Strike',
      passiveDesc: '30% chance to stun the monster for one round, preventing its attack.'
    },
    { 
      name: 'Gungnir', 
      category: 'dps', 
      atkBonus: 240, 
      defBonus: 20, 
      hpBonus: 0, 
      sellValue: 1800,
      critChanceBonus: 0.14,
      critDamageBonus: 0.35,
      passiveName: 'Odin\'s Precision',
      passiveDesc: 'Attacks never deal less than 150 damage, and have a 25% chance to deal 2x damage.'
    },
    { 
      name: 'Divine Bulwark', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 120, 
      hpBonus: 80, 
      sellValue: 1800,
      critChanceBonus: 0.05,
      critDamageBonus: 0.12,
      passiveName: 'Divine Protection',
      passiveDesc: 'Reduces all incoming damage by 30% (can stack).'
    },
    { 
      name: 'Secret Elixir', 
      category: 'support', 
      atkBonus: 0, 
      defBonus: 10, 
      hpBonus: 200, 
      healAmount: 60, 
      sellValue: 1800,
      critChanceBonus: 0.06,
      critDamageBonus: 0.15,
      passiveName: 'Elixir of Life',
      passiveDesc: 'Restores +60 HP per round and increases all stats (HP, ATK, DEF) by 25%.'
    },
    {
      name: 'Asgardian War-Horn',
      category: 'support',
      atkBonus: 40,
      defBonus: 25,
      hpBonus: 180,
      sellValue: 1800,
      critChanceBonus: 0.08,
      critDamageBonus: 0.20,
      passiveName: 'Horn of Valhalla',
      passiveDesc: 'Increases player ATK by 15% and Crit Chance by +8% during battle.'
    },
    {
      name: 'Aegis Breaker',
      category: 'support',
      atkBonus: 30,
      defBonus: 15,
      hpBonus: 150,
      sellValue: 1800,
      critChanceBonus: 0.05,
      critDamageBonus: 0.15,
      passiveName: 'Shield Crusher',
      passiveDesc: 'Applies +30% Vulnerability to the monster, causing it to take extra damage.'
    }
  ],
  secret: [
    {
      name: 'Lethalized Dark Scythe',
      category: 'dps',
      atkBonus: 250,
      defBonus: 25,
      hpBonus: 0,
      sellValue: 5000,
      critChanceBonus: 0.15,
      critDamageBonus: 0.40,
      passiveName: 'Lethal Harvest',
      passiveDesc: 'Deals +25% damage. If the monster is below 30% HP, attacks deal 3x damage.'
    },
    {
      name: 'Poison Butterfly Knife',
      category: 'dps',
      atkBonus: 200,
      defBonus: 0,
      hpBonus: 0,
      sellValue: 5000,
      critChanceBonus: 0.16,
      critDamageBonus: 0.38,
      passiveName: 'Neurotoxin',
      passiveDesc: 'Deals 40 poison damage every round. 10% chance to attack twice in a round.'
    },
    {
      name: 'Golden Kukri',
      category: 'dps',
      atkBonus: 220,
      defBonus: 40,
      hpBonus: 0,
      sellValue: 5000,
      critChanceBonus: 0.12,
      critDamageBonus: 0.45,
      passiveName: 'Golden Guard',
      passiveDesc: '20% chance to deal double damage. Increases total DEF stats by 20% of your ATK.'
    },
    {
      name: 'Jester\'s Staff',
      category: 'support',
      atkBonus: 50,
      defBonus: 30,
      hpBonus: 250,
      sellValue: 5000,
      critChanceBonus: 0.10,
      critDamageBonus: 0.25,
      passiveName: 'Calamity Aura',
      passiveDesc: 'Increases player ATK by 20% and Crit Chance by +10% during battle.'
    },
    {
      name: 'Amrita Bell',
      category: 'support',
      atkBonus: 70,
      defBonus: 10,
      hpBonus: 300,
      sellValue: 5000,
      critChanceBonus: 0.12,
      critDamageBonus: 0.30,
      passiveName: 'Amrita Serenade',
      passiveDesc: 'A powerful offensive support weapon. Implants +100 Poison DOT, +10% Vulnerability, increases player ATK by 30% and Crit Chance by +15%.'
    }
  ]
};

function drawWeaponByRarity() {
  const roll = Math.random() * 100;
  if (roll < 0.5) return 'secret';    // 0.5%
  if (roll < 2.0) return 'supreme';   // 1.5%
  if (roll < 5.0) return 'mythic';    // 3.0%
  if (roll < 10.0) return 'exotic';   // 5.0%
  if (roll < 20.0) return 'odd';      // 10%
  if (roll < 35.0) return 'unusual';  // 15%
  if (roll < 60.0) return 'usual';    // 25%
  return 'basic';                     // 40%
}

function getRandomWeapon() {
  const rarity = drawWeaponByRarity();
  const list = WEAPONS[rarity].filter(w => w.name !== 'Amrita Bell');
  const weapon = list[Math.floor(Math.random() * list.length)];
  return { ...weapon, rarity };
}

function findWeaponByName(name) {
  if (!name) return null;
  const cleanName = name.replace(/_/g, ' ');
  for (const rarity in WEAPONS) {
    const found = WEAPONS[rarity].find(w => w.name.toLowerCase() === cleanName.toLowerCase());
    if (found) return { ...found, rarity };
  }
  return null;
}

const WEAPON_PASSIVES = {
  'Wooden Sword': {
    5: { name: 'Sharpened Edge', desc: 'Deals +5% extra damage during battle.' },
    10: { name: 'Timber Strike', desc: 'Deals +10 additional flat damage.' },
    15: { name: 'Double Splinter', desc: '10% chance to strike a second time in a round.' },
    20: { name: 'Oak\'s Might', desc: 'Deals +15% extra damage and has 15% chance to land a Critical Hit (1.5x damage).' },
    25: { name: 'Forest Call', desc: 'Increases Crit Chance by +10% and Crit Damage by +20%.' },
    30: { name: 'Splinter Storm', desc: 'Double strike chance increases to 25% and deals +20% extra damage.' }
  },
  'Buckler Shield': {
    5: { name: 'Vigilance', desc: 'Adds +4 DEF to total stats.' },
    10: { name: 'Iron Grip', desc: 'Adds +8 DEF to total stats.' },
    15: { name: 'Shield Bash', desc: 'Deals 15 damage back to the monster when hit.' },
    20: { name: 'Perfect Block', desc: '10% chance to reduce incoming damage to 0.' },
    25: { name: 'Guard Stance', desc: 'Adds +20 DEF to total stats.' },
    30: { name: 'Absolute Defiance', desc: 'Perfect Block chance increases to 20% and reflects 30 flat damage when hit.' }
  },
  'Rusty Dagger': {
    5: { name: 'Quick Stab', desc: '10% chance to strike a second time in a round.' },
    10: { name: 'Tetanus Edge', desc: 'Deals 5 poison damage to the monster every round.' },
    15: { name: 'Desperate Flurry', desc: 'Increases second strike chance to 20%.' },
    20: { name: 'Assassination', desc: 'Deals 2.0x damage if the monster is below 40% HP.' },
    25: { name: 'Toxic Mastery', desc: 'Poison damage ticks increase to 25 per round.' },
    30: { name: 'Shadow Step', desc: 'Double strike chance increases to 35% and attacks ignore 20% of the target\'s DEF.' }
  },
  'Novice Staff': {
    5: { name: 'Faith', desc: 'Restores +4 HP to the player at the end of each round.' },
    10: { name: 'Mana Shield', desc: 'Increases player DEF stats by 5.' },
    15: { name: 'Divine Grace', desc: 'Restores +8 HP (total +12 HP) to the player at the end of each round.' },
    20: { name: 'Resurrection Spark', desc: 'If player dies, revives with 50 HP (once per battle).' },
    25: { name: 'Blessing of Light', desc: 'Restores +20 HP (total +32 HP) to the player at the end of each round.' },
    30: { name: 'Miracle Spark', desc: 'If player dies, revives with 150 HP instead and increases total HP by 15%.' }
  },
  'Iron Broadsword': {
    5: { name: 'Heavy Strike', desc: '15% chance to land a Critical Hit (1.5x damage).' },
    10: { name: 'Breaker', desc: 'Ignores 15% of the target\'s DEF when attacking.' },
    15: { name: 'Staggering Blow', desc: '10% chance to stun the monster for one round, preventing its attack.' },
    20: { name: 'Iron Will', desc: 'Increases ATK stats by 30% if player HP drops below 30%.' },
    25: { name: 'Colossal Force', desc: 'Increases Crit Damage by +40% during battle.' },
    30: { name: 'Unstoppable Cleave', desc: 'Stun chance increases to 20% and attacks ignore 30% of the target\'s DEF.' }
  },
  'Round Shield': {
    5: { name: 'Fortress', desc: 'Increases total DEF stats by 10%.' },
    10: { name: 'Deflection', desc: '15% chance to deflect 50% of incoming damage back to the monster.' },
    15: { name: 'Stalwart', desc: 'Increases total HP stats by 10%.' },
    20: { name: 'Indomitable Bulwark', desc: 'Increases total DEF by 20% and reduces all incoming damage by 10%.' },
    25: { name: 'Bastion', desc: 'Increases total DEF stats by 15% and HP stats by 15%.' },
    30: { name: 'Aegis Wall', desc: 'Reduces all incoming damage by 20% and deflect chance increases to 25%.' }
  },
  'Steel Spear': {
    5: { name: 'Armor Pierce', desc: 'Ignores 20% of the target\'s DEF when attacking.' },
    10: { name: 'Lunge', desc: 'Deals +20 flat damage on Round 1.' },
    15: { name: 'Bleeding Tip', desc: 'Inflicts 12 bleeding damage to the monster every round.' },
    20: { name: 'Heartseeker', desc: '20% chance to land a Critical Hit (2.0x damage).' },
    25: { name: 'Skewer', desc: 'Ignores 35% of the target\'s DEF and bleeding damage increases to 30.' },
    30: { name: 'Spear of Longinus', desc: 'Increases Crit Chance by +25% and Crit Damage by +75%.' }
  },
  'Apprentice Wand': {
    5: { name: 'Renew', desc: 'Restores +10 HP to the player at the end of each round.' },
    10: { name: 'Arcane Intellect', desc: 'Increases total HP stats by 10%.' },
    15: { name: 'Magic Shield', desc: 'Reduces all incoming damage by 8%.' },
    20: { name: 'Overcharge', desc: 'Restores +25 HP per round and boosts player ATK stats by 10%.' },
    25: { name: 'Sage\'s Insight', desc: 'Restores +40 HP per round and increases total HP stats by 15%.' },
    30: { name: 'Celestial Overdrive', desc: 'Restores +75 HP per round, reduces incoming damage by 15%, and boosts ATK by 20%.' }
  },
  'Excalibur': {
    5: { name: 'Holy Blessing', desc: 'Increases player ATK by 20% while player HP is above 50%.' },
    10: { name: 'Divine Light', desc: 'Deals 30 flat light damage to the monster every round.' },
    15: { name: 'Exalted Blade', desc: '15% chance to land a Critical Hit (2.0x damage).' },
    20: { name: 'King\'s Authority', desc: 'Deals +30% damage and restores +15 HP at the end of each round.' },
    25: { name: 'Aura of Glory', desc: 'Divine Light damage increases to 75 and increases Crit Chance by +20%.' },
    30: { name: 'True Excalibur', desc: 'Deals +50% damage, restores +30 HP at the end of each round, and increases Crit Damage by +80%.' }
  },
  'Knight\'s Aegis': {
    5: { name: 'Aegis Shield', desc: 'Reduces all incoming damage by 15%.' },
    10: { name: 'Fortitude', desc: 'Adds +40 DEF and +100 HP to total stats.' },
    15: { name: 'Spiked Armor', desc: 'Reflects 20% of damage taken back to the monster.' },
    20: { name: 'Aegis Bastion', desc: 'Reduces all incoming damage by 30% and restores +20 HP at the end of each round.' },
    25: { name: 'Vanguard Guard', desc: 'Adds +80 DEF, +200 HP to total stats and reflects 30% of damage taken.' },
    30: { name: 'Aegis Sanctuary', desc: 'Reduces incoming damage by 40%, restores +50 HP at the end of each round, and increases total DEF by 15%.' }
  },
  'Dragon Bow': {
    5: { name: 'Dragon Fire', desc: 'Inflicts 15 fixed burn damage to the monster every round.' },
    10: { name: 'Hunter\'s Mark', desc: 'Deals +15% extra damage during battle.' },
    15: { name: 'Scorched Earth', desc: 'Burn damage increases to 40 per round.' },
    20: { name: 'Dragon\'s Gaze', desc: '25% chance to deal 2.5x damage and stun the monster.' },
    25: { name: 'Wyvern Focus', desc: 'Burn damage increases to 80 per round and increases Crit Chance by +15%.' },
    30: { name: 'Supernova Draw', desc: 'Deals +35% damage, increases Crit Chance by +30%, Crit Damage by +120%, and stuns on critical hits.' }
  },
  'Archmage Staff': {
    5: { name: 'Sanctuary', desc: 'Restores +25 HP to the player at the end of each round.' },
    10: { name: 'Emergency Ward', desc: 'Restores +100 HP once per battle when HP drops below 30%.' },
    15: { name: 'Arcane Nova', desc: 'Deals 30 flat magic damage to the monster every round.' },
    20: { name: 'Eldritch Barrier', desc: 'Restores +50 HP per round, reduces incoming damage by 15%, and ward heals +250 HP instead.' },
    25: { name: 'Chrono Shift', desc: 'Restores +80 HP per round and emergency ward heals +400 HP below 40% HP.' },
    30: { name: 'Archmage Domain', desc: 'Restores +120 HP per round, reduces incoming damage by 25%, ward heals +600 HP, and increases total HP by 20%.' }
  },
  'Mjolnir': {
    5: { name: 'Thunder Strike', desc: '30% chance to stun the monster for one round, preventing its attack.' },
    10: { name: 'Lightning Spark', desc: 'Deals 50 flat light damage to the monster every round.' },
    15: { name: 'Static Charge', desc: 'Deals +20% extra damage to stunned targets; stun chance increases to 40%.' },
    20: { name: 'God of Thunder', desc: 'Deals +35% damage and has 20% chance to deal 3x damage.' },
    25: { name: 'Lightning Storm', desc: 'Lightning Spark damage increases to 120 per round.' },
    30: { name: 'Ragnarok Hammer', desc: 'Deals +50% damage (+75% to stunned targets), stun chance increases to 50%, and has 30% chance to deal 3.5x damage.' }
  },
  'Gungnir': {
    5: { name: 'Odin\'s Precision', desc: 'Attacks never deal less than 150 damage, and have a 25% chance to deal 2x damage.' },
    10: { name: 'Spear of Destiny', desc: 'Ignores 50% of the target\'s DEF when attacking.' },
    15: { name: 'Wind Rider', desc: '20% chance to strike a second time in a round.' },
    20: { name: 'Sure Hit', desc: 'Attacks never deal less than 300 damage, and have a 35% chance to deal 2.5x damage.' },
    25: { name: 'Asgard\'s Pierce', desc: 'Ignores 75% of the target\'s DEF and second strike chance increases to 30%.' },
    30: { name: 'Celestial Spear', desc: 'Attacks never deal less than 600 damage, second strike chance is 35%, and has 45% chance to deal 3.0x damage.' }
  },
  'Divine Bulwark': {
    5: { name: 'Divine Protection', desc: 'Reduces all incoming damage by 30%.' },
    10: { name: 'Heaven\'s Will', desc: 'Increases total HP by 20% and DEF by 20%.' },
    15: { name: 'Retribution', desc: 'Reflects 35% of damage taken back to the monster.' },
    20: { name: 'Immortal Fortress', desc: 'Reduces all incoming damage by 45% and restores +50 HP per round.' },
    25: { name: 'Bastion of Light', desc: 'Increases total HP by 30% and DEF by 30%, and reflects 45% of damage taken.' },
    30: { name: 'Divine Aegis', desc: 'Reduces all incoming damage by 55%, restores +100 HP per round, and increases total DEF by 40%.' }
  },
  'Secret Elixir': {
    5: { name: 'Elixir of Life', desc: 'Restores +60 HP to the player at the end of each round.' },
    10: { name: 'Alchemical Might', desc: 'Increases all combat stats (HP, ATK, DEF) by 25%.' },
    15: { name: 'Regeneration', desc: 'Restores +100 HP per round and +5% of max HP.' },
    20: { name: 'Philosopher\'s Stone', desc: 'Restores +150 HP per round, boosts stats by 40%, and prevents defeat once per battle.' },
    25: { name: 'Transmutation', desc: 'Restores +200 HP per round + 8% of max HP, and boosts stats by 50%.' },
    30: { name: 'Immortality Elixir', desc: 'Restores +300 HP per round + 12% of max HP, boosts stats by 65%, and revives with 250 HP once per battle.' }
  },
  'Lethalized Dark Scythe': {
    5: { name: 'Lethal Harvest', desc: 'Deals +25% damage. If the monster is below 30% HP, attacks deal 3x damage.' },
    10: { name: 'Soul Feast', desc: 'Heals the player for 10% of the damage dealt to the monster.' },
    15: { name: 'Reaper\'s Dance', desc: '15% chance to strike a second time in a round.' },
    20: { name: 'Death\'s Embrace', desc: 'Deals +40% damage. If the monster is below 50% HP, attacks deal 4x damage.' },
    25: { name: 'Soul Devourer', desc: 'Heals the player for 18% of the damage dealt and second strike chance increases to 25%.' },
    30: { name: 'Grim Reaper', desc: 'Deals +60% damage. If the monster is below 60% HP, attacks deal 5x damage, and second strike chance is 30%.' }
  },
  'Poison Butterfly Knife': {
    5: { name: 'Neurotoxin', desc: 'Deals 40 poison damage every round. 10% chance to attack twice in a round.' },
    10: { name: 'Corrosive Venom', desc: 'Reduces the monster\'s DEF stats by 30% during battle.' },
    15: { name: 'Fluttering Blades', desc: 'Poison damage increases to 80; double attack chance increases to 20%.' },
    20: { name: 'Assassinate', desc: 'Deals 150 poison damage per round, double strike chance is 25%, and attacks deal 2x damage if poisoned.' },
    25: { name: 'Toxic Cascade', desc: 'Poison damage increases to 300 per round and reduces the monster\'s DEF stats by 45%.' },
    30: { name: 'Death Venom', desc: 'Poison deals 500 damage per round, double strike chance is 35%, and attacks deal 2.5x damage to poisoned targets.' }
  },
  'Golden Kukri': {
    5: { name: 'Golden Guard', desc: '20% chance to deal double damage. Increases total DEF stats by 20% of your ATK.' },
    10: { name: 'Midas Touch', desc: 'Earns +20% extra gold upon victory.' },
    15: { name: 'Gilded Aegis', desc: 'DEF increases by 30% of ATK, and reduces all incoming damage by 15%.' },
    20: { name: 'Aurum Strike', desc: '30% chance to deal 2.5x damage, DEF increases by 40% of ATK, and reflects 20% of damage taken.' },
    25: { name: 'Treasury Shield', desc: 'DEF increases by 50% of ATK, reduces incoming damage by 25%, and yields +40% extra gold.' },
    30: { name: 'Aurum Sovereign', desc: '40% chance to deal 3.0x damage, DEF increases by 60% of ATK, reduces incoming damage by 35%, and reflects 30% of damage taken.' }
  },
  'Worn Warhorn': {
    5: { name: 'Rallying Call', desc: 'Adds +2 ATK to total stats.' },
    10: { name: 'Sturdy Horn', desc: 'Adds +4 DEF to total stats.' },
    15: { name: 'Encourage', desc: 'Adds +5 ATK to total stats.' },
    20: { name: 'Battle Cry', desc: 'Increases Crit Chance by +5%.' },
    25: { name: 'War Horn Chorus', desc: 'Adds +10 ATK to total stats.' },
    30: { name: 'Victory Call', desc: 'Increases Crit Damage by +15%.' }
  },
  'Commander\'s Banner': {
    5: { name: 'Marching Banner', desc: 'Adds +4 ATK and +2 DEF to total stats.' },
    10: { name: 'Iron Resolve', desc: 'Increases total DEF by 5%.' },
    15: { name: 'Commander\'s Signal', desc: 'Adds +8 ATK to total stats.' },
    20: { name: 'Inspire Courage', desc: 'Increases Crit Chance by +5% and Crit Damage by +10%.' },
    25: { name: 'Banner of War', desc: 'Adds +15 ATK and +5 DEF to total stats.' },
    30: { name: 'Flawless Tactics', desc: 'Increases total ATK by 10% and DEF by 10%.' }
  },
  'Focusing Lens': {
    5: { name: 'Focus Aura', desc: 'Increases Crit Chance by +3% during battle.' },
    10: { name: 'Magnify', desc: 'Increases Crit Chance by +6% during battle.' },
    15: { name: 'Precision Beam', desc: 'Increases Crit Damage by +15% during battle.' },
    20: { name: 'Laser Point', desc: 'Increases Crit Chance by +10% and Crit Damage by +20% during battle.' },
    25: { name: 'Optical Array', desc: 'Increases Crit Chance by +15% during battle.' },
    30: { name: 'Hyper-Focus', desc: 'Increases Crit Chance by +20% and Crit Damage by +35% during battle.' }
  },
  'Inspiring Scepter': {
    5: { name: 'Aura of Inspiration', desc: 'Increases total ATK by 5%.' },
    10: { name: 'Empowering Chant', desc: 'Increases Crit Damage by +10% during battle.' },
    15: { name: 'Majestic Scepter', desc: 'Increases total ATK by 10% and Crit Damage by +15% during battle.' },
    20: { name: 'Scepter of Command', desc: 'Increases total ATK by 15% and Crit Chance by +5% during battle.' },
    25: { name: 'Grand Inspiration', desc: 'Increases total ATK by 20% and Crit Damage by +25% during battle.' },
    30: { name: 'Imperial Decree', desc: 'Increases total ATK by 25%, Crit Chance by +10%, and Crit Damage by +40% during battle.' }
  },
  'Valor Ring': {
    5: { name: 'Ring of Courage', desc: 'Increases total ATK by 8%.' },
    10: { name: 'Valor Boost', desc: 'Increases Crit Chance by +5% and Crit Damage by +15% during battle.' },
    15: { name: 'Indomitable Ring', desc: 'Increases total ATK by 12% and DEF by 10%.' },
    20: { name: 'Heroic Stance', desc: 'Increases total ATK by 15%, Crit Chance by +8%, and Crit Damage by +20% during battle.' },
    25: { name: 'Sovereign Valor', desc: 'Increases total ATK by 20% and DEF by 15%.' },
    30: { name: 'Legendary Ring', desc: 'Increases total ATK by 25%, Crit Chance by +12%, and Crit Damage by +40% during battle.' }
  },
  'Hexing Totem': {
    5: { name: 'Hex Vulnerability', desc: 'Applies +15% Vulnerability to the monster, causing it to take extra damage.' },
    10: { name: 'Hexing Fire', desc: 'Inflicts 20 fixed true damage (ignores DEF) to the monster every round.' },
    15: { name: 'Cursed Link', desc: 'Vulnerability increases to 20%.' },
    20: { name: 'Weakening Totem', desc: 'Reduces the monster\'s ATK stats by 10%.' },
    25: { name: 'Hexing Blaze', desc: 'Curse deals 50 true damage per round and Vulnerability increases to 25%.' },
    30: { name: 'Supreme Hex', desc: 'Vulnerability to 30%, reduces monster ATK by 15%, and Curse deals 100 true damage per round.' }
  },
  'Archangel\'s Harp': {
    5: { name: 'Serenade of War', desc: 'Increases Crit Chance by +10% during battle.' },
    10: { name: 'Hymn of Might', desc: 'Increases Crit Damage by +25% during battle.' },
    15: { name: 'Angelic Symphony', desc: 'Increases Crit Chance by +15% and Crit Damage by +35% during battle.' },
    20: { name: 'Heavenly Harmony', desc: 'Increases total ATK by 15%, Crit Chance by +15%, and Crit Damage by +45% during battle.' },
    25: { name: 'Seraph\'s Song', desc: 'Increases total ATK by 20%, Crit Chance by +20%, and Crit Damage by +60% during battle.' },
    30: { name: 'Archangel\'s Chorus', desc: 'Increases total ATK by 30%, Crit Chance by +25%, and Crit Damage by +80% during battle.' }
  },
  'Shadow Tome': {
    5: { name: 'Shadow Curse', desc: 'Inflicts 30 fixed true damage (ignores DEF) to the monster every round.' },
    10: { name: 'Corrosive Pages', desc: 'Shadow Curse deals 60 true damage per round.' },
    15: { name: 'Tome of Decay', desc: 'Applies +15% Vulnerability to the monster.' },
    20: { name: 'Dark Revelation', desc: 'Shadow Curse deals 100 true damage per round and Vulnerability increases to 20%.' },
    25: { name: 'Abyssal Shadows', desc: 'Shadow Curse deals 150 true damage per round.' },
    30: { name: 'Doomsday Chronicle', desc: 'Shadow Curse deals 250 true damage per round, Vulnerability to 30%, and ignores 20% of target\'s DEF.' }
  },
  'Asgardian War-Horn': {
    5: { name: 'Horn of Valhalla', desc: 'Increases total ATK by 15% and Crit Chance by +8%.' },
    10: { name: 'Asgard\'s Might', desc: 'Increases total ATK by 20% and Crit Damage by +30%.' },
    15: { name: 'Einherjar\'s Pride', desc: 'Increases total ATK by 25%, Crit Chance by +12%, and Crit Damage by +40%.' },
    20: { name: 'Ragnarok Call', desc: 'Increases total ATK by 30%, Crit Chance by +15%, and Crit Damage by +60%.' },
    25: { name: 'Odin\'s Blessing', desc: 'Increases total ATK by 40%, Crit Chance by +20%, and Crit Damage by +75%.' },
    30: { name: 'Gilded Horn of War', desc: 'Increases total ATK by 50%, Crit Chance by +25%, and Crit Damage by +100%.' }
  },
  'Aegis Breaker': {
    5: { name: 'Shield Crusher', desc: 'Applies +30% Vulnerability to the monster, causing it to take extra damage.' },
    10: { name: 'Searing Breaker', desc: 'Inflicts 100 fixed true damage (ignores DEF) to the monster every round.' },
    15: { name: 'Aegis Shatter', desc: 'Ignores 40% of the target\'s DEF when attacking.' },
    20: { name: 'Vulnerability Field', desc: 'Vulnerability increases to 40% and Curse deals 200 true damage per round.' },
    25: { name: 'Titanic Impact', desc: 'Curse deals 350 true damage per round.' },
    30: { name: 'Absolute Annihilation', desc: 'Vulnerability to 50%, Curse deals 500 true damage per round, ignores 60% of target\'s DEF, and reduces monster ATK by 20%.' }
  },
  'Jester\'s Staff': {
    5: { name: 'Calamity Aura', desc: 'Increases total ATK by 20% and Crit Chance by +10%.' },
    10: { name: 'Core Eruption', desc: 'Increases Crit Damage by +30% during battle.' },
    15: { name: 'Nexus Overload', desc: 'Increases total ATK by 25%, Crit Chance by +12%, and Crit Damage by +45%.' },
    20: { name: 'Doomsday Core', desc: 'Increases total ATK by 35%, Crit Chance by +15%, and Crit Damage by +60%.' },
    25: { name: 'Singularity', desc: 'Increases total ATK by 45%, Crit Chance by +20%, and Crit Damage by +80%.' },
    30: { name: 'Chaos Sovereign', desc: 'Increases total ATK by 60%, Crit Chance by +25%, and Crit Damage by +120%.' }
  },
  'Amrita Bell': {
    5: { name: 'Amrita Serenade', desc: 'Implants +100 Poison DOT, +10% Vulnerability, and increases total ATK by 30% and Crit Chance by +15%.' },
    10: { name: 'Nectar Brew', desc: 'Bypasses 25% of the monster\'s DEF (PEN) and increases its Vulnerability by +25%.' },
    15: { name: 'Samsara Echo', desc: 'Deals 200 bonus True Damage each round and increases the monster\'s Vulnerability by +5% (stacking up to +25%).' },
    20: { name: 'Nirvana Blessing', desc: 'At the start of battle, immediately inflicts 300 Poison DOT and +30% Vulnerability on the monster.' },
    25: { name: 'Celestial Curse', desc: 'Bypasses 40% of the target\'s DEF (PEN) and increases player Crit Damage by +50%.' },
    30: { name: 'Celestial Resonance', desc: 'Increases total ATK by 50%, Crit Chance by +20%, ignores +30% DEF, and attacks deal +40% extra damage as bonus True Damage.' }
  }
};

// Generate the passive description text based on the weapon's level (Locked < 5, Scales up at 5, 10, 15, 20, 25, 30)
function getWeaponPassiveDescription(weaponName, level = 1) {
  const wp = findWeaponByName(weaponName);
  if (!wp) return 'Unknown passive.';

  const passMap = WEAPON_PASSIVES[wp.name];
  if (!passMap) return 'No milestone passives defined.';

  const milestones = [5, 10, 15, 20, 25, 30];
  const lines = [];

  for (const lv of milestones) {
    const p = passMap[lv];
    if (level >= lv) {
      lines.push(`✨ **${p.name}** [Lv. ${lv} Unlocked]: ${p.desc}`);
    } else {
      lines.push(`🔒 **${p.name}** [Locked until Weapon Lv. ${lv}]: ${p.desc}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  WEAPONS,
  WEAPON_PASSIVES,
  drawWeaponByRarity,
  getRandomWeapon,
  findWeaponByName,
  getWeaponPassiveDescription
};
