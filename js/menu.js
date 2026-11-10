// ==========================================
// TACTICAL UI & MENU CONTROLLER SYSTEM
// ==========================================

import { AIRCRAFT_DATA, isAircraftInShop } from './aircraft.js';
import { profileManager } from './profile.js';
import { HangarManager } from './hangar.js';

// Easily editable Credits & Disclosures catalog for the developer
export const GAME_CREDITS = {
  title: 'CREDITS & DISCLOSURES',
  sections: [
    {
      category: 'LEAD DEVELOPER & ARCHITECT',
      names: ['Alhussein - System Architecture, Design & Engineering']
    },
    {
      category: 'TACTICAL SIMULATION & GAMEPLAY',
      names: ['Web Legion Flight Mechanics & Avionics Engine']
    },
    {
      category: 'AIRCRAFT & ASSET REGISTRY',
      names: ['Tactical Aircraft & Weapon Design Catalogue']
    },
    {
      category: 'AUDIO SYSTEMS',
      names: ['Procedural Web Audio Tactical Sound Synthesizer']
    },
    {
      category: 'DISCLOSURES & NOTICES',
      names: [
        'Codename: Legion is an autonomous tactical browser flight combat experience.',
        'Aircraft silhouettes, designations and military systems are inspired by modern and historical aerospace platforms.',
        'All telemetry and operational profiles are simulated.'
      ]
    }
  ]
};

export class MenuManager {
  constructor(game) {
    this.game = game;
    this.audio = game.audio;
    this.hangar = new HangarManager(this);

    this.activeScreen = null; // 'login' | 'main-menu' | 'sub-menu' | 'hangar' | 'game'
    this.isRegisterMode = false;
    this.rememberMe = false;

    // Navigation state
    this.currentNavItems = [];
    this.selectedIndex = 0;
    this.isCrtEnabled = true;

    // Submenu navigation history
    this.activeSubmenu = null;
  }

  init() {
    this.hangar.init();
    this.bindLoginEvents();
    this.bindMainMenuEvents();
    this.bindGlobalKeyboard();

    // Check auto-login session
    const sessionUser = profileManager.getSavedSession();
    if (sessionUser) {
      console.log(`[MenuManager] Auto-logged in as ${sessionUser.username}`);
      this.showScreen('main-menu');
    } else {
      this.showScreen('login');
    }
  }

  // Set active screen and toggle CRT effect as required
  showScreen(screenName) {
    this.activeScreen = screenName;
    const screens = document.querySelectorAll('.menu-screen');
    screens.forEach(s => s.classList.remove('active'));

    const crtOverlay = document.getElementById('crt-overlay');
    const gameCanvas = document.getElementById('gameCanvas');

    if (screenName === 'game') {
      // Gameplay active: show game canvas, hide all menu screens, strictly disable CRT
      if (gameCanvas) gameCanvas.style.display = 'block';
      if (crtOverlay) crtOverlay.style.display = 'none';
      document.getElementById('menu-system').style.display = 'none';
      return;
    }

    // In any menu screen: gameCanvas is strictly hidden
    if (gameCanvas) gameCanvas.style.display = 'none';
    document.getElementById('menu-system').style.display = 'block';

    if (screenName === 'hangar') {
      // Hangar active: STRICTLY NO CRT EFFECT as requested
      if (crtOverlay) crtOverlay.style.display = 'none';
      const el = document.getElementById('screen-hangar');
      if (el) el.classList.add('active');
      this.hangar.open();
      this.checkHangarTutorialFlow();
    } else if (screenName === 'login') {
      if (crtOverlay) crtOverlay.style.display = 'block';
      const el = document.getElementById('screen-login');
      if (el) el.classList.add('active');
      this.resetLoginForm();
    } else if (screenName === 'main-menu') {
      if (crtOverlay) crtOverlay.style.display = 'block';
      const el = document.getElementById('screen-main-menu');
      if (el) el.classList.add('active');
      this.setupMainMenuNav();
    } else if (screenName === 'sub-menu') {
      if (crtOverlay) crtOverlay.style.display = 'block';
      const el = document.getElementById('screen-sub-menu');
      if (el) el.classList.add('active');
      this.setupSubMenuNav();
    }
  }

  // =========================================================================
  // LOGIN SCREEN (Mockup 1)
  // =========================================================================
  bindLoginEvents() {
    const rememberBox = document.getElementById('login-remember-box');
    rememberBox?.addEventListener('click', () => {
      this.audio.playMenuMove();
      this.rememberMe = !this.rememberMe;
      rememberBox.classList.toggle('checked', this.rememberMe);
    });

    // Single unified submit handler for login & register
    document.getElementById('btn-login-submit')?.addEventListener('click', () => {
      if (this.isRegisterMode) {
        this.handleRegister();
      } else {
        this.handleLogin();
      }
    });

    // Register button: replaces login button with email input
    document.getElementById('btn-toggle-register')?.addEventListener('click', () => {
      this.audio.playMenuSelect();
      this.setRegisterMode(!this.isRegisterMode);
    });

    // Recover button
    document.getElementById('btn-login-recover')?.addEventListener('click', () => {
      this.audio.playMenuSelect();
      this.showToast('PASSWORD RECOVERY // CONTACT FLIGHT SYSTEM ADMINISTRATOR');
    });

    // Enter key submits login/register
    ['login-username', 'login-password', 'login-email'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this.isRegisterMode) {
            this.handleRegister();
          } else {
            this.handleLogin();
          }
        }
      });
    });
  }

  resetLoginForm() {
    this.setRegisterMode(false);
    const userField = document.getElementById('login-username');
    const passField = document.getElementById('login-password');
    const emailField = document.getElementById('login-email');
    if (userField) userField.value = '';
    if (passField) passField.value = '';
    if (emailField) emailField.value = '';
  }

  setRegisterMode(register) {
    this.isRegisterMode = register;
    const emailField = document.getElementById('login-email');
    const loginBtn = document.getElementById('btn-login-submit');
    const registerToggle = document.getElementById('btn-toggle-register');

    if (this.isRegisterMode) {
      if (emailField) emailField.style.display = 'block';
      if (loginBtn) loginBtn.textContent = 'REGISTER';
      if (registerToggle) registerToggle.textContent = 'BACK TO LOGIN';
    } else {
      if (emailField) emailField.style.display = 'none';
      if (loginBtn) loginBtn.textContent = 'LOG IN';
      if (registerToggle) registerToggle.textContent = 'REGISTER';
    }
  }

  async handleLogin() {
    const user = document.getElementById('login-username')?.value;
    const pass = document.getElementById('login-password')?.value;
    const loginBtn = document.getElementById('btn-login-submit');

    this.audio.init();
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = 'VERIFYING...';
    }

    try {
      const res = await profileManager.login(user, pass, this.rememberMe);

      if (res.success) {
        this.audio.playMenuSelect();
        this.showScreen('main-menu');
        this.showToast(`WELCOME BACK, PILOT ${res.profile.username.toUpperCase()}`);
      } else {
        this.audio.playMenuError();
        this.showToast(res.message);
      }
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = this.isRegisterMode ? 'REGISTER' : 'LOG IN';
      }
    }
  }

  async handleRegister() {
    const user = document.getElementById('login-username')?.value;
    const pass = document.getElementById('login-password')?.value;
    const email = document.getElementById('login-email')?.value;
    const loginBtn = document.getElementById('btn-login-submit');

    this.audio.init();
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = 'REGISTERING...';
    }

    try {
      const res = await profileManager.register(user, pass, email, this.rememberMe);

      if (res.success) {
        this.audio.playUpgradeSound();
        this.showScreen('main-menu');
        // Show first login tutorial recommendation popup!
        this.showNewPlayerWelcome(res.profile.username);
      } else {
        this.audio.playMenuError();
        this.showToast(res.message);
      }
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = this.isRegisterMode ? 'REGISTER' : 'LOG IN';
      }
    }
  }

  // First Login Welcome & Tutorial Guide
  showNewPlayerWelcome(username) {
    this.showTacticalModal('NEW PILOT ORIENTATION', `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:16px; color:#f5cb3b; font-weight:700;">
          WELCOME TO CODENAME: LEGION, PILOT ${username.toUpperCase()}!
        </div>
        <div style="font-size:14px; line-height:1.5; color:#dcdce0;">
          Your profile has been credited with <strong>₡ 1,000</strong> initial operational funds.
        </div>
        <div style="background:rgba(30,10,14,0.8); border:1px solid #ff4757; padding:16px;">
          <div style="color:#ff4757; font-weight:700; margin-bottom:8px;">RECOMMENDED FIRST MISSION:</div>
          <div style="color:#c4c4cc; font-size:13px; line-height:1.5;">
            The Combat Hangar remains <strong>LOCKED</strong> until basic flight certification is confirmed.<br><br>
            Please navigate to <strong>SINGLEPLAYER &gt; TUTORIAL</strong> to learn aircraft handling, radar locks, and combat maneuvers.
          </div>
        </div>
        <button id="btn-welcome-ack" class="login-btn-primary" style="margin-top:10px;">
          UNDERSTOOD // PROCEED TO MENU
        </button>
      </div>
    `);

    setTimeout(() => {
      document.getElementById('btn-welcome-ack')?.addEventListener('click', () => {
        this.audio.playMenuSelect();
        this.closeTacticalModal();
      });
    }, 50);
  }

  // =========================================================================
  // MAIN MENU (Mockup 2)
  // =========================================================================
  bindMainMenuEvents() {
    // Menu navigation is wired in setupMainMenuNav dynamically
  }

  setupMainMenuNav() {
    const listEl = document.getElementById('main-menu-items');
    const cursor = document.getElementById('main-menu-cursor');
    if (!listEl) return;

    this.currentNavItems = Array.from(listEl.querySelectorAll('.menu-nav-item'));
    this.selectedIndex = 0;

    this.currentNavItems.forEach((item, idx) => {
      item.onmouseenter = () => {
        this.setSelectedIndex(idx, false);
      };
      item.onclick = () => {
        this.executeMenuItem(item.getAttribute('data-action'));
      };
    });

    this.updateCursorPosition();
  }

  setupSubMenuNav() {
    const listEl = document.getElementById('sub-menu-items');
    if (!listEl) return;

    this.currentNavItems = Array.from(listEl.querySelectorAll('.menu-nav-item'));
    this.selectedIndex = 0;

    this.currentNavItems.forEach((item, idx) => {
      item.onmouseenter = () => {
        this.setSelectedIndex(idx, false);
      };
      item.onclick = () => {
        this.executeSubMenuItem(item.getAttribute('data-action'));
      };
    });

    this.updateCursorPosition('sub-menu-cursor');
  }

  setSelectedIndex(index, playSound = true) {
    if (index < 0 || index >= this.currentNavItems.length) return;
    if (this.selectedIndex !== index && playSound) {
      this.audio.playMenuMove();
    }
    this.selectedIndex = index;
    this.updateCursorPosition(this.activeScreen === 'sub-menu' ? 'sub-menu-cursor' : 'main-menu-cursor');
  }

  updateCursorPosition(cursorId = 'main-menu-cursor') {
    const cursor = document.getElementById(cursorId);
    if (!cursor || !this.currentNavItems[this.selectedIndex]) return;

    this.currentNavItems.forEach((it, idx) => {
      it.classList.toggle('selected', idx === this.selectedIndex);
    });

    const target = this.currentNavItems[this.selectedIndex];
    cursor.style.top = `${target.offsetTop}px`;
    cursor.style.height = `${target.offsetHeight}px`;
  }

  // Handle Main Menu Actions
  executeMenuItem(action) {
    this.audio.playMenuSelect();
    const profile = profileManager.activeProfile;

    switch (action) {
      case 'hangar':
        if (!profile || !profile.completedTutorial) {
          this.audio.playMenuError();
          this.showToast('HANGAR LOCKED // MUST COMPLETE TUTORIAL MISSION FIRST');
        } else {
          this.showScreen('hangar');
        }
        break;

      case 'shop':
        this.audio.playMenuError();
        this.showToast('SHOP // COMING SOON');
        break;

      case 'multiplayer':
        this.showToast('MULTIPLAYER DOGFIGHT // COMING SOON');
        break;

      case 'singleplayer':
        this.showScreen('sub-menu');
        break;

      case 'legion-mode':
        this.showToast('LEGION MODE // COMING SOON');
        break;

      case 'profile-data':
        this.openProfileModal();
        break;

      case 'settings':
        this.openSettingsModal();
        break;

      case 'credits':
        this.openCreditsModal();
        break;

      case 'sign-out':
        profileManager.signOut();
        this.showScreen('login');
        this.showToast('LOGGED OUT // SESSION TERMINATED');
        break;
    }
  }

  // Handle Sub Menu Actions
  executeSubMenuItem(action) {
    switch (action) {
      case 'campaigns':
        this.audio.playMenuError();
        this.showToast('CAMPAIGN MISSIONS // COMING SOON');
        break;

      case 'single-missions':
        this.audio.playMenuError();
        this.showToast('TACTICAL SCENARIOS // COMING SOON');
        break;

      case 'tutorial':
        this.audio.playMenuSelect();
        this.launchMission('tutorial');
        break;

      case 'test-flight':
        this.audio.playMenuSelect();
        this.launchMission('test_flight');
        break;

      case 'back':
        this.audio.playMenuBack();
        this.showScreen('main-menu');
        break;
    }
  }

  // Launch a playable mission into the game loop
  launchMission(missionId) {
    this.showScreen('game');
    const profile = profileManager.activeProfile;
    const planeId = (profile && profile.equippedPlane) ? profile.equippedPlane : 'f15c';
    const spwId = (profile && profile.equippedSpw && profile.equippedSpw[planeId])
      ? profile.equippedSpw[planeId]
      : (AIRCRAFT_DATA[planeId]?.weapons?.equippedSpecialWeapon || '4aam');

    this.game.startMissionFlow(missionId, planeId, spwId);
  }

  // Global Keyboard Navigation (Arrows, Enter, Escape)
  bindGlobalKeyboard() {
    window.addEventListener('keydown', (e) => {
      // If a modal is open, ESC closes it
      const activeModal = document.querySelector('.modal-backdrop.active');
      if (e.key === 'Escape') {
        if (activeModal) {
          this.audio.playMenuBack();
          activeModal.classList.remove('active');
          return;
        }
        if (this.activeScreen === 'sub-menu') {
          this.audio.playMenuBack();
          this.showScreen('main-menu');
          return;
        }
        if (this.activeScreen === 'hangar') {
          this.audio.playMenuBack();
          this.showScreen('main-menu');
          return;
        }
      }

      if (this.activeScreen === 'main-menu' || this.activeScreen === 'sub-menu') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const next = (this.selectedIndex - 1 + this.currentNavItems.length) % this.currentNavItems.length;
          this.setSelectedIndex(next, true);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = (this.selectedIndex + 1) % this.currentNavItems.length;
          this.setSelectedIndex(next, true);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const cur = this.currentNavItems[this.selectedIndex];
          if (cur) cur.click();
        }
      }
    });
  }

  // =========================================================================
  // HANGAR ONBOARDING & FIRST PLANE FLOW
  // =========================================================================
  checkHangarTutorialFlow() {
    const profile = profileManager.activeProfile;
    if (!profile) return;

    // 1. Multi-page Hangar Tutorial Popup
    if (!profile.seenHangarTutorial) {
      this.showHangarTutorialPopup(1);
    } else if (!profile.hasChosenStarterPlane) {
      // 2. Free Starter Tier 0 Plane Prompt
      this.showStarterPlanePicker();
    }
  }

  showHangarTutorialPopup(page = 1) {
    const contentPage1 = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="font-size:16px; color:#f5cb3b; font-weight:700;">
          PAGE 1/2 // HANGAR OPERATIONS & AIRFRAME STATUS
        </div>
        <div style="font-size:13px; line-height:1.6; color:#dcdce0;">
          Welcome to your Tactical Combat Hangar. This facility houses your flight inventory, maintenance records, and aircraft upgrade systems.<br><br>
          • <strong>SELECT AIRCRAFT</strong> allows you to switch between acquired fighters.<br>
          • <strong>UPGRADE AIRCRAFT</strong> enhances engine thrust, agility, and defensive systems up to Level 5.<br>
          • <strong>PART SLOTS</strong> on the bottom deck allow equipping tactical avionics pods.
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:12px;">
          <button id="btn-tut-next" class="login-btn-primary" style="width:160px;">
            NEXT PAGE &gt;
          </button>
        </div>
      </div>
    `;

    const contentPage2 = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="font-size:16px; color:#f5cb3b; font-weight:700;">
          PAGE 2/2 // SPIDER RADAR & SPECIAL WEAPONS
        </div>
        <div style="font-size:13px; line-height:1.6; color:#dcdce0;">
          Your aircraft performance is tracked across 4 strategic axes:<br>
          • <strong>DEF</strong> (Armor rating & damage reduction)<br>
          • <strong>AIR</strong> (Air-to-Air combat efficiency)<br>
          • <strong>AGILE</strong> (High-G pitch authority & cornering speed)<br>
          • <strong>GRND</strong> (Surface attack payload & bomb effectiveness)<br><br>
          Click the <strong>EQUIPPED WEAPON</strong> container on the bottom right anytime to reconfigure your Special Weapon payload.
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-top:12px;">
          <button id="btn-tut-prev" class="login-btn-secondary" style="width:140px;">
            &lt; PREVIOUS
          </button>
          <button id="btn-tut-finish" class="login-btn-primary" style="width:180px;">
            COMPLETE TUTORIAL
          </button>
        </div>
      </div>
    `;

    this.showTacticalModal('HANGAR FLIGHT BRIEFING', page === 1 ? contentPage1 : contentPage2);

    setTimeout(() => {
      document.getElementById('btn-tut-next')?.addEventListener('click', () => {
        this.audio.playMenuSelect();
        this.showHangarTutorialPopup(2);
      });
      document.getElementById('btn-tut-prev')?.addEventListener('click', () => {
        this.audio.playMenuBack();
        this.showHangarTutorialPopup(1);
      });
      document.getElementById('btn-tut-finish')?.addEventListener('click', () => {
        this.audio.playUpgradeSound();
        profileManager.markHangarTutorialSeen();
        this.closeTacticalModal();
        // Prompt for free starter plane!
        this.showStarterPlanePicker();
      });
    }, 50);
  }

  showStarterPlanePicker() {
    const starterIds = ['a4', 'etendard', 'mig17'];
    let cardsHtml = '<div class="shop-grid">';

    starterIds.forEach(id => {
      const p = AIRCRAFT_DATA[id];
      if (!p) return;
      cardsHtml += `
        <div class="shop-plane-card" data-starter-id="${id}">
          <img src="${p.sprite}" class="shop-plane-img" alt="${p.name}">
          <div class="shop-plane-name">${p.name}</div>
          <div style="font-size:11px; color:#2ecc71; font-weight:700;">FREE (FIRST TIER 0 AIRCRAFT)</div>
          <div style="font-size:11px; color:#b0b0b8; margin-top:4px;">${p.role}</div>
          <button class="shop-plane-buy-btn" style="background:#2ecc71; color:#000;">
            CLAIM FREE
          </button>
        </div>
      `;
    });
    cardsHtml += '</div>';

    this.showTacticalModal('COMMISSION YOUR FIRST FIGHTER (FREE)', `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="color:#f5cb3b; font-size:14px; font-weight:700;">
          SELECT YOUR TIER 0 STARTER AIRCRAFT:
        </div>
        <div style="font-size:12px; color:#c4c4cc;">
          As a newly certified pilot, your first Tier 0 aircraft is completely free. Subsequent Tier 0 aircraft will cost ₡ 1,000 credits.
        </div>
        ${cardsHtml}
      </div>
    `);

    setTimeout(() => {
      document.querySelectorAll('.shop-plane-card[data-starter-id]').forEach(card => {
        card.addEventListener('click', () => {
          const starterId = card.getAttribute('data-starter-id');
          if (starterId && AIRCRAFT_DATA[starterId]) {
            this.audio.playUpgradeSound();
            profileManager.acquirePlane(starterId, 0);
            profileManager.setEquippedPlane(starterId);
            profileManager.activeProfile.hasChosenStarterPlane = true;
            profileManager.saveProfiles();

            this.hangar.equippedPlaneId = starterId;
            this.hangar.refreshHangarView();
            this.hangar.renderSpiderGraph();

            this.closeTacticalModal();
            this.showToast(`COMMISSIONED ${AIRCRAFT_DATA[starterId].name.toUpperCase()} // READY FOR SERVICE`);
          }
        });
      });
    }, 50);
  }

  // =========================================================================
  // PLANE SHOP
  // =========================================================================
  openShopModal() {
    const profile = profileManager.activeProfile;
    const haveCredits = profile ? profile.credits : 0;

    // Filter out HIDDEN, SECRET, and EVO planes!
    const availablePlanes = Object.values(AIRCRAFT_DATA).filter(p => isAircraftInShop(p));

    let html = `
      <div style="margin-bottom:12px; font-size:14px; color:#f5cb3b; font-weight:700;">
        AVAILABLE CREDITS: ₡ ${haveCredits.toLocaleString()}
      </div>
      <div class="shop-grid">
    `;

    availablePlanes.forEach(p => {
      const isOwned = profile && profile.ownedPlanes && profile.ownedPlanes.includes(p.id);
      let cost = p.cost || 1000;
      let costLabel = `₡ ${cost.toLocaleString()}`;

      if (p.tier === 0 && (!profile || !profile.hasChosenStarterPlane)) {
        cost = 0;
        costLabel = 'FREE';
      }

      html += `
        <div class="shop-plane-card" data-shop-plane="${p.id}">
          <img src="${p.sprite}" class="shop-plane-img" alt="${p.name}">
          <div class="shop-plane-name">${p.name}</div>
          <div style="font-size:12px; color:#c4c4cc;">TIER ${p.tier !== undefined ? p.tier : 0} // ${p.planeRole || 'MULTIROLE'}</div>
          <div class="shop-plane-price">${isOwned ? 'ACQUIRED' : costLabel}</div>
          <button class="shop-plane-buy-btn" ${isOwned ? 'disabled style="opacity:0.5;"' : ''}>
            ${isOwned ? 'IN HANGAR' : (cost === 0 ? 'CLAIM FREE' : 'PURCHASE')}
          </button>
        </div>
      `;
    });

    html += '</div>';

    this.showTacticalModal('TACTICAL AIRCRAFT SHOP', html);

    setTimeout(() => {
      document.querySelectorAll('.shop-plane-card[data-shop-plane]').forEach(card => {
        card.addEventListener('click', () => {
          const planeId = card.getAttribute('data-shop-plane');
          const p = AIRCRAFT_DATA[planeId];
          if (!p || (profile && profile.ownedPlanes && profile.ownedPlanes.includes(planeId))) {
            return;
          }

          let cost = p.cost || 1000;
          if (p.tier === 0 && (!profile || !profile.hasChosenStarterPlane)) {
            cost = 0;
          }

          if ((profile.credits || 0) < cost) {
            this.audio.playMenuError();
            this.showToast('INSUFFICIENT CREDITS');
            return;
          }

          this.audio.playUpgradeSound();
          profileManager.acquirePlane(planeId, cost);
          if (cost === 0) profile.hasChosenStarterPlane = true;
          profileManager.saveProfiles();

          this.closeTacticalModal();
          this.showToast(`PURCHASED ${p.name.toUpperCase()} // TRANSFERRED TO HANGAR`);
        });
      });
    }, 50);
  }

  // =========================================================================
  // CREDITS & DISCLOSURES MODAL (Easily editable by developer)
  // =========================================================================
  openCreditsModal() {
    let sectionsHtml = '';
    GAME_CREDITS.sections.forEach(sec => {
      sectionsHtml += `
        <div style="margin-bottom:16px;">
          <div style="color:#ff4757; font-weight:700; font-size:14px; letter-spacing:2px; margin-bottom:6px;">
            // ${sec.category}
          </div>
          <div style="color:#dcdce0; font-size:13px; line-height:1.5;">
            ${sec.names.map(n => `<div>• ${n}</div>`).join('')}
          </div>
        </div>
      `;
    });

    this.showTacticalModal(GAME_CREDITS.title, sectionsHtml);
  }

  // =========================================================================
  // SETTINGS MODAL (SFX Volume Slider & Audio Test)
  // =========================================================================
  openSettingsModal() {
    const currentVol = Math.round((this.audio.masterVolume !== undefined ? this.audio.masterVolume : 0.7) * 100);

    const html = `
      <div style="display:flex; flex-direction:column; gap:20px; padding:6px 0;">
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:700;">
            <label for="settings-volume-slider">TACTICAL SFX / MASTER VOLUME</label>
            <span id="settings-volume-disp" style="color:#f5cb3b;">${currentVol}%</span>
          </div>
          <input type="range" id="settings-volume-slider" class="volume-slider" min="0" max="100" value="${currentVol}">
        </div>
        <div style="display:flex; gap:12px;">
          <button id="btn-settings-test-audio" class="login-btn-secondary">
            TEST AUDIO CHIRP
          </button>
        </div>
      </div>
    `;

    this.showTacticalModal('TACTICAL GAME SETTINGS', html);

    setTimeout(() => {
      const slider = document.getElementById('settings-volume-slider');
      const disp = document.getElementById('settings-volume-disp');
      const testBtn = document.getElementById('btn-settings-test-audio');

      slider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (disp) disp.textContent = `${val}%`;
        this.audio.setMasterVolume(val / 100);
      });

      testBtn?.addEventListener('click', () => {
        this.audio.playTargetDesignateSound();
      });
    }, 50);
  }

  // =========================================================================
  // PROFILE DATA MODAL
  // =========================================================================
  openProfileModal() {
    const profile = profileManager.activeProfile;
    if (!profile) return;

    const html = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="font-size:20px; font-weight:900; color:#ffffff;">
          CALLSIGN: <span style="color:#f5cb3b;">${profile.username.toUpperCase()}</span>
        </div>
        <div style="font-size:13px; color:#b0b0b8;">
          EMAIL: ${profile.email} // RANK LEVEL: ${profile.level || 1}
        </div>
        <div style="background:rgba(20,20,24,0.8); border:1px solid #4a4a52; padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>OPERATIONAL CREDITS: <span style="color:#f5cb3b; font-weight:700;">₡ ${Number(profile.credits || 0).toLocaleString()}</span></div>
          <div>FLIGHT CERTIFICATION: <span style="color:${profile.completedTutorial ? '#2ecc71' : '#ff4757'}; font-weight:700;">${profile.completedTutorial ? 'VERIFIED' : 'PENDING'}</span></div>
          <div>TOTAL SORTIES: <strong>${profile.stats?.sorties || 0}</strong></div>
          <div>CONFIRMED KILLS: <strong>${profile.stats?.kills || 0}</strong></div>
          <div>MISSIONS WON: <strong>${profile.stats?.missionsWon || 0}</strong></div>
          <div>LOSSES / DEATHS: <strong>${profile.stats?.deaths || 0}</strong></div>
        </div>
        <div style="font-size:12px; color:#c4c4cc;">
          AIRCRAFT IN SERVICE: ${(profile.ownedPlanes || []).map(id => AIRCRAFT_DATA[id]?.name || id).join(', ') || 'NONE'}
        </div>
      </div>
    `;

    this.showTacticalModal('PILOT DOSSIER // PROFILE DATA', html);
  }

  // =========================================================================
  // GENERIC TACTICAL MODAL CONTROLLER
  // =========================================================================
  showTacticalModal(title, htmlContent) {
    const modal = document.getElementById('modal-tactical-generic');
    const titleEl = document.getElementById('tactical-modal-title');
    const contentEl = document.getElementById('tactical-modal-content');
    const closeBtn = document.getElementById('btn-close-tactical-modal');

    if (!modal) return;
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = htmlContent;

    closeBtn.onclick = () => {
      this.audio.playMenuBack();
      this.closeTacticalModal();
    };

    modal.classList.add('active');
  }

  closeTacticalModal() {
    const modal = document.getElementById('modal-tactical-generic');
    if (modal) modal.classList.remove('active');
  }

  // Toast Notification HUD
  showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'tactical-toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
}

