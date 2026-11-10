// ==========================================
// TACTICAL HANGAR & SPECIFICATION SYSTEM
// ==========================================

import { AIRCRAFT_DATA, SPECIAL_WEAPONS, getUpgradeCost, getUpgradeStatMultiplier } from './aircraft.js';
import { profileManager } from './profile.js';

export class HangarManager {
  constructor(menuManager) {
    this.menu = menuManager;
    this.equippedPlaneId = 'f15c';
    this.canvas = null;
    this.ctx = null;
    this.spiderCanvas = null;
    this.spiderCtx = null;
    this.upgradeSpiderCanvas = null;
    this.upgradeSpiderCtx = null;
    this.resizeBound = false;
  }

  init() {
    this.canvas = document.getElementById('hangar-tarmac-canvas');
    if (this.canvas) this.ctx = this.canvas.getContext('2d');

    this.spiderCanvas = document.getElementById('hangar-spider-canvas');
    if (this.spiderCanvas) this.spiderCtx = this.spiderCanvas.getContext('2d');

    this.upgradeSpiderCanvas = document.getElementById('upgrade-spider-canvas');
    if (this.upgradeSpiderCanvas) this.upgradeSpiderCtx = this.upgradeSpiderCanvas.getContext('2d');

    if (!this.resizeBound) {
      window.addEventListener('resize', () => {
        if (this.menu.activeScreen === 'hangar') {
          this.renderTarmac();
          this.renderSpiderGraph();
        }
      });
      this.resizeBound = true;
    }

    this.bindEvents();
  }

  bindEvents() {
    // Action buttons
    document.getElementById('btn-hangar-select-plane')?.addEventListener('click', () => {
      this.menu.audio.playMenuSelect();
      this.openSelectAircraftModal();
    });

    document.getElementById('btn-hangar-upgrade')?.addEventListener('click', () => {
      this.menu.audio.playMenuSelect();
      this.openUpgradeModal();
    });

    document.getElementById('btn-hangar-inventory')?.addEventListener('click', () => {
      this.menu.audio.playMenuSelect();
      this.menu.showToast('INVENTORY // CRATES & FORMS COMING SOON');
    });

    document.getElementById('btn-hangar-save-loadout')?.addEventListener('click', () => {
      this.menu.audio.playMenuSelect();
      profileManager.saveProfiles();
      this.menu.showToast('TACTICAL LOADOUT SAVED // READY FOR SORTIE');
    });

    document.getElementById('btn-hangar-back')?.addEventListener('click', () => {
      this.menu.audio.playMenuBack();
      this.menu.showScreen('main-menu');
    });

    // Equipped weapon box
    document.getElementById('hangar-spw-box')?.addEventListener('click', () => {
      this.menu.audio.playMenuSelect();
      this.openSpwSelectModal();
    });

    // Close buttons for modals
    document.getElementById('btn-close-spw-modal')?.addEventListener('click', () => {
      this.menu.audio.playMenuBack();
      this.closeModal('modal-spw-select');
    });

    document.getElementById('btn-upgrade-cancel')?.addEventListener('click', () => {
      this.menu.audio.playMenuBack();
      this.closeModal('modal-upgrade-confirm');
    });

    document.getElementById('btn-upgrade-confirm')?.addEventListener('click', () => {
      this.performUpgrade();
    });

    document.getElementById('btn-upgrade-form')?.addEventListener('click', () => {
      this.menu.audio.playMenuError();
      this.menu.showToast('NO UPGRADE FORMS AVAILABLE IN INVENTORY');
    });
  }

  open() {
    const profile = profileManager.activeProfile;
    if (!profile) return;

    // Check equipped plane
    if (profile.equippedPlane && AIRCRAFT_DATA[profile.equippedPlane]) {
      this.equippedPlaneId = profile.equippedPlane;
    } else if (profile.ownedPlanes && profile.ownedPlanes.length > 0) {
      this.equippedPlaneId = profile.ownedPlanes[0];
      profileManager.setEquippedPlane(this.equippedPlaneId);
    } else {
      // Default fallback starter plane
      this.equippedPlaneId = 'f15c';
    }

    this.refreshHangarView();
    this.renderTarmac();
    this.renderSpiderGraph();
  }

  refreshHangarView() {
    const profile = profileManager.activeProfile;
    const plane = AIRCRAFT_DATA[this.equippedPlaneId] || AIRCRAFT_DATA.f15c;
    const currentLevel = profile ? profileManager.getPlaneLevel(this.equippedPlaneId) : 1;

    // 1. Plane Sprite
    const spriteEl = document.getElementById('hangar-plane-img');
    const planeScale = (plane.scale !== undefined) ? plane.scale : (plane.physics && plane.physics.scale !== undefined ? plane.physics.scale : 1.0);
    if (spriteEl) {
      spriteEl.src = plane.sprite || './assets/planes/f15c.png';
      spriteEl.alt = plane.name;
      spriteEl.style.transform = `rotate(45deg) scale(${planeScale})`;
    }

    // 2. Plane Info Panel (Top-Right)
    const nameEl = document.getElementById('hangar-plane-name');
    if (nameEl) nameEl.textContent = plane.name.toUpperCase();

    const tierEl = document.getElementById('hangar-plane-tier');
    if (tierEl) tierEl.textContent = `TIER ${plane.tier !== undefined ? plane.tier : 0}`;

    const levelEl = document.getElementById('hangar-plane-level');
    if (levelEl) levelEl.textContent = `LEVEL ${currentLevel}`;

    const slotsEl = document.getElementById('hangar-plane-slots');
    if (slotsEl) slotsEl.textContent = `${plane.partSlots || 2} PART SLOTS`;

    const roleBadgeEl = document.getElementById('hangar-plane-role-badge');
    if (roleBadgeEl) {
      roleBadgeEl.textContent = (plane.planeRole || 'MULTIROLE').toUpperCase();
    }

    const descEl = document.getElementById('hangar-plane-desc');
    if (descEl) descEl.textContent = plane.description || 'Advanced military tactical combat aircraft.';

    // Ability Info
    const abilityId = (plane.weapons && plane.weapons.ability) ? plane.weapons.ability : 'emergencyAfterburner';
    const abilityNameEl = document.getElementById('hangar-ability-name');
    const abilityDescEl = document.getElementById('hangar-ability-desc');
    const abilityCdEl = document.getElementById('hangar-ability-cd');

    const abilityTexts = {
      emergencyAfterburner: {
        title: 'EMERGENCY AFTERBURNER',
        desc: 'Engages chemical emergency overdrive for 4 seconds, providing 160% normal acceleration and expanding maximum top speed to 110%.',
        cd: '45s cooldown'
      },
      cobraManeuver: {
        title: 'COBRA MANEUVER',
        desc: 'Pitches airframe vertically into a Pugachev Cobra, rapidly shedding speed to stall floor while generating thick wing vapor.',
        cd: '25s cooldown'
      },
      aoaLimiter: {
        title: 'AOA LIMITER RELEASE',
        desc: 'Bypasses angle-of-attack limits, locking flight trajectory while allowing full 360-degree nose deflection.',
        cd: '5s cooldown'
      },
      emDispenser: {
        title: 'ELECTROMECHANICAL DISPENSER',
        desc: 'Rapid-fires an intense continuous string of countermeasures behind the plane with extended lingering heat clouds.',
        cd: '35s cooldown'
      },
      sensorFusion: {
        title: 'SENSOR FUSION',
        desc: 'Integrates radar and optical sensor arrays, highlighting stealth aircraft from 150% standard radar distance.',
        cd: '20s cooldown'
      }
    };

    const abInfo = abilityTexts[abilityId] || abilityTexts.emergencyAfterburner;
    if (abilityNameEl) abilityNameEl.textContent = abInfo.title;
    if (abilityDescEl) abilityDescEl.textContent = abInfo.desc;
    if (abilityCdEl) abilityCdEl.textContent = abInfo.cd;

    // 3. User Credits & Callsign (Bottom-Left)
    const callsignEl = document.getElementById('hangar-user-callsign');
    if (callsignEl && profile) callsignEl.textContent = profile.username;

    const creditsEl = document.getElementById('hangar-user-credits');
    if (creditsEl && profile) {
      creditsEl.textContent = `₡ ${Number(profile.credits || 0).toLocaleString()}`;
    }

    // 4. Equipped Special Weapon (Bottom-Right)
    const equippedSpwId = profileManager.getEquippedSpw(this.equippedPlaneId);

    const spwDef = SPECIAL_WEAPONS[equippedSpwId] || SPECIAL_WEAPONS.qaam;
    const spwNameEl = document.getElementById('hangar-spw-name');
    if (spwNameEl) spwNameEl.textContent = (spwDef.code || equippedSpwId).toUpperCase();

    const spwThumbEl = document.getElementById('hangar-spw-thumb');
    if (spwThumbEl) spwThumbEl.src = spwDef.sprite || './assets/weapons/aim120.png';

    // 5. Part Slots (Bottom-Center)
    this.renderPartSlots(plane.partSlots || 2);
  }

  renderPartSlots(count) {
    const container = document.getElementById('hangar-parts-container');
    if (!container) return;
    container.innerHTML = '';

    const profile = profileManager.activeProfile;
    const equippedParts = (profile && profile.equippedParts && profile.equippedParts[this.equippedPlaneId]) || [];

    for (let i = 0; i < count; i++) {
      const slot = document.createElement('div');
      slot.className = 'hangar-part-slot';
      slot.title = `PART SLOT ${i + 1} // CLICK TO CONFIGURE`;

      if (equippedParts[i]) {
        const img = document.createElement('img');
        img.src = './assets/weapons/chaffpod.png';
        slot.appendChild(img);
      }

      slot.addEventListener('click', () => {
        this.menu.audio.playMenuSelect();
        this.menu.showToast(`PART SLOT ${i + 1} // UPGRADE PARTS UNLOCK WITH EXP`);
      });

      container.appendChild(slot);
    }
  }

  // Draw asphalt tarmac texture and yellow taxiway lines matching Mockup 4
  renderTarmac() {
    if (!this.canvas || !this.ctx) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Dark asphalt base
    ctx.fillStyle = '#444448';
    ctx.fillRect(0, 0, w, h);

    // Subtle runway pavement texture noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let x = 0; x < w; x += 4) {
      for (let y = 0; y < h; y += 4) {
        if ((x * 13 + y * 7) % 5 === 0) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // Yellow taxiway line:
    // Vertical center line with T-bar stop at top, curving smoothly left & right at the bottom
    const centerX = Math.round(w * 0.50);
    const taxiColor = '#e5b324';
    const lineWidth = 9;

    ctx.strokeStyle = taxiColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Top T-bar
    ctx.beginPath();
    ctx.moveTo(centerX - 16, 45);
    ctx.lineTo(centerX + 16, 45);
    ctx.stroke();

    // Center vertical line down to lower turn
    const turnY = h * 0.84;
    ctx.beginPath();
    ctx.moveTo(centerX, 45);
    ctx.lineTo(centerX, turnY - 60);
    ctx.stroke();

    // Sweeping curve branching to left and right
    ctx.beginPath();
    // Left branch
    ctx.moveTo(centerX, turnY - 60);
    ctx.quadraticCurveTo(centerX, turnY, centerX - 120, turnY);
    ctx.lineTo(0, turnY);
    // Right branch
    ctx.moveTo(centerX, turnY - 60);
    ctx.quadraticCurveTo(centerX, turnY, centerX + 120, turnY);
    ctx.lineTo(w, turnY);
    ctx.stroke();
  }

  // Render 4-Axis Spider Radar Graph (DEF, AIR, AGILE, GRND) - Strict 1:1 Aspect Ratio
  renderSpiderGraph() {
    if (!this.spiderCanvas || !this.spiderCtx) return;
    const canvas = this.spiderCanvas;
    const ctx = this.spiderCtx;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 260;
    const h = rect.height || 260;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const plane = AIRCRAFT_DATA[this.equippedPlaneId] || AIRCRAFT_DATA.f15c;
    const profile = profileManager.activeProfile;
    const level = profile ? profileManager.getPlaneLevel(this.equippedPlaneId) : 1;
    const statMult = getUpgradeStatMultiplier(level);

    // Compute 4 stat values (0.5 to 3.0 scale like in Mockup 4)
    // DEF, AIR, AGILE, GRND
    const baseStats = plane.stats || { def: 75, air: 90, spd: 75, gnd: 40 };
    const defVal = ((baseStats.def / 100) * 2.5 * statMult).toFixed(1);
    const airVal = ((baseStats.air / 100) * 2.5 * statMult).toFixed(1);
    const agileVal = ((baseStats.spd / 100) * 2.5 * statMult).toFixed(1);
    const grndVal = ((baseStats.gnd / 100) * 2.5 * statMult).toFixed(1);

    const cx = Math.round(w * 0.50);
    const cy = Math.round(h * 0.50);
    const radius = Math.min(w, h) * 0.34;

    // Draw concentric diamond rings (gray grid lines, strict 1:1 aspect ratio)
    ctx.strokeStyle = 'rgba(120, 120, 130, 0.45)';
    ctx.lineWidth = 1;
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const r = (radius / steps) * i;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);  // Top
      ctx.lineTo(cx + r, cy);  // Right
      ctx.lineTo(cx, cy + r);  // Bottom
      ctx.lineTo(cx - r, cy);  // Left
      ctx.closePath();
      ctx.stroke();
    }

    // Axes crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // Radar Data Polygon (Yellow with glowing border - strict 1:1)
    // Values normalized against 3.0 max
    const maxScale = 3.0;
    const dR = Math.min(1.0, parseFloat(defVal) / maxScale) * radius;
    const aR = Math.min(1.0, parseFloat(airVal) / maxScale) * radius;
    const gR = Math.min(1.0, parseFloat(agileVal) / maxScale) * radius;
    const grR = Math.min(1.0, parseFloat(grndVal) / maxScale) * radius;

    ctx.fillStyle = 'rgba(235, 195, 45, 0.38)';
    ctx.strokeStyle = '#f5cb3b';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy - dR);
    ctx.lineTo(cx + aR, cy);
    ctx.lineTo(cx, cy + gR);
    ctx.lineTo(cx - grR, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Corner Labels
    ctx.font = "bold 12px 'Quantico', sans-serif";
    ctx.fillStyle = '#ffffff';

    // Top: DEF
    ctx.textAlign = 'center';
    ctx.fillText(`DEF ${defVal}`, cx, cy - radius - 8);

    // Right: AIR
    ctx.textAlign = 'left';
    ctx.fillText(`AIR`, cx + radius + 8, cy - 6);
    ctx.fillText(`${airVal}`, cx + radius + 8, cy + 10);

    // Bottom: AGILE
    ctx.textAlign = 'center';
    ctx.fillText(`AGILE ${agileVal}`, cx, cy + radius + 18);

    // Left: GRND
    ctx.textAlign = 'right';
    ctx.fillText(`GRND`, cx - radius - 8, cy - 6);
    ctx.fillText(`${grndVal}`, cx - radius - 8, cy + 10);
  }

  // Open Special Weapon Selection Modal (Mockup 3)
  openSpwSelectModal() {
    const modal = document.getElementById('modal-spw-select');
    const list = document.getElementById('spw-modal-list');
    if (!modal || !list) return;

    list.innerHTML = '';
    const plane = AIRCRAFT_DATA[this.equippedPlaneId] || AIRCRAFT_DATA.f15c;
    const availableSpw = (plane.weapons && plane.weapons.specialWeapons) || ['qaam', '4aam', 'saam'];
    const currentEquipped = profileManager.getEquippedSpw(this.equippedPlaneId);

    availableSpw.forEach((spwId, idx) => {
      const def = SPECIAL_WEAPONS[spwId] || SPECIAL_WEAPONS.qaam;
      const isEquipped = (spwId === currentEquipped);
      const reqLevel = (idx === 0) ? 1 : (idx === 1 ? 3 : 5);
      const isUnlocked = profileManager.isSpwUnlocked(this.equippedPlaneId, spwId);

      const row = document.createElement('div');
      row.className = `spw-item-row ${!isUnlocked ? 'locked' : ''}`;

      const lockBadge = !isUnlocked
        ? `<div class="spw-lock-badge">// LOCKED [REQ. LVL ${reqLevel}]</div>`
        : '';

      row.innerHTML = `
        <div class="spw-indicator-bar ${isEquipped ? 'equipped' : ''} ${!isUnlocked ? 'locked' : ''}"></div>
        <div class="spw-code-col">
          <div class="spw-code-text">${(def.code || spwId).toUpperCase()}</div>
          <div class="spw-sub-label">${def.subName || def.name.toUpperCase()}</div>
          ${lockBadge}
        </div>
        <div class="spw-desc-col">
          ${def.description.toUpperCase()}
        </div>
        <div class="spw-preview-thumb ${!isUnlocked ? 'locked' : ''}">
          <img src="${def.sprite || './assets/weapons/aim120.png'}" alt="${def.code}">
        </div>
      `;

      row.addEventListener('click', () => {
        if (!isUnlocked) {
          if (this.menu.audio && this.menu.audio.playErrorSound) {
            this.menu.audio.playErrorSound();
          } else if (this.menu.audio && this.menu.audio.playMenuBack) {
            this.menu.audio.playMenuBack();
          }
          this.menu.showToast(`WEAPON LOCKED // REQUIRES AIRFRAME LEVEL ${reqLevel}`);
          return;
        }
        this.menu.audio.playMenuSelect();
        profileManager.setEquippedSpw(this.equippedPlaneId, spwId);
        this.closeModal('modal-spw-select');
        this.refreshHangarView();
        this.menu.showToast(`SPECIAL WEAPON EQUIPPED // ${(def.code || spwId).toUpperCase()}`);
      });

      list.appendChild(row);
    });

    modal.classList.add('active');
  }

  // Open Upgrade Confirmation Modal (Mockup 5)
  openUpgradeModal() {
    const plane = AIRCRAFT_DATA[this.equippedPlaneId] || AIRCRAFT_DATA.f15c;
    const profile = profileManager.activeProfile;
    if (!profile) return;

    const currentLevel = profileManager.getPlaneLevel(this.equippedPlaneId);

    // If level 5, open the Special EVO Upgrade Menu!
    if (currentLevel >= 5) {
      this.openEvoUpgradeModal();
      return;
    }

    const modal = document.getElementById('modal-upgrade-confirm');
    if (!modal) return;

    const nextLevel = currentLevel + 1;
    const cost = getUpgradeCost(plane.cost || 1000, currentLevel);
    const haveCredits = profile.credits || 0;

    // Subtitle
    const subEl = document.getElementById('upgrade-modal-subtitle');
    if (subEl) subEl.textContent = `UPGRADE TO LEVEL ${nextLevel}`;

    // Unlock info
    const unlockEl = document.getElementById('upgrade-modal-unlock-info');
    if (unlockEl) {
      if (nextLevel === 5) {
        unlockEl.textContent = `+4% ALL STATS // UNLOCKS EVO SPECIAL UPGRADE AT MAX`;
      } else {
        unlockEl.textContent = `+4% COMBAT STAT BOOST TO AIR, DEF, GRND & AGILE SYSTEMS`;
      }
    }

    // Credits Have / Cost
    const haveEl = document.getElementById('upgrade-have-credits');
    if (haveEl) haveEl.textContent = `Have: ₡ ${haveCredits.toLocaleString()}`;

    const costEl = document.getElementById('upgrade-cost-credits');
    if (costEl) costEl.textContent = `Cost: ₡ ${cost.toLocaleString()}`;

    // Upgrade button state
    const confirmBtn = document.getElementById('btn-upgrade-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = (haveCredits < cost);
    }

    // Render comparison radar graph
    this.renderUpgradeDiffRadar(plane, currentLevel, nextLevel);

    modal.classList.add('active');
  }

  // Render Diff Radar for Upgrade Confirmation
  renderUpgradeDiffRadar(plane, curLvl, nextLvl) {
    if (!this.upgradeSpiderCanvas || !this.upgradeSpiderCtx) return;
    const canvas = this.upgradeSpiderCanvas;
    const ctx = this.upgradeSpiderCtx;

    const w = 220;
    const h = 180;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = 55;

    // Background diamond rings
    ctx.strokeStyle = 'rgba(120, 120, 130, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const r = (radius / 3) * i;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
    }

    const curMult = getUpgradeStatMultiplier(curLvl);
    const nextMult = getUpgradeStatMultiplier(nextLvl);
    const base = plane.stats || { def: 75, air: 90, spd: 75, gnd: 40 };

    const getCoord = (stat, mult, scaleX = 1) => {
      const v = (stat / 100) * mult;
      return Math.min(1.0, v / 1.3) * radius * scaleX;
    };

    // Next level polygon (Green outline)
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - getCoord(base.def, nextMult));
    ctx.lineTo(cx + getCoord(base.air, nextMult), cy);
    ctx.lineTo(cx, cy + getCoord(base.spd, nextMult));
    ctx.lineTo(cx - getCoord(base.gnd, nextMult), cy);
    ctx.closePath();
    ctx.stroke();

    // Current polygon (Yellow filled)
    ctx.fillStyle = 'rgba(235, 195, 45, 0.45)';
    ctx.strokeStyle = '#f5cb3b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - getCoord(base.def, curMult));
    ctx.lineTo(cx + getCoord(base.air, curMult), cy);
    ctx.lineTo(cx, cy + getCoord(base.spd, curMult));
    ctx.lineTo(cx - getCoord(base.gnd, curMult), cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stats values in green
    ctx.font = "bold 11px 'Quantico', sans-serif";
    ctx.fillStyle = '#2ecc71';
    ctx.textAlign = 'center';
    const nextDef = ((base.def / 100) * 2.5 * nextMult).toFixed(1);
    ctx.fillText(`${nextDef}`, cx, cy - radius - 4);
  }

  // Execute Upgrade
  performUpgrade() {
    const plane = AIRCRAFT_DATA[this.equippedPlaneId] || AIRCRAFT_DATA.f15c;
    const res = profileManager.upgradePlane(this.equippedPlaneId, plane.cost || 1000);

    if (res.success) {
      this.menu.audio.playUpgradeSound();
      this.closeModal('modal-upgrade-confirm');
      this.refreshHangarView();
      this.renderSpiderGraph();
      this.menu.showToast(`AIRCRAFT UPGRADED // LEVEL ${res.newLevel} REACHED`);
    } else {
      this.menu.audio.playMenuError();
      this.menu.showToast(res.reason === 'INSUFFICIENT_CREDITS' ? 'INSUFFICIENT CREDITS FOR UPGRADE' : 'MAX UPGRADE LEVEL REACHED');
    }
  }

  // Open Special EVO Upgrade Menu
  openEvoUpgradeModal() {
    const evoPlane = Object.values(AIRCRAFT_DATA).find(p => p.evoBaseId === this.equippedPlaneId || (p.tags && p.tags.includes('EVO')));
    const title = evoPlane ? evoPlane.name : 'EXPERIMENTAL EVO AIRFRAME';
    const desc = evoPlane ? evoPlane.description : 'Special evolution airframe unlocks 2D thrust vectoring and hyper-agility.';

    this.menu.showTacticalModal('SPECIAL EVO UPGRADE AVAILABLE', `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="color:#e5b324; font-size:16px; font-weight:700;">
          MAX COMBAT SPECIFICATION (LEVEL 5) ACHIEVED
        </div>
        <div style="font-size:14px; line-height:1.5; color:#dcdce0;">
          Your airframe has achieved Level 5 mastery! This enables the exclusive <strong>${title}</strong> prototype evolution branch.
        </div>
        <div style="background:rgba(30,30,34,0.8); border:1px solid #4a4a50; padding:14px;">
          <div style="color:#2ecc71; font-weight:700; margin-bottom:6px;">PROTOTYPE ATTRIBUTES:</div>
          <div style="color:#b0b0b8; font-size:12px;">${desc}</div>
        </div>
        <button id="btn-unlock-evo-confirm" class="login-btn-primary" style="margin-top:8px;">
          INITIALIZE EVO UPGRADE (FREE EVENT REWARD)
        </button>
      </div>
    `);

    setTimeout(() => {
      document.getElementById('btn-unlock-evo-confirm')?.addEventListener('click', () => {
        this.menu.audio.playUpgradeSound();
        if (evoPlane) {
          profileManager.acquirePlane(evoPlane.id, 0);
          profileManager.setEquippedPlane(evoPlane.id);
          this.equippedPlaneId = evoPlane.id;
          this.refreshHangarView();
          this.renderSpiderGraph();
        }
        this.menu.closeTacticalModal();
        this.menu.showToast(`EVO AIRFRAME DEPLOYED // ${title}`);
      });
    }, 50);
  }

  // Open Aircraft Select Modal (Switch between owned aircraft)
  openSelectAircraftModal() {
    const profile = profileManager.activeProfile;
    if (!profile) return;

    const owned = profile.ownedPlanes || ['f15c'];
    let html = '<div class="shop-grid">';

    owned.forEach(planeId => {
      const p = AIRCRAFT_DATA[planeId];
      if (!p) return;
      const isEquipped = (planeId === this.equippedPlaneId);
      const lvl = profileManager.getPlaneLevel(planeId);

      html += `
        <div class="shop-plane-card" data-plane-id="${planeId}" style="${isEquipped ? 'border-color:#2ecc71;' : ''}">
          <img src="${p.sprite || './assets/planes/f15c.png'}" class="shop-plane-img" alt="${p.name}">
          <div class="shop-plane-name">${p.name}</div>
          <div style="font-size:12px; color:#c4c4cc;">TIER ${p.tier !== undefined ? p.tier : 0} // LVL ${lvl}</div>
          <button class="shop-plane-buy-btn" style="${isEquipped ? 'background:#2ecc71; color:#000;' : ''}">
            ${isEquipped ? 'EQUIPPED' : 'EQUIP AIRCRAFT'}
          </button>
        </div>
      `;
    });

    html += '</div>';

    this.menu.showTacticalModal('SELECT AIRCRAFT', html);

    setTimeout(() => {
      document.querySelectorAll('.shop-plane-card').forEach(card => {
        card.addEventListener('click', () => {
          const planeId = card.getAttribute('data-plane-id');
          if (planeId && AIRCRAFT_DATA[planeId]) {
            this.menu.audio.playMenuSelect();
            profileManager.setEquippedPlane(planeId);
            this.equippedPlaneId = planeId;
            this.refreshHangarView();
            this.renderSpiderGraph();
            this.menu.closeTacticalModal();
            this.menu.showToast(`AIRCRAFT EQUIPPED // ${AIRCRAFT_DATA[planeId].name.toUpperCase()}`);
          }
        });
      });
    }, 50);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }
}

