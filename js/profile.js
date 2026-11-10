// ==========================================
// PLAYER PROFILE & LOCAL PERSISTENCE SYSTEM
// ==========================================

import { getUpgradeCost } from './aircraft.js';

const PROFILES_KEY = 'legion_profiles_v1';
const SESSION_KEY = 'legion_session_v1';

export class ProfileManager {
  constructor() {
    this.profiles = this.loadProfiles();
    this.activeProfile = null;
  }

  loadProfiles() {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(PROFILES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('[ProfileManager] Failed to load profiles from localStorage:', e);
      return {};
    }
  }

  saveProfiles() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(PROFILES_KEY, JSON.stringify(this.profiles));
    } catch (e) {
      console.warn('[ProfileManager] Failed to save profiles to localStorage:', e);
    }
  }

  getSavedSession() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session && session.username && session.rememberMe && this.profiles[session.username]) {
        this.activeProfile = this.profiles[session.username];
        return this.activeProfile;
      }
    } catch (e) {
      console.warn('[ProfileManager] Failed to retrieve session:', e);
    }
    return null;
  }

  login(username, password, rememberMe = false) {
    if (!username || !password) {
      return { success: false, message: 'USERNAME AND PASSWORD REQUIRED' };
    }
    const cleanUser = username.trim();
    const user = this.profiles[cleanUser];
    if (!user || user.password !== password) {
      return { success: false, message: 'INVALID USERNAME OR PASSWORD' };
    }

    this.activeProfile = user;
    if (rememberMe) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: cleanUser, rememberMe: true }));
      } catch (e) {}
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    return { success: true, profile: this.activeProfile };
  }

  register(username, password, email, rememberMe = false) {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();
    const cleanEmail = (email || '').trim();

    if (!cleanUser) {
      return { success: false, message: 'USERNAME REQUIRED' };
    }
    if (!cleanPass) {
      return { success: false, message: 'PASSWORD REQUIRED' };
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, message: 'VALID EMAIL IS REQUIRED FOR REGISTRATION' };
    }
    if (this.profiles[cleanUser]) {
      return { success: false, message: 'ACCOUNT USERNAME ALREADY EXISTS' };
    }

    // Initialize new player profile according to specification
    const newProfile = {
      username: cleanUser,
      password: cleanPass,
      email: cleanEmail,
      credits: 1000,                  // Starting capital ₡1,000
      level: 1,                       // Starting player level 1
      completedTutorial: false,        // Hangar locked until tutorial completion
      seenHangarTutorial: false,       // 2-page tutorial popup in hangar
      hasChosenStarterPlane: false,    // First tier 0 plane is free
      ownedPlanes: [],                 // Empty initially; picked in shop
      equippedPlane: null,
      upgrades: {},                    // { [planeId]: currentLevel (1-5) }
      equippedSpw: {},                 // { [planeId]: spwId }
      equippedParts: {},               // { [planeId]: [partId, ...] }
      stats: {
        sorties: 0,
        kills: 0,
        deaths: 0,
        missionsWon: 0
      },
      createdAt: Date.now()
    };

    this.profiles[cleanUser] = newProfile;
    this.saveProfiles();
    this.activeProfile = newProfile;

    if (rememberMe) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username: cleanUser, rememberMe: true }));
      } catch (e) {}
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    return { success: true, profile: newProfile, isFirstLogin: true };
  }

  signOut() {
    this.activeProfile = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  getPlaneLevel(planeId) {
    if (!this.activeProfile || !this.activeProfile.upgrades) return 1;
    return this.activeProfile.upgrades[planeId] || 1;
  }

  canUpgrade(planeId, baseCost) {
    if (!this.activeProfile) return { can: false, reason: 'NOT_LOGGED_IN' };
    const curLevel = this.getPlaneLevel(planeId);
    if (curLevel >= 5) {
      return { can: false, reason: 'MAX_LEVEL', isEvoReady: true };
    }
    const cost = getUpgradeCost(baseCost, curLevel);
    if ((this.activeProfile.credits || 0) < cost) {
      return { can: false, reason: 'INSUFFICIENT_CREDITS', cost, have: this.activeProfile.credits || 0 };
    }
    return { can: true, cost, nextLevel: curLevel + 1 };
  }

  upgradePlane(planeId, baseCost) {
    const check = this.canUpgrade(planeId, baseCost);
    if (!check.can) return check;

    this.activeProfile.credits -= check.cost;
    if (!this.activeProfile.upgrades) this.activeProfile.upgrades = {};
    const newLevel = check.nextLevel;
    this.activeProfile.upgrades[planeId] = newLevel;

    // Recalculate player level as highest plane upgrade or progression
    this.activeProfile.level = Math.max(this.activeProfile.level || 1, newLevel);

    this.saveProfiles();
    return { success: true, newLevel, remainingCredits: this.activeProfile.credits };
  }

  acquirePlane(planeId, cost = 0) {
    if (!this.activeProfile) return false;
    if (!this.activeProfile.ownedPlanes) this.activeProfile.ownedPlanes = [];
    if (!this.activeProfile.ownedPlanes.includes(planeId)) {
      if (cost > 0) {
        if ((this.activeProfile.credits || 0) < cost) return false;
        this.activeProfile.credits -= cost;
      }
      this.activeProfile.ownedPlanes.push(planeId);
      if (!this.activeProfile.upgrades) this.activeProfile.upgrades = {};
      if (!this.activeProfile.upgrades[planeId]) this.activeProfile.upgrades[planeId] = 1;

      // Equip if first plane
      if (!this.activeProfile.equippedPlane) {
        this.activeProfile.equippedPlane = planeId;
      }
      this.saveProfiles();
      return true;
    }
    return true;
  }

  setEquippedPlane(planeId) {
    if (!this.activeProfile) return;
    this.activeProfile.equippedPlane = planeId;
    this.saveProfiles();
  }

  setEquippedSpw(planeId, spwId) {
    if (!this.activeProfile) return;
    if (!this.activeProfile.equippedSpw) this.activeProfile.equippedSpw = {};
    this.activeProfile.equippedSpw[planeId] = spwId;
    this.saveProfiles();
  }

  setEquippedParts(planeId, partsArray) {
    if (!this.activeProfile) return;
    if (!this.activeProfile.equippedParts) this.activeProfile.equippedParts = {};
    this.activeProfile.equippedParts[planeId] = partsArray;
    this.saveProfiles();
  }

  completeTutorial() {
    if (!this.activeProfile) return;
    this.activeProfile.completedTutorial = true;
    this.saveProfiles();
  }

  markHangarTutorialSeen() {
    if (!this.activeProfile) return;
    this.activeProfile.seenHangarTutorial = true;
    this.saveProfiles();
  }

  recordSortie(won = false, kills = 0, deaths = 0) {
    if (!this.activeProfile) return;
    if (!this.activeProfile.stats) {
      this.activeProfile.stats = { sorties: 0, kills: 0, deaths: 0, missionsWon: 0 };
    }
    this.activeProfile.stats.sorties = (this.activeProfile.stats.sorties || 0) + 1;
    this.activeProfile.stats.kills = (this.activeProfile.stats.kills || 0) + kills;
    this.activeProfile.stats.deaths = (this.activeProfile.stats.deaths || 0) + deaths;
    if (won) {
      this.activeProfile.stats.missionsWon = (this.activeProfile.stats.missionsWon || 0) + 1;
      this.activeProfile.credits = (this.activeProfile.credits || 0) + 2500; // Mission reward
    }
    this.saveProfiles();
  }
}

export const profileManager = new ProfileManager();
