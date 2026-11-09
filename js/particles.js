// Particle Effects Engine: Afterburners, Vapor Trails, Gun Tracers, Flares, Missiles

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.wingtipTrails = { left: [], right: [] };
    this.bullets = [];
    this.missiles = [];
    this.flares = [];
    this.sonicCones = [];
  }

  reset() {
    this.particles = [];
    this.wingtipTrails.left = [];
    this.wingtipTrails.right = [];
    this.bullets = [];
    this.missiles = [];
    this.flares = [];
    this.sonicCones = [];
  }

  // Spawn afterburner / engine exhaust particles
  emitEnginePlume(x, y, heading, speed, throttle, isAfterburning, pConfig, altScale = 1.0) {
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const perpX = -sinH;
    const perpY = cosH;

    const offsetDist = (pConfig.engineOffset || -46) * altScale;
    const spacing = (pConfig.nozzleSpacing || 20) * 0.5 * altScale;

    // Twin nozzles
    const nozzles = [
      {
        x: x + cosH * offsetDist + perpX * spacing,
        y: y + sinH * offsetDist + perpY * spacing
      },
      {
        x: x + cosH * offsetDist - perpX * spacing,
        y: y + sinH * offsetDist - perpY * spacing
      }
    ];

    const exhaustSpeed = (isAfterburning ? 280 : 160) + Math.random() * 40;

    for (const nz of nozzles) {
      if (isAfterburning) {
        // High intensity flame core
        const spread = (Math.random() - 0.5) * 0.12;
        const flameAngle = heading + Math.PI + spread;
        this.particles.push({
          x: nz.x,
          y: nz.y,
          vx: Math.cos(flameAngle) * exhaustSpeed,
          vy: Math.sin(flameAngle) * exhaustSpeed,
          life: 0.18 + Math.random() * 0.1,
          maxLife: 0.28,
          size: 7 + Math.random() * 5,
          color: Math.random() > 0.4 ? '#ff7700' : '#ffee44',
          type: 'flame'
        });

        // Heat shimmer / outer glow
        this.particles.push({
          x: nz.x + (Math.random() - 0.5) * 4,
          y: nz.y + (Math.random() - 0.5) * 4,
          vx: Math.cos(flameAngle) * (exhaustSpeed * 0.6),
          vy: Math.sin(flameAngle) * (exhaustSpeed * 0.6),
          life: 0.35,
          maxLife: 0.35,
          size: 14 + Math.random() * 8,
          color: 'rgba(255, 180, 50, 0.4)',
          type: 'glow'
        });
      } else if (throttle > 0.3) {
        // Normal jet exhaust shimmer
        if (Math.random() < 0.6) {
          const spread = (Math.random() - 0.5) * 0.2;
          const flameAngle = heading + Math.PI + spread;
          this.particles.push({
            x: nz.x,
            y: nz.y,
            vx: Math.cos(flameAngle) * (exhaustSpeed * 0.5),
            vy: Math.sin(flameAngle) * (exhaustSpeed * 0.5),
            life: 0.2,
            maxLife: 0.2,
            size: 4 + Math.random() * 3,
            color: 'rgba(200, 230, 255, 0.35)',
            type: 'shimmer'
          });
        }
      }
    }
  }

  // Emit damage smoke and fire trail for damaged aircraft (< 60% HP)
  emitAircraftDamage(x, y, heading, speed, hpRatio, dt, sourceId = 'default') {
    if (hpRatio >= 0.60 || hpRatio <= 0) return;

    if (!this.damageTimers) {
      this.damageTimers = {};
    }
    this.damageTimers[sourceId] = (this.damageTimers[sourceId] || 0) + dt;

    // Severity goes from 0.0 at 60% HP to 1.0 at 0% HP
    const severity = Math.max(0.0, Math.min(1.0, (0.60 - hpRatio) / 0.60));

    // Emission interval: from 0.055s (thin smoke) down to 0.014s (thick dense black smoke)
    const interval = 0.055 - severity * 0.041;

    if (this.damageTimers[sourceId] >= interval) {
      this.damageTimers[sourceId] = 0;

      const cosH = Math.cos(heading);
      const sinH = Math.sin(heading);
      const perpX = -sinH;
      const perpY = cosH;

      // Breach origin point on airframe (port wing root / engine housing)
      const breachDist = -16;
      const breachLat = -9;
      const originX = x + cosH * breachDist + perpX * breachLat;
      const originY = y + sinH * breachDist + perpY * breachLat;

      // Slipstream pulls smoke back opposite heading
      const slipSpeed = Math.max(120, speed * 0.40 + 50);
      const spread = 10 + severity * 24;
      const vx = -cosH * slipSpeed + (Math.random() - 0.5) * spread;
      const vy = -sinH * slipSpeed + (Math.random() - 0.5) * spread;

      // Smoke color: interpolated from light gray rgb(195, 195, 195) down to deep pitch black rgb(15, 15, 15)
      const gray = Math.round(195 - severity * 180);
      const color = `rgb(${gray}, ${gray}, ${gray})`;
      const baseAlpha = 0.28 + severity * 0.58; // 0.28 up to 0.86
      const size = (6 + Math.random() * 3) + severity * (12 + Math.random() * 8);
      const life = 0.48 + severity * 0.62;

      this.particles.push({
        x: originX + (Math.random() - 0.5) * 6,
        y: originY + (Math.random() - 0.5) * 6,
        vx,
        vy,
        life,
        maxLife: life,
        size,
        baseAlpha,
        color,
        type: 'smoke'
      });

      // Below 10% health: also emit trailing fire and sparks
      if (hpRatio < 0.10) {
        if (Math.random() < 0.82) {
          const flameColors = ['#ffcc00', '#ff6600', '#ff2200', '#ffffff'];
          const fColor = flameColors[Math.floor(Math.random() * flameColors.length)];
          this.particles.push({
            x: originX + (Math.random() - 0.5) * 6,
            y: originY + (Math.random() - 0.5) * 6,
            vx: -cosH * (slipSpeed + 60) + (Math.random() - 0.5) * 25,
            vy: -sinH * (slipSpeed + 60) + (Math.random() - 0.5) * 25,
            life: 0.15 + Math.random() * 0.10,
            maxLife: 0.25,
            size: 5 + Math.random() * 5,
            color: fColor,
            type: 'flame'
          });
        }

        if (Math.random() < 0.35) {
          this.particles.push({
            x: originX,
            y: originY,
            vx: -cosH * 95 + (Math.random() - 0.5) * 75,
            vy: -sinH * 95 + (Math.random() - 0.5) * 75,
            life: 0.14,
            maxLife: 0.14,
            size: 2.5,
            color: '#ffee66',
            type: 'spark'
          });
        }
      }
    }
  }

  // Spawn transonic sonic boom vapor cone
  spawnSonicBoom(x, y, heading) {
    this.sonicCones.push({
      x,
      y,
      heading,
      radius: 35,
      maxRadius: 140,
      life: 0.42,
      maxLife: 0.42
    });

    // Cloud puff shock ring particles
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const speed = 70 + Math.random() * 40;
      this.particles.push({
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35,
        maxLife: 0.35,
        size: 16 + Math.random() * 12,
        color: 'rgba(235, 248, 255, 0.45)',
        type: 'smoke'
      });
    }
  }

  // Fiery Crash Explosion
  spawnExplosion(x, y) {
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 240;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.6,
        maxLife: 1.2,
        size: 18 + Math.random() * 22,
        color: Math.random() > 0.4 ? '#ff5500' : '#ffcc00',
        type: 'flame'
      });
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * (speed * 0.5),
        vy: Math.sin(angle) * (speed * 0.5),
        life: 1.2 + Math.random() * 0.8,
        maxLife: 2.0,
        size: 25 + Math.random() * 25,
        color: 'rgba(40, 40, 40, 0.75)',
        type: 'smoke'
      });
    }
  }

  // Megaton Nuclear Explosion (Cinematic non-lethal story event with atmospheric shockwave)
  spawnNukeDetonation(x, y) {
    // 1. Expanding High-Velocity Shockwaves
    for (const [dur, size, thick, color] of [
      [3.2, 3800, 14, '#ffffff'],
      [3.6, 4200, 10, '#ffeeaa'],
      [4.0, 4600, 8, '#ff9944']
    ]) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: dur,
        maxLife: dur,
        size,
        thickness: thick,
        color,
        baseAlpha: 0.95,
        type: 'shockwave'
      });
    }

    // 2. Thermonuclear Fireball Core
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 450;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 2.2 + Math.random() * 1.5,
        maxLife: 3.7,
        size: 55 + Math.random() * 95,
        color: Math.random() > 0.4 ? '#ffffff' : (Math.random() > 0.5 ? '#ffcc00' : '#ff4400'),
        type: 'flame'
      });
    }

    // 3. Dense Rising Nuclear Mushroom Cloud & Debris
    for (let i = 0; i < 110; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 220;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 140,
        y: y + (Math.random() - 0.5) * 140,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (30 + Math.random() * 60), // Upward buoyant draft
        life: 4.0 + Math.random() * 2.5,
        maxLife: 6.5,
        size: 70 + Math.random() * 120,
        color: Math.random() > 0.35 ? 'rgba(25, 25, 28, 0.82)' : 'rgba(70, 50, 40, 0.75)',
        baseAlpha: 0.85,
        type: 'smoke'
      });
    }
  }

  // Record wingtip positions for condensation vapor trails
  updateWingtipTrails(x, y, heading, flightState, pConfig, altScale = 1.0) {
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const perpX = -sinH;
    const perpY = cosH;

    const span = (pConfig.wingspan || 84) * 0.5 * altScale;
    const chord = (pConfig.wingtipChord !== undefined ? pConfig.wingtipChord : -16) * altScale;

    const leftTip = {
      x: x + cosH * chord - perpX * span,
      y: y + sinH * chord - perpY * span
    };
    const rightTip = {
      x: x + cosH * chord + perpX * span,
      y: y + sinH * chord + perpY * span
    };

    // Wingtip vortices appear during high G (> 5.0) or high alpha drift
    const active = flightState.isHighG || (flightState.alphaDeg > 15 && flightState.speed > 80);
    const opacity = active ? Math.min(0.85, (flightState.gForce - 4.0) * 0.25 + flightState.alphaDeg * 0.02) : 0;

    const now = performance.now();
    this.wingtipTrails.left.unshift({ ...leftTip, opacity, time: now });
    this.wingtipTrails.right.unshift({ ...rightTip, opacity, time: now });

    // Cull old points
    const maxTrailAge = 400; // ms
    this.wingtipTrails.left = this.wingtipTrails.left.filter(p => now - p.time < maxTrailAge);
    this.wingtipTrails.right = this.wingtipTrails.right.filter(p => now - p.time < maxTrailAge);
  }

  // Gun fire
  spawnBullet(x, y, heading, planeVx, planeVy, damage = 20, isEnemy = false) {
    const muzzleSpeed = 950;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);

    // Muzzle position slightly ahead of nose
    const bx = x + cosH * 45;
    const by = y + sinH * 45;

    // Slight tracer spread
    const spread = (Math.random() - 0.5) * (isEnemy ? 0.035 : 0.025);
    const bulletAngle = heading + spread;

    this.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(bulletAngle) * muzzleSpeed + planeVx * 0.3,
      vy: Math.sin(bulletAngle) * muzzleSpeed + planeVy * 0.3,
      life: 0.9,
      maxLife: 0.9,
      length: damage >= 30 ? 28 : 22,
      damage: damage,
      isEnemy: !!isEnemy
    });

    // Muzzle flash particle
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: bx + (Math.random() - 0.5) * 6,
        y: by + (Math.random() - 0.5) * 6,
        vx: cosH * 80 + (Math.random() - 0.5) * 40,
        vy: sinH * 80 + (Math.random() - 0.5) * 40,
        life: 0.08,
        maxLife: 0.08,
        size: 8 + Math.random() * 6,
        color: isEnemy ? '#ff7733' : '#ffea77',
        type: 'flash'
      });
    }
  }

  // CIWS 20mm Gatling Interceptor Tracers
  spawnCIWSTracers(startX, startY, targetX, targetY) {
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.hypot(targetX - startX, targetY - startY);
    const speed = 1900;
    const life = Math.min(0.55, dist / speed + 0.05);

    for (let i = 0; i < 4; i++) {
      const spread = (Math.random() - 0.5) * 0.06;
      const tAngle = angle + spread;
      this.bullets.push({
        x: startX + (Math.random() - 0.5) * 12,
        y: startY + (Math.random() - 0.5) * 12,
        vx: Math.cos(tAngle) * speed,
        vy: Math.sin(tAngle) * speed,
        life: life * (0.85 + Math.random() * 0.3),
        maxLife: life,
        length: 32,
        damage: 0,
        isCIWS: true,
        isEnemy: true
      });
    }

    // Muzzle flash on ship mount
    this.particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      life: 0.07,
      maxLife: 0.07,
      size: 14 + Math.random() * 8,
      color: '#fff3a8',
      type: 'flash'
    });
  }

  // Naval Flak AA Shells (Slow projectile detonating near player or at range)
  spawnFlakShell(startX, startY, targetX, targetY, flightState) {
    const pVx = flightState ? (flightState.vx || 0) : 0;
    const pVy = flightState ? (flightState.vy || 0) : 0;
    const rawDist = Math.hypot(targetX - startX, targetY - startY);
    const speed = 440; // Slow flak projectile
    const leadTime = Math.min(2.5, rawDist / speed);
    const leadX = targetX + pVx * leadTime * 0.65 + (Math.random() - 0.5) * 120;
    const leadY = targetY + pVy * leadTime * 0.65 + (Math.random() - 0.5) * 120;
    const angle = Math.atan2(leadY - startY, leadX - startX);
    const travelTime = Math.min(3.0, Math.hypot(leadX - startX, leadY - startY) / speed);

    this.bullets.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: travelTime,
      maxLife: travelTime,
      length: 16,
      damage: 2.5,
      isEnemy: true,
      isFlak: true
    });

    // Muzzle smoke puff
    this.particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * 40,
      vy: Math.sin(angle) * 40,
      life: 0.3,
      maxLife: 0.3,
      size: 10 + Math.random() * 6,
      color: 'rgba(200, 200, 200, 0.5)',
      type: 'smoke'
    });
  }

  // Flak Explosion Burst (Dark grey/black smoke puff with orange spark center)
  spawnFlakBurst(x, y) {
    for (let i = 0; i < 7; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 45;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.65 + Math.random() * 0.45,
        maxLife: 1.1,
        size: 16 + Math.random() * 12,
        color: Math.random() < 0.4 ? 'rgba(35, 35, 35, 0.75)' : 'rgba(65, 65, 65, 0.65)',
        type: 'smoke'
      });
    }
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.12,
      maxLife: 0.12,
      size: 16,
      color: '#ffaa33',
      type: 'flash'
    });
  }

  // Flares
  spawnFlares(x, y, heading, planeVx, planeVy) {
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const perpX = -sinH;
    const perpY = cosH;

    // Burst 4-6 flare pellets backwards and outward
    const counts = [-1, 1, -1.8, 1.8];
    for (const side of counts) {
      const ejectAngle = heading + Math.PI + side * 0.45 + (Math.random() - 0.5) * 0.3;
      const ejectSpeed = 120 + Math.random() * 60;
      this.flares.push({
        x: x - cosH * 30 + perpX * (side * 8),
        y: y - sinH * 30 + perpY * (side * 8),
        vx: Math.cos(ejectAngle) * ejectSpeed + planeVx * 0.6,
        vy: Math.sin(ejectAngle) * ejectSpeed + planeVy * 0.6,
        life: 1.8 + Math.random() * 0.8,
        maxLife: 2.4,
        fizzleTimer: 0
      });
    }
  }

  // Standard / Special Missile, Bomb, or SAM
  spawnMissile(x, y, heading, planeVx, planeVy, targetX, targetY, options = {}) {
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const offset = options.forwardOffset !== undefined ? options.forwardOffset : 25;
    const isBomb = !!options.isBomb;
    const isGuided = options.isGuided !== undefined ? options.isGuided : (isBomb ? false : true);
    // Standard missile tracking rate: 0.92 rad/s (authentic Ace Combat standard missile, tuned -20% from 1.15)
    // SAM missile tracking rate: 0.96 rad/s (tuned -20% from 1.20)
    const defaultTurnRate = isBomb ? 0 : (isGuided ? (options.isSAM ? 0.96 : 0.92) : 0);
    const turnRate = options.turnRate !== undefined ? options.turnRate : defaultTurnRate;
    const maxLife = options.life || (isBomb ? 1.4 : (options.isQAAM ? 6.0 : 4.0));

    this.missiles.push({
      x: x + cosH * offset,
      y: y + sinH * offset,
      heading: heading,
      speed: Math.hypot(planeVx, planeVy) + (options.initialBoost !== undefined ? options.initialBoost : (isBomb ? 0 : 120)),
      maxSpeed: options.maxSpeed || (isBomb ? 550 : 850),
      accel: options.accel !== undefined ? options.accel : (isBomb ? -60 : 650),
      turnRate: turnRate,
      isGuided: isGuided,
      guidanceDelay: options.guidanceDelay !== undefined ? options.guidanceDelay : (options.isEnemy ? 0.15 : (isBomb ? 999 : 0.30)),
      seekerGimbal: options.seekerGimbal !== undefined ? options.seekerGimbal : (options.isQAAM ? Math.PI : 0.82), // QAAM has full 360 gimbal for 180 loops
      target: options.target || null,
      targetX,
      targetY,
      life: maxLife,
      maxLife: maxLife,
      smokeTimer: 0,
      color: options.color || (isBomb ? '#3e4f42' : '#e8edf0'),
      isBomb,
      isSAM: !!options.isSAM,
      isQAAM: !!options.isQAAM,
      isSAAM: !!options.isSAAM,
      isMPBM: !!options.isMPBM,
      illuminated: true,
      blastRadius: options.blastRadius || (isBomb ? 280 : 0),
      isEnemy: !!options.isEnemy,
      targetsPlayer: options.targetsPlayer !== undefined ? !!options.targetsPlayer : (!!options.isEnemy && !isBomb && options.targetType !== 'ground'),
      targetType: options.targetType || (options.isEnemy ? (isBomb ? 'ground' : 'player') : 'enemy'),
      ownerId: options.ownerId || null,
      decoyed: false,
      lostLock: false,
      damage: options.damage !== undefined ? options.damage : (isBomb ? 140 : 32)
    });
  }

  update(dt) {
    // 1. Update general particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // 2. Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        if (b.isFlak) {
          this.spawnFlakBurst(b.x, b.y);
        }
        this.bullets.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.isFlak && Math.random() < 0.28) {
        this.particles.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 0.22,
          maxLife: 0.22,
          size: 4 + Math.random() * 3,
          color: 'rgba(110, 110, 110, 0.45)',
          type: 'smoke'
        });
      }
    }

    // 3. Update flares
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.flares.splice(i, 1);
        continue;
      }
      // Drag slows flares down
      f.vx *= Math.pow(0.5, dt);
      f.vy *= Math.pow(0.5, dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      // Spawn smoke / spark particles
      f.fizzleTimer += dt;
      if (f.fizzleTimer > 0.03) {
        f.fizzleTimer = 0;
        this.particles.push({
          x: f.x + (Math.random() - 0.5) * 4,
          y: f.y + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
          size: 8 + Math.random() * 8,
          color: 'rgba(230, 230, 230, 0.4)',
          type: 'smoke'
        });
        // Bright spark
        this.particles.push({
          x: f.x,
          y: f.y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          life: 0.15,
          maxLife: 0.15,
          size: 3,
          color: '#ffffff',
          type: 'spark'
        });
      }
    }

    // 4. Update missiles & bombs
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;
      if (m.life <= 0) {
        if (m.isBomb || m.isMPBM) {
          m.detonated = true; // Signal game loop to apply splash damage
        } else {
          // Self-destruct burst when missile life expires
          if (m.lostLock) {
            for (let k = 0; k < 6; k++) {
              const ang = Math.random() * Math.PI * 2;
              const sp = 40 + Math.random() * 60;
              this.particles.push({
                x: m.x,
                y: m.y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: 0.22,
                maxLife: 0.22,
                size: 6,
                color: '#ff8833',
                type: 'flame'
              });
            }
          }
          this.missiles.splice(i, 1);
          continue;
        }
      }

      // Guidance delay countdown (rail release / forward boost before seeker starts steering)
      if (m.guidanceDelay > 0) {
        m.guidanceDelay -= dt;
      }

      // Speed change
      if (m.isBomb) {
        m.speed = Math.max(140, m.speed + m.accel * dt);
      } else {
        m.speed = Math.min(m.maxSpeed, m.speed + m.accel * dt);
      }

      // Dynamic target tracking for guided missiles
      if (m.target && !m.target.isDestroyed && !m.target.isFalling) {
        m.targetX = m.target.x;
        m.targetY = m.target.y;
      } else if (m.target && (m.target.isDestroyed || m.target.isFalling)) {
        m.isGuided = false;
        m.turnRate = 0;
        m.lostLock = true;
        m.life = Math.min(m.life, 0.55);
      }

      // Guidance & first-pass loss-of-lock for enemy missiles (AI MSLs and SAMs)
      if (m.isEnemy) {
        if (!m.isGuided || m.lostLock || m.turnRate <= 0) {
          // Missile has lost lock / missed - continues flying straight ahead without turning
          m.turnRate = 0;
          m.isGuided = false;
        } else {
          // 1. Flares decoy enemy missile if targeting player
          if (m.targetsPlayer && this.flares.length > 0 && !m.decoyed) {
            for (const f of this.flares) {
              const distFlare = Math.hypot(f.x - m.x, f.y - m.y);
              if (distFlare < 1600) {
                m.decoyed = true;
                m.targetFlare = f;
                break;
              }
            }
          }
          if (m.decoyed && m.targetFlare) {
            m.targetX = m.targetFlare.x;
            m.targetY = m.targetFlare.y;
          }

          if (m.guidanceDelay === undefined || m.guidanceDelay <= 0) {
            // Active guidance towards target (player, ground target, or decoy flare)
            const dxP = m.targetX - m.x;
            const dyP = m.targetY - m.y;
            const distToTarget = Math.hypot(dxP, dyP);
            const targetAngleP = Math.atan2(dyP, dxP);
            let angleDiffP = targetAngleP - m.heading;
            while (angleDiffP > Math.PI) angleDiffP -= Math.PI * 2;
            while (angleDiffP < -Math.PI) angleDiffP += Math.PI * 2;

            const forwardDotP = (Math.cos(m.heading) * dxP + Math.sin(m.heading) * dyP) / (distToTarget || 1);
            const seekerGimbal = m.seekerGimbal || (m.isSAM ? 0.78 : 0.82);

            // 1. Loss of Lock: Target crossed beyond seeker gimbal cone (breaks lock, missile misses)
            if (!m.isQAAM && Math.abs(angleDiffP) > seekerGimbal) {
              m.turnRate = 0;
              m.isGuided = false;
              m.lostLock = true;
              m.life = Math.min(m.life, 1.2);
            }
            // 2. Loss of Lock / First Pass Overshoot: Target is behind missile or missile overshoots
            else if (!m.isQAAM && (forwardDotP < -0.05 || (distToTarget < 900 && forwardDotP < 0.15))) {
              m.turnRate = 0;
              m.isGuided = false;
              m.lostLock = true;
              m.life = Math.min(m.life, 1.2);
            }
            // 3. Decoyed by flare: passed flare
            else if (m.decoyed && (distToTarget < 350 || forwardDotP < 0)) {
              m.turnRate = 0;
              m.isGuided = false;
              m.lostLock = true;
              m.life = Math.min(m.life, 1.0);
            }
            // 4. In gimbal FOV and on initial pass: steer towards target
            else if (m.turnRate > 0) {
              const maxTurn = m.turnRate * dt;
              m.heading += Math.max(-maxTurn, Math.min(maxTurn, angleDiffP));
            }
          }
        }
      }

      // Semi-Active Air-to-Air Missile (SAAM) radar illumination check
      if (m.isSAAM) {
        if (!m.illuminated) {
          m.lostIllumTimer = (m.lostIllumTimer || 0) + dt;
          if (m.lostIllumTimer > 0.85) {
            m.lostLock = true;
            m.isGuided = false;
            m.turnRate = 0;
            m.life = Math.min(m.life, 0.55);
          }
        } else {
          m.lostIllumTimer = 0;
        }
      }

      // Seeker Guidance & Gimbal Field-of-View Limit (Player Missiles)
      if (m.isGuided && m.turnRate > 0 && m.guidanceDelay <= 0 && !m.isBomb && !m.isEnemy) {
        // Flares decoy player missiles (if enemy aircraft deployed defensive flares)
        if (this.flares.length > 0 && !m.decoyed) {
          for (const f of this.flares) {
            const distFlare = Math.hypot(f.x - m.x, f.y - m.y);
            if (distFlare < 1600) {
              m.decoyed = true;
              m.targetFlare = f;
              break;
            }
          }
        }
        if (m.decoyed && m.targetFlare) {
          m.targetX = m.targetFlare.x;
          m.targetY = m.targetFlare.y;
        }

        // For SAAM: must have active radar illumination
        const canGuide = !m.isSAAM || m.illuminated;

        if (canGuide) {
          const dx = m.targetX - m.x;
          const dy = m.targetY - m.y;
          const distToTarget = Math.hypot(dx, dy);
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - m.heading;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          const seekerGimbal = m.seekerGimbal || 0.82; // Seeker FOV gimbal limit
          const forwardDot = (Math.cos(m.heading) * dx + Math.sin(m.heading) * dy) / (distToTarget || 1);

          // 1. Loss of Lock: target crossed beyond seeker gimbal cone (all missiles EXCEPT QAAM)
          if (!m.isQAAM && Math.abs(angleDiff) > seekerGimbal) {
            m.isGuided = false;
            m.turnRate = 0;
            m.lostLock = true;
            m.life = Math.min(m.life, 1.2); // Fly off and self-destruct!
          }
          // 2. Loss of Lock / First Pass Overshoot: missile overshoots target (all missiles EXCEPT QAAM)
          else if (!m.isQAAM && (forwardDot < -0.05 || (distToTarget < 900 && forwardDot < 0.15))) {
            m.isGuided = false;
            m.turnRate = 0;
            m.lostLock = true;
            m.life = Math.min(m.life, 1.2); // Fly off and self-destruct!
          } else {
            // Steer towards target smoothly (QAAM will aggressively pull up to 180° around to re-attack)
            const maxTurn = m.turnRate * dt;
            m.heading += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
          }
        }
      }

      m.x += Math.cos(m.heading) * m.speed * dt;
      m.y += Math.sin(m.heading) * m.speed * dt;

      // Rocket motor smoke (missiles only)
      if (!m.isBomb) {
        m.smokeTimer += dt;
        if (m.smokeTimer > 0.018) {
          m.smokeTimer = 0;
          const trailX = m.x - Math.cos(m.heading) * 16;
          const trailY = m.y - Math.sin(m.heading) * 16;
          this.particles.push({
            x: trailX,
            y: trailY,
            vx: -Math.cos(m.heading) * 50 + (Math.random() - 0.5) * 20,
            vy: -Math.sin(m.heading) * 50 + (Math.random() - 0.5) * 20,
            life: 0.45,
            maxLife: 0.45,
            size: 6 + Math.random() * 4,
            color: 'rgba(240, 240, 240, 0.65)',
            type: 'smoke'
          });
          // Rocket flame
          this.particles.push({
            x: trailX,
            y: trailY,
            vx: 0,
            vy: 0,
            life: 0.08,
            maxLife: 0.08,
            size: 5,
            color: '#ff9922',
            type: 'flame'
          });
        }
      }
    }

    // 5. Update sonic boom cones
    for (let i = this.sonicCones.length - 1; i >= 0; i--) {
      const c = this.sonicCones[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.sonicCones.splice(i, 1);
        continue;
      }
      c.radius += (c.maxRadius - c.radius) * Math.min(1.0, 7.5 * dt);
    }
  }

  draw(ctx) {
    // Draw wingtip condensation vapor trails
    this.drawTrailRibbon(ctx, this.wingtipTrails.left);
    this.drawTrailRibbon(ctx, this.wingtipTrails.right);

    // Draw sonic boom vapor cones
    for (const c of this.sonicCones) {
      const alpha = Math.max(0, c.life / c.maxLife);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.heading);

      // Expanding vapor shock collar
      ctx.strokeStyle = `rgba(220, 245, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 4 * alpha;
      ctx.shadowColor = '#88eeff';
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.ellipse(0, 0, c.radius * 0.4, c.radius, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Vapor haze fill
      const grad = ctx.createRadialGradient(0, 0, c.radius * 0.15, 0, 0, c.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.4})`);
      grad.addColorStop(0.7, `rgba(180, 235, 255, ${alpha * 0.25})`);
      grad.addColorStop(1, 'rgba(180, 235, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Conical shock trailing lines
      ctx.beginPath();
      ctx.moveTo(0, -c.radius);
      ctx.lineTo(-c.radius * 0.75, -c.radius * 1.25);
      ctx.moveTo(0, c.radius);
      ctx.lineTo(-c.radius * 0.75, c.radius * 1.25);
      ctx.stroke();

      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      if (p.type === 'flame') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'glow') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.45;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * (p.baseAlpha !== undefined ? p.baseAlpha : 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.8 - alpha * 0.8), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shimmer') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'flash' || p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shockwave') {
        const progress = 1.0 - alpha;
        ctx.strokeStyle = p.color || '#ffffff';
        ctx.lineWidth = Math.max(1.5, (p.thickness || 6) * alpha);
        ctx.globalAlpha = alpha * (p.baseAlpha || 0.85);
        ctx.shadowColor = p.color || '#ffffff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw flares
    for (const f of this.flares) {
      const alpha = Math.min(1.0, f.life / 0.5);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 15;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw bullets (tracers)
    for (const b of this.bullets) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed < 1) continue;
      const dirX = b.vx / speed;
      const dirY = b.vy / speed;

      ctx.save();
      if (b.isCIWS) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#ffffaa';
        ctx.shadowBlur = 9;
      } else if (b.isFlak) {
        ctx.strokeStyle = '#ff7722';
        ctx.lineWidth = 3.2;
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 8;
      } else {
        const isHeavy = (b.damage || 20) >= 30;
        ctx.strokeStyle = b.isEnemy ? '#ff5522' : (isHeavy ? '#ffea44' : '#ffee77');
        ctx.lineWidth = isHeavy ? 3.0 : (b.isEnemy ? 2.5 : 2.2);
        ctx.shadowColor = b.isEnemy ? '#ff2200' : (isHeavy ? '#ff6600' : '#ffaa00');
        ctx.shadowBlur = isHeavy || b.isEnemy ? 8 : 5;
      }
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - dirX * b.length, b.y - dirY * b.length);
      ctx.stroke();
      ctx.restore();
    }

    // Draw missiles and bombs
    for (const m of this.missiles) {
      if (m.isBomb) {
        const alt = Math.max(0, m.life / (m.maxLife || 1.4));
        const shadowDist = 45 * alt;

        // Ground shadow beneath falling bomb
        ctx.save();
        ctx.translate(m.x + shadowDist * 0.6, m.y + shadowDist * 0.8);
        ctx.rotate(m.heading);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11 * (0.8 + 0.2 * (1 - alt)), 4 * (0.8 + 0.2 * (1 - alt)), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Bomb body (shrinks slightly as it falls towards the sea/ground)
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.heading);
        const bScale = 0.78 + 0.32 * alt;
        ctx.scale(bScale, bScale);
        ctx.fillStyle = m.color || '#3e4f42';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tail cruciform fins
        ctx.fillStyle = '#1c2820';
        ctx.fillRect(-15, -7.5, 5.5, 15);
        ctx.restore();
      } else {
        // Missile body
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.heading);
        ctx.fillStyle = m.color || '#e8edf0';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-10, -3);
        ctx.lineTo(-10, 3);
        ctx.closePath();
        ctx.fill();

        // Fins
        ctx.fillStyle = '#445566';
        ctx.fillRect(-10, -6, 4, 12);
        ctx.restore();
      }
    }
  }

  drawTrailRibbon(ctx, points) {
    if (points.length < 2) return;
    ctx.save();
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const avgOpacity = (p1.opacity + p2.opacity) * 0.5;
      if (avgOpacity <= 0.02) continue;

      ctx.strokeStyle = `rgba(235, 245, 255, ${avgOpacity * 0.55})`;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

