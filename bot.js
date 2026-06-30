// bot.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const firebase = require('./firebase');
const gameData = require('./gameData');

// Discord Bot Client Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

const PREFIX = "'";
const userPrefixCache = new Map();
const serverPrefixCache = new Map();

const COOLDOWN_TIME_MS = 10000; // 10 seconds cooldown for manual commands
const cooldowns = new Map();

class CommandContext {
  constructor(source, isInteraction = false) {
    this.source = source;
    this.isInteraction = isInteraction;
    this.isContext = true;
    
    if (isInteraction) {
      this.author = source.user;
      this.guild = source.guild;
      this.member = source.member;
      this.channel = source.channel;
    } else {
      this.author = source.author;
      this.guild = source.guild;
      this.member = source.member;
      this.channel = source.channel;
    }
  }

  async reply(options) {
    if (this.isInteraction) {
      const payload = typeof options === 'string' ? { content: options } : { ...options };
      if (this.source.deferred || this.source.replied) {
        await this.source.editReply(payload);
      } else {
        await this.source.reply(payload);
      }
      return await this.source.fetchReply();
    } else {
      return await this.source.reply(options);
    }
  }
}

const COMMAND_PAYLOADS = [
  {
    name: 'hunt',
    description: 'Simulate a hunt for a monster (10s cooldown)',
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'loot',
    description: 'Loot a chest for weapons (10s cooldown)',
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'profile',
    description: 'Check level, progression, combat stats, currency, and active team slots',
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'leaderboard',
    description: 'View the top players sorted by level or gold',
    options: [{
      name: 'category',
      description: 'The leaderboard category to view (default: level)',
      type: 3, // STRING
      required: false,
      choices: [
        { name: 'Level / Progression', value: 'level' },
        { name: 'Gold / Wealth', value: 'gold' }
      ]
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'dex',
    description: 'View your library of tamed monsters and collected weapons',
    options: [{
      name: 'category',
      description: 'The sub-dex category to view',
      type: 3, // STRING
      required: false,
      choices: [
        { name: 'Weapons', value: 'w' },
        { name: 'Monsters', value: 'm' },
        { name: 'Spawn Threat / Chances', value: 'threat' },
        { name: 'Active Enchantments', value: 'enchant' },
        { name: 'Elemental Magic & Passives', value: 'elemental' }
      ]
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'slots',
    description: 'Play slots (Max bet: 5.000, 60% win chance)',
    options: [{
      name: 'bet',
      description: 'The amount of Gold to bet',
      type: 3, // STRING
      required: true
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'sloth',
    description: 'Play high-stakes slots (Max bet: 50.000.000, 30% win chance)',
    options: [{
      name: 'bet',
      description: 'The amount of Gold to bet or "all"',
      type: 3, // STRING
      required: true
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'cf',
    description: 'Play rigged coinflip (Max bet: 5.000, 60% win chance)',
    options: [
      {
        name: 'bet',
        description: 'The amount of Gold to bet',
        type: 3, // STRING
        required: true
      },
      {
        name: 'side',
        description: 'Choose heads or tails',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        ]
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'cfh',
    description: 'Play high-stakes coinflip (Max bet: 2.500.000, 48% win chance)',
    options: [
      {
        name: 'bet',
        description: 'The amount of Gold to bet',
        type: 3, // STRING
        required: true
      },
      {
        name: 'side',
        description: 'Choose heads or tails',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        ]
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'monster',
    description: 'View list of owned monsters or detailed info on a specific monster',
    options: [{
      name: 'name',
      description: 'The name of the monster (optional)',
      type: 3, // STRING
      required: false
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'weapon',
    description: 'View list of owned weapons or detailed info on a specific weapon',
    options: [{
      name: 'name',
      description: 'The name of the weapon (optional)',
      type: 3, // STRING
      required: false
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'team',
    description: 'Manage and view your team slots',
    options: [
      {
        name: 'view',
        description: 'View configurations for all teams',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'set',
        description: 'Switch active team',
        type: 1, // SUB_COMMAND
        options: [{
          name: 'number',
          description: 'Team number (1-3)',
          type: 4, // INTEGER
          required: true
        }]
      },
      {
        name: 'clear',
        description: 'Clear a team\'s equipment',
        type: 1, // SUB_COMMAND
        options: [{
          name: 'number',
          description: 'Team number (1-3)',
          type: 4, // INTEGER
          required: true
        }]
      },
      {
        name: 'rename',
        description: 'Rename a team',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'New team name',
            type: 3,
            required: true
          },
          {
            name: 'number',
            description: 'Team number (1-3, optional: defaults to active team)',
            type: 4,
            required: false
          }
        ]
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'use',
    description: 'Equip a monster and/or weapon to a team slot',
    options: [
      {
        name: 'slot',
        description: 'Slot to equip into',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'On-Field', value: 'on' },
          { name: 'Off-Field 1', value: 'off1' },
          { name: 'Off-Field 2', value: 'off2' }
        ]
      },
      {
        name: 'item',
        description: 'The monster name, weapon name, or both (e.g. Slime Wooden Sword)',
        type: 3, // STRING
        required: true
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'threat',
    description: 'Manage lobby threat offset',
    options: [
      {
        name: 'up',
        description: 'Upgrade threat offset (+1, costs 5 Elemental Stones)',
        type: 1
      },
      {
        name: 'down',
        description: 'Downgrade threat offset (-1, free)',
        type: 1
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'reroll',
    description: 'Consume 1 Elemental Stone to reroll element and perfection of a weapon',
    options: [{
      name: 'weapon',
      description: 'The name of the weapon',
      type: 3, // STRING
      required: true
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'settings',
    description: 'Configure layout preferences',
    options: [
      {
        name: 'loot',
        description: 'Duplicate loot layout settings',
        type: 3,
        required: false,
        choices: [
          { name: 'Simple', value: 'simple' },
          { name: 'Informative', value: 'informative' }
        ]
      },
      {
        name: 'hunt',
        description: 'Hunt log layout settings',
        type: 3,
        required: false,
        choices: [
          { name: 'Simple', value: 'simple' },
          { name: 'Informative', value: 'informative' }
        ]
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'userprefix',
    description: 'Set your personal command prefix override',
    options: [{
      name: 'prefix',
      description: 'The custom prefix (or reset to clear)',
      type: 3,
      required: true
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'serverprefix',
    description: 'Set server-wide command prefix (Manage Server required)',
    options: [{
      name: 'prefix',
      description: 'The custom prefix (or reset to clear)',
      type: 3,
      required: true
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'help',
    description: 'View the list of RPG commands',
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'ach',
    description: 'View your achievements and select an active title',
    options: [{
      name: 'equip',
      description: 'The title to equip',
      type: 3, // STRING
      required: false
    }],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'by',
    description: 'Beyond system commands: check info, level up, or downgrade threat level',
    options: [
      {
        name: 'info',
        description: 'Check Beyond Threat Level status and Kirin stats',
        type: 1
      },
      {
        name: 'up',
        description: 'Upgrade Beyond Threat Level (+1, costs 300 Elemental Stones)',
        type: 1
      },
      {
        name: 'down',
        description: 'Downgrade Beyond Threat Level (-1, free)',
        type: 1
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'voice',
    description: 'Voice activity system upgrades for passive hunts and loots',
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'give',
    description: 'Give Gold to another player',
    options: [
      {
        name: 'user',
        description: 'The player to give Gold to',
        type: 6, // USER
        required: true
      },
      {
        name: 'amount',
        description: 'The amount of Gold to give',
        type: 3, // STRING
        required: true
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'bet',
    description: 'Challenge another player to a dice bet',
    options: [
      {
        name: 'player',
        description: 'The player to challenge',
        type: 6, // USER
        required: true
      },
      {
        name: 'amount',
        description: 'The amount of Gold to bet',
        type: 3, // STRING
        required: true
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'reset',
    description: '[Developer Only] Reset a player\'s Gold balance',
    options: [
      {
        name: 'amount',
        description: 'The amount of Gold to reset to',
        type: 3, // STRING
        required: true
      },
      {
        name: 'user',
        description: 'The player to reset (defaults to yourself)',
        type: 6, // USER
        required: false
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  },
  {
    name: 'remove',
    description: '[Developer Only] Remove Gold from a player\'s balance',
    options: [
      {
        name: 'amount',
        description: 'The amount of Gold to remove',
        type: 3, // STRING
        required: true
      },
      {
        name: 'user',
        description: 'The player to remove Gold from (defaults to yourself)',
        type: 6, // USER
        required: false
      }
    ],
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  }
];

function normalizeElement(el) {
  if (!el) return null;
  const mapping = {
    'Fire': 'Blast',
    'Water': 'Liquid',
    'Lightning': 'Volt',
    'Ice': 'Blizzard',
    'Dark': 'Shadow',
    'Light': 'Radiant'
  };
  return mapping[el] || el;
}

function getGoblinGoldMultiplier(profile, activeTeam) {
  if (!activeTeam) return 1.0;
  let enchantedLevel = 0;
  if (activeTeam.onfield && activeTeam.onfield.monster === 'Goblin') {
    const mData = profile.monsterLevels && profile.monsterLevels['Goblin'] ? profile.monsterLevels['Goblin'] : {};
    enchantedLevel += mData.enchanted || mData.forge || 0;
  }
  if (activeTeam.offfield1 && activeTeam.offfield1.monster === 'Goblin') {
    const mData = profile.monsterLevels && profile.monsterLevels['Goblin'] ? profile.monsterLevels['Goblin'] : {};
    enchantedLevel += mData.enchanted || mData.forge || 0;
  }
  if (activeTeam.offfield2 && activeTeam.offfield2.monster === 'Goblin') {
    const mData = profile.monsterLevels && profile.monsterLevels['Goblin'] ? profile.monsterLevels['Goblin'] : {};
    enchantedLevel += mData.enchanted || mData.forge || 0;
  }
  return 1.0 + enchantedLevel * 0.10;
}

function getMonsterTierCode(mName) {
  if (!mName) return '';
  const m = gameData.findMonsterByName(mName);
  if (!m || !m.threat) return 'T1';
  const threatNum = m.threat.replace('threat', '');
  return `T${threatNum}`;
}

function getWeaponRarityCode(wName) {
  if (!wName) return '';
  const w = gameData.findWeaponByName(wName);
  if (!w || !w.rarity) return 'B';
  const mapping = {
    basic: 'B',
    usual: 'US',
    unusual: 'UN',
    odd: 'O',
    exotic: 'E',
    mythic: 'M',
    supreme: 'SP',
    secret: 'SC'
  };
  return mapping[w.rarity.toLowerCase()] || 'B';
}

function formatMonsterSlot(profile, mName) {
  if (!mName) return '*None*';
  const mData = profile.monsterLevels && profile.monsterLevels[mName] ? profile.monsterLevels[mName] : {};
  const lvl = mData.level || 1;
  const enchanted = mData.enchanted || mData.forge || 0;
  return `[E${enchanted}] Lv.${lvl} ${mName}`;
}

function formatWeaponSlot(profile, wName) {
  if (!wName) return '*None*';
  const wData = profile.weaponLevels && profile.weaponLevels[wName] ? profile.weaponLevels[wName] : {};
  const lvl = wData.level || 1;
  const forge = wData.forge || 0;
  const element = normalizeElement(wData.element);
  const perfection = wData.perfection || 0;
  let suffix = '';
  if (element) {
    suffix = ` (${getElementIcon(element)} ${element} ${perfection}%)`;
  }
  return `[F${forge}] Lv.${lvl} ${wName}${suffix}`;
}

function getBaseLootXp(rarity) {
  const xpMap = {
    basic: 50,
    usual: 100,
    unusual: 200,
    odd: 400,
    exotic: 800,
    mythic: 1500,
    supreme: 3000,
    secret: 6000
  };
  return xpMap[rarity.toLowerCase()] || 50;
}

function getTierBaseRewardBonuses(tier) {
  const bonuses = {
    basic: { xp: 0, gold: 0 },
    blessed: { xp: 10, gold: 20 },
    enchanted: { xp: 30, gold: 50 },
    overpowered: { xp: 80, gold: 150 },
    chronicle: { xp: 200, gold: 400 },
    prodigy: { xp: 450, gold: 1000 },
    beyond: { xp: 1000, gold: 2000 }
  };
  return bonuses[tier.toLowerCase()] || { xp: 0, gold: 0 };
}

function getMonsterTierSpawnRate(tier, ps, lobbyThreatOffset = 0) {
  if (ps === undefined) return 'N/A';
  const chances = gameData.getTierChances(ps, lobbyThreatOffset);
  const val = chances[tier.toLowerCase()];
  if (val === undefined) return 'N/A';
  return `${(val * 100).toFixed(1)}%`;
}

function getElementIcon(element) {
  const icons = {
    Blast: '🔥',
    Liquid: '💧',
    Volt: '⚡',
    Blizzard: '❄️',
    Shadow: '🔮',
    Radiant: '☀️',
    Void: '🌌'
  };
  return icons[element] || '❓';
}

function getElementBuffDescription(element, perfection, forge) {
  const scale = (perfection / 100) * (forge >= 6 ? 2.0 : 1.0);
  switch (element) {
    case 'Blast':
      return `🔥 **Blast**: +${(15 * scale).toFixed(1)}% ATK & +${(30 * scale).toFixed(1)}% CDM. additional: 10%-15% chance to burn target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(10 * scale).toFixed(0)}% Vulnerability next round.`;
    case 'Liquid':
      return `💧 **Liquid**: +${(40 * scale).toFixed(1)}% ATK. additional: 10%-15% chance to splash target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(15 * scale).toFixed(0)}% ATK next round.`;
    case 'Volt':
      return `⚡ **Volt**: +${(20 * scale).toFixed(1)}% Crit Chance & +${(20 * scale).toFixed(1)}% Crit Damage. additional: 10%-15% chance to shock target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(15 * scale).toFixed(0)}% Crit Chance next round.`;
    case 'Blizzard':
      return `❄️ **Blizzard**: +${(25 * scale).toFixed(1)}% DEF ignore (PEN) & +${(10 * scale).toFixed(1)}% ATK. additional: 10%-15% chance to freeze target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(20 * scale).toFixed(0)}% PEN next round.`;
    case 'Shadow':
      return `🔮 **Shadow**: +${(40 * scale).toFixed(1)}% Crit Damage & +${(10 * scale).toFixed(1)}% PEN. additional: 10%-15% chance to curse target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(30 * scale).toFixed(0)} flat True Damage next round.`;
    case 'Radiant':
      return `☀️ **Radiant**: +${(20 * scale).toFixed(1)}% ATK & +${(10 * scale).toFixed(1)}% Crit Chance. additional: 10%-15% chance to smite target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(30 * scale).toFixed(0)}% CDM next round.`;
    case 'Void':
      return `🌌 **Void**: +${(10 * scale).toFixed(1)}% ATK, CR, CDM, PEN. additional: 10%-15% chance to rift target for ${(25 * scale).toFixed(0)}-${(50 * scale).toFixed(0)} damage and +${(10 * scale).toFixed(0)}% ATK & +${(10 * scale).toFixed(0)}% PEN next round.`;
    default:
      return '';
  }
}

function getWeaponSpecialAbilities(wName) {
  const abilities = {
    "Dragon Bow": {
      2: "Precision Aim: +10% Crit Chance.",
      4: "Dragon's Ember: Increases Dragon Fire burn damage by 150% and raises critical chance by +15%.",
      6: "Dragon Slayer: Against Elite Monsters, damage increases by +80% and ignores +30% DEF."
    },
    "Archmage Staff": {
      2: "Vitality Accord: +15% player Max HP and +40 flat Heal per round.",
      4: "Purifying Pulse: Cleanses the monster's ATK reduction debuffs (e.g. Dread Presence).",
      6: "Archmage Ward: Against Elite Monsters, reduces all damage taken by 30%."
    },
    "Archangel's Harp": {
      2: "Crescendo: +15% Crit Chance and +40% Crit Damage.",
      4: "Celestial Requiem: Player heals for 10% of missing HP per round (max 150 HP) and gains +15% DEF.",
      6: "Seraphic Hymn: Against Elite Monsters, player DEF +50%, Crit Chance +30%, and Crit Damage +100%."
    },
    "Shadow Tome": {
      2: "Cursed Whispers: Applies +100 Curse True Damage per round.",
      4: "Abyssal Decimation: Increases shadow element effectiveness by +50% and dark curse damage ticks by +80.",
      6: "Tome of Despair: Against Elite Monsters, player ATK +50%, ignores +50% DEF, and Curse deals +300 True Damage/round."
    },
    "Mjolnir": {
      2: "Electrostatic: +50% Crit Damage.",
      4: "Thundering Tempest: Thunder Strike stun chance is doubled, and stunned targets take +35% Crit Damage.",
      6: "God of Thunder: Against Elite Monsters, player Crit Chance +30% and +100% damage."
    },
    "Gungnir": {
      2: "Precision Edge: Attacks have a 25% chance to deal 3.0x damage instead of 2.0x.",
      4: "Odin's Piercing: Attacks bypass 40% of enemy DEF and ignore elemental resistance entirely.",
      6: "Allfather's Spear: Against Elite Monsters, player damage increases by +120% and double attack chance is 50."
    },
    "Divine Bulwark": {
      2: "Iron Bastion: +30% DEF.",
      4: "Shield of Retribution: Reflects 40% of all incoming damage back to the monster and grants +25% player Max HP.",
      6: "Aegis Aura: Against Elite Monsters, player Max HP +200%, DEF +100%, and reflects 50% of damage taken."
    },
    "Secret Elixir": {
      2: "Apothecary Boost: +100 Heal per round and +20% HP, ATK, DEF.",
      4: "Catalyst Blend: Increases potion healing by +80 flat HP, and increases all stats (HP, ATK, DEF) by +15%.",
      6: "Miraculous Rebirth: Against Elite Monsters, player ATK +100% and will revive with 50% Max HP."
    },
    "Asgardian War-Horn": {
      2: "Horn of Valhalla: +30% ATK and +10% Crit Chance.",
      4: "Valhalla's Call: All team monsters gain +20% ATK and +15% DEF.",
      6: "War Cry: Against Elite Monsters, player ATK +120%, DEF +40%, and Crit Chance +20%."
    },
    "Aegis Breaker": {
      2: "Shield Shatter: +30% DEF Ignore (PEN) and +150 True Damage per round.",
      4: "Shattering Blows: Attacks ignore 40% DEF and have a 10% chance to deal 3.5x True Damage.",
      6: "Elite Annihilation: Against Elite Monsters, player Max HP increases by +200% and True Damage increases by +120%."
    },
    "Lethalized Dark Scythe": {
      2: "Soul Harvester: Increases Soul Feast healing ratio by +10% (additional +10% lifesteal).",
      4: "Reaper's Harvest: Double strike chance is increased by +20%, and Soul Feast healing ratio is increased by +5%.",
      6: "Soul Execute: Against Elite Monsters below 50% HP, attacks deal 5x damage."
    },
    "Poison Butterfly Knife": {
      2: "Nerve Toxin: Increases Neurotoxin DOT by +200.",
      4: "Toxic Infusion: Increases Neurotoxin DOT by +120, and player gains +15% Crit Chance.",
      6: "Assassination Mastery: Against Elite Monsters, player Crit Chance +40%, Crit Damage +120%, and ignores +50% DEF."
    },
    "Golden Kukri": {
      2: "Golden Reflection: +20% DEF.",
      4: "Midas Strike: Increases gold gained from hunts by +30% and reflects 25% of damage taken.",
      6: "Kukri Guard: Against Elite Monsters, player ATK +100%, Crit Chance +50%, and reflects 50% of damage taken."
    },
    "Jester's Staff": {
      2: "Jester's Gambit: +30% ATK and +15% Crit Chance.",
      4: "Chaos Bolt: Attacks have a 15% chance to deal 4x damage, and player heals 150 HP on critical hits.",
      6: "Elite Slayer: Against Elite Monsters, player Max HP increases to 300% (+200% HP) and True Damage increases by +120%."
    },
    "Amrita Bell": {
      2: "Amrita Resonance: Implants +200 Poison DOT, +20% Vulnerability, +30% ATK, and +15% Crit Chance. Deals +20% damage to debuffed/poisoned monsters.",
      4: "Nectar Brew: Bypasses +30% enemy DEF (PEN), increases Vulnerability by +30%, and implants +200 True Damage per round.",
      6: "Cosmic Resonance: Against Elite Monsters, Player ATK +100%, Crit Chance +20%, Crit Damage +100%, DOT/True Damage +100%, ignores 50% monster DEF, and disables monster passive regeneration."
    }
  };
  return abilities[wName];
}

function getForgeProgressionText(weapon, forgeLvl) {
  const isMythicPlus = ['mythic', 'supreme', 'secret'].includes(weapon.rarity.toLowerCase());
  const stars = '⭐'.repeat(forgeLvl) + '☆'.repeat(6 - forgeLvl);
  
  // Calculate cumulative stats buffs
  const buffs = [];
  
  let baseStatsBonus = forgeLvl >= 6 ? 100 : forgeLvl * 10;
  let elementResPen = 0;
  let critChance = 0;
  let critDamage = 0;
  let atkMult = 0;
  let defMult = 0;
  let pen = 0;

  if (forgeLvl >= 1) {
    elementResPen += 15;
  }
  if (forgeLvl >= 2 && isMythicPlus) {
    critChance += 5;
    critDamage += 15;
  }
  if (forgeLvl >= 3) {
    atkMult += 10;
  }
  if (forgeLvl >= 4 && isMythicPlus) {
    elementResPen += 20;
    pen += 10;
  }
  if (forgeLvl >= 5) {
    critChance += 15;
    critDamage += 25;
  }
  if (forgeLvl >= 6 && isMythicPlus) {
    atkMult += 15;
    defMult += 15;
    elementResPen += 30;
  }

  if (baseStatsBonus > 0) buffs.push(`+${baseStatsBonus}% Base Stats`);
  if (atkMult > 0) buffs.push(`+${atkMult}% ATK`);
  if (defMult > 0) buffs.push(`+${defMult}% DEF`);
  if (critChance > 0) buffs.push(`+${critChance}% CR`);
  if (critDamage > 0) buffs.push(`+${critDamage}% CDM`);
  if (pen > 0) buffs.push(`+${pen}% PEN`);
  if (elementResPen > 0) buffs.push(`+${elementResPen}% RES PEN`);
  
  const statsLine = buffs.length > 0 ? buffs.join(', ') : 'No stats buffs active.';

  let outputText = `\`[ ${stars} ]\` **(Forge ${forgeLvl}/6)**\n**Stats**: ${statsLine}\n\n`;

  if (isMythicPlus) {
    outputText += `**Unlock Special Ability**:\n`;
    const specAbilities = getWeaponSpecialAbilities(weapon.name);
    if (specAbilities) {
      for (const reqLvl of [2, 4, 6]) {
        const isUnlocked = forgeLvl >= reqLvl;
        const icon = isUnlocked ? '🔓' : '🔒';
        outputText += `• ${icon} **[F${reqLvl}]** ${specAbilities[reqLvl]}\n`;
      }
    }
  } else {
    outputText += `• *Special abilities are only available for Mythic, Supreme, and Secret weapons.*`;
  }

  return outputText;
}

// Helper to parse shorthand gold amounts (e.g. 10k, 10m, 10b, 10jt, 10rb)
function parseGoldAmount(input) {
  if (input === null || input === undefined) return NaN;
  const str = input.toString().trim().toLowerCase().replace(/,/g, '.');

  // Regex to extract numeric part and suffix
  const match = str.match(/^([\d\.]+)\s*(k|m|b|t|rb|jt)?$/);
  if (!match) {
    // If it has multiple dots or is just a large formatted number like 1.000.000 without suffix
    const cleanInt = str.replace(/\./g, '');
    return parseInt(cleanInt, 10);
  }

  const numPart = parseFloat(match[1]);
  const suffix = match[2];

  if (isNaN(numPart)) return NaN;

  if (!suffix) {
    // Check if dot was a thousands separator (e.g., 10.000 -> 10000) or decimal (e.g. 10.5)
    if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        return parseInt(str.replace(/\./g, ''), 10);
      }
    }
    return numPart;
  }

  let multiplier = 1;
  switch (suffix) {
    case 'k':
    case 'rb':
      multiplier = 1000;
      break;
    case 'm':
    case 'jt':
      multiplier = 1000000;
      break;
    case 'b':
      multiplier = 1000000000;
      break;
    case 't':
      multiplier = 1000000000000;
      break;
  }

  return Math.floor(numPart * multiplier);
}

// Helper to format XP bar
function getProgressBar(current, max, size = 10) {
  if (max <= 0) return '[]';
  const progress = Math.min(1, Math.max(0, current / max));
  const filledSize = Math.round(progress * size);
  const emptySize = size - filledSize;
  return '█'.repeat(filledSize) + '░'.repeat(emptySize);
}

// Chunk battle rounds into pages of a specific number of rounds (default 4)
function chunkBattleRounds(roundLogs, roundsPerPage = 4) {
  const roundsMap = new Map();
  let currentRoundNum = 0;
  
  for (const line of roundLogs) {
    const match = line.match(/^Round (\d+)/i);
    if (match) {
      currentRoundNum = parseInt(match[1], 10);
    }
    const targetRound = currentRoundNum || 1;
    if (!roundsMap.has(targetRound)) {
      roundsMap.set(targetRound, []);
    }
    roundsMap.get(targetRound).push(line);
  }
  
  const roundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);
  const pages = [];
  
  for (let i = 0; i < roundNumbers.length; i += roundsPerPage) {
    const chunkRounds = roundNumbers.slice(i, i + roundsPerPage);
    const pageLines = [];
    for (const rNum of chunkRounds) {
      pageLines.push(...roundsMap.get(rNum));
    }
    pages.push(pageLines.join('\n'));
  }
  
  if (pages.length === 0) {
    pages.push('*No round log data.*');
  }
  
  return pages;
}

// Add XP and handle multiple level ups
function addXP(profile, amount) {
  let initialLevel = profile.level;
  profile.xp += amount;

  while (true) {
    const required = gameData.getXPRequired(profile.level);
    if (profile.xp >= required) {
      profile.xp -= required;
      profile.level += 1;
    } else {
      break;
    }
  }

  return profile.level > initialLevel;
}

// Get active team details (Onfield, Offfield 1, Offfield 2)
function getActiveTeam(profile) {
  const index = profile.activeTeamIndex;
  return profile.teams && profile.teams[index] ? profile.teams[index] : {
    onfield: { monster: null, weapon: null },
    offfield1: { monster: null, weapon: null },
    offfield2: { monster: null, weapon: null }
  };
}

// Helper to find or create log channel
async function getOrCreateLogChannel(guild) {
  let channel = guild.channels.cache.find(c => c.name === 'rpg-logs' && c.isTextBased());
  if (!channel) {
    try {
      channel = await guild.channels.create({
        name: 'rpg-logs',
        type: 0, // GuildText
        topic: 'Automated Discord RPG voice activity logs and rewards',
        reason: 'RPG logs channel needed for voice rewards'
      });
      console.log(`[Bot] Created #rpg-logs channel in server: ${guild.name}`);
    } catch (e) {
      console.warn(`[Bot] Could not create #rpg-logs channel in ${guild.name}:`, e.message);
      channel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('SendMessages'));
    }
  }
  return channel;
}

// Smart Parser for Equip commands: matches input against owned items to identify monster vs weapon names
function parseEquipArgs(args, ownedMonsters, ownedWeapons) {
  const input = args.join(' ').replace(/_/g, ' ').trim();
  if (!input) return null;

  const cleanArgs = input.split(/ +/);
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Case 1: Entire input is an owned monster name
  const matchMonster = gameData.findMonsterByName(input);
  if (matchMonster && ownedMonsters.some(m => normalize(m) === normalize(matchMonster.name))) {
    return { monster: matchMonster.name, weapon: null };
  }

  // Case 2: Entire input is an owned weapon name
  const matchWeapon = gameData.findWeaponByName(input);
  if (matchWeapon && ownedWeapons.some(w => normalize(w) === normalize(matchWeapon.name))) {
    return { monster: null, weapon: matchWeapon.name };
  }

  // Case 3: Split and search combinations (monster name + weapon name)
  for (let i = 1; i < cleanArgs.length; i++) {
    const leftStr = cleanArgs.slice(0, i).join(' ');
    const rightStr = cleanArgs.slice(i).join(' ');

    const mon = gameData.findMonsterByName(leftStr);
    const wp = gameData.findWeaponByName(rightStr);

    if (mon && wp &&
        ownedMonsters.some(m => normalize(m) === normalize(mon.name)) &&
        ownedWeapons.some(w => normalize(w) === normalize(wp.name))) {
      return { monster: mon.name, weapon: wp.name };
    }

    // Reverse check: weapon first, monster second
    const wpL = gameData.findWeaponByName(leftStr);
    const monR = gameData.findMonsterByName(rightStr);

    if (wpL && monR &&
        ownedWeapons.some(w => normalize(w) === normalize(wpL.name)) &&
        ownedMonsters.some(m => normalize(m) === normalize(monR.name))) {
      return { monster: monR.name, weapon: wpL.name };
    }
  }

  // Case 4: Starts with monster name
  for (const mName of ownedMonsters) {
    if (input.toLowerCase().startsWith(mName.toLowerCase() + ' ')) {
      const rest = input.substring(mName.length).trim();
      const wp = gameData.findWeaponByName(rest);
      if (wp && ownedWeapons.some(w => normalize(w) === normalize(wp.name))) {
        return { monster: mName, weapon: wp.name };
      }
    }
  }

  // Case 5: Starts with weapon name
  for (const wName of ownedWeapons) {
    if (input.toLowerCase().startsWith(wName.toLowerCase() + ' ')) {
      const rest = input.substring(wName.length).trim();
      const mon = gameData.findMonsterByName(rest);
      if (mon && ownedMonsters.some(m => normalize(m) === normalize(mon.name))) {
        return { monster: mon.name, weapon: wName };
      }
    }
  }

  return null;
}

// Helper to get the full list of weapons a user owns, including role-based weapons they qualify for
function getOwnedWeaponsList(profile, member) {
  const list = [...profile.dex.weapons];
  if (member && member.roles) {
    const hasRole = (roleId) => {
      if (member.roles.cache && typeof member.roles.cache.has === 'function') {
        return member.roles.cache.has(roleId);
      }
      if (Array.isArray(member.roles)) {
        return member.roles.includes(roleId);
      }
      return false;
    };

    if (hasRole('1485629019822096515') && !list.includes('Lethalized Dark Scythe')) {
      list.push('Lethalized Dark Scythe');
    }
    if (hasRole('1496141045119979592') && !list.includes('Poison Butterfly Knife')) {
      list.push('Poison Butterfly Knife');
    }
    if (hasRole('1496144711436599457') && !list.includes('Golden Kukri')) {
      list.push('Golden Kukri');
    }
  }
  return list;
}

// Helper to check and unlock the secret Kirin support animal and sync Amrita Bell
function checkAndUnlockKirin(profile) {
  const basicMonsters = [
    'Slime', 'Goblin',
    'Wild Boar', 'Dire Wolf',
    'Orc Warrior', 'Gargoyle',
    'Golem', 'Griffin',
    'Shadow Wyvern', 'Phoenix',
    'Ancient Dragon', 'Behemoth'
  ];
  profile.dex = profile.dex || { monsters: [], weapons: [] };
  profile.dex.monsters = profile.dex.monsters || [];
  profile.dex.weapons = profile.dex.weapons || [];
  profile.monsterLevels = profile.monsterLevels || {};
  profile.weaponLevels = profile.weaponLevels || {};

  const hasAllBasic = basicMonsters.every(mName => profile.dex.monsters.includes(mName));
  let changed = false;

  if (hasAllBasic && !profile.dex.monsters.includes('Kirin')) {
    profile.dex.monsters.push('Kirin');
    profile.monsterLevels['Kirin'] = { level: 1, xp: 0, enchanted: 0 };
    changed = true;
  }

  if (profile.dex.monsters.includes('Kirin')) {
    // If Kirin is owned, ensure Amrita Bell is also owned and synced
    if (!profile.dex.weapons.includes('Amrita Bell')) {
      profile.dex.weapons.push('Amrita Bell');
      changed = true;
    }
    
    const kData = profile.monsterLevels['Kirin'] || { level: 1, xp: 0, enchanted: 0 };
    const expectedEnchant = Math.min(6, Math.floor(kData.level / 5));
    if (kData.enchanted !== expectedEnchant) {
      kData.enchanted = expectedEnchant;
      profile.monsterLevels['Kirin'] = kData;
      changed = true;
    }

    if (!profile.weaponLevels['Amrita Bell']) {
      profile.weaponLevels['Amrita Bell'] = { level: kData.level, xp: kData.xp, forge: expectedEnchant, element: 'Volt', perfection: 100 };
      changed = true;
    } else {
      const wData = profile.weaponLevels['Amrita Bell'];
      // Sync level, xp, and forge
      if (wData.level !== kData.level || wData.xp !== kData.xp || wData.forge !== expectedEnchant) {
        wData.level = kData.level;
        wData.xp = kData.xp;
        wData.forge = expectedEnchant;
        profile.weaponLevels['Amrita Bell'] = wData;
        changed = true;
      }
    }
  }
  return changed;
}

// Helper to evaluate and return the list of achievements and their unlock status
function getUnlockedAchievements(profile, member = null, allUsers = []) {
  const list = [];
  const activeTeam = getActiveTeam(profile);
  const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);

  // 1. New Tester - Player yang baru Join
  list.push({ id: 'new_tester', title: 'New Tester', desc: 'Player yang baru Join', unlocked: true });

  // 2. The Endgamer - Reached PS 90+
  list.push({ id: 'endgamer', title: 'The Endgamer', desc: 'Reached PS 90+', unlocked: ps >= 90 });

  // 3. Totally Nothing - Reached PS 120
  list.push({ id: 'totally_nothing', title: 'Totally Nothing', desc: 'Reached PS 120', unlocked: ps >= 120 });

  // 4. I\'m the Danger - Lobby Threat Level +5
  list.push({ id: 'danger', title: "I'm the Danger", desc: 'Lobby Threat Level +5', unlocked: (profile.lobbyThreatOffset || 0) >= 5 });

  // 5. No Golds? - Getting 50.000.000 Golds
  list.push({ id: 'no_golds', title: 'No Golds?', desc: 'Getting 50.000.000 Golds', unlocked: (profile.currency || 0) >= 50000000 });

  // 6. I\'m Learning - Reached Level Player: 25
  list.push({ id: 'learning', title: "I'm Learning", desc: 'Reached Level Player: 25', unlocked: (profile.level || 1) >= 25 });

  // 7. Progress-2-Win - Getting E6F6 On Field team with ANY Weapon Mythic+ and Threat 5+
  let p2wUnlocked = false;
  if (activeTeam && activeTeam.onfield && activeTeam.onfield.monster && activeTeam.onfield.weapon) {
    const mName = activeTeam.onfield.monster;
    const wName = activeTeam.onfield.weapon;
    const mData = profile.monsterLevels[mName] || {};
    const wData = profile.weaponLevels[wName] || {};
    const mEnchanted = mData.enchanted || mData.forge || 0;
    const wForge = wData.forge || 0;

    const mObj = gameData.findMonsterByName(mName);
    const wObj = gameData.findWeaponByName(wName);
    if (mObj && wObj) {
      const isMythicPlus = ['mythic', 'supreme', 'secret'].includes(wObj.rarity.toLowerCase());
      const threatNum = mObj.threat === 'threatX' ? 7 : parseInt(mObj.threat.replace('threat', ''), 10);
      const isThreat5Plus = threatNum >= 5;

      if (mEnchanted >= 6 && wForge >= 6 && isMythicPlus && isThreat5Plus) {
        p2wUnlocked = true;
      }
    }
  }
  list.push({ id: 'p2w', title: 'Progress-2-Win', desc: 'Getting E6F6 On Field team with ANY Weapon Mythic+ and Threat 5+', unlocked: p2wUnlocked });

  // 8. 1.000.000 DMG - Reached 1 Mil Total damage
  list.push({ id: 'dmg', title: '1.000.000 DMG', desc: 'Reached 1 Mil Total damage', unlocked: (profile.totalDamage || 0) >= 1000000 });

  // 9. Introduce The Top 100 - Top 100 di leaderboard
  let isTop100 = false;
  if (allUsers && allUsers.length > 0) {
    const rankIdx = allUsers.findIndex(u => u.userId === profile.userId);
    if (rankIdx !== -1 && rankIdx < 100) {
      isTop100 = true;
    }
  }
  list.push({ id: 'top100', title: 'Introduce The Top 100', desc: 'Top 100 di leaderboard', unlocked: isTop100 });

  // 10. PERFECT - Getting 100% Elemental Rarity
  let perfectUnlocked = false;
  if (profile.weaponLevels) {
    perfectUnlocked = Object.values(profile.weaponLevels).some(w => w.perfection === 100);
  }
  list.push({ id: 'perfect', title: 'PERFECT', desc: 'Getting 100% Elemental Rarity', unlocked: perfectUnlocked });

  // 11. Now we getting Somewhere - Killing Beyond T6
  list.push({ id: 'beyond_t6', title: 'Now we getting Somewhere', desc: 'Killing Beyond T6', unlocked: !!profile.killedBeyondT6 });

  // 12. Celestial Conqueror - Defeated TX Kirin
  list.push({ id: 'celestial_conqueror', title: 'Celestial Conqueror', desc: 'Defeated TX Kirin', unlocked: !!profile.killedTXKirin });

  return list;
}

// Helper to add XP to equipped monsters and weapons
function addEquipXP(profile, activeTeam, isVictory) {
  profile.monsterLevels = profile.monsterLevels || {};
  profile.weaponLevels = profile.weaponLevels || {};

  const levelMultiplier = 1 + (profile.level - 1) * 0.1;
  const xpGained = Math.floor((isVictory ? 10 : 5) * levelMultiplier);
  const lvlUps = [];

  const kDataBefore = profile.monsterLevels['Kirin'] ? { ...profile.monsterLevels['Kirin'] } : null;

  const addMonsterXP = (mName) => {
    if (!mName) return;
    if (!profile.monsterLevels[mName]) {
      profile.monsterLevels[mName] = { level: 1, xp: 0 };
    }
    const data = profile.monsterLevels[mName];
    const maxLvl = mName === 'Kirin' ? 30 : 20;
    if (data.level >= maxLvl) return;

    data.xp += xpGained;
    const initialLvl = data.level;
    while (data.level < maxLvl && data.xp >= data.level * 50) {
      data.xp -= data.level * 50;
      data.level += 1;
    }
    if (data.level > initialLvl) {
      if (mName !== 'Kirin') {
        lvlUps.push(`👾 **${mName}** (Animal) leveled up to **Lv.${data.level}**!`);
      }
    }
  };

  const addWeaponXP = (wName) => {
    if (!wName) return;
    if (!profile.weaponLevels[wName]) {
      profile.weaponLevels[wName] = { level: 1, xp: 0 };
    }
    const data = profile.weaponLevels[wName];
    if (data.level >= 30) return;

    data.xp += xpGained;
    const initialLvl = data.level;
    while (data.level < 30 && data.xp >= data.level * 50) {
      data.xp -= data.level * 50;
      data.level += 1;
    }
    if (data.level > initialLvl) {
      if (wName !== 'Amrita Bell') {
        lvlUps.push(`⚔️ **${wName}** (Weapon) leveled up to **Lv.${data.level}**!`);
      }
    }
  };

  if (activeTeam) {
    if (activeTeam.onfield && activeTeam.onfield.monster) {
      addMonsterXP(activeTeam.onfield.monster);
    }
    if (activeTeam.onfield && activeTeam.onfield.weapon) {
      addWeaponXP(activeTeam.onfield.weapon);
    }
    if (activeTeam.offfield1 && activeTeam.offfield1.monster) {
      addMonsterXP(activeTeam.offfield1.monster);
    }
    if (activeTeam.offfield1 && activeTeam.offfield1.weapon) {
      addWeaponXP(activeTeam.offfield1.weapon);
    }
    if (activeTeam.offfield2 && activeTeam.offfield2.monster) {
      addMonsterXP(activeTeam.offfield2.monster);
    }
    if (activeTeam.offfield2 && activeTeam.offfield2.weapon) {
      addWeaponXP(activeTeam.offfield2.weapon);
    }
  }

  // Sync Kirin and Amrita Bell
  checkAndUnlockKirin(profile);

  const kDataAfter = profile.monsterLevels['Kirin'];
  if (kDataBefore && kDataAfter) {
    if (kDataAfter.level > kDataBefore.level) {
      lvlUps.push(`👾 **Kirin** (Animal) leveled up to **Lv.${kDataAfter.level}**!`);
      lvlUps.push(`⚔️ **Amrita Bell** (Weapon) leveled up to **Lv.${kDataAfter.level}**!`);
    }
    const prevE = Math.min(6, Math.floor(kDataBefore.level / 5));
    const newE = Math.min(6, Math.floor(kDataAfter.level / 5));
    if (newE > prevE) {
      lvlUps.push(`✨ **Kirin** enchantment upgraded to **E${newE}**!`);
      lvlUps.push(`✨ **Amrita Bell** forged to **F${newE}**!`);
    }
  }

  return lvlUps;
}

// Client events
client.once('ready', async () => {
  console.log(`[Bot] Logged in as ${client.user.tag}!`);
  client.user.setActivity('CrunchyVerse Stage 🎪', { type: ActivityType.Playing });

  // Register global slash commands
  try {
    console.log('[Bot] Registering global slash commands...');
    await client.application.commands.set(COMMAND_PAYLOADS);
    console.log('[Bot] Global slash commands registered successfully!');
  } catch (err) {
    console.error('[Bot] Failed to register global slash commands:', err);
  }

  // Start the voice activity tick (every 10 seconds)
  setInterval(runVoiceTick, 10 * 1000);
  console.log('[Bot] Voice activity tick initialized (running every 10 seconds).');
});

function getVoiceHuntCooldown(level) {
  const times = [300, 240, 180, 120, 60, 45, 30, 20, 15, 10];
  const idx = Math.max(1, Math.min(10, level)) - 1;
  return times[idx];
}

function getVoiceLootCooldown(level) {
  const times = [1800, 1500, 1200, 900, 600, 300, 120, 60, 30, 10];
  const idx = Math.max(1, Math.min(10, level)) - 1;
  return times[idx];
}

function getVoiceUpgradeCost(currentLevel) {
  const costs = {
    1: 50,
    2: 100,
    3: 200,
    4: 500,
    5: 1000,
    6: 2000,
    7: 4500,
    8: 9250,
    9: 14750
  };
  return costs[currentLevel] || null;
}

function formatVoiceInterval(seconds) {
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${seconds}s`;
}

async function executeSingleVoiceHunt(member, profile) {
  const activeTeam = getActiveTeam(profile);
  const onfieldWeaponName = activeTeam && activeTeam.onfield ? activeTeam.onfield.weapon : null;
  const getWpForge = (wpName) => {
    if (!wpName) return 0;
    return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
  };
  const onfieldForge = getWpForge(onfieldWeaponName);
  const hasF6Onfield = onfieldForge >= 6;

  const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);
  const psScale = Math.min(120, Math.max(1, ps));
  const diffMult = 1.0 - ((psScale - 1) / 119) * 0.8;

  const playerStats = gameData.getUserStats(profile.level, activeTeam, profile.monsterLevels, profile.weaponLevels);

  const monster = gameData.getRandomMonster(ps, profile.level, profile.lobbyThreatOffset || 0);
  const battle = gameData.simulateBattle(playerStats, monster, activeTeam, profile.weaponLevels, profile.monsterLevels);
  const threatLabel = `Threat ${monster.threat.replace('threat', '')}`;
  
  let xpGained = 0;
  let goldGained = 0;
  let huntOutcome = '';
  let stoneReward = 0;

  if (battle.result === 'victory') {
    const levelMultiplier = 1 + (profile.level - 1) * 0.1;
    let tierXpMult = 1.0;
    let tierGoldMult = 1.0;
    if (monster.tier === 'enchanted') { tierXpMult = 1.5; tierGoldMult = 1.5; }
    else if (monster.tier === 'blessed') { tierXpMult = 2.5; tierGoldMult = 2.5; }
    else if (monster.tier === 'overpowered') { tierXpMult = 4.0; tierGoldMult = 4.0; }
    else if (monster.tier === 'chronicle') { tierXpMult = 8.0; tierGoldMult = 8.0; }
    else if (monster.tier === 'prodigy') { tierXpMult = 15.0; tierGoldMult = 15.0; }
    else if (monster.tier === 'beyond') { tierXpMult = 30.0; tierGoldMult = 30.0; }

    const bonuses = getTierBaseRewardBonuses(monster.tier);
    xpGained = Math.floor((Math.floor(Math.random() * (monster.xpMax - monster.xpMin + 1)) + monster.xpMin + bonuses.xp) * tierXpMult * levelMultiplier);
    goldGained = Math.floor((Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1)) + monster.goldMin + bonuses.gold) * tierGoldMult * levelMultiplier);

    xpGained = Math.floor(xpGained * diffMult);
    goldGained = Math.floor(goldGained * diffMult);

    if (hasF6Onfield) {
      xpGained = Math.floor(xpGained * 3);
      goldGained = Math.floor(goldGained * 3);
    }
    
    const goblinMult = getGoblinGoldMultiplier(profile, activeTeam);
    goldGained = Math.floor(goldGained * goblinMult);

    const tierLower = monster.tier.toLowerCase();
    if (tierLower === 'beyond') {
      if (monster.name === 'Ancient Dragon') {
        stoneReward = 10;
      } else {
        stoneReward = 3;
      }
    } else if (tierLower === 'prodigy') {
      if (Math.random() < 0.70) stoneReward = 1;
    } else if (tierLower === 'chronicle') {
      if (Math.random() < 0.40) stoneReward = 1;
    } else if (tierLower === 'overpowered') {
      if (Math.random() < 0.20) stoneReward = 1;
    }

    if (stoneReward > 0) {
      profile.elementalStones = (profile.elementalStones || 0) + stoneReward;
    }

    profile.currency += goldGained;
    const levelUp = addXP(profile, xpGained);
    huntOutcome = `⚔️ Victory vs **${monster.displayName || monster.name}** (${threatLabel}) (+${goldGained.toLocaleString('id-ID')} Gold, +${xpGained.toLocaleString('id-ID')} XP)`;

    let tamed = false;
    let isDuplicate = false;
    let tameGoldBonus = 0;
    let forgeLevelUp = false;
    let newForgeLevel = 0;
    let kirinUnlocked = false;

    if (Math.random() <= monster.tameRate && !['chronicle', 'prodigy', 'beyond'].includes(monster.tier)) {
      tamed = true;
      if (!profile.dex.monsters.includes(monster.name)) {
        profile.dex.monsters.push(monster.name);
      } else {
        isDuplicate = true;
      }

      const newlyUnlockedKirin = checkAndUnlockKirin(profile);
      if (newlyUnlockedKirin) {
        kirinUnlocked = true;
      }

      if (isDuplicate) {
        if (!profile.monsterLevels[monster.name]) {
          profile.monsterLevels[monster.name] = { level: 1, xp: 0, enchanted: 0 };
        }
        const mData = profile.monsterLevels[monster.name];
        mData.enchanted = mData.enchanted || mData.forge || 0;
        delete mData.forge;

        if (mData.enchanted < 6) {
          mData.enchanted += 1;
          newForgeLevel = mData.enchanted;
          forgeLevelUp = true;
        } else {
          tameGoldBonus = Math.floor(goldGained * 0.5);
          profile.currency += tameGoldBonus;
        }
      }

      if (isDuplicate) {
        if (forgeLevelUp) {
          huntOutcome += ` (👾 Tamed duplicate! Upgraded to Enchanted ${newForgeLevel})`;
        } else {
          huntOutcome += ` (Already tamed at Max Enchanted! Converted +${tameGoldBonus.toLocaleString('id-ID')} Gold)`;
        }
      } else {
        huntOutcome += ` (✨ TAMED **${monster.name}**!)`;
      }
      if (kirinUnlocked) {
        huntOutcome += `\n    └ 🌌 **SECRET UNLOCKED!** You gathered all T1-T6 monsters! **Kirin** (Secret Support Animal) and its signature weapon **Amrita Bell** have joined your collection!`;
      }
    }
    if (stoneReward > 0) {
      huntOutcome += ` (💎 Found +${stoneReward} Elemental Stone(s)!)`;
    }
    if (levelUp) {
      huntOutcome += ` 🌟 **Leveled Up to Lv.${profile.level}!**`;
    }
  } else if (battle.result === 'draw') {
    const levelMultiplier = 1 + (profile.level - 1) * 0.1;
    let tierXpMult = 1.0;
    if (monster.tier === 'enchanted') tierXpMult = 1.5;
    else if (monster.tier === 'blessed') tierXpMult = 2.5;
    else if (monster.tier === 'overpowered') tierXpMult = 4.0;
    else if (monster.tier === 'chronicle') tierXpMult = 8.0;
    else if (monster.tier === 'prodigy') tierXpMult = 15.0;
    else if (monster.tier === 'beyond') tierXpMult = 30.0;

    xpGained = Math.floor((Math.floor(monster.xpMin * 0.2) || 1) * tierXpMult * levelMultiplier);
    xpGained = Math.floor(xpGained * diffMult);
    if (hasF6Onfield) {
      xpGained = Math.floor(xpGained * 3);
    }
    const levelUp = addXP(profile, xpGained);
    huntOutcome = `💨 Draw vs **${monster.displayName || monster.name}** (${threatLabel}) (+${xpGained.toLocaleString('id-ID')} XP)`;
    if (levelUp) {
      huntOutcome += ` 🌟 **Leveled Up to Lv.${profile.level}!**`;
    }
  } else {
    const levelMultiplier = 1 + (profile.level - 1) * 0.1;
    let tierXpMult = 1.0;
    if (monster.tier === 'enchanted') tierXpMult = 1.5;
    else if (monster.tier === 'blessed') tierXpMult = 2.5;
    else if (monster.tier === 'overpowered') tierXpMult = 4.0;
    else if (monster.tier === 'chronicle') tierXpMult = 8.0;
    else if (monster.tier === 'prodigy') tierXpMult = 15.0;
    else if (monster.tier === 'beyond') tierXpMult = 30.0;

    xpGained = Math.floor((Math.floor(monster.xpMin * 0.2) || 1) * tierXpMult * levelMultiplier);
    xpGained = Math.floor(xpGained * diffMult);
    if (hasF6Onfield) {
      xpGained = Math.floor(xpGained * 3);
    }
    const levelUp = addXP(profile, xpGained);
    huntOutcome = `💀 Lost to **${monster.displayName || monster.name}** (${threatLabel}) (+${xpGained.toLocaleString('id-ID')} XP)`;
    if (levelUp) {
      huntOutcome += ` 🌟 **Leveled Up to Lv.${profile.level}!**`;
    }
  }

  const equipLvlUps = addEquipXP(profile, activeTeam, battle.won);
  if (equipLvlUps.length > 0) {
    huntOutcome += `\n    └ 📈 ${equipLvlUps.join(', ')}`;
  }

  profile.totalDamage = (profile.totalDamage || 0) + battle.totalDamageDealt;
  if (battle.won && monster.tier === 'beyond' && monster.threat === 'threat6') {
    profile.killedBeyondT6 = true;
  }

  return `• <@${member.id}> **Lv.${profile.level}**:\n  └ ${huntOutcome}`;
}

async function executeSingleVoiceLoot(member, profile) {
  const activeTeam = getActiveTeam(profile);
  const onfieldWeaponName = activeTeam && activeTeam.onfield ? activeTeam.onfield.weapon : null;
  const getWpForge = (wpName) => {
    if (!wpName) return 0;
    return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
  };
  const onfieldForge = getWpForge(onfieldWeaponName);
  const hasF6Onfield = onfieldForge >= 6;

  const weapon = gameData.getRandomWeapon();
  let lootOutcome = '';
  const levelMultiplier = 1 + (profile.level - 1) * 0.1;
  let lootXp = Math.floor(getBaseLootXp(weapon.rarity) * levelMultiplier);
  if (hasF6Onfield) {
    lootXp = Math.floor(lootXp * 3);
  }
  const weaponInfo = `${weapon.category.toUpperCase()} - ${weapon.rarity.toUpperCase()}`;
  
  let gotStoneCount = 0;
  const stoneChance = hasF6Onfield ? 0.10 : 0.05;
  if (Math.random() < stoneChance) {
    gotStoneCount += 1;
  }

  if (gotStoneCount > 0) {
    profile.elementalStones = (profile.elementalStones || 0) + gotStoneCount;
  }

  const alreadyOwnsWeapon = getOwnedWeaponsList(profile, member).includes(weapon.name);
  if (!alreadyOwnsWeapon) {
    profile.dex.weapons.push(weapon.name);
    lootOutcome = `🎁 Found **${weapon.name}** (${weaponInfo} - New!)`;
  } else {
    if (!profile.weaponLevels[weapon.name]) {
      profile.weaponLevels[weapon.name] = { level: 1, xp: 0, forge: 0 };
    }
    const wData = profile.weaponLevels[weapon.name];
    wData.forge = wData.forge || 0;
    if (wData.forge < 6) {
      wData.forge += 1;
      lootOutcome = `🎁 Duplicate **${weapon.name}** - Upgraded to Forge ${wData.forge}!`;
    } else {
      let sellVal = Math.floor(weapon.sellValue * 10 * levelMultiplier);
      if (hasF6Onfield) {
        sellVal = Math.floor(sellVal * 3);
      }
      profile.currency += sellVal;
      lootOutcome = `🎁 Duplicate **${weapon.name}** (${weaponInfo} - Sold for +${sellVal.toLocaleString('id-ID')}g)`;
    }
  }

  if (gotStoneCount > 0) {
    lootOutcome += ` (💎 Found +${gotStoneCount} Elemental Stone(s)!)`;
  }

  const levelUpLoot = addXP(profile, lootXp);
  lootOutcome += ` (+${lootXp.toLocaleString('id-ID')} XP)`;
  if (levelUpLoot) {
    lootOutcome += ` 🌟 **Leveled Up to Lv.${profile.level}!**`;
  }

  return `• <@${member.id}> **Lv.${profile.level}**:\n  └ ${lootOutcome}`;
}

async function runVoiceTick() {
  if (!firebase.isInitialized()) return;

  const now = Date.now();

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const activeVoiceUsers = [];
      await guild.members.fetch();
      
      for (const [memberId, member] of guild.members.cache) {
        if (member.user.bot) continue;
        
        const voiceState = member.voice;
        if (voiceState && voiceState.channelId) {
          activeVoiceUsers.push(member);
        }
      }

      if (activeVoiceUsers.length === 0) continue;

      const huntLogLines = [];
      const lootLogLines = [];

      for (const member of activeVoiceUsers) {
        const userId = member.id;
        const profile = await firebase.getUser(userId);
        let profileChanged = false;

        // 1. VOICE HUNT SCAN
        const huntLvl = profile.voiceHuntLevel || 1;
        const huntCooldownMs = getVoiceHuntCooldown(huntLvl) * 1000;
        if (now - (profile.lastVoiceHuntTime || 0) >= huntCooldownMs) {
          const outcome = await executeSingleVoiceHunt(member, profile);
          huntLogLines.push(outcome);
          profile.lastVoiceHuntTime = now;
          profileChanged = true;
        }

        // 2. VOICE LOOT SCAN
        const lootLvl = profile.voiceLootLevel || 1;
        const lootCooldownMs = getVoiceLootCooldown(lootLvl) * 1000;
        if (now - (profile.lastVoiceLootTime || 0) >= lootCooldownMs) {
          const outcome = await executeSingleVoiceLoot(member, profile);
          lootLogLines.push(outcome);
          profile.lastVoiceLootTime = now;
          profileChanged = true;
        }

        if (profileChanged) {
          await firebase.saveUser(userId, profile);
        }
      }

      const logChannel = await getOrCreateLogChannel(guild);
      if (logChannel) {
        if (huntLogLines.length > 0) {
          const chunkSize = 10;
          for (let i = 0; i < huntLogLines.length; i += chunkSize) {
            const chunk = huntLogLines.slice(i, i + chunkSize);
            const embed = new EmbedBuilder()
              .setTitle('🔊 Voice Channel Idle Hunt Logs')
              .setColor('#4CAF50')
              .setDescription(chunk.join('\n\n'))
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
        if (lootLogLines.length > 0) {
          const chunkSize = 10;
          for (let i = 0; i < lootLogLines.length; i += chunkSize) {
            const chunk = lootLogLines.slice(i, i + chunkSize);
            const embed = new EmbedBuilder()
              .setTitle('🔊 Voice Channel Idle Loot Logs')
              .setColor('#FF9800')
              .setDescription(chunk.join('\n\n'))
              .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error(`[Voice Tick Error] Error processing guild ${guild.name}:`, err);
    }
  }
}

async function executeRPGCommand(command, args, message, effectivePrefix) {
  const userId = message.author.id;
  const guildId = message.guild?.id;

  if (!firebase.isInitialized()) {
    return message.reply('❌ The bot database connection is currently unconfigured. Ask the bot owner to set up `firebase-service-account.json`.');
  }

  // Helper for command cooldowns
  function checkCooldown(userId, commandName) {
    const cooldownKey = `${userId}-${commandName}`;
    const now = Date.now();
    if (cooldowns.has(cooldownKey)) {
      const expiration = cooldowns.get(cooldownKey) + COOLDOWN_TIME_MS;
      if (now < expiration) {
        const remaining = ((expiration - now) / 1000).toFixed(1);
        return remaining;
      }
    }
    cooldowns.set(cooldownKey, now);
    return null;
  }

  // COMMAND: HELP
  if (command === 'help' || command === 'hhelp') {
    const embed = new EmbedBuilder()
      .setTitle('🎮 RPG Bot Command list')
      .setColor('#FF9800')
      .setDescription('Defeat monsters, collect weapons, and build teams! Earn progress automatically by sitting in voice channels, or play manually below.')
      .addFields(
        { name: `${effectivePrefix}h or ${effectivePrefix}hunt`, value: "Simulate a hunt for a monster. (10s cooldown)" },
        { name: `${effectivePrefix}l or ${effectivePrefix}loot`, value: "Loot a chest for weapons. (10s cooldown)" },
        { name: `${effectivePrefix}p or ${effectivePrefix}profile`, value: "Check level, progression, combat stats, currency, and active team slots." },
        { name: `${effectivePrefix}lb [gold/level] or ${effectivePrefix}leaderboard [gold/level]`, value: "View the top players sorted by level (default) or gold wealth." },
        { name: `${effectivePrefix}dex`, value: "View your library of tamed monsters and collected weapons." },
        { name: `${effectivePrefix}team view`, value: "View configuration details for all 3 teams." },
        { name: `${effectivePrefix}team set [1-3]`, value: "Change which team is active." },
        { name: `${effectivePrefix}team clear [1-3]`, value: "Clear active team setup." },
        { name: `${effectivePrefix}use onfield (on) [monster] [weapon]`, value: "Equip monster and/or DPS weapon onfield." },
        { name: `${effectivePrefix}use offfield1 (off1) [monster] [weapon]`, value: "Equip monster and/or Support weapon to off-field slot 1." },
        { name: `${effectivePrefix}use offfield2 (off2) [monster] [weapon]`, value: "Equip monster and/or Support weapon to off-field slot 2." },
        { name: `${effectivePrefix}s l [simple/informative]`, value: "Toggle duplicate loot layout settings." },
        { name: `${effectivePrefix}s h [simple/informative/info]`, value: "Toggle hunt battle log layouts." },
        { name: `${effectivePrefix}userprefix [prefix]`, value: "Change your personal prefix preference (use `reset` or `none` to clear)." },
        { name: `${effectivePrefix}serverprefix [prefix]`, value: "Change server-wide prefix preference (Manage Server permission required, use `reset` or `none` to clear)." },
        { name: `${effectivePrefix}by [info/up/down]`, value: "Beyond Threat Level system commands." },
        { name: `${effectivePrefix}voice`, value: "Upgrade your Voice Channel Idle Hunt and Loot intervals." },
        { name: `${effectivePrefix}give @User [amount]`, value: "Transfer Gold to another player." },
        { name: `${effectivePrefix}bet @player [amount]`, value: "Challenge another player to a multiplayer dice bet." }
      )
      .setFooter({ text: `Active Prefix: ${effectivePrefix} | User Prefix: ${userPrefix || 'None'} | Server Prefix: ${serverPrefix || 'None'}` });
    return message.reply({ embeds: [embed] });
  }

  // Helper for command cooldowns
  function checkCooldown(userId, commandName) {
    const cooldownKey = `${userId}-${commandName}`;
    const now = Date.now();
    if (cooldowns.has(cooldownKey)) {
      const expiration = cooldowns.get(cooldownKey) + COOLDOWN_TIME_MS;
      if (now < expiration) {
        const remaining = ((expiration - now) / 1000).toFixed(1);
        return remaining;
      }
    }
    cooldowns.set(cooldownKey, now);
    return null;
  }

  // COMMAND: HUNT ('h / 'hunt)
  if (command === 'h' || command === 'hunt') {
    const remaining = checkCooldown(userId, 'hunt');
    if (remaining) {
      return message.reply(`⏳ You are exhausted from hunting! Please wait **${remaining}s** before trying again.`);
    }

    setTimeout(() => {
      if (message.channel && typeof message.channel.send === 'function') {
        message.channel.send(`🔔 <@${userId}>, your **'hunt** is ready!`).catch(() => {});
      }
    }, COOLDOWN_TIME_MS);

    try {
      const profile = await firebase.getUser(userId);
      const activeTeam = getActiveTeam(profile);
      const onfieldWeaponName = activeTeam && activeTeam.onfield ? activeTeam.onfield.weapon : null;
      const getWpForge = (wpName) => {
        if (!wpName) return 0;
        return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
      };
      const onfieldForge = getWpForge(onfieldWeaponName);
      const hasF6Onfield = onfieldForge >= 6;

      const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);
      const playerStats = gameData.getUserStats(profile.level, activeTeam, profile.monsterLevels, profile.weaponLevels);

      const isBeyondMode = (profile.beyondLevel || 0) >= 1;
      const monster = isBeyondMode ? gameData.getTXKirinStats(profile.beyondLevel, profile.level, ps) : gameData.getRandomMonster(ps, profile.level, profile.lobbyThreatOffset || 0);
      const battle = gameData.simulateBattle(playerStats, monster, activeTeam, profile.weaponLevels, profile.monsterLevels);
      const threatLabel = isBeyondMode ? `Beyond Level ${profile.beyondLevel}` : `Threat ${monster.threat.replace('threat', '')}`;

      const embed = new EmbedBuilder().setAuthor({ name: `${message.author.username}'s Hunt`, iconURL: message.author.displayAvatarURL() });

      const huntLayout = (profile.settings && profile.settings.huntLayout) || 'informative';
      let pages = [];
      let currentPageIndex = 0;
      let renderEmbedDescription = null;

      if (huntLayout === 'simple') {
        // Simple layout doesn't show battle rounds in description
      } else {
        // Determine page pagination for battle logs
        pages = chunkBattleRounds(battle.rounds, 4);
        currentPageIndex = pages.length - 1;

        renderEmbedDescription = (pageIdx) => {
          return `**Battle Summary (Page ${pageIdx + 1}/${pages.length}):**\n\`\`\`\n${pages[pageIdx]}\n\`\`\``;
        };
        
        embed.setDescription(renderEmbedDescription(currentPageIndex));
      }

      let xpGained = 0;
      let goldGained = 0;
      let tamed = false;
      let isDuplicate = false;
      let tameGoldBonus = 0;
      let forgeLevelUp = false;
      let newForgeLevel = 0;
      let hasMidasTouch = false;
      let levelUp = false;
      let equipLvlUps = [];
      let markText = '';
      let embedColor = '#9E9E9E';
      let statusText = 'Draw';
      let stoneReward = 0;
      let kirinUnlocked = false;

      const levelMultiplier = 1 + (profile.level - 1) * 0.1;

      if (isBeyondMode) {
        const byLevel = profile.beyondLevel;
        if (battle.result === 'victory') {
          statusText = 'Victory';
          embedColor = '#1A0D3D'; // Dark Purple/Indigo for Beyond
          
          xpGained = Math.floor(80000 * byLevel * levelMultiplier);
          goldGained = Math.floor(200000 * byLevel * levelMultiplier);
          stoneReward = 5 + byLevel;
          const markAdd = 50 + byLevel * 5;
          profile.huntMarks = (profile.huntMarks || 0) + markAdd;
          markText = `**${profile.huntMarks}** (+${markAdd} TX bonus ⚡)`;
          
          if (hasF6Onfield) {
            xpGained = Math.floor(xpGained * 3);
            goldGained = Math.floor(goldGained * 3);
          }
          
          profile.killedTXKirin = true;
          profile.currency += goldGained;
          profile.elementalStones = (profile.elementalStones || 0) + stoneReward;
          levelUp = addXP(profile, xpGained);
          equipLvlUps = addEquipXP(profile, activeTeam, true);

          // Achievements check
          const newlyUnlockedConqueror = !profile.unlockedAchievements?.includes('celestial_conqueror');
          if (newlyUnlockedConqueror) {
            profile.unlockedAchievements = profile.unlockedAchievements || [];
            profile.unlockedAchievements.push('celestial_conqueror');
            profile.newlyUnlockedConqueror = true; // Temporary flag for embed
          }
        } else if (battle.result === 'draw') {
          statusText = 'Draw';
          embedColor = '#9E9E9E';
          xpGained = Math.floor(16000 * byLevel * levelMultiplier);
          if (hasF6Onfield) {
            xpGained = Math.floor(xpGained * 3);
          }
          levelUp = addXP(profile, xpGained);
          equipLvlUps = addEquipXP(profile, activeTeam, false);
          markText = `**${profile.huntMarks || 0}** (+0)`;
        } else {
          statusText = 'Defeat';
          embedColor = '#F44336';
          xpGained = Math.floor(16000 * byLevel * levelMultiplier);
          if (hasF6Onfield) {
            xpGained = Math.floor(xpGained * 3);
          }
          levelUp = addXP(profile, xpGained);
          equipLvlUps = addEquipXP(profile, activeTeam, false);
          profile.huntMarks = 0;
          markText = `**0** (Reset)`;
        }
      } else {
        let tierXpMult = 1.0;
        let tierGoldMult = 1.0;
        if (monster.tier === 'enchanted') { tierXpMult = 1.5; tierGoldMult = 1.5; }
        else if (monster.tier === 'blessed') { tierXpMult = 2.5; tierGoldMult = 2.5; }
        else if (monster.tier === 'overpowered') { tierXpMult = 4.0; tierGoldMult = 4.0; }
        else if (monster.tier === 'chronicle') { tierXpMult = 8.0; tierGoldMult = 8.0; }
        else if (monster.tier === 'prodigy') { tierXpMult = 15.0; tierGoldMult = 15.0; }
        else if (monster.tier === 'beyond') { tierXpMult = 30.0; tierGoldMult = 30.0; }

        // Apply Power Scaling (PS) difficulty nerf multiplier (up to 80% nerf at PS 120)
        const psScale = Math.min(120, Math.max(1, ps));
        const diffMult = 1.0 - ((psScale - 1) / 119) * 0.8;

        if (battle.result === 'victory') {
          statusText = 'Victory';
          embedColor = monster.tier === 'beyond' ? '#1A0D3D' : monster.tier === 'prodigy' ? '#FF6B00' : monster.tier === 'chronicle' ? '#8A2BE2' : monster.tier === 'overpowered' ? '#FF5722' : '#4CAF50';
          
          const bonuses = getTierBaseRewardBonuses(monster.tier);
          xpGained = Math.floor((Math.floor(Math.random() * (monster.xpMax - monster.xpMin + 1)) + monster.xpMin + bonuses.xp) * tierXpMult * levelMultiplier);
          goldGained = Math.floor((Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1)) + monster.goldMin + bonuses.gold) * tierGoldMult * levelMultiplier);

          xpGained = Math.floor(xpGained * diffMult);
          goldGained = Math.floor(goldGained * diffMult);
          
          if (hasF6Onfield) {
            xpGained = Math.floor(xpGained * 3);
            goldGained = Math.floor(goldGained * 3);
          }
          
          // Goblin gold multiplier
          const goblinMult = getGoblinGoldMultiplier(profile, activeTeam);
          goldGained = Math.floor(goldGained * goblinMult);

          // Midas Touch check (+20% Gold from victory for Golden Kukri Lv 10 onfield)
          const onfieldWeapon = activeTeam && activeTeam.onfield ? gameData.findWeaponByName(activeTeam.onfield.weapon) : null;
          const getWpLvl = (wpName) => {
            if (!wpName) return 1;
            return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].level : 1) || 1;
          };
          const onfieldLvl = onfieldWeapon ? getWpLvl(onfieldWeapon.name) : 1;
          if (onfieldWeapon && onfieldWeapon.name === 'Golden Kukri' && onfieldLvl >= 10) {
            hasMidasTouch = true;
            goldGained = Math.floor(goldGained * 1.20);
          }

          // Midas Strike check (+30% Gold from victory for Golden Kukri Forge >= 4 equipped in active team)
          let hasMidasStrike = false;
          const getWpForgeLocal = (wpName) => {
            if (!wpName) return 0;
            return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
          };
          for (const slot of ['onfield', 'offfield1', 'offfield2']) {
            if (activeTeam && activeTeam[slot] && activeTeam[slot].weapon === 'Golden Kukri') {
              if (getWpForgeLocal('Golden Kukri') >= 4) {
                hasMidasStrike = true;
              }
            }
          }
          if (hasMidasStrike) {
            goldGained = Math.floor(goldGained * 1.30);
          }

          forgeLevelUp = false;
          newForgeLevel = 0;
          if (Math.random() <= monster.tameRate && !['chronicle', 'prodigy', 'beyond'].includes(monster.tier)) {
            tamed = true;
            if (!profile.dex.monsters.includes(monster.name)) {
              profile.dex.monsters.push(monster.name);
            } else {
              isDuplicate = true;
            }

            const newlyUnlockedKirin = checkAndUnlockKirin(profile);
            if (newlyUnlockedKirin) {
              kirinUnlocked = true;
            }

            if (isDuplicate) {
              if (!profile.monsterLevels[monster.name]) {
                profile.monsterLevels[monster.name] = { level: 1, xp: 0, enchanted: 0 };
              }
              const mData = profile.monsterLevels[monster.name];
              mData.enchanted = mData.enchanted || mData.forge || 0;
              delete mData.forge;

              if (mData.enchanted < 6) {
                mData.enchanted += 1;
                newForgeLevel = mData.enchanted;
                forgeLevelUp = true;
              } else {
                tameGoldBonus = Math.floor(goldGained * 0.5);
                profile.currency += tameGoldBonus;
              }
            }
          }

          profile.currency += goldGained;
          levelUp = addXP(profile, xpGained);
          equipLvlUps = addEquipXP(profile, activeTeam, true);

          // Dynamic Elemental Stone rewards for Overpowered+ wins in manual hunt
          const tierLower = monster.tier.toLowerCase();
          if (tierLower === 'beyond') {
            if (monster.name === 'Ancient Dragon') {
              stoneReward = 10;
            } else {
              stoneReward = 3;
            }
          } else if (tierLower === 'prodigy') {
            if (Math.random() < 0.70) stoneReward = 1;
          } else if (tierLower === 'chronicle') {
            if (Math.random() < 0.40) stoneReward = 1;
          } else if (tierLower === 'overpowered') {
            if (Math.random() < 0.20) stoneReward = 1;
          }

          if (stoneReward > 0) {
            profile.elementalStones = (profile.elementalStones || 0) + stoneReward;
          }
          
          // Hunt Marks: Win +1, OP Win +3
          if (monster.tier === 'beyond') {
            profile.huntMarks = (profile.huntMarks || 0) + 20;
            markText = `**${profile.huntMarks}** (+20 Beyond bonus 💀)`;
          } else if (monster.tier === 'prodigy') {
            profile.huntMarks = (profile.huntMarks || 0) + 10;
            markText = `**${profile.huntMarks}** (+10 Prodigy bonus ⚡)`;
          } else if (monster.tier === 'chronicle') {
            profile.huntMarks = (profile.huntMarks || 0) + 5;
            markText = `**${profile.huntMarks}** (+5 Chronicle bonus 📖)`;
          } else if (monster.tier === 'overpowered') {
            profile.huntMarks = (profile.huntMarks || 0) + 3;
            markText = `**${profile.huntMarks}** (+3 OP bonus)`;
          } else {
            profile.huntMarks = (profile.huntMarks || 0) + 1;
            markText = `**${profile.huntMarks}** (+1)`;
          }
        } else if (battle.result === 'draw') {
          statusText = 'Draw';
          embedColor = '#9E9E9E';

          xpGained = Math.floor((Math.floor(monster.xpMin * 0.2) || 1) * tierXpMult * levelMultiplier);
          xpGained = Math.floor(xpGained * diffMult);
          if (hasF6Onfield) {
            xpGained = Math.floor(xpGained * 3);
          }
          levelUp = addXP(profile, xpGained);
          equipLvlUps = addEquipXP(profile, activeTeam, false);
          markText = `**${profile.huntMarks || 0}** (+0)`;
        } else {
          statusText = 'Defeat';
          embedColor = '#F44336';

          xpGained = Math.floor((Math.floor(monster.xpMin * 0.2) || 1) * tierXpMult * levelMultiplier);
          xpGained = Math.floor(xpGained * diffMult);
          if (hasF6Onfield) {
            xpGained = Math.floor(xpGained * 3);
          }
          levelUp = addXP(profile, xpGained);
          equipLvlUps = addEquipXP(profile, activeTeam, false);
          profile.huntMarks = 0;
          markText = `**0** (Reset)`;
        }
      }

      profile.totalDamage = (profile.totalDamage || 0) + battle.totalDamageDealt;
      if (battle.won && monster.tier === 'beyond' && monster.threat === 'threat6') {
        profile.killedBeyondT6 = true;
      }

      await firebase.saveUser(userId, profile);

      // Calculate scaled monster stats for display
      let tierHp, tierAtk, tierDef, spawnRate, capitalizedTier;
      if (isBeyondMode) {
        tierHp = monster.hp;
        tierAtk = monster.atk;
        tierDef = monster.def;
        spawnRate = '100.0%';
        capitalizedTier = 'TX';
      } else {
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

        const hpMult = 1 + (ps - 1) * 0.14;
        tierHp = Math.floor((monster.hp * hpMult + (ps - 1) * 75 * (profile.level / 20)) * tierHpMult * levelMultiplier);
        
        const atkMult = 1 + (ps - 1) * 0.06;
        tierAtk = Math.floor(monster.atk * atkMult * tierAtkMult);
        
        const tierDef = Math.floor(monster.def * tierDefMult);
        spawnRate = getMonsterTierSpawnRate(monster.tier, ps, profile.lobbyThreatOffset || 0);
        capitalizedTier = monster.tier.charAt(0).toUpperCase() + monster.tier.slice(1);
      }

      const teamName = activeTeam.name || `Team ${profile.activeTeamIndex + 1}`;
      embed.setTitle(teamName).setColor(embedColor);

      // Add double-column fields
      const battleInfoText = isBeyondMode
        ? `• **Monster**: TX Kirin\n• **Threat**: Beyond Level ${profile.beyondLevel}\n• **Super-Threat**: Beyond\n• **Status**: ${statusText}`
        : `• **Monster**: ${monster.name}\n• **Threat**: Threat ${monster.threat.replace('threat', '')}\n• **Super-Threat**: ${capitalizedTier}\n• **Status**: ${statusText}`;
      const monsterStatsText = `• **HP**: ${tierHp.toLocaleString('id-ID')}\n• **ATK**: ${tierAtk.toLocaleString('id-ID')}\n• **DEF**: ${tierDef.toLocaleString('id-ID')}\n• **Spawn Rate**: ${spawnRate}`;

      embed.addFields(
        { name: '📋 Battle Info', value: battleInfoText, inline: true },
        { name: '📊 Monster Stats', value: monsterStatsText, inline: true },
        { name: '⚜️ Element Resilience', value: `\`\`\`\n${battle.monsterResistances.join(', ')}\n\`\`\``, inline: false },
        { name: '💥 Total Damage', value: `\`\`\`\nTotal Damage: ${battle.totalDamageDealt.toLocaleString('id-ID')}\n\`\`\``, inline: false }
      );

      // Helper to construct progress block
      const getProgressText = () => {
        const lines = [];
        
        // 1. Profile
        const profileXpReq = gameData.getXPRequired(profile.level);
        const profileBar = getProgressBar(profile.xp, profileXpReq, 10);
        lines.push(`Level Profile: Level ${profile.level} [${profileBar}] (${profile.xp}/${profileXpReq} XP)`);
        
        // 2. Weapon
        const weaponName = activeTeam.onfield.weapon;
        if (weaponName) {
          const wData = profile.weaponLevels[weaponName] || { level: 1, xp: 0 };
          if (wData.level >= 30) {
            lines.push(`Level Weapon: Level 30/30 [██████████] (MAX)`);
          } else {
            const wXpReq = wData.level * 50;
            const wBar = getProgressBar(wData.xp, wXpReq, 10);
            lines.push(`Level Weapon: Level ${wData.level}/30 [${wBar}] (${wData.xp}/${wXpReq} XP)`);
          }
        } else {
          lines.push(`Level Weapon: None`);
        }
        
        // 3. Monster
        const monsterName = activeTeam.onfield.monster;
        if (monsterName) {
          const mData = profile.monsterLevels[monsterName] || { level: 1, xp: 0 };
          if (mData.level >= 20) {
            lines.push(`Level Monster: Level 20/20 [██████████] (MAX)`);
          } else {
            const mXpReq = mData.level * 50;
            const mBar = getProgressBar(mData.xp, mXpReq, 10);
            lines.push(`Level Monster: Level ${mData.level}/20 [${mBar}] (${mData.xp}/${mXpReq} XP)`);
          }
        } else {
          lines.push(`Level Monster: None`);
        }
        
        return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
      };

      const maxRounds = monster.tier === 'tx' ? 30 : monster.tier === 'beyond' ? 25 : (monster.tier === 'prodigy' || monster.tier === 'overpowered') ? 20 : monster.tier === 'chronicle' ? 15 : 10;
      const outcomeText = `Round: ${battle.roundsPlayed}/${maxRounds} | +${xpGained} XP | +${goldGained} Golds | Hunt Marks: ${profile.huntMarks}`;
      embed.setFooter({ text: outcomeText });

      if (battle.result === 'victory') {
        embed.addFields(
          { name: '📊 Progress', value: getProgressText(), inline: false }
        );

        if (stoneReward > 0 || isBeyondMode) {
          let dropBonusText = '';
          if (stoneReward > 0) {
            dropBonusText += `Found **+${stoneReward} Elemental Stone(s)**!`;
          }
          if (isBeyondMode) {
            const markAdd = 50 + profile.beyondLevel * 5;
            dropBonusText += (dropBonusText ? '\n' : '') + `Gained **+${markAdd} Hunt Marks**! ⚡`;
          }
          embed.addFields(
            { name: '💎 Drop Bonus', value: dropBonusText, inline: false }
          );
        }

        if (isBeyondMode) {
          if (profile.newlyUnlockedConqueror) {
            embed.addFields({ name: '🏆 Achievement Unlocked!', value: `🌟 **Celestial Conqueror** (Defeated TX Kirin)` });
            delete profile.newlyUnlockedConqueror;
          }
        } else {
          if (tamed) {
            if (isDuplicate) {
              if (forgeLevelUp) {
                embed.addFields({ name: '👾 Monster Capture', value: `You tamed another **${monster.name}**! It was fused and upgraded to **Enchanted ${newForgeLevel}**!` });
              } else {
                embed.addFields({ name: '👾 Monster Capture', value: `You tamed another **${monster.name}** at Max Enchanted (Enchanted 6)! Received duplicate gold converter instead.` });
              }
            } else {
              embed.addFields({ name: '✨ NEW TAME!', value: `You successfully tamed **${monster.name}**! Check your dex and team command to equip it.` });
            }
            if (kirinUnlocked) {
              embed.addFields({ name: '🌌 SECRET UNLOCKED!', value: `🎉 You gathered all T1-T6 monsters! **Kirin** (Secret Support Animal) and its signature weapon **Amrita Bell** have joined your collection!` });
            }
          }
        }

        if (levelUp) {
          embed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
        if (equipLvlUps && equipLvlUps.length > 0) {
          embed.addFields({ name: '📈 Equipment Level Up!', value: equipLvlUps.join('\n') });
        }
      } else if (battle.result === 'draw') {
        embed.addFields(
          { name: '📊 Progress', value: getProgressText(), inline: false }
        );

        if (levelUp) {
          embed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
        if (equipLvlUps && equipLvlUps.length > 0) {
          embed.addFields({ name: '📈 Equipment Level Up!', value: equipLvlUps.join('\n') });
        }
      } else {
        embed.addFields(
          { name: '📊 Progress', value: getProgressText(), inline: false }
        );

        if (levelUp) {
          embed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
        if (equipLvlUps && equipLvlUps.length > 0) {
          embed.addFields({ name: '📈 Equipment Level Up!', value: equipLvlUps.join('\n') });
        }
      }

      const sentMessage = await message.reply({ embeds: [embed] });

      if (huntLayout === 'informative' && pages.length > 1) {
        const prevCustomId = `hunt_prev_${userId}_${Date.now()}`;
        const nextCustomId = `hunt_next_${userId}_${Date.now()}`;
        
        const getRow = () => {
          return new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(prevCustomId)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPageIndex === 0),
              new ButtonBuilder()
                .setCustomId(nextCustomId)
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPageIndex === pages.length - 1)
            );
        };

        // Edit message to add pagination buttons
        await sentMessage.edit({ components: [getRow()] }).catch(() => {});

        const filter = (i) => i.user.id === userId && (i.customId === prevCustomId || i.customId === nextCustomId);
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (i) => {
          try {
            if (i.customId === prevCustomId) {
              if (currentPageIndex > 0) currentPageIndex--;
            } else if (i.customId === nextCustomId) {
              if (currentPageIndex < pages.length - 1) currentPageIndex++;
            }

            await i.update({
              embeds: [embed.setDescription(renderEmbedDescription(currentPageIndex))],
              components: [getRow()]
            });
          } catch (err) {
            console.error('[Button Collector Error]', err);
          }
        });

        collector.on('end', () => {
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(prevCustomId)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(nextCustomId)
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );
          sentMessage.edit({ components: [disabledRow] }).catch(() => {});
        });
      }

    } catch (err) {
      console.error('[Command Hunt Error]', err);
      return message.reply('❌ An error occurred while retrieving your profile or hunting.');
    }
  }

  // COMMAND: HUNTLOOT ('hl / 'huntloot)
  if (command === 'hl' || command === 'huntloot') {
    function getCooldownRemaining(uId, cmdName) {
      const cooldownKey = `${uId}-${cmdName}`;
      const now = Date.now();
      if (cooldowns.has(cooldownKey)) {
        const expiration = cooldowns.get(cooldownKey) + COOLDOWN_TIME_MS;
        if (now < expiration) {
          return ((expiration - now) / 1000).toFixed(1);
        }
      }
      return null;
    }

    const remainingHunt = getCooldownRemaining(userId, 'hunt');
    const remainingLoot = getCooldownRemaining(userId, 'loot');
    if (remainingHunt || remainingLoot) {
      const maxRemaining = Math.max(parseFloat(remainingHunt || 0), parseFloat(remainingLoot || 0)).toFixed(1);
      return message.reply(`⏳ You are exhausted from hunting/looting! Please wait **${maxRemaining}s** before trying again.`);
    }

    // Set both cooldowns
    cooldowns.set(`${userId}-hunt`, Date.now());
    cooldowns.set(`${userId}-loot`, Date.now());

    setTimeout(() => {
      if (message.channel && typeof message.channel.send === 'function') {
        message.channel.send(`🔔 <@${userId}>, your **'hunt** and **'loot** are ready!`).catch(() => {});
      }
    }, COOLDOWN_TIME_MS);

    try {
      const profile = await firebase.getUser(userId);

      // --- 1. HUNT PART ---
      const activeTeam = getActiveTeam(profile);
      const onfieldWeaponName = activeTeam && activeTeam.onfield ? activeTeam.onfield.weapon : null;
      const getWpForge = (wpName) => {
        if (!wpName) return 0;
        return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
      };
      const onfieldForge = getWpForge(onfieldWeaponName);
      const hasF6Onfield = onfieldForge >= 6;

      const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);
      const playerStats = gameData.getUserStats(profile.level, activeTeam, profile.monsterLevels, profile.weaponLevels);

      const monster = gameData.getRandomMonster(ps, profile.level, profile.lobbyThreatOffset || 0);
      const battle = gameData.simulateBattle(playerStats, monster, activeTeam, profile.weaponLevels, profile.monsterLevels);
      const threatLabel = `Threat ${monster.threat.replace('threat', '')}`;

      const huntEmbed = new EmbedBuilder().setAuthor({ name: `${message.author.username}'s Hunt`, iconURL: message.author.displayAvatarURL() });

      const huntLayout = (profile.settings && profile.settings.huntLayout) || 'informative';
      let pages = [];
      let currentPageIndex = 0;
      let renderEmbedDescription = null;

      if (huntLayout === 'simple') {
        // Simple layout doesn't show battle logs in description
      } else {
        pages = chunkBattleRounds(battle.rounds, 4);
        currentPageIndex = pages.length - 1;

        renderEmbedDescription = (pageIdx) => {
          return `**Battle Summary (Page ${pageIdx + 1}/${pages.length}):**\n\`\`\`\n${pages[pageIdx]}\n\`\`\``;
        };
        
        huntEmbed.setDescription(renderEmbedDescription(currentPageIndex));
      }

      let xpGained = 0;
      let goldGained = 0;
      let tamed = false;
      let isDuplicate = false;
      let tameGoldBonus = 0;
      let forgeLevelUp = false;
      let newForgeLevel = 0;
      let hasMidasTouch = false;
      let levelUp = false;
      let equipLvlUps = [];
      let markText = '';
      let embedColor = '#9E9E9E';
      let statusText = 'Draw';
      let stoneReward = 0;
      let kirinUnlocked = false;

      const levelMultiplier = 1 + (profile.level - 1) * 0.1;
      let tierXpMult = 1.0;
      let tierGoldMult = 1.0;
      if (monster.tier === 'enchanted') { tierXpMult = 1.5; tierGoldMult = 1.5; }
      else if (monster.tier === 'blessed') { tierXpMult = 2.5; tierGoldMult = 2.5; }
      else if (monster.tier === 'overpowered') { tierXpMult = 4.0; tierGoldMult = 4.0; }
      else if (monster.tier === 'chronicle') { tierXpMult = 8.0; tierGoldMult = 8.0; }
      else if (monster.tier === 'prodigy') { tierXpMult = 15.0; tierGoldMult = 15.0; }
      else if (monster.tier === 'beyond') { tierXpMult = 30.0; tierGoldMult = 30.0; }

      const psScale = Math.min(120, Math.max(1, ps));
      const diffMult = 1.0 - ((psScale - 1) / 119) * 0.8;

      if (battle.result === 'victory') {
        statusText = 'Victory';
        embedColor = monster.tier === 'beyond' ? '#1A0D3D' : monster.tier === 'prodigy' ? '#FF6B00' : monster.tier === 'chronicle' ? '#8A2BE2' : monster.tier === 'overpowered' ? '#FF5722' : '#4CAF50';
        
        const bonuses = getTierBaseRewardBonuses(monster.tier);
        xpGained = Math.floor((Math.floor(Math.random() * (monster.xpMax - monster.xpMin + 1)) + monster.xpMin + bonuses.xp) * tierXpMult * levelMultiplier);
        goldGained = Math.floor((Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1)) + monster.goldMin + bonuses.gold) * tierGoldMult * levelMultiplier);

        xpGained = Math.floor(xpGained * diffMult);
        goldGained = Math.floor(goldGained * diffMult);
        
        if (hasF6Onfield) {
          xpGained = Math.floor(xpGained * 3);
          goldGained = Math.floor(goldGained * 3);
        }
        
        const goblinMult = getGoblinGoldMultiplier(profile, activeTeam);
        goldGained = Math.floor(goldGained * goblinMult);

        const onfieldWeapon = activeTeam && activeTeam.onfield ? gameData.findWeaponByName(activeTeam.onfield.weapon) : null;
        const getWpLvl = (wpName) => {
          if (!wpName) return 1;
          return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].level : 1) || 1;
        };
        const onfieldLvl = onfieldWeapon ? getWpLvl(onfieldWeapon.name) : 1;
        if (onfieldWeapon && onfieldWeapon.name === 'Golden Kukri' && onfieldLvl >= 10) {
          hasMidasTouch = true;
          goldGained = Math.floor(goldGained * 1.20);
        }

        let hasMidasStrike = false;
        const getWpForgeLocal = (wpName) => {
          if (!wpName) return 0;
          return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
        };
        for (const slot of ['onfield', 'offfield1', 'offfield2']) {
          if (activeTeam && activeTeam[slot] && activeTeam[slot].weapon === 'Golden Kukri') {
            if (getWpForgeLocal('Golden Kukri') >= 4) {
              hasMidasStrike = true;
            }
          }
        }
        if (hasMidasStrike) {
          goldGained = Math.floor(goldGained * 1.30);
        }

        forgeLevelUp = false;
        newForgeLevel = 0;
        if (Math.random() <= monster.tameRate && !['chronicle', 'prodigy', 'beyond'].includes(monster.tier)) {
          tamed = true;
          if (!profile.dex.monsters.includes(monster.name)) {
            profile.dex.monsters.push(monster.name);
          } else {
            isDuplicate = true;
          }

          const newlyUnlockedKirin = checkAndUnlockKirin(profile);
          if (newlyUnlockedKirin) {
            kirinUnlocked = true;
          }

          if (isDuplicate) {
            if (!profile.monsterLevels[monster.name]) {
              profile.monsterLevels[monster.name] = { level: 1, xp: 0, enchanted: 0 };
            }
            const mData = profile.monsterLevels[monster.name];
            mData.enchanted = mData.enchanted || mData.forge || 0;
            delete mData.forge;

            if (mData.enchanted < 6) {
              mData.enchanted += 1;
              newForgeLevel = mData.enchanted;
              forgeLevelUp = true;
            } else {
              tameGoldBonus = Math.floor(goldGained * 0.5);
              profile.currency += tameGoldBonus;
            }
          }
        }

        profile.currency += goldGained;
        levelUp = addXP(profile, xpGained);
        equipLvlUps = addEquipXP(profile, activeTeam, true);

        const tierLower = monster.tier.toLowerCase();
        if (tierLower === 'beyond') {
          if (monster.name === 'Ancient Dragon') {
            stoneReward = 10;
          } else {
            stoneReward = 3;
          }
        } else if (tierLower === 'prodigy') {
          if (Math.random() < 0.70) stoneReward = 1;
        } else if (tierLower === 'chronicle') {
          if (Math.random() < 0.40) stoneReward = 1;
        } else if (tierLower === 'overpowered') {
          if (Math.random() < 0.20) stoneReward = 1;
        }

        if (stoneReward > 0) {
          profile.elementalStones = (profile.elementalStones || 0) + stoneReward;
        }
        
        if (monster.tier === 'beyond') {
          profile.huntMarks = (profile.huntMarks || 0) + 20;
          markText = `**${profile.huntMarks}** (+20 Beyond bonus 💀)`;
        } else if (monster.tier === 'prodigy') {
          profile.huntMarks = (profile.huntMarks || 0) + 10;
          markText = `**${profile.huntMarks}** (+10 Prodigy bonus ⚡)`;
        } else if (monster.tier === 'chronicle') {
          profile.huntMarks = (profile.huntMarks || 0) + 5;
          markText = `**${profile.huntMarks}** (+5 Chronicle bonus 📖)`;
        } else if (monster.tier === 'overpowered') {
          profile.huntMarks = (profile.huntMarks || 0) + 3;
          markText = `**${profile.huntMarks}** (+3 OP bonus)`;
        } else {
          profile.huntMarks = (profile.huntMarks || 0) + 1;
          markText = `**${profile.huntMarks}** (+1)`;
        }
      } else if (battle.result === 'draw') {
        statusText = 'Draw';
        embedColor = '#9E9E9E';

        xpGained = Math.floor((Math.floor(monster.xpMin * 0.2) || 1) * tierXpMult * levelMultiplier);
        xpGained = Math.floor(xpGained * diffMult);
        if (hasF6Onfield) {
          xpGained = Math.floor(xpGained * 3);
        }
        levelUp = addXP(profile, xpGained);
        equipLvlUps = addEquipXP(profile, activeTeam, false);
        markText = `**${profile.huntMarks || 0}** (+0)`;
      } else {
        statusText = 'Defeat';
        embedColor = '#F44336';

        xpGained = Math.floor((Math.floor(monster.xpMin * 0.2) || 1) * tierXpMult * levelMultiplier);
        xpGained = Math.floor(xpGained * diffMult);
        if (hasF6Onfield) {
          xpGained = Math.floor(xpGained * 3);
        }
        levelUp = addXP(profile, xpGained);
        equipLvlUps = addEquipXP(profile, activeTeam, false);
        profile.huntMarks = 0;
        markText = `**0** (Reset)`;
      }

      profile.totalDamage = (profile.totalDamage || 0) + battle.totalDamageDealt;
      if (battle.won && monster.tier === 'beyond' && monster.threat === 'threat6') {
        profile.killedBeyondT6 = true;
      }

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

      const mHpMult = 1 + (ps - 1) * 0.14;
      const mLevelMultiplier = 1 + (profile.level - 1) * 0.1;
      let finalMonsterHp = Math.floor((monster.hp * mHpMult + (ps - 1) * 75 * (profile.level / 20)) * tierHpMult * mLevelMultiplier);
      let isKirinOfffield = false;
      if (activeTeam) {
        if ((activeTeam.offfield1 && activeTeam.offfield1.monster === 'Kirin') || (activeTeam.offfield2 && activeTeam.offfield2.monster === 'Kirin')) {
          isKirinOfffield = true;
        }
      }
      if (isKirinOfffield) {
        finalMonsterHp = Math.floor(finalMonsterHp * 2.5);
      }
      
      const mAtkMult = 1 + (ps - 1) * 0.06;
      const finalMonsterAtk = Math.floor(monster.atk * mAtkMult * tierAtkMult);
      const finalMonsterDef = Math.floor(monster.def * tierDefMult);

      const displayTier = monster.tier.charAt(0).toUpperCase() + monster.tier.slice(1);
      
      huntEmbed.setColor(embedColor)
        .setTitle(`${monster.displayName || monster.name}'s Hunt`)
        .addFields(
          { name: '📋 Battle Info', value: `• **Monster**: ${monster.name}\n• **Threat**: ${threatLabel}\n• **Super-Threat**: ${displayTier}\n• **Status**: ${statusText}`, inline: true },
          { name: '📊 Monster Stats', value: `• **HP**: ${finalMonsterHp}\n• **ATK**: ${finalMonsterAtk}\n• **DEF**: ${finalMonsterDef}\n• **Spawn Rate**: ${(gameData.getTierChances(ps, profile.lobbyThreatOffset || 0)[monster.tier] * 100 * (1/2)).toFixed(1)}%`, inline: true }
        );

      if (battle.monsterResistances && battle.monsterResistances.length > 0) {
        huntEmbed.addFields({ name: '🧬 Element Resilience', value: `\`${battle.monsterResistances.join(', ')}\``, inline: false });
      }

      huntEmbed.addFields({ name: '💥 Total Damage', value: `\`Total Damage: ${battle.totalDamageDealt.toLocaleString('id-ID')}\``, inline: false });

      if (huntLayout === 'informative') {
        const getProgressText = () => {
          const xpReq = gameData.getXPRequired(profile.level);
          const activeOnfield = activeTeam && activeTeam.onfield ? activeTeam.onfield.monster : 'None';
          const onfieldLvl = activeTeam && activeTeam.onfield && profile.monsterLevels[activeTeam.onfield.monster] ? profile.monsterLevels[activeTeam.onfield.monster].level : 1;
          const onfieldEnchanted = activeTeam && activeTeam.onfield && profile.monsterLevels[activeTeam.onfield.monster] ? (profile.monsterLevels[activeTeam.onfield.monster].enchanted || 0) : 0;
          
          const activeWeapon = activeTeam && activeTeam.onfield ? activeTeam.onfield.weapon : 'None';
          const wpLvl = activeTeam && activeTeam.onfield && profile.weaponLevels[activeTeam.onfield.weapon] ? profile.weaponLevels[activeTeam.onfield.weapon].level : 1;
          const wpForge = activeTeam && activeTeam.onfield && profile.weaponLevels[activeTeam.onfield.weapon] ? (profile.weaponLevels[activeTeam.onfield.weapon].forge || 0) : 0;

          const tameText = tamed ? `\n🎉 **Tamed ${monster.name}!**${isDuplicate ? ` *(Already owned, upgraded to Enchanted E${newForgeLevel}!)*` : ''}` : '';
          const stoneRewardText = stoneReward > 0 ? `\n💎 **Found ${stoneReward} Elemental Stone(s)!**` : '';
          const kirinText = kirinUnlocked ? `\n🦄 **CELESTIAL UNLOCKED**: Kirin has joined your monster roster!` : '';

          return `Level Profile: Level ${profile.level} [${getProgressBar(profile.xp, xpReq, 10)}] (${profile.xp}/${xpReq} XP)` +
                 `\nLevel Weapon: Level ${wpLvl}/30 [${getProgressBar(wpLvl, 30, 10)}] (Forge ${wpForge})` +
                 `\nLevel Monster: Level ${onfieldLvl}/20 [${getProgressBar(onfieldLvl, 20, 10)}] (Enchanted E${onfieldEnchanted})` +
                 tameText + stoneRewardText + kirinText;
        };

        huntEmbed.addFields(
          { name: '📊 Progress', value: getProgressText(), inline: false }
        );

        if (levelUp) {
          huntEmbed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
        if (equipLvlUps && equipLvlUps.length > 0) {
          huntEmbed.addFields({ name: '📈 Equipment Level Up!', value: equipLvlUps.join('\n') });
        }
      }

      // --- 2. LOOT PART ---
      const weapon = gameData.getRandomWeapon();
      let lootXp = Math.floor(getBaseLootXp(weapon.rarity) * levelMultiplier);
      let lootGoldGained = Math.floor(weapon.sellValue * 10 * levelMultiplier);

      if (hasF6Onfield) {
        lootXp = Math.floor(lootXp * 3);
        lootGoldGained = Math.floor(lootGoldGained * 3);
      }

      const lootEmbed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.username}'s Loot`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      let gotStone = false;
      const stoneChance = hasF6Onfield ? 0.10 : 0.05;
      if (Math.random() < stoneChance) {
        profile.elementalStones = (profile.elementalStones || 0) + 1;
        gotStone = true;
      }

      const alreadyOwns = getOwnedWeaponsList(profile, message.member).includes(weapon.name);
      const lootLayout = (profile.settings && profile.settings.lootLayout) || 'simple';

      let forgedUpgraded = false;
      let newLootForgeLevel = 0;
      let lootLevelUp = false;

      if (!alreadyOwns) {
        profile.dex.weapons.push(weapon.name);
        lootEmbed.setTitle(`🎁 Loot Found: ${weapon.name}`)
          .setColor('#FFC107')
          .setDescription(`You found a new weapon! It has been added to your weapon library.`)
          .addFields(
            { name: '⚔️ Attack Bonus', value: `+${weapon.atkBonus || 0}`, inline: true },
            { name: '🛡️ Defense Bonus', value: `+${weapon.defBonus || 0}`, inline: true },
            { name: '🪄 HP/Heal Bonus', value: `HP: +${weapon.hpBonus || 0}${weapon.healAmount ? ` | Heal: +${weapon.healAmount}/rd` : ''}`, inline: true }
          );

        if (lootLayout === 'informative') {
          lootEmbed.addFields(
            { name: '💎 Rarity & Category', value: `${weapon.rarity.toUpperCase()} (${weapon.category.toUpperCase()})`, inline: true },
            { name: '✨ XP Reward', value: `+${lootXp} XP`, inline: false }
          );
        } else {
          const formatRarity = (r) => r.charAt(0).toUpperCase() + r.slice(1);
          const formatCategory = (c) => c === 'dps' ? 'DPS' : c.charAt(0).toUpperCase() + c.slice(1);

          lootEmbed.setFooter({
            text: `Rarity: ${formatRarity(weapon.rarity)} | Category: ${formatCategory(weapon.category)} | +${lootXp} XP`
          });
        }

        lootLevelUp = addXP(profile, lootXp);

        if (lootLevelUp) {
          lootEmbed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
      } else {
        if (!profile.weaponLevels[weapon.name]) {
          profile.weaponLevels[weapon.name] = { level: 1, xp: 0, forge: 0 };
        }
        const wData = profile.weaponLevels[weapon.name];
        wData.forge = wData.forge || 0;
        if (wData.forge < 6) {
          wData.forge += 1;
          newLootForgeLevel = wData.forge;
          forgedUpgraded = true;
        } else {
          profile.currency += lootGoldGained;
        }

        if (forgedUpgraded) {
          lootEmbed.setTitle(`🎁 Duplicate Loot: ${weapon.name}`)
            .setColor('#4CAF50')
            .setDescription(`You already own **${weapon.name}**! It was fused and upgraded to **Forge ${newLootForgeLevel}**!`);
          
          if (lootLayout === 'informative') {
            lootEmbed.addFields(
              { name: '💎 Rarity & Category', value: `${weapon.rarity.toUpperCase()} (${weapon.category.toUpperCase()})`, inline: true },
              { name: '✨ XP Reward', value: `+${lootXp} XP`, inline: false }
            );
          } else {
            const formatRarity = (r) => r.charAt(0).toUpperCase() + r.slice(1);
            const formatCategory = (c) => c === 'dps' ? 'DPS' : c.charAt(0).toUpperCase() + c.slice(1);

            lootEmbed.setFooter({
              text: `Rarity: ${formatRarity(weapon.rarity)} | Category: ${formatCategory(weapon.category)} | +${lootXp} XP`
            });
          }
        } else {
          lootEmbed.setTitle(`🎁 Duplicate Loot: ${weapon.name}`)
            .setColor('#9E9E9E')
            .setDescription(`You already own **${weapon.name}** at Max Forge (Forge 6)! It was automatically disassembled and sold.`);

          if (lootLayout === 'informative') {
            lootEmbed.addFields(
              { name: '🪙 Recycled Gold', value: `+${lootGoldGained} Gold`, inline: true },
              { name: '💎 Rarity & Category', value: `${weapon.rarity.toUpperCase()} (${weapon.category.toUpperCase()})`, inline: true },
              { name: '✨ XP Reward', value: `+${lootXp} XP`, inline: false }
            );
          } else {
            const formatRarity = (r) => r.charAt(0).toUpperCase() + r.slice(1);
            const formatCategory = (c) => c === 'dps' ? 'DPS' : c.charAt(0).toUpperCase() + c.slice(1);

            lootEmbed.setFooter({
              text: `Rarity: ${formatRarity(weapon.rarity)} | Category: ${formatCategory(weapon.category)} | +${lootXp} XP | +${lootGoldGained} Golds`
            });
          }
        }

        lootLevelUp = addXP(profile, lootXp);

        if (lootLevelUp) {
          lootEmbed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
      }

      if (gotStone) {
        lootEmbed.addFields({ name: '💎 Elemental Stone Found!', value: 'You found **1 Elemental Stone**! Use it to reroll weapon elements using `\'r e [weapon_name]`.' });
      }

      await firebase.saveUser(userId, profile);

      const sentMessage = await message.reply({ embeds: [huntEmbed, lootEmbed] });

      if (huntLayout === 'informative' && pages.length > 1) {
        const prevCustomId = `hunt_prev_${userId}_${Date.now()}`;
        const nextCustomId = `hunt_next_${userId}_${Date.now()}`;
        
        const getRow = () => {
          return new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(prevCustomId)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPageIndex === 0),
              new ButtonBuilder()
                .setCustomId(nextCustomId)
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPageIndex === pages.length - 1)
            );
        };

        await sentMessage.edit({ components: [getRow()] }).catch(() => {});

        const filter = (i) => i.user.id === userId && (i.customId === prevCustomId || i.customId === nextCustomId);
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (i) => {
          try {
            if (i.customId === prevCustomId) {
              if (currentPageIndex > 0) currentPageIndex--;
            } else if (i.customId === nextCustomId) {
              if (currentPageIndex < pages.length - 1) currentPageIndex++;
            }

            await i.update({
              embeds: [huntEmbed.setDescription(renderEmbedDescription(currentPageIndex)), lootEmbed],
              components: [getRow()]
            });
          } catch (err) {
            console.error('[Button Collector Error]', err);
          }
        });

        collector.on('end', () => {
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(prevCustomId)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(nextCustomId)
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );
          sentMessage.edit({ components: [disabledRow] }).catch(() => {});
        });
      }

    } catch (err) {
      console.error('[Command HuntLoot Error]', err);
      return message.reply('❌ An error occurred while retrieving your profile or running hunt/loot.');
    }
  }

  // COMMAND: LOOT ('l / 'loot)
  if (command === 'l' || command === 'loot') {

    const remaining = checkCooldown(userId, 'loot');
    if (remaining) {
      return message.reply(`⏳ You've opened too many chests! Please wait **${remaining}s** before searching for loot again.`);
    }

    setTimeout(() => {
      if (message.channel && typeof message.channel.send === 'function') {
        message.channel.send(`🔔 <@${userId}>, your **'loot** is ready!`).catch(() => {});
      }
    }, COOLDOWN_TIME_MS);

    try {
      const profile = await firebase.getUser(userId);
      const activeTeam = getActiveTeam(profile);
      const onfieldWeaponName = activeTeam && activeTeam.onfield ? activeTeam.onfield.weapon : null;
      const getWpForge = (wpName) => {
        if (!wpName) return 0;
        return (profile.weaponLevels && profile.weaponLevels[wpName] ? profile.weaponLevels[wpName].forge : 0) || 0;
      };
      const onfieldForge = getWpForge(onfieldWeaponName);
      const hasF6Onfield = onfieldForge >= 6;

      const weapon = gameData.getRandomWeapon();
      
      const levelMultiplier = 1 + (profile.level - 1) * 0.1;
      let lootXp = Math.floor(getBaseLootXp(weapon.rarity) * levelMultiplier);
      let goldGained = Math.floor(weapon.sellValue * 10 * levelMultiplier);

      if (hasF6Onfield) {
        lootXp = Math.floor(lootXp * 3);
        goldGained = Math.floor(goldGained * 3);
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.username}'s Loot`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      // 10% chance if F6 onfield, 5% otherwise to drop Elemental Stone
      let gotStone = false;
      const stoneChance = hasF6Onfield ? 0.10 : 0.05;
      if (Math.random() < stoneChance) {
        profile.elementalStones = (profile.elementalStones || 0) + 1;
        gotStone = true;
      }

      const alreadyOwns = getOwnedWeaponsList(profile, message.member).includes(weapon.name);
      const layout = (profile.settings && profile.settings.lootLayout) || 'simple';

      let forgedUpgraded = false;
      let newForgeLevel = 0;

      if (!alreadyOwns) {
        profile.dex.weapons.push(weapon.name);
        embed.setTitle(`🎁 Loot Found: ${weapon.name}`)
          .setColor('#FFC107')
          .setDescription(`You found a new weapon! It has been added to your weapon library.`)
          .addFields(
            { name: '⚔️ Attack Bonus', value: `+${weapon.atkBonus || 0}`, inline: true },
            { name: '🛡️ Defense Bonus', value: `+${weapon.defBonus || 0}`, inline: true },
            { name: '🪄 HP/Heal Bonus', value: `HP: +${weapon.hpBonus || 0}${weapon.healAmount ? ` | Heal: +${weapon.healAmount}/rd` : ''}`, inline: true }
          );

        if (layout === 'informative') {
          embed.addFields(
            { name: '💎 Rarity & Category', value: `${weapon.rarity.toUpperCase()} (${weapon.category.toUpperCase()})`, inline: true },
            { name: '✨ XP Reward', value: `+${lootXp} XP`, inline: false }
          );
        } else {
          const formatRarity = (r) => r.charAt(0).toUpperCase() + r.slice(1);
          const formatCategory = (c) => c === 'dps' ? 'DPS' : c.charAt(0).toUpperCase() + c.slice(1);

          embed.setFooter({
            text: `Rarity: ${formatRarity(weapon.rarity)} | Category: ${formatCategory(weapon.category)} | +${lootXp} XP`
          });
        }

        const levelUp = addXP(profile, lootXp);
        await firebase.saveUser(userId, profile);

        if (levelUp) {
          embed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
      } else {
        if (!profile.weaponLevels[weapon.name]) {
          profile.weaponLevels[weapon.name] = { level: 1, xp: 0, forge: 0 };
        }
        const wData = profile.weaponLevels[weapon.name];
        wData.forge = wData.forge || 0;
        if (wData.forge < 6) {
          wData.forge += 1;
          newForgeLevel = wData.forge;
          forgedUpgraded = true;
        } else {
          profile.currency += goldGained;
        }

        await firebase.saveUser(userId, profile);

        if (forgedUpgraded) {
          embed.setTitle(`🎁 Duplicate Loot: ${weapon.name}`)
            .setColor('#4CAF50')
            .setDescription(`You already own **${weapon.name}**! It was fused and upgraded to **Forge ${newForgeLevel}**!`);
          
          if (layout === 'informative') {
            embed.addFields(
              { name: '💎 Rarity & Category', value: `${weapon.rarity.toUpperCase()} (${weapon.category.toUpperCase()})`, inline: true },
              { name: '✨ XP Reward', value: `+${lootXp} XP`, inline: false }
            );
          } else {
            const formatRarity = (r) => r.charAt(0).toUpperCase() + r.slice(1);
            const formatCategory = (c) => c === 'dps' ? 'DPS' : c.charAt(0).toUpperCase() + c.slice(1);

            embed.setFooter({
              text: `Rarity: ${formatRarity(weapon.rarity)} | Category: ${formatCategory(weapon.category)} | +${lootXp} XP`
            });
          }
        } else {
          embed.setTitle(`🎁 Duplicate Loot: ${weapon.name}`)
            .setColor('#9E9E9E')
            .setDescription(`You already own **${weapon.name}** at Max Forge (Forge 6)! It was automatically disassembled and sold.`);

          if (layout === 'informative') {
            embed.addFields(
              { name: '🪙 Recycled Gold', value: `+${goldGained} Gold`, inline: true },
              { name: '💎 Rarity & Category', value: `${weapon.rarity.toUpperCase()} (${weapon.category.toUpperCase()})`, inline: true },
              { name: '✨ XP Reward', value: `+${lootXp} XP`, inline: false }
            );
          } else {
            const formatRarity = (r) => r.charAt(0).toUpperCase() + r.slice(1);
            const formatCategory = (c) => c === 'dps' ? 'DPS' : c.charAt(0).toUpperCase() + c.slice(1);

            embed.setFooter({
              text: `Rarity: ${formatRarity(weapon.rarity)} | Category: ${formatCategory(weapon.category)} | +${lootXp} XP | +${goldGained} Golds`
            });
          }
        }

        const levelUp = addXP(profile, lootXp);

        if (levelUp) {
          embed.addFields({ name: '⭐ LEVEL UP!', value: `🎉 Congratulations! You have leveled up to **Level ${profile.level}**!` });
        }
      }

      if (gotStone) {
        embed.addFields({ name: '💎 Elemental Stone Found!', value: 'You found **1 Elemental Stone**! Use it to reroll weapon elements using `\'r e [weapon_name]`.' });
      }

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Command Loot Error]', err);
      return message.reply('❌ An error occurred while opening the loot container.');
    }
  }

  // COMMAND: PROFILE ('p / 'profile)
  if (command === 'p' || command === 'profile') {
    try {
      const profile = await firebase.getUser(userId);
      const newlyUnlocked = checkAndUnlockKirin(profile);
      if (newlyUnlocked) {
        await firebase.saveUser(userId, profile);
      }
      const activeTeam = getActiveTeam(profile);
      
      const stats = gameData.getUserStats(profile.level, activeTeam, profile.monsterLevels, profile.weaponLevels);
      const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);
      const xpReq = gameData.getXPRequired(profile.level);
      const progressBar = getProgressBar(profile.xp, xpReq, 10);
      const displayName = message.member ? message.member.displayName : message.author.username;

      // Titles system
      const legacyTitles = {
        '1051027211160928276': 'Early Tester',
        '588988763204616214': 'Early Tester',
        '661135501226672129': 'Creator Tester'
      };
      const userTitle = profile.equippedTitle || legacyTitles[userId] || '';

      // Progression Ranking system
      let rank = 'N/A';
      if (firebase.db) {
        try {
          const usersSnap = await firebase.db.collection('rpg_users').get();
          const allUsers = [];
          usersSnap.forEach(doc => {
            allUsers.push(doc.data());
          });
          allUsers.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return (b.xp || 0) - (a.xp || 0);
          });
          const rankIdx = allUsers.findIndex(u => u.userId === userId);
          if (rankIdx !== -1) {
            rank = rankIdx + 1;
          }
        } catch (rankErr) {
          console.error('[Rank Calc Error]', rankErr);
        }
      }

      const formatIndoNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

      const formattedGold = formatIndoNumber(profile.currency || 0);
      const progressPct = Math.floor((profile.xp / xpReq) * 100);
      const levelProgressText = `Level Player: **${profile.level}**\nProgress: \`[${progressBar}]\` (${progressPct}%)\nXP Player: **${profile.xp}/${xpReq}**\nGold: **${formattedGold}**\nPS: **${ps}/120**\n💎 Elemental Stones: **${profile.elementalStones || 0}**\n☣️ Lobby Threat Level: **${profile.lobbyThreatOffset >= 0 ? '+' : ''}${profile.lobbyThreatOffset || 0}**\n🌌 Beyond Level: **${profile.beyondLevel || 0}**`;

      const combatStatsText = `❤️ **HP**: ${stats.hp}\n⚔️ **ATK**: ${stats.atk}\n🛡️ **DEF**: ${stats.def}\n🪄 **Heal**: +${stats.healAmount} HP/rd`;

      const superStatsText = `🎯 **CR**: ${Math.round(stats.critChance * 100)}%\n💥 **CDM**: ${Math.round(stats.critDamage * 100)}%\n☄️ **PEN**: ${Math.round(stats.pen * 100)}%`;

      const mechanicText = `☣️ **DOT**: ${stats.dot}\n💀 **T.DMG**: ${stats.tDmg}\n💢 **VUL**: +${Math.round(stats.vul * 100)}%`;

      const embed = new EmbedBuilder()
        .setAuthor({ name: `${displayName} — Progression`, iconURL: message.author.displayAvatarURL() })
        .setColor('#2196F3')
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
          { name: '✨ Level & Progression', value: levelProgressText },
          { name: '🛡️ Combat Stats', value: combatStatsText, inline: true },
          { name: '🛡️ Super Stats', value: superStatsText, inline: true },
          { name: '🛡️ Mechanic', value: mechanicText, inline: true }
        )
        .setFooter({
          text: `RANK: ${rank} • Hunt Marks: ${profile.huntMarks || 0}`,
          iconURL: client.user.displayAvatarURL()
        });

      if (userTitle) {
        embed.setDescription(`🏆 **Title**: ${userTitle}`);
      }

      let teamDescription = '';
      teamDescription += `• **On-Field**: 👾 ${formatMonsterSlot(profile, activeTeam.onfield.monster)} / ⚔️ ${formatWeaponSlot(profile, activeTeam.onfield.weapon)}\n`;
      teamDescription += `• **Off-Field 1**: 👾 ${formatMonsterSlot(profile, activeTeam.offfield1.monster)} / 🛡️ ${formatWeaponSlot(profile, activeTeam.offfield1.weapon)}\n`;
      teamDescription += `• **Off-Field 2**: 👾 ${formatMonsterSlot(profile, activeTeam.offfield2.monster)} / 🛡️ ${formatWeaponSlot(profile, activeTeam.offfield2.weapon)}`;

      embed.addFields({ name: `👥 Active Team (Team ${profile.activeTeamIndex + 1})`, value: teamDescription });

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Command Profile Error]', err);
      return message.reply('❌ Could not retrieve character profile.');
    }
  }

  // COMMAND: SETTINGS ('s' / 'settings')
  if (command === 's' || command === 'settings') {
    try {
      const profile = await firebase.getUser(userId);

      if (args.length === 0) {
        const lLayout = (profile.settings && profile.settings.lootLayout) || 'simple';
        const hLayout = (profile.settings && profile.settings.huntLayout) || 'informative';
        const embed = new EmbedBuilder()
          .setTitle('⚙️ User Settings')
          .setColor('#607D8B')
          .setDescription(`Configure your minigame options below:\n\n• **Loot Layout**: \`${lLayout}\` (e.g. \`simple\` or \`informative\`)\n  └ Use \`'s l simple\` or \`'s l informative\` to switch layouts.\n\n• **Hunt Layout**: \`${hLayout}\` (e.g. \`simple\`, \`informative\` or \`info\`)\n  └ Use \`'s h simple\` or \`'s h informative\` to switch layouts.`)
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      const option = args[0].toLowerCase();
      if (option === 'l' || option === 'loot' || option === 'layout') {
        if (args.length < 2) {
          return message.reply(`❌ Please specify a loot layout: \`simple\` or \`informative\`. Example: \`'s l informative\``);
        }
        const layoutVal = args[1].toLowerCase();
        if (layoutVal === 'simple' || layoutVal === 'informative') {
          profile.settings = profile.settings || {};
          profile.settings.lootLayout = layoutVal;
          await firebase.saveUser(userId, profile);
          return message.reply(`✅ Successfully updated duplicate loot layout to **${layoutVal === 'simple' ? 'Simple' : 'Informative'}**!`);
        } else {
          return message.reply(`❌ Invalid layout option. Please choose either \`simple\` or \`informative\`.`);
        }
      }

      if (option === 'h' || option === 'hunt') {
        if (args.length < 2) {
          return message.reply(`❌ Please specify a hunt layout: \`simple\`, \`informative\`, or \`info\`. Example: \`'s h informative\``);
        }
        let layoutVal = args[1].toLowerCase();
        if (layoutVal === 'info') {
          layoutVal = 'informative';
        }
        if (layoutVal === 'simple' || layoutVal === 'informative') {
          profile.settings = profile.settings || {};
          profile.settings.huntLayout = layoutVal;
          await firebase.saveUser(userId, profile);
          return message.reply(`✅ Successfully updated hunt battle log layout to **${layoutVal === 'simple' ? 'Simple' : 'Informative'}**!`);
        } else {
          return message.reply(`❌ Invalid layout option. Please choose either \`simple\`, \`informative\`, or \`info\`.`);
        }
      }

      return message.reply(`❌ Unknown settings option. Use \`'s l <simple/informative>\` for loot, or \`'s h <simple/informative/info>\` for hunt layout.`);

    } catch (err) {
      console.error('[Command Settings Error]', err);
      return message.reply('❌ Failed to update settings.');
    }
  }

  // COMMAND: USERPREFIX ('userprefix' / 'up')
  if (command === 'userprefix' || command === 'up') {
    try {
      const profile = await firebase.getUser(userId);
      if (args.length === 0) {
        const curPrefix = (profile.settings && profile.settings.prefix) || 'None';
        return message.reply(`👤 **Personal Prefix Setting**\nYour current custom prefix: \`${curPrefix}\`\n\nTo change: \`${effectivePrefix}userprefix [new_prefix]\`\nTo reset: \`${effectivePrefix}userprefix reset\` or \`${effectivePrefix}userprefix none\``);
      }

      const inputPrefix = args.join(' ');
      if (inputPrefix.toLowerCase() === 'reset' || inputPrefix.toLowerCase() === 'none') {
        profile.settings = profile.settings || {};
        profile.settings.prefix = null;
        await firebase.saveUser(userId, profile);
        userPrefixCache.set(userId, null);
        return message.reply(`✅ Successfully reset your custom prefix override! Your commands will now use the server prefix or the default prefix (\`${PREFIX}\`).`);
      }

      if (inputPrefix.length > 10) {
        return message.reply(`❌ Prefix is too long! Maximum length is 10 characters.`);
      }

      profile.settings = profile.settings || {};
      profile.settings.prefix = inputPrefix;
      await firebase.saveUser(userId, profile);
      userPrefixCache.set(userId, inputPrefix);

      return message.reply(`✅ Successfully set your custom prefix override to \`${inputPrefix}\`!\nFrom now on, you must use \`${inputPrefix}\` before your commands (e.g. \`${inputPrefix}h\`).`);
    } catch (err) {
      console.error('[Command UserPrefix Error]', err);
      return message.reply('❌ Failed to update user prefix.');
    }
  }

  // COMMAND: SERVERPREFIX ('serverprefix' / 'sp')
  if (command === 'serverprefix' || command === 'sp') {
    if (!message.guild) {
      return message.reply('❌ This command can only be used inside a Discord server/guild.');
    }

    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ You do not have permissions to manage this server! You need the **Manage Server** (`ManageGuild`) permission.');
    }

    try {
      if (args.length === 0) {
        const curServerPrefix = (serverPrefix !== null) ? serverPrefix : 'None';
        return message.reply(`🖥️ **Server Prefix Setting**\nCurrent server-wide prefix: \`${curServerPrefix}\`\n\nTo change: \`${effectivePrefix}serverprefix [new_prefix]\`\nTo reset: \`${effectivePrefix}serverprefix reset\` or \`${effectivePrefix}serverprefix none\``);
      }

      const inputPrefix = args.join(' ');
      if (inputPrefix.toLowerCase() === 'reset' || inputPrefix.toLowerCase() === 'none') {
        await firebase.saveServerPrefix(guildId, null);
        serverPrefixCache.set(guildId, null);
        return message.reply(`✅ Successfully reset server-wide prefix override! Commands will fall back to default prefix (\`${PREFIX}\`) for players without custom user prefixes.`);
      }

      if (inputPrefix.length > 10) {
        return message.reply(`❌ Prefix is too long! Maximum length is 10 characters.`);
      }

      await firebase.saveServerPrefix(guildId, inputPrefix);
      serverPrefixCache.set(guildId, inputPrefix);

      return message.reply(`✅ Successfully set server-wide prefix override to \`${inputPrefix}\`!\nPlayers on this server without custom user prefixes must now use \`${inputPrefix}\` (e.g. \`${inputPrefix}h\`).`);
    } catch (err) {
      console.error('[Command ServerPrefix Error]', err);
      return message.reply('❌ Failed to update server prefix.');
    }
  }

  // COMMAND: LEADERBOARD ('lb' / 'leaderboard')
  if (command === 'lb' || command === 'leaderboard') {
    try {
      if (!firebase.db) {
        return message.reply('❌ Database is not initialized.');
      }
      
      const usersSnap = await firebase.db.collection('rpg_users').get();
      const allUsers = [];
      usersSnap.forEach(doc => {
        allUsers.push(doc.data());
      });

      const isGoldSort = args.length > 0 && (args[0].toLowerCase() === 'gold' || args[0].toLowerCase() === 'g');

      if (isGoldSort) {
        allUsers.sort((a, b) => (b.currency || 0) - (a.currency || 0));
      } else {
        allUsers.sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          return (b.xp || 0) - (a.xp || 0);
        });
      }

      const top10 = allUsers.slice(0, 10);
      const embed = new EmbedBuilder()
        .setTitle(isGoldSort ? '🪙 Gold Leaderboard' : '🏆 Progression Leaderboard')
        .setColor('#FFD700')
        .setTimestamp();

      const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

      const lines = top10.map((u, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const goldText = formatNumber(u.currency || 0);
        if (isGoldSort) {
          return `${medal} <@${u.userId}> • 🪙 **${goldText}** Gold • **Lv.${u.level}** (${u.xp} XP) • 🎖️ **${u.huntMarks || 0}** Marks`;
        } else {
          return `${medal} <@${u.userId}> • **Lv.${u.level}** (${u.xp} XP) • 🪙 **${goldText}** Gold • 🎖️ **${u.huntMarks || 0}** Marks`;
        }
      });

      embed.setDescription(lines.join('\n') || '*No players in the leaderboard yet.*');
      
      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[Leaderboard Command Error]', err);
      return message.reply('❌ Failed to retrieve leaderboard.');
    }
  }

  // COMMAND: DEX ('dex' / 'd')
  if (command === 'dex' || command === 'd') {
    try {
      const profile = await firebase.getUser(userId);
      const newlyUnlocked = checkAndUnlockKirin(profile);
      if (newlyUnlocked) {
        await firebase.saveUser(userId, profile);
      }
      
      const subCommand = args.length > 0 ? args[0].toLowerCase() : null;

      // Emojis mapping
      const threatEmojis = {
        threat1: '🟢',
        threat2: '🔵',
        threat3: '🟣',
        threat4: '🟡',
        threat5: '🟠',
        threat6: '🔴',
        threatX: '✨'
      };

      const weaponEmojis = {
        basic: '⚪',
        usual: '🟢',
        unusual: '🔵',
        odd: '🟣',
        exotic: '🟡',
        mythic: '🟠',
        supreme: '🔴',
        secret: '✨'
      };

      // 1. SUB-DEX: WEAPONS ('dex w')
      if (subCommand === 'w' || subCommand === 'weapon' || subCommand === 'weapons') {
        let weaponLines = '';
        let totalWeapons = 0;
        let ownedWeapons = 0;

        for (const rarity in gameData.WEAPONS) {
          const emoji = weaponEmojis[rarity] || '⚪';
          const list = gameData.WEAPONS[rarity];
          const formatted = list.map(w => {
            totalWeapons++;
            const owned = getOwnedWeaponsList(profile, message.member).includes(w.name);
            if (owned) ownedWeapons++;
            const tag = w.category === 'dps' ? '[D]' : '[S]';
            return owned ? `**${w.name} ${tag}**` : `*${w.name} ${tag} (locked)*`;
          }).join(', ');
          weaponLines += `${emoji} **${rarity.toUpperCase()}**: ${formatted}\n`;
        }

        const pct = totalWeapons > 0 ? ((ownedWeapons / totalWeapons) * 100).toFixed(1) : '0.0';
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ Weapons Collection Dex`)
          .setColor('#2196F3')
          .setDescription(`Track your collected weapons here. Complete loots to obtain new ones.\n\n**[D]** = DPS Weapon | **[S]** = Support Weapon\n\n${weaponLines}`)
          .setFooter({ text: `Collected: ${ownedWeapons} / ${totalWeapons} (${pct}%)` })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // 2. SUB-DEX: MONSTERS ('dex m')
      if (subCommand === 'm' || subCommand === 'monster' || subCommand === 'monsters') {
        let monsterLines = '';
        let totalMonsters = 0;
        let ownedMonsters = 0;

        for (const threat in gameData.MONSTERS) {
          const emoji = threatEmojis[threat] || '🟢';
          const list = gameData.MONSTERS[threat];
          const threatNum = threat.replace('threat', '');
          const formatted = list.map(m => {
            totalMonsters++;
            const owned = profile.dex.monsters.includes(m.name);
            if (owned) ownedMonsters++;
            return owned ? `**${m.name}**` : `*${m.name} (locked)*`;
          }).join(', ');
          monsterLines += `${emoji} **THREAT ${threatNum}**: ${formatted}\n`;
        }

        const pct = totalMonsters > 0 ? ((ownedMonsters / totalMonsters) * 100).toFixed(1) : '0.0';
        const embed = new EmbedBuilder()
          .setTitle(`👾 Monsters Collection Dex`)
          .setColor('#4CAF50')
          .setDescription(`Track your captured monsters here. Complete hunts to tame them.\n\n${monsterLines}`)
          .setFooter({ text: `Tamed: ${ownedMonsters} / ${totalMonsters} (${pct}%)` })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // 3. SUB-DEX: THREAT / SPAWN CHANCES ('dex threat')
      if (subCommand === 'threat' || subCommand === 't') {
        const activeTeam = getActiveTeam(profile);
        const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);
        const chances = gameData.getTierChances(ps, profile.lobbyThreatOffset || 0);

        const embed = new EmbedBuilder()
          .setTitle(`📊 Dynamic Monster Spawning & Threat Info`)
          .setColor('#FF9800')
          .setDescription(`Monster spawning is dynamic and clusters around your **Power Scaling (PS)** value. Elite tiers appear as you progress.\n\n**Current Progression Stats:**\n• Player Level: **Lv.${profile.level}**\n• Power Scaling (PS): **${ps} / 120**\n• Lobby Threat Offset: **${profile.lobbyThreatOffset || 0}**\n\n✨ **Monster Tier Spawn Rates at PS ${ps}:**\n• ⚪ **Basic**: ${(chances.basic * 100).toFixed(1)}%\n• ✨ **Blessed**: ${(chances.blessed * 100).toFixed(1)}%\n• 🌀 **Enchanted**: ${(chances.enchanted * 100).toFixed(1)}%\n• 🔥 **Overpowered**: ${(chances.overpowered * 100).toFixed(1)}%\n• 📖 **Chronicle**: ${(chances.chronicle * 100).toFixed(1)}%\n• ⚡ **Prodigy**: ${(chances.prodigy * 100).toFixed(1)}%\n• 💀 **Beyond**: ${(chances.beyond * 100).toFixed(1)}%`)
          .setFooter({ text: `Use '${effectivePrefix}th up' to increase threat offset for higher-tier monsters.` })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // 4. SUB-DEX: ENCHANT / FORGE STATUS ('dex enchant')
      if (subCommand === 'enchant' || subCommand === 'e') {
        let monsterStatusLines = [];
        let weaponStatusLines = [];

        // Monsters status
        const ownedMonstersList = profile.dex.monsters || [];
        for (const mName of ownedMonstersList) {
          const mData = profile.monsterLevels[mName] || { level: 1, enchanted: 0 };
          const lvl = mData.level || 1;
          const enchanted = mData.enchanted || mData.forge || 0;
          monsterStatusLines.push(`👾 **[E${enchanted}]** Lv.${lvl} ${mName}`);
        }

        // Weapons status
        const ownedWeaponsList = getOwnedWeaponsList(profile, message.member);
        for (const wName of ownedWeaponsList) {
          const wData = profile.weaponLevels[wName] || { level: 1, forge: 0 };
          const lvl = wData.level || 1;
          const forge = wData.forge || 0;
          const element = normalizeElement(wData.element);
          const perfection = wData.perfection || 0;
          let elementSuffix = '';
          if (element) {
            elementSuffix = ` (${getElementIcon(element)} ${element} ${perfection}%)`;
          }
          weaponStatusLines.push(`⚔️ **[F${forge}]** Lv.${lvl} ${wName}${elementSuffix}`);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🔨 Active Upgrades & Enchantments Dashboard`)
          .setColor('#E91E63')
          .addFields(
            { name: `👾 Monsters Enchantment Status (${ownedMonstersList.length} Owned)`, value: monsterStatusLines.join('\n') || '*None*' },
            { name: `⚔️ Weapons Forge & Element Status (${ownedWeaponsList.length} Owned)`, value: weaponStatusLines.join('\n') || '*None*' }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // 5. SUB-DEX: ELEMENTAL ('dex elemental' / 'dex element' / 'dex el')
      if (subCommand === 'elemental' || subCommand === 'element' || subCommand === 'el') {
        const ELEMENTS = ['Blast', 'Liquid', 'Volt', 'Blizzard', 'Shadow', 'Radiant', 'Void'];
        let elementDetails = '';
        for (const el of ELEMENTS) {
          const baseBuff = getElementBuffDescription(el, 100, 0);
          elementDetails += `• ${baseBuff}\n\n`;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🔮 Elemental Magic & Passives Dex`)
          .setColor('#00BCD4')
          .setDescription(`Weapons can be infused with elements via rerolling. Buff scaling depends on the weapon's **Perfection Rate (1-100%)** and **Forge Level** (buff values double at Forge 6+).\n\n${elementDetails}`)
          .setFooter({ text: `Reroll elements using prefix: 'r e [weapon]' or slash command: /reroll` })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // 6. DEFAULT DEX (Displays summary)
      let monsterLines = '';
      let totalMonsters = 0;
      let ownedMonsters = 0;

      for (const threat in gameData.MONSTERS) {
        const emoji = threatEmojis[threat] || '🟢';
        const list = gameData.MONSTERS[threat];
        const threatNum = threat.replace('threat', '');
        const formatted = list.map(m => {
          totalMonsters++;
          const owned = profile.dex.monsters.includes(m.name);
          if (owned) ownedMonsters++;
          return owned ? `**${m.name}**` : `*${m.name} (locked)*`;
        }).join(', ');
        monsterLines += `${emoji} **THREAT ${threatNum}**: ${formatted}\n`;
      }

      let weaponLines = '';
      let totalWeapons = 0;
      let ownedWeapons = 0;

      for (const rarity in gameData.WEAPONS) {
        const emoji = weaponEmojis[rarity] || '⚪';
        const list = gameData.WEAPONS[rarity];
        const formatted = list.map(w => {
          totalWeapons++;
          const owned = getOwnedWeaponsList(profile, message.member).includes(w.name);
          if (owned) ownedWeapons++;
          const tag = w.category === 'dps' ? '[D]' : '[S]';
          return owned ? `**${w.name} ${tag}**` : `*${w.name} ${tag} (locked)*`;
        }).join(', ');
        weaponLines += `${emoji} **${rarity.toUpperCase()}**: ${formatted}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📚 RPG Database & Collection Dex`)
        .setColor('#9C27B0')
        .setDescription(`Track your captured monsters and collected weapons here.\nUse specific sub-commands for detailed views:\n• \`${effectivePrefix}dex w\` - View weapons library\n• \`${effectivePrefix}dex m\` - View monsters library\n• \`${effectivePrefix}dex threat\` - View spawn chances & scaling details\n• \`${effectivePrefix}dex enchant\` - View active upgrades & elements\n• \`${effectivePrefix}dex elemental\` - View elemental magic & passives`)
        .addFields(
          { name: `👾 Monsters Owned (${ownedMonsters} / ${totalMonsters})`, value: monsterLines },
          { name: `⚔️ Weapons Collected (${ownedWeapons} / ${totalWeapons})`, value: weaponLines }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Command Dex Error]', err);
      return message.reply('❌ Could not retrieve collector index.');
    }
  }

  // COMMAND: MONSTER LIST / DETAIL ('m' / 'monster')
  if (command === 'm' || command === 'monster') {
    try {
      const profile = await firebase.getUser(userId);
      const newlyUnlocked = checkAndUnlockKirin(profile);
      if (newlyUnlocked) {
        await firebase.saveUser(userId, profile);
      }
      profile.monsterLevels = profile.monsterLevels || {};

      if (args.length === 0) {
        // List owned monsters
        const embed = new EmbedBuilder()
          .setTitle(`👾 Owned Monsters (${profile.dex.monsters.length})`)
          .setColor('#4CAF50');

        const threatEmojis = {
          threat1: '🟢',
          threat2: '🔵',
          threat3: '🟣',
          threat4: '🟡',
          threat5: '🟠',
          threat6: '🔴'
        };

        let descriptionLines = '';
        let hasAny = false;

        for (const threat in gameData.MONSTERS) {
          const list = gameData.MONSTERS[threat];
          const threatNum = threat.replace('threat', '');
          const emoji = threatEmojis[threat] || '🟢';
          
          const ownedInThreat = list.filter(m => profile.dex.monsters.includes(m.name));
          if (ownedInThreat.length > 0) {
            hasAny = true;
            const formatted = ownedInThreat.map(m => {
              const lvlObj = profile.monsterLevels[m.name] || { level: 1, xp: 0 };
              return `**${m.name}** [Lv.${lvlObj.level}]`;
            }).join(', ');
            descriptionLines += `${emoji} **Threat ${threatNum}**: ${formatted}\n`;
          }
        }

        if (!hasAny) {
          descriptionLines = '*No monsters tamed yet! Go hunt to tame some!*';
        }

        embed.setDescription(descriptionLines + `\nUse \`'m <monster_name>\` to view detailed info on any monster.`);
        return message.reply({ embeds: [embed] });
      }

      // View detailed info of a monster
      const queryStr = args.join(' ').toLowerCase();
      const monster = gameData.findMonsterByName(queryStr);
      if (!monster) {
        return message.reply(`❌ Monster **${args.join(' ')}** not found! Check spelling.`);
      }

      // If it is a basic (obtainable) monster, verify ownership is no longer blocked; we display 'Untamed' status.
      const isOwned = profile.dex.monsters.includes(monster.name);

      let curHp, curAtk, curDef;
      let lvlText = '';

      if (monster.tier !== 'basic') {
        lvlText = '`Unobtainable`';
        
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
        
        curHp = Math.floor(monster.hp * tierHpMult);
        curAtk = Math.floor(monster.atk * tierAtkMult);
        curDef = Math.floor(monster.def * tierDefMult);
      } else {
        const maxLvl = monster.name === 'Kirin' ? 30 : 20;
        const lvlObj = isOwned ? (profile.monsterLevels[monster.name] || { level: 1, xp: 0 }) : { level: 1, xp: 0 };
        const xpNeeded = lvlObj.level * 50;
        const progress = lvlObj.level >= maxLvl ? 100 : (lvlObj.xp / xpNeeded) * 100;
        const filled = Math.round(progress / 10);
        const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        
        if (!isOwned) {
          lvlText = '`Untamed`';
        } else {
          lvlText = `**Level ${lvlObj.level}/${maxLvl}**\n\`[${progressBar}]\` (${lvlObj.xp}/${xpNeeded} XP)${lvlObj.level >= maxLvl ? ' (MAX)' : ''}`;
        }
        
        const mult = 1 + (lvlObj.level - 1) * 0.05;
        curHp = Math.floor(monster.hp * mult);
        curAtk = Math.floor(monster.atk * mult);
        curDef = Math.floor(monster.def * mult);
      }

      const embed = new EmbedBuilder()
        .setTitle(`👾 Monster Profile: ${monster.displayName || monster.name}`)
        .setColor(
          monster.tier === 'beyond' ? '#1A0D3D' :
          monster.tier === 'prodigy' ? '#FF6B00' :
          monster.tier === 'chronicle' ? '#8A2BE2' :
          monster.tier === 'overpowered' ? '#FF5722' :
          monster.tier === 'blessed' ? '#FFEB3B' :
          monster.tier === 'enchanted' ? '#00BCD4' : '#4CAF50'
        )
        .setDescription(monster.desc || 'No description available.');

      embed.addFields(
        { name: '⭐ Level & XP', value: lvlText }
      );

      if (monster.name === 'Kirin') {
        const lvlObj = isOwned ? (profile.monsterLevels['Kirin'] || { level: 1, xp: 0, enchanted: 0 }) : { level: 1, xp: 0, enchanted: 0 };
        const level = lvlObj.level || 1;
        const enchanted = lvlObj.enchanted || 0;

        embed.addFields({
          name: '🛡️ Stats',
          value: `❤️ HP: **${curHp}** *(Base: ${monster.hp})*\n⚔️ ATK: **${curAtk}** *(Base: ${monster.atk})*\n🛡️ DEF: **${curDef}** *(Base: ${monster.def})*`,
          inline: false
        });

        const lvlPassives = [
          { req: 5, name: 'Celestial Fortune', desc: '+5% Crit Chance (CR)' },
          { req: 10, name: 'Celestial Shell', desc: '+10% DEF' },
          { req: 15, name: 'Celestial Horn', desc: '+10% ATK' },
          { req: 20, name: 'Celestial Aegis', desc: '+15% HP' },
          { req: 25, name: 'Celestial Insight', desc: '+15% PEN' },
          { req: 30, name: 'Celestial Zenith', desc: '+20% ATK, DEF, and HP' }
        ];

        let passiveText = '';
        for (const lp of lvlPassives) {
          const unlocked = level >= lp.req;
          const icon = unlocked ? '🔓' : '🔒';
          passiveText += `• ${icon} **[Lv. ${lp.req}] ${lp.name}**: ${lp.desc}\n`;
        }
        embed.addFields({ name: '✨ Passive Traits & Level Unlocks', value: passiveText, inline: false });

        const enchantPassives = [
          { req: 1, name: 'Spark of Light', desc: 'Implants True Damage (+50 per E) & Crit Chance (+5% per E).' },
          { req: 2, name: 'Radiant Aura', desc: 'Implants DOT (+100 per E-1) & Vulnerability (+10% per E-1), plus +20% Element Perfection boost.' },
          { req: 3, name: 'Shield Breaker', desc: 'Implants DEF Ignore (PEN, +10% per E-2) & True Damage (+100 per E-2).' },
          { req: 4, name: 'Pure Light', desc: 'Cleanses ATK debuffs and implants +20% ATK & +20% Crit Chance per E-3.' },
          { req: 5, name: 'Divine Will', desc: 'Implants Vulnerability (+15% per E-4) & PEN (+15% per E-4).' },
          { req: 6, name: 'Heavenly Decree', desc: 'Grants +50% ATK, +50% DEF, +150% Crit Damage, and reflects 50% of damage taken.' }
        ];

        const stars = '⭐'.repeat(enchanted) + '☆'.repeat(6 - enchanted);
        let enchantText = `\`[ ${stars} ]\` **(Enchanted ${enchanted}/6)**\n\n`;
        for (const ep of enchantPassives) {
          const unlocked = enchanted >= ep.req;
          const icon = unlocked ? '🔓' : '🔒';
          enchantText += `• ${icon} **[E${ep.req}] ${ep.name}**: ${ep.desc}\n`;
        }
        embed.addFields({ name: '🌀 Enchantment Progression', value: enchantText, inline: false });
      } else if (monster.tier !== 'basic') {
        let multStr = '';
        let tierHpMult = 1.0;
        let tierAtkMult = 1.0;
        let tierDefMult = 1.0;
        
        if (monster.tier === 'blessed') {
          tierHpMult = 1.5;
          tierAtkMult = 1.3;
          tierDefMult = 1.2;
          multStr = `HP: Base x 1.5\nATK: Base x 1.3\nDEF: Base x 1.2`;
        } else if (monster.tier === 'enchanted') {
          tierHpMult = 2.0;
          tierAtkMult = 1.6;
          tierDefMult = 1.3;
          multStr = `HP: Base x 2.0\nATK: Base x 1.6\nDEF: Base x 1.3`;
        } else if (monster.tier === 'overpowered') {
          tierHpMult = 3.0;
          tierAtkMult = 2.5;
          tierDefMult = 1.5;
          multStr = `HP: Base x 3.0\nATK: Base x 2.5\nDEF: Base x 1.5`;
        } else if (monster.tier === 'chronicle') {
          tierHpMult = 6.0;
          tierAtkMult = 15.0;
          tierDefMult = 8.0;
          multStr = `HP: Base x 6.0\nATK: Base x 15.0\nDEF: Base x 8.0`;
        } else if (monster.tier === 'prodigy') {
          tierHpMult = 15.0;
          tierAtkMult = 35.0;
          tierDefMult = 15.0;
          multStr = `HP: Base x 15.0\nATK: Base x 35.0\nDEF: Base x 15.0`;
        } else if (monster.tier === 'beyond') {
          tierHpMult = 30.0;
          tierAtkMult = 60.0;
          tierDefMult = 30.0;
          multStr = `HP: Base x 30.0\nATK: Base x 60.0\nDEF: Base x 30.0`;
        }
        
        embed.addFields(
          { name: '🛡️ Tier Stats', value: `❤️ HP: **${curHp}** *(Base: ${monster.hp})*\n⚔️ ATK: **${curAtk}** *(Base: ${monster.atk})*\n🛡️ DEF: **${curDef}** *(Base: ${monster.def})*\n\n*Tier scaling applied:*\n\`\`\`\n${multStr}\n\`\`\``, inline: true }
        );
        
        // Passive attributes
        let spawnRate = '70% ➜ 4% (Scales down with PS)';
        if (monster.tier === 'enchanted') spawnRate = '20% (Flat)';
        else if (monster.tier === 'blessed') spawnRate = '8% ➜ 25% (Scales up with PS)';
        else if (monster.tier === 'overpowered') spawnRate = '2% ➜ 25% (Scales up with PS)';
        else if (monster.tier === 'chronicle') spawnRate = '0% ➜ 12% (Scales up with PS)';
        else if (monster.tier === 'prodigy') spawnRate = '0% ➜ 6% (Scales up with PS)';
        else if (monster.tier === 'beyond') spawnRate = '0% ➜ 2% (Scales up with PS)';

        let passiveValue = `• **Spawn Rate:** \`${spawnRate}\` (Wild only)\n`;
        if (monster.tier === 'overpowered') {
          passiveValue += `• **🔥 Dread Presence:**\n  └ **Regen**: Regens 3% Max HP per turn.\n  └ **Enrage**: ATK +5% base per turn.\n  └ **Dread Presence**: Player ATK -20%.\n  └ **Max Turns**: 20 rounds.`;
        } else if (monster.tier === 'chronicle') {
          passiveValue += `• **📖 Awakened Memory:**\n  └ **Regen**: Regens 2% Max HP per turn.\n  └ **Awakened Memory**: Player ATK -20%.\n  └ **Stun Immune**: Cannot be stunned.\n  └ **Max Turns**: 15 rounds.\n  └ **Rewards**: XP x4, Gold x4, +5 Hunt Marks.`;
        } else if (monster.tier === 'prodigy') {
          passiveValue += `• **⚡ Transcended Form:**\n  └ **Regen**: Regens 3% Max HP per turn.\n  └ **Enrage**: ATK +5% base per turn.\n  └ **Transcended Form**: Player ATK -20%.\n  └ **Stun Immune**: Cannot be stunned.\n  └ **Max Turns**: 20 rounds.\n  └ **Rewards**: XP x7, Gold x7, +10 Hunt Marks.`;
        } else if (monster.tier === 'beyond') {
          passiveValue += `• **💀 Existential Terror:**\n  └ **Regen**: Regens 5% Max HP per turn.\n  └ **Surge**: ATK +8% base per turn.\n  └ **Existential Terror**: Player ATK -30%.\n  └ **Stun Immune**: Cannot be stunned.\n  └ **Max Turns**: 25 rounds.\n  └ **Rewards**: XP x12, Gold x12, +20 Hunt Marks.`;
        } else if (monster.tier === 'blessed') {
          passiveValue += `• **Blessed Status**: Stat multipliers active.`;
        } else if (monster.tier === 'enchanted') {
          passiveValue += `• **Enchanted Status**: Attack multiplier active.`;
        }

        passiveValue += `\n\n• **Base Trait**: **${monster.passiveName || 'None'}**\n  ${monster.passiveDesc || 'No passive.'}`;

        embed.addFields(
          { name: '✨ Tier Attributes & Passive', value: passiveValue, inline: true }
        );
      } else {
        embed.addFields(
          { name: '🛡️ Stats', value: `❤️ HP: **${curHp}** *(Base: ${monster.hp})*\n⚔️ ATK: **${curAtk}** *(Base: ${monster.atk})*\n🛡️ DEF: **${curDef}** *(Base: ${monster.def})*`, inline: true },
          { name: '✨ Passive Trait', value: `**${monster.passiveName || 'None'}**\n${monster.passiveDesc || 'No passive.'}`, inline: true }
        );
      }

      embed.setFooter({ text: `Threat Level: ${monster.threat.replace('threat', '')}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Command Monster Info Error]', err);
      return message.reply('❌ Failed to retrieve monster details.');
    }
  }

  // COMMAND: WEAPON LIST / DETAIL ('w' / 'weapon')
  if (command === 'w' || command === 'weapon') {
    try {
      const profile = await firebase.getUser(userId);
      const newlyUnlocked = checkAndUnlockKirin(profile);
      if (newlyUnlocked) {
        await firebase.saveUser(userId, profile);
      }
      profile.weaponLevels = profile.weaponLevels || {};
      const ownedWeaponsList = getOwnedWeaponsList(profile, message.member);

      if (args.length === 0) {
        // List owned weapons
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ Collected Weapons (${ownedWeaponsList.length})`)
          .setColor('#FF9800');

        const rarityEmojis = {
          basic: '⚪',
          usual: '🟢',
          unusual: '🔵',
          odd: '🟣',
          exotic: '🟡',
          mythic: '🟠',
          supreme: '🔴',
          secret: '✨'
        };

        let descriptionLines = '';
        let hasAny = false;

        for (const rarity in gameData.WEAPONS) {
          const list = gameData.WEAPONS[rarity];
          const emoji = rarityEmojis[rarity] || '⚪';
          
          const ownedInRarity = list.filter(w => ownedWeaponsList.includes(w.name));
          if (ownedInRarity.length > 0) {
            hasAny = true;
            const formatted = ownedInRarity.map(w => {
              const lvlObj = profile.weaponLevels[w.name] || { level: 1, xp: 0 };
              const categoryTag = w.category === 'dps' ? '[DPS]' : '[Support]';
              return `**${w.name}** [Lv.${lvlObj.level}] *${categoryTag}*`;
            }).join(', ');
            descriptionLines += `${emoji} **${rarity.toUpperCase()}**: ${formatted}\n`;
          }
        }

        if (!hasAny) {
          descriptionLines = '*No weapons owned yet! Open loot boxes to obtain some!*';
        }

        embed.setDescription(descriptionLines + `\nUse \`'w <weapon_name>\` to view detailed info on any weapon.`);
        return message.reply({ embeds: [embed] });
      }

      // View detailed info of a weapon
      const queryStr = args.join(' ').toLowerCase();
      const weapon = gameData.findWeaponByName(queryStr);
      if (!weapon) {
        return message.reply(`❌ Weapon **${args.join(' ')}** not found! Check spelling.`);
      }

      const isOwned = ownedWeaponsList.includes(weapon.name);
      
      let lvlText;
      let typeText;
      let level = 1;
      const categoryLabel = weapon.category === 'dps' ? 'DPS' : 'Support';
      
      if (!isOwned) {
        lvlText = 'Unobtainable';
        typeText = `**${categoryLabel}** (Unobtainable)`;
      } else {
        const lvlObj = profile.weaponLevels[weapon.name] || { level: 1, xp: 0 };
        level = lvlObj.level;
        const xpNeeded = level * 50;
        const progress = level >= 30 ? 100 : (lvlObj.xp / xpNeeded) * 100;
        const filled = Math.round(progress / 10);
        const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        lvlText = `**Level ${level}/30**\n\`[${progressBar}]\` (${lvlObj.xp}/${xpNeeded} XP)${level >= 30 ? ' (MAX)' : ''}`;
        typeText = `**${categoryLabel}** (Equip on: ${weapon.category === 'dps' ? 'On-Field' : 'Off-Field'})`;
      }

      // Stats calculation at current level (+5% per level above 1)
      const mult = 1 + (level - 1) * 0.05;
      const scaledAtk = Math.floor((weapon.atkBonus || 0) * mult);
      const scaledDef = Math.floor((weapon.defBonus || 0) * mult);
      const scaledHp = Math.floor((weapon.hpBonus || 0) * mult);
      const scaledHeal = Math.floor((weapon.healAmount || 0) * mult);

      // Passive description dynamically resolved
      const passiveText = gameData.getWeaponPassiveDescription(weapon.name, level);

      const forgeLvl = isOwned ? (profile.weaponLevels[weapon.name]?.forge || 0) : 0;
      const forgeText = getForgeProgressionText(weapon, forgeLvl);

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Weapon Profile: ${weapon.name}`)
        .setColor('#FF9800')
        .addFields(
          { name: '⭐ Level & XP', value: lvlText },
          { name: '🏷️ Weapon Type', value: typeText, inline: true },
          { name: '🪙 Value', value: `Base Sell: **${weapon.sellValue}**g`, inline: true },
          { 
            name: '🛡️ Stats', 
            value: `⚔️ ATK: **${scaledAtk}** *(Base: ${weapon.atkBonus || 0})*\n🛡️ DEF: **${scaledDef}** *(Base: ${weapon.defBonus || 0})*\n❤️ HP: **${scaledHp}** *(Base: ${weapon.hpBonus || 0})*${weapon.healAmount > 0 ? `\n🪄 HEAL: **+${scaledHeal}** HP/rd *(Base: +${weapon.healAmount})*` : ''}`, 
            inline: false 
          },
          { name: '✨ Passive Effect', value: passiveText, inline: false },
          { name: '🔨 Forge Progression', value: forgeText, inline: false }
        )
        .setFooter({ text: `Rarity: ${weapon.rarity.toUpperCase()}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('[Command Weapon Info Error]', err);
      return message.reply('❌ Failed to retrieve weapon details.');
    }
  }

  // COMMAND: TEAM ('t / 'team)
  if (command === 't' || command === 'team') {
    if (args.length === 0) {
      return showTeamView(message, userId);
    }

    const action = args[0].toLowerCase();

    try {
      const profile = await firebase.getUser(userId);

      // Subcommand: team set [1-3]
      if (action === 'set' || action === 'select' || action === 's') {
        const teamNum = parseInt(args[1], 10);
        if (isNaN(teamNum) || teamNum < 1 || teamNum > 3) {
          return message.reply('❌ Invalid team index. Please choose between 1 and 3.');
        }

        profile.activeTeamIndex = teamNum - 1;
        await firebase.saveUser(userId, profile);
        return message.reply(`✅ Successfully selected **Team ${teamNum}** as your active team!`);
      }

      // Subcommand: team view
      if (action === 'view' || action === 'v') {
        return showTeamView(message, userId);
      }

      // Subcommand: team clear [1-3]
      if (action === 'clear') {
        const teamNum = parseInt(args[1], 10);
        if (isNaN(teamNum) || teamNum < 1 || teamNum > 3) {
          return message.reply('❌ Invalid team index. Please choose between 1 and 3.');
        }

        profile.teams[teamNum - 1] = {
          onfield: { monster: null, weapon: null },
          offfield1: { monster: null, weapon: null },
          offfield2: { monster: null, weapon: null }
        };
        await firebase.saveUser(userId, profile);
        return message.reply(`🧹 Cleared all configuration details for **Team ${teamNum}**.`);
      }

      // Subcommand: team rename [new_name] or [1-3] [new_name]
      if (action === 'rename') {
        if (args.length < 2) {
          return message.reply(`❌ Usage: \`'team rename [new_name]\` to rename the active team, or \`'team rename [1-3] [new_name]\`.`);
        }
        let targetTeamIdx = profile.activeTeamIndex;
        let newName = args.slice(1).join(' ').trim();
        
        // Check if first argument after rename is a number 1-3
        const firstArgNum = parseInt(args[1], 10);
        if (!isNaN(firstArgNum) && firstArgNum >= 1 && firstArgNum <= 3) {
          targetTeamIdx = firstArgNum - 1;
          newName = args.slice(2).join(' ').trim();
        }

        if (!newName) {
          return message.reply(`❌ Please specify a new name for the team.`);
        }
        if (newName.length > 32) {
          return message.reply(`❌ Team name is too long (maximum 32 characters).`);
        }

        profile.teams[targetTeamIdx].name = newName;
        await firebase.saveUser(userId, profile);
        return message.reply(`✅ Successfully renamed **Team ${targetTeamIdx + 1}** to **${newName}**!`);
      }

      return message.reply(`📋 **Team Commands Usage:**\n• \`'team view\` - View all teams\n• \`'team set <1-3>\` - Switch active team\n• \`'team clear <1-3>\` - Clear team equipment\n• \`'team rename [1-3] [name]\` - Rename a team`);

    } catch (err) {
      console.error('[Command Team Error]', err);
      return message.reply('❌ Failed to update team configuration.');
    }
  }

  // COMMAND: THREAT ('th / 'threat)
  if (command === 'th' || command === 'threat') {
    try {
      if (args.length === 0) {
        return message.reply(`📋 **Lobby Threat Commands Usage:**\n• \`${effectivePrefix}th up\` - Upgrade Lobby Threat (Costs 5 Elemental Stones)\n• \`${effectivePrefix}th down\` - Downgrade Lobby Threat (Free)`);
      }

      const subCommand = args[0].toLowerCase();
      const profile = await firebase.getUser(userId);

      if (subCommand === 'up') {
        if ((profile.elementalStones || 0) < 5) {
          return message.reply(`❌ You do not have enough Elemental Stones! Upgrading lobby threat costs **5 Elemental Stones** (You have: ${profile.elementalStones || 0}).`);
        }

        const currentOffset = profile.lobbyThreatOffset || 0;
        if (currentOffset >= 10) {
          return message.reply(`❌ Your lobby threat level is already at the maximum bonus of **+10**!`);
        }

        profile.elementalStones -= 5;
        profile.lobbyThreatOffset = currentOffset + 1;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`⚡ Lobby Threat Upgraded!`)
          .setColor('#FF9800')
          .setDescription(`You consumed **5 Elemental Stones** to upgrade your lobby threat level!`)
          .addFields(
            { name: 'Lobby Threat Level', value: `✨ **+${profile.lobbyThreatOffset}**`, inline: true },
            { name: 'Remaining Stones', value: `💎 **${profile.elementalStones}**`, inline: true }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else if (subCommand === 'down') {
        const currentOffset = profile.lobbyThreatOffset || 0;
        if (currentOffset <= -10) {
          return message.reply(`❌ Your lobby threat level is already at the minimum deduction of **-10**!`);
        }

        profile.lobbyThreatOffset = currentOffset - 1;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ Lobby Threat Downgraded!`)
          .setColor('#2196F3')
          .setDescription(`Your lobby threat level has been downgraded for free!`)
          .addFields(
            { name: 'Lobby Threat Level', value: `✨ **${profile.lobbyThreatOffset >= 0 ? '+' : ''}${profile.lobbyThreatOffset}**`, inline: true }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else {
        return message.reply(`❌ Invalid sub-command. Did you mean: \`${effectivePrefix}th up\` or \`${effectivePrefix}th down\`?`);
      }

    } catch (err) {
      console.error('[Command Threat Error]', err);
      return message.reply('❌ Failed to update lobby threat level.');
    }
  }

  // COMMAND: VOICE UPGRADES ('voice)
  if (command === 'voice') {
    try {
      const profile = await firebase.getUser(userId);
      
      const getEmbed = (prof) => {
        const vhLvl = prof.voiceHuntLevel || 1;
        const vlLvl = prof.voiceLootLevel || 1;
        const vhTime = formatVoiceInterval(getVoiceHuntCooldown(vhLvl));
        const vlTime = formatVoiceInterval(getVoiceLootCooldown(vlLvl));
        
        const nextVhLvl = vhLvl < 10 ? vhLvl + 1 : 'MAX';
        const nextVlLvl = vlLvl < 10 ? vlLvl + 1 : 'MAX';
        const nextVhTime = vhLvl < 10 ? formatVoiceInterval(getVoiceHuntCooldown(vhLvl + 1)) : 'MAX';
        const nextVlTime = vlLvl < 10 ? formatVoiceInterval(getVoiceLootCooldown(vlLvl + 1)) : 'MAX';
        
        const vhCost = getVoiceUpgradeCost(vhLvl);
        const vlCost = getVoiceUpgradeCost(vlLvl);
        
        return new EmbedBuilder()
          .setTitle('🔊 Voice Channel Idle Upgrades')
          .setColor('#00E676')
          .setDescription('Earn rewards passively by sitting in voice channels. Upgrade your Voice Hunt and Voice Loot frequencies to get logs much faster!')
          .addFields(
            { 
              name: '⚔️ Voice Hunt (Auto Hunt)', 
              value: `• **Current Level**: Level ${vhLvl}/10\n• **Interval**: Every **${vhTime}**\n• **Next Level**: Level ${nextVhLvl} (Every **${nextVhTime}**)\n• **Upgrade Cost**: ${vhCost ? `💎 **${vhCost} Elemental Stones**` : '`MAX`'}`, 
              inline: false 
            },
            { 
              name: '🎁 Voice Loot (Auto Loot)', 
              value: `• **Current Level**: Level ${vlLvl}/10\n• **Interval**: Every **${vlTime}**\n• **Next Level**: Level ${nextVlLvl} (Every **${nextVlTime}**)\n• **Upgrade Cost**: ${vlCost ? `💎 **${vlCost} Elemental Stones**` : '`MAX`'}`, 
              inline: false 
            }
          )
          .setTimestamp();
      };
      
      const getComponents = (prof) => {
        const stones = prof.elementalStones || 0;
        const vhLvl = prof.voiceHuntLevel || 1;
        const vlLvl = prof.voiceLootLevel || 1;
        
        const vhCost = getVoiceUpgradeCost(vhLvl);
        const vlCost = getVoiceUpgradeCost(vlLvl);
        
        const stoneBtn = new ButtonBuilder()
          .setCustomId('voice_stone_display')
          .setLabel(`💎 Stones: ${stones}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);
          
        const upHuntBtn = new ButtonBuilder()
          .setCustomId(`voice_up_hunt_${userId}`)
          .setLabel(vhCost ? `Up Hunt (Costs ${vhCost})` : 'Hunt MAX')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!vhCost || stones < vhCost);
          
        const upLootBtn = new ButtonBuilder()
          .setCustomId(`voice_up_loot_${userId}`)
          .setLabel(vlCost ? `Up Loot (Costs ${vlCost})` : 'Loot MAX')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!vlCost || stones < vlCost);
          
        return new ActionRowBuilder().addComponents(stoneBtn, upHuntBtn, upLootBtn);
      };
      
      const sentMessage = await message.reply({ embeds: [getEmbed(profile)], components: [getComponents(profile)] });
      
      const filter = (i) => i.user.id === userId && (i.customId === `voice_up_hunt_${userId}` || i.customId === `voice_up_loot_${userId}`);
      const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });
      
      collector.on('collect', async (i) => {
        try {
          const p = await firebase.getUser(userId);
          const stones = p.elementalStones || 0;
          
          if (i.customId === `voice_up_hunt_${userId}`) {
            const vhLvl = p.voiceHuntLevel || 1;
            const cost = getVoiceUpgradeCost(vhLvl);
            if (cost && stones >= cost) {
              p.elementalStones -= cost;
              p.voiceHuntLevel = vhLvl + 1;
              await firebase.saveUser(userId, p);
              await i.reply({ content: `✅ Voice Hunt successfully upgraded to **Level ${p.voiceHuntLevel}**!`, ephemeral: true }).catch(() => {});
            } else {
              await i.reply({ content: `❌ You do not have enough Elemental Stones.`, ephemeral: true }).catch(() => {});
            }
          } else if (i.customId === `voice_up_loot_${userId}`) {
            const vlLvl = p.voiceLootLevel || 1;
            const cost = getVoiceUpgradeCost(vlLvl);
            if (cost && stones >= cost) {
              p.elementalStones -= cost;
              p.voiceLootLevel = vlLvl + 1;
              await firebase.saveUser(userId, p);
              await i.reply({ content: `✅ Voice Loot successfully upgraded to **Level ${p.voiceLootLevel}**!`, ephemeral: true }).catch(() => {});
            } else {
              await i.reply({ content: `❌ You do not have enough Elemental Stones.`, ephemeral: true }).catch(() => {});
            }
          }
          
          const updatedProfile = await firebase.getUser(userId);
          await sentMessage.edit({ embeds: [getEmbed(updatedProfile)], components: [getComponents(updatedProfile)] }).catch(() => {});
        } catch (err) {
          console.error('[Voice Up Collector Error]', err);
        }
      });
      
      collector.on('end', () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('voice_stone_display_d').setLabel(`💎 Stones: ${profile.elementalStones || 0}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('voice_up_hunt_d').setLabel('Up Hunt').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('voice_up_loot_d').setLabel('Up Loot').setStyle(ButtonStyle.Primary).setDisabled(true)
        );
        sentMessage.edit({ components: [disabledRow] }).catch(() => {});
      });
    } catch (err) {
      console.error('[Command Voice Error]', err);
      return message.reply('❌ Failed to access Voice system upgrades.');
    }
  }

  // COMMAND: GIVE GOLD ('give)
  if (command === 'give') {
    try {
      if (args.length < 2) {
        return message.reply(`🪙 **Give Gold Command Usage:**\n• \`${effectivePrefix}give @User [amount]\`\n• \`${effectivePrefix}give [User ID] [amount]\``);
      }

      const authorId = userId;
      let targetUser = message.source.mentions ? message.source.mentions.users.first() : null;
      let targetId = targetUser ? targetUser.id : args[0];
      
      targetId = targetId.replace(/[<@!>]/g, '');

      if (targetId === authorId) {
        return message.reply(`❌ You cannot give Gold to yourself!`);
      }

      const amount = parseGoldAmount(args[1]);
      if (isNaN(amount) || amount <= 0) {
        return message.reply(`❌ Please specify a valid amount of Gold to give.`);
      }

      const senderProfile = await firebase.getUser(authorId);
      if ((senderProfile.currency || 0) < amount) {
        return message.reply(`❌ You do not have enough Gold! You currently have: **${(senderProfile.currency || 0).toLocaleString('id-ID')}** Gold.`);
      }

      let receiverProfile;
      try {
        receiverProfile = await firebase.getUser(targetId);
      } catch (err) {
        return message.reply(`❌ Could not find a player profile with the ID **${targetId}**.`);
      }

      if (!receiverProfile) {
        return message.reply(`❌ The target user does not have an active RPG profile yet.`);
      }

      const isSenderWhitelisted = ['661135501226672129', '735711123978059826'].includes(authorId);
      if (receiverProfile.giftBlockedUntil && Date.now() < receiverProfile.giftBlockedUntil && !isSenderWhitelisted) {
        const remainingMs = receiverProfile.giftBlockedUntil - Date.now();
        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        return message.reply(`❌ This user is currently blocked from receiving gifts for another **${minutes}m ${seconds}s** after losing a slots all-in bet!`);
      }

      senderProfile.currency = (senderProfile.currency || 0) - amount;
      receiverProfile.currency = (receiverProfile.currency || 0) + amount;

      await firebase.saveUser(authorId, senderProfile);
      await firebase.saveUser(targetId, receiverProfile);

      return message.reply(`🪙 **Transaction Successful!**\n✅ You gave **${amount.toLocaleString('id-ID')}** Gold to <@${targetId}>.`);

    } catch (err) {
      console.error('[Command Give Error]', err);
      return message.reply('❌ Transaction failed.');
    }
  }

  // COMMAND: BET ('bet)
  if (command === 'bet') {
    try {
      if (args.length < 2) {
        return message.reply(`🎲 **Dice Bet Command Usage:**\n• \`${effectivePrefix}bet @player [amount]\`\n• \`${effectivePrefix}bet [Player ID] [amount]\``);
      }

      const authorId = userId;
      
      // Parse arguments: flexible ordering to accommodate bet @player [amount] and bet [amount] @player
      const cleanArg0 = args[0].replace(/[<@!>]/g, '');
      const cleanArg1 = args[1].replace(/[<@!>]/g, '');

      let targetId = null;
      let amountInput = null;

      // Match target ID: a string of 17-20 digits or starting with '<@'
      const isArg0MentionOrId = /^\d{17,20}$/.test(cleanArg0) || args[0].startsWith('<@');
      const isArg1MentionOrId = /^\d{17,20}$/.test(cleanArg1) || args[1].startsWith('<@');

      if (isArg0MentionOrId) {
        targetId = cleanArg0;
        amountInput = args[1];
      } else if (isArg1MentionOrId) {
        targetId = cleanArg1;
        amountInput = args[0];
      } else {
        return message.reply(`❌ Invalid arguments. Please specify a player (mention or ID) and a valid bet amount.`);
      }

      // Validate amount
      const amount = parseGoldAmount(amountInput);
      if (isNaN(amount) || amount <= 0) {
        return message.reply(`❌ Please specify a valid positive amount of Gold to bet.`);
      }

      // Maximum limit check
      const MAX_BET = 10000000000; // 10 Billion
      if (amount > MAX_BET) {
        return message.reply(`❌ Maximum bet amount is **10.000.000.000 Gold** (10B)!`);
      }

      // Check self-betting
      if (targetId === authorId) {
        return message.reply(`❌ You cannot challenge yourself to a dice bet!`);
      }

      // Fetch profiles
      const senderProfile = await firebase.getUser(authorId);
      if ((senderProfile.currency || 0) < amount) {
        return message.reply(`❌ You do not have enough Gold! You currently have: **${(senderProfile.currency || 0).toLocaleString('id-ID')}** Gold.`);
      }

      let receiverProfile;
      try {
        receiverProfile = await firebase.getUser(targetId);
      } catch (err) {
        return message.reply(`❌ Could not find a player profile with the ID **${targetId}**.`);
      }

      if (!receiverProfile) {
        return message.reply(`❌ The challenged player does not have an active RPG profile yet.`);
      }

      if ((receiverProfile.currency || 0) < amount) {
        return message.reply(`❌ <@${targetId}> does not have enough Gold to accept this bet! They only have **${(receiverProfile.currency || 0).toLocaleString('id-ID')}** Gold.`);
      }

      // Check cooldown for the challenger
      const cooldownKey = `${userId}-gamble`;
      const now = Date.now();
      if (cooldowns.has(cooldownKey)) {
        const expiration = cooldowns.get(cooldownKey) + 10000;
        if (now < expiration) {
          const remaining = ((expiration - now) / 1000).toFixed(1);
          return message.reply(`⏳ Please wait **${remaining}s** before gambling again.`);
        }
      }
      
      // All validations passed! Set cooldown
      cooldowns.set(cooldownKey, now);

      // Set unique custom IDs for the buttons to prevent collision
      const acceptId = `dice_bet_accept_${authorId}_${targetId}_${Date.now()}`;
      const declineId = `dice_bet_decline_${authorId}_${targetId}_${Date.now()}`;

      const embed = new EmbedBuilder()
        .setTitle('🎲 Dice Bet Challenge!')
        .setColor('#9C27B0')
        .setDescription(`<@${authorId}> has challenged <@${targetId}> to a dice bet of **${amount.toLocaleString('id-ID')}** Gold!\nBoth players will roll a 1-6 dice, and the highest roll wins the total pot of **${(amount * 2).toLocaleString('id-ID')}** Gold!\n\n**Admin (Dealer)** is waiting at the table...\n\n<@${targetId}>, do you accept this challenge?`)
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(acceptId)
            .setLabel('Accept Bet ✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(declineId)
            .setLabel('Decline ❌')
            .setStyle(ButtonStyle.Danger)
        );

      const sentMsg = await message.reply({ embeds: [embed], components: [row] });

      const filter = (i) => i.user.id === targetId && (i.customId === acceptId || i.customId === declineId);
      const collector = sentMsg.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async (i) => {
        try {
          if (i.customId === declineId) {
            collector.stop('declined');
            return;
          }

          if (i.customId === acceptId) {
            // Defer update to allow database logic
            await i.deferUpdate();

            // Fetch profiles again to ensure no double-spending
            const p1 = await firebase.getUser(authorId);
            const p2 = await firebase.getUser(targetId);

            if ((p1.currency || 0) < amount) {
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('db_acc_dis').setLabel('Accept').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('db_dec_dis').setLabel('Decline').setStyle(ButtonStyle.Secondary).setDisabled(true)
              );
              await sentMsg.edit({ content: `❌ Bet cancelled: <@${authorId}> no longer has enough Gold.`, embeds: [], components: [disabledRow] });
              collector.stop('insufficient_funds');
              return;
            }

            if ((p2.currency || 0) < amount) {
              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('db_acc_dis').setLabel('Accept').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('db_dec_dis').setLabel('Decline').setStyle(ButtonStyle.Secondary).setDisabled(true)
              );
              await sentMsg.edit({ content: `❌ Bet cancelled: <@${targetId}> does not have enough Gold.`, embeds: [], components: [disabledRow] });
              collector.stop('insufficient_funds');
              return;
            }

            // Deduct from both
            p1.currency = (p1.currency || 0) - amount;
            p2.currency = (p2.currency || 0) - amount;

            await firebase.saveUser(authorId, p1);
            await firebase.saveUser(targetId, p2);

            // Roll Dice
            const r1 = Math.floor(Math.random() * 6) + 1;
            const r2 = Math.floor(Math.random() * 6) + 1;

            const diceEmojis = {
              1: '⚀',
              2: '⚁',
              3: '⚂',
              4: '⚃',
              5: '⚄',
              6: '⚅'
            };

            const diceStr1 = `${diceEmojis[r1]} **${r1}**`;
            const diceStr2 = `${diceEmojis[r2]} **${r2}**`;

            let resultTitle = '🎲 Dice Bet Result';
            let resultColor = '#4CAF50';
            let resultDesc = `**Admin (Dealer)** rolls the dice at the table! 🎲\n\n👤 <@${authorId}> gets: ${diceStr1}\n👤 <@${targetId}> gets: ${diceStr2}\n\n`;

            if (r1 > r2) {
              // Player 1 wins
              const updatedP1 = await firebase.getUser(authorId);
              updatedP1.currency = (updatedP1.currency || 0) + (amount * 2);
              await firebase.saveUser(authorId, updatedP1);

              resultDesc += `🎉 **<@${authorId}> WINS!**\nReward: **+${(amount * 2).toLocaleString('id-ID')}** Gold`;
            } else if (r2 > r1) {
              // Player 2 wins
              const updatedP2 = await firebase.getUser(targetId);
              updatedP2.currency = (updatedP2.currency || 0) + (amount * 2);
              await firebase.saveUser(targetId, updatedP2);

              resultDesc += `🎉 **<@${targetId}> WINS!**\nReward: **+${(amount * 2).toLocaleString('id-ID')}** Gold`;
            } else {
              // Draw: refund
              const updatedP1 = await firebase.getUser(authorId);
              const updatedP2 = await firebase.getUser(targetId);

              updatedP1.currency = (updatedP1.currency || 0) + amount;
              updatedP2.currency = (updatedP2.currency || 0) + amount;

              await firebase.saveUser(authorId, updatedP1);
              await firebase.saveUser(targetId, updatedP2);

              resultTitle = '🎲 Dice Bet Result (Draw)';
              resultColor = '#FF9800';
              resultDesc += `🤝 **It's a DRAW!**\nBets have been fully refunded back to both players.`;
            }

            const resultEmbed = new EmbedBuilder()
              .setTitle(resultTitle)
              .setColor(resultColor)
              .setDescription(resultDesc)
              .setTimestamp();

            await sentMsg.edit({ embeds: [resultEmbed], components: [] });
            collector.stop('completed');
          }
        } catch (err) {
          console.error('[Dice Bet Collector Error]', err);
          await sentMsg.edit({ content: '❌ An error occurred while processing the bet.', components: [] }).catch(() => {});
          collector.stop('error');
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'completed' || reason === 'insufficient_funds' || reason === 'error') return;

        // Disable buttons on decline or timeout
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(acceptId)
              .setLabel('Accept Bet')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(declineId)
              .setLabel('Decline')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

        if (reason === 'declined') {
          const declinedEmbed = new EmbedBuilder()
            .setTitle('🎲 Dice Bet Declined')
            .setColor('#F44336')
            .setDescription(`❌ <@${targetId}> declined the challenge from <@${authorId}>.`)
            .setTimestamp();
          await sentMsg.edit({ embeds: [declinedEmbed], components: [disabledRow] }).catch(() => {});
        } else {
          // Timeout
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('🎲 Dice Bet Expired')
            .setColor('#757575')
            .setDescription(`⏳ The bet challenge from <@${authorId}> to <@${targetId}> has expired (no response within 60s).`)
            .setTimestamp();
          await sentMsg.edit({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => {});
        }
      });

    } catch (err) {
      console.error('[Dice Bet Command Error]', err);
      return message.reply('❌ Failed to process dice bet challenge.');
    }
  }

  // COMMAND: RESET GOLD ('reset)
  if (command === 'reset') {
    try {
      const isDeveloper = ['661135501226672129', '735711123978059826'].includes(userId);
      if (!isDeveloper) {
        return message.reply('❌ You do not have permission to use this command!');
      }

      const authorId = userId;
      let targetId = authorId;
      let amountInput = null;

      if (args.length === 1) {
        amountInput = args[0];
      } else if (args.length >= 2) {
        const cleanArg0 = args[0].replace(/[<@!>]/g, '');
        const cleanArg1 = args[1].replace(/[<@!>]/g, '');

        const isArg0MentionOrId = /^\d{17,20}$/.test(cleanArg0) || args[0].startsWith('<@');
        const isArg1MentionOrId = /^\d{17,20}$/.test(cleanArg1) || args[1].startsWith('<@');

        if (isArg0MentionOrId) {
          targetId = cleanArg0;
          amountInput = args[1];
        } else if (isArg1MentionOrId) {
          targetId = cleanArg1;
          amountInput = args[0];
        } else {
          amountInput = args[0];
        }
      } else {
        return message.reply(`🪙 **Reset Gold Command Usage:**\n• \`${effectivePrefix}reset [amount]\` (for yourself)\n• \`${effectivePrefix}reset @User [amount]\`\n• \`${effectivePrefix}reset [User ID] [amount]\``);
      }

      const amount = parseGoldAmount(amountInput);
      if (isNaN(amount) || amount < 0) {
        return message.reply(`❌ Please specify a valid non-negative amount of Gold to reset to.`);
      }

      let targetProfile;
      try {
        targetProfile = await firebase.getUser(targetId);
      } catch (err) {
        return message.reply(`❌ Could not find a player profile with the ID **${targetId}**.`);
      }

      if (!targetProfile) {
        return message.reply(`❌ The target user does not have an active RPG profile yet.`);
      }

      const oldGold = targetProfile.currency || 0;
      targetProfile.currency = amount;
      await firebase.saveUser(targetId, targetProfile);

      return message.reply(`🪙 **Gold Reset Successful!**\n✅ <@${targetId}>'s gold balance has been reset from **${oldGold.toLocaleString('id-ID')}** to **${amount.toLocaleString('id-ID')}**.`);

    } catch (err) {
      console.error('[Command Reset Error]', err);
      return message.reply('❌ Failed to reset gold.');
    }
  }

  // COMMAND: REMOVE GOLD ('remove)
  if (command === 'remove') {
    try {
      const isDeveloper = ['661135501226672129', '735711123978059826'].includes(userId);
      if (!isDeveloper) {
        return message.reply('❌ You do not have permission to use this command!');
      }

      const authorId = userId;
      let targetId = authorId;
      let amountInput = null;

      if (args.length === 1) {
        amountInput = args[0];
      } else if (args.length >= 2) {
        const cleanArg0 = args[0].replace(/[<@!>]/g, '');
        const cleanArg1 = args[1].replace(/[<@!>]/g, '');

        const isArg0MentionOrId = /^\d{17,20}$/.test(cleanArg0) || args[0].startsWith('<@');
        const isArg1MentionOrId = /^\d{17,20}$/.test(cleanArg1) || args[1].startsWith('<@');

        if (isArg0MentionOrId) {
          targetId = cleanArg0;
          amountInput = args[1];
        } else if (isArg1MentionOrId) {
          targetId = cleanArg1;
          amountInput = args[0];
        } else {
          amountInput = args[0];
        }
      } else {
        return message.reply(`🪙 **Remove Gold Command Usage:**\n• \`${effectivePrefix}remove [amount]\` (for yourself)\n• \`${effectivePrefix}remove @User [amount]\`\n• \`${effectivePrefix}remove [User ID] [amount]\``);
      }

      const amount = parseGoldAmount(amountInput);
      if (isNaN(amount) || amount <= 0) {
        return message.reply(`❌ Please specify a valid positive amount of Gold to remove.`);
      }

      let targetProfile;
      try {
        targetProfile = await firebase.getUser(targetId);
      } catch (err) {
        return message.reply(`❌ Could not find a player profile with the ID **${targetId}**.`);
      }

      if (!targetProfile) {
        return message.reply(`❌ The target user does not have an active RPG profile yet.`);
      }

      const oldGold = targetProfile.currency || 0;
      const newGold = Math.max(0, oldGold - amount);
      targetProfile.currency = newGold;
      await firebase.saveUser(targetId, targetProfile);

      return message.reply(`🪙 **Gold Removed Successfully!**\n✅ Removed **${amount.toLocaleString('id-ID')}** Gold from <@${targetId}>.\n• Previous balance: **${oldGold.toLocaleString('id-ID')}**\n• New balance: **${newGold.toLocaleString('id-ID')}**`);

    } catch (err) {
      console.error('[Command Remove Error]', err);
      return message.reply('❌ Failed to remove gold.');
    }
  }

  // COMMAND: BEYOND SYSTEM ('by)
  if (command === 'by') {
    try {
      if (args.length === 0) {
        return message.reply(`📋 **Beyond Commands Usage:**\n• \`${effectivePrefix}by info\` - Check Beyond Threat Level status and TX Kirin stats\n• \`${effectivePrefix}by up\` - Upgrade Beyond Threat Level (+1, costs 300 Elemental Stones)\n• \`${effectivePrefix}by down\` - Downgrade Beyond Threat Level (-1, free)`);
      }

      const subCommand = args[0].toLowerCase();
      const profile = await firebase.getUser(userId);

      if (subCommand === 'info') {
        const byLevel = profile.beyondLevel || 0;
        const elementalStones = profile.elementalStones || 0;
        const hasUnlocked = !!profile.killedBeyondT6;
        
        const embed = new EmbedBuilder()
          .setTitle(`🌌 Beyond Threat Level Info`)
          .setColor('#9C27B0')
          .setDescription(`Defeat Beyond T6 monsters to unlock access to the infinite-scaling TX Kirin. Raise your Beyond Threat Level to increase Kirin's stats and rewards!`)
          .addFields(
            { name: 'Prerequisite (Killed Beyond T6)', value: hasUnlocked ? '✅ Completed' : '❌ Incomplete', inline: true },
            { name: 'Current Beyond Level', value: `🌌 **Level ${byLevel}**`, inline: true },
            { name: 'Elemental Stones Owned', value: `💎 **${elementalStones}**`, inline: true }
          );

        if (hasUnlocked) {
          const displayLvl = Math.max(1, byLevel);
          const activeTeam = getActiveTeam(profile);
          const ps = gameData.getPowerScaling(activeTeam, profile.monsterLevels, profile.weaponLevels, profile.level);
          const kirinStats = gameData.getTXKirinStats(displayLvl, profile.level, ps);
          
          embed.addFields(
            { name: `⚡ TX Kirin Stats (BY Level ${displayLvl})`, value: `❤️ **HP**: ${kirinStats.hp.toLocaleString('id-ID')}\n⚔️ **ATK**: ${kirinStats.atk.toLocaleString('id-ID')}\n🛡️ **DEF**: ${kirinStats.def.toLocaleString('id-ID')}\n✨ **Passive**: ${kirinStats.passiveName}\n📜 **Description**: ${kirinStats.passiveDesc}` },
            { name: 'Upgrade Cost', value: `💎 **300 Elemental Stones** (\`'by up\`)` }
          );
        } else {
          embed.addFields({ name: 'Access Locked', value: `You must defeat Beyond T6 monsters first to unlock Beyond Threat Level features.` });
        }

        embed.setTimestamp();
        return message.reply({ embeds: [embed] });

      } else if (subCommand === 'up') {
        if (!profile.killedBeyondT6) {
          return message.reply(`❌ Prerequisite not met! You must defeat Beyond T6 monsters first.`);
        }

        if ((profile.elementalStones || 0) < 300) {
          return message.reply(`❌ You do not have enough Elemental Stones! Upgrading Beyond Threat Level costs **300 Elemental Stones** (You have: ${profile.elementalStones || 0}).`);
        }

        const currentByLvl = profile.beyondLevel || 0;
        profile.elementalStones -= 300;
        profile.beyondLevel = currentByLvl + 1;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🌌 Beyond Threat Level Upgraded!`)
          .setColor('#9C27B0')
          .setDescription(`You consumed **300 Elemental Stones** to upgrade your Beyond Threat Level!`)
          .addFields(
            { name: 'Beyond Threat Level', value: `🌌 **Level ${profile.beyondLevel}**`, inline: true },
            { name: 'Remaining Stones', value: `💎 **${profile.elementalStones}**`, inline: true }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else if (subCommand === 'down') {
        if (!profile.killedBeyondT6) {
          return message.reply(`❌ Prerequisite not met! You must defeat Beyond T6 monsters first.`);
        }

        const currentByLvl = profile.beyondLevel || 0;
        if (currentByLvl <= 1) {
          return message.reply(`❌ Your Beyond Threat Level is already at the minimum (**Level 1**)!`);
        }

        profile.beyondLevel = currentByLvl - 1;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🌌 Beyond Threat Level Downgraded!`)
          .setColor('#9C27B0')
          .setDescription(`Your Beyond Threat Level has been downgraded for free!`)
          .addFields(
            { name: 'Beyond Threat Level', value: `🌌 **Level ${profile.beyondLevel}**`, inline: true }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else if (subCommand === 'fight') {
        return message.reply(`❌ The \`by fight\` command has been retired. Please challenge the TX Kirin boss using the standard \`${effectivePrefix}hunt\` command!`);
      } else {
        return message.reply(`❌ Invalid sub-command. Did you mean: \`${effectivePrefix}by info\`, \`${effectivePrefix}by up\`, or \`${effectivePrefix}by down\`?`);
      }

    } catch (err) {
      console.error('[Command Beyond Error]', err);
      return message.reply('❌ Failed to process Beyond command.');
    }
  }

  // COMMAND: REROLL ELEMENT ('r e / 'reroll element)
  if (command === 'r' || command === 'reroll') {
    try {
      if (args.length === 0 || (args[0].toLowerCase() !== 'e' && args[0].toLowerCase() !== 'element')) {
        return message.reply(`❌ Invalid usage. Did you mean: \`${effectivePrefix}r e [weapon_name]\`?`);
      }

      args.shift(); // remove 'e' or 'element'
      const weaponQuery = args.join(' ').trim();
      if (!weaponQuery) {
        return message.reply(`❌ Please specify a weapon name. Example: \`${effectivePrefix}r e Jester's Staff\``);
      }

      const profile = await firebase.getUser(userId);
      const ownedWeapons = getOwnedWeaponsList(profile, message.member);
      const weapon = gameData.findWeaponByName(weaponQuery);

      if (!weapon) {
        return message.reply(`❌ Weapon **${weaponQuery}** not found in the game database.`);
      }

      if (!ownedWeapons.includes(weapon.name)) {
        return message.reply(`❌ You do not own **${weapon.name}**! Complete loots to obtain it.`);
      }

      if ((profile.elementalStones || 0) < 1) {
        return message.reply(`❌ You do not have any Elemental Stones! Loot chests manually or sit in voice channels to find them (5% drop rate).`);
      }

      // Deduct 1 stone
      profile.elementalStones -= 1;

      if (!profile.weaponLevels[weapon.name]) {
        profile.weaponLevels[weapon.name] = { level: 1, xp: 0, forge: 0 };
      }
      const wData = profile.weaponLevels[weapon.name];

      // Roll element and perfection rate with pity logic
      const ELEMENTS = ['Blast', 'Liquid', 'Volt', 'Blizzard', 'Shadow', 'Radiant', 'Void'];
      const rolledElement = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
      
      wData.rerollCount = (wData.rerollCount || 0) + 1;
      const pityBeforeRoll = wData.rerollCount;
      let rolledPerfection;
      let hitGuaranteed = false;

      if (wData.rerollCount >= 50) {
        rolledPerfection = 100;
        wData.rerollCount = 0;
        hitGuaranteed = true;
      } else {
        rolledPerfection = Math.floor(Math.random() * 100) + 1; // 1% to 100%
        if (rolledPerfection === 100) {
          wData.rerollCount = 0;
        }
      }

      wData.element = rolledElement;
      wData.perfection = rolledPerfection;

      await firebase.saveUser(userId, profile);

      const forge = wData.forge || 0;
      const embed = new EmbedBuilder()
        .setTitle(`💎 Elemental Reroll: ${weapon.name}`)
        .setColor('#9C27B0')
        .setDescription(`You consumed **1 Elemental Stone** to reroll elements!`)
        .addFields(
          { name: 'Element', value: `${getElementIcon(rolledElement)} **${rolledElement}**`, inline: true },
          { name: 'Perfection Rate', value: `✨ **${rolledPerfection}%**`, inline: true },
          { name: 'Forge Level', value: `🔨 **Forge ${forge}**`, inline: true },
          { name: 'Passive Buff Status', value: getElementBuffDescription(rolledElement, rolledPerfection, forge) }
        )
        .setFooter({ text: `Remaining Stones: ${profile.elementalStones} | Pity: ${hitGuaranteed ? '50/50 (Guaranteed!)' : (rolledPerfection === 100 ? `${pityBeforeRoll}/50 (Reset!)` : `${wData.rerollCount}/50`)}` })
        .setTimestamp();

      const rowButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`reroll_again_${weapon.name.replace(/\s+/g, '_')}`)
            .setLabel('Reroll Again 🔄')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`reroll_bulk_${weapon.name.replace(/\s+/g, '_')}`)
            .setLabel('Reroll 50x (Pity) 💎')
            .setStyle(ButtonStyle.Success)
        );

      const rowSelect = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`select_element_${weapon.name.replace(/\s+/g, '_')}`)
            .setPlaceholder('Select Element (Guaranteed 100% - 300 Stones) 💎')
            .addOptions(
              { label: 'Blast', description: 'Blast (100% Perfection) - 300 Stones', value: 'Blast' },
              { label: 'Liquid', description: 'Liquid (100% Perfection) - 300 Stones', value: 'Liquid' },
              { label: 'Volt', description: 'Volt (100% Perfection) - 300 Stones', value: 'Volt' },
              { label: 'Blizzard', description: 'Blizzard (100% Perfection) - 300 Stones', value: 'Blizzard' },
              { label: 'Shadow', description: 'Shadow (100% Perfection) - 300 Stones', value: 'Shadow' },
              { label: 'Radiant', description: 'Radiant (100% Perfection) - 300 Stones', value: 'Radiant' },
              { label: 'Void', description: 'Void (100% Perfection) - 300 Stones', value: 'Void' }
            )
        );

      const getDisabledComponents = (isBulk, isSelectProcessing = false, selectedVal = '') => {
        const disabledRowButtons = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`reroll_again_${weapon.name.replace(/\s+/g, '_')}`)
              .setLabel(isSelectProcessing ? 'Reroll Again 🔄' : 'Rerolling... 🔄')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`reroll_bulk_${weapon.name.replace(/\s+/g, '_')}`)
              .setLabel(isBulk ? 'Processing... 💎' : 'Reroll 50x (Pity) 💎')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          );

        const disabledRowSelect = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`select_element_${weapon.name.replace(/\s+/g, '_')}`)
              .setPlaceholder(isSelectProcessing ? `Guaranteed ${selectedVal}... 💎` : 'Select Element (Guaranteed 100% - 300 Stones) 💎')
              .addOptions(
                { label: 'Blast', value: 'Blast' },
                { label: 'Liquid', value: 'Liquid' },
                { label: 'Volt', value: 'Volt' },
                { label: 'Blizzard', value: 'Blizzard' },
                { label: 'Shadow', value: 'Shadow' },
                { label: 'Radiant', value: 'Radiant' },
                { label: 'Void', value: 'Void' }
              )
              .setDisabled(true)
          );
        return [disabledRowButtons, disabledRowSelect];
      };

      const sentMessage = await message.reply({ embeds: [embed], components: [rowButtons, rowSelect] });

      const collector = sentMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 60000 // 1 minute collector
      });

      collector.on('collect', async (i) => {
        try {
          const isBulk = i.customId.startsWith('reroll_bulk_');
          const isSelect = i.customId.startsWith('select_element_');

          if (isSelect) {
            const selectedElement = i.values[0];
            await i.update({ components: getDisabledComponents(false, true, selectedElement) });

            const updatedProfile = await firebase.getUser(userId);

            if ((updatedProfile.elementalStones || 0) < 300) {
              await i.followUp({
                content: `❌ You do not have enough Elemental Stones! Selecting a guaranteed element costs **300 stones** (You have: ${updatedProfile.elementalStones || 0}).`,
                ephemeral: true
              });
              await sentMessage.edit({ components: [rowButtons, rowSelect] }).catch(() => {});
              return;
            }

            // Deduct 300 stones
            updatedProfile.elementalStones -= 300;

            if (!updatedProfile.weaponLevels[weapon.name]) {
              updatedProfile.weaponLevels[weapon.name] = { level: 1, xp: 0, forge: 0 };
            }
            const updatedWData = updatedProfile.weaponLevels[weapon.name];

            // Set element and 100% perfection
            updatedWData.element = selectedElement;
            updatedWData.perfection = 100;
            updatedWData.rerollCount = 0; // reset pity since 100% perfection is hit

            await firebase.saveUser(userId, updatedProfile);

            const updatedForge = updatedWData.forge || 0;

            const newEmbed = new EmbedBuilder()
              .setTitle(`💎 Guaranteed Elemental Selection: ${weapon.name}`)
              .setColor('#E91E63')
              .setDescription(`You consumed **300 Elemental Stones** to choose a guaranteed element!`)
              .addFields(
                { name: 'Element', value: `${getElementIcon(selectedElement)} **${selectedElement}**`, inline: true },
                { name: 'Perfection Rate', value: `✨ **100% (Guaranteed!)**`, inline: true },
                { name: 'Forge Level', value: `🔨 **Forge ${updatedForge}**`, inline: true },
                { name: 'Passive Buff Status', value: getElementBuffDescription(selectedElement, 100, updatedForge) }
              )
              .setFooter({ text: `Remaining Stones: ${updatedProfile.elementalStones} | Pity: 0/50 (Reset!)` })
              .setTimestamp();

            await i.editReply({ embeds: [newEmbed], components: [rowButtons, rowSelect] });
            return;
          }

          // Disable button/select immediately to prevent double-clicks for regular button rolls
          await i.update({ components: getDisabledComponents(isBulk) });

          const updatedProfile = await firebase.getUser(userId);

          if (!updatedProfile.weaponLevels[weapon.name]) {
            updatedProfile.weaponLevels[weapon.name] = { level: 1, xp: 0, forge: 0 };
          }
          const updatedWData = updatedProfile.weaponLevels[weapon.name];

          if (isBulk) {
            const currentPity = updatedWData.rerollCount || 0;
            const neededStones = Math.max(1, 50 - currentPity);
            if ((updatedProfile.elementalStones || 0) < neededStones) {
              await i.followUp({
                content: `❌ You do not have enough Elemental Stones! You need at least **${neededStones}** stones to guarantee 100% perfection on this weapon (Current Pity: ${currentPity}/50).`,
                ephemeral: true
              });
              await sentMessage.edit({ components: [rowButtons, rowSelect] }).catch(() => {});
              return;
            }
          } else {
            if ((updatedProfile.elementalStones || 0) < 1) {
              await i.followUp({ content: `❌ You do not own any Elemental Stones!`, ephemeral: true });
              await sentMessage.edit({ components: [rowButtons, rowSelect] }).catch(() => {});
              return;
            }
          }

          let stonesConsumed = 0;
          let rolledElement = updatedWData.element || 'Void';
          let rolledPerfection = updatedWData.perfection || 0;
          let hitGuaranteed = false;
          let pityBeforeRoll = updatedWData.rerollCount || 0;

          if (isBulk) {
            const currentPity = updatedWData.rerollCount || 0;
            const maxRolls = 50 - currentPity;
            
            while (stonesConsumed < maxRolls && updatedProfile.elementalStones > 0) {
              updatedProfile.elementalStones -= 1;
              stonesConsumed += 1;
              updatedWData.rerollCount = (updatedWData.rerollCount || 0) + 1;
              
              const rolledElementLoop = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
              let rolledPerfectionLoop;
              
              if (updatedWData.rerollCount >= 50) {
                rolledPerfectionLoop = 100;
                updatedWData.rerollCount = 0;
                hitGuaranteed = true;
              } else {
                rolledPerfectionLoop = Math.floor(Math.random() * 100) + 1;
                if (rolledPerfectionLoop === 100) {
                  updatedWData.rerollCount = 0;
                }
              }
              
              rolledElement = rolledElementLoop;
              rolledPerfection = rolledPerfectionLoop;
              
              if (rolledPerfectionLoop === 100) {
                break;
              }
            }
          } else {
            // Standard single reroll
            updatedProfile.elementalStones -= 1;
            stonesConsumed = 1;
            updatedWData.rerollCount = (updatedWData.rerollCount || 0) + 1;
            pityBeforeRoll = updatedWData.rerollCount;
            
            const rolledElementSingle = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
            let rolledPerfectionSingle;
            
            if (updatedWData.rerollCount >= 50) {
              rolledPerfectionSingle = 100;
              updatedWData.rerollCount = 0;
              hitGuaranteed = true;
            } else {
              rolledPerfectionSingle = Math.floor(Math.random() * 100) + 1;
              if (rolledPerfectionSingle === 100) {
                updatedWData.rerollCount = 0;
              }
            }
            
            rolledElement = rolledElementSingle;
            rolledPerfection = rolledPerfectionSingle;
          }

          updatedWData.element = rolledElement;
          updatedWData.perfection = rolledPerfection;

          await firebase.saveUser(userId, updatedProfile);

          const updatedForge = updatedWData.forge || 0;
          
          let descText = `You consumed **${stonesConsumed} ${stonesConsumed === 1 ? 'Elemental Stone' : 'Elemental Stones'}** to reroll elements!`;
          if (isBulk) {
            const maxRolls = 50 - pityBeforeRoll;
            if (stonesConsumed < maxRolls) {
              descText += ` *(Stopped early at roll ${stonesConsumed} after hitting 100% naturally!)*`;
            }
          }

          const newEmbed = new EmbedBuilder()
            .setTitle(`💎 Elemental Reroll: ${weapon.name}`)
            .setColor('#9C27B0')
            .setDescription(descText)
            .addFields(
              { name: 'Element', value: `${getElementIcon(rolledElement)} **${rolledElement}**`, inline: true },
              { name: 'Perfection Rate', value: `✨ **${rolledPerfection}%**`, inline: true },
              { name: 'Forge Level', value: `🔨 **Forge ${updatedForge}**`, inline: true },
              { name: 'Passive Buff Status', value: getElementBuffDescription(rolledElement, rolledPerfection, updatedForge) }
            )
            .setFooter({ text: `Remaining Stones: ${updatedProfile.elementalStones} | Pity: ${hitGuaranteed ? '50/50 (Guaranteed!)' : (rolledPerfection === 100 ? `${pityBeforeRoll}/50 (Reset!)` : `${updatedWData.rerollCount}/50`)}` })
            .setTimestamp();

          await i.editReply({ embeds: [newEmbed], components: [rowButtons, rowSelect] });

        } catch (err) {
          console.error('[Button Collector Error]', err);
          try {
            await i.followUp({ content: '❌ Failed to process reroll.', ephemeral: true });
          } catch (replyErr) {}
          await sentMessage.edit({ components: [rowButtons, rowSelect] }).catch(() => {});
        }
      });

      collector.on('end', () => {
        const expiredRowButtons = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`reroll_again_${weapon.name.replace(/\s+/g, '_')}`)
              .setLabel('Reroll Again (Expired)')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`reroll_bulk_${weapon.name.replace(/\s+/g, '_')}`)
              .setLabel('Bulk Reroll (Expired)')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
        const expiredRowSelect = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`select_element_${weapon.name.replace(/\s+/g, '_')}`)
              .setPlaceholder('Selection (Expired)')
              .addOptions({ label: 'Expired', value: 'expired' })
              .setDisabled(true)
          );
        sentMessage.edit({ components: [expiredRowButtons, expiredRowSelect] }).catch(() => {});
      });

      return;

    } catch (err) {
      console.error('[Reroll Command Error]', err);
      return message.reply('❌ Failed to execute elemental reroll.');
    }
  }

  // COMMAND: COINFLIP ('cf / 'coinflip)
  if (command === 'cf' || command === 'coinflip') {
    try {
      if (args.length < 2) {
        return message.reply(`🪙 **Coinflip Command Usage:**\n• \`${effectivePrefix}cf [bet_amount] [heads/tails]\` (Max bet: 5.000, 60% win chance)\n*Example:* \`${effectivePrefix}cf 1000 heads\``);
      }

      // Check cooldown
      const cooldownKey = `${userId}-gamble`;
      const now = Date.now();
      if (cooldowns.has(cooldownKey)) {
        const expiration = cooldowns.get(cooldownKey) + 10000;
        if (now < expiration) {
          const remaining = ((expiration - now) / 1000).toFixed(1);
          return message.reply(`⏳ Please wait **${remaining}s** before gambling again.`);
        }
      }

      // Parse Bet Amount
      const betInput = args[0];
      const betAmount = parseGoldAmount(betInput);
      if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply(`❌ Please enter a valid positive bet amount.`);
      }

      if (betAmount > 5000) {
        return message.reply(`❌ Maximum bet amount is **5.000 Gold**! For higher stakes, use \`${effectivePrefix}cfh\` (standard win chance).`);
      }

      // Parse Side Choice
      const sideInput = args[1].toLowerCase();
      let chosenSide = null;
      if (sideInput === 'h' || sideInput === 'heads' || sideInput === 'head') {
        chosenSide = 'Heads';
      } else if (sideInput === 't' || sideInput === 'tails' || sideInput === 'tail') {
        chosenSide = 'Tails';
      } else {
        return message.reply(`❌ Invalid side. Please choose either **heads** (h) or **tails** (t).`);
      }

      // Fetch profile
      const profile = await firebase.getUser(userId);
      const userGold = profile.currency || 0;
      if (userGold < betAmount) {
        return message.reply(`❌ You do not have enough Gold! You only have **${userGold.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold.`);
      }

      // All validations passed! Set cooldown
      cooldowns.set(cooldownKey, now);

      // Coinflip logic (Rigged 60% win chance)
      const isWin = Math.random() < 0.60;
      const landedSide = isWin ? chosenSide : (chosenSide === 'Heads' ? 'Tails' : 'Heads');

      const creatorId = '661135501226672129';

      if (isWin) {
        profile.currency += betAmount;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🪙 Coinflip: Heads or Tails?`)
          .setColor('#4CAF50')
          .setDescription(`You bet **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold on **${chosenSide}**!\n\nThe coin spins in the air and lands on...\n✨ **${landedSide}**!`)
          .addFields(
            { name: 'Result', value: `🎉 **YOU WON!** (+${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} Gold)`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      } else {
        profile.currency -= betAmount;
        await firebase.saveUser(userId, profile);

        // Redirect lost bet to creator
        if (userId !== creatorId) {
          const creatorProfile = await firebase.getUser(creatorId);
          creatorProfile.currency = (creatorProfile.currency || 0) + betAmount;
          await firebase.saveUser(creatorId, creatorProfile);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🪙 Coinflip: Heads or Tails?`)
          .setColor('#F44336')
          .setDescription(`You bet **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold on **${chosenSide}**!\n\nThe coin spins in the air and lands on...\n💨 **${landedSide}**`)
          .addFields(
            { name: 'Result', value: `💀 **YOU LOST!** (-${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} Gold)`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({
          content: `💀 <@${userId}> kalah!\n\`'give <@${userId}> ${betAmount}\``,
          embeds: [embed]
        });
      }

    } catch (err) {
      console.error('[Coinflip Command Error]', err);
      return message.reply('❌ Failed to process coinflip.');
    }
  }

  // COMMAND: COINFLIP HIGH ('cfh / 'coinfliphigh)
  if (command === 'cfh' || command === 'coinfliphigh') {
    try {
      if (args.length < 2) {
        return message.reply(`🪙 **High-Stakes Coinflip Command Usage:**\n• \`${effectivePrefix}cfh [bet_amount] [heads/tails]\` (Max bet: 2.500.000, 48% win chance)\n*Example:* \`${effectivePrefix}cfh 100000 heads\``);
      }

      // Check cooldown
      const cooldownKey = `${userId}-gamble`;
      const now = Date.now();
      if (cooldowns.has(cooldownKey)) {
        const expiration = cooldowns.get(cooldownKey) + 10000;
        if (now < expiration) {
          const remaining = ((expiration - now) / 1000).toFixed(1);
          return message.reply(`⏳ Please wait **${remaining}s** before gambling again.`);
        }
      }

      // Parse Bet Amount
      const betInput = args[0];
      const betAmount = parseGoldAmount(betInput);
      if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply(`❌ Please enter a valid positive bet amount.`);
      }

      if (betAmount > 2500000) {
        return message.reply(`❌ Maximum bet amount is **2.500.000 Gold**!`);
      }

      // Parse Side Choice
      const sideInput = args[1].toLowerCase();
      let chosenSide = null;
      if (sideInput === 'h' || sideInput === 'heads' || sideInput === 'head') {
        chosenSide = 'Heads';
      } else if (sideInput === 't' || sideInput === 'tails' || sideInput === 'tail') {
        chosenSide = 'Tails';
      } else {
        return message.reply(`❌ Invalid side. Please choose either **heads** (h) or **tails** (t).`);
      }

      // Fetch profile
      const profile = await firebase.getUser(userId);
      const userGold = profile.currency || 0;
      if (userGold < betAmount) {
        return message.reply(`❌ You do not have enough Gold! You only have **${userGold.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold.`);
      }

      // All validations passed! Set cooldown
      cooldowns.set(cooldownKey, now);

      // Coinflip logic (Rigged to 48% win chance - house favored)
      const isWin = Math.random() < 0.48;
      const landedSide = isWin ? chosenSide : (chosenSide === 'Heads' ? 'Tails' : 'Heads');

      const creatorId = '661135501226672129';

      if (isWin) {
        profile.currency += betAmount;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🪙 High-Stakes Coinflip: Heads or Tails?`)
          .setColor('#4CAF50')
          .setDescription(`You bet **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold on **${chosenSide}**!\n\nThe coin spins in the air and lands on...\n✨ **${landedSide}**!`)
          .addFields(
            { name: 'Result', value: `🎉 **YOU WON!** (+${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} Gold)`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      } else {
        profile.currency -= betAmount;
        await firebase.saveUser(userId, profile);

        // Redirect lost bet to creator
        if (userId !== creatorId) {
          const creatorProfile = await firebase.getUser(creatorId);
          creatorProfile.currency = (creatorProfile.currency || 0) + betAmount;
          await firebase.saveUser(creatorId, creatorProfile);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🪙 High-Stakes Coinflip: Heads or Tails?`)
          .setColor('#F44336')
          .setDescription(`You bet **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold on **${chosenSide}**!\n\nThe coin spins in the air and lands on...\n💨 **${landedSide}**`)
          .addFields(
            { name: 'Result', value: `💀 **YOU LOST!** (-${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} Gold)`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({
          content: `💀 <@${userId}> kalah!\n\`'give <@${userId}> ${betAmount}\``,
          embeds: [embed]
        });
      }

    } catch (err) {
      console.error('[Coinflip High Command Error]', err);
      return message.reply('❌ Failed to process high-stakes coinflip.');
    }
  }

  // COMMAND: SLOTS ('slots / 'slot)
  if (command === 'slots' || command === 'slot') {
    try {
      if (args.length < 1) {
        return message.reply(`🎰 **Slots Command Usage:**\n• \`${effectivePrefix}slots [bet_amount]\` (Max bet: 5.000, 60% win chance)\n*Example:* \`${effectivePrefix}slots 1000\``);
      }

      // Check cooldown
      const cooldownKey = `${userId}-gamble`;
      const now = Date.now();
      if (cooldowns.has(cooldownKey)) {
        const expiration = cooldowns.get(cooldownKey) + 10000;
        if (now < expiration) {
          const remaining = ((expiration - now) / 1000).toFixed(1);
          return message.reply(`⏳ Please wait **${remaining}s** before gambling again.`);
        }
      }

      // Parse Bet Amount
      const betInput = args[0];
      const betAmount = parseGoldAmount(betInput);
      if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply(`❌ Please enter a valid positive bet amount.`);
      }

      if (betAmount > 5000) {
        return message.reply(`❌ Maximum bet amount is **5.000 Gold**! For higher stakes, use \`${effectivePrefix}sloth\` (low win chance).`);
      }

      // Fetch profile
      const profile = await firebase.getUser(userId);
      const userGold = profile.currency || 0;
      if (userGold < betAmount) {
        return message.reply(`❌ You do not have enough Gold! You only have **${userGold.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold.`);
      }

      // All validations passed! Set cooldown
      cooldowns.set(cooldownKey, now);

      const SYMBOLS = ['🍒', '🍋', '🍇', '💎', '👑'];
      
      // Rigged 60% win chance
      const isWin = Math.random() < 0.60;
      let payline = [];
      let multiplier = 0;
      let winningSymbol = '';

      if (isWin) {
        // Choose winning symbol based on weights
        const roll = Math.random() * 100;
        if (roll < 40) {
          winningSymbol = '🍒'; // Cherry
          multiplier = 2.0;
        } else if (roll < 70) {
          winningSymbol = '🍋'; // Lemon
          multiplier = 2.5;
        } else if (roll < 90) {
          winningSymbol = '🍇'; // Grape
          multiplier = 3.0;
        } else if (roll < 98) {
          winningSymbol = '💎'; // Diamond
          multiplier = 5.0;
        } else {
          winningSymbol = '👑'; // Crown
          multiplier = 10.0;
        }
        payline = [winningSymbol, winningSymbol, winningSymbol];
      } else {
        // Lose: generate non-matching symbols
        while (true) {
          payline = [
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
          ];
          // Check that they aren't all matching
          if (payline[0] !== payline[1] || payline[1] !== payline[2]) {
            break;
          }
        }
      }

      // Generate random top and bottom row symbols for premium display
      const topRow = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ];
      const bottomRow = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ];

      const creatorId = '661135501226672129';
      
      const gridText = 
        `\`[  ${topRow[0]}  |  ${topRow[1]}  |  ${topRow[2]}  ]\`\n` +
        `➡️ \`[  ${payline[0]}  |  ${payline[1]}  |  ${payline[2]}  ]\` ⬅️\n` +
        `\`[  ${bottomRow[0]}  |  ${bottomRow[1]}  |  ${bottomRow[2]}  ]\``;

      if (isWin) {
        const netProfit = Math.floor(betAmount * (multiplier - 1));
        profile.currency += netProfit;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🎰 Slot Machine`)
          .setColor('#E91E63')
          .setDescription(`You pulled the lever with a bet of **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold!\n\n${gridText}`)
          .addFields(
            { name: 'Result', value: `🎉 **MATCH!** You got 3x ${winningSymbol}!\nWon **${netProfit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold! (${multiplier}x payout)`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      } else {
        profile.currency -= betAmount;
        await firebase.saveUser(userId, profile);

        // Redirect lost bet to creator
        if (userId !== creatorId) {
          const creatorProfile = await firebase.getUser(creatorId);
          creatorProfile.currency = (creatorProfile.currency || 0) + betAmount;
          await firebase.saveUser(creatorId, creatorProfile);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🎰 Slot Machine`)
          .setColor('#9E9E9E')
          .setDescription(`You pulled the lever with a bet of **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold!\n\n${gridText}`)
          .addFields(
            { name: 'Result', value: `💀 **NO MATCH!** Better luck next time!\nLost **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold.`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({
          content: `💀 <@${userId}> kalah!\n\`'give <@${userId}> ${betAmount}\``,
          embeds: [embed]
        });
      }

    } catch (err) {
      console.error('[Slots Command Error]', err);
      return message.reply('❌ Failed to process slots.');
    }
  }

  // COMMAND: SLOTS HIGH ('sloth / 'slothigh)
  if (command === 'sloth' || command === 'slothigh') {
    try {
      if (args.length < 1) {
        return message.reply(`🎰 **High-Stakes Slot Machine Command Usage:**\n• \`${effectivePrefix}sloth [bet_amount/all]\` (Max bet: 50.000.000, 30% win chance)\n*Example:* \`${effectivePrefix}sloth 100000\` or \`${effectivePrefix}sloth all\``);
      }

      // Check cooldown
      const cooldownKey = `${userId}-gamble`;
      const now = Date.now();
      if (cooldowns.has(cooldownKey)) {
        const expiration = cooldowns.get(cooldownKey) + 10000;
        if (now < expiration) {
          const remaining = ((expiration - now) / 1000).toFixed(1);
          return message.reply(`⏳ Please wait **${remaining}s** before gambling again.`);
        }
      }

      // Fetch profile
      const profile = await firebase.getUser(userId);
      const userGold = profile.currency || 0;

      // Parse Bet Amount
      const betInput = args[0];
      let betAmount;
      let isAllIn = false;

      if (betInput.toLowerCase() === 'all') {
        isAllIn = true;
        betAmount = userGold;
        if (betAmount <= 0) {
          return message.reply(`❌ You do not have any Gold to bet!`);
        }
      } else {
        betAmount = parseGoldAmount(betInput);
        if (isNaN(betAmount) || betAmount <= 0) {
          return message.reply(`❌ Please enter a valid positive bet amount or \`all\`.`);
        }
        if (betAmount > 50000000) {
          return message.reply(`❌ Maximum bet amount is **50.000.000 Gold**!`);
        }
        if (userGold < betAmount) {
          return message.reply(`❌ You do not have enough Gold! You only have **${userGold.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold.`);
        }
      }

      // All validations passed! Set cooldown
      cooldowns.set(cooldownKey, now);

      const SYMBOLS = ['🍒', '🍋', '🍇', '💎', '👑'];
      
      // Standard slots win chance (30%)
      const isWin = Math.random() < 0.30;
      let payline = [];
      let multiplier = 0;
      let winningSymbol = '';

      if (isWin) {
        // Choose winning symbol based on weights (higher payouts for lower win rates)
        const roll = Math.random() * 100;
        if (roll < 35) {
          winningSymbol = '🍒'; // Cherry
          multiplier = 3.0;
        } else if (roll < 65) {
          winningSymbol = '🍋'; // Lemon
          multiplier = 4.0;
        } else if (roll < 85) {
          winningSymbol = '🍇'; // Grape
          multiplier = 5.0;
        } else if (roll < 97) {
          winningSymbol = '💎'; // Diamond
          multiplier = 10.0;
        } else {
          winningSymbol = '👑'; // Crown
          multiplier = 25.0;
        }
        payline = [winningSymbol, winningSymbol, winningSymbol];
      } else {
        // Lose: generate non-matching symbols
        while (true) {
          payline = [
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
          ];
          // Check that they aren't all matching
          if (payline[0] !== payline[1] || payline[1] !== payline[2]) {
            break;
          }
        }
      }

      // Generate random top and bottom row symbols for premium display
      const topRow = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ];
      const bottomRow = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ];

      const creatorId = '661135501226672129';
      
      const gridText = 
        `\`[  ${topRow[0]}  |  ${topRow[1]}  |  ${topRow[2]}  ]\`\n` +
        `➡️ \`[  ${payline[0]}  |  ${payline[1]}  |  ${payline[2]}  ]\` ⬅️\n` +
        `\`[  ${bottomRow[0]}  |  ${bottomRow[1]}  |  ${bottomRow[2]}  ]\``;

      if (isWin) {
        const netProfit = Math.floor(betAmount * (multiplier - 1));
        profile.currency += netProfit;
        await firebase.saveUser(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle(`🎰 High-Stakes Slot Machine`)
          .setColor('#E91E63')
          .setDescription(`You pulled the lever with a bet of **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold!\n\n${gridText}`)
          .addFields(
            { name: 'Result', value: `🎉 **MATCH!** You got 3x ${winningSymbol}!\nWon **${netProfit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold! (${multiplier}x payout)`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      } else {
        profile.currency -= betAmount;
        if (isAllIn) {
          profile.giftBlockedUntil = Date.now() + 3600000; // 1 hour penalty
        }
        await firebase.saveUser(userId, profile);

        // Redirect lost bet to creator
        if (userId !== creatorId) {
          const creatorProfile = await firebase.getUser(creatorId);
          creatorProfile.currency = (creatorProfile.currency || 0) + betAmount;
          await firebase.saveUser(creatorId, creatorProfile);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🎰 High-Stakes Slot Machine`)
          .setColor('#9E9E9E')
          .setDescription(`You pulled the lever with a bet of **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold!\n\n${gridText}`)
          .addFields(
            { name: 'Result', value: `💀 **NO MATCH!** Better luck next time!\nLost **${betAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}** gold.${isAllIn ? '\n⚠️ **All-In Penalty**: You are blocked from receiving gifts (\`\'give\`) for 1 hour!' : ''}`, inline: false },
            { name: 'Your Gold Balance', value: `🪙 **${profile.currency.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}**`, inline: false }
          )
          .setTimestamp();

        return message.reply({
          content: `💀 <@${userId}> kalah!\n\`'give <@${userId}> ${betAmount}\``,
          embeds: [embed]
        });
      }

    } catch (err) {
      console.error('[Slots High Command Error]', err);
      return message.reply('❌ Failed to process high-stakes slots.');
    }
  }

  // COMMAND: ACHIEVEMENTS & TITLES ('ach')
  if (command === 'ach') {
    try {
      let allUsers = [];
      if (firebase.db) {
        try {
          const usersSnap = await firebase.db.collection('rpg_users').get();
          usersSnap.forEach(doc => {
            allUsers.push(doc.data());
          });
          allUsers.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return (b.xp || 0) - (a.xp || 0);
          });
        } catch (rankErr) {
          console.error('[Rank Calc Error in ach]', rankErr);
        }
      }

      const profile = await firebase.getUser(userId);

      if (args.length > 0 && args[0].toLowerCase() === 'equip') {
        if (args.length === 1) {
          return message.reply(`❌ Please specify a title to equip. Example: \`'ach equip New Tester\``);
        }
        const legacyTitles = {
          '1051027211160928276': 'Early Tester',
          '588988763204616214': 'Early Tester',
          '661135501226672129': 'Creator Tester'
        };
        const targetTitle = args.slice(1).join(' ').trim();
        const achs = getUnlockedAchievements(profile, message.member, allUsers);
        const matchedAch = achs.find(a => a.unlocked && a.title.toLowerCase() === targetTitle.toLowerCase());
        const hasLegacyTitle = legacyTitles[userId] && legacyTitles[userId].toLowerCase() === targetTitle.toLowerCase();

        if (matchedAch) {
          profile.equippedTitle = matchedAch.title;
          await firebase.saveUser(userId, profile);
          return message.reply(`🎉 Success! You have equipped the title **${matchedAch.title}**.`);
        } else if (hasLegacyTitle) {
          profile.equippedTitle = legacyTitles[userId];
          await firebase.saveUser(userId, profile);
          return message.reply(`🎉 Success! You have equipped the title **${legacyTitles[userId]}**.`);
        } else {
          return message.reply(`❌ You have not unlocked the title **${targetTitle}**! Make sure to complete the achievement first.`);
        }
      } else {
        const achs = getUnlockedAchievements(profile, message.member, allUsers);
        const embed = new EmbedBuilder()
          .setTitle('🏆 Achievements & Titles')
          .setColor('#9C27B0')
          .setDescription('Unlock special achievements and equip their titles to show off on your profile!\n\nUse `' + effectivePrefix + 'ach equip [Title]` to equip an unlocked title.');

        let listText = '';
        let isFirstField = true;
        achs.forEach((a, index) => {
          const status = a.unlocked ? '✅ Unlocked' : '🔒 Locked';
          const line = `**${index + 1}. ${a.title}** - *${a.desc}*\nStatus: \`${status}\` ${a.unlocked ? `(Title: **${a.title}**)` : ''}\n\n`;
          if (listText.length + line.length > 1000) {
            embed.addFields({ name: isFirstField ? '📋 Achievement List' : '📋 Achievement List (Cont.)', value: listText });
            listText = line;
            isFirstField = false;
          } else {
            listText += line;
          }
        });
        if (listText) {
          embed.addFields({ name: isFirstField ? '📋 Achievement List' : '📋 Achievement List (Cont.)', value: listText });
        }
        const activeTitle = profile.equippedTitle || '';
        embed.addFields({ name: '🏆 Active Title', value: activeTitle ? `**${activeTitle}**` : '*None equipped*' });

        return message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[Achievements Command Error]', err);
      return message.reply('❌ Failed to process achievements command.');
    }
  }

  // COMMANDS: EQUIP (use onfield/on, offfield1/off1, offfield2/off2)
  let targetSlot = null;
  let equipArgs = [];

  if (command === 'use') {
    if (args.length === 0) {
      return message.reply(`📋 **Equip Commands Usage:**\n• \`'use on <monster/weapon>\` - Equip onfield slot\n• \`'use off1 <monster/weapon>\` - Equip offfield1 slot\n• \`'use off2 <monster/weapon>\` - Equip offfield2 slot`);
    }
    const slotArg = args.shift().toLowerCase();
    if (slotArg === 'onfield' || slotArg === 'on') {
      targetSlot = 'onfield';
    } else if (slotArg === 'offfield1' || slotArg === 'off1') {
      targetSlot = 'offfield1';
    } else if (slotArg === 'offfield2' || slotArg === 'off2') {
      targetSlot = 'offfield2';
    } else {
      return message.reply('❌ Invalid slot. Use `on`, `off1`, or `off2`.');
    }
    equipArgs = args;
  } else if (command === 'on' || command === 'onfield') {
    if (args.length > 0 && (args[0] === 'off1' || args[0] === 'offfield1')) {
      targetSlot = 'offfield1';
      args.shift();
    } else if (args.length > 0 && (args[0] === 'off2' || args[0] === 'offfield2')) {
      targetSlot = 'offfield2';
      args.shift();
    } else if (args.length > 0 && (args[0] === 'on' || args[0] === 'onfield')) {
      targetSlot = 'onfield';
      args.shift();
    } else {
      targetSlot = 'onfield';
    }
    equipArgs = args;
  } else if (command === 'off1' || command === 'offfield1') {
    targetSlot = 'offfield1';
    equipArgs = args;
  } else if (command === 'off2' || command === 'offfield2') {
    targetSlot = 'offfield2';
    equipArgs = args;
  }

  if (targetSlot) {
    try {
      const profile = await firebase.getUser(userId);
      
      if (equipArgs.length === 0) {
        return message.reply(`❌ Please specify a monster and/or weapon to equip. Example: \`'use ${targetSlot} Slime Wooden Sword\``);
      }

      const ownedWeapons = getOwnedWeaponsList(profile, message.member);
      const parseResult = parseEquipArgs(equipArgs, profile.dex.monsters, ownedWeapons);

      if (!parseResult) {
        // Provide details if they searched something valid but don't own it
        const queryStr = equipArgs.join(' ').toLowerCase();
        const possibleMonster = gameData.findMonsterByName(queryStr);
        if (possibleMonster) {
          return message.reply(`❌ You have not captured/tamed **${possibleMonster.name}** yet! Complete hunts to unlock it.`);
        }
        const possibleWeapon = gameData.findWeaponByName(queryStr);
        if (possibleWeapon) {
          return message.reply(`❌ You do not own **${possibleWeapon.name}**! Complete loots to unlock it.`);
        }

        // Try to split check
        for (let i = 1; i < equipArgs.length; i++) {
          const left = equipArgs.slice(0, i).join(' ');
          const right = equipArgs.slice(i).join(' ');
          const mon = gameData.findMonsterByName(left);
          const wp = gameData.findWeaponByName(right);
          if (mon && !profile.dex.monsters.includes(mon.name)) {
            return message.reply(`❌ You have not captured/tamed **${mon.name}** yet!`);
          }
          if (wp && !ownedWeapons.includes(wp.name)) {
            return message.reply(`❌ You do not own **${wp.name}**!`);
          }
        }

        return message.reply(`❌ Could not identify the monster or weapon in your library. Check your spelling or run \`'dex\` to see your owned collection.`);
      }

      const { monster, weapon } = parseResult;
      const activeIndex = profile.activeTeamIndex;
      const activeTeam = profile.teams[activeIndex];

      if (monster && monster === 'Kirin' && targetSlot === 'onfield') {
        return message.reply(`❌ **Kirin** is a support animal (Off-Field only) and cannot be equipped to the On-Field slot!`);
      }

      // Verification: Monster duplicates in team
      if (monster) {
        if (targetSlot === 'onfield') {
          if (activeTeam.offfield1.monster === monster || activeTeam.offfield2.monster === monster) {
            return message.reply(`❌ **${monster}** is already equipped in an off-field slot on this team!`);
          }
        } else if (targetSlot === 'offfield1') {
          if (activeTeam.onfield.monster === monster || activeTeam.offfield2.monster === monster) {
            return message.reply(`❌ **${monster}** is already equipped in another slot on this team!`);
          }
        } else if (targetSlot === 'offfield2') {
          if (activeTeam.onfield.monster === monster || activeTeam.offfield1.monster === monster) {
            return message.reply(`❌ **${monster}** is already equipped in another slot on this team!`);
          }
        }
      }

      // Verification: Weapon category matching
      if (weapon) {
        const weaponData = gameData.findWeaponByName(weapon);
        if (targetSlot === 'onfield') {
          if (weaponData.category !== 'dps') {
            return message.reply(`❌ Onfield slot can only equip **DPS** weapons! **${weapon}** is a Support weapon.`);
          }
        } else {
          if (weaponData.category !== 'support') {
            return message.reply(`❌ Offfield slots can only equip **Support** weapons! **${weapon}** is a DPS weapon.`);
          }
        }
      }

      // Perform equip
      if (monster) {
        activeTeam[targetSlot].monster = monster;
      }
      if (weapon) {
        activeTeam[targetSlot].weapon = weapon;
      }

      await firebase.saveUser(userId, profile);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Equipment Updated`)
        .setColor('#4CAF50')
        .setDescription(`Successfully updated **Team ${activeIndex + 1}** [${targetSlot.toUpperCase()}] slot!`)
        .addFields(
          { name: '👾 Monster', value: activeTeam[targetSlot].monster || '*None*', inline: true },
          { name: '⚔️/🛡️ Weapon', value: activeTeam[targetSlot].weapon || '*None*', inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });

    } catch (e) {
      console.error('[Equip Error]', e);
      return message.reply('❌ An error occurred while equipping the items.');
    }
  }
}

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  const userId = msg.author.id;
  const guildId = msg.guild?.id;

  // 1. Resolve User-Specific Prefix
  let userPrefix = userPrefixCache.get(userId);
  if (userPrefix === undefined) {
    try {
      userPrefix = await firebase.getUserPrefix(userId);
      userPrefixCache.set(userId, userPrefix);
    } catch (err) {
      console.error(`[Prefix Error] Failed to fetch user prefix for ${userId}:`, err);
      userPrefix = null;
    }
  }

  // 2. Resolve Server-Wide Prefix
  let serverPrefix = null;
  if (guildId) {
    serverPrefix = serverPrefixCache.get(guildId);
    if (serverPrefix === undefined) {
      try {
        serverPrefix = await firebase.getServerPrefix(guildId);
        serverPrefixCache.set(guildId, serverPrefix);
      } catch (err) {
        console.error(`[Prefix Error] Failed to fetch server prefix for ${guildId}:`, err);
        serverPrefix = null;
      }
    }
  }

  // 3. Determine Effective Prefix
  const effectivePrefix = userPrefix !== null ? userPrefix : (serverPrefix !== null ? serverPrefix : PREFIX);

  // 4. Verify message starts with effective prefix
  if (!msg.content.startsWith(effectivePrefix)) return;

  const args = msg.content.slice(effectivePrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const ctx = new CommandContext(msg, false);
  await executeRPGCommand(command, args, ctx, effectivePrefix);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!firebase.isInitialized()) {
    return interaction.reply({ content: '❌ The bot database connection is currently unconfigured.', ephemeral: true });
  }

  const { commandName } = interaction;
  const userId = interaction.user.id;

  // Unify context
  const ctx = new CommandContext(interaction, true);

  // Extract arguments to match the array structure expected by the prefix handler
  const args = [];

  // Parse arguments based on commandName
  if (commandName === 'cf' || commandName === 'cfh') {
    const bet = interaction.options.getString('bet');
    const side = interaction.options.getString('side');
    args.push(bet, side);
  } else if (commandName === 'slots') {
    const bet = interaction.options.getString('bet');
    args.push(bet);
  } else if (commandName === 'sloth') {
    const bet = interaction.options.getString('bet');
    args.push(bet.trim());
  } else if (commandName === 'monster' || commandName === 'weapon') {
    const name = interaction.options.getString('name');
    if (name) {
      args.push(...name.trim().split(/ +/));
    }
  } else if (commandName === 'team') {
    const subcommand = interaction.options.getSubcommand();
    args.push(subcommand);
    if (subcommand === 'set' || subcommand === 'clear') {
      const number = interaction.options.getInteger('number');
      args.push(number.toString());
    } else if (subcommand === 'rename') {
      const number = interaction.options.getInteger('number');
      const name = interaction.options.getString('name');
      if (number !== null && number !== undefined) {
        args.push(number.toString());
      }
      args.push(...name.trim().split(/ +/));
    }
  } else if (commandName === 'use') {
    const slot = interaction.options.getString('slot');
    const item = interaction.options.getString('item');
    args.push(slot);
    args.push(...item.trim().split(/ +/));
  } else if (commandName === 'threat' || commandName === 'by') {
    const subcommand = interaction.options.getSubcommand();
    args.push(subcommand);
  } else if (commandName === 'reroll') {
    args.push('e'); // In prefix commands, reroll is 'r e [weapon]'
    const weapon = interaction.options.getString('weapon');
    args.push(...weapon.trim().split(/ +/));
  } else if (commandName === 'settings') {
    const loot = interaction.options.getString('loot');
    const hunt = interaction.options.getString('hunt');
    if (loot) {
      args.push('loot', loot);
    } else if (hunt) {
      args.push('hunt', hunt);
    }
  } else if (commandName === 'dex') {
    const category = interaction.options.getString('category');
    if (category) {
      args.push(category);
    }
  } else if (commandName === 'leaderboard') {
    const category = interaction.options.getString('category');
    if (category) {
      args.push(category);
    }
  } else if (commandName === 'userprefix' || commandName === 'serverprefix') {
    const prefix = interaction.options.getString('prefix');
    args.push(prefix);
  } else if (commandName === 'give') {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getString('amount');
    args.push(user.id, amount);
  } else if (commandName === 'bet') {
    const user = interaction.options.getUser('player');
    const amount = interaction.options.getString('amount');
    args.push(user.id, amount);
  } else if (commandName === 'reset' || commandName === 'remove') {
    const amount = interaction.options.getString('amount');
    const user = interaction.options.getUser('user');
    args.push(amount);
    if (user) {
      args.push(user.id);
    }
  }

  // Resolve prefix for help command / display
  let userPrefix = userPrefixCache.get(userId);
  if (userPrefix === undefined) {
    try {
      userPrefix = await firebase.getUserPrefix(userId);
      userPrefixCache.set(userId, userPrefix);
    } catch (err) {
      userPrefix = null;
    }
  }
  let serverPrefix = null;
  if (interaction.guildId) {
    serverPrefix = serverPrefixCache.get(interaction.guildId);
    if (serverPrefix === undefined) {
      try {
        serverPrefix = await firebase.getServerPrefix(interaction.guildId);
        serverPrefixCache.set(interaction.guildId, serverPrefix);
      } catch (err) {
        serverPrefix = null;
      }
    }
  }
  const effectivePrefix = userPrefix !== null ? userPrefix : (serverPrefix !== null ? serverPrefix : PREFIX);

  // Execute unified command runner
  await executeRPGCommand(commandName, args, ctx, effectivePrefix);
});

// Team view display helper
async function showTeamView(message, userId) {
  try {
    const profile = await firebase.getUser(userId);
    const displayName = message.member ? message.member.displayName : message.author.username;
    
    const embed = new EmbedBuilder()
      .setTitle(`👥 ${displayName}'s Team Configurations`)
      .setColor('#2196F3')
      .setDescription(`Manage slots using \`'use on\`, \`'use off1\`, \`'use off2\``);

    for (let i = 0; i < 3; i++) {
      const isCurrent = profile.activeTeamIndex === i;
      const teamObj = profile.teams[i] || {
        onfield: { monster: null, weapon: null },
        offfield1: { monster: null, weapon: null },
        offfield2: { monster: null, weapon: null }
      };
      const activeIndicator = isCurrent ? '▶️ **(ACTIVE)**' : '◽';
      const teamName = teamObj.name || `Team ${i + 1}`;

      let desc = `• **On-Field**: 👾 ${formatMonsterSlot(profile, teamObj.onfield.monster)} / ⚔️ ${formatWeaponSlot(profile, teamObj.onfield.weapon)}\n`;
      desc += `• **Off-Field 1**: 👾 ${formatMonsterSlot(profile, teamObj.offfield1.monster)} / 🛡️ ${formatWeaponSlot(profile, teamObj.offfield1.weapon)}\n`;
      desc += `• **Off-Field 2**: 👾 ${formatMonsterSlot(profile, teamObj.offfield2.monster)} / 🛡️ ${formatWeaponSlot(profile, teamObj.offfield2.weapon)}`;

      embed.addFields({ name: `${activeIndicator} ${teamName}`, value: desc });
    }

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[Show Team View Error]', err);
    return message.reply('❌ Could not retrieve team details.');
  }
}

// ─── HTTP Server for Render Free Tier (Web Service) ───
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      bot: client.isReady() ? 'online' : 'connecting',
      guilds: client.isReady() ? client.guilds.cache.size : 0
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OuterAttic Bot is running!');
  }
});

server.listen(PORT, () => {
  console.log(`[HTTP] Health check server running on port ${PORT}`);
});

// ─── Keep-Alive Cron: Self-ping every 4 minutes to prevent Render free tier spin-down ───
const https = require('https');
const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // 4 minutes
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

setInterval(() => {
  const url = `${RENDER_URL}/health`;
  const client = url.startsWith('https') ? https : http;
  client.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`[Keep-Alive] Pinged ${url} — Status: ${res.statusCode}`);
    });
  }).on('error', (err) => {
    console.warn(`[Keep-Alive] Ping failed: ${err.message}`);
  });
}, KEEP_ALIVE_INTERVAL);

console.log(`[Keep-Alive] Cron initialized — pinging every 4 minutes.`);

// Bot logon
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'your_discord_bot_token_here') {
  console.error('[Bot Error] DISCORD_TOKEN is missing or set to the default placeholder in .env!');
  console.error('[Bot Error] Please set a valid token before running this bot.');
} else {
  client.login(token).catch(err => {
    console.error('[Bot Error] Login failed:', err.message);
  });
}
