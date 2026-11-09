// Targets Engine: Enemy MiG-21 Air Targets, Naval Gunboats, SAM Sites, and Missile Engagement

export const STANDARD_MSL_DAMAGE = 32;

// Plane health tied to AI level (based on standard MSL damage of 32):
// - Drone: 1 MSL hit (32 HP)
// - Dummy: 1.5 MSL hits (48 HP)
// - Rookie: 1.5 MSL hits (48 HP)
// - Veteran: 2 MSL hits (64 HP)
// - Strike: 2.5 MSL hits (80 HP)
// - Elite: 3 MSL hits (96 HP)
// - Ace: 5 MSL hits (160 HP)
export const AI_HEALTH_BY_LEVEL = {
  drone: Math.round(1.0 * STANDARD_MSL_DAMAGE),   // 32 HP (1 MSL hit)
  dummy: Math.round(1.5 * STANDARD_MSL_DAMAGE),   // 48 HP (1.5 MSL hits)
  rookie: Math.round(1.5 * STANDARD_MSL_DAMAGE),  // 48 HP (1.5 MSL hits)
  veteran: Math.round(2.0 * STANDARD_MSL_DAMAGE), // 64 HP (2 MSL hits)
  strike: Math.round(2.5 * STANDARD_MSL_DAMAGE),  // 80 HP (2.5 MSL hits)
  elite: Math.round(3.0 * STANDARD_MSL_DAMAGE),   // 96 HP (3 MSL hits)
  ace: Math.round(5.0 * STANDARD_MSL_DAMAGE)      // 160 HP (5 MSL hits)
};

export function getAIPlaneHealth(aiType = 'rookie') {
  const key = (aiType || 'rookie').toLowerCase();
  return AI_HEALTH_BY_LEVEL[key] !== undefined ? AI_HEALTH_BY_LEVEL[key] : 48;
}

export class TargetManager {
  constructor() {
    // Top-Left Far Quadrant 8-Ship MiG-21 Formation Centroid
    this.formation = {
      id: 'mig21_flight_topleft',
      x: -10500,
      y: -10500,
      heading: 0.75, // Heading southeast towards combat theater
      speed: 215,
      turnRate: 0.16, // Wide, sweeping formation orbit
      patrolCenterX: -10500,
      patrolCenterY: -10500,
      patrolRadius: 2800
    };

    this.targets = this.initTargets();
    for (const tgt of this.targets) {
      if (tgt.type === 'air' && tgt.aiType) {
        tgt.maxHp = getAIPlaneHealth(tgt.aiType);
        tgt.hp = tgt.maxHp;
      }
    }
    this.destroyedNotifications = [];
    this.fleetTheta = 0;

    // Load authentic MiG-21bis, Su-27, and F-22 sprites
    this.migSprite = typeof Image !== 'undefined' ? new Image() : null;
    if (this.migSprite) {
      this.migSprite.src = './assets/planes/mig21bis.png';
    }
    this.su27Sprite = typeof Image !== 'undefined' ? new Image() : null;
    if (this.su27Sprite) {
      this.su27Sprite.src = './assets/planes/su27.png';
    }
    this.f22Sprite = typeof Image !== 'undefined' ? new Image() : null;
    if (this.f22Sprite) {
      this.f22Sprite.src = './assets/planes/f22.png';
    }
  }

  initTargets() {
    return [
      // 1A. Enemy MiG-21 Fishbeds (Scattered Solo Patrols) - Rookie AI (Dies in 1.5 MSL hits, fires 1 MSL at a time, basic evasion)
      {
        id: 'mig21_1',
        name: 'MiG-21bis Fishbed [ROOKIE]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'mig21',
        aiType: 'rookie',
        isEnemy: true,
        x: -2400,
        y: -1800,
        heading: 0.4,
        speed: 210,
        baseSpeed: 210,
        hp: 48,
        maxHp: 48,
        hitRadius: 30,
        patrolCenterX: -2200,
        patrolCenterY: -1600,
        patrolRadius: 1800,
        turnRate: 0.85,
        fireInterval: 7.5,
        fireCooldown: 4.0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'mig21_2',
        name: 'MiG-21bis Fishbed [ROOKIE]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'mig21',
        aiType: 'rookie',
        isEnemy: true,
        x: 2800,
        y: -1200,
        heading: -1.2,
        speed: 210,
        baseSpeed: 210,
        hp: 48,
        maxHp: 48,
        hitRadius: 30,
        patrolCenterX: 2600,
        patrolCenterY: -1000,
        patrolRadius: 2200,
        turnRate: 0.85,
        fireInterval: 7.5,
        fireCooldown: 5.5,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'mig21_3',
        name: 'MiG-21bis Fishbed [ROOKIE]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'mig21',
        aiType: 'rookie',
        isEnemy: true,
        x: -1200,
        y: 2600,
        heading: 2.1,
        speed: 210,
        baseSpeed: 210,
        hp: 48,
        maxHp: 48,
        hitRadius: 30,
        patrolCenterX: -1000,
        patrolCenterY: 2400,
        patrolRadius: 2000,
        turnRate: 0.85,
        fireInterval: 7.5,
        fireCooldown: 6.0,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 1B. 8-Ship MiG-21 Formation Flying Together in Far Top-Left Quadrant - Dummy AI (Dies in 1.5 MSL hits, Target practice)
      ...Array.from({ length: 8 }, (_, i) => {
        const formationSlots = [
          { role: 'Lead', ox: 0, oy: 0 },
          { role: 'Wing 1', ox: -110, oy: -95 },
          { role: 'Wing 2', ox: 110, oy: -95 },
          { role: 'Wing 3', ox: 220, oy: -190 },
          { role: 'Element 2 Lead', ox: -150, oy: -210 },
          { role: 'Element 2 Wing', ox: -260, oy: -305 },
          { role: 'Trail Lead', ox: 0, oy: -230 },
          { role: 'Trail Slot', ox: 110, oy: -325 }
        ];
        const slot = formationSlots[i];
        return {
          id: `mig21_form_${i + 1}`,
          name: `MiG-21bis [${slot.role}]`,
          code: 'TGT [AIR]',
          type: 'air',
          model: 'mig21',
          aiType: 'dummy',
          isEnemy: true,
          formationId: 'mig21_flight_topleft',
          formationOffset: { x: slot.ox, y: slot.oy },
          x: -10500 + slot.ox,
          y: -10500 + slot.oy,
          heading: 0.75,
          speed: 215,
          hp: 48,
          maxHp: 48,
          hitRadius: 30,
          isDestroyed: false,
          respawnTimer: 0
        };
      }),

      // 2. Dummy Boats / Corvettes (Naval Targets in Deep Open Water near Center)
      {
        id: 'boat_1',
        name: 'Missile Corvette',
        code: 'TGT [NAV]',
        type: 'naval',
        isEnemy: true,
        x: 750,
        y: 100, // Verified open water channel with >530m island clearance
        heading: 0.8,
        speed: 10,
        hp: 180,
        maxHp: 180,
        hitRadius: 42,
        patrolCenterX: 750,
        patrolCenterY: 100,
        patrolRadius: 380,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'boat_2',
        name: 'Patrol Gunboat',
        code: 'TGT [NAV]',
        type: 'naval',
        isEnemy: true,
        x: -700,
        y: 1400, // Verified open water channel with >650m island clearance
        heading: -2.0,
        speed: 9,
        hp: 130,
        maxHp: 130,
        hitRadius: 36,
        patrolCenterX: -700,
        patrolCenterY: 1400,
        patrolRadius: 420,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 3. SAM Sites on Far-Left Center Archipelago (64 HP - 2 MSLs or 1 UGB/LASM)
      {
        id: 'sam_arch_1',
        name: 'SA-6 SAM Battery A',
        code: 'TGT [SAM]',
        type: 'ground',
        isEnemy: true,
        x: -11800,
        y: -900,
        heading: 0,
        speed: 0,
        hp: 64,
        maxHp: 64,
        hitRadius: 34,
        radarRange: 4200,
        fireInterval: 7.5,
        fireCooldown: 3.0,
        radarAngle: 0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'sam_arch_2',
        name: 'SA-6 SAM Battery B',
        code: 'TGT [SAM]',
        type: 'ground',
        isEnemy: true,
        x: -10800,
        y: -400,
        heading: 0,
        speed: 0,
        hp: 64,
        maxHp: 64,
        hitRadius: 34,
        radarRange: 4200,
        fireInterval: 7.5,
        fireCooldown: 4.5,
        radarAngle: 0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'sam_arch_3',
        name: 'SA-6 SAM Battery C',
        code: 'TGT [SAM]',
        type: 'ground',
        isEnemy: true,
        x: -11500,
        y: 700,
        heading: 0,
        speed: 0,
        hp: 64,
        maxHp: 64,
        hitRadius: 34,
        radarRange: 4200,
        fireInterval: 7.5,
        fireCooldown: 6.0,
        radarAngle: 0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'sam_arch_4',
        name: 'SA-6 SAM Battery D',
        code: 'TGT [SAM]',
        type: 'ground',
        isEnemy: true,
        x: -10600,
        y: 1200,
        heading: 0,
        speed: 0,
        hp: 64,
        maxHp: 64,
        hitRadius: 34,
        radarRange: 4200,
        fireInterval: 7.5,
        fireCooldown: 7.5,
        radarAngle: 0,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 4. Enemy Su-27 Flanker [VETERAN] (Bottom-Right Combat Sector) - Dies in 2 MSL hits (64 HP)
      {
        id: 'ace_su27',
        name: 'Su-27 Flanker [VETERAN]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'su27',
        aiType: 'veteran',
        isEnemy: true,
        x: 10000,
        y: 10000,
        heading: -2.35,
        speed: 280,
        baseSpeed: 280,
        cornerSpeed: 245,
        maxSpeed: 350,
        turnRate: 1.60,
        hp: 64,
        maxHp: 64,
        hitRadius: 40,
        territory: {
          minX: 5800,
          maxX: 14200,
          minY: 5800,
          maxY: 14200,
          centerX: 10000,
          centerY: 10000,
          radius: 4200
        },
        tacticalState: 'DOGFIGHT',
        tacticalTimer: 0,
        fireInterval: 4.8,
        fireCooldown: 2.5,
        railSide: 1,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 5. Target Drone - Drone AI (Dies in 1 MSL hit - 32 HP)
      {
        id: 'drone_1',
        name: 'Target Drone MQ-99 [DRONE]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'mig21',
        aiType: 'drone',
        isEnemy: true,
        x: 4200,
        y: 2800,
        heading: 1.2,
        speed: 210,
        baseSpeed: 210,
        turnRate: 0.35,
        hp: 32,
        maxHp: 32,
        hitRadius: 28,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 6. Strike Aircraft - Strike AI (Dies in 2.5 MSL hits - 80 HP)
      {
        id: 'strike_1',
        name: 'Su-25TM Frogfoot [STRIKE]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'mig21',
        aiType: 'strike',
        isEnemy: true,
        x: -4800,
        y: 4200,
        heading: -0.6,
        speed: 235,
        baseSpeed: 235,
        hp: 80,
        maxHp: 80,
        hitRadius: 32,
        fireInterval: 6.0,
        fireCooldown: 3.0,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 7. Enemy F-22A Raptor [ACE] (Far Bottom-Left Combat Sector) - Dies in 5 MSL hits (160 HP)
      {
        id: 'ace_f22',
        name: 'F-22A Raptor [ACE]',
        code: 'TGT [AIR]',
        type: 'air',
        model: 'f22',
        aiType: 'ace',
        isEnemy: true,
        x: -11000,
        y: 11000,
        heading: -0.78,
        speed: 310,
        baseSpeed: 310,
        cornerSpeed: 255,
        maxSpeed: 385,
        turnRate: 2.15,
        hp: 160,
        maxHp: 160,
        hitRadius: 40,
        equippedSpw: 'qaam',
        hasPsm: true,
        hasTVC: true,
        territory: {
          minX: -15500,
          maxX: -6500,
          minY: 6500,
          maxY: 15500,
          centerX: -11000,
          centerY: 11000,
          radius: 4600
        },
        tacticalState: 'DOGFIGHT',
        tacticalTimer: 0,
        fireInterval: 3.2,
        fireCooldown: 1.5,
        spwCooldown: 4.0,
        flareCooldown: 12.0,
        railSide: 1,
        isDestroyed: false,
        respawnTimer: 0
      },

      // 8. Carrier Strike Group (Top-Right Quadrant Orbit: Carrier, Cruiser, 2 Destroyers, 3 Frigates, 2 Trailing Gunboats)
      {
        id: 'carrier_1',
        name: 'Aircraft Carrier CVN [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'carrier',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8500,
        y: -11300,
        heading: 0,
        speed: 18,
        hp: 450,
        maxHp: 450,
        hitRadius: 75,
        angleOffset: 0,
        radialOffset: 0,
        hasCIWS: true,
        ciwsChannels: 2,
        ciwsRange: 1100,
        ciwsInterval: 0.22,
        ciwsBurstChance: 0.14,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'cruiser_1',
        name: 'Aegis Missile Cruiser CG [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'cruiser',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8700,
        y: -11240,
        heading: 0,
        speed: 18,
        hp: 260,
        maxHp: 260,
        hitRadius: 52,
        angleOffset: 0.08,
        radialOffset: 60,
        hasCIWS: true,
        ciwsChannels: 1,
        ciwsRange: 950,
        ciwsInterval: 0.28,
        ciwsBurstChance: 0.11,
        hasSAM: true,
        samRange: 3800,
        samInterval: 8.5,
        samCooldown: 3.5,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'destroyer_1',
        name: 'Guided Destroyer DDG-1 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'destroyer',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8600,
        y: -10960,
        heading: 0,
        speed: 18,
        hp: 190,
        maxHp: 190,
        hitRadius: 44,
        angleOffset: 0.04,
        radialOffset: 340,
        hasCIWS: true,
        ciwsChannels: 1,
        ciwsRange: 850,
        ciwsInterval: 0.32,
        ciwsBurstChance: 0.08,
        hasSAM: true,
        samRange: 3400,
        samInterval: 10.0,
        samCooldown: 5.0,
        hasFlak: true,
        flakRange: 2200,
        flakInterval: 2.0,
        flakCooldown: 1.0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'destroyer_2',
        name: 'Guided Destroyer DDG-2 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'destroyer',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8600,
        y: -11640,
        heading: 0,
        speed: 18,
        hp: 190,
        maxHp: 190,
        hitRadius: 44,
        angleOffset: 0.04,
        radialOffset: -340,
        hasCIWS: true,
        ciwsChannels: 1,
        ciwsRange: 850,
        ciwsInterval: 0.32,
        ciwsBurstChance: 0.08,
        hasSAM: true,
        samRange: 3400,
        samInterval: 10.0,
        samCooldown: 7.5,
        hasFlak: true,
        flakRange: 2200,
        flakInterval: 2.0,
        flakCooldown: 2.0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'frigate_1',
        name: 'Escort Frigate FFG-1 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'frigate',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8450,
        y: -10720,
        heading: 0,
        speed: 18,
        hp: 140,
        maxHp: 140,
        hitRadius: 38,
        angleOffset: -0.02,
        radialOffset: 580,
        hasFlak: true,
        flakRange: 2000,
        flakInterval: 1.6,
        flakCooldown: 0.8,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'frigate_2',
        name: 'Escort Frigate FFG-2 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'frigate',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8450,
        y: -11880,
        heading: 0,
        speed: 18,
        hp: 140,
        maxHp: 140,
        hitRadius: 38,
        angleOffset: -0.02,
        radialOffset: -580,
        hasFlak: true,
        flakRange: 2000,
        flakInterval: 1.6,
        flakCooldown: 1.4,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'frigate_3',
        name: 'Escort Frigate FFG-3 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'frigate',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8300,
        y: -11300,
        heading: 0,
        speed: 18,
        hp: 140,
        maxHp: 140,
        hitRadius: 38,
        angleOffset: -0.07,
        radialOffset: 0,
        hasFlak: true,
        flakRange: 2000,
        flakInterval: 1.6,
        flakCooldown: 2.0,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'gunboat_trail_1',
        name: 'Patrol Gunboat PB-1 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'gunboat',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8140,
        y: -11100,
        heading: 0,
        speed: 18,
        hp: 90,
        maxHp: 90,
        hitRadius: 30,
        angleOffset: -0.13,
        radialOffset: 200,
        isDestroyed: false,
        respawnTimer: 0
      },
      {
        id: 'gunboat_trail_2',
        name: 'Patrol Gunboat PB-2 [TARGET]',
        code: 'TGT [NAV]',
        type: 'naval',
        subType: 'gunboat',
        isEnemy: true,
        isCarrierFleet: true,
        x: 8090,
        y: -11500,
        heading: 0,
        speed: 18,
        hp: 90,
        maxHp: 90,
        hitRadius: 30,
        angleOffset: -0.15,
        radialOffset: -200,
        isDestroyed: false,
        respawnTimer: 0
      }
    ];
  }

  update(dt, playerX, playerY, particles, audio, flightState = null) {
    // Support object flightState passed as second parameter
    if (typeof playerX === 'object' && playerX !== null) {
      flightState = playerX;
      playerX = flightState.x;
      playerY = flightState.y;
      particles = playerY;
      audio = particles;
    }

    // Clean up old destruction notifications
    for (let i = this.destroyedNotifications.length - 1; i >= 0; i--) {
      this.destroyedNotifications[i].life -= dt;
      if (this.destroyedNotifications[i].life <= 0) {
        this.destroyedNotifications.splice(i, 1);
      }
    }

    // 1. Advance Formation Flight Centroid (Top-Left Far Quadrant)
    this.fleetTheta = (this.fleetTheta || 0) + (18 / 2800) * dt;
    if (this.formation) {
      const f = this.formation;
      const fdx = f.x - f.patrolCenterX;
      const fdy = f.y - f.patrolCenterY;
      const fdist = Math.hypot(fdx, fdy);

      if (fdist > f.patrolRadius * 1.25) {
        const toCenter = Math.atan2(f.patrolCenterY - f.y, f.patrolCenterX - f.x);
        let diff = toCenter - f.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        f.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.75 * dt);
      } else {
        f.heading += f.turnRate * dt;
      }

      f.x += Math.cos(f.heading) * f.speed * dt;
      f.y += Math.sin(f.heading) * f.speed * dt;
    }

    for (const tgt of this.targets) {
      if (tgt.active === false) continue;
      if (tgt.isDestroyed) {
        tgt.respawnTimer -= dt;
        if (tgt.respawnTimer <= 0) {
          tgt.isDestroyed = false;
          tgt.isFalling = false;
          if (tgt.type === 'air' && tgt.aiType) {
            tgt.maxHp = getAIPlaneHealth(tgt.aiType);
          }
          tgt.hp = tgt.maxHp;
          if (tgt.type === 'ground') {
            tgt.fireCooldown = 4.0;
          }
          if (tgt.territory) {
            tgt.x = tgt.territory.centerX;
            tgt.y = tgt.territory.centerY;
            tgt.heading = -2.35;
            tgt.speed = tgt.baseSpeed || 280;
            tgt.fireCooldown = 3.5;
            tgt.tacticalState = 'DOGFIGHT';
            tgt.tacticalTimer = 0;
          }
        }
        continue;
      }

      // Air targets shot down: flying straight forward into the ground while on fire before exploding
      if (tgt.isFalling) {
        tgt.fallTimer = (tgt.fallTimer || 0) + dt;
        const progress = Math.min(1.0, tgt.fallTimer / (tgt.fallDuration || 2.8));
        tgt.altitude = Math.max(0.0, 1.0 - progress);

        // Fly in a straight line along locked heading into the ground (no tumbling/spinning)
        tgt.heading = tgt.fallHeading !== undefined ? tgt.fallHeading : tgt.heading;
        tgt.fallSpeed = Math.max(120, (tgt.fallSpeed || 180) - 15 * dt);
        tgt.x += Math.cos(tgt.heading) * tgt.fallSpeed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.fallSpeed * dt;

        // Spew dense black smoke and fire/sparks from the flaming wreckage straight back
        if (particles && particles.emitAircraftDamage) {
          particles.emitAircraftDamage(
            tgt.x,
            tgt.y,
            tgt.heading,
            tgt.fallSpeed,
            0.02, // Under 10% -> triggers heavy black smoke, flames, and sparks
            dt,
            tgt.id
          );
        }

        // Small fuel tank cook-off explosions popping while tumbling down
        if (Math.random() < 0.20) {
          particles.particles.push({
            x: tgt.x + (Math.random() - 0.5) * 24,
            y: tgt.y + (Math.random() - 0.5) * 24,
            vx: (Math.random() - 0.5) * 35,
            vy: (Math.random() - 0.5) * 35,
            life: 0.22,
            maxLife: 0.22,
            size: 8 + Math.random() * 8,
            color: '#ff5511',
            type: 'flame'
          });
        }

        // Ground / ocean impact when altitude reaches 0
        if (tgt.altitude <= 0 || tgt.fallTimer >= tgt.fallDuration) {
          tgt.isFalling = false;
          tgt.isDestroyed = true;
          tgt.respawnTimer = 14.0;

          // Violent surface impact detonation
          if (particles && particles.spawnExplosion) {
            particles.spawnExplosion(tgt.x, tgt.y);
            for (let i = 0; i < 4; i++) {
              const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
              const dist = 25 + Math.random() * 25;
              particles.spawnExplosion(tgt.x + Math.cos(ang) * dist, tgt.y + Math.sin(ang) * dist);
            }
          }
          for (let r = 0; r < 16; r++) {
            const ang = (r / 16) * Math.PI * 2;
            const sp = 80 + Math.random() * 70;
            particles.particles.push({
              x: tgt.x,
              y: tgt.y,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
              life: 0.65,
              maxLife: 0.65,
              size: 14 + Math.random() * 8,
              color: 'rgba(255, 120, 30, 0.75)',
              type: 'smoke'
            });
          }
          if (audio) {
            audio.playCrashSound();
          }
        }
        continue;
      }

      // Air target flight dynamics
      if (tgt.type === 'air') {
        // Aircraft damage smoke and fire trail (< 60% HP)
        const hpRatio = tgt.hp / tgt.maxHp;
        if (particles && particles.emitAircraftDamage) {
          particles.emitAircraftDamage(
            tgt.x,
            tgt.y,
            tgt.heading,
            tgt.speed,
            hpRatio,
            dt,
            tgt.id
          );
        }

        // Process AI behavior (Dummy, Drone, Strike, Rookie, Veteran, Elite, Ace)
        this.updateAirTargetAI(tgt, dt, playerX, playerY, particles, audio, flightState);
        continue;
      } else if (tgt.type === 'naval') {
        if (tgt.isCarrierFleet) {
          const fleetCX = 8500;
          const fleetCY = -8500;
          const fleetR = 2800 + (tgt.radialOffset || 0);
          const shipAngle = (this.fleetTheta || 0) + (tgt.angleOffset || 0);
          tgt.x = fleetCX + Math.cos(shipAngle) * fleetR;
          tgt.y = fleetCY + Math.sin(shipAngle) * fleetR;
          tgt.heading = shipAngle + Math.PI * 0.5;
          tgt.speed = 18;

          // Water wake
          if (particles && Math.random() < 0.35) {
            const cosH = Math.cos(tgt.heading);
            const sinH = Math.sin(tgt.heading);
            const wakeDist = (tgt.subType === 'carrier' ? 70 : (tgt.subType === 'cruiser' ? 45 : 30));
            particles.particles.push({
              x: tgt.x - cosH * wakeDist,
              y: tgt.y - sinH * wakeDist,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              life: 1.1,
              maxLife: 1.1,
              size: (tgt.subType === 'carrier' ? 14 : 9) + Math.random() * 5,
              color: 'rgba(210, 240, 255, 0.40)',
              type: 'smoke'
            });
          }

          // 1. CIWS defense: Carrier, Cruiser, Destroyer
          if (tgt.hasCIWS && particles && particles.missiles) {
            tgt.ciwsCooldown = (tgt.ciwsCooldown || 0) - dt;
            tgt.ciwsOverloadTimer = (tgt.ciwsOverloadTimer || 0) - dt;

            // Scan for active missiles threatening this ship
            const maxRange = tgt.ciwsRange || 900;
            const inboundThreats = [];

            for (const m of particles.missiles) {
              if (m.isEnemy || m.isBomb || m.isSFFS || m.isIntercepted || m.life <= 0.1) continue;
              const mDist = Math.hypot(m.x - tgt.x, m.y - tgt.y);
              if (mDist <= maxRange) {
                const dx = tgt.x - m.x;
                const dy = tgt.y - m.y;
                const forwardDot = (Math.cos(m.heading) * dx + Math.sin(m.heading) * dy) / (mDist || 1);
                const isTargetingMe = (m.target === tgt);
                // Threat qualification: directly targeted, or very close (< 55% range) and heading straight at ship
                if (isTargetingMe || (forwardDot > 0.35 && mDist <= (maxRange * 0.55))) {
                  inboundThreats.push({ missile: m, dist: mDist });
                }
              }
            }

            if (tgt.ciwsCooldown <= 0 && inboundThreats.length > 0) {
              inboundThreats.sort((a, b) => a.dist - b.dist);
              const channels = tgt.ciwsChannels || (tgt.subType === 'carrier' ? 2 : 1);

              // Overload mechanics:
              // 1. Channel saturation: Ship can only engage up to 'channels' missiles simultaneously.
              //    Excess missiles (inboundThreats.length > channels) bypass CIWS unmolested.
              // 2. Fire-control degradation: Accuracy drops with threat saturation
              const overloadMult = Math.max(0.20, 1.0 - (inboundThreats.length - 1) * 0.40);
              const engagedThreats = inboundThreats.slice(0, channels);

              for (const { missile: m, dist: mDist } of engagedThreats) {
                // Fire CIWS tracers
                particles.spawnCIWSTracers(tgt.x, tgt.y, m.x, m.y);
                if (audio && audio.playGunSound && Math.random() < 0.40) {
                  audio.playGunSound();
                }

                // Intercept test only in terminal intercept zone (< 65% of max CIWS range)
                if (mDist <= (maxRange * 0.65)) {
                  const baseBurstChance = tgt.ciwsBurstChance || 0.14;
                  const effectiveChance = baseBurstChance * overloadMult;

                  if (Math.random() < effectiveChance) {
                    particles.spawnExplosion(m.x, m.y);
                    m.isIntercepted = true;
                    m.life = 0;
                    if (audio && audio.playMissileHitSound) {
                      audio.playMissileHitSound(false);
                    }
                    this.destroyedNotifications.push({
                      text: `CIWS // ${tgt.name.split(' ')[0]} INTERCEPTED MISSILE`,
                      code: 'DEFENSE',
                      life: 1.4
                    });
                  }
                }
              }

              // Overloaded HUD warning when player saturates defenses
              if (inboundThreats.length > channels && tgt.ciwsOverloadTimer <= 0) {
                tgt.ciwsOverloadTimer = 2.2;
                this.destroyedNotifications.push({
                  text: `CIWS OVERLOADED // ${tgt.name.split(' ')[0]} [${inboundThreats.length} THREATS]`,
                  code: 'WARNING',
                  life: 1.5
                });
              }

              tgt.ciwsCooldown = tgt.ciwsInterval || 0.28;
            }
          }

          // 2. SAM firing: Cruiser and Destroyer
          if (tgt.hasSAM) {
            tgt.samCooldown = (tgt.samCooldown || 0) - dt;
            const distToPlayer = Math.hypot(playerX - tgt.x, playerY - tgt.y);
            if (distToPlayer <= (tgt.samRange || 3400) && tgt.samCooldown <= 0) {
              tgt.samCooldown = tgt.samInterval || 9.0;
              this.launchSAMMissile(tgt, playerX, playerY, particles, audio);
            }
          }

          // 3. AA Flak firing: Frigate and Destroyer
          if (tgt.hasFlak) {
            tgt.flakCooldown = (tgt.flakCooldown || 0) - dt;
            const distToPlayer = Math.hypot(playerX - tgt.x, playerY - tgt.y);
            if (distToPlayer <= (tgt.flakRange || 2100) && tgt.flakCooldown <= 0) {
              tgt.flakCooldown = tgt.flakInterval || 1.8;
              if (particles && particles.spawnFlakShell) {
                particles.spawnFlakShell(tgt.x, tgt.y, playerX, playerY, flightState);
              }
              if (audio && audio.playGunSound && Math.random() < 0.35) {
                audio.playGunSound();
              }
            }
          }

          continue;
        }

        // Slow circular/patrol drifting in deep open water without straying onto islands
        const dx = tgt.x - tgt.patrolCenterX;
        const dy = tgt.y - tgt.patrolCenterY;
        const dist = Math.hypot(dx, dy);

        if (dist > tgt.patrolRadius) {
          const toCenter = Math.atan2(tgt.patrolCenterY - tgt.y, tgt.patrolCenterX - tgt.x);
          let diff = toCenter - tgt.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.6 * dt);
        } else {
          tgt.heading += 0.08 * dt; // Slow gentle patrol arc
        }

        tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;

        // Subtle water wake
        if (Math.random() < 0.25) {
          const cosH = Math.cos(tgt.heading);
          const sinH = Math.sin(tgt.heading);
          particles.particles.push({
            x: tgt.x - cosH * 32,
            y: tgt.y - sinH * 32,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 0.8,
            maxLife: 0.8,
            size: 8 + Math.random() * 6,
            color: 'rgba(210, 240, 255, 0.35)',
            type: 'smoke'
          });
        }
      } else if (tgt.type === 'ground') {
        // Ground unit scripted movement & pathing (mobile SAMs, convoys, advancing armor, area orders)
        if (tgt.orders && (tgt.orders.type === 'MOVE_TO_POINT' || tgt.orders.type === 'ADVANCE_AND_ATTACK' || tgt.orders.type === 'FLY_TO_AREA' || tgt.orders.type === 'MOVE_TO_AREA' || tgt.orders.type === 'STAY_IN_AREA' || tgt.orders.type === 'DEFEND_AREA')) {
          const tx = tgt.orders.targetX !== undefined ? tgt.orders.targetX : tgt.x;
          const ty = tgt.orders.targetY !== undefined ? tgt.orders.targetY : tgt.y;
          const dx = tx - tgt.x;
          const dy = ty - tgt.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 15) {
            const sp = tgt.orders.speed || tgt.speed || 35;
            tgt.heading = Math.atan2(dy, dx);
            tgt.x += (dx / dist) * sp * dt;
            tgt.y += (dy / dist) * sp * dt;
          }
        }

        // SAM Site radar dish rotation
        tgt.radarAngle = (tgt.radarAngle || 0) + 1.8 * dt;

        // Engagement check against player
        const distToPlayer = Math.hypot(playerX - tgt.x, playerY - tgt.y);
        if (distToPlayer <= (tgt.radarRange || tgt.range || 3400)) {
          tgt.fireCooldown -= dt;
          if (tgt.fireCooldown <= 0) {
            tgt.fireCooldown = tgt.fireInterval;
            this.launchSAMMissile(tgt, playerX, playerY, particles, audio);
          }
        }
      }
    }
  }

  // Detect guided missiles fired by the player tracking this aircraft
  detectIncomingThreats(tgt, particles) {
    if (!particles || !particles.missiles) return null;
    let closestThreat = null;
    let closestDist = 2600;

    for (const m of particles.missiles) {
      if (m.isEnemy || m.decoyed || !m.isGuided) continue;
      const dist = Math.hypot(m.x - tgt.x, m.y - tgt.y);
      if (dist < closestDist) {
        const dx = tgt.x - m.x;
        const dy = tgt.y - m.y;
        const dot = (Math.cos(m.heading) * dx + Math.sin(m.heading) * dy) / (dist || 1);
        if (dot > 0.30 || m.target === tgt) {
          closestDist = dist;
          closestThreat = { missile: m, dist, dot };
        }
      }
    }
    return closestThreat;
  }

  // Unified Air Target AI dispatcher: Dummy, Drone, Strike, Rookie, Veteran, Elite, Ace
  updateAirTargetAI(tgt, dt, playerX, playerY, particles, audio, flightState) {
    const aiType = tgt.aiType || 'rookie';

    // Update cooldown timers
    if (tgt.fireCooldown > 0) tgt.fireCooldown -= dt;
    if (tgt.spwCooldown > 0) tgt.spwCooldown -= dt;
    if (tgt.flareCooldown > 0) tgt.flareCooldown -= dt;
    if (tgt.evadeTimer > 0) tgt.evadeTimer -= dt;
    if (tgt.psmTimer > 0) tgt.psmTimer -= dt;
    if (tgt.psmCooldown > 0) tgt.psmCooldown -= dt;
    if (tgt.tacticalTimer !== undefined) tgt.tacticalTimer += dt;

    // Scan for incoming player guided missiles
    const threat = this.detectIncomingThreats(tgt, particles);

    // Tactical Area-based AI Orders: FLY_TO_AREA, STAY_IN_AREA, DEFEND_AREA
    if (tgt.orders) {
      if (tgt.orders.type === 'FLY_TO_AREA') {
        const tx = tgt.orders.targetX !== undefined ? tgt.orders.targetX : tgt.x;
        const ty = tgt.orders.targetY !== undefined ? tgt.orders.targetY : tgt.y;
        const trad = tgt.orders.targetRadius || 2000;
        const dx = tx - tgt.x;
        const dy = ty - tgt.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= trad * 0.75) {
          // Reached destination area, transition to stay/orbit
          tgt.orders.type = 'STAY_IN_AREA';
        } else {
          const targetAngle = Math.atan2(dy, dx);
          let diff = targetAngle - tgt.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnSpd = tgt.turnRate || 2.0;
          tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), turnSpd * dt);
          tgt.speed = tgt.orders.speed || tgt.baseSpeed || 230;
          tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
          tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
          return;
        }
      }

      if (tgt.orders.type === 'STAY_IN_AREA') {
        const tx = tgt.orders.targetX !== undefined ? tgt.orders.targetX : tgt.x;
        const ty = tgt.orders.targetY !== undefined ? tgt.orders.targetY : tgt.y;
        const trad = tgt.orders.targetRadius || 2000;
        const dist = Math.hypot(tgt.x - tx, tgt.y - ty);

        if (dist > trad * 0.8) {
          // Turn back towards area center
          const toCenter = Math.atan2(ty - tgt.y, tx - tgt.x);
          let diff = toCenter - tgt.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), (tgt.turnRate || 2.2) * dt);
        } else {
          // Gentle orbit patrol inside area
          tgt.heading += 0.35 * dt;
        }
        tgt.speed = tgt.orders.speed || tgt.baseSpeed || 215;
        tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
        return;
      }

      if (tgt.orders.type === 'DEFEND_AREA') {
        const tx = tgt.orders.targetX !== undefined ? tgt.orders.targetX : tgt.x;
        const ty = tgt.orders.targetY !== undefined ? tgt.orders.targetY : tgt.y;
        const trad = tgt.orders.targetRadius || 2000;
        const playerDistFromArea = Math.hypot(playerX - tx, playerY - ty);
        const isPlayerIntruding = (tgt.team === 'enemy') && (playerDistFromArea <= trad * 1.35);

        let threatInArea = null;
        for (const other of this.targets) {
          if (other === tgt || other.isDestroyed || other.active === false) continue;
          if (other.team !== tgt.team) {
            const d = Math.hypot(other.x - tx, other.y - ty);
            if (d <= trad * 1.35) {
              threatInArea = other;
              break;
            }
          }
        }

        if (!isPlayerIntruding && !threatInArea) {
          // Area is secure: fly toward center or patrol inside
          const dist = Math.hypot(tgt.x - tx, tgt.y - ty);
          if (dist > trad * 0.75) {
            const toCenter = Math.atan2(ty - tgt.y, tx - tgt.x);
            let diff = toCenter - tgt.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), (tgt.turnRate || 2.2) * dt);
          } else {
            tgt.heading += 0.35 * dt;
          }
          tgt.speed = tgt.orders.speed || tgt.baseSpeed || 220;
          tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
          tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
          return;
        }
        // Threat detected in defense zone: fall through to combat AI
      }
    }

    switch (aiType) {
      case 'dummy': {
        // 1. DUMMY AI: Flies around in circles, doing absolutely nothing (Target practice)
        if (tgt.formationId && this.formation) {
          const f = this.formation;
          const cosH = Math.cos(f.heading);
          const sinH = Math.sin(f.heading);
          tgt.heading = f.heading;
          tgt.speed = f.speed || 215;
          tgt.x = f.x + (-sinH) * tgt.formationOffset.x + cosH * tgt.formationOffset.y;
          tgt.y = f.y + cosH * tgt.formationOffset.x + sinH * tgt.formationOffset.y;
        } else {
          tgt.heading += (tgt.turnRate || 0.35) * dt;
          tgt.speed = tgt.baseSpeed || 205;
          tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
          tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
        }
        break;
      }

      case 'drone': {
        // 2. DRONE AI: Flies in circles and does not engage. Attempts basic evasive maneuvers when fired on.
        const underThreat = threat && threat.dist < 2200;
        if (underThreat && (tgt.evadeTimer || 0) <= 0) {
          tgt.evadeTimer = 1.8;
          const threatAngle = Math.atan2(threat.missile.y - tgt.y, threat.missile.x - tgt.x);
          const side = Math.sin((tgt.id ? tgt.id.charCodeAt(tgt.id.length - 1) : 1) * 3) > 0 ? 1 : -1;
          tgt.evadeHeading = threatAngle + Math.PI * 0.5 * side;
        }

        if (tgt.evadeTimer > 0) {
          let diff = (tgt.evadeHeading || 0) - tgt.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), 1.55 * dt);
          tgt.speed = Math.min(325, (tgt.speed || 215) + 130 * dt);
        } else {
          tgt.heading += (tgt.turnRate || 0.32) * dt;
          tgt.speed = tgt.baseSpeed || 210;
        }
        tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
        break;
      }

      case 'strike': {
        // 3. STRIKE AI: Prioritizes friendly ground targets (hostile to the striker).
        // In test flight without friendly ground targets, patrols its assigned southern sector.
        let groundTarget = null;
        let minGroundDist = Infinity;
        for (const t of this.targets) {
          if (t.isDestroyed || t.isFalling) continue;
          if (t.isFriendlyGround || t.isFriendly) {
            const d = Math.hypot(t.x - tgt.x, t.y - tgt.y);
            if (d < minGroundDist) {
              minGroundDist = d;
              groundTarget = t;
            }
          }
        }

        if (groundTarget) {
          const toGround = Math.atan2(groundTarget.y - tgt.y, groundTarget.x - tgt.x);
          let gDiff = toGround - tgt.heading;
          while (gDiff > Math.PI) gDiff -= Math.PI * 2;
          while (gDiff < -Math.PI) gDiff += Math.PI * 2;
          tgt.heading += Math.sign(gDiff) * Math.min(Math.abs(gDiff), 0.95 * dt);
          tgt.speed = 245;

          if (minGroundDist < 2000 && Math.abs(gDiff) < 0.40 && tgt.fireCooldown <= 0) {
            this.launchStrikeOrdnance(tgt, groundTarget, particles, audio);
            tgt.fireCooldown = 6.5;
          }
        } else {
          // Patrol within designated sector
          const sCX = tgt.patrolCenterX || -4800;
          const sCY = tgt.patrolCenterY || 4200;
          const sRad = tgt.patrolRadius || 2400;
          const distFromC = Math.hypot(tgt.x - sCX, tgt.y - sCY);

          if (distFromC > sRad * 1.15) {
            const toCenter = Math.atan2(sCY - tgt.y, sCX - tgt.x);
            let diff = toCenter - tgt.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.85 * dt);
          } else {
            tgt.heading += 0.28 * dt;
          }
          tgt.speed = tgt.baseSpeed || 235;
        }
        // Maintains bombing attack path (rarely evades player missiles)
        tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
        break;
      }

      case 'rookie': {
        // 4. ROOKIE AI: Patrols spawn area, engages nearby targets, basic evasion, easy target, fires 1 MSL at a time
        const cX = tgt.patrolCenterX || tgt.x;
        const cY = tgt.patrolCenterY || tgt.y;
        const pR = tgt.patrolRadius || 2000;
        const distFromCenter = Math.hypot(tgt.x - cX, tgt.y - cY);
        const distP = Math.hypot(playerX - tgt.x, playerY - tgt.y);
        const playerNear = distP < 3200;
        const underThreat = threat && threat.dist < 1600;

        if (underThreat) {
          // Basic rookie evasive turn away from incoming missile line of sight
          const threatAngle = Math.atan2(threat.missile.y - tgt.y, threat.missile.x - tgt.x);
          const evadeAngle = threatAngle + Math.PI;
          let eDiff = evadeAngle - tgt.heading;
          while (eDiff > Math.PI) eDiff -= Math.PI * 2;
          while (eDiff < -Math.PI) eDiff += Math.PI * 2;
          tgt.heading += Math.sign(eDiff) * Math.min(Math.abs(eDiff), (tgt.turnRate || 0.85) * dt);
          tgt.speed = Math.min(260, (tgt.speed || 210) + 50 * dt);
        } else if (playerNear) {
          // Pure pursuit: points directly at player current coordinates (predictable & easy to out-turn)
          const angleToP = Math.atan2(playerY - tgt.y, playerX - tgt.x);
          let pDiff = angleToP - tgt.heading;
          while (pDiff > Math.PI) pDiff -= Math.PI * 2;
          while (pDiff < -Math.PI) pDiff += Math.PI * 2;

          tgt.heading += Math.sign(pDiff) * Math.min(Math.abs(pDiff), (tgt.turnRate || 0.85) * dt);
          tgt.speed = 215; // Does not manage energy

          // Fire single standard MSL
          const hasActiveMissile = particles.missiles && particles.missiles.some(
            m => m.isEnemy && m.ownerId === tgt.id && !m.decoyed && m.life > 0.4
          );
          if (!hasActiveMissile && tgt.fireCooldown <= 0) {
            if (Math.abs(pDiff) < 0.55 && distP >= 750 && distP <= 2800) {
              this.launchFighterMissile(tgt, playerX, playerY, particles, audio, false);
              tgt.fireCooldown = tgt.fireInterval || 7.5;
            }
          }
        } else {
          // Patrol orbit around spawn center
          if (distFromCenter > pR * 1.2) {
            const toCenter = Math.atan2(cY - tgt.y, cX - tgt.x);
            let diff = toCenter - tgt.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), 1.0 * dt);
          } else {
            tgt.heading += (tgt.turnRate || 0.38) * dt;
          }
          tgt.speed = tgt.baseSpeed || 205;
        }

        tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
        break;
      }

      case 'veteran': {
        // 5. VETERAN AI: Better dogfighting, extends when needed, evades most missiles (beam turn), 1 MSL at a time, faster reload
        this.runDogfightAI(tgt, dt, playerX, playerY, particles, audio, flightState, {
          level: 'veteran',
          maxTurnRate: tgt.turnRate || 1.60,
          cornerSpeed: tgt.cornerSpeed || 245,
          maxSpeed: tgt.maxSpeed || 350,
          fireInterval: tgt.fireInterval || 4.8,
          salvoSize: 1,
          useFlares: false,
          allowSPW: false,
          allowPSM: false,
          threat
        });
        break;
      }

      case 'elite': {
        // 6. ELITE AI: Strong dogfighting, extends/turns/disengages, hunts player, evades all missiles (turns hard, flares if close), 1 MSL + SPW
        this.runDogfightAI(tgt, dt, playerX, playerY, particles, audio, flightState, {
          level: 'elite',
          maxTurnRate: tgt.turnRate || 1.80,
          cornerSpeed: tgt.cornerSpeed || 250,
          maxSpeed: tgt.maxSpeed || 360,
          fireInterval: tgt.fireInterval || 3.6,
          salvoSize: 1,
          useFlares: true,
          flareCooldownTime: 13.0,
          allowSPW: true,
          spwCooldownTime: 9.0,
          allowPSM: false,
          threat
        });
        break;
      }

      case 'ace': {
        // 7. ACE AI: Master dogfighter, extends/recommits, hunts player, evades all missiles (hard turns + flares with heavy cooldown),
        // fires two MSL at once ([||] salvo like player), uses SPW, executes Post-Stall Maneuvers (PSM) if aircraft permits!
        this.runDogfightAI(tgt, dt, playerX, playerY, particles, audio, flightState, {
          level: 'ace',
          maxTurnRate: tgt.turnRate || 2.05,
          cornerSpeed: tgt.cornerSpeed || 250,
          maxSpeed: tgt.maxSpeed || 375,
          fireInterval: tgt.fireInterval || 3.2,
          salvoSize: 2,
          useFlares: true,
          flareCooldownTime: 18.0,
          allowSPW: true,
          spwCooldownTime: 8.0,
          allowPSM: true,
          threat
        });
        break;
      }

      default: {
        tgt.heading += 0.35 * dt;
        tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
        tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;
        break;
      }
    }

    // Afterburner & jet exhaust effects
    this.emitJetExhaust(tgt, particles);
  }

  // Advanced Energy Dogfight Engine (powers Veteran, Elite, and Ace AI)
  runDogfightAI(tgt, dt, playerX, playerY, particles, audio, flightState, opts) {
    const t = tgt.territory;
    const playerInTerritory = t ? (
      playerX >= t.minX && playerX <= t.maxX &&
      playerY >= t.minY && playerY <= t.maxY
    ) : true;

    const cornerSpd = opts.cornerSpeed || 245;
    const speedRatio = Math.max(1.0, tgt.speed / cornerSpd);
    const dynamicTurnRate = opts.maxTurnRate / Math.pow(speedRatio, 0.60);

    // 1. Boundary enforcement for sector-locked aircraft
    const margin = 650;
    const nearBoundary = t && (
      tgt.x < t.minX + margin || tgt.x > t.maxX - margin ||
      tgt.y < t.minY + margin || tgt.y > t.maxY - margin ||
      Math.hypot(tgt.x - t.centerX, tgt.y - t.centerY) > t.radius
    );

    if (nearBoundary) {
      const toCenter = Math.atan2(t.centerY - tgt.y, t.centerX - tgt.x);
      let diff = toCenter - tgt.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff -= Math.PI * 2;
      tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), 1.8 * dt);
      tgt.speed = Math.max(tgt.baseSpeed || 260, tgt.speed - 35 * dt);
      tgt.tacticalState = 'DOGFIGHT';
      tgt.tacticalTimer = 0;
    } else if (t && !playerInTerritory) {
      // Player outside sector: patrol internally
      tgt.tacticalState = 'PATROL';
      tgt.tacticalTimer = 0;
      const dxC = tgt.x - t.centerX;
      const dyC = tgt.y - t.centerY;
      const distC = Math.hypot(dxC, dyC);
      if (distC > 2200) {
        const toCenter = Math.atan2(t.centerY - tgt.y, t.centerX - tgt.x);
        let diff = toCenter - tgt.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        tgt.heading += Math.sign(diff) * Math.min(Math.abs(diff), 1.2 * dt);
      } else {
        tgt.heading += 0.30 * dt;
      }
      tgt.speed = tgt.baseSpeed || 280;
    } else {
      // 2. Active Engagement
      tgt.tacticalTimer = (tgt.tacticalTimer || 0) + dt;
      const dxP = playerX - tgt.x;
      const dyP = playerY - tgt.y;
      const distP = Math.hypot(dxP, dyP);
      const bearingToPlayer = Math.atan2(dyP, dxP);
      let diffToPlayer = bearingToPlayer - tgt.heading;
      while (diffToPlayer > Math.PI) diffToPlayer -= Math.PI * 2;
      while (diffToPlayer < -Math.PI) diffToPlayer += Math.PI * 2;

      // Check incoming missile threat evasion
      const underThreat = opts.threat && opts.threat.dist < 2400;

      if (underThreat) {
        // High-G Beam / Break Turn: turn perpendicular to missile vector to force gimbal drop or overshoot
        const m = opts.threat.missile;
        const missileBearing = Math.atan2(m.y - tgt.y, m.x - tgt.x);
        const side = Math.sin(missileBearing - tgt.heading) >= 0 ? -1 : 1;
        const beamHeading = missileBearing + Math.PI * 0.5 * side;

        let bDiff = beamHeading - tgt.heading;
        while (bDiff > Math.PI) bDiff -= Math.PI * 2;
        while (bDiff < -Math.PI) bDiff += Math.PI * 2;

        tgt.heading += Math.sign(bDiff) * Math.min(Math.abs(bDiff), dynamicTurnRate * 1.15 * dt);
        tgt.speed = Math.min(opts.maxSpeed, tgt.speed + 140 * dt);

        // Flare deployment for Elite & Ace when missile gets critically close
        if (opts.useFlares && (tgt.flareCooldown || 0) <= 0 && opts.threat.dist < 900 && opts.threat.dot > 0.40) {
          if (particles && particles.spawnFlares) {
            particles.spawnFlares(
              tgt.x,
              tgt.y,
              tgt.heading,
              Math.cos(tgt.heading) * tgt.speed,
              Math.sin(tgt.heading) * tgt.speed
            );
          }
          if (audio && audio.playFlareSound) {
            audio.playFlareSound();
          }
          tgt.flareCooldown = opts.flareCooldownTime || 15.0;
        }
      } else {
        // Post-Stall Maneuver (PSM) for Ace AI (Cobra / drift yaw with nose-flip snapshot)
        const canPSM = opts.allowPSM && (tgt.model === 'su27' || tgt.model === 'su57' || tgt.model === 'f22' || tgt.hasTVC || tgt.hasPsm);
        if (tgt.psmTimer > 0) {
          // In the middle of PSM drift: rapid nose rotation directly onto player while velocity carries forward
          tgt.heading += Math.sign(diffToPlayer) * Math.min(Math.abs(diffToPlayer), 3.8 * dt);
          tgt.speed = Math.max(130, tgt.speed - 120 * dt);

          // Vapor effects during high-alpha pull
          if (particles && Math.random() < 0.6) {
            particles.particles.push({
              x: tgt.x + (Math.random() - 0.5) * 30,
              y: tgt.y + (Math.random() - 0.5) * 30,
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 0.5) * 20,
              life: 0.28,
              maxLife: 0.28,
              size: 8 + Math.random() * 8,
              color: 'rgba(230, 245, 255, 0.45)',
              type: 'smoke'
            });
          }

          // Snapshot opportunity during PSM
          if (Math.abs(diffToPlayer) < 0.45 && distP >= 600 && distP <= 2800 && tgt.fireCooldown <= 0) {
            if (opts.salvoSize === 2) {
              if (opts.allowSPW && (tgt.spwCooldown || 0) <= 0 && tgt.equippedSpw === 'qaam') {
                this.launchFighterMissile(tgt, playerX, playerY, particles, audio, true);
                tgt.spwCooldown = opts.spwCooldownTime || 8.0;
              } else {
                this.launchFighterSalvo(tgt, playerX, playerY, particles, audio);
              }
            } else {
              this.launchFighterMissile(tgt, playerX, playerY, particles, audio, false);
            }
            tgt.fireCooldown = opts.fireInterval;
          }

          // Gun snap during PSM
          const canUseGuns = (opts.level === 'veteran' || opts.level === 'elite' || opts.level === 'ace');
          if (canUseGuns && distP <= 1000 && Math.abs(diffToPlayer) < 0.32) {
            tgt.gunTimer = (tgt.gunTimer || 0) + dt;
            const gunInterval = 0.055;
            while (tgt.gunTimer >= gunInterval) {
              tgt.gunTimer -= gunInterval;
              if (particles && particles.spawnBullet) {
                particles.spawnBullet(
                  tgt.x,
                  tgt.y,
                  tgt.heading,
                  Math.cos(tgt.heading) * tgt.speed,
                  Math.sin(tgt.heading) * tgt.speed,
                  1.4,
                  true
                );
              }
            }
            if (audio && audio.playGunSound && Math.random() < 0.25) {
              audio.playGunSound();
            }
          }
        } else if (canPSM && (tgt.psmCooldown || 0) <= 0 && distP < 1600 && Math.abs(diffToPlayer) > 0.65 && tgt.speed < 265) {
          // Trigger PSM
          tgt.psmTimer = 0.95;
          tgt.psmCooldown = 12.0;
          tgt.speed = Math.max(130, tgt.speed * 0.72);
        } else {
          // Standard Dogfighting Energy Tactics
          let playerIsSlow = false;
          let playerIsWinning = false;
          const playerSpeed = flightState ? flightState.speed : 260;
          const playerHeading = flightState ? flightState.heading : 0;

          if (flightState) {
            const bearingFromPlayer = Math.atan2(tgt.y - playerY, tgt.x - playerX);
            let playerAngDiff = bearingFromPlayer - playerHeading;
            while (playerAngDiff > Math.PI) playerAngDiff -= Math.PI * 2;
            while (playerAngDiff < -Math.PI) playerAngDiff += Math.PI * 2;

            playerIsSlow = playerSpeed < 230 || flightState.isStalled;
            playerIsWinning = distP < 2400 && Math.abs(playerAngDiff) < 0.65;
          }

          // Tactical intelligence: extend away when player is slow & winning to reset energy
          if (playerIsWinning && playerIsSlow) {
            if (tgt.tacticalState !== 'EXTEND') {
              tgt.tacticalState = 'EXTEND';
              tgt.tacticalTimer = 0;
            }
          } else if (tgt.tacticalState === 'EXTEND') {
            if (distP > 2600 || !playerIsWinning || tgt.tacticalTimer > 3.2) {
              tgt.tacticalState = 'DOGFIGHT';
              tgt.tacticalTimer = 0;
            }
          } else {
            tgt.tacticalState = 'DOGFIGHT';
          }

          if (tgt.tacticalState === 'EXTEND') {
            // Extension maneuver at full afterburner
            const angleAwayFromPlayer = bearingToPlayer + Math.PI;
            const angleToCenter = t ? Math.atan2(t.centerY - tgt.y, t.centerX - tgt.x) : angleAwayFromPlayer;
            const extendAngle = Math.atan2(
              Math.sin(angleAwayFromPlayer) * 0.70 + Math.sin(angleToCenter) * 0.30,
              Math.cos(angleAwayFromPlayer) * 0.70 + Math.cos(angleToCenter) * 0.30
            );

            let extDiff = extendAngle - tgt.heading;
            while (extDiff > Math.PI) extDiff -= Math.PI * 2;
            while (extDiff < -Math.PI) extDiff += Math.PI * 2;

            tgt.heading += Math.sign(extDiff) * Math.min(Math.abs(extDiff), 1.15 * dt);
            tgt.speed = Math.min(opts.maxSpeed, tgt.speed + 160 * dt);
          } else {
            // Dogfight maneuver with lead pursuit
            const pVx = flightState ? (flightState.vx || 0) : 0;
            const pVy = flightState ? (flightState.vy || 0) : 0;
            const leadFactor = Math.min(1.4, distP / 600);
            const rawLeadX = playerX + pVx * leadFactor;
            const rawLeadY = playerY + pVy * leadFactor;
            const leadX = t ? Math.max(t.minX + 300, Math.min(t.maxX - 300, rawLeadX)) : rawLeadX;
            const leadY = t ? Math.max(t.minY + 300, Math.min(t.maxY - 300, rawLeadY)) : rawLeadY;
            const leadAngle = Math.atan2(leadY - tgt.y, leadX - tgt.x);

            let lDiff = leadAngle - tgt.heading;
            while (lDiff > Math.PI) lDiff -= Math.PI * 2;
            while (lDiff < -Math.PI) lDiff += Math.PI * 2;

            tgt.heading += Math.sign(lDiff) * Math.min(Math.abs(lDiff), dynamicTurnRate * dt);

            // Speed management: drops to corner speed only during hard turns to maximize turn rate
            if (distP < 1800 && Math.abs(lDiff) > 0.45) {
              if (tgt.speed > cornerSpd) {
                tgt.speed = Math.max(cornerSpd, tgt.speed - 90 * dt);
              } else {
                tgt.speed = cornerSpd;
              }
            } else if (distP > 2200) {
              tgt.speed = Math.min(opts.maxSpeed, tgt.speed + 130 * dt);
            } else {
              tgt.speed = Math.min(315, tgt.speed + 65 * dt);
            }

            // Missile firing
            const hasActiveMissile = particles.missiles && particles.missiles.some(
              m => m.isEnemy && m.ownerId === tgt.id && !m.decoyed && m.life > 0.4
            );

            // Veteran & Elite fire strictly 1 at a time; Ace can fire 2 at once
            const canFire = (opts.salvoSize === 2) || !hasActiveMissile;

            if (canFire && tgt.fireCooldown <= 0) {
              if (Math.abs(diffToPlayer) < 0.60 && distP >= 750 && distP <= 3500) {
                if (opts.salvoSize === 2) {
                  if (opts.allowSPW && (tgt.spwCooldown || 0) <= 0 && tgt.equippedSpw === 'qaam') {
                    this.launchFighterMissile(tgt, playerX, playerY, particles, audio, true);
                    tgt.spwCooldown = opts.spwCooldownTime || 8.0;
                  } else {
                    this.launchFighterSalvo(tgt, playerX, playerY, particles, audio);
                  }
                } else if (opts.allowSPW && (tgt.spwCooldown || 0) <= 0) {
                  this.launchFighterMissile(tgt, playerX, playerY, particles, audio, true);
                  tgt.spwCooldown = opts.spwCooldownTime || 9.0;
                } else {
                  this.launchFighterMissile(tgt, playerX, playerY, particles, audio, false);
                }
                tgt.fireCooldown = opts.fireInterval;
              }
            }

            // Machine Gun fire for Veteran, Elite, and Ace AI (close dogfight & nose aligned)
            const canUseGuns = (opts.level === 'veteran' || opts.level === 'elite' || opts.level === 'ace');
            if (canUseGuns && distP <= 1000 && Math.abs(lDiff) < 0.28) {
              tgt.gunTimer = (tgt.gunTimer || 0) + dt;
              const gunInterval = 0.055; // ~18 rounds/sec during gun tracking burst
              while (tgt.gunTimer >= gunInterval) {
                tgt.gunTimer -= gunInterval;
                if (particles && particles.spawnBullet) {
                  particles.spawnBullet(
                    tgt.x,
                    tgt.y,
                    tgt.heading,
                    Math.cos(tgt.heading) * tgt.speed,
                    Math.sin(tgt.heading) * tgt.speed,
                    1.4,
                    true // isEnemy = true
                  );
                }
              }
              if (audio && audio.playGunSound && Math.random() < 0.25) {
                audio.playGunSound();
              }
            } else {
              tgt.gunTimer = 0;
            }
          }
        }
      }
    }

    // Kinematic motion
    tgt.x += Math.cos(tgt.heading) * tgt.speed * dt;
    tgt.y += Math.sin(tgt.heading) * tgt.speed * dt;

    if (t) {
      tgt.x = Math.max(t.minX + 50, Math.min(t.maxX - 50, tgt.x));
      tgt.y = Math.max(t.minY + 50, Math.min(t.maxY - 50, tgt.y));
    }
  }

  // Fighter fires missile (Standard MSL or Special Weapon QAAM)
  launchFighterMissile(fighter, playerX, playerY, particles, audio, isSpecial = false) {
    if (!particles || !particles.spawnMissile) return;
    fighter.railSide = -(fighter.railSide || 1);
    const cosH = Math.cos(fighter.heading);
    const sinH = Math.sin(fighter.heading);
    const perpX = -sinH;
    const perpY = cosH;
    const pylonX = fighter.x - cosH * 6 + perpX * 18 * fighter.railSide;
    const pylonY = fighter.y - sinH * 6 + perpY * 18 * fighter.railSide;

    const isQAAM = isSpecial || fighter.equippedSpw === 'qaam';
    particles.spawnMissile(
      pylonX,
      pylonY,
      fighter.heading,
      cosH * fighter.speed,
      sinH * fighter.speed,
      playerX,
      playerY,
      {
        isEnemy: true,
        targetsPlayer: true,
        targetType: 'player',
        ownerId: fighter.id,
        isGuided: true,
        isQAAM: isQAAM,
        leadPursuit: true,
        turnRate: isQAAM ? 1.75 : 0.92,
        maxSpeed: isQAAM ? 860 : 820,
        accel: 620,
        guidanceDelay: 0.20,
        initialBoost: 130,
        color: isQAAM ? '#00e5ff' : '#ff4433',
        damage: isQAAM ? 48 : 32,
        life: isQAAM ? 6.5 : 5.5
      }
    );

    if (audio) {
      audio.playMissileSound();
    }
  }

  // Ace AI fires two standard missiles at once ([||] volley like the player)
  launchFighterSalvo(fighter, playerX, playerY, particles, audio) {
    this.launchFighterMissile(fighter, playerX, playerY, particles, audio, false);
    setTimeout(() => {
      if (!fighter.isDestroyed && !fighter.isFalling) {
        this.launchFighterMissile(fighter, playerX, playerY, particles, audio, false);
      }
    }, 160);
  }

  // Strike AI drops ordnance against ground/naval targets
  launchStrikeOrdnance(striker, groundTarget, particles, audio) {
    if (!particles) return;
    const cosH = Math.cos(striker.heading);
    const sinH = Math.sin(striker.heading);
    particles.spawnMissile(
      striker.x,
      striker.y,
      striker.heading,
      cosH * striker.speed,
      sinH * striker.speed,
      groundTarget.x,
      groundTarget.y,
      {
        isEnemy: true,
        targetsPlayer: false,
        targetType: 'ground',
        isBomb: true,
        maxSpeed: 460,
        accel: 220,
        turnRate: 0,
        damage: 100,
        color: '#ffaa33',
        life: 4.2
      }
    );
    if (audio) {
      audio.playMissileSound();
    }
  }

  // Exhaust particle generator
  emitJetExhaust(tgt, particles) {
    if (!particles) return;
    const isTwin = tgt.model === 'su27' || tgt.model === 'f22' || tgt.model === 'su57';
    const isAfterburning = tgt.speed > 290;
    const rate = isAfterburning ? 0.75 : 0.35;
    if (Math.random() >= rate) return;

    const cosH = Math.cos(tgt.heading);
    const sinH = Math.sin(tgt.heading);

    if (isTwin) {
      const perpX = -sinH;
      const perpY = cosH;
      for (const noz of [-9, 9]) {
        particles.particles.push({
          x: tgt.x - cosH * 38 + perpX * noz,
          y: tgt.y - sinH * 38 + perpY * noz,
          vx: -cosH * (tgt.speed * 0.35 + 85) + (Math.random() - 0.5) * 15,
          vy: -sinH * (tgt.speed * 0.35 + 85) + (Math.random() - 0.5) * 15,
          life: 0.18,
          maxLife: 0.18,
          size: 5 + Math.random() * 3,
          color: isAfterburning ? 'rgba(255, 120, 20, 0.85)' : 'rgba(255, 175, 60, 0.45)',
          type: 'flame'
        });
      }
    } else {
      particles.particles.push({
        x: tgt.x - cosH * 24,
        y: tgt.y - sinH * 24,
        vx: -cosH * 60 + (Math.random() - 0.5) * 15,
        vy: -sinH * 60 + (Math.random() - 0.5) * 15,
        life: 0.18,
        maxLife: 0.18,
        size: 4 + Math.random() * 3,
        color: isAfterburning ? 'rgba(255, 130, 30, 0.75)' : 'rgba(255, 160, 50, 0.45)',
        type: 'flame'
      });
    }
  }

  // SAM Battery launches surface-to-air missile targeting player
  launchSAMMissile(sam, playerX, playerY, particles, audio) {
    if (!particles || !particles.spawnMissile) return;
    const launchAngle = Math.atan2(playerY - sam.y, playerX - sam.x);
    particles.spawnMissile(
      sam.x,
      sam.y,
      launchAngle,
      0,
      0,
      playerX,
      playerY,
      {
        isEnemy: true,
        targetsPlayer: true,
        targetType: 'player',
        isSAM: true,
        isGuided: true,
        seekerGimbal: 0.78,
        guidanceDelay: 0.25,
        maxSpeed: 760,
        accel: 550,
        turnRate: 0.96, // Reduced by 20% from 1.2: agile flying / high-G out-turns it
        color: '#ff3322',
        life: 6.5,
        initialBoost: 160
      }
    );
    if (audio) {
      audio.playMissileSound();
    }
  }

  // Scripted on-demand unit explosion (for story triggers & mission scripting)
  explodeTarget(targetId, particles, audio) {
    const tgt = this.targets.find(t => t.id === targetId);
    if (!tgt || tgt.isDestroyed) return;
    tgt.hp = 0;
    tgt.isDestroyed = true;
    if (particles && particles.spawnExplosion) {
      particles.spawnExplosion(tgt.x, tgt.y);
      for (let i = 0; i < 3; i++) {
        const ang = Math.random() * Math.PI * 2;
        const d = 15 + Math.random() * 25;
        particles.spawnExplosion(tgt.x + Math.cos(ang) * d, tgt.y + Math.sin(ang) * d);
      }
    }
    if (audio) {
      if (audio.playCrashSound) audio.playCrashSound();
      if (audio.playTargetDestroyed) audio.playTargetDestroyed();
    }
    this.destroyedNotifications.push({
      text: `DESTROYED // ${tgt.name.toUpperCase()}`,
      code: 'COMMAND',
      life: 2.2
    });
  }

  // Apply damage from bullets, missiles, or bombs
  damageTarget(tgt, damage, particles, audio) {
    if (tgt.isDestroyed || tgt.isFalling) return;
    tgt.hp -= damage;
    if (tgt.hp <= 0) {
      tgt.hp = 0;

      if (tgt.type === 'air') {
        // Air targets fly in a straight line into the ground while on fire before exploding
        tgt.isFalling = true;
        tgt.fallTimer = 0;
        tgt.fallDuration = 2.4 + Math.random() * 0.8; // 2.4 to 3.2s falling
        tgt.altitude = 1.0;
        tgt.fallHeading = tgt.heading;
        tgt.fallSpeed = Math.max(180, (tgt.speed || 240) * 0.90);

        // Immediate breach explosion puff from fatal hit
        particles.spawnExplosion(tgt.x, tgt.y);
        if (audio) {
          if (audio.playMissileHitSound) {
            audio.playMissileHitSound(false);
          }
          audio.playTargetDestroyed();
        }

        this.destroyedNotifications.push({
          text: `DESTROYED // ${tgt.name.toUpperCase()}`,
          code: tgt.code,
          life: 2.5
        });
      } else {
        // Surface targets (ships, SAMs) explode immediately on impact
        tgt.isDestroyed = true;
        tgt.respawnTimer = 14.0;
        particles.spawnExplosion(tgt.x, tgt.y);
        if (audio) {
          if (audio.playMissileHitSound) {
            audio.playMissileHitSound(true);
          }
          audio.playCrashSound();
          audio.playTargetDestroyed();
        }

        this.destroyedNotifications.push({
          text: `DESTROYED // ${tgt.name.toUpperCase()}`,
          code: tgt.code,
          life: 2.5
        });
      }
    }
  }

  // Render 3D silhouettes, warships, and SAM installations in world coordinates
  draw(ctx) {
    for (const tgt of this.targets) {
      if (tgt.isDestroyed || tgt.active === false) continue;

      ctx.save();
      ctx.translate(tgt.x, tgt.y);
      ctx.rotate(tgt.heading);

      if (tgt.type === 'air') {
        const isSu27 = tgt.model === 'su27';
        const isF22 = tgt.model === 'f22';
        let sprite = null;
        if (isSu27) sprite = this.su27Sprite;
        else if (isF22) sprite = this.f22Sprite;
        else sprite = this.migSprite;
        const hasSprite = sprite && sprite.complete && sprite.naturalWidth > 0;
        const baseSize = isF22 ? 104 : (isSu27 ? 110 : 80);

        const alt = (tgt.isFalling && tgt.altitude !== undefined)
          ? Math.max(0.0, Math.min(1.0, tgt.altitude))
          : 1.0;

        // Ground/Ocean shadow: as plane falls towards surface, shadow closes in to (2, 3) directly underneath!
        const baseOffsetX = 35;
        const baseOffsetY = 48;
        const shadowOffsetX = baseOffsetX * (0.08 + 0.92 * alt);
        const shadowOffsetY = baseOffsetY * (0.08 + 0.92 * alt);
        const shadowScale = 0.72 + 0.28 * (1.0 - alt);
        const altScale = 0.75 + 0.25 * alt;
        const size = baseSize * altScale;
        const shadowBlur = Math.max(1, Math.round(3.5 * alt));
        const shadowAlpha = 0.28 + 0.25 * (1.0 - alt);

        // Ground/Ocean shadow
        ctx.save();
        ctx.translate(shadowOffsetX, shadowOffsetY);
        ctx.rotate(Math.PI * 0.75); // Sprite nose faces -135 deg
        if (hasSprite) {
          ctx.filter = `brightness(0) blur(${shadowBlur}px)`;
          ctx.globalAlpha = shadowAlpha;
          ctx.drawImage(sprite, -size * 0.5 * shadowScale, -size * 0.5 * shadowScale, size * shadowScale, size * shadowScale);
        } else {
          ctx.rotate(-Math.PI * 0.75);
          if (isSu27) {
            this.drawSu27Shape(ctx, false);
          } else {
            this.drawMiG21Shape(ctx, false);
          }
        }
        ctx.restore();

        // Aircraft Airframe
        if (hasSprite) {
          ctx.save();
          ctx.rotate(Math.PI * 0.75);
          ctx.drawImage(sprite, -size * 0.5, -size * 0.5, size, size);
          ctx.restore();
        } else {
          if (isSu27) {
            this.drawSu27Shape(ctx, true);
          } else {
            this.drawMiG21Shape(ctx, true);
          }
        }

        // Cosmetic damage fire directly on the plane when HP < 10% or falling
        const hpRatio = tgt.hp / tgt.maxHp;
        if ((hpRatio < 0.10 && hpRatio > 0) || tgt.isFalling) {
          this.drawAirframeFire(ctx, size);
        }
      } else if (tgt.type === 'naval') {
        // Warship Hull & Turrets
        this.drawWarshipShape(ctx, tgt);
      } else if (tgt.type === 'ground') {
        // SAM Site Launcher Battery & Radar
        this.drawSAMSiteShape(ctx, tgt);
      }

      ctx.restore();
    }
  }

  drawMiG21Shape(ctx, isBody = false) {
    ctx.save();
    ctx.fillStyle = isBody ? '#788982' : 'rgba(4, 12, 16, 0.45)';
    ctx.strokeStyle = isBody ? '#4d5d56' : 'transparent';
    ctx.lineWidth = 1.5;

    // Needle fuselage
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(18, -4.5);
    ctx.lineTo(-24, -4.5);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-24, 4.5);
    ctx.lineTo(18, 4.5);
    ctx.closePath();
    ctx.fill();
    if (isBody) ctx.stroke();

    // Sharp Delta Wings
    ctx.beginPath();
    ctx.moveTo(8, -4.5);
    ctx.lineTo(-14, -26);
    ctx.lineTo(-22, -26);
    ctx.lineTo(-18, -4.5);
    ctx.closePath();
    ctx.fill();
    if (isBody) ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, 4.5);
    ctx.lineTo(-14, 26);
    ctx.lineTo(-22, 26);
    ctx.lineTo(-18, 4.5);
    ctx.closePath();
    ctx.fill();
    if (isBody) ctx.stroke();

    // Tail Fin & Stabilizers
    ctx.beginPath();
    ctx.moveTo(-18, -4.5);
    ctx.lineTo(-27, -13);
    ctx.lineTo(-30, -11);
    ctx.lineTo(-26, -4.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-18, 4.5);
    ctx.lineTo(-27, 13);
    ctx.lineTo(-30, 11);
    ctx.lineTo(-26, 4.5);
    ctx.closePath();
    ctx.fill();

    if (isBody) {
      // Cockpit Canopy
      ctx.fillStyle = '#1e383c';
      ctx.beginPath();
      ctx.ellipse(8, 0, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Red Star Wing Insignia
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(-8, -14, 2.5, 0, Math.PI * 2);
      ctx.arc(-8, 14, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawWarshipShape(ctx, tgt) {
    const sub = tgt ? tgt.subType : 'gunboat';
    ctx.save();

    if (sub === 'carrier') {
      // Aircraft Carrier (CVN) - Angled flight deck, island superstructure, catapults
      ctx.fillStyle = '#2c333a';
      ctx.strokeStyle = '#1a2026';
      ctx.lineWidth = 2.2;

      // Flight Deck Outer Hull Outline
      ctx.beginPath();
      ctx.moveTo(82, -18);
      ctx.lineTo(84, 8);
      ctx.lineTo(60, 22);
      ctx.lineTo(-65, 22);
      ctx.lineTo(-78, 14);
      ctx.lineTo(-78, -14);
      ctx.lineTo(-62, -22);
      ctx.lineTo(55, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Angled landing strip asphalt overlay
      ctx.fillStyle = '#22272c';
      ctx.beginPath();
      ctx.moveTo(45, 18);
      ctx.lineTo(-76, 12);
      ctx.lineTo(-76, -6);
      ctx.lineTo(25, -16);
      ctx.closePath();
      ctx.fill();

      // Runway Centerline dashed lines
      ctx.strokeStyle = '#e6c844';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(35, 3);
      ctx.lineTo(-70, 4);
      ctx.stroke();
      ctx.setLineDash([]);

      // Catapult tracks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(76, -10);
      ctx.lineTo(10, -10);
      ctx.moveTo(70, -2);
      ctx.lineTo(5, -2);
      ctx.stroke();

      // Island Superstructure (Starboard Tower)
      ctx.fillStyle = '#4a555f';
      ctx.strokeStyle = '#151b20';
      ctx.lineWidth = 1.5;
      ctx.fillRect(8, 13, 26, 8);
      ctx.strokeRect(8, 13, 26, 8);

      // Radome / Mast on tower
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(20, 17, 3, 0, Math.PI * 2);
      ctx.fill();

      // Phalanx CIWS mounts on deck sponsons
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(70, 18, 2.5, 0, Math.PI * 2);
      ctx.arc(-72, -18, 2.5, 0, Math.PI * 2);
      ctx.arc(-72, 18, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (sub === 'cruiser') {
      // Aegis Missile Cruiser (CG) - Long sleek stealth hull, phased array deckhouse, VLS cells, 5-inch gun
      ctx.fillStyle = '#3a444c';
      ctx.strokeStyle = '#1f262d';
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.moveTo(56, 0);
      ctx.lineTo(44, -11);
      ctx.lineTo(-44, -10);
      ctx.lineTo(-52, -7);
      ctx.lineTo(-52, 7);
      ctx.lineTo(-44, 10);
      ctx.lineTo(44, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Deck Superstructure / Aegis Phased Array Deckhouse
      ctx.fillStyle = '#4e5a63';
      ctx.fillRect(-18, -8, 38, 16);
      ctx.fillStyle = '#263038';
      ctx.fillRect(-4, -6, 16, 12);

      // Octagonal Aegis SPY radar array faces
      ctx.fillStyle = '#00ffee';
      ctx.fillRect(8, -5, 3, 10);
      ctx.fillRect(-2, -5, 3, 10);

      // Forward 5-inch / 127mm Naval Gun Turret
      ctx.fillStyle = '#1e242a';
      ctx.beginPath();
      ctx.arc(32, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#11161a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(32, 0);
      ctx.lineTo(44, 0);
      ctx.stroke();

      // Forward & Aft Mk 41 VLS Missile Silos
      ctx.fillStyle = '#1c2227';
      ctx.fillRect(18, -4, 8, 8);
      ctx.fillRect(-34, -4, 8, 8);

      // Aft Helipad
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(-42, 0, 4.5, 0, Math.PI * 2);
      ctx.stroke();

    } else if (sub === 'destroyer') {
      // Guided Missile Destroyer (DDG) - Angled bow, forward gun, VLS, twin stacks, aft helipad
      ctx.fillStyle = '#3c474f';
      ctx.strokeStyle = '#20272e';
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(34, -9);
      ctx.lineTo(-36, -8);
      ctx.lineTo(-44, -5);
      ctx.lineTo(-44, 5);
      ctx.lineTo(-36, 8);
      ctx.lineTo(34, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bridge Superstructure
      ctx.fillStyle = '#525e68';
      ctx.fillRect(-14, -6, 28, 12);

      // Mast / Radar
      ctx.fillStyle = '#232b31';
      ctx.fillRect(-2, -4, 10, 8);

      // Forward Gun Turret
      ctx.fillStyle = '#1c2227';
      ctx.beginPath();
      ctx.arc(24, 0, 4.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#12171b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(35, 0);
      ctx.stroke();

      // Forward VLS
      ctx.fillStyle = '#1e242a';
      ctx.fillRect(12, -3.5, 6, 7);

      // Aft CIWS & Helipad
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-22, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Helipad circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(-34, 0, 4, 0, Math.PI * 2);
      ctx.stroke();

    } else if (sub === 'frigate') {
      // Escort Frigate (FFG) - Compact combatant hull, single mast, forward gun
      ctx.fillStyle = '#3e4952';
      ctx.strokeStyle = '#222a31';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(24, -7.5);
      ctx.lineTo(-28, -7);
      ctx.lineTo(-34, -4);
      ctx.lineTo(-34, 4);
      ctx.lineTo(-28, 7);
      ctx.lineTo(24, 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Superstructure
      ctx.fillStyle = '#55626d';
      ctx.fillRect(-10, -5, 20, 10);

      // Mast
      ctx.fillStyle = '#22292f';
      ctx.fillRect(-1, -3, 6, 6);

      // Forward 76mm Gun
      ctx.fillStyle = '#1a2025';
      ctx.beginPath();
      ctx.arc(17, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(26, 0);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#101518';
      ctx.stroke();

      // Aft flight deck
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(-24, 0, 3.5, 0, Math.PI * 2);
      ctx.stroke();

    } else {
      // Patrol Gunboat (PB / Corvette)
      ctx.fillStyle = '#3a444a';
      ctx.strokeStyle = '#22292f';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(14, -6);
      ctx.lineTo(-18, -5.5);
      ctx.lineTo(-22, -3);
      ctx.lineTo(-22, 3);
      ctx.lineTo(-18, 5.5);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cabin
      ctx.fillStyle = '#55626a';
      ctx.fillRect(-8, -4, 14, 8);

      // Forward machine gun
      ctx.fillStyle = '#151b1e';
      ctx.beginPath();
      ctx.arc(10, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(17, 0);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSAMSiteShape(ctx, tgt) {
    ctx.save();
    // Concrete Revetment / Octagonal Base
    ctx.fillStyle = '#3e4a42';
    ctx.strokeStyle = '#28332b';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    const r = 26;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Missile Rails (Triple SA-6 Canisters)
    ctx.fillStyle = '#e5ece8';
    ctx.fillRect(-12, -8, 24, 4);
    ctx.fillRect(-14, -2, 28, 4);
    ctx.fillRect(-12, 4, 24, 4);

    // Rotating Radar Dish
    ctx.save();
    ctx.rotate(tgt.radarAngle || 0);
    ctx.strokeStyle = '#ffff44';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 9, -0.7, 0.7);
    ctx.stroke();
    ctx.fillStyle = '#ffff44';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // Geometric fallback rendering for Su-27 Flanker
  drawSu27Shape(ctx, isBody = false) {
    ctx.save();
    ctx.fillStyle = isBody ? '#4d758f' : 'rgba(4, 12, 16, 0.45)';
    ctx.strokeStyle = isBody ? '#2c4758' : 'transparent';
    ctx.lineWidth = 1.8;

    // Blended Wing-Body & Nose
    ctx.beginPath();
    ctx.moveTo(48, 0);
    ctx.lineTo(26, -5.5);
    ctx.lineTo(8, -10);
    ctx.lineTo(-18, -38);
    ctx.lineTo(-32, -38);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-44, -18);
    ctx.lineTo(-48, -7);
    ctx.lineTo(-36, -3);
    ctx.lineTo(-48, 0);
    ctx.lineTo(-36, 3);
    ctx.lineTo(-48, 7);
    ctx.lineTo(-44, 18);
    ctx.lineTo(-24, 14);
    ctx.lineTo(-32, 38);
    ctx.lineTo(-18, 38);
    ctx.lineTo(8, 10);
    ctx.lineTo(26, 5.5);
    ctx.closePath();
    ctx.fill();
    if (isBody) ctx.stroke();

    if (isBody) {
      // Twin Vertical Stabilizers
      ctx.fillStyle = '#3a596e';
      ctx.fillRect(-38, -12, 14, 3);
      ctx.fillRect(-38, 9, 14, 3);

      // Cockpit Canopy
      ctx.fillStyle = '#1c343b';
      ctx.beginPath();
      ctx.ellipse(16, 0, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flanker Radome Nose Cone
      ctx.fillStyle = '#ded9cf';
      ctx.beginPath();
      ctx.moveTo(48, 0);
      ctx.lineTo(36, -3.2);
      ctx.lineTo(36, 3.2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
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

