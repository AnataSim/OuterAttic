// firebase.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const serviceAccountPath = process.env.FIREBASE_KEY_PATH || './firebase-service-account.json';
const resolvedPath = path.resolve(serviceAccountPath);

let db = null;

try {
  if (fs.existsSync(resolvedPath)) {
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log(`[Firebase] Initialized successfully using: ${resolvedPath}`);
  } else {
    console.warn(`[Firebase] Service account JSON file not found at: ${resolvedPath}.`);
    console.warn(`[Firebase] Commands using database will fail until file is configured.`);
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize:', error.message);
  console.error('[Firebase] Database operations will be unavailable.');
}

const DEFAULT_PROFILE = (userId) => ({
  userId: userId,
  level: 1,
  xp: 0,
  currency: 100, // start with some gold
  huntMarks: 0,
  elementalStones: 0,
  dex: {
    monsters: [],
    weapons: []
  },
  monsterLevels: {},
  weaponLevels: {},
  teams: [
    {
      name: 'Team 1',
      onfield: { monster: null, weapon: null },
      offfield1: { monster: null, weapon: null },
      offfield2: { monster: null, weapon: null }
    },
    {
      name: 'Team 2',
      onfield: { monster: null, weapon: null },
      offfield1: { monster: null, weapon: null },
      offfield2: { monster: null, weapon: null }
    },
    {
      name: 'Team 3',
      onfield: { monster: null, weapon: null },
      offfield1: { monster: null, weapon: null },
      offfield2: { monster: null, weapon: null }
    }
  ],
  activeTeamIndex: 0,
  settings: {
    lootLayout: 'simple',
    huntLayout: 'informative',
    prefix: null
  }
});

async function getUser(userId) {
  if (!db) {
    throw new Error('Database is not initialized. Please verify firebase-service-account.json.');
  }

  const docRef = db.collection('rpg_users').doc(userId);
  const doc = await docRef.get();

  if (!doc.exists) {
    const newProfile = DEFAULT_PROFILE(userId);
    await docRef.set(newProfile);
    return newProfile;
  }

  // Merge default keys to support schema migration
  const data = doc.data();
  let updated = false;
  const defaults = DEFAULT_PROFILE(userId);

  for (const key in defaults) {
    if (data[key] === undefined) {
      data[key] = defaults[key];
      updated = true;
    }
  }

  // Migrate monster levels from forge to enchanted
  if (data.monsterLevels) {
    for (const mName in data.monsterLevels) {
      const entry = data.monsterLevels[mName];
      if (entry && entry.forge !== undefined) {
        entry.enchanted = entry.forge;
        delete entry.forge;
        updated = true;
      }
    }
  }

  if (!data.settings) {
    data.settings = { lootLayout: 'simple', huntLayout: 'informative', prefix: null };
    updated = true;
  } else {
    if (data.settings.lootLayout === undefined) {
      data.settings.lootLayout = 'simple';
      updated = true;
    }
    if (data.settings.huntLayout === undefined) {
      data.settings.huntLayout = 'informative';
      updated = true;
    }
    if (data.settings.prefix === undefined) {
      data.settings.prefix = null;
      updated = true;
    }
  }

  if (!data.dex) {
    data.dex = { monsters: [], weapons: [] };
    updated = true;
  } else {
    if (!data.dex.monsters) { data.dex.monsters = []; updated = true; }
    if (!data.dex.weapons) { data.dex.weapons = []; updated = true; }
  }

  if (!data.teams || !Array.isArray(data.teams) || data.teams.length !== 3) {
    data.teams = defaults.teams;
    updated = true;
  } else {
    // Check if we need to migrate the teams structure to onfield/offfield
    for (let i = 0; i < 3; i++) {
      if (data.teams[i] && data.teams[i].onfield === undefined) {
        const oldTeam = data.teams[i];
        data.teams[i] = {
          name: oldTeam.name || `Team ${i + 1}`,
          onfield: {
            monster: oldTeam.monster || null,
            weapon: oldTeam.weapon || null
          },
          offfield1: { monster: null, weapon: null },
          offfield2: { monster: null, weapon: null }
        };
        updated = true;
      }
      if (data.teams[i] && !data.teams[i].name) {
        data.teams[i].name = `Team ${i + 1}`;
        updated = true;
      }
    }
  }

  if (updated) {
    await docRef.set(data);
  }

  return data;
}

async function saveUser(userId, profile) {
  if (!db) {
    throw new Error('Database is not initialized.');
  }
  const docRef = db.collection('rpg_users').doc(userId);
  await docRef.set(profile);
}

async function getUserPrefix(userId) {
  if (!db || !userId) return null;
  const docRef = db.collection('rpg_users').doc(userId);
  const doc = await docRef.get();
  if (doc.exists) {
    const data = doc.data();
    return (data.settings && data.settings.prefix) || null;
  }
  return null;
}

async function getServerPrefix(guildId) {
  if (!db || !guildId) return null;
  const docRef = db.collection('rpg_servers').doc(guildId);
  const doc = await docRef.get();
  if (doc.exists) {
    return doc.data().prefix || null;
  }
  return null;
}

async function saveServerPrefix(guildId, prefix) {
  if (!db || !guildId) return;
  const docRef = db.collection('rpg_servers').doc(guildId);
  await docRef.set({ prefix });
}

module.exports = {
  db,
  getUser,
  saveUser,
  getUserPrefix,
  getServerPrefix,
  saveServerPrefix,
  isInitialized: () => !!db
};

