// ==========================================
// 3-LAYER MODULAR MISSION SYSTEM
// Layer 1: Map (Bounds, Terrain, Atmosphere, Ocean)
// Layer 2: Units (Player Spawns, Air, Ground, Naval, Orders, Spawn/Despawn)
// Layer 3: Dynamics (Objectives, Triggers, Events, Dialogue, Nukes, Explosions)
// ==========================================

import { getAIPlaneHealth } from './targets.js';
import { profileManager } from './profile.js';

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.currentMission = null;
    this.activeMissionId = 'test_flight';

    // Layer 3: Dynamics runtime state
    this.objectives = [];
    this.triggers = [];
    this.firedTriggers = new Set();
    this.elapsedTime = 0;
    this.isCompleted = false;
    this.isFailed = false;
    this.playerSpawns = [];
    this.radioMessages = [];
    this.areas = [];

    // Mission Mode, Player Count & Loadout Configuration
    this.missionType = 'singleplayer'; // 'singleplayer' | 'multiplayer'
    this.playerCount = 1;
    this.loadout = { mode: 'player' };
    this.noRespawn = false;
    this.isScriptedEnding = false;
    this.scriptedEndTitle = null;
    this.scriptedEndText = null;

    // Dialogue transmission system (top-right animated portrait + typewriter speech bubble)
    this.activeDialogue = null;
    this.dialogueQueue = [];
    this.portraitCache = {};

    // Megaton Nuclear Detonation state
    this.nukeState = {
      timer: 0,
      duration: 2.5,
      x: 0,
      y: 0
    };

    // Cinematic Sector Transition (Fade to black to load/unload units / time progression)
    this.fadeTransition = null;
  }

  // Load a mission by ID or direct JSON data
  async loadMission(missionIdOrData) {
    let data = null;
    if (typeof missionIdOrData === 'string') {
      this.activeMissionId = missionIdOrData;
      try {
        const res = await fetch(`./data/missions/${missionIdOrData}.json`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn(`[MissionManager] Failed fetching mission '${missionIdOrData}':`, err);
      }
    } else if (typeof missionIdOrData === 'object') {
      data = missionIdOrData;
      if (data.map && data.map.id) {
        this.activeMissionId = data.map.id;
      }
    }

    if (!data) {
      console.log(`[MissionManager] Using default built-in mission configuration.`);
      return false;
    }

    this.currentMission = data;
    this.applyMission(data);
    return true;
  }

  // Apply the 3 layers to game systems
  applyMission(data) {
    if (!data) return;
    this.currentMission = data;

    // ----------------------------------------------------
    // LAYER 1: THE MAP LAYER
    // ----------------------------------------------------
    if (data.map && this.game.world) {
      const m = data.map;
      if (m.size) {
        this.game.world.mapSize = m.size;
        this.game.world.halfMapSize = m.halfMapSize || (m.size * 0.5);
      }
      if (Array.isArray(m.terrain) && m.terrain.length > 0) {
        this.game.world.islands = m.terrain.map(t => {
          const lType = t.landType || (t.theme || 'island');
          const defaultColor = (lType === 'desert') ? '#b89558' : (lType === 'city' ? '#383d47' : '#1a382d');
          const defaultSandColor = (lType === 'desert') ? '#d4b373' : (lType === 'city' ? '#252930' : '#45594b');
          const isl = {
            id: t.id,
            type: (t.points && t.points.length >= 3) ? 'polygon' : (t.type || 'island'),
            landType: lType,
            x: t.x !== undefined ? t.x : 0,
            y: t.y !== undefined ? t.y : 0,
            radius: t.radius || 350,
            color: t.color || defaultColor,
            sandColor: t.sandColor || defaultSandColor
          };
          if (Array.isArray(t.points) && t.points.length >= 3) {
            isl.points = t.points.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });
            // Calculate centroid and radius if not specified or zero
            if (isl.x === 0 && isl.y === 0) {
              let sumX = 0;
              let sumY = 0;
              for (const pt of isl.points) {
                sumX += pt.x;
                sumY += pt.y;
              }
              isl.x = sumX / isl.points.length;
              isl.y = sumY / isl.points.length;
            }
            let maxDist = 0;
            for (const pt of isl.points) {
              const d = Math.hypot(pt.x - isl.x, pt.y - isl.y);
              if (d > maxDist) maxDist = d;
            }
            isl.radius = Math.max(isl.radius, maxDist + 20);
          }
          return isl;
        });
      }
      if (m.oceanTheme) {
        this.game.world.oceanTheme = m.oceanTheme;
      }
    }

    // ----------------------------------------------------
    // LAYER 2: THE UNITS LAYER
    // ----------------------------------------------------
    if (data.units) {
      const u = data.units;
      this.playerSpawns = Array.isArray(u.playerSpawns) ? u.playerSpawns : [];

      // Reposition player to primary spawn point if defined
      const primarySpawn = this.playerSpawns.find(s => s.isPrimary) || this.playerSpawns[0];
      if (primarySpawn && this.game.physics) {
        this.game.physics.reset(
          primarySpawn.x || 0,
          primarySpawn.y || 0,
          primarySpawn.heading !== undefined ? primarySpawn.heading : -Math.PI * 0.25,
          primarySpawn.speed || 335
        );
      }

      // Populate combat targets
      if (this.game.targetManager) {
        const allTargets = [];
        if (Array.isArray(u.airUnits)) allTargets.push(...u.airUnits);
        if (Array.isArray(u.navalUnits)) allTargets.push(...u.navalUnits);
        if (Array.isArray(u.groundUnits)) allTargets.push(...u.groundUnits);

        if (allTargets.length > 0) {
          // Initialize fresh targets with active/dormant spawn tracking
          this.game.targetManager.targets = allTargets.map(t => {
            let defaultHp = 100;
            if (t.type === 'air' && t.aiType) {
              defaultHp = getAIPlaneHealth(t.aiType);
            } else if (t.type === 'ground') {
              const gt = (t.groundType || t.subType || '').toLowerCase();
              if (gt === 'apc') defaultHp = 32;
              else if (gt === 'tank') defaultHp = 64;
              else if (gt === 'pillbox') defaultHp = 96;
              else if (gt === 'bunker') defaultHp = 128;
              else if (gt === 'flak_aa') defaultHp = 48;
              else defaultHp = 64;
            }
            const finalMaxHp = t.maxHp || t.hp || defaultHp;
            return Object.assign({}, t, {
              active: (t.active !== undefined ? t.active : (t.spawned !== undefined ? t.spawned : true)),
              isDestroyed: false,
              respawnTimer: 0,
              hp: t.hp || finalMaxHp,
              maxHp: finalMaxHp
            });
          });
        }
      }
    }

    // ----------------------------------------------------
    // LAYER 3: THE DYNAMICS LAYER & OPERATIONAL AREAS
    // ----------------------------------------------------
    this.resetDynamics();

    // Differentiate Singleplayer vs Multiplayer Missions & Aircraft Loadout
    this.missionType = data.missionType || (data.mode === 'multiplayer' ? 'multiplayer' : 'singleplayer');
    this.playerCount = data.playerCount || (this.missionType === 'multiplayer' ? Math.max(2, (this.playerSpawns ? this.playerSpawns.length : 2)) : 1);
    this.loadout = data.loadout || { mode: 'player' };
    this.noRespawn = (this.missionType === 'singleplayer') && !!(data.noRespawn || (data.dynamics && data.dynamics.loseConditions && data.dynamics.loseConditions.noRespawn));

    // Singleplayer can use equipped loadout or force a specific plane/loadout
    if (this.missionType === 'singleplayer' && this.loadout.mode === 'forced' && this.loadout.aircraft) {
      if (this.game && this.game.applyForcedLoadout) {
        this.game.applyForcedLoadout(this.loadout);
      }
    } else {
      // Multiplayer ALWAYS uses the plane/loadout the player has equipped
      if (this.game && this.game.restoreEquippedLoadout) {
        this.game.restoreEquippedLoadout();
      }
    }

    // Apply Player Tweakables & Initial State (Health, Ammo, God Mode, Unlimited Ammo, Speed, Altitude)
    const pt = data.playerTweakables || (data.player && data.player.tweakables) || null;
    if (this.game && this.game.applyPlayerTweakables) {
      this.game.applyPlayerTweakables(pt);
    }

    this.areas = (data.dynamics && data.dynamics.areas) || (data.map && data.map.areas) || data.areas || [];
    if (data.dynamics) {
      const d = data.dynamics;
      this.objectives = Array.isArray(d.objectives) ? d.objectives.map(o => Object.assign({ currentKills: 0, isCompleted: false }, o)) : [];
      this.triggers = Array.isArray(d.triggers) ? d.triggers : [];
      this.winConditions = d.winConditions || { allPrimaryComplete: true };
      this.loseConditions = d.loseConditions || { playerDestroyed: false };
      if (this.noRespawn) {
        this.loseConditions.playerDestroyed = true;
        this.loseConditions.noRespawn = true;
      }
    }

    // Fire ON_START triggers immediately
    this.evaluateTriggers('ON_START');
  }

  getArea(id) {
    if (!id || !this.areas) return null;
    return this.areas.find(a => a.id === id) || null;
  }

  resetDynamics() {
    this.elapsedTime = 0;
    this.firedTriggers.clear();
    this.isCompleted = false;
    this.isFailed = false;
    this.isScriptedEnding = false;
    this.scriptedEndTitle = null;
    this.scriptedEndText = null;
    this.radioMessages = [];
    this.activeDialogue = null;
    this.dialogueQueue = [];
    this.nukeState = { timer: 0, duration: 2.5, x: 0, y: 0 };
    this.fadeTransition = null;
  }

  // Return Line configuration helper
  getReturnLine() {
    if (this.currentMission && this.currentMission.map && this.currentMission.map.returnLine) {
      return this.currentMission.map.returnLine;
    }
    return null;
  }

  // Update triggers, objectives, dialogue typewriter, nuclear flash, and fade transitions
  update(dt, flightState) {
    if (!this.currentMission) return;
    this.elapsedTime += dt;

    // 1. Megaton Nuke timer decay
    if (this.nukeState.timer > 0) {
      this.nukeState.timer = Math.max(0, this.nukeState.timer - dt);
    }

    // 2. Active Dialogue Update (Animation, Typewriter & Audio)
    this.updateDialogue(dt);

    // 3. Cinematic Sector Fade Transition Update
    this.updateFadeTransition(dt);

    // 4. Evaluate Periodic Triggers (TIMER, PROXIMITY, AREA ENTRY)
    this.evaluateTriggers('TIMER', { time: this.elapsedTime });
    if (flightState) {
      this.evaluateTriggers('PLAYER_PROXIMITY', { x: flightState.x, y: flightState.y });
      this.evaluateTriggers('PLAYER_ENTER_AREA', { x: flightState.x, y: flightState.y });
    }
    this.evaluateTriggers('UNIT_ENTER_AREA');

    // 5. Track Objectives Progress
    const tm = this.game.targetManager;
    if (tm && this.objectives.length > 0) {
      const destroyedCount = tm.targets.filter(t => t.active !== false && t.isDestroyed).length;
      for (const obj of this.objectives) {
        if (obj.type === 'DESTROY_TARGETS') {
          obj.currentKills = destroyedCount;
          if (obj.currentKills >= (obj.requiredCount || 1)) {
            if (!obj.isCompleted) {
              obj.isCompleted = true;
              this.onObjectiveCompleted(obj);
            }
          }
        }
      }
    }

    // 6. Radio messages lifecycle
    for (let i = this.radioMessages.length - 1; i >= 0; i--) {
      this.radioMessages[i].life -= dt;
      if (this.radioMessages[i].life <= 0) {
        this.radioMessages.splice(i, 1);
      }
    }

    // 7. Evaluate Win & Lose conditions
    if (!this.isCompleted && !this.isFailed) {
      // Lose conditions
      if (this.loseConditions) {
        const isPlayerDown = (this.game.physics && this.game.physics.isCrashed) || (this.game && this.game.playerDying);
        if ((this.noRespawn || this.loseConditions.playerDestroyed) && isPlayerDown) {
          this.isFailed = true;
          this.postRadioMessage('CRITICAL ALERT // AIRCRAFT DESTROYED - MISSION FAILED', 5.0);
        } else if (this.loseConditions.timeLimit > 0 && this.elapsedTime >= this.loseConditions.timeLimit) {
          this.isFailed = true;
          this.postRadioMessage('OPERATION TIME EXCEEDED // MISSION FAILED', 5.0);
        }
      }

      // Win conditions
      if (this.winConditions) {
        if (this.winConditions.requiredKills > 0 && this.game.targetManager) {
          const destroyed = this.game.targetManager.targets.filter(t => t.active !== false && t.isDestroyed).length;
          if (destroyed >= this.winConditions.requiredKills) {
            this.isCompleted = true;
            this.postRadioMessage('MISSION ACCOMPLISHED // TARGET QUOTA SECURED', 5.0);
            this.onMissionCompleted();
          }
        }
        if (this.winConditions.allPrimaryComplete && this.objectives.length > 0) {
          const allPrimDone = this.objectives.filter(o => o.isPrimary).every(o => o.isCompleted);
          if (allPrimDone && !this.isCompleted) {
            this.isCompleted = true;
            this.postRadioMessage('MISSION ACCOMPLISHED // ALL PRIMARY OBJECTIVES SECURED', 5.0);
            this.onMissionCompleted();
          }
        }
      }
    }
  }

  onMissionCompleted() {
    if (this.activeMissionId === 'tutorial') {
      profileManager.completeTutorial();
      profileManager.recordSortie(true, 5, 0);
      if (this.game.hud && this.game.hud.notifications) {
        this.game.hud.notifications.push({
          text: 'TUTORIAL COMPLETED // COMBAT HANGAR ACCESS UNLOCKED!',
          life: 8.0
        });
      }
    } else {
      profileManager.recordSortie(true, 2, 0);
    }
  }

  // Update cinematic fade transition states
  updateFadeTransition(dt) {
    if (!this.fadeTransition) return;
    const ft = this.fadeTransition;
    ft.timer += dt;

    if (ft.state === 'FADING_OUT') {
      ft.alpha = Math.min(1.0, ft.timer / ft.fadeTime);
      if (ft.timer >= ft.fadeTime) {
        ft.state = 'HOLD_BLACK';
        ft.timer = 0;
        ft.alpha = 1.0;

        // Execute sector major changes at peak blackness
        if (!ft.executed) {
          ft.executed = true;
          this.executeSectorChanges(ft.config);
        }
      }
    } else if (ft.state === 'HOLD_BLACK') {
      ft.alpha = 1.0;
      if (ft.timer >= ft.holdTime) {
        ft.state = 'FADING_IN';
        ft.timer = 0;
      }
    } else if (ft.state === 'FADING_IN') {
      ft.alpha = Math.max(0.0, 1.0 - (ft.timer / ft.fadeTime));
      if (ft.timer >= ft.fadeTime) {
        this.fadeTransition = null;
      }
    }
  }

  // Start a cinematic fade transition to black
  startFadeTransition(config) {
    const fadeTime = config.fadeTime || 0.8;
    const holdTime = config.holdTime || 1.3;
    this.fadeTransition = {
      state: 'FADING_OUT',
      alpha: 0.0,
      timer: 0,
      fadeTime: fadeTime,
      holdTime: holdTime,
      title: config.title || 'SECTOR TRANSFER',
      subtitle: config.subtitle || 'TRANSFERRING TO ADJACENT AIRSPACE',
      config: config,
      executed: false
    };
  }

  // Execute major sector/story changes under cover of blackness
  executeSectorChanges(config) {
    if (!config) return;

    // 1. Play cinematic sector transition audio whoosh + tone
    if (this.game.audio && this.game.audio.playSectorTransitionSound) {
      this.game.audio.playSectorTransitionSound();
    }

    // 2. Despawn units
    if (Array.isArray(config.despawnUnits)) {
      for (const uid of config.despawnUnits) {
        this.despawnUnit(uid);
      }
    }

    // 3. Spawn new units
    if (Array.isArray(config.spawnUnits)) {
      for (const uid of config.spawnUnits) {
        this.spawnUnit(uid);
      }
    }

    // 4. Spawn waves if configured
    if (Array.isArray(config.spawnWaves)) {
      this.spawnWave(config.spawnWaves);
    }

    // 5. Teleport / Reposition player aircraft
    if (config.teleportPlayer && this.game.physics) {
      const tp = config.teleportPlayer;
      const speed = tp.speed !== undefined ? tp.speed : (this.game.flightState ? this.game.flightState.speed : 340);
      const heading = tp.heading !== undefined ? tp.heading : (this.game.flightState ? this.game.flightState.heading : 0);
      this.game.physics.reset(tp.x || 0, tp.y || 0, heading, speed);
      if (this.game.camera) {
        this.game.camera.x = tp.x || 0;
        this.game.camera.y = tp.y || 0;
      }
    }

    // 6. Clear active missiles
    if (config.clearMissiles !== false && this.game.particles && this.game.particles.missiles) {
      this.game.particles.missiles.length = 0;
    }

    // 7. Optional rearm
    if (config.rearm && this.game.aircraftConfig && this.game.weapons) {
      const cfgW = this.game.aircraftConfig.weapons;
      this.game.weapons.gunAmmo = cfgW.gunAmmo || 900;
      this.game.weapons.mslCount = cfgW.mslCount || 120;
      this.game.weapons.spwCount = cfgW.spwCount || 36;
      this.game.weapons.flareCount = cfgW.flareCount || 30;
      this.game.weapons.abilityCharges = cfgW.abilityCharges || 1;
    }

    // 8. Post radio log
    if (config.radioMessage) {
      this.postRadioMessage(config.radioMessage, 3.5);
    } else if (config.title) {
      this.postRadioMessage(`SECTOR UPDATE // ${config.title.toUpperCase()}`, 3.5);
    }
  }

  // Typewriter text animation & audio data clicks
  updateDialogue(dt) {
    if (this.activeDialogue) {
      const d = this.activeDialogue;
      d.elapsed += dt;
      d.timer -= dt;

      // Typewriter character progression (~38 characters per second)
      if (d.displayedText.length < d.text.length) {
        d.charTimer = (d.charTimer || 0) + dt;
        const charInterval = 0.026; // 38.5 chars/sec
        while (d.charTimer >= charInterval && d.displayedText.length < d.text.length) {
          d.charTimer -= charInterval;
          const nextChar = d.text[d.displayedText.length];
          d.displayedText += nextChar;
          // Play mechanical data teletype click
          if (nextChar !== ' ' && this.game.audio && this.game.audio.playTeletypeClick) {
            this.game.audio.playTeletypeClick();
          }
        }
      }

      // Expired: advance to next dialogue in queue
      if (d.timer <= 0) {
        this.activeDialogue = null;
      }
    }

    // Advance queue if ready
    if (!this.activeDialogue && this.dialogueQueue.length > 0) {
      this.startDialogue(this.dialogueQueue.shift());
    }
  }

  // Trigger or queue a singleplayer dialogue transmission
  triggerDialogue(options) {
    if (!options || !options.text) return;
    const dur = options.duration || Math.max(4.0, (options.text.length * 0.035) + 3.0);
    const item = {
      speaker: options.speaker || 'UNKNOWN',
      aircraft: options.aircraft || 'TAC-COM',
      squadron: options.squadron || 'ALLIED FORCES',
      text: options.text,
      portrait: options.portrait || null,
      duration: dur,
      timer: dur,
      elapsed: 0,
      displayedText: '',
      charTimer: 0,
      portraitImage: null
    };

    // Preload portrait image if provided
    if (item.portrait) {
      if (!this.portraitCache[item.portrait]) {
        const img = new Image();
        img.src = item.portrait;
        this.portraitCache[item.portrait] = img;
      }
      item.portraitImage = this.portraitCache[item.portrait];
    }

    if (!this.activeDialogue) {
      this.startDialogue(item);
    } else {
      this.dialogueQueue.push(item);
    }
  }

  startDialogue(d) {
    this.activeDialogue = d;
    // Play radio transmission opening chirp / squelch burst
    if (this.game.audio && this.game.audio.playRadioChirp) {
      this.game.audio.playRadioChirp();
    }
  }

  // Megaton Nuclear Blast story trigger
  detonateNuke(x = 0, y = 0, duration = 2.5) {
    this.nukeState = {
      timer: duration,
      duration: duration,
      x: x,
      y: y
    };
    if (this.game.particles && this.game.particles.spawnNukeDetonation) {
      this.game.particles.spawnNukeDetonation(x, y);
    }
    if (this.game.audio && this.game.audio.playNukeSound) {
      this.game.audio.playNukeSound();
    }
    this.postRadioMessage('WARNING // ATMOSPHERIC THERMONUCLEAR FLASH DETECTED', 4.0);
  }

  // Scripted unit explosion
  explodeUnit(unitId) {
    if (!this.game.targetManager) return;
    this.game.targetManager.explodeTarget(unitId, this.game.particles, this.game.audio);
  }

  // Spawn unit into active world
  spawnUnit(unitId) {
    if (!this.game.targetManager) return;
    const unit = this.game.targetManager.targets.find(t => t.id === unitId);
    if (unit) {
      unit.active = true;
      unit.isDestroyed = false;
      unit.respawnTimer = 0;
      this.postRadioMessage(`CONTACT // ${unit.name.toUpperCase()} ENTERING AIRSPACE`, 2.5);
    }
  }

  // Despawn unit from world
  despawnUnit(unitId) {
    if (!this.game.targetManager) return;
    const unit = this.game.targetManager.targets.find(t => t.id === unitId);
    if (unit) {
      unit.active = false;
      this.postRadioMessage(`DEPARTURE // ${unit.name.toUpperCase()} LEFT AO`, 2.0);
    }
  }

  // Spawn new wave of units
  spawnWave(units) {
    if (!this.game.targetManager || !Array.isArray(units)) return;
    for (const u of units) {
      const defaultHp = (u.type === 'air' && u.aiType) ? getAIPlaneHealth(u.aiType) : 100;
      const finalMaxHp = u.maxHp || u.hp || defaultHp;
      const copy = Object.assign({}, u, {
        active: true,
        isDestroyed: false,
        hp: u.hp || finalMaxHp,
        maxHp: finalMaxHp
      });
      this.game.targetManager.targets.push(copy);
    }
    this.postRadioMessage(`RADAR ALERT // NEW SQUADRON DETECTED [${units.length} UNITS]`, 3.0);
  }

  // Scripted unit pathing & movement orders
  setUnitPath(unitId, act) {
    if (!this.game.targetManager) return;
    const unit = this.game.targetManager.targets.find(t => t.id === unitId);
    if (!unit) return;

    if (act.waypoints && Array.isArray(act.waypoints)) {
      unit.orders = {
        type: 'FOLLOW_PATH',
        waypoints: act.waypoints,
        currentWaypoint: 0,
        loop: !!act.loop,
        speed: act.speed || unit.speed || 210
      };
    } else {
      unit.orders = {
        type: 'MOVE_TO_POINT',
        targetX: act.targetX !== undefined ? act.targetX : (act.x || 0),
        targetY: act.targetY !== undefined ? act.targetY : (act.y || 0),
        speed: act.speed || unit.speed || 210
      };
    }
  }

  evaluateTriggers(eventType, context = {}) {
    for (const trig of this.triggers) {
      if (this.firedTriggers.has(trig.id)) continue;
      if (trig.event !== eventType) continue;

      let triggered = false;
      if (eventType === 'ON_START') {
        triggered = true;
      } else if (eventType === 'TIMER') {
        const threshold = trig.time || (trig.param && trig.param.time) || 0;
        if (context.time >= threshold) triggered = true;
      } else if (eventType === 'PLAYER_ENTER_AREA') {
        const areaId = trig.areaId || (trig.param && trig.param.areaId) || trig.targetId;
        const area = this.getArea(areaId);
        if (area && context.x !== undefined && context.y !== undefined) {
          const dist = Math.hypot(context.x - area.x, context.y - area.y);
          if (dist <= (area.radius || 2000)) triggered = true;
        }
      } else if (eventType === 'UNIT_ENTER_AREA') {
        const areaId = trig.areaId || (trig.param && trig.param.areaId);
        const unitId = trig.unitId || (trig.param && trig.param.unitId) || trig.targetId;
        const area = this.getArea(areaId);
        if (area && this.game.targetManager) {
          const unit = this.game.targetManager.targets.find(t => t.id === unitId);
          if (unit && !unit.isDestroyed && unit.active !== false) {
            const dist = Math.hypot(unit.x - area.x, unit.y - area.y);
            if (dist <= (area.radius || 2000)) triggered = true;
          }
        }
      } else if (eventType === 'PLAYER_PROXIMITY') {
        const targetId = trig.targetId || trig.areaId || (trig.param && (trig.param.targetId || trig.param.areaId));
        const area = this.getArea(targetId);
        if (area && context.x !== undefined && context.y !== undefined) {
          const dist = Math.hypot(context.x - area.x, context.y - area.y);
          const range = trig.range || (trig.param && trig.param.range) || area.radius || 2000;
          if (dist <= range) triggered = true;
        } else {
          const range = trig.range || (trig.param && trig.param.range) || 3000;
          const target = this.game.targetManager ? this.game.targetManager.targets.find(t => t.id === targetId) : null;
          if (target && !target.isDestroyed && target.active !== false) {
            const dist = Math.hypot(context.x - target.x, context.y - target.y);
            if (dist <= range) triggered = true;
          }
        }
      } else if (eventType === 'TARGET_DESTROYED') {
        const targetId = trig.targetId || (trig.param && trig.param.targetId);
        const target = this.game.targetManager ? this.game.targetManager.targets.find(t => t.id === targetId) : null;
        if (target && target.isDestroyed) triggered = true;
      }

      if (triggered) {
        this.firedTriggers.add(trig.id);
        this.executeTriggerActions(trig.actions || []);
      }
    }
  }

  executeTriggerActions(actions) {
    for (const act of actions) {
      if (act.type === 'DIALOGUE') {
        this.triggerDialogue(act);
      } else if (act.type === 'FLY_TO_AREA' || act.type === 'MOVE_TO_AREA') {
        const area = this.getArea(act.areaId);
        if (area && this.game.targetManager) {
          const unit = this.game.targetManager.targets.find(t => t.id === act.unitId);
          if (unit) {
            unit.orders = {
              type: 'FLY_TO_AREA',
              areaId: act.areaId,
              targetX: area.x,
              targetY: area.y,
              targetRadius: area.radius || 2000,
              speed: act.speed || unit.speed || 240
            };
          }
        }
      } else if (act.type === 'DEFEND_AREA') {
        const area = this.getArea(act.areaId);
        if (area && this.game.targetManager) {
          const unit = this.game.targetManager.targets.find(t => t.id === act.unitId);
          if (unit) {
            unit.orders = {
              type: 'DEFEND_AREA',
              areaId: act.areaId,
              targetX: area.x,
              targetY: area.y,
              targetRadius: area.radius || 2000,
              speed: act.speed || unit.speed || 260
            };
          }
        }
      } else if (act.type === 'STAY_IN_AREA') {
        const area = this.getArea(act.areaId);
        if (area && this.game.targetManager) {
          const unit = this.game.targetManager.targets.find(t => t.id === act.unitId);
          if (unit) {
            unit.orders = {
              type: 'STAY_IN_AREA',
              areaId: act.areaId,
              targetX: area.x,
              targetY: area.y,
              targetRadius: area.radius || 2000,
              speed: act.speed || unit.speed || 220
            };
          }
        }
      } else if (act.type === 'TELEPORT_TO_AREA' || act.type === 'TELEPORT_PLAYER' || act.type === 'TELEPORT_UNIT') {
        const area = this.getArea(act.areaId);
        if (area) {
          const isPlayer = act.type === 'TELEPORT_PLAYER' || act.unitId === 'player' || act.target === 'player' || !act.unitId;
          if (isPlayer) {
            if (this.game.physics) {
              this.game.physics.x = area.x;
              this.game.physics.y = area.y;
              if (act.heading !== undefined) this.game.physics.heading = act.heading;
              if (act.speed !== undefined) this.game.physics.speed = act.speed;
            }
            if (this.game.flightState) {
              this.game.flightState.x = area.x;
              this.game.flightState.y = area.y;
            }
            this.postRadioMessage(`TACTICAL WARP // TRANSLOCATED TO ${area.name || area.id.toUpperCase()}`, 3.5);
          } else if (this.game.targetManager) {
            const unit = this.game.targetManager.targets.find(t => t.id === act.unitId);
            if (unit) {
              unit.x = area.x;
              unit.y = area.y;
              if (act.heading !== undefined) unit.heading = act.heading;
              if (act.speed !== undefined) unit.speed = act.speed;
            }
          }
        }
      } else if (act.type === 'FADE_TRANSITION' || act.type === 'SECTOR_TRANSITION') {
        this.startFadeTransition(act);
      } else if (act.type === 'DETONATE_NUKE') {
        this.detonateNuke(act.x || 0, act.y || 0, act.duration || 2.5);
      } else if (act.type === 'EXPLODE_UNIT') {
        this.explodeUnit(act.unitId);
      } else if (act.type === 'MOVE_UNIT' || act.type === 'SET_PATH') {
        this.setUnitPath(act.unitId, act);
      } else if (act.type === 'SPAWN_UNIT') {
        this.spawnUnit(act.unitId);
      } else if (act.type === 'DESPAWN_UNIT') {
        this.despawnUnit(act.unitId);
      } else if (act.type === 'SPAWN_WAVE') {
        this.spawnWave(act.units || []);
      } else if (act.type === 'RADIO_MESSAGE') {
        this.postRadioMessage(act.text, act.life || 3.0);
      } else if (act.type === 'SET_AI_ORDER') {
        this.applyUnitOrder(act.unitId, act.order);
      } else if (act.type === 'SCRIPTED_END') {
        this.isScriptedEnding = true;
        this.isCompleted = true;
        this.scriptedEndTitle = act.title || 'OPERATION CONCLUDED';
        this.scriptedEndText = act.text || 'MISSION UPDATE // SCRIPTED SEQUENCE TRIGGERED';
        this.postRadioMessage(`MISSION UPDATE // ${this.scriptedEndTitle.toUpperCase()}`, 5.0);
        this.startFadeTransition({
          title: this.scriptedEndTitle,
          subtitle: this.scriptedEndText,
          fadeTime: act.fadeTime || 2.0,
          holdTime: 3.0
        });
      } else if (act.type === 'MISSION_COMPLETE') {
        this.isCompleted = true;
        this.postRadioMessage('MISSION ACCOMPLISHED // ALL OBJECTIVES SECURED', 4.0);
        this.onMissionCompleted();
      } else if (act.type === 'MISSION_FAILED') {
        this.isFailed = true;
        this.postRadioMessage('MISSION FAILED // CRITICAL ASSETS COMPROMISED', 4.0);
      }
    }
  }

  applyUnitOrder(unitId, order) {
    if (!this.game.targetManager || !order) return;
    const unit = this.game.targetManager.targets.find(t => t.id === unitId);
    if (!unit) return;
    unit.orders = Object.assign({}, unit.orders, order);
  }

  postRadioMessage(text, life = 3.0) {
    this.radioMessages.push({ text, life, maxLife: life });
  }

  onObjectiveCompleted(obj) {
    this.postRadioMessage(`OBJECTIVE COMPLETE // ${obj.title.toUpperCase()}`, 3.0);
    if (this.winConditions && this.winConditions.allPrimaryComplete) {
      const allPrimaryDone = this.objectives.filter(o => o.isPrimary).every(o => o.isCompleted);
      if (allPrimaryDone) {
        this.isCompleted = true;
        this.postRadioMessage('MISSION ACCOMPLISHED // RETURN TO BASE', 5.0);
      }
    }
  }
}
