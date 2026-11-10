// ==========================================
// PLAYER PROFILE & SUPABASE PERSISTENCE SYSTEM
// ==========================================

import { CONFIG } from './config.js';
import { AIRCRAFT_DATA, getUpgradeCost } from './aircraft.js';

const PROFILES_KEY = 'legion_profiles_v1';
const SESSION_KEY = 'legion_session_v1';

export class ProfileManager {
  constructor() {
    this.profiles = this.loadProfiles();
    this.activeProfile = null;
    this.accessToken = null;
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
      if (session && session.rememberMe) {
        const key = (session.username || session.email || '').toLowerCase().trim();
        const profile = this.profiles[key];
        if (profile) {
          this.activeProfile = profile;
          if (session.accessToken) this.accessToken = session.accessToken;
          return this.activeProfile;
        }
      }
    } catch (e) {
      console.warn('[ProfileManager] Failed to retrieve session:', e);
    }
    return null;
  }

  // =========================================================================
  // SUPABASE REGISTRATION FLOW
  // =========================================================================
  async register(username, password, email, rememberMe = false) {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanUser) {
      return { success: false, message: 'USERNAME REQUIRED' };
    }
    if (!cleanPass) {
      return { success: false, message: 'PASSWORD REQUIRED' };
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, message: 'VALID EMAIL IS REQUIRED FOR REGISTRATION' };
    }

    const userKey = cleanUser.toLowerCase();
    if (this.profiles[userKey] || this.profiles[cleanEmail]) {
      return { success: false, message: 'ACCOUNT USERNAME OR EMAIL ALREADY EXISTS' };
    }

    let supabaseId = null;
    let token = null;

    // 1. Call Supabase Auth API
    if (CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPass,
            data: {
              username: cleanUser,
              callsign: cleanUser
            }
          })
        });

        const data = await res.json();
        if (res.ok) {
          supabaseId = data.id || (data.user && data.user.id);
          token = data.access_token || (data.session && data.session.access_token);
          this.accessToken = token;
          console.log('[ProfileManager] Supabase Auth registered successfully:', supabaseId);

          // Update callsign on the Supabase profiles table if we have token
          if (token && supabaseId) {
            await this.syncSupabaseProfile(supabaseId, {
              callsign: cleanUser,
              equipped_plane: 'f15c'
            }, token);
          }
        } else {
          console.warn('[ProfileManager] Supabase Auth response:', data);
          if (data.msg?.includes('already registered') || data.message?.includes('already registered')) {
            return { success: false, message: 'EMAIL ALREADY REGISTERED IN DATABASE' };
          }
        }
      } catch (err) {
        console.warn('[ProfileManager] Supabase connection error:', err);
      }
    }

    // 2. Initialize and save player profile
    const newProfile = {
      id: supabaseId || `pilot_${Date.now()}`,
      username: cleanUser,
      callsign: cleanUser,
      password: cleanPass,
      email: cleanEmail,
      credits: 1000,                  // Starting capital ₡1,000
      level: 1,                       // Starting player level 1
      completedTutorial: false,        // Hangar locked until tutorial completion
      seenHangarTutorial: false,       // 2-page tutorial popup in hangar
      hasChosenStarterPlane: false,    // First tier 0 plane is free
      ownedPlanes: ['f15c'],           // Initial service aircraft
      equippedPlane: 'f15c',
      upgrades: { f15c: 1 },
      equippedSpw: { f15c: '4aam' },
      equippedParts: {},
      stats: {
        sorties: 0,
        kills: 0,
        deaths: 0,
        missionsWon: 0
      },
      createdAt: Date.now()
    };

    // Index by both lowercase username and email for instant login lookups
    this.profiles[userKey] = newProfile;
    this.profiles[cleanEmail] = newProfile;
    this.saveProfiles();
    this.activeProfile = newProfile;

    if (rememberMe) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          username: cleanUser,
          email: cleanEmail,
          accessToken: token,
          rememberMe: true
        }));
      } catch (e) {}
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    return { success: true, profile: newProfile, isFirstLogin: true };
  }

  // =========================================================================
  // SUPABASE LOGIN FLOW
  // =========================================================================
  async login(usernameOrEmail, password, rememberMe = false) {
    if (!usernameOrEmail || !password) {
      return { success: false, message: 'USERNAME AND PASSWORD REQUIRED' };
    }

    const cleanInput = usernameOrEmail.trim();
    const cleanKey = cleanInput.toLowerCase();
    const cleanPass = password.trim();

    // Check local profile first
    let profile = this.profiles[cleanKey];

    // Attempt Supabase authentication if configured
    if (CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const emailToAuth = profile ? profile.email : (cleanInput.includes('@') ? cleanInput : null);

      if (emailToAuth) {
        try {
          const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'apikey': CONFIG.SUPABASE_ANON_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: emailToAuth,
              password: cleanPass
            })
          });

          const data = await res.json();
          if (res.ok && data.access_token) {
            this.accessToken = data.access_token;
            console.log('[ProfileManager] Supabase Auth authenticated successfully');

            // If profile wasn't in local storage, populate from Supabase user metadata
            if (!profile) {
              const u = data.user || {};
              const uname = u.user_metadata?.username || u.user_metadata?.callsign || cleanInput;
              profile = {
                id: u.id,
                username: uname,
                callsign: uname,
                password: cleanPass,
                email: emailToAuth,
                credits: 1000,
                level: 1,
                completedTutorial: false,
                seenHangarTutorial: false,
                hasChosenStarterPlane: false,
                ownedPlanes: ['f15c'],
                equippedPlane: 'f15c',
                upgrades: { f15c: 1 },
                equippedSpw: { f15c: '4aam' },
                equippedParts: {},
                stats: { sorties: 0, kills: 0, deaths: 0, missionsWon: 0 },
                createdAt: Date.now()
              };
              this.profiles[uname.toLowerCase()] = profile;
              this.profiles[emailToAuth.toLowerCase()] = profile;
              this.saveProfiles();
            }
          } else if (data.error_code === 'email_not_confirmed') {
            console.log('[ProfileManager] Supabase email confirmation pending, checking local credentials');
          }
        } catch (err) {
          console.warn('[ProfileManager] Supabase login network error:', err);
        }
      }
    }

    // Verify password against stored profile
    if (profile && profile.password === cleanPass) {
      this.activeProfile = profile;
      if (rememberMe) {
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify({
            username: profile.username,
            email: profile.email,
            accessToken: this.accessToken,
            rememberMe: true
          }));
        } catch (e) {}
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
      return { success: true, profile: this.activeProfile };
    }

    return { success: false, message: 'INVALID USERNAME OR PASSWORD' };
  }

  // Sync profile data to Supabase profiles table
  async syncSupabaseProfile(userId, patchData, token = null) {
    const authHeader = token || this.accessToken;
    if (!CONFIG || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !authHeader) return;
    try {
      await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${authHeader}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(patchData)
      });
    } catch (e) {
      console.warn('[ProfileManager] Failed to sync to Supabase:', e);
    }
  }

  signOut() {
    this.activeProfile = null;
    this.accessToken = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  getPlaneLevel(planeId) {
    if (!this.activeProfile || !this.activeProfile.upgrades) return 1;
    return this.activeProfile.upgrades[planeId] || 1;
  }

  // SP weapon unlock requirements: index 0 (Level 1), index 1 (Level 3), index 2 (Level 5)
  getSpwRequiredLevel(planeId, spwId) {
    if (typeof AIRCRAFT_DATA === 'undefined') return 1;
    const plane = AIRCRAFT_DATA[planeId];
    if (!plane || !plane.weapons || !Array.isArray(plane.weapons.specialWeapons)) return 1;
    const idx = plane.weapons.specialWeapons.indexOf(spwId);
    if (idx === 1) return 3;
    if (idx === 2) return 5;
    return 1;
  }

  isSpwUnlocked(planeId, spwId) {
    const reqLevel = this.getSpwRequiredLevel(planeId, spwId);
    const curLevel = this.getPlaneLevel(planeId);
    return curLevel >= reqLevel;
  }

  getEquippedSpw(planeId) {
    if (typeof AIRCRAFT_DATA === 'undefined') return 'qaam';
    const plane = AIRCRAFT_DATA[planeId];
    const availableSpw = (plane && plane.weapons && plane.weapons.specialWeapons) || ['qaam'];
    const curEquipped = (this.activeProfile && this.activeProfile.equippedSpw && this.activeProfile.equippedSpw[planeId])
      || (plane && plane.weapons && plane.weapons.equippedSpecialWeapon)
      || availableSpw[0];

    // If currently saved weapon is locked for current plane upgrade level, fallback to level 1 default (index 0)
    if (!this.isSpwUnlocked(planeId, curEquipped)) {
      return availableSpw[0];
    }
    return curEquipped;
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

    this.activeProfile.level = Math.max(this.activeProfile.level || 1, newLevel);
    this.saveProfiles();

    if (this.activeProfile.id) {
      this.syncSupabaseProfile(this.activeProfile.id, {
        score: this.activeProfile.credits
      });
    }

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

      if (!this.activeProfile.equippedPlane) {
        this.activeProfile.equippedPlane = planeId;
      }
      this.saveProfiles();

      if (this.activeProfile.id) {
        this.syncSupabaseProfile(this.activeProfile.id, {
          unlocked_planes: this.activeProfile.ownedPlanes
        });
      }
      return true;
    }
    return true;
  }

  setEquippedPlane(planeId) {
    if (!this.activeProfile) return;
    this.activeProfile.equippedPlane = planeId;
    this.saveProfiles();

    if (this.activeProfile.id) {
      this.syncSupabaseProfile(this.activeProfile.id, {
        equipped_plane: planeId
      });
    }
  }

  setEquippedSpw(planeId, spwId) {
    if (!this.activeProfile) return false;
    if (!this.isSpwUnlocked(planeId, spwId)) return false;
    if (!this.activeProfile.equippedSpw) this.activeProfile.equippedSpw = {};
    this.activeProfile.equippedSpw[planeId] = spwId;
    this.saveProfiles();
    return true;
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
      this.activeProfile.credits = (this.activeProfile.credits || 0) + 2500;
    }
    this.saveProfiles();

    if (this.activeProfile.id) {
      this.syncSupabaseProfile(this.activeProfile.id, {
        sorties: this.activeProfile.stats.sorties,
        kills: this.activeProfile.stats.kills,
        deaths: this.activeProfile.stats.deaths,
        wins: this.activeProfile.stats.missionsWon,
        score: this.activeProfile.credits
      });
    }
  }
}

export const profileManager = new ProfileManager();
