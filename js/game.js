// Main Flight Stage Controller & Game Loop

import { AIRCRAFT_DATA, SPECIAL_WEAPONS, ABILITIES } from './aircraft.js';
import { FlightPhysics } from './physics.js';
import { ParticleSystem } from './particles.js';
import { SoundEngine } from './audio.js';
import { World } from './world.js';
import { FlightHUD } from './hud.js';
import { TargetManager } from './targets.js';
import { MissionManager } from './mission.js';

class FlightGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Systems
    this.audio = new SoundEngine();
    this.particles = new ParticleSystem();
    this.world = new World();
    this.hud = new FlightHUD();
    this.targetManager = new TargetManager();
    this.missionManager = new MissionManager(this);

    // Aircraft Management
    this.currentAircraftId = 'f15c';
    this.equippedAircraftId = 'f15c';
    this.aircraftConfig = AIRCRAFT_DATA[this.currentAircraftId];
    this.physics = new FlightPhysics(this.aircraftConfig);

    // Sprites cache
    this.sprites = {};
    this.loadSprites();

    // Camera (Zoomed out for wide arcade battlefield view)
    this.camera = {
      x: 0,
      y: 0,
      zoom: 0.68,
      targetZoom: 0.68
    };

    // Input state
    this.input = {
      shift: false,
      ctrl: false,
      lmb: false,
      a: false,
      s: false,
      z: false,
      x: false,
      rawMouseX: window.innerWidth * 0.5,
      rawMouseY: window.innerHeight * 0.5,
      targetWorldX: 0,
      targetWorldY: 0
    };

    // Target designation & seeker locking state
    this.targeting = {
      designatedTarget: null,
      multiLockedTargets: [],
      lockState: 'NONE',      // 'NONE' | 'TRACKING' | 'LOCKED'
      lockTimer: 0,
      lockTimeRequired: 0.50, // 0.5s lock time
      lockCone: 0.60,         // ~34 degree seeker cone ahead of nose
      lockRange: 6500,        // 6500m max acquisition range
      missileInbound: false
    };

    // Weapons Inventory & Cooldowns (loaded per-aircraft)
    this.weapons = {};
    this.loadAircraftWeapons(this.aircraftConfig);

    // Transonic sonic boom tracking
    this.prevMach = 0.7;

    // Crash handling & altitude tracking
    this.crashHandled = false;
    this.crashReason = null;
    this.playerDying = false;
    this.playerFallTimer = 0;
    this.playerFallDuration = 2.8;
    this.playerFallHeading = 0;
    this.playerFallSpeed = 240;
    this.altitude = 1.0;
    this.boundaryTimer = 0;
    this.boundaryState = null;
    this.returnLineCooldown = 0;
    this.returnLineRearmedNotice = 0;

    // Pause state
    this.isPaused = false;

    // Timing
    this.lastTime = performance.now();
    this.gunTimer = 0;

    // Setup
    this.resize();
    this.setupEventListeners();
    this.physics.reset(0, 0, -Math.PI * 0.25, 335);
    this.flightState = this.physics.update(0.016, this.input);
    this.missionManager.loadMission('test_flight');

    // Start loop
    requestAnimationFrame(this.loop.bind(this));
  }

  loadSprites() {
    for (const [key, data] of Object.entries(AIRCRAFT_DATA)) {
      const img = new Image();
      img.src = data.sprite;
      this.sprites[key] = img;
    }
  }

  loadAircraftWeapons(config) {
    const w = (config && config.weapons) ? config.weapons : {};
    const equippedSpwId = w.equippedSpecialWeapon || (w.specialWeapons && w.specialWeapons[0]) || 'qaam';
    const spwDef = SPECIAL_WEAPONS[equippedSpwId] || SPECIAL_WEAPONS.qaam;
    const spwAmmoCount = (w.spwAmmo && w.spwAmmo[equippedSpwId] !== undefined)
      ? w.spwAmmo[equippedSpwId]
      : (spwDef.defaultAmmo || 24);

    const abilityId = w.ability || 'highGBreak';
    const abilityDef = ABILITIES[abilityId] || ABILITIES.highGBreak;

    // Special weapon pool size according to weapon type (e.g. 4 for 4AAM, 2 for QAAM/UGB, 1 for MPBM)
    const spwPoolSize = spwDef.pool || ({
      '4aam': 4,
      'qaam': 2,
      'ugb': 2,
      'sffs': 2,
      'saam': 2,
      'hpaa': 2,
      'lasm': 2,
      'mpbm': 1
    }[equippedSpwId] || 2);

    const flarePoolSize = w.flarePool || 2;
    const flareCooldown = w.flareCooldown || w.flareRechargeTime || 20.0;
    const mslCooldown = w.mslCooldown || w.mslRechargeTime || 4.4;
    const spwCooldown = (w.spwCooldown && w.spwCooldown[equippedSpwId] !== undefined)
      ? w.spwCooldown[equippedSpwId]
      : ((w.spwRechargeTime && w.spwRechargeTime[equippedSpwId] !== undefined)
        ? w.spwRechargeTime[equippedSpwId]
        : (spwDef.rechargeTime || spwDef.cooldown || 4.0));

    this.weapons = {
      hp: 100,
      maxHp: 100,
      selectedWeapon: (this.weapons && this.weapons.selectedWeapon) ? this.weapons.selectedWeapon : 'msl',
      damageShakeTimer: 0,
      damageFlashTimer: 0,
      flashStates: {},
      gunAmmo: w.gunAmmo || 800,
      maxGunAmmo: w.maxGunAmmo || w.gunAmmo || 800,
      gunRpm: w.gunRpm || 1500,
      gunDamage: w.gunDamage || 20,
      mslCount: w.mslCount || 120,
      maxMslCount: w.maxMslCount || w.mslCount || 120,
      // 2 independent MSL slots for rapid two-missile volleys [||]
      mslSlots: [
        { reload: 0, maxReload: mslCooldown },
        { reload: 0, maxReload: mslCooldown }
      ],
      flareCount: w.flareCount || 30,
      maxFlareCount: w.maxFlareCount || w.flareCount || 30,
      // Aircraft-specific FLR pool slots [||] or [||||]
      flareSlots: Array.from({ length: flarePoolSize }, () => ({
        reload: 0,
        maxReload: flareCooldown
      })),
      specialWeapons: w.specialWeapons ? [...w.specialWeapons] : ['qaam'],
      equippedSpwId: equippedSpwId,
      spwCode: spwDef.code,
      spwName: spwDef.name,
      spwCount: spwAmmoCount,
      maxSpwCount: spwAmmoCount,
      // Special weapon pool slots (variable recharge rate per weapon)
      spwSlots: Array.from({ length: spwPoolSize }, () => ({
        reload: 0,
        maxReload: spwCooldown
      })),
      abilityId: abilityId,
      abilityCode: abilityDef.code,
      abilityName: abilityDef.name,
      abilityCharges: w.abilityCharges || abilityDef.charges || 3,
      maxAbilityCharges: w.maxAbilityCharges || abilityDef.charges || 3,
      abilityRecharge: w.abilityRecharge || abilityDef.rechargeTime || 10.0,
      abilityMaxRecharge: w.abilityRecharge || abilityDef.rechargeTime || 10.0
    };
  }

  equipSpecialWeapon(spwId) {
    if (!SPECIAL_WEAPONS[spwId]) return;
    const spwDef = SPECIAL_WEAPONS[spwId];
    const w = (this.aircraftConfig && this.aircraftConfig.weapons) ? this.aircraftConfig.weapons : {};

    // Update active equipped weapon
    w.equippedSpecialWeapon = spwId;
    this.weapons.equippedSpwId = spwId;
    this.weapons.spwCode = spwDef.code;
    this.weapons.spwName = spwDef.name;

    const ammo = (w.spwAmmo && w.spwAmmo[spwId] !== undefined)
      ? w.spwAmmo[spwId]
      : (spwDef.defaultAmmo || 24);
    this.weapons.spwCount = ammo;
    this.weapons.maxSpwCount = ammo;

    const spwPoolSize = spwDef.pool || ({
      '4aam': 4,
      'qaam': 2,
      'ugb': 2,
      'sffs': 2,
      'saam': 2,
      'hpaa': 2,
      'lasm': 2,
      'mpbm': 1
    }[spwId] || 2);

    const spwCooldown = (w.spwCooldown && w.spwCooldown[spwId] !== undefined)
      ? w.spwCooldown[spwId]
      : ((w.spwRechargeTime && w.spwRechargeTime[spwId] !== undefined)
        ? w.spwRechargeTime[spwId]
        : (spwDef.rechargeTime || spwDef.cooldown || 4.0));

    this.weapons.spwSlots = Array.from({ length: spwPoolSize }, () => ({
      reload: 0,
      maxReload: spwCooldown
    }));
  }

  cycleSpecialWeapon() {
    const list = (this.aircraftConfig && this.aircraftConfig.weapons && this.aircraftConfig.weapons.specialWeapons)
      ? this.aircraftConfig.weapons.specialWeapons
      : ['qaam'];
    const idx = list.indexOf(this.weapons.equippedSpwId);
    const nextIdx = (idx + 1) % list.length;
    this.equipSpecialWeapon(list[nextIdx]);
    if (this.audio && this.audio.playWeaponSwitchSound) {
      this.audio.playWeaponSwitchSound('spw');
    } else {
      this.audio.playSwitchSound();
    }
  }

  // Switch between Standard MSL and Special Weapon (Key X - Ace Combat style)
  switchWeapon() {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;
    this.weapons.selectedWeapon = (this.weapons.selectedWeapon === 'spw') ? 'msl' : 'spw';
    if (this.weapons.selectedWeapon === 'msl') {
      // Clear multi-lock extra targets when switching back to standard missiles
      if (this.targeting && this.targeting.multiLockedTargets) {
        this.targeting.multiLockedTargets.length = 0;
      }
    }
    if (this.audio && this.audio.playWeaponSwitchSound) {
      this.audio.playWeaponSwitchSound(this.weapons.selectedWeapon);
    } else if (this.audio && this.audio.playSwitchSound) {
      this.audio.playSwitchSound();
    }
  }

  // Fire currently selected weapon (Space - Ace Combat style)
  fireSelectedWeapon() {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;
    if (this.weapons.selectedWeapon === 'spw') {
      this.triggerSpecialWeapon();
    } else {
      this.triggerMissile();
    }
  }

  // Weapon fully depleted / dry-fire error trigger (flashes RED + dry-fire buzz sound)
  triggerWeaponEmpty(weaponKey) {
    if (!this.weapons) return;
    if (!this.weapons.flashStates) this.weapons.flashStates = {};
    this.weapons.flashStates[weaponKey] = { timer: 0.35, type: 'depleted' };
    if (this.audio && this.audio.playDepletedSound) {
      this.audio.playDepletedSound();
    }
  }

  // Weapon cycling / recharging cooldown error trigger (flashes YELLOW + warning chirp sound)
  triggerWeaponCooldown(weaponKey) {
    if (!this.weapons) return;
    if (!this.weapons.flashStates) this.weapons.flashStates = {};
    this.weapons.flashStates[weaponKey] = { timer: 0.35, type: 'cooldown' };
    if (this.audio && this.audio.playCooldownSound) {
      this.audio.playCooldownSound();
    }
  }

  selectAircraft(aircraftId, isPlayerChoice = false) {
    if (!AIRCRAFT_DATA[aircraftId]) return;
    this.currentAircraftId = aircraftId;
    if (isPlayerChoice) {
      this.equippedAircraftId = aircraftId;
    }
    this.aircraftConfig = AIRCRAFT_DATA[aircraftId];

    // Preserve current position, heading, velocity
    const currX = this.physics.x;
    const currY = this.physics.y;
    const currHeading = this.physics.heading;
    const currSpeed = this.physics.speed;

    this.physics.setConfig(this.aircraftConfig);
    this.physics.x = currX;
    this.physics.y = currY;
    this.physics.heading = currHeading;
    this.physics.speed = currSpeed;
    this.physics.vx = Math.cos(currHeading) * currSpeed;
    this.physics.vy = Math.sin(currHeading) * currSpeed;

    // Load plane-specific weapons inventory, ammo, SPW, and ability
    this.loadAircraftWeapons(this.aircraftConfig);
    this.altitude = 1.0;

    this.audio.playSwitchSound();
    this.updateUIButtons();
  }

  // Apply forced loadout if mission demands a specific plane & loadout (Singleplayer only)
  applyForcedLoadout(loadout) {
    if (!loadout) return;
    const planeId = loadout.aircraft;
    if (planeId && AIRCRAFT_DATA[planeId] && this.currentAircraftId !== planeId) {
      this.selectAircraft(planeId, false);
    }
    if (loadout.specialWeapon && SPECIAL_WEAPONS[loadout.specialWeapon]) {
      this.equipSpecialWeapon(loadout.specialWeapon);
    }
  }

  // Restore player's equipped loadout (from hangar/selection) - used in Multiplayer & player-loadout SP
  restoreEquippedLoadout() {
    const targetId = this.equippedAircraftId || 'f15c';
    if (AIRCRAFT_DATA[targetId] && this.currentAircraftId !== targetId) {
      this.selectAircraft(targetId, false);
    }
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());

    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      this.input.rawMouseX = e.clientX;
      this.input.rawMouseY = e.clientY;
      this.updateMouseWorldCoords();
    });

    // Mouse down / up
    window.addEventListener('mousedown', (e) => {
      this.audio.init();
      this.audio.resume();
      if (e.button === 0) {
        this.input.lmb = true;
        if (this.weapons && this.weapons.gunAmmo <= 0 && !this.crashHandled && !this.physics.isCrashed && !this.playerDying) {
          this.triggerWeaponEmpty('gun');
        }
      } else if (e.button === 2) {
        // Right Mouse Button: designate target near cursor
        this.designateTargetNearCursor();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.lmb = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.audio.init();
      this.audio.resume();

      if (e.key === 'Shift') {
        this.input.shift = true;
        e.preventDefault();
      } else if (e.key === 'Control') {
        this.input.ctrl = true;
        e.preventDefault();
      } else if (e.code === 'Space') {
        this.fireSelectedWeapon(); // Space: Fire currently selected weapon (MSL or SP weapon)
        e.preventDefault();
      } else if (e.code === 'KeyX') {
        this.switchWeapon(); // X: Switch weapon (MSL <-> SP weapon)
      } else if (e.code === 'KeyS') {
        this.triggerFlares(); // S: Deploy Countermeasure Flares
      } else if (e.code === 'KeyA') {
        this.triggerAbility(); // A: Activate Tactical Ability
      } else if (e.code === 'KeyZ') {
        this.input.z = true; // Z: Hold for Full Map Mode
      } else if (e.code === 'KeyC') {
        this.cycleSpecialWeapon();
      } else if (e.code === 'Digit1') {
        this.selectAircraft('su27');
      } else if (e.code === 'Digit2') {
        this.selectAircraft('f15c');
      } else if (e.code === 'Digit3') {
        this.selectAircraft('f111f');
      } else if (e.code === 'Digit4') {
        this.selectAircraft('su57');
      } else if (e.code === 'KeyM') {
        this.audio.toggleMute();
      } else if (e.code === 'Escape') {
        this.togglePause();
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.input.shift = false;
      } else if (e.key === 'Control') {
        this.input.ctrl = false;
      } else if (e.code === 'KeyZ') {
        this.input.z = false;
      }
    });

    // Pause Menu UI Event Listeners
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.togglePause(false);
    });
    document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
      this.restartTestFlight();
    });
    const volumeSlider = document.getElementById('volume-slider');
    const volumeVal = document.getElementById('volume-val');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (volumeVal) volumeVal.innerText = `${val}%`;
        this.audio.setMasterVolume(val / 100);
      });
    }
    document.getElementById('btn-pause-exit')?.addEventListener('click', () => {
      // Exit button (reserved / no-op for now as requested)
      console.log('Exit mission clicked');
    });
  }

  updateMouseWorldCoords() {
    const screenCenterX = this.width * 0.5;
    const screenCenterY = this.height * 0.5;
    this.input.targetWorldX = this.camera.x + (this.input.rawMouseX - screenCenterX) / this.camera.zoom;
    this.input.targetWorldY = this.camera.y + (this.input.rawMouseY - screenCenterY) / this.camera.zoom;
  }

  // Right Mouse Button: designate target near cursor
  designateTargetNearCursor() {
    if (!this.targetManager || !this.targetManager.targets) return;

    // Convert mouse world coordinates to find nearest active target
    let nearest = null;
    let minDist = 2200; // Search radius around mouse cursor in world units

    for (const tgt of this.targetManager.targets) {
      if (tgt.isDestroyed || tgt.isFalling) continue;
      const dist = Math.hypot(tgt.x - this.input.targetWorldX, tgt.y - this.input.targetWorldY);
      if (dist < minDist) {
        minDist = dist;
        nearest = tgt;
      }
    }

    if (nearest) {
      this.targeting.designatedTarget = nearest;
      this.targeting.multiLockedTargets = [nearest];
      this.targeting.lockState = 'NONE';
      this.targeting.lockTimer = 0;
      this.audio.playTargetDesignateSound();
    } else {
      // If clicking empty airspace while a target is designated, clear it
      if (this.targeting.designatedTarget) {
        this.targeting.designatedTarget = null;
        this.targeting.multiLockedTargets = [];
        this.targeting.lockState = 'NONE';
        this.targeting.lockTimer = 0;
        this.audio.playTargetDesignateSound();
      }
    }
  }

  triggerFlares() {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;
    if (this.weapons.flareCount <= 0) {
      this.triggerWeaponEmpty('flr');
      return;
    }
    const readySlot = this.weapons.flareSlots ? this.weapons.flareSlots.find(s => s.reload <= 0) : null;
    if (!readySlot && this.weapons.flareSlots) {
      this.triggerWeaponCooldown('flr');
      return;
    }

    if (readySlot) {
      readySlot.reload = readySlot.maxReload;
    }
    this.weapons.flareCooldown = 0.2;
    this.weapons.flareCount = Math.max(0, this.weapons.flareCount - 1);
    this.particles.spawnFlares(
      this.physics.x,
      this.physics.y,
      this.physics.heading,
      this.physics.vx,
      this.physics.vy
    );
    this.audio.playFlareSound();
  }

  triggerMissile() {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;
    if (this.weapons.mslCount <= 0) {
      this.triggerWeaponEmpty('msl');
      return;
    }
    const readySlot = this.weapons.mslSlots ? this.weapons.mslSlots.find(s => s.reload <= 0) : null;
    if (!readySlot && this.weapons.mslSlots) {
      this.triggerWeaponCooldown('msl');
      return;
    }

    if (readySlot) {
      readySlot.reload = readySlot.maxReload || (this.aircraftConfig?.weapons?.mslCooldown || 4.4);
    }
    this.weapons.mslReload = 0.12;
    this.weapons.mslCount = Math.max(0, this.weapons.mslCount - 1);

    const isLocked = (this.targeting.lockState === 'LOCKED' && this.targeting.designatedTarget && !this.targeting.designatedTarget.isDestroyed && !this.targeting.designatedTarget.isFalling);

    // Alternate underwing pylon rail (left/right)
    this.missileRailSide = (this.missileRailSide === 1) ? -1 : 1;
    const perpX = -Math.sin(this.physics.heading);
    const perpY = Math.cos(this.physics.heading);
    const spawnX = this.physics.x + perpX * (this.missileRailSide * 15);
    const spawnY = this.physics.y + perpY * (this.missileRailSide * 15);

    if (isLocked) {
      // Fired with active lock: launches forward along nose heading, initial forward boost, then seeker activates
      this.particles.spawnMissile(
        spawnX,
        spawnY,
        this.physics.heading,
        this.physics.vx,
        this.physics.vy,
        this.targeting.designatedTarget.x,
        this.targeting.designatedTarget.y,
        {
          isGuided: true,
          target: this.targeting.designatedTarget,
          turnRate: 0.92,      // Authentic Ace Combat standard missile tracking rate (-20% from 1.15)
          guidanceDelay: 0.30, // 0.30s rail release forward before seeker steering begins
          seekerGimbal: 0.78,  // ~45 degree seeker FOV limit (off-bore misses lose lock)
          damage: 32,          // 2 hits destroy 60 HP MiG-21
          color: '#e8edf0'
        }
      );
    } else {
      // Fired without lock: flies in a straight line like an unguided rocket
      this.particles.spawnMissile(
        spawnX,
        spawnY,
        this.physics.heading,
        this.physics.vx,
        this.physics.vy,
        this.physics.x + Math.cos(this.physics.heading) * 4000,
        this.physics.y + Math.sin(this.physics.heading) * 4000,
        {
          isGuided: false,
          turnRate: 0,
          target: null,
          damage: 32,
          color: '#e8edf0'
        }
      );
    }
    this.audio.playMissileSound();
  }

  triggerSpecialWeapon() {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;
    if (this.weapons.spwCount <= 0) {
      this.triggerWeaponEmpty('spw');
      return;
    }
    const readySlot = this.weapons.spwSlots ? this.weapons.spwSlots.find(s => s.reload <= 0) : null;
    if (!readySlot && this.weapons.spwSlots) {
      this.triggerWeaponCooldown('spw');
      return;
    }

    const spwId = this.weapons.equippedSpwId || 'qaam';
    const spwDef = SPECIAL_WEAPONS[spwId] || SPECIAL_WEAPONS.qaam;

    const cosH = Math.cos(this.physics.heading);
    const sinH = Math.sin(this.physics.heading);
    const perpX = -sinH;
    const perpY = cosH;

    const isLocked = (this.targeting.lockState === 'LOCKED' && this.targeting.designatedTarget && !this.targeting.designatedTarget.isDestroyed && !this.targeting.designatedTarget.isFalling);
    const tgt = isLocked ? this.targeting.designatedTarget : null;

    // Enforce weapon type compatibility: Air-to-Air special weapons CANNOT lock onto ground/naval targets!
    const isAAM = ['4aam', 'qaam', 'saam', 'hpaa'].includes(spwId);
    const isASM = ['lasm'].includes(spwId);
    const canLockTarget = isLocked && (
      (isAAM && tgt.type === 'air') ||
      (isASM && (tgt.type === 'naval' || tgt.type === 'ground')) ||
      (!isAAM && !isASM)
    );

    const lockedTarget = canLockTarget ? tgt : null;
    const targetX = lockedTarget ? lockedTarget.x : (this.physics.x + cosH * 4000);
    const targetY = lockedTarget ? lockedTarget.y : (this.physics.y + sinH * 4000);

    // Multi-lock air-to-air missile handling (e.g. 4AAM)
    if (spwDef.isMultiLock || spwId === '4aam') {
      const availableReadySlots = this.weapons.spwSlots ? this.weapons.spwSlots.filter(s => s.reload <= 0) : [];
      if (availableReadySlots.length === 0) {
        this.triggerWeaponCooldown('spw');
        return;
      }

      let targetsToFire = [];
      if (canLockTarget && this.targeting.multiLockedTargets && this.targeting.multiLockedTargets.length > 0) {
        targetsToFire = this.targeting.multiLockedTargets.filter(t => t && !t.isDestroyed && !t.isFalling);
      }
      if (targetsToFire.length === 0) {
        targetsToFire = lockedTarget ? [lockedTarget] : [null];
      }

      // Fire only the amount of missiles corresponding to locked targets (or available slots / ammo)
      const count = Math.min(targetsToFire.length, availableReadySlots.length, this.weapons.spwCount);
      if (count <= 0) return;

      this.missileRailSide = (this.missileRailSide === 1) ? -1 : 1;
      const lateralOffsets = count === 1 ? [this.missileRailSide * 16] :
                             count === 2 ? [-18, 18] :
                             count === 3 ? [-22, 0, 22] :
                             [-24, -10, 10, 24];
      const spreads = count === 1 ? [0] :
                      count === 2 ? [-0.08, 0.08] :
                      count === 3 ? [-0.12, 0, 0.12] :
                      [-0.16, -0.05, 0.05, 0.16];

      for (let i = 0; i < count; i++) {
        const tgtForMissile = targetsToFire[i];
        const hasLock = canLockTarget && !!tgtForMissile && !tgtForMissile.isDestroyed && !tgtForMissile.isFalling;
        const mTargetX = hasLock ? tgtForMissile.x : (this.physics.x + cosH * 4000);
        const mTargetY = hasLock ? tgtForMissile.y : (this.physics.y + sinH * 4000);

        // Consume 1 ready slot and 1 ammo per missile fired
        availableReadySlots[i].reload = availableReadySlots[i].maxReload;
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);

        this.particles.spawnMissile(
          this.physics.x + perpX * lateralOffsets[i],
          this.physics.y + perpY * lateralOffsets[i],
          this.physics.heading + spreads[i],
          this.physics.vx,
          this.physics.vy,
          mTargetX,
          mTargetY,
          {
            isGuided: hasLock,
            target: hasLock ? tgtForMissile : null,
            maxSpeed: 1050,
            accel: 520,
            turnRate: hasLock ? 1.45 : 0,
            guidanceDelay: 0.25,
            seekerGimbal: 0.85,
            damage: 62, // 1-shot kill against lesser 60 HP air targets (e.g. MiG-21)
            color: '#44eeff'
          }
        );
      }
      this.audio.playMissileSound();
      return;
    }

    // Single-fire special weapons: consume 1 ready slot
    if (readySlot) {
      readySlot.reload = readySlot.maxReload || spwDef.rechargeTime || spwDef.cooldown || 4.0;
    }

    switch (spwId) {
      case 'qaam': {
        // Single agile high-turn missile: can loop around 180° to re-engage target if initial pass misses
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.missileRailSide = (this.missileRailSide === 1) ? -1 : 1;
        const spawnX = this.physics.x + perpX * (this.missileRailSide * 16);
        const spawnY = this.physics.y + perpY * (this.missileRailSide * 16);
        this.particles.spawnMissile(
          spawnX,
          spawnY,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          targetX,
          targetY,
          {
            isGuided: canLockTarget,
            isQAAM: true,
            target: lockedTarget,
            maxSpeed: 1100,
            accel: 650,
            turnRate: canLockTarget ? 5.8 : 0, // Reduced turning radius (~55% radius)
            guidanceDelay: 0.22,
            seekerGimbal: Math.PI, // Full 360 degree seeker FOV for 180 loops
            life: 5.5,             // Extended motor life for looping re-engagement passes
            damage: 64,            // 1-shot kill against lesser 60 HP air targets (e.g. MiG-21)
            color: '#00ffff'
          }
        );
        break;
      }
      case 'saam': {
        // Semi-Active Air-to-Air Missile: requires pilot to keep boresight illumination on target
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.missileRailSide = (this.missileRailSide === 1) ? -1 : 1;
        const spawnX = this.physics.x + perpX * (this.missileRailSide * 15);
        const spawnY = this.physics.y + perpY * (this.missileRailSide * 15);
        this.particles.spawnMissile(
          spawnX,
          spawnY,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          targetX,
          targetY,
          {
            isGuided: canLockTarget,
            isSAAM: true,
            target: lockedTarget,
            maxSpeed: 1400,
            accel: 750,
            turnRate: canLockTarget ? 1.6 : 0,
            guidanceDelay: 0.25,
            seekerGimbal: 0.78,
            damage: 72, // 1-shot kill against lesser 60 HP air targets (e.g. MiG-21)
            color: '#77e0ff'
          }
        );
        break;
      }
      case 'hpaa': {
        // Heavy high-power kinetic air-to-air missile
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.particles.spawnMissile(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          targetX,
          targetY,
          {
            isGuided: canLockTarget,
            target: lockedTarget,
            maxSpeed: 1150,
            accel: 580,
            turnRate: canLockTarget ? 1.25 : 0,
            guidanceDelay: 0.28,
            seekerGimbal: 0.78,
            damage: 85, // Heavy 1-shot kill against lesser air targets with massive kinetic impact
            color: '#ff7733'
          }
        );
        break;
      }
      case 'lasm': {
        // Long-range anti-surface cruise missile (naval / ground targets only)
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.particles.spawnMissile(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          targetX,
          targetY,
          {
            isGuided: canLockTarget,
            target: lockedTarget,
            isBomb: false,
            maxSpeed: 1250,
            accel: 500,
            turnRate: canLockTarget ? 2.2 : 0,
            guidanceDelay: 0.30,
            damage: 150,
            color: '#ffaa33'
          }
        );
        break;
      }
      case 'ugb': {
        // Unguided heavy free-fall bomb forward along motion vector: explodes at impact point with splash damage
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.particles.spawnMissile(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          this.input.targetWorldX,
          this.input.targetWorldY,
          {
            isBomb: true,
            isUGB: true,
            isGuided: false,
            maxSpeed: Math.max(290, this.physics.speed),
            accel: -40,
            turnRate: 0,
            life: 1.4,
            blastRadius: 140, // 50% explosion radius (was 280)
            damage: 140,
            color: '#ccdd33'
          }
        );
        break;
      }
      case 'sffs': {
        // Submunition dispenser (3 cluster bomblets in spread) with splash damage
        const count = Math.min(3, this.weapons.spwCount);
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - count);
        [-0.12, 0, 0.12].forEach((spread, i) => {
          this.particles.spawnMissile(
            this.physics.x + perpX * (i - 1) * 14,
            this.physics.y + perpY * (i - 1) * 14,
            this.physics.heading + spread,
            this.physics.vx,
            this.physics.vy,
            this.input.targetWorldX,
            this.input.targetWorldY,
            {
              isBomb: true,
              isGuided: false,
              maxSpeed: Math.max(280, this.physics.speed),
              accel: -40,
              turnRate: 0,
              life: 1.4,
              blastRadius: 160,
              damage: 70,
              color: '#eebb44'
            }
          );
        });
        break;
      }
      case 'mpbm': {
        // Multi-Purpose Burst Missile: high-velocity burst missile with massive expanding thermal detonation
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.particles.spawnMissile(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          targetX,
          targetY,
          {
            isGuided: canLockTarget,
            isMPBM: true,
            target: lockedTarget,
            maxSpeed: 1000,
            accel: 480,
            turnRate: canLockTarget ? 2.2 : 0,
            guidanceDelay: 0.20,
            seekerGimbal: 0.90,
            life: 3.5,
            blastRadius: 380, // Tactical burst sphere
            damage: 160,
            color: '#ff4400'
          }
        );
        break;
      }
      default: {
        this.weapons.spwCount = Math.max(0, this.weapons.spwCount - 1);
        this.particles.spawnMissile(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy,
          targetX,
          targetY,
          {
            isGuided: isLocked,
            target: lockedTarget,
            turnRate: isLocked ? 0.92 : 0,
            damage: 32
          }
        );
        break;
      }
    }
    this.audio.playMissileSound();
  }

  triggerAbility() {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;
    if (this.weapons.abilityCharges <= 0) {
      this.triggerWeaponCooldown('abl');
      return;
    }
    this.weapons.abilityCharges -= 1;

    const abilityId = this.weapons.abilityId || 'highGBreak';
    switch (abilityId) {
      case 'highGBreak': {
        // Tactical high-G pitch break with defensive flare burst
        this.particles.spawnFlares(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy
        );
        this.physics.speed = Math.min(this.aircraftConfig.physics.maxSpeed, this.physics.speed + 60);
        this.audio.playFlareSound();
        break;
      }
      case 'afterburnerSurge': {
        // Instant chemical overdrive forward acceleration surge
        this.physics.speed = Math.min(this.aircraftConfig.physics.maxSpeed, this.physics.speed + 130);
        this.particles.spawnSonicBoom(this.physics.x, this.physics.y, this.physics.heading);
        this.audio.playSonicBoom();
        break;
      }
      case 'ecmJammer': {
        // Electronic warfare countermeasure pulse
        for (let i = 0; i < 3; i++) {
          this.particles.spawnFlares(
            this.physics.x + (Math.random() - 0.5) * 40,
            this.physics.y + (Math.random() - 0.5) * 40,
            this.physics.heading + (Math.random() - 0.5) * 0.5,
            this.physics.vx * 0.8,
            this.physics.vy * 0.8
          );
        }
        this.audio.playFlareSound();
        break;
      }
      case 'flareRing': {
        // 360 degree radial flare pattern
        const flareAngles = 8;
        for (let i = 0; i < flareAngles; i++) {
          const angle = (i / flareAngles) * Math.PI * 2;
          this.particles.spawnFlares(
            this.physics.x,
            this.physics.y,
            angle,
            Math.cos(angle) * 80,
            Math.sin(angle) * 80
          );
        }
        this.audio.playFlareSound();
        break;
      }
      default: {
        this.particles.spawnFlares(
          this.physics.x,
          this.physics.y,
          this.physics.heading,
          this.physics.vx,
          this.physics.vy
        );
        this.audio.playFlareSound();
        break;
      }
    }
  }

  // Plane Role Damage Multipliers:
  // FIGHTER:   100% vs air, 60% vs surface
  // STRIKE:    60% vs air, 100% vs surface
  // MULTIROLE: 85% vs all targets
  // ECM:       70% vs all targets
  getRoleDamageMultiplier(targetType) {
    const role = (this.aircraftConfig && (this.aircraftConfig.planeRole || this.aircraftConfig.role)) || 'FIGHTER';
    const norm = role.toUpperCase();
    const isAir = (targetType === 'air');

    if (norm.includes('STRIKE')) {
      return isAir ? 0.60 : 1.00;
    } else if (norm.includes('MULTIROLE')) {
      return 0.85;
    } else if (norm.includes('ECM')) {
      return 0.70;
    } else {
      // Default FIGHTER: 100% air, 60% surface
      return isAir ? 1.00 : 0.60;
    }
  }

  // Damage applied to player from missiles, AA fire, guns, or collisions
  applyPlayerDamage(damage, reason = 'SAM_KILL') {
    if (this.crashHandled || this.physics.isCrashed || this.playerDying) return;

    this.weapons.hp = Math.max(0, this.weapons.hp - damage);
    // Ace Combat HP bar flash red and shake effect
    this.weapons.damageShakeTimer = 0.40;
    this.weapons.damageFlashTimer = 0.40;

    if (this.weapons.hp <= 0) {
      this.triggerPlayerShootdown(reason);
    }
  }

  // Airframe fatal damage: straight-line fall into ground while on fire before exploding
  triggerPlayerShootdown(reason = 'SAM_KILL') {
    if (this.playerDying || this.crashHandled || this.physics.isCrashed) return;

    this.playerDying = true;
    this.playerFallTimer = 0;
    this.playerFallDuration = 2.8;
    this.playerFallHeading = this.flightState ? this.flightState.heading : (this.physics.heading || 0);
    // Maintain exact current velocity without any artificial jump or lurch
    this.playerFallSpeed = this.flightState ? this.flightState.speed : (this.physics.speed || Math.hypot(this.physics.vx, this.physics.vy) || 240);
    this.crashReason = reason;

    if (this.flightState) {
      this.particles.spawnExplosion(this.flightState.x, this.flightState.y);
    }
    if (this.audio) {
      this.audio.playCrashSound();
    }

    // If singleplayer mission has No Respawn enabled, fail mission immediately upon shootdown
    if (this.missionManager && this.missionManager.noRespawn) {
      this.missionManager.isFailed = true;
      this.missionManager.postRadioMessage('CRITICAL ALERT // AIRCRAFT SHOT DOWN - MISSION FAILED', 5.0);
    }
  }

  // Full airframe and system reset on respawn (guarantees 100% full HP restore)
  respawnPlayer(x = 0, y = 0, heading = -Math.PI * 0.25, speed = 335) {
    this.playerDying = false;
    this.playerFallTimer = 0;
    this.weapons.hp = this.weapons.maxHp || 100;
    this.weapons.damageShakeTimer = 0;
    this.weapons.damageFlashTimer = 0;
    this.physics.reset(x, y, heading, speed);
    this.altitude = 1.0;
    this.boundaryTimer = 0;
    this.crashHandled = false;
    this.crashReason = null;
  }

  // Get active mission's Return Line configuration
  getReturnLine() {
    return (this.missionManager && this.missionManager.getReturnLine) ? this.missionManager.getReturnLine() : null;
  }

  // Ace Combat Return Line Rearm Sequence (Rearms 100%, does NOT repair HP)
  triggerReturnLineRearm(side, lineCoord) {
    if (this.returnLineCooldown > 0 || this.playerDying || this.crashHandled || this.physics.isCrashed) return;

    this.returnLineCooldown = 4.0;
    this.returnLineRearmedNotice = 3.5;

    // 1. Rearm completely: Gun ammo, standard missiles, SP weapons, flares, and ability charges
    // NOTE: In strict accordance with Ace Combat mechanics, HP IS NOT REPAIRED!
    if (this.aircraftConfig && this.aircraftConfig.weapons && this.weapons) {
      const cfgW = this.aircraftConfig.weapons;
      this.weapons.gunAmmo = cfgW.gunAmmo !== undefined ? cfgW.gunAmmo : 900;
      this.weapons.mslCount = cfgW.mslCount !== undefined ? cfgW.mslCount : 120;
      this.weapons.spwCount = cfgW.spwCount !== undefined ? cfgW.spwCount : 36;
      this.weapons.flareCount = cfgW.flareCount !== undefined ? cfgW.flareCount : 30;
      this.weapons.abilityCharges = cfgW.abilityCharges !== undefined ? cfgW.abilityCharges : 1;

      // Reset reload timers for all weapon slots to instantly ready
      if (this.weapons.mslSlots) this.weapons.mslSlots.forEach(s => s.reload = 0);
      if (this.weapons.spwSlots) this.weapons.spwSlots.forEach(s => s.reload = 0);
      if (this.weapons.flareSlots) this.weapons.flareSlots.forEach(s => s.reload = 0);
    }

    // 2. Play Ace Combat Resupply Chime
    if (this.audio && this.audio.playResupplyChime) {
      this.audio.playResupplyChime();
    }

    // 3. Post HUD / Radio notifications
    if (this.missionManager) {
      this.missionManager.postRadioMessage('<< RETURN LINE CROSSED // AIRCRAFT FULLY REARMED >>', 3.5);
      this.missionManager.postRadioMessage('<< RESUPPLY COMPLETE // RETURNING TO COMBAT AIRSPACE >>', 3.5);
    }

    // 4. Reposition / turn aircraft back toward the combat theater at combat cruising speed
    const currentSpeed = Math.max(340, this.flightState ? this.flightState.speed : 340);
    let resetX = this.flightState ? this.flightState.x : 0;
    let resetY = this.flightState ? this.flightState.y : 0;
    let returnHeading = -Math.PI * 0.5;

    if (side === 'bottom') {
      resetY = lineCoord - 450;
      returnHeading = -Math.PI * 0.5; // Face North
    } else if (side === 'top') {
      resetY = lineCoord + 450;
      returnHeading = Math.PI * 0.5; // Face South
    } else if (side === 'left') {
      resetX = lineCoord + 450;
      returnHeading = 0; // Face East
    } else if (side === 'right') {
      resetX = lineCoord - 450;
      returnHeading = Math.PI; // Face West
    }

    this.physics.reset(resetX, resetY, returnHeading, currentSpeed);
    this.boundaryTimer = 0;

    // 5. Friendly base umbrella: clear active missiles tracking the player
    if (this.particles && this.particles.missiles) {
      for (const m of this.particles.missiles) {
        if (m.targetsPlayer) {
          m.isGuided = false;
          m.turnRate = 0;
          m.lostLock = true;
        }
      }
    }
  }

  updateUIButtons() {
    ['su27', 'f15c', 'f111f', 'su57'].forEach(id => {
      const btn = document.getElementById(`btn-${id}`);
      if (btn) {
        if (id === this.currentAircraftId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  togglePause(forceState = null) {
    this.isPaused = (forceState !== null) ? !!forceState : !this.isPaused;
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
      if (this.isPaused) {
        pauseMenu.classList.remove('hidden');
        if (this.audio && this.audio.playSwitchSound) {
          this.audio.playSwitchSound();
        }
      } else {
        pauseMenu.classList.add('hidden');
        if (this.audio && this.audio.playTargetLockSound) {
          this.audio.playTargetLockSound();
        }
      }
    }
  }

  restartTestFlight() {
    // Reset player flight physics to initial combat spawn
    this.physics.reset(0, 0, -Math.PI * 0.25, 335);
    this.crashHandled = false;
    this.crashReason = null;
    this.playerDying = false;
    this.playerFallTimer = 0;
    this.altitude = 1.0;
    this.boundaryTimer = 0;
    this.boundaryState = null;

    // Reset weapons & ammo
    this.loadAircraftWeapons(this.aircraftConfig);

    // Reset targeting state
    this.targeting.designatedTarget = null;
    this.targeting.multiLockedTargets = [];
    this.targeting.lockState = 'NONE';
    this.targeting.lockTimer = 0;

    // Reset particle effects & missiles
    this.particles.reset();

    // Re-initialize active modular mission (restores units, dynamics & triggers)
    if (this.missionManager) {
      if (this.missionManager.currentMission) {
        this.missionManager.applyMission(this.missionManager.currentMission);
      } else {
        this.missionManager.loadMission(this.missionManager.activeMissionId || 'test_flight');
      }
    } else {
      this.targetManager = new TargetManager();
    }

    // Close pause menu and unpause
    this.togglePause(false);

    // Add HUD notification
    if (this.hud && this.hud.notifications) {
      this.hud.notifications.push({
        text: 'TEST FLIGHT RESTARTED // ALL SYSTEMS NOMINAL',
        life: 3.0
      });
    }
  }

  loop(timestamp) {
    if (this.isPaused) {
      this.lastTime = timestamp;
      requestAnimationFrame(this.loop.bind(this));
      return;
    }
    const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    // 1. Update weapons cooldowns & ammo regeneration
    if (this.weapons.damageShakeTimer > 0) {
      this.weapons.damageShakeTimer = Math.max(0, this.weapons.damageShakeTimer - dt);
    }
    if (this.weapons.damageFlashTimer > 0) {
      this.weapons.damageFlashTimer = Math.max(0, this.weapons.damageFlashTimer - dt);
    }
    if (this.weapons.mslReload > 0) {
      this.weapons.mslReload = Math.max(0, this.weapons.mslReload - dt);
    }
    if (this.weapons.flareCooldown > 0) {
      this.weapons.flareCooldown = Math.max(0, this.weapons.flareCooldown - dt);
    }
    if (this.weapons.spwCooldown > 0) {
      this.weapons.spwCooldown = Math.max(0, this.weapons.spwCooldown - dt);
    }

    // Advance independent slot cooldown timers
    if (this.weapons.mslSlots) {
      for (const s of this.weapons.mslSlots) {
        if (s.reload > 0) s.reload = Math.max(0, s.reload - dt);
      }
    }
    if (this.weapons.spwSlots) {
      for (const s of this.weapons.spwSlots) {
        if (s.reload > 0) s.reload = Math.max(0, s.reload - dt);
      }
    }
    if (this.weapons.flareSlots) {
      for (const s of this.weapons.flareSlots) {
        if (s.reload > 0) s.reload = Math.max(0, s.reload - dt);
      }
    }

    // Ability charge cooldown
    if (this.weapons.abilityCharges < this.weapons.maxAbilityCharges) {
      this.weapons.abilityRecharge -= dt;
      if (this.weapons.abilityRecharge <= 0) {
        this.weapons.abilityCharges += 1;
        this.weapons.abilityRecharge = 10.0;
      }
    }

    // Update indicator warning flash timers
    if (this.weapons.flashStates) {
      for (const k in this.weapons.flashStates) {
        const fs = this.weapons.flashStates[k];
        if (fs && fs.timer > 0) {
          fs.timer = Math.max(0, fs.timer - dt);
        }
      }
    }

    // Gun ammo is strictly finite for the mission (does not regenerate)

    // 2. Machine Gun fire
    if (this.input.lmb && !this.crashHandled && !this.physics.isCrashed && !this.playerDying) {
      if (this.weapons.gunAmmo <= 0) {
        this.gunDryFireTimer = (this.gunDryFireTimer || 0) + dt;
        if (this.gunDryFireTimer >= 0.35) {
          this.gunDryFireTimer = 0;
          this.triggerWeaponEmpty('gun');
        }
      } else {
        this.gunDryFireTimer = 0;
        this.gunTimer += dt;
        const fireInterval = 60 / (this.weapons.gunRpm || 1500);
        let fired = false;
        while (this.gunTimer >= fireInterval && this.weapons.gunAmmo > 0) {
          this.gunTimer -= fireInterval;
          this.weapons.gunAmmo = Math.max(0, this.weapons.gunAmmo - 1);
          this.particles.spawnBullet(
            this.physics.x,
            this.physics.y,
            this.physics.heading,
            this.physics.vx,
            this.physics.vy,
            this.weapons.gunDamage || 20
          );
          fired = true;
        }
        if (fired) {
          this.audio.playGunSound();
        }
      }
    } else {
      this.gunDryFireTimer = 0;
      const fireInterval = 60 / (this.weapons.gunRpm || 1500);
      this.gunTimer = fireInterval;
    }

    // 3. Update mouse world coordinates based on current camera
    this.updateMouseWorldCoords();

    // 4. Update Physics
    let flightState;
    if (this.playerDying) {
      this.playerFallTimer += dt;
      const fallProgress = Math.min(1.0, this.playerFallTimer / this.playerFallDuration);
      this.altitude = Math.max(0.0, 1.0 - fallProgress);
      // Gentle natural aerodynamic drag deceleration as the disabled airframe falls
      this.playerFallSpeed = Math.max(40, this.playerFallSpeed - 20 * dt);

      // Lock flight path forward along heading into the ground (no turning/spinning)
      this.physics.heading = this.playerFallHeading;
      this.physics.speed = this.playerFallSpeed;
      this.physics.vx = Math.cos(this.playerFallHeading) * this.playerFallSpeed;
      this.physics.vy = Math.sin(this.playerFallHeading) * this.playerFallSpeed;
      this.physics.x += this.physics.vx * dt;
      this.physics.y += this.physics.vy * dt;

      flightState = {
        x: this.physics.x,
        y: this.physics.y,
        heading: this.physics.heading,
        speed: this.physics.speed,
        vx: this.physics.vx,
        vy: this.physics.vy,
        alpha: 0,
        alphaDeg: 0,
        gForce: 1.0,
        throttle: 0,
        isAirbraking: false,
        isAfterburning: false,
        isDrifting: false,
        isHighG: false,
        turnAuthority: 0,
        turnCompression: 0,
        flightPathAngle: this.playerFallHeading,
        displayedKph: Math.max(0, Math.round(this.physics.speed * 3.6 - 250)),
        isStalled: false,
        stallTimer: 0,
        isCrashed: false
      };
      this.flightState = flightState;

      // Ground impact detonation
      if (fallProgress >= 1.0 || this.altitude <= 0) {
        this.playerDying = false;
        this.altitude = 0.0;
        this.physics.isCrashed = true;
        flightState.isCrashed = true;
        this.crashHandled = true;

        this.particles.spawnExplosion(flightState.x, flightState.y);
        this.particles.spawnExplosion(
          flightState.x + (Math.random() - 0.5) * 40,
          flightState.y + (Math.random() - 0.5) * 40
        );
        this.audio.playCrashSound();

        // Prolonged respawn timer or terminate sortie on No Respawn
        if (this.missionManager && this.missionManager.noRespawn) {
          this.missionManager.isFailed = true;
          this.missionManager.postRadioMessage('PILOT SHOT DOWN // MISSION FAILED (NO RESPAWN)', 5.0);
        } else {
          setTimeout(() => {
            this.respawnPlayer(0, 0, -Math.PI * 0.25, 335);
          }, 3500);
        }
      }
    } else {
      flightState = this.physics.update(dt, this.input);
      this.flightState = flightState;
    }

    // Boundary proximity & Out-of-Bounds Detection
    if (this.returnLineCooldown > 0) this.returnLineCooldown = Math.max(0, this.returnLineCooldown - dt);
    if (this.returnLineRearmedNotice > 0) this.returnLineRearmedNotice = Math.max(0, this.returnLineRearmedNotice - dt);

    const halfSize = (this.world && this.world.halfMapSize) ? this.world.halfMapSize : 15075;
    const mapSize = (this.world && this.world.mapSize) ? this.world.mapSize : (halfSize * 2);
    const returnLine = this.getReturnLine();

    let isCrossingReturnLine = false;
    let isNearReturnLine = false;
    let rlSide = null;
    let rlCoord = 0;

    if (returnLine && returnLine.enabled) {
      rlSide = (returnLine.side || 'bottom').toLowerCase();
      const offset = returnLine.offset !== undefined ? returnLine.offset : 0.10;
      const zoneDepth = mapSize * offset;

      if (rlSide === 'bottom') {
        rlCoord = halfSize - zoneDepth;
        isCrossingReturnLine = flightState.y >= rlCoord;
        isNearReturnLine = !isCrossingReturnLine && (rlCoord - flightState.y < 2200);
      } else if (rlSide === 'top') {
        rlCoord = -halfSize + zoneDepth;
        isCrossingReturnLine = flightState.y <= rlCoord;
        isNearReturnLine = !isCrossingReturnLine && (flightState.y - rlCoord < 2200);
      } else if (rlSide === 'left') {
        rlCoord = -halfSize + zoneDepth;
        isCrossingReturnLine = flightState.x <= rlCoord;
        isNearReturnLine = !isCrossingReturnLine && (flightState.x - rlCoord < 2200);
      } else if (rlSide === 'right') {
        rlCoord = halfSize - zoneDepth;
        isCrossingReturnLine = flightState.x >= rlCoord;
        isNearReturnLine = !isCrossingReturnLine && (rlCoord - flightState.x < 2200);
      }
    }

    // Trigger Return Line rearm if crossed
    if (isCrossingReturnLine && !this.playerDying && !flightState.isCrashed && !this.crashHandled) {
      this.triggerReturnLineRearm(rlSide, rlCoord);
    }

    // Check normal out-of-bounds (excluding the return line zone side so it doesn't lethally explode the player)
    let isOutOfBounds = false;
    if (rlSide === 'bottom') {
      isOutOfBounds = Math.abs(flightState.x) > halfSize || flightState.y < -halfSize;
    } else if (rlSide === 'top') {
      isOutOfBounds = Math.abs(flightState.x) > halfSize || flightState.y > halfSize;
    } else if (rlSide === 'left') {
      isOutOfBounds = flightState.x > halfSize || Math.abs(flightState.y) > halfSize;
    } else if (rlSide === 'right') {
      isOutOfBounds = flightState.x < -halfSize || Math.abs(flightState.y) > halfSize;
    } else {
      isOutOfBounds = Math.abs(flightState.x) > halfSize || Math.abs(flightState.y) > halfSize;
    }

    const distToBorder = Math.min(halfSize - Math.abs(flightState.x), halfSize - Math.abs(flightState.y));
    const isNearBorder = !isOutOfBounds && !isNearReturnLine && distToBorder < 1600;

    if (isOutOfBounds && !flightState.isCrashed && !this.crashHandled && !this.playerDying) {
      this.boundaryTimer += dt;
      this.audio.playBoundaryWarning(true); // Urgent fast alarm
      if (this.boundaryTimer >= 3.0) {
        this.boundaryTimer = 3.0;
        this.physics.isCrashed = true;
        flightState.isCrashed = true;
        this.crashHandled = true;
        this.crashReason = 'OUT_OF_BOUNDS';
        this.particles.spawnExplosion(flightState.x, flightState.y);
        this.audio.playCrashSound();

        if (this.missionManager && this.missionManager.noRespawn) {
          this.missionManager.isFailed = true;
          this.missionManager.postRadioMessage('LEFT AREA OF OPERATION // MISSION FAILED (NO RESPAWN)', 5.0);
        } else {
          setTimeout(() => {
            // Reset safely inside the combat theater facing towards center
            const resetX = Math.sign(flightState.x || 1) * Math.min(Math.abs(flightState.x), halfSize - 2000);
            const resetY = Math.sign(flightState.y || 1) * Math.min(Math.abs(flightState.y), halfSize - 2000);
            const headingToCenter = Math.atan2(-resetY, -resetX);
            this.respawnPlayer(resetX, resetY, headingToCenter, 335);
          }, 2200);
        }
      }
    } else if (isNearBorder && !flightState.isCrashed && !this.playerDying) {
      this.boundaryTimer = 0;
      this.audio.playBoundaryWarning(false); // Proximity alert
    } else if (!isOutOfBounds) {
      this.boundaryTimer = 0;
    }

    this.boundaryState = {
      isOutOfBounds,
      isNearBorder,
      isNearReturnLine,
      returnLineRearmedNotice: this.returnLineRearmedNotice,
      boundaryTimer: this.boundaryTimer,
      crashReason: this.crashReason,
      isDying: this.playerDying,
      isCrashed: this.crashHandled || flightState.isCrashed || this.physics.isCrashed
    };

    // Stall Audio Warning (repeating beep during stall before crash)
    if (flightState.isStalled && !flightState.isCrashed && !isOutOfBounds && !this.playerDying) {
      this.audio.playStallWarning();
    }

    // Crash Handling for aerodynamic stall: Trigger explosion FX, sound, and airframe reset
    if (flightState.isCrashed && !this.crashHandled) {
      this.physics.isCrashed = true;
      this.crashHandled = true;
      this.particles.spawnExplosion(flightState.x, flightState.y);
      this.audio.playCrashSound();
      if (this.missionManager && this.missionManager.noRespawn) {
        this.missionManager.isFailed = true;
        this.missionManager.postRadioMessage('STALL SPIN CRASH // MISSION FAILED (NO RESPAWN)', 5.0);
      } else {
        setTimeout(() => {
          this.respawnPlayer(flightState.x, flightState.y, flightState.heading, 335);
        }, 2500);
      }
    }

    // Dynamic Altitude Factor (Stall Falling Illusion)
    if (!this.playerDying) {
      const targetAltitude = (flightState.isStalled && !this.crashHandled && !flightState.isCrashed)
        ? Math.max(0.0, 1.0 - (flightState.stallTimer / 4.0))
        : 1.0;
      const altRate = flightState.isStalled ? 2.5 : 3.5;
      this.altitude += (targetAltitude - this.altitude) * Math.min(1.0, altRate * dt);
    }
    const altitudeScale = 0.78 + 0.22 * this.altitude;

    // 5. Update Engine Plumes & Wingtip Trails (active when not crashed and not dying)
    if (!this.crashHandled && !flightState.isCrashed && !this.playerDying) {
      this.particles.emitEnginePlume(
        flightState.x,
        flightState.y,
        flightState.heading,
        flightState.speed,
        flightState.throttle,
        flightState.isAfterburning,
        this.aircraftConfig.physics,
        altitudeScale
      );

      this.particles.updateWingtipTrails(
        flightState.x,
        flightState.y,
        flightState.heading,
        flightState,
        this.aircraftConfig.physics,
        altitudeScale
      );
    }

    // Aircraft damage smoke and fire trail (< 60% HP or falling)
    if (!this.crashHandled && !flightState.isCrashed) {
      const playerHpRatio = this.playerDying ? 0.02 : (this.weapons.hp / this.weapons.maxHp);
      this.particles.emitAircraftDamage(
        flightState.x,
        flightState.y,
        flightState.heading,
        flightState.speed,
        playerHpRatio,
        dt,
        'player'
      );

      // Cook-off bursts during shootdown fall
      if (this.playerDying && Math.random() < 0.25) {
        this.particles.particles.push({
          x: flightState.x + (Math.random() - 0.5) * 24,
          y: flightState.y + (Math.random() - 0.5) * 24,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          life: 0.25,
          maxLife: 0.25,
          size: 8 + Math.random() * 10,
          color: Math.random() < 0.5 ? 'rgba(255, 120, 30, 0.9)' : 'rgba(255, 200, 50, 0.9)',
          fade: true,
          grow: true
        });
      }
    }

    // 6. Update Particles
    this.particles.update(dt);

    // 7. Update Targets & Tactical Engagements
    this.targetManager.update(dt, flightState.x, flightState.y, this.particles, this.audio, flightState);

    // Update 3-Layer Modular Mission Dynamics (Objectives, Triggers & AI Orders)
    if (this.missionManager) {
      this.missionManager.update(dt, flightState);
    }

    // 8. Target Designation & Boresight Seeker Lock-on Logic
    if (this.targeting.designatedTarget) {
      const tgt = this.targeting.designatedTarget;
      if (tgt.isDestroyed || tgt.isFalling) {
        this.targeting.designatedTarget = null;
        this.targeting.lockState = 'NONE';
        this.targeting.lockTimer = 0;
      } else {
        const dx = tgt.x - flightState.x;
        const dy = tgt.y - flightState.y;
        const dist = Math.hypot(dx, dy);
        const bearing = Math.atan2(dy, dx);
        let angleDiff = bearing - flightState.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const inSeekerCone = Math.abs(angleDiff) <= this.targeting.lockCone && dist <= this.targeting.lockRange;

        if (inSeekerCone) {
          this.targeting.lockTimer += dt;
          if (this.targeting.lockTimer >= this.targeting.lockTimeRequired) {
            if (this.targeting.lockState !== 'LOCKED') {
              this.targeting.lockState = 'LOCKED';
              this.audio.playLockTone();
            }

            // Multi-Lock Target Acquisition for 4AAM / Multi-Lock weapons (only when Special Weapon is armed)
            const spwId = this.weapons.equippedSpwId;
            const spwDef = SPECIAL_WEAPONS[spwId];
            if (this.weapons.selectedWeapon === 'spw' && spwDef && (spwDef.isMultiLock || spwId === '4aam') && tgt.type === 'air') {
              const maxLocks = spwDef.maxLocks || 4;
              const candidates = this.targetManager.targets.filter(other => 
                other.type === 'air' && 
                !other.isDestroyed && 
                !other.isFalling &&
                other.id !== tgt.id
              );
              // Sort by proximity to primary target
              candidates.sort((a, b) => {
                const da = Math.hypot(a.x - tgt.x, a.y - tgt.y);
                const db = Math.hypot(b.x - tgt.x, b.y - tgt.y);
                return da - db;
              });
              // Close vicinity filter: within 4500 units of designated target and within radar envelope
              const closeVicinity = candidates.filter(c => {
                const dToTgt = Math.hypot(c.x - tgt.x, c.y - tgt.y);
                const dToPlayer = Math.hypot(c.x - flightState.x, c.y - flightState.y);
                return dToTgt <= 4500 && dToPlayer <= this.targeting.lockRange * 1.25;
              });
              this.targeting.multiLockedTargets = [tgt, ...closeVicinity.slice(0, maxLocks - 1)];
            } else {
              this.targeting.multiLockedTargets = [tgt];
            }
          } else {
            this.targeting.lockState = 'TRACKING';
            this.targeting.multiLockedTargets = [tgt];
          }
        } else {
          // Off boresight seeker cone: lock decays
          this.targeting.lockTimer = Math.max(0, this.targeting.lockTimer - dt * 2.0);
          if (this.targeting.lockTimer < this.targeting.lockTimeRequired) {
            this.targeting.lockState = this.targeting.lockTimer > 0 ? 'TRACKING' : 'NONE';
            this.targeting.multiLockedTargets = [];
          }
        }
      }
    } else {
      this.targeting.lockState = 'NONE';
      this.targeting.lockTimer = 0;
      this.targeting.multiLockedTargets = [];
    }

    // Check for incoming enemy missiles actively tracking the player
    let inbound = false;
    for (const m of this.particles.missiles) {
      // Must be an active enemy missile targeting the player (not bombs, not targets other than player)
      if (m.isEnemy && m.targetsPlayer && !m.isBomb) {
        if (this.playerDying || this.crashHandled || flightState.isCrashed || this.physics.isCrashed || m.lostLock || !m.isGuided || m.decoyed) {
          // If player is destroyed, or missile lost lock / evaded / flared, stop tracking and stop alerting
          m.isGuided = false;
          m.turnRate = 0;
          m.lostLock = true;
        } else {
          // Update tracking coordinates to player position
          m.targetX = flightState.x;
          m.targetY = flightState.y;

          // Check if missile is currently an active threat to player:
          // 1. Within radar warning receiver detection range (< 4200m)
          const distToPlayer = Math.hypot(m.x - flightState.x, m.y - flightState.y);
          if (distToPlayer < 4200) {
            // 2. Missile is flying towards the player (not pointing away or already passed)
            const dx = flightState.x - m.x;
            const dy = flightState.y - m.y;
            const forwardDot = (Math.cos(m.heading) * dx + Math.sin(m.heading) * dy) / (distToPlayer || 1);
            if (forwardDot > 0.15) {
              inbound = true;
            }
          }
        }
      }

      // Semi-Active Air-to-Air Missile (SAAM) radar illumination check
      if (m.isSAAM && m.target) {
        if (!m.target.isDestroyed && !m.target.isFalling) {
          m.targetX = m.target.x;
          m.targetY = m.target.y;
          // Pilot must keep mouse cursor near target (< 340px world radius)
          const cursorDist = Math.hypot(this.input.targetWorldX - m.target.x, this.input.targetWorldY - m.target.y);
          // And target must remain in front of aircraft radar scan cone
          const dx = m.target.x - flightState.x;
          const dy = m.target.y - flightState.y;
          const bearing = Math.atan2(dy, dx);
          let angleDiff = bearing - flightState.heading;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          m.illuminated = (cursorDist <= 340) && (Math.abs(angleDiff) <= 0.85);
        } else {
          m.illuminated = false;
        }
      }
    }
    this.targeting.missileInbound = inbound;

    // Incoming missile warning audio: constant rhythmic military RWR pulse while tracking player
    if (inbound && !flightState.isCrashed && !this.crashHandled) {
      this.missileAlertTimer = (this.missileAlertTimer || 0) + dt;
      if (this.missileAlertTimer >= 0.55) {
        this.missileAlertTimer = 0;
        this.audio.playMissileAlert();
      }
    } else {
      this.missileAlertTimer = 0.55; // Armed to sound immediately upon next missile launch
    }

    // 9. Combat Collision & Hit Detection
    // A. Player Machine Gun Bullets vs Targets
    for (let bi = this.particles.bullets.length - 1; bi >= 0; bi--) {
      const b = this.particles.bullets[bi];
      if (b.isEnemy) continue;
      for (const tgt of this.targetManager.targets) {
        if (tgt.isDestroyed || tgt.isFalling) continue;
        const dist = Math.hypot(b.x - tgt.x, b.y - tgt.y);
        if (dist <= tgt.hitRadius) {
          const roleMult = this.getRoleDamageMultiplier(tgt.type);
          const finalBulletDmg = (b.damage || 20) * roleMult;
          this.targetManager.damageTarget(tgt, finalBulletDmg, this.particles, this.audio);
          for (let sp = 0; sp < 3; sp++) {
            this.particles.particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60,
              life: 0.10,
              maxLife: 0.10,
              size: 3,
              color: '#ffee55',
              type: 'spark'
            });
          }
          this.particles.bullets.splice(bi, 1);
          break;
        }
      }
    }

    // B. Player Missiles / Bombs vs Targets
    for (let mi = this.particles.missiles.length - 1; mi >= 0; mi--) {
      const m = this.particles.missiles[mi];
      if (m.isEnemy) continue;

      if (m.isBomb || m.isMPBM) {
        // Bomb / MPBM detonation: either timed ground impact, missile life expiry, or target proximity
        let shouldDetonate = !!m.detonated || m.life <= 0;
        if (!shouldDetonate) {
          for (const tgt of this.targetManager.targets) {
            if (tgt.isDestroyed || tgt.isFalling) continue;
            // Ground bombs only detonate on surface targets; MPBM detonates near any target (air/ground/naval)
            if (m.isBomb && !m.isMPBM && tgt.type === 'air') continue;
            if (Math.hypot(m.x - tgt.x, m.y - tgt.y) <= tgt.hitRadius + (m.isMPBM ? 34 : 20)) {
              shouldDetonate = true;
              break;
            }
          }
        }

        if (shouldDetonate) {
          this.particles.spawnExplosion(m.x, m.y);
          if (m.isMPBM) {
            // Massive expanding tactical burst sphere with surrounding fireballs
            for (let s = 0; s < 5; s++) {
              const a = (s / 5) * Math.PI * 2;
              const d = 45 + Math.random() * 40;
              this.particles.spawnExplosion(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d);
            }
          }
          if (this.audio && this.audio.playMissileHitSound) {
            this.audio.playMissileHitSound(true);
          } else {
            this.audio.playCrashSound();
          }

          // Shockwave rings
          const ringCount = m.isMPBM ? 26 : 20;
          for (let r = 0; r < ringCount; r++) {
            const angle = (r / ringCount) * Math.PI * 2;
            const spd = (m.isMPBM ? 180 : 120) + Math.random() * 80;
            this.particles.particles.push({
              x: m.x,
              y: m.y,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              life: m.isMPBM ? 0.65 : 0.5,
              maxLife: m.isMPBM ? 0.65 : 0.5,
              size: (m.isMPBM ? 18 : 14) + Math.random() * 10,
              color: m.isMPBM ? 'rgba(255, 90, 20, 0.85)' : 'rgba(255, 180, 50, 0.65)',
              type: 'smoke'
            });
          }

          // Area splash damage to all targets within blast radius
          const blastR = m.blastRadius || (m.isMPBM ? 380 : (m.isUGB ? 140 : 280));
          for (const tgt of this.targetManager.targets) {
            if (tgt.isDestroyed || tgt.isFalling) continue;
            // UGBs and surface bombs only damage surface (ground/naval) targets, not airborne planes. MPBM damages all target types.
            if ((m.isBomb || m.isUGB) && !m.isMPBM && tgt.type === 'air') continue;
            const dist = Math.hypot(tgt.x - m.x, tgt.y - m.y);
            if (dist <= blastR + tgt.hitRadius) {
              const falloff = Math.max(0.35, 1.0 - (dist / (blastR + tgt.hitRadius)) * 0.65);
              const splashDmg = Math.round((m.damage || 140) * falloff);
              const roleMult = this.getRoleDamageMultiplier(tgt.type);
              const finalSplashDmg = Math.max(1, Math.round(splashDmg * roleMult));
              this.targetManager.damageTarget(tgt, finalSplashDmg, this.particles, this.audio);
            }
          }

          this.particles.missiles.splice(mi, 1);
          continue;
        }
      } else {
        // Direct kinetic / proximity hit for missiles
        for (const tgt of this.targetManager.targets) {
          if (tgt.isDestroyed || tgt.isFalling) continue;
          const hitDist = tgt.hitRadius + 22;
          const dist = Math.hypot(m.x - tgt.x, m.y - tgt.y);
          if (dist <= hitDist) {
            const roleMult = this.getRoleDamageMultiplier(tgt.type);
            const finalMissileDmg = Math.max(1, Math.round((m.damage || 32) * roleMult));
            this.targetManager.damageTarget(tgt, finalMissileDmg, this.particles, this.audio);
            this.particles.spawnExplosion(m.x, m.y);
            if (this.audio && this.audio.playMissileHitSound) {
              this.audio.playMissileHitSound(m.isHPAA || finalMissileDmg >= 60);
            }
            this.particles.missiles.splice(mi, 1);
            break;
          }
        }
      }
    }

    // C. Enemy Machine Gun Bullets & Naval Flak vs Player
    for (let bi = this.particles.bullets.length - 1; bi >= 0; bi--) {
      const b = this.particles.bullets[bi];
      if (!b.isEnemy) continue;
      if (b.isCIWS) continue; // CIWS only targets missiles

      const dist = Math.hypot(b.x - flightState.x, b.y - flightState.y);

      if (b.isFlak) {
        if (dist <= 48) {
          this.applyPlayerDamage(b.damage || 2.5, 'AA_FLAK');
          this.particles.spawnFlakBurst(b.x, b.y);
          if (this.audio && this.audio.playMissileHitSound) {
            this.audio.playMissileHitSound(false);
          }
          this.particles.bullets.splice(bi, 1);
        }
        continue;
      }

      if (dist <= 32) {
        this.applyPlayerDamage(b.damage || 1.4, 'DOGFIGHT_GUN_KILL');
        for (let sp = 0; sp < 3; sp++) {
          this.particles.particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            life: 0.10,
            maxLife: 0.10,
            size: 3,
            color: '#ff8833',
            type: 'spark'
          });
        }
        this.particles.bullets.splice(bi, 1);
      }
    }

    // D. Enemy SAM & Fighter Missiles vs Player
    for (let mi = this.particles.missiles.length - 1; mi >= 0; mi--) {
      const m = this.particles.missiles[mi];
      if (!m.isEnemy) continue;

      const dist = Math.hypot(m.x - flightState.x, m.y - flightState.y);
      if (dist <= 34) {
        this.particles.spawnExplosion(m.x, m.y);
        this.particles.missiles.splice(mi, 1);
        if (this.audio && this.audio.playMissileHitSound) {
          this.audio.playMissileHitSound(true);
        } else {
          this.audio.playCrashSound();
        }

        this.applyPlayerDamage(m.damage || 32, m.ownerId ? 'DOGFIGHT_KILL' : 'SAM_KILL');
      }
    }

    // Transonic Sonic Boom (momentary animated vapor cone & shock thump when passing Mach 1.0)
    const physKph = flightState.speed * 3.6;
    const dispKph = Math.max(300, Math.round(physKph - 250));
    const currentMach = dispKph / 1225;

    if (
      (this.prevMach < 1.0 && currentMach >= 1.0) ||
      (this.prevMach > 1.0 && currentMach <= 1.0)
    ) {
      this.particles.spawnSonicBoom(flightState.x, flightState.y, flightState.heading);
      this.audio.playSonicBoom();
    }
    this.prevMach = currentMach;

    // 7. Update Audio
    this.audio.update(flightState);

    // 8. Dynamic Camera: Zoomed out view + Dynamic Mouse Edge Scrolling
    // A. Zoom: 0.68 at cruise down to 0.52 at high supersonic speed
    const speedRatio = Math.min(1.0, flightState.speed / this.aircraftConfig.physics.maxSpeed);
    this.camera.targetZoom = 0.68 - speedRatio * 0.16;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * Math.min(1.0, 3.5 * dt);

    // B. Dynamic Mouse Scrolling:
    // Panning offset increases the closer the mouse is to screen edges,
    // but strictly constrained so the player's plane always stays fully on screen (even in corners).
    const screenCenterX = this.width * 0.5;
    const screenCenterY = this.height * 0.5;

    // Normalized mouse coordinates from center: [-1.0, 1.0]
    const normMouseX = Math.max(-1.0, Math.min(1.0, (this.input.rawMouseX - screenCenterX) / (screenCenterX || 1)));
    const normMouseY = Math.max(-1.0, Math.min(1.0, (this.input.rawMouseY - screenCenterY) / (screenCenterY || 1)));

    // Plane screen boundary margin (pixels from viewport border)
    const margin = 85;
    const maxPanPxX = Math.max(10, screenCenterX - margin);
    const maxPanPxY = Math.max(10, screenCenterY - margin);

    // Convert maximum allowable camera pan to world coordinates
    const maxPanWorldX = maxPanPxX / this.camera.zoom;
    const maxPanWorldY = maxPanPxY / this.camera.zoom;

    // Target camera position
    const targetCamX = flightState.x + normMouseX * maxPanWorldX;
    const targetCamY = flightState.y + normMouseY * maxPanWorldY;

    // Smooth camera tracking
    this.camera.x += (targetCamX - this.camera.x) * Math.min(1.0, 6.0 * dt);
    this.camera.y += (targetCamY - this.camera.y) * Math.min(1.0, 6.0 * dt);
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const flightState = this.flightState;
    if (!flightState) return;

    // Camera Transform
    this.ctx.save();
    this.ctx.translate(this.width * 0.5, this.height * 0.5);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw World / Ocean / Waves / Islands / Clouds / Return Line
    this.world.draw(this.ctx, this.camera, this.getReturnLine());

    // 2. Draw Ground Shadow (Cast far below onto ocean surface, smaller for high altitude illusion)
    this.drawAircraftShadow(this.ctx, flightState);

    // 3. Draw Tactical Practice Targets (MiG-21s, warships, SAM batteries)
    this.targetManager.draw(this.ctx);

    // 4. Draw Particles (Behind plane: exhaust, trails, flares, missiles, bullets)
    this.particles.draw(this.ctx);

    // 5. Draw Player Aircraft
    this.drawAircraft(this.ctx, flightState);

    this.ctx.restore();

    // 6. Draw HUD (Screen Space Overlay with Ace Combat Radar & Tactical Console)
    this.hud.draw(
      this.ctx,
      flightState,
      this.aircraftConfig,
      this.input,
      this.camera,
      this.width,
      this.height,
      this.weapons,
      this.world,
      this.particles,
      this.boundaryState,
      this.targeting,
      this.targetManager,
      this.missionManager
    );
  }

  drawAircraftShadow(ctx, flightState) {
    if (this.crashHandled || flightState.isCrashed) return;
    const sprite = this.sprites[this.currentAircraftId];
    const p = this.aircraftConfig.physics;

    const alt = Math.max(0.0, Math.min(1.0, this.altitude !== undefined ? this.altitude : 1.0));

    // Shadow moves closer to the plane as it falls towards the ground
    // At high altitude: (72, 96). As it falls toward ocean: closes in to (10, 14) directly beneath plane!
    const baseOffsetX = 72;
    const baseOffsetY = 96;
    const shadowOffsetX = baseOffsetX * (0.12 + 0.88 * alt);
    const shadowOffsetY = baseOffsetY * (0.12 + 0.88 * alt);

    // As plane nears the ground, shadow becomes sharper, darker, and slightly larger
    const shadowScale = 0.68 + 0.20 * (1.0 - alt);
    const size = (p.length || 105) * shadowScale;
    const shadowBlur = Math.max(1, Math.round(3.5 * alt));
    const shadowAlpha = 0.26 + 0.22 * (1.0 - alt);

    ctx.save();
    ctx.translate(flightState.x + shadowOffsetX, flightState.y + shadowOffsetY);
    ctx.rotate(flightState.heading + Math.PI * 0.75);

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.save();
      ctx.filter = `brightness(0) blur(${shadowBlur}px)`;
      ctx.globalAlpha = shadowAlpha;
      ctx.drawImage(sprite, -size * 0.5, -size * 0.5, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.moveTo(size * 0.45, 0);
      ctx.lineTo(-size * 0.45, -size * 0.35);
      ctx.lineTo(-size * 0.3, 0);
      ctx.lineTo(-size * 0.45, size * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawAircraft(ctx, flightState) {
    if (this.crashHandled || flightState.isCrashed) return;
    const sprite = this.sprites[this.currentAircraftId];
    const p = this.aircraftConfig.physics;

    const alt = Math.max(0.0, Math.min(1.0, this.altitude !== undefined ? this.altitude : 1.0));

    // Plane shrinks by ~22% as it falls away from camera toward the ocean surface
    const altitudeScale = 0.78 + 0.22 * alt;
    const size = (p.length || 105) * altitudeScale;

    ctx.save();
    ctx.translate(flightState.x, flightState.y);

    // Rotate to match aircraft heading (sprite nose faces -135 deg)
    ctx.rotate(flightState.heading + Math.PI * 0.75);

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, -size * 0.5, -size * 0.5, size, size);
    } else {
      ctx.fillStyle = '#607d8b';
      ctx.beginPath();
      ctx.moveTo(size * 0.45, 0);
      ctx.lineTo(-size * 0.45, -size * 0.35);
      ctx.lineTo(-size * 0.3, 0);
      ctx.lineTo(-size * 0.45, size * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // Cosmetic damage fire attached to airframe when HP < 10% or falling
    const hpRatio = this.weapons.hp / this.weapons.maxHp;
    if ((hpRatio < 0.10 && hpRatio > 0) || this.playerDying) {
      ctx.save();
      ctx.translate(flightState.x, flightState.y);
      ctx.rotate(flightState.heading);
      this.drawAirframeFire(ctx, size);
      ctx.restore();
    }
  }

  // Draw cosmetic licking flame effect attached to damaged aircraft airframe (< 10% HP)
  drawAirframeFire(ctx, size) {
    ctx.save();
    const scale = size / 100;
    const fireX = -size * 0.15;
    const fireY = -size * 0.18;
    ctx.translate(fireX, fireY);

    const now = performance.now() * 0.015;
    const flicker1 = Math.sin(now * 1.8) * 3 * scale;
    const flicker2 = Math.cos(now * 2.5) * 2.5 * scale;
    const flicker3 = Math.sin(now * 3.3 + 1.2) * 2 * scale;

    // 1. Radial pulsing heat distortion glow
    const glowGrad = ctx.createRadialGradient(0, 0, 2 * scale, 0, 0, 24 * scale);
    glowGrad.addColorStop(0, 'rgba(255, 220, 60, 0.9)');
    glowGrad.addColorStop(0.35, 'rgba(255, 80, 20, 0.6)');
    glowGrad.addColorStop(1, 'rgba(255, 20, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 24 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer intense red-orange licking flame tongues pointing towards -X (trailing in slipstream)
    ctx.fillStyle = 'rgba(255, 60, 0, 0.92)';
    ctx.beginPath();
    ctx.moveTo(5 * scale, 0);
    ctx.quadraticCurveTo(0, -6 * scale + flicker1, -14 * scale + flicker2, -8 * scale);
    ctx.lineTo(-24 * scale + flicker1 * 1.6, -3 * scale);
    ctx.quadraticCurveTo(-16 * scale, 0, -30 * scale + flicker3 * 1.8, 4 * scale);
    ctx.quadraticCurveTo(-12 * scale, 5 * scale, -20 * scale + flicker2, 9 * scale);
    ctx.quadraticCurveTo(-2 * scale, 7 * scale, 5 * scale, 0);
    ctx.closePath();
    ctx.fill();

    // 3. Inner bright yellow-orange flame core
    ctx.fillStyle = '#ffcc11';
    ctx.beginPath();
    ctx.moveTo(3 * scale, 0);
    ctx.quadraticCurveTo(-2 * scale, -4 * scale, -12 * scale + flicker2, -3 * scale);
    ctx.lineTo(-18 * scale + flicker1, 1 * scale);
    ctx.quadraticCurveTo(-8 * scale, 5 * scale, 3 * scale, 0);
    ctx.closePath();
    ctx.fill();

    // 4. White-hot ignition center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Instantiate on DOM load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new FlightGame();
  });
}

export { FlightGame };
