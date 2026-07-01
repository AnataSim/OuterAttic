// firebase.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let db = null;

try {
  let serviceAccount = null;

  // Option 1: JSON string from environment variable (for Render / cloud deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('[Firebase] Using service account from FIREBASE_SERVICE_ACCOUNT env var.');
  }
  // Option 2: File-based approach (for local development)
  else {
    const serviceAccountPath = process.env.FIREBASE_KEY_PATH || './firebase-service-account.json';
    const resolvedPath = path.resolve(serviceAccountPath);
    if (fs.existsSync(resolvedPath)) {
      serviceAccount = require(resolvedPath);
      console.log(`[Firebase] Using service account from file: ${resolvedPath}`);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('[Firebase] Initialized successfully.');
  } else {
    console.warn('[Firebase] No service account found (env var or file).');
    console.warn('[Firebase] Commands using database will fail until configured.');
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
  ingot: 0, // Gold Ingot currency
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

  // Revert migration: Convert Ingot grams back to Gold
  if (data.currencyMigrated) {
    data.currency = (data.currency || 0) * 1000000000000000000;
    delete data.currencyMigrated;
    updated = true;
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

  // Enforce gold limit of 3e18 Gold
  if (data.currency !== undefined) {
    const limit = 3000000000000000000;
    if (data.currency > limit) {
      data.currency = limit;
      updated = true;
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
  // Enforce gold limit of 3e18 Gold
  if (profile && profile.currency !== undefined) {
    const limit = 3000000000000000000;
    if (profile.currency > limit) {
      profile.currency = limit;
    }
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

async function getSystemConfig() {
  if (!db) return { adminabuse: false, tax: 0 };
  const docRef = db.collection('rpg_system').doc('config');
  const doc = await docRef.get();
  if (!doc.exists) {
    const defaultConfig = { adminabuse: false, tax: 0 };
    await docRef.set(defaultConfig);
    return defaultConfig;
  }
  return doc.data();
}

async function saveSystemConfig(config) {
  if (!db) return;
  const docRef = db.collection('rpg_system').doc('config');
  await docRef.set(config);
}

module.exports = {
  db,
  getUser,
  saveUser,
  getUserPrefix,
  getServerPrefix,
  saveServerPrefix,
  getSystemConfig,
  saveSystemConfig,
  isInitialized: () => !!db
};

