// Ace Combat Authentic Tactical Flight HUD with Styled Minimal Instrument Console & Circular Radar

import { getTargetStealth } from './aircraft.js';

export class FlightHUD {
  constructor() {
    this.hudColor = '#00ff66';
    this.hudGlow = 'rgba(0, 255, 102, 0.45)';
    this.warnColor = '#ff3b30';
    this.amberColor = '#ffcc00';
    this.iceBlue = '#8ec5ff';
    this.iceBlueText = '#a6d5ff';
    this.limeGreen = '#b8fca8';
    this.limeText = '#d8ffb8';
    this.sweepAngle = 0;
  }

  draw(ctx, flightState, aircraftConfig, input, camera, canvasWidth, canvasHeight, weapons, world, particles, boundaryState = null, targeting = null, targetManager = null, missionManager = null, abilityState = null) {
    ctx.save();

    this.camera = camera;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    const sensorFusionActive = !!(abilityState && abilityState.active && abilityState.id === 'sensorFusion');
    const centerX = canvasWidth * 0.5;
    const centerY = canvasHeight * 0.5;

    // Aircraft screen position based on camera pan and zoom
    const planeScreenX = (flightState.x - camera.x) * camera.zoom + centerX;
    const planeScreenY = (flightState.y - camera.y) * camera.zoom + centerY;

    // HUD Base Style
    ctx.strokeStyle = this.hudColor;
    ctx.fillStyle = this.hudColor;
    ctx.shadowColor = this.hudGlow;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;

    // 1. Center Flight Reticles
    this.drawBoresight(ctx, planeScreenX, planeScreenY, flightState.heading);
    this.drawFlightPathMarker(ctx, planeScreenX, planeScreenY, flightState);
    this.drawAimReticle(ctx, input.rawMouseX, input.rawMouseY, flightState, weapons, camera, targeting, input, particles);

    // Unguided Bomb CCIP (Continuously Computed Impact Point) Reticle & Projected Splash Ring
    const targets = targetManager ? targetManager.targets : null;
    if (weapons && weapons.selectedWeapon === 'spw' && (weapons.equippedSpwId === 'ugb' || weapons.equippedSpwId === 'sffs')) {
      this.drawBombCCIP(ctx, flightState, camera, canvasWidth, canvasHeight, weapons, targets);
    }

    // 2. Tactical World Targets & Seeker Lock Reticles
    this.drawTacticalTargets(ctx, targets, targeting, camera, canvasWidth, canvasHeight, flightState.x, flightState.y, flightState.heading, weapons, input, sensorFusionActive);

    // 3. Tactical Center Warnings: HIGH-G, DRIFT, STALL, AO BOUNDARY, MISSILE INBOUND
    this.drawTacticalWarnings(ctx, centerX, centerY - 150, flightState, aircraftConfig, boundaryState, targeting, missionManager);

    // 4. Target Destruction Kill Confirmations
    if (targetManager && targetManager.destroyedNotifications && targetManager.destroyedNotifications.length > 0) {
      let notifY = 95;
      for (const n of targetManager.destroyedNotifications) {
        ctx.save();
        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#ffff44';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 12;
        ctx.textAlign = 'center';
        const cleanNotif = (n.text || '').trim().replace(/^<<\s*/, '').replace(/\s*>>$/, '');
        ctx.fillText(`<< ${cleanNotif} >>`, centerX, notifY);
        ctx.restore();
        notifY += 22;
      }
    }

    // 4B. Mission Story & Tactical Radio Messages
    if (missionManager && missionManager.radioMessages && missionManager.radioMessages.length > 0) {
      let radioY = 125;
      for (const m of missionManager.radioMessages) {
        if (!m || !m.text || m.life <= 0) continue;
        const alpha = Math.min(1.0, m.life);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "bold 15px 'Share Tech Mono', 'Courier New', monospace";
        ctx.fillStyle = '#00ffee';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.textAlign = 'center';
        const cleanRadio = (m.text || '').trim().replace(/^<<\s*/, '').replace(/\s*>>$/, '');
        ctx.fillText(`<< ${cleanRadio} >>`, centerX, radioY);
        ctx.restore();
        radioY += 24;
      }
    }

    // 5. Top Left: Aircraft Info & 4 Stats (Removed per test flight HUD cleanup)
    // this.drawAircraftStatsCard(ctx, 24, 35, aircraftConfig, flightState, weapons);

    // 6. Top Center: Heading Compass Tape (with dynamic mission header & mode)
    this.drawCompassTape(ctx, centerX, 30, flightState.heading, missionManager);

    // 7. Bottom-Left: 75% Scale Flight Telemetry & Weapons HUD Console (Perfect Ergonomic Scale)
    const consoleX = 35;
    const consoleY = canvasHeight - 225;
    this.drawCustomFlightConsole(ctx, consoleX, consoleY, flightState, aircraftConfig, weapons, boundaryState, abilityState);

    // 8. Bottom-Right: 75% Scale Authentic Ace Combat Square Radar / Minimap (Expanded on [HOLD Z])
    const isExpanded = !!(input && input.z);
    const radarHalfSize = isExpanded ? 198 : 132;
    const radarX = canvasWidth - radarHalfSize - 35;
    const radarY = canvasHeight - 42 - radarHalfSize;
    const returnLine = missionManager && missionManager.getReturnLine ? missionManager.getReturnLine() : null;
    this.drawRadarMinimap(ctx, radarX, radarY, radarHalfSize, flightState, world, particles, isExpanded, boundaryState, targets, targeting, returnLine, camera, canvasWidth, canvasHeight, sensorFusionActive);

    // 9. Singleplayer Mission Dialogue Transmission (Top-Right Animated Portrait & Speech Bubble)
    if (missionManager && missionManager.activeDialogue) {
      this.drawDialogueTransmission(ctx, canvasWidth, canvasHeight, missionManager.activeDialogue);
    }

    // 10. Megaton Nuclear Detonation Blinding Flash
    if (missionManager && missionManager.nukeState && missionManager.nukeState.timer > 0) {
      this.drawNukeFlash(ctx, canvasWidth, canvasHeight, missionManager.nukeState);
    }

    // 11. Cinematic Sector Fade Transition (Fade to black while loading/unloading units)
    if (missionManager && missionManager.fadeTransition) {
      this.drawFadeTransition(ctx, canvasWidth, canvasHeight, missionManager.fadeTransition);
    }

    // 12. Mission Completion / Failure / Scripted End Tactical Banner
    if (missionManager && (missionManager.isCompleted || missionManager.isFailed)) {
      this.drawMissionStatusBanner(ctx, canvasWidth, canvasHeight, missionManager);
    }

    ctx.restore();
  }

  // Boresight Crosshair (fixed ahead of aircraft nose)
  drawBoresight(ctx, px, py, heading) {
    const dist = 65;
    const bx = px + Math.cos(heading) * dist;
    const by = py + Math.sin(heading) * dist;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(heading);

    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.moveTo(-10, 0);
    ctx.lineTo(-4, 0);
    ctx.moveTo(4, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, -3);
    ctx.stroke();

    ctx.restore();
  }

  // Flight Path Marker (FPM) - Velocity Vector
  drawFlightPathMarker(ctx, px, py, flightState) {
    const dist = 95;
    const fpmX = px + Math.cos(flightState.flightPathAngle) * dist;
    const fpmY = py + Math.sin(flightState.flightPathAngle) * dist;

    ctx.save();
    ctx.translate(fpmX, fpmY);

    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, -14);
    ctx.moveTo(-7, 0);
    ctx.lineTo(-16, 0);
    ctx.moveTo(7, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();

    if (flightState.alphaDeg > 8) {
      ctx.font = '10px monospace';
      ctx.fillStyle = flightState.isDrifting ? this.amberColor : this.hudColor;
      ctx.fillText(`α ${flightState.alphaDeg.toFixed(1)}°`, 12, 12);
    }

    ctx.restore();
  }

  // Mouse Aim Reticle (Standard Crosshair or Expanded SAAM Boresight Illumination Area)
  drawAimReticle(ctx, mx, my, flightState, weapons = null, camera = null, targeting = null, input = null, particles = null) {
    ctx.save();
    ctx.translate(mx, my);

    const isSAAMEquipped = weapons && (weapons.equippedSpwId === 'saam' && weapons.selectedWeapon === 'spw');
    const hasActiveSAAM = particles && particles.missiles && particles.missiles.some(m => m.isSAAM && !m.isEnemy);
    const isSAAM = isSAAMEquipped || hasActiveSAAM;

    if (isSAAM) {
      // SAAM Boresight Guidance Area: exactly 340m world radius scaled to current camera zoom
      const zoom = (camera && camera.zoom) ? camera.zoom : 0.65;
      const r = 340 * zoom;

      // Check illumination state on designated target
      let isIlluminated = false;
      let targetInCone = false;
      let targetInCircle = false;
      const tgt = targeting ? targeting.designatedTarget : null;

      if (tgt && !tgt.isDestroyed && !tgt.isFalling && tgt.type === 'air') {
        const cursorDist = input ? Math.hypot((input.targetWorldX || 0) - tgt.x, (input.targetWorldY || 0) - tgt.y) : 0;
        const dx = tgt.x - flightState.x;
        const dy = tgt.y - flightState.y;
        const bearing = Math.atan2(dy, dx);
        let angleDiff = bearing - flightState.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        targetInCone = Math.abs(angleDiff) <= 0.85;
        targetInCircle = cursorDist <= 340;
        isIlluminated = targetInCircle && targetInCone;
      }

      // Dynamic color coding based on guidance status
      let retColor = '#00ffff';
      let glowColor = 'rgba(0, 255, 255, 0.45)';
      let fillAlpha = 0.035;

      if (hasActiveSAAM) {
        if (isIlluminated) {
          retColor = '#00ffff';
          glowColor = 'rgba(0, 255, 255, 0.65)';
          fillAlpha = 0.07;
        } else {
          retColor = '#ff9900';
          glowColor = 'rgba(255, 153, 0, 0.65)';
          fillAlpha = 0.05;
        }
      } else if (isIlluminated) {
        retColor = '#00ffff';
        glowColor = 'rgba(0, 255, 255, 0.5)';
        fillAlpha = 0.05;
      } else {
        retColor = 'rgba(0, 230, 255, 0.75)';
        glowColor = 'rgba(0, 230, 255, 0.3)';
        fillAlpha = 0.025;
      }

      // 1. Subtle illuminated radar wash fill
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = isIlluminated ? 'rgba(0, 255, 255, 0.055)' : (hasActiveSAAM ? 'rgba(255, 153, 0, 0.04)' : 'rgba(0, 230, 255, 0.025)');
      ctx.fill();

      // 2. Large Outer Boresight Guidance Ring (showing exact 340m area)
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = retColor;
      ctx.lineWidth = isIlluminated ? 2.0 : 1.6;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isIlluminated ? 12 : 6;
      ctx.setLineDash([12, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Inward Cardinal Tick Marks
      const tickLen = 14;
      ctx.beginPath();
      ctx.moveTo(-r, 0); ctx.lineTo(-r + tickLen, 0);
      ctx.moveTo(r, 0); ctx.lineTo(r - tickLen, 0);
      ctx.moveTo(0, -r); ctx.lineTo(0, -r + tickLen);
      ctx.moveTo(0, r); ctx.lineTo(0, r - tickLen);
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // 4. Corner Quadrant Brackets on Circumference
      const cornerAngleOffset = 0.07;
      const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      ctx.beginPath();
      for (const ang of angles) {
        ctx.arc(0, 0, r, ang - cornerAngleOffset, ang + cornerAngleOffset);
      }
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 5. Tactical Status Telemetry on Ring
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = retColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;

      let topText = 'SAAM BORESIGHT // 340M';
      if (hasActiveSAAM) {
        topText = isIlluminated ? '<< SAAM ILLUMINATING >>' : '<< OFF-BORESIGHT // RE-ACQUIRE >>';
      } else if (isIlluminated) {
        topText = '<< SAAM RADAR LOCK READY >>';
      } else if (targetInCircle && !targetInCone) {
        topText = '<< GIMBAL LIMIT // NOSE AWAY >>';
      }

      ctx.fillText(topText, 0, -r - 12);

      if (hasActiveSAAM) {
        ctx.font = 'bold 9px monospace';
        ctx.fillText('KEEP TARGET IN CIRCLE UNTIL IMPACT', 0, r + 20);
      }
    }

    // Center Aim Pipper & Crosshairs (for precise flight & gun aiming)
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.strokeStyle = isSAAM ? 'rgba(0, 255, 230, 0.75)' : 'rgba(0, 255, 102, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.shadowBlur = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-18, 0); ctx.lineTo(-10, 0);
    ctx.moveTo(10, 0); ctx.lineTo(18, 0);
    ctx.moveTo(0, -18); ctx.lineTo(0, -10);
    ctx.moveTo(0, 10); ctx.lineTo(0, 18);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = isSAAM ? '#00ffff' : this.hudColor;
    ctx.fill();

    ctx.restore();
  }

  // Tactical Center Warnings
  drawTacticalWarnings(ctx, cx, cy, flightState, aircraftConfig, boundaryState, targeting, missionManager = null) {
    ctx.save();
    ctx.textAlign = 'center';

    if (flightState.isCrashed || (boundaryState && boundaryState.isCrashed)) {
      ctx.fillStyle = '#ff1100';
      ctx.font = 'bold 22px monospace';
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 16;
      if (boundaryState && boundaryState.crashReason === 'OUT_OF_BOUNDS') {
        ctx.fillText('<< CRITICAL FAILURE // LEFT AREA OF OPERATION >>', cx, cy - 10);
      } else if (boundaryState && boundaryState.crashReason === 'DOGFIGHT_GUN_KILL') {
        ctx.fillText('<< CRITICAL LOSS // SHOT DOWN BY ENEMY GUN FIRE >>', cx, cy - 10);
      } else if (boundaryState && boundaryState.crashReason === 'DOGFIGHT_KILL') {
        ctx.fillText('<< CRITICAL LOSS // SHOT DOWN IN DOGFIGHT >>', cx, cy - 10);
      } else if (boundaryState && boundaryState.crashReason === 'SAM_KILL') {
        ctx.fillText('<< CRITICAL LOSS // SHOT DOWN BY SAM >>', cx, cy - 10);
      } else {
        ctx.fillText('<< CRITICAL LOSS // STALL SPIN CRASH >>', cx, cy - 10);
      }
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      if (missionManager && (missionManager.noRespawn || (missionManager.loseConditions && missionManager.loseConditions.noRespawn))) {
        ctx.fillText('MISSION FAILED // NO RESPAWN AUTHORIZED [ESC TO RESTART]', cx, cy + 20);
      } else {
        ctx.fillText('RESTORING AIRCRAFT AIRFRAME...', cx, cy + 20);
      }
      ctx.restore();
      return;
    }

    if (boundaryState && boundaryState.isDying) {
      const blink = Math.floor(performance.now() / 110) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2200' : '#ffff00';
      ctx.font = 'bold 22px monospace';
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 18;
      ctx.fillText('<< CRITICAL DAMAGE // AIRFRAME LOST >>', cx, cy - 10);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('HYDRAULIC FAILURE // IMPACT IMMINENT', cx, cy + 18);
      ctx.restore();
      return;
    }

    // Determine active alert states
    const isMissile = !!(targeting && targeting.missileInbound);
    const isRearmed = !!(boundaryState && boundaryState.returnLineRearmedNotice > 0);
    const isNearReturnLine = !isRearmed && !!(boundaryState && boundaryState.isNearReturnLine);
    const isOutOfBounds = !isRearmed && !isNearReturnLine && !!(boundaryState && boundaryState.isOutOfBounds);
    const isNearBorder = !isRearmed && !isNearReturnLine && !isOutOfBounds && !!(boundaryState && boundaryState.isNearBorder);
    const hasBoundaryAlert = isRearmed || isNearReturnLine || isOutOfBounds || isNearBorder;
    const isStalled = !!flightState.isStalled;

    // Calculate vertical layout anchors to prevent collisions when multiple warnings are active
    let boundaryY = cy;
    let stallY = cy;
    let missileY = cy - 20;

    if (hasBoundaryAlert && isStalled) {
      boundaryY = cy - 38;
      stallY = cy + 28;
      missileY = cy - 86;
    } else if (hasBoundaryAlert) {
      boundaryY = cy;
      missileY = cy - 54;
    } else if (isStalled) {
      stallY = cy;
      missileY = cy - 54;
    }

    // 1. Incoming Missile Alert
    if (isMissile) {
      const blink = Math.floor(performance.now() / 120) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2200' : '#ffff00';
      ctx.font = 'bold 22px monospace';
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 18;
      ctx.fillText('<< WARNING: MISSILE INBOUND >>', cx, missileY);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('HIT [S] TO DEPLOY FLARES // BREAK HIGH-G', cx, missileY + 22);
    }

    // 2. Boundary / Return Line / Area of Operation Alert
    if (isRearmed) {
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 22px monospace';
      ctx.shadowColor = '#00bbff';
      ctx.shadowBlur = 18;
      ctx.fillText('<< AIRCRAFT FULLY REARMED >>', cx, boundaryY - 14);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('RETURNING TO COMBAT AIRSPACE', cx, boundaryY + 12);
    } else if (isNearReturnLine) {
      const blink = Math.floor(performance.now() / 200) % 2 === 0;
      ctx.fillStyle = blink ? '#00f0ff' : '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.shadowColor = '#00bbff';
      ctx.shadowBlur = 14;
      ctx.fillText('<< APPROACHING RETURN LINE >>', cx, boundaryY - 14);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#8ec5ff';
      ctx.fillText('CROSS BLUE LINE TO FULLY REARM WEAPONS', cx, boundaryY + 12);
    } else if (isOutOfBounds) {
      const blink = Math.floor(performance.now() / 140) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2200' : '#ffff00';
      ctx.font = 'bold 22px monospace';
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 18;
      ctx.fillText('<< OUT OF AREA OF OPERATION >>', cx, boundaryY - 18);

      const remaining = Math.max(0, 3.0 - (boundaryState.boundaryTimer || 0));
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`AIRFRAME DESTRUCTION IN: ${remaining.toFixed(1)}s // TURN BACK NOW`, cx, boundaryY + 8);

      const barW = 260;
      const barH = 7;
      ctx.strokeStyle = '#ff2200';
      ctx.strokeRect(cx - barW * 0.5, boundaryY + 18, barW, barH);
      ctx.fillStyle = '#ff2200';
      ctx.fillRect(cx - barW * 0.5, boundaryY + 18, ((boundaryState.boundaryTimer || 0) / 3.0) * barW, barH);
    } else if (isNearBorder) {
      const blink = Math.floor(performance.now() / 240) % 2 === 0;
      ctx.fillStyle = blink ? '#ff9900' : '#ffff44';
      ctx.font = 'bold 20px monospace';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 14;
      ctx.fillText('<< EXITING AREA OF OPERATION // TURN BACK NOW >>', cx, boundaryY - 10);
    }

    // 3. Flight Dynamics: Stall / PSM Warning
    if (isStalled) {
      const hasTVC = aircraftConfig && aircraftConfig.physics && aircraftConfig.physics.hasThrustVectoring;
      const blink = Math.floor(performance.now() / 200) % 2 === 0;
      ctx.fillStyle = blink ? (hasTVC ? '#00ffee' : '#ff2200') : '#ffaa00';
      ctx.font = 'bold 20px monospace';
      ctx.shadowColor = hasTVC ? '#00ffee' : '#ff2200';
      ctx.shadowBlur = 14;
      const warningTitle = hasTVC
        ? '<< STALL WARNING // PSM ACTIVE >>'
        : '<< STALL WARNING >>';
      ctx.fillText(warningTitle, cx, stallY - 15);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      const remaining = Math.max(0, 4.0 - flightState.stallTimer);
      const subTitle = hasTVC
        ? `FULL NOSE CONTROL RETAINED // SPINDOWN CRASH IN: ${remaining.toFixed(1)}s`
        : `HIT AFTERBURNER [SHIFT] TO RECOVER // CRASH IN: ${remaining.toFixed(1)}s`;
      ctx.fillText(subTitle, cx, stallY + 10);

      const barW = 240;
      const barH = 6;
      ctx.strokeStyle = hasTVC ? '#00ffee' : '#ff2200';
      ctx.strokeRect(cx - barW * 0.5, stallY + 20, barW, barH);
      ctx.fillStyle = hasTVC ? '#00ffee' : '#ff2200';
      ctx.fillRect(cx - barW * 0.5, stallY + 20, (flightState.stallTimer / 4.0) * barW, barH);
    } else if (!hasBoundaryAlert) {
      // High-G or High-Alpha Drift alerts (only if not stalled and no boundary alert)
      if (flightState.isHighG) {
        ctx.fillStyle = this.warnColor;
        ctx.font = 'bold 15px monospace';
        ctx.fillText('<< HIGH G TURN >>', cx, cy);
      } else if (flightState.isDrifting) {
        ctx.fillStyle = this.amberColor;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`<< HIGH ALPHA DRIFT [${flightState.alphaDeg.toFixed(0)}°] >>`, cx, cy);
      }
    }

    ctx.restore();
  }

  // CCIP (Continuously Computed Impact Point) Reticle for Unguided Bombs (UGB / SFFS)
  drawBombCCIP(ctx, flightState, camera, canvasWidth, canvasHeight, weapons, targets) {
    const centerX = canvasWidth * 0.5;
    const centerY = canvasHeight * 0.5;

    // Time of flight: 1.4s ballistic fall
    const timeToImpact = 1.4;
    const impactWorldX = flightState.x + flightState.vx * timeToImpact;
    const impactWorldY = flightState.y + flightState.vy * timeToImpact;

    // Project to screen coordinates
    const planeScreenX = (flightState.x - camera.x) * camera.zoom + centerX;
    const planeScreenY = (flightState.y - camera.y) * camera.zoom + centerY;
    const impScreenX = (impactWorldX - camera.x) * camera.zoom + centerX;
    const impScreenY = (impactWorldY - camera.y) * camera.zoom + centerY;

    const blastRadiusMeters = weapons.equippedSpwId === 'sffs' ? 160 : (weapons.equippedSpwId === 'mpbm' ? 380 : 140);
    const screenBlastRadius = blastRadiusMeters * camera.zoom;

    // Check if any target is within blast radius
    let targetInBlast = false;
    if (targets) {
      for (const tgt of targets) {
        if (tgt.isDestroyed || tgt.type === 'air') continue;
        const d = Math.hypot(tgt.x - impactWorldX, tgt.y - impactWorldY);
        if (d <= blastRadiusMeters + tgt.hitRadius) {
          targetInBlast = true;
          break;
        }
      }
    }

    ctx.save();

    // 1. Dotted Bomb Fall Line from plane to CCIP reticle
    ctx.strokeStyle = targetInBlast ? '#ff3b30' : 'rgba(255, 204, 0, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(planeScreenX, planeScreenY);
    ctx.lineTo(impScreenX, impScreenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Reticle at projected impact location
    ctx.translate(impScreenX, impScreenY);

    // Outer Blast Radius Indicator Circle (semi-transparent filled blast zone)
    ctx.strokeStyle = targetInBlast ? '#ff3b30' : 'rgba(255, 170, 0, 0.5)';
    ctx.fillStyle = targetInBlast ? 'rgba(255, 59, 48, 0.18)' : 'rgba(255, 170, 0, 0.08)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(16, screenBlastRadius), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center Crosshair Pipper
    const retColor = targetInBlast ? '#ff2200' : '#ffcc00';
    ctx.strokeStyle = retColor;
    ctx.fillStyle = retColor;
    ctx.shadowColor = retColor;
    ctx.shadowBlur = targetInBlast ? 14 : 7;
    ctx.lineWidth = 2.0;

    // Inner reticle ring
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(-10, 0);
    ctx.moveTo(10, 0); ctx.lineTo(16, 0);
    ctx.moveTo(0, -16); ctx.lineTo(0, -10);
    ctx.moveTo(0, 10); ctx.lineTo(0, 16);
    ctx.stroke();

    // Digital CCIP Range & Status Label
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const distToImpact = Math.round(Math.hypot(impactWorldX - flightState.x, impactWorldY - flightState.y));
    const title = targetInBlast
      ? `<< CCIP [${weapons.spwCode}] // TARGET IN BLAST >>`
      : `CCIP [${weapons.spwCode}] ${distToImpact}M`;
    ctx.fillText(title, 0, Math.max(24, screenBlastRadius + 14));

    ctx.restore();
  }

  // Tactical Practice Targets & Seeker Lock Reticle System
  drawTacticalTargets(ctx, targets, targeting, camera, canvasWidth, canvasHeight, playerX, playerY, playerHeading, weapons = null, input = null, sensorFusionActive = false) {
    if (!targets) return;
    const centerX = canvasWidth * 0.5;
    const centerY = canvasHeight * 0.5;

    for (const tgt of targets) {
      if (tgt.isDestroyed || tgt.isFalling) continue;

      const screenX = (tgt.x - camera.x) * camera.zoom + centerX;
      const screenY = (tgt.y - camera.y) * camera.zoom + centerY;
      const dist = Math.hypot(tgt.x - playerX, tgt.y - playerY);
      const isDesignated = targeting && targeting.designatedTarget && targeting.designatedTarget.id === tgt.id;
      const isMultiLocked = (weapons && weapons.selectedWeapon === 'spw') && !isDesignated && targeting && targeting.multiLockedTargets && targeting.multiLockedTargets.some(m => m && m.id === tgt.id);
      const isLocked = (isDesignated || isMultiLocked) && targeting.lockState === 'LOCKED';
      const isTracking = isDesignated && targeting.lockState === 'TRACKING';

      const margin = 35;
      const onScreen = screenX >= margin && screenX <= canvasWidth - margin && screenY >= margin && screenY <= canvasHeight - margin;

      if (onScreen) {
        ctx.save();
        ctx.translate(screenX, screenY);

        // Locked targets are RED (#ff2200). Untargeted/unlocked targets are GREEN (rgba(0, 255, 102)) like in Ace Combat
        const color = isLocked ? '#ff2200' : isTracking ? '#ffaa00' : isDesignated ? '#00ffee' : 'rgba(0, 255, 102, 0.75)';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isLocked ? 14 : isDesignated ? 10 : 4;
        ctx.lineWidth = isLocked ? 2.5 : 1.5;

        // Shape based on combat target type
        const size = 16;
        if (tgt.type === 'air') {
          // Diamond reticle for enemy aircraft
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(size, 0);
          ctx.lineTo(0, size);
          ctx.lineTo(-size, 0);
          ctx.closePath();
          ctx.stroke();
        } else if (tgt.type === 'naval') {
          // Wide naval box
          ctx.strokeRect(-size * 1.3, -size * 0.8, size * 2.6, size * 1.6);
        } else {
          // Square box for SAM / ground
          ctx.strokeRect(-size, -size, size * 2, size * 2);
        }

        // Secondary Multi-Locked Targets [ 4AAM / Multi-Lock ]
        if (isMultiLocked) {
          const bSize = size + 6;
          const multiColor = isLocked ? '#ff2200' : '#00ffee';
          ctx.strokeStyle = multiColor;
          ctx.fillStyle = multiColor;
          ctx.shadowColor = multiColor;
          ctx.shadowBlur = isLocked ? 14 : 8;
          ctx.lineWidth = isLocked ? 2.5 : 2.0;
          ctx.beginPath();
          // Top-left
          ctx.moveTo(-bSize, -bSize + 8); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize + 8, -bSize);
          // Top-right
          ctx.moveTo(bSize - 8, -bSize); ctx.lineTo(bSize, -bSize); ctx.lineTo(bSize, -bSize + 8);
          // Bottom-left
          ctx.moveTo(-bSize, bSize - 8); ctx.lineTo(-bSize, bSize); ctx.lineTo(-bSize + 8, bSize);
          // Bottom-right
          ctx.moveTo(bSize - 8, bSize); ctx.lineTo(bSize, bSize); ctx.lineTo(bSize, bSize - 8);
          ctx.stroke();

          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`<< ${weapons && weapons.spwCode ? weapons.spwCode : '4AAM'} >>`, 0, -bSize - 8);
        }

        // Designated Seeker Brackets [  ]
        if (isDesignated) {
          const bSize = size + (isTracking ? Math.max(6, 14 - (targeting.lockTimer || 0) * 16) : 8);
          ctx.lineWidth = isLocked ? 2.8 : 2.0;
          ctx.beginPath();
          // Top-left
          ctx.moveTo(-bSize, -bSize + 8); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize + 8, -bSize);
          // Top-right
          ctx.moveTo(bSize - 8, -bSize); ctx.lineTo(bSize, -bSize); ctx.lineTo(bSize, -bSize + 8);
          // Bottom-left
          ctx.moveTo(-bSize, bSize - 8); ctx.lineTo(-bSize, bSize); ctx.lineTo(-bSize + 8, bSize);
          // Bottom-right
          ctx.moveTo(bSize - 8, bSize); ctx.lineTo(bSize, bSize); ctx.lineTo(bSize, bSize - 8);
          ctx.stroke();

          // Seeking / Locked Text & Reticle
          if (isLocked) {
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = '#ff2200';
            ctx.textAlign = 'center';

            // Check if equipped SPW can lock this target
            const spwId = weapons ? weapons.equippedSpwId : null;
            const isAAM = ['4aam', 'qaam', 'saam', 'hpaa'].includes(spwId);
            const isASM = ['lasm'].includes(spwId);

            if (isAAM && tgt.type !== 'air') {
              ctx.fillText('<< LOCK [MSL ONLY] >>', 0, -bSize - 10);
              ctx.font = 'bold 9px monospace';
              ctx.fillStyle = '#ffaa00';
              ctx.fillText('SPW: AIR-TARGET ONLY', 0, -bSize - 22);
            } else if (isASM && tgt.type === 'air') {
              ctx.fillText('<< LOCK [MSL ONLY] >>', 0, -bSize - 10);
              ctx.font = 'bold 9px monospace';
              ctx.fillStyle = '#ffaa00';
              ctx.fillText('SPW: SURFACE ONLY', 0, -bSize - 22);
            } else {
              ctx.fillText('<< LOCK >>', 0, -bSize - 12);
            }

            // SAAM Boresight Guidance Tracker
            if (spwId === 'saam' && tgt.type === 'air') {
              const cursorDist = input ? Math.hypot((input.targetWorldX || 0) - tgt.x, (input.targetWorldY || 0) - tgt.y) : 0;
              const dx = tgt.x - playerX;
              const dy = tgt.y - playerY;
              const bearing = Math.atan2(dy, dx);
              let angleDiff = bearing - playerHeading;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              const isIlluminated = (cursorDist <= 340) && (Math.abs(angleDiff) <= 0.85);

              ctx.save();
              const col = isIlluminated ? '#00ffff' : '#ff9900';
              ctx.strokeStyle = col;
              ctx.lineWidth = 1.6;
              const dSize = bSize + 5;
              ctx.beginPath();
              ctx.moveTo(-dSize, 0); ctx.lineTo(0, -dSize); ctx.lineTo(dSize, 0); ctx.lineTo(0, dSize); ctx.closePath();
              ctx.stroke();

              ctx.font = 'bold 9px monospace';
              ctx.fillStyle = col;
              ctx.fillText(isIlluminated ? 'SAAM: ILLUMINATED' : 'SAAM: OFF-BORESIGHT', 0, bSize + 22);
              ctx.restore();
            }
          } else if (isTracking) {
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = '#ffaa00';
            ctx.textAlign = 'center';
            ctx.fillText('ACQUIRING...', 0, -bSize - 12);

            // Dotted seeker circle closing in
            const ringR = Math.max(size + 2, 38 * (1.0 - ((targeting.lockTimer || 0) / (targeting.lockTimeRequired || 0.5)) * 0.5));
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Mini Health Bar
        const hpRatio = Math.max(0, tgt.hp / tgt.maxHp);
        const hpBarW = 32;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(-hpBarW * 0.5, size + 5, hpBarW, 4);
        const tgtBarColor = hpRatio < 0.20 ? '#ff2222' : (hpRatio < 0.60 ? '#ffcc00' : (isLocked ? '#ff2200' : '#00ff66'));
        ctx.fillStyle = tgtBarColor;
        ctx.fillRect(-hpBarW * 0.5, size + 5, hpBarW * hpRatio, 4);

        // Target Tag & Distance Label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(`${tgt.name.toUpperCase()} [${(dist / 1000).toFixed(1)}KM]`, 0, size + 19);

        ctx.restore();
      } else {
        const stealth = getTargetStealth(tgt);
        // Untargeted stealth planes (or planes beyond radar range) do not display off-screen HUD chevrons
        if (!isDesignated) {
          if ((!sensorFusionActive && stealth >= 3) || !this.isTargetVisibleOnRadar(tgt, { x: playerX, y: playerY }, null, camera, canvasWidth, canvasHeight, sensorFusionActive)) {
            continue;
          }
        }

        // Off-screen indicator chevron pointing towards target
        const angleToTgt = Math.atan2(screenY - centerY, screenX - centerX);
        const edgeDistX = centerX - 45;
        const edgeDistY = centerY - 45;
        const edgeX = centerX + Math.cos(angleToTgt) * edgeDistX;
        const edgeY = centerY + Math.sin(angleToTgt) * edgeDistY;

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angleToTgt);

        const isMultiLocked = targeting && targeting.multiLockedTargets && targeting.multiLockedTargets.some(m => m && m.id === tgt.id);
        const isLocked = (isDesignated || isMultiLocked) && targeting.lockState === 'LOCKED';
        const color = isLocked ? '#ff2200' : isDesignated ? '#00ffee' : 'rgba(0, 255, 102, 0.75)';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }
  }

  // Top Left: Aircraft Info & 4 Stats + Loadout Options
  drawAircraftStatsCard(ctx, x, y, aircraftConfig, flightState, weapons) {
    ctx.save();

    ctx.fillStyle = this.hudColor;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(aircraftConfig.name.toUpperCase(), x, y);

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0, 255, 102, 0.7)';
    const roleTag = aircraftConfig.planeRole ? ` [${aircraftConfig.planeRole}]` : '';
    ctx.fillText(`${aircraftConfig.role.toUpperCase()}${roleTag}`, x, y + 14);

    const stats = aircraftConfig.stats || {};
    const stealthVal = stats.stealth !== undefined ? stats.stealth : 0;
    const statItems = [
      { label: 'SPD (MANEUVER)', val: stats.spd, active: true },
      { label: 'DEF (ARMOR)', val: stats.def, active: false },
      { label: 'AIR (AIR-AIR)', val: stats.air, active: false },
      { label: 'GND (STRIKE)', val: stats.gnd, active: false },
      { label: 'STL (STEALTH)', val: stealthVal, isStealth: true }
    ];

    let startY = y + 32;
    for (const s of statItems) {
      ctx.font = s.active ? 'bold 10px monospace' : '9px monospace';
      ctx.fillStyle = s.active ? '#ffff44' : s.isStealth ? '#00e5ff' : 'rgba(0, 255, 102, 0.7)';
      ctx.fillText(s.label, x, startY);

      const barW = 85;
      if (s.isStealth) {
        // Draw 4 stealth rating blocks
        const blockW = (barW - 9) / 4;
        for (let b = 0; b < 4; b++) {
          const bx = x + 115 + b * (blockW + 3);
          const isFilled = b < s.val;
          ctx.strokeStyle = s.val > 0 ? '#00e5ff' : 'rgba(0, 255, 102, 0.35)';
          ctx.strokeRect(bx, startY - 8, blockW, 7);
          if (isFilled) {
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(bx, startY - 8, blockW, 7);
          }
        }
        ctx.fillStyle = s.val > 0 ? '#00e5ff' : 'rgba(0, 255, 102, 0.5)';
        ctx.fillText(`LVL ${s.val}`, x + 208, startY);
      } else {
        const fillW = (s.val / 100) * barW;
        ctx.strokeStyle = s.active ? '#ffff44' : 'rgba(0, 255, 102, 0.35)';
        ctx.strokeRect(x + 115, startY - 8, barW, 7);

        ctx.fillStyle = s.active ? '#ffff44' : 'rgba(0, 255, 102, 0.5)';
        ctx.fillRect(x + 115, startY - 8, fillW, 7);

        ctx.fillText(`${s.val}`, x + 208, startY);
      }
      startY += 15;
    }

    // Special Weapons 3 Slots & Tactical Ability display
    const spwList = (aircraftConfig.weapons && aircraftConfig.weapons.specialWeapons) || ['qaam'];
    const activeSpw = (weapons && weapons.equippedSpwId) || (aircraftConfig.weapons && aircraftConfig.weapons.equippedSpecialWeapon) || spwList[0];

    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(0, 255, 102, 0.65)';
    ctx.fillText('SPECIAL WEAPONS [C: CYCLE | X: ARM]:', x, startY + 6);

    let spwOffsetX = x;
    const spwLineY = startY + 20;
    for (const id of spwList) {
      const isEquipped = id === activeSpw;
      const tag = isEquipped ? `[${id.toUpperCase()}]` : id.toUpperCase();
      ctx.font = isEquipped ? 'bold 10px monospace' : '9px monospace';
      ctx.fillStyle = isEquipped ? '#00ffff' : 'rgba(0, 255, 102, 0.45)';
      ctx.fillText(tag, spwOffsetX, spwLineY);
      spwOffsetX += ctx.measureText(tag).width + 8;
    }

    // Gun Stats (RPM & Damage)
    const gunRpm = (weapons && weapons.gunRpm) || (aircraftConfig.weapons && aircraftConfig.weapons.gunRpm) || 1500;
    const gunDmg = (weapons && weapons.gunDamage) || (aircraftConfig.weapons && aircraftConfig.weapons.gunDamage) || 20;
    const dmgStr = typeof gunDmg === 'number' ? (Number.isInteger(gunDmg) ? `${gunDmg}` : gunDmg.toFixed(2)) : gunDmg;
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255, 238, 68, 0.8)';
    ctx.fillText(`GUN: ${gunRpm} RPM | ${dmgStr} DMG`, x, startY + 35);

    ctx.restore();
  }

  // Top Compass Tape
  drawCompassTape(ctx, cx, cy, heading, missionManager = null) {
    ctx.save();
    ctx.textAlign = 'center';

    let deg = Math.round((heading * 180 / Math.PI) + 360) % 360;
    const card = deg > 337 || deg <= 22 ? 'N' : deg > 22 && deg <= 67 ? 'NE' : deg > 67 && deg <= 112 ? 'E' : deg > 112 && deg <= 157 ? 'SE' : deg > 157 && deg <= 202 ? 'S' : deg > 202 && deg <= 247 ? 'SW' : deg > 247 && deg <= 292 ? 'W' : 'NW';

    ctx.fillStyle = this.hudColor;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${deg}° [${card}]`, cx, cy);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(0, 255, 102, 0.75)';

    let missionText = 'MISSION: TEST FLIGHT [SP]';
    if (missionManager && missionManager.currentMission) {
      const mName = (missionManager.currentMission.map && missionManager.currentMission.map.name) || (missionManager.activeMissionId || 'SORTIE');
      const isMP = missionManager.missionType === 'multiplayer';
      const noResp = missionManager.noRespawn ? ' // NO RESPAWN' : '';
      const tag = isMP ? `[MP // ${missionManager.playerCount || 2} PLAYERS]` : (missionManager.loadout && missionManager.loadout.mode === 'forced' ? `[SP // FORCED LOADOUT${noResp}]` : `[SP // PILOT LOADOUT${noResp}]`);
      missionText = `MISSION: ${mName.toUpperCase()} ${tag}`;
    }
    ctx.fillText(missionText, cx, cy + 24);

    ctx.strokeStyle = 'rgba(0, 255, 102, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy + 6);
    ctx.lineTo(cx + 60, cy + 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 11);
    ctx.stroke();

    ctx.restore();
  }

  // Mission Status Overlay Banner (Accomplished, Failed, or Scripted Ending)
  drawMissionStatusBanner(ctx, canvasWidth, canvasHeight, missionManager) {
    if (!missionManager) return;
    const cx = canvasWidth * 0.5;
    const cy = canvasHeight * 0.38;

    ctx.save();
    let title = 'MISSION ACCOMPLISHED';
    let subtitle = 'ALL OBJECTIVES COMPLETED // RETURN TO BASE';
    let col = '#00ff66';
    let bgGrad = 'rgba(0, 30, 15, 0.88)';

    if (missionManager.isFailed) {
      title = 'MISSION FAILED';
      subtitle = 'TACTICAL OBJECTIVES COMPROMISED // CEASE OPERATION';
      col = '#ff3333';
      bgGrad = 'rgba(40, 10, 10, 0.88)';
    } else if (missionManager.isScriptedEnding) {
      title = missionManager.scriptedEndTitle || 'OPERATION CONCLUDED';
      subtitle = missionManager.scriptedEndText || 'SCRIPTED SEQUENCE COMPLETE';
      col = '#00e5ff';
      bgGrad = 'rgba(0, 25, 35, 0.88)';
    }

    // High tech tactical bar
    const barWidth = Math.min(680, canvasWidth - 40);
    const barHeight = 72;

    ctx.fillStyle = bgGrad;
    ctx.fillRect(cx - barWidth * 0.5, cy - barHeight * 0.5, barWidth, barHeight);

    // Glowing border
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - barWidth * 0.5, cy - barHeight * 0.5, barWidth, barHeight);

    // Corner tech brackets
    ctx.fillStyle = col;
    const bSize = 8;
    ctx.fillRect(cx - barWidth * 0.5 - 2, cy - barHeight * 0.5 - 2, bSize, 3);
    ctx.fillRect(cx - barWidth * 0.5 - 2, cy - barHeight * 0.5 - 2, 3, bSize);
    ctx.fillRect(cx + barWidth * 0.5 - bSize + 2, cy - barHeight * 0.5 - 2, bSize, 3);
    ctx.fillRect(cx + barWidth * 0.5 - 1, cy - barHeight * 0.5 - 2, 3, bSize);
    ctx.fillRect(cx - barWidth * 0.5 - 2, cy + barHeight * 0.5 - 1, bSize, 3);
    ctx.fillRect(cx - barWidth * 0.5 - 2, cy + barHeight * 0.5 - bSize + 2, 3, bSize);
    ctx.fillRect(cx + barWidth * 0.5 - bSize + 2, cy + barHeight * 0.5 - 1, bSize, 3);
    ctx.fillRect(cx + barWidth * 0.5 - 1, cy + barHeight * 0.5 - bSize + 2, 3, bSize);

    // Text
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.fillStyle = col;
    ctx.fillText(title, cx, cy - 8);

    ctx.font = '12px Consolas, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subtitle, cx, cy + 18);

    ctx.restore();
  }

  // ==========================================
  // CUSTOM BOTTOM-LEFT FLIGHT & WEAPONS UI (USER REFERENCE MATCH - 75% SCALE)
  // ==========================================
  drawCustomFlightConsole(ctx, x, y, flightState, aircraftConfig, weapons, boundaryState = null, abilityState = null) {
    ctx.save();

    // Speed calculation from flightState:
    const kph = flightState.displayedKph || Math.max(100, Math.round(flightState.speed * 3.6 - 250));
    const mach = kph / 1225;

    // ------------------------------------
    // ROW 1: SPEED, G-LOAD & ALPHA / MACH (75% SCALE)
    // ------------------------------------
    // "SPD" label
    ctx.fillStyle = flightState.isStalled ? this.warnColor : this.limeGreen;
    ctx.font = 'bold 28px monospace';
    ctx.shadowColor = flightState.isStalled ? 'rgba(255, 50, 50, 0.8)' : 'rgba(68, 255, 102, 0.7)';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'left';
    ctx.fillText('SPD', x, y + 40);

    // Large bold digital speed number (e.g. "953")
    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = flightState.isStalled ? '#ff4433' : this.limeText;
    ctx.shadowBlur = 14;
    ctx.fillText(`${kph}`, x + 72, y + 50);

    // Measure width of speed number to position G and Alpha/Mach nicely
    const spdWidth = ctx.measureText(`${kph}`).width;
    const telemetryX = x + 80 + spdWidth + 18;

    // G-Load indicator (Upper line)
    ctx.font = 'bold 21px monospace';
    ctx.fillStyle = this.limeGreen;
    ctx.shadowBlur = 6;
    ctx.fillText('G', telemetryX, y + 18);

    ctx.font = 'bold 27px monospace';
    // G number turns red-orange on high G
    ctx.fillStyle = flightState.gForce > 7.0 ? '#ff4422' : '#ff9922';
    ctx.fillText(`${flightState.gForce.toFixed(1)}`, telemetryX + 24, y + 18);

    // Alpha (Sideslip) or Mach Gauge (Lower line)
    if (mach >= 0.80) {
      // Mach Gauge
      ctx.font = 'bold 21px monospace';
      ctx.fillStyle = this.limeGreen;
      ctx.fillText('M', telemetryX, y + 46);

      ctx.font = 'bold 27px monospace';
      ctx.fillStyle = mach >= 1.0 ? '#00ffff' : '#ffdd44';
      ctx.fillText(`${mach.toFixed(2)}`, telemetryX + 24, y + 46);
    } else {
      // Alpha Sideslip Gauge
      ctx.font = 'bold 21px monospace';
      ctx.fillStyle = this.limeGreen;
      ctx.fillText('α', telemetryX, y + 46);

      ctx.font = 'bold 27px monospace';
      ctx.fillStyle = flightState.isDrifting ? '#ffcc00' : '#ffaa00';
      ctx.fillText(`${flightState.alphaDeg.toFixed(1)}°`, telemetryX + 24, y + 46);
    }

    // ------------------------------------
    // ROW 2: HP STATUS BAR (75% SCALE) - Flashes red & shakes on damage (Ace Combat style)
    // ------------------------------------
    const barY = y + 72;
    const barW = 420;
    const barH = 20;

    // Damage shake and flash effect (Ace Combat style)
    let hpShakeX = 0;
    let hpShakeY = 0;
    const isShaking = weapons && weapons.damageShakeTimer > 0;
    if (isShaking) {
      const intensity = Math.min(1.0, weapons.damageShakeTimer / 0.40) * 8.0;
      hpShakeX = (Math.random() - 0.5) * 2 * intensity;
      hpShakeY = (Math.random() - 0.5) * 2 * intensity;
    }

    const isFlashing = weapons && weapons.damageFlashTimer > 0;
    const flashStrobe = isFlashing && (Math.floor(weapons.damageFlashTimer * 24) % 2 === 0);

    const currentHp = (weapons && typeof weapons.hp === 'number') ? weapons.hp : 100;
    const maxHp = (weapons && weapons.maxHp) || 100;
    const isDead = currentHp <= 0 || (boundaryState && (boundaryState.isDying || boundaryState.isCrashed));
    const hpRatio = isDead ? 0 : Math.max(0, Math.min(1.0, currentHp / maxHp));

    // HP Bar Color states:
    // Green (>= 60%), Yellow (< 60%), Red (< 20%), or Flash Alert Red on damage
    let hpColor = '#4ee034';       // Default healthy green
    let hpGlow = '#39cf24';
    let hpBg = 'rgba(16, 50, 18, 0.75)';
    let hpBorder = '#39cf24';
    let hpTextColor = '#bbfb44';

    if (isFlashing) {
      hpColor = flashStrobe ? '#ffffff' : '#ff1100';
      hpGlow = '#ff1100';
      hpBg = flashStrobe ? 'rgba(255, 45, 45, 0.95)' : 'rgba(180, 20, 20, 0.85)';
      hpBorder = flashStrobe ? '#ffffff' : '#ff3322';
      hpTextColor = flashStrobe ? '#ffffff' : '#ff3322';
    } else if (isDead || hpRatio < 0.20) {
      hpColor = '#ff2222';         // Critical Red below 20% or dead
      hpGlow = '#ff1100';
      hpBg = 'rgba(50, 16, 16, 0.85)';
      hpBorder = '#ff3322';
      hpTextColor = '#ff4433';
    } else if (hpRatio < 0.60) {
      hpColor = '#ffcc00';         // Warning Yellow below 60%
      hpGlow = '#ffaa00';
      hpBg = 'rgba(50, 42, 16, 0.85)';
      hpBorder = '#ffbb00';
      hpTextColor = '#ffea33';
    }

    const finalHpX = x + hpShakeX;
    const finalHpY = barY + hpShakeY;

    // Outer / Empty Bar background
    ctx.fillStyle = hpBg;
    ctx.strokeStyle = hpBorder;
    ctx.lineWidth = isFlashing ? 2.8 : 2.0;
    ctx.shadowColor = hpGlow;
    ctx.shadowBlur = isFlashing ? 18 : ((isDead || hpRatio < 0.20) ? 14 : 10);
    ctx.fillRect(finalHpX, finalHpY, barW, barH);
    ctx.strokeRect(finalHpX, finalHpY, barW, barH);

    // Active Health Fill (empty if dead / 0 HP)
    const fillW = Math.round(barW * hpRatio);
    if (fillW > 0) {
      ctx.fillStyle = hpColor;
      ctx.fillRect(finalHpX + 2, finalHpY + 2, Math.max(0, fillW - 4), barH - 4);
    }

    // "HP" Text next to bar
    ctx.fillStyle = hpTextColor;
    ctx.font = 'bold 26px monospace';
    ctx.shadowBlur = isFlashing ? 18 : 12;
    ctx.shadowColor = hpGlow;
    ctx.fillText('HP', finalHpX + barW + 12, finalHpY + 17);

    // ------------------------------------
    // ROW 3: WEAPONS & AMMO (5 COLUMNS: GUN, MSL, SPW, FLR, ABL - ALL GREEN)
    // ------------------------------------
    const ammoY = barY + 52;
    const colSpacing = 84;

    // Helper to resolve indicator colors:
    // Normal green, Dimmed green for unselected weapon,
    // Flash RED for fully depleted attempt, Flash YELLOW for cooldown/recharge attempt
    const getColColors = (key, isDimmed = false) => {
      const fs = weapons.flashStates ? weapons.flashStates[key] : null;
      if (fs && fs.timer > 0) {
        const strobe = (Math.floor(fs.timer * 24) % 2 === 0);
        if (fs.type === 'depleted') {
          // Fully depleted error: FLASH RED
          const redCol = strobe ? '#ffffff' : '#ff2222';
          return {
            title: redCol,
            text: redCol,
            sub: redCol,
            glow: '#ff1100',
            barsBase: '#ff2222',
            barsGlow: '#ff3322',
            shadowBlur: 14
          };
        } else if (fs.type === 'cooldown') {
          // Cooldown / recharging error: FLASH YELLOW
          const yellowCol = strobe ? '#ffffff' : '#ffcc00';
          return {
            title: yellowCol,
            text: yellowCol,
            sub: yellowCol,
            glow: '#ffaa00',
            barsBase: '#ffaa00',
            barsGlow: '#ffcc00',
            shadowBlur: 14
          };
        }
      }

      if (isDimmed) {
        // Unselected weapon: transparent / see-through green
        return {
          title: 'rgba(0, 255, 102, 0.40)',
          text: 'rgba(0, 255, 102, 0.35)',
          sub: 'rgba(0, 255, 102, 0.40)',
          glow: 'transparent',
          barsBase: 'rgba(0, 255, 102, 0.25)',
          barsGlow: 'rgba(0, 255, 102, 0.35)',
          shadowBlur: 0
        };
      }

      // Normally selected / active indicator: vibrant green
      return {
        title: this.limeGreen,
        text: this.limeText,
        sub: 'rgba(0, 255, 102, 0.85)',
        glow: '#00ff66',
        barsBase: '#00aa44',
        barsGlow: this.limeText,
        shadowBlur: 10
      };
    };

    // Helper to draw vertical indicator bars beneath MSL, SPW, FLR (Ace Combat UI reference match)
    const drawSlotBars = (centerX, topY, slots, count, baseColor, glowColor) => {
      if (!slots || slots.length === 0) return;
      const numSlots = slots.length;
      const barW = 7;
      const barH = 22;
      const gap = 4;
      const totalW = numSlots * barW + (numSlots - 1) * gap;
      const startX = Math.round(centerX - totalW / 2);

      for (let i = 0; i < numSlots; i++) {
        const slot = slots[i];
        const bx = startX + i * (barW + gap);
        const isReady = (count > 0) && (slot.reload <= 0);
        const reloadRatio = (slot.maxReload > 0) ? Math.max(0, Math.min(1.0, 1.0 - (slot.reload / slot.maxReload))) : 1.0;

        // Dark background silhouette
        ctx.fillStyle = 'rgba(8, 20, 28, 0.85)';
        ctx.fillRect(bx, topY, barW, barH);
        ctx.strokeStyle = isReady ? baseColor : 'rgba(80, 130, 160, 0.35)';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(bx, topY, barW, barH);

        if (count > 0) {
          if (isReady) {
            // Ready slot: bright solid vertical bar
            ctx.fillStyle = glowColor;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 8;
            ctx.fillRect(bx + 1, topY + 1, barW - 2, barH - 2);
            ctx.shadowBlur = 0;
          } else if (reloadRatio > 0) {
            // Reloading: bottom-up progressive fill bar
            const fillH = Math.round((barH - 2) * reloadRatio);
            ctx.fillStyle = 'rgba(166, 213, 255, 0.45)';
            ctx.fillRect(bx + 1, topY + 1 + (barH - 2 - fillH), barW - 2, fillH);
          }
        }
      }
    };

    // Column 1: GUN (Lime) [LMB]
    const col1X = x + 8;
    const gunColors = getColColors('gun', false);
    ctx.fillStyle = gunColors.title;
    ctx.font = 'bold 20px monospace';
    ctx.shadowColor = gunColors.glow;
    ctx.shadowBlur = gunColors.shadowBlur;
    ctx.fillText('GUN', col1X, ammoY);

    ctx.font = '9px monospace';
    ctx.fillStyle = gunColors.sub;
    ctx.fillText('LMB', col1X + 46, ammoY - 2);

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = gunColors.text;
    ctx.shadowColor = gunColors.glow;
    ctx.shadowBlur = gunColors.shadowBlur;
    ctx.fillText(`${weapons.gunAmmo}`, col1X, ammoY + 40);

    // Column 2 & 3: Weapon Selection (MSL vs SPW - switched via [X], fired via [Space])
    const col2X = col1X + colSpacing;
    const col3X = col2X + colSpacing;
    const isMslSelected = (weapons.selectedWeapon !== 'spw');
    const isSpwSelected = !isMslSelected;

    // Column 2: MSL
    // Normally selected: normal vibrant green (no box)
    // Unselected: transparent/see-through green
    const mslColors = getColColors('msl', !isMslSelected);
    ctx.fillStyle = mslColors.title;
    ctx.font = 'bold 20px monospace';
    ctx.shadowColor = mslColors.glow;
    ctx.shadowBlur = mslColors.shadowBlur;
    ctx.fillText('MSL', col2X, ammoY);

    ctx.font = '9px monospace';
    ctx.fillStyle = mslColors.sub;
    ctx.fillText(isMslSelected ? '[SPC]' : '[X]', col2X + 46, ammoY - 2);

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = mslColors.text;
    ctx.shadowColor = mslColors.glow;
    ctx.shadowBlur = mslColors.shadowBlur;
    ctx.fillText(`${weapons.mslCount}`, col2X, ammoY + 40);
    const mslW = ctx.measureText(`${weapons.mslCount}`).width;
    drawSlotBars(
      col2X + mslW / 2,
      ammoY + 48,
      weapons.mslSlots,
      weapons.mslCount,
      mslColors.barsBase,
      mslColors.barsGlow
    );

    // Column 3: SPW (shows active weapon code e.g. QAAM, 4AAM, UGB)
    // Normally selected: normal vibrant green (no box)
    // Unselected: transparent/see-through green
    const spwColors = getColColors('spw', !isSpwSelected);
    ctx.fillStyle = spwColors.title;
    ctx.font = 'bold 20px monospace';
    ctx.shadowColor = spwColors.glow;
    ctx.shadowBlur = spwColors.shadowBlur;
    ctx.fillText(weapons.spwCode || 'SPW', col3X, ammoY);

    ctx.font = '9px monospace';
    ctx.fillStyle = spwColors.sub;
    ctx.fillText(isSpwSelected ? '[SPC]' : '[X]', col3X + 48, ammoY - 2);

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = spwColors.text;
    ctx.shadowColor = spwColors.glow;
    ctx.shadowBlur = spwColors.shadowBlur;
    ctx.fillText(`${weapons.spwCount}`, col3X, ammoY + 40);
    const spwW = ctx.measureText(`${weapons.spwCount}`).width;
    drawSlotBars(
      col3X + spwW / 2,
      ammoY + 48,
      weapons.spwSlots,
      weapons.spwCount,
      spwColors.barsBase,
      spwColors.barsGlow
    );

    // Column 4: FLR (Flares remaining) [S] - Green
    const col4X = col3X + colSpacing;
    const flrColors = getColColors('flr', false);
    ctx.fillStyle = flrColors.title;
    ctx.font = 'bold 20px monospace';
    ctx.shadowColor = flrColors.glow;
    ctx.shadowBlur = flrColors.shadowBlur;
    ctx.fillText('FLR', col4X, ammoY);

    ctx.font = '9px monospace';
    ctx.fillStyle = flrColors.sub;
    ctx.fillText('[S]', col4X + 46, ammoY - 2);

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = flrColors.text;
    ctx.shadowColor = flrColors.glow;
    ctx.shadowBlur = flrColors.shadowBlur;
    ctx.fillText(`${weapons.flareCount}`, col4X, ammoY + 40);
    const flrW = ctx.measureText(`${weapons.flareCount}`).width;
    drawSlotBars(
      col4X + flrW / 2,
      ammoY + 48,
      weapons.flareSlots,
      weapons.flareCount,
      flrColors.barsBase,
      flrColors.barsGlow
    );

    // Column 5: ABL ("RDY" / cooldown / active duration) [A]
    const col5X = col4X + colSpacing;
    const isAbilityActive = !!(abilityState && abilityState.active);
    const ablColors = getColColors('abl', false);
    ctx.fillStyle = isAbilityActive ? '#00ffee' : ablColors.title;
    ctx.font = 'bold 20px monospace';
    ctx.shadowColor = isAbilityActive ? '#00e5ff' : ablColors.glow;
    ctx.shadowBlur = ablColors.shadowBlur;
    ctx.fillText(weapons.abilityCode || 'ABL', col5X, ammoY);

    ctx.font = '9px monospace';
    ctx.fillStyle = isAbilityActive ? '#00ffee' : ablColors.sub;
    ctx.fillText('[A]', col5X + 46, ammoY - 2);

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = isAbilityActive ? '#00ffee' : ablColors.text;
    ctx.shadowColor = isAbilityActive ? '#00e5ff' : ablColors.glow;
    ctx.shadowBlur = ablColors.shadowBlur;

    if (isAbilityActive) {
      ctx.font = 'bold 22px monospace';
      if (abilityState.id === 'aoaLimiter') {
        const rem = Math.max(0, (abilityState.duration || 1.5) - (abilityState.timer || 0));
        ctx.fillText(abilityState.phase === 1 ? `AOA ${rem.toFixed(1)}s` : `ALN ${rem.toFixed(1)}s`, col5X, ammoY + 38);
      } else {
        const rem = Math.max(0, (abilityState.duration || 0) - (abilityState.timer || 0));
        ctx.fillText(`${rem.toFixed(1)}s`, col5X, ammoY + 38);
      }
    } else if (weapons.abilityCharges > 0) {
      ctx.fillText('RDY', col5X, ammoY + 40);
    } else {
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = (ablColors.title !== this.limeGreen) ? ablColors.text : this.amberColor;
      const rech = Math.max(0, weapons.abilityRecharge || 0);
      ctx.fillText(`${rech.toFixed(0)}s`, col5X, ammoY + 38);
    }

    ctx.restore();
  }

  // ==========================================
  // ACE COMBAT TRUE SQUARE RADAR / MINIMAP (EXPANDED TO FULL AO ON [HOLD Z])
  // ==========================================
  // Stealth Minimap Radar Visibility Check (Stealth 0: Everywhere | Stealth 1: <= 1/4 map | Stealth 2: <= 1/8 map | Stealth 3: Visual/on-screen | Stealth 4: Never)
  // Sensor Fusion multiplies detection distance by 2.5x (+150%) for Stealth 1, 2, and 3
  isTargetVisibleOnRadar(tgt, flightState, world, camera, canvasWidth, canvasHeight, sensorFusionActive = false) {
    if (!tgt) return false;
    // Ground and naval targets do not have plane stealth unless explicitly specified
    if (tgt.type && tgt.type !== 'air') {
      return tgt.stealth !== undefined ? Number(tgt.stealth) < 4 : true;
    }
    const stealth = getTargetStealth(tgt);
    if (stealth <= 0) return true;
    if (stealth >= 4) return false; // Stealth 4 never appears on radar minimap

    const mapHalf = (world && world.halfMapSize) ? world.halfMapSize : 15075;
    const mapSize = (world && world.mapSize) ? world.mapSize : (mapHalf * 2);
    const dist = Math.hypot(tgt.x - flightState.x, tgt.y - flightState.y);

    const mult = sensorFusionActive ? 2.5 : 1.0;

    if (stealth === 1) {
      return dist <= mapSize * 0.25 * mult;
    }
    if (stealth === 2) {
      return dist <= mapSize * 0.125 * mult;
    }
    if (stealth === 3) {
      if (sensorFusionActive) {
        const cam = camera || this.camera;
        const cw = canvasWidth || this.canvasWidth || 1920;
        const ch = canvasHeight || this.canvasHeight || 1080;
        const zoom = (cam && cam.zoom) ? cam.zoom : 0.68;
        const visualRadius = (Math.hypot(cw, ch) * 0.5) / zoom;
        return (dist <= visualRadius * 2.5) || this.isTargetOnScreen(tgt, cam, cw, ch);
      }
      const cam = camera || this.camera;
      const cw = canvasWidth || this.canvasWidth;
      const ch = canvasHeight || this.canvasHeight;
      return this.isTargetOnScreen(tgt, cam, cw, ch);
    }
    return true;
  }

  isTargetOnScreen(tgt, camera, canvasWidth, canvasHeight, margin = 35) {
    if (!tgt || !camera || !canvasWidth || !canvasHeight) return false;
    const cx = canvasWidth * 0.5;
    const cy = canvasHeight * 0.5;
    const sx = (tgt.x - camera.x) * camera.zoom + cx;
    const sy = (tgt.y - camera.y) * camera.zoom + cy;
    return sx >= -margin && sx <= canvasWidth + margin && sy >= -margin && sy <= canvasHeight + margin;
  }

  drawRadarMinimap(ctx, cx, cy, halfSize, flightState, world, particles, isExpanded = false, boundaryState = null, targets = null, targeting = null, returnLine = null, camera = null, canvasWidth = 0, canvasHeight = 0, sensorFusionActive = false) {
    const size = halfSize * 2;
    const left = cx - halfSize;
    const top = cy - halfSize;

    ctx.save();

    const isOutOfBounds = boundaryState && boundaryState.isOutOfBounds;
    const isNearBorder = boundaryState && boundaryState.isNearBorder;

    // 1. Square Radar Glass Background
    ctx.fillStyle = isOutOfBounds
      ? 'rgba(32, 6, 10, 0.94)'
      : isExpanded
        ? 'rgba(2, 20, 26, 0.94)'
        : 'rgba(2, 18, 22, 0.90)';
    ctx.fillRect(left, top, size, size);

    // 2. Outer Glow Border (Square)
    const borderColor = isOutOfBounds ? '#ff2200' : isNearBorder ? '#ffaa00' : isExpanded ? '#00ffee' : '#00ff66';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = isExpanded ? 16 : 12;
    ctx.strokeRect(left, top, size, size);

    // 3. Tactical Corner Brackets (Authentic Ace Combat Style)
    const bracketLen = isExpanded ? 24 : 17;
    const bracketOffset = 6;
    const bx1 = left - bracketOffset;
    const bx2 = left + size + bracketOffset;
    const by1 = top - bracketOffset;
    const by2 = top + size + bracketOffset;

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(bx1 + bracketLen, by1); ctx.lineTo(bx1, by1); ctx.lineTo(bx1, by1 + bracketLen);
    // Top-right
    ctx.moveTo(bx2 - bracketLen, by1); ctx.lineTo(bx2, by1); ctx.lineTo(bx2, by1 + bracketLen);
    // Bottom-left
    ctx.moveTo(bx1 + bracketLen, by2); ctx.lineTo(bx1, by2); ctx.lineTo(bx1, by2 - bracketLen);
    // Bottom-right
    ctx.moveTo(bx2 - bracketLen, by2); ctx.lineTo(bx2, by2); ctx.lineTo(bx2, by2 - bracketLen);
    ctx.stroke();

    // 4. Concentric Range Rings or Strategic Grid
    if (!isExpanded) {
      // Vicinity 4km radar mode
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, halfSize * 0.42, 0, Math.PI * 2);
      ctx.arc(cx, cy, halfSize * 0.84, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs through center
      ctx.beginPath();
      ctx.moveTo(left, cy); ctx.lineTo(left + size, cy);
      ctx.moveTo(cx, top); ctx.lineTo(cx, top + size);
      ctx.stroke();

      // Cardinal Labels on Square Edges
      ctx.fillStyle = 'rgba(0, 255, 102, 0.85)';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', cx, top + 12);
      ctx.fillText('S', cx, top + size - 12);
      ctx.fillText('W', left + 12, cy);
      ctx.fillText('E', left + size - 12, cy);
    } else {
      // Expanded Tactical Overview: Coordinate Grid
      ctx.strokeStyle = 'rgba(0, 255, 238, 0.16)';
      ctx.lineWidth = 1.0;
      const gridSteps = 4;
      for (let i = 1; i < gridSteps; i++) {
        const gx = left + (size / gridSteps) * i;
        const gy = top + (size / gridSteps) * i;
        ctx.beginPath();
        ctx.moveTo(gx, top); ctx.lineTo(gx, top + size);
        ctx.moveTo(left, gy); ctx.lineTo(left + size, gy);
        ctx.stroke();
      }

      // Map origin crosshair (World 0, 0)
      ctx.strokeStyle = 'rgba(0, 255, 238, 0.4)';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy);
      ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14);
      ctx.stroke();

      // Cardinal direction indicators
      ctx.fillStyle = 'rgba(0, 255, 238, 0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', cx, top + 14);
      ctx.fillText('S', cx, top + size - 14);
      ctx.fillText('W', left + 14, cy);
      ctx.fillText('E', left + size - 14, cy);
    }

    // 5. Clip inside Square Screen
    ctx.save();
    ctx.beginPath();
    ctx.rect(left + 2, top + 2, size - 4, size - 4);
    ctx.clip();

    if (isExpanded) {
      // ==========================================
      // EXPANDED TACTICAL MAP: ENTIRE FINITE AO
      // ==========================================
      const mapHalf = (world && world.halfMapSize) ? world.halfMapSize : 15075;
      const scale = (halfSize * 0.88) / mapHalf;

      // Draw Combat Zone AO Perimeter Box
      const aoBoxW = (mapHalf * 2) * scale;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
      ctx.strokeRect(cx - aoBoxW * 0.5, cy - aoBoxW * 0.5, aoBoxW, aoBoxW);

      // Shaded restricted zone outside AO box
      ctx.fillStyle = 'rgba(255, 30, 40, 0.16)';
      ctx.fillRect(left, top, size, (cy - aoBoxW * 0.5) - top);
      ctx.fillRect(left, cy + aoBoxW * 0.5, size, (top + size) - (cy + aoBoxW * 0.5));
      ctx.fillRect(left, cy - aoBoxW * 0.5, (cx - aoBoxW * 0.5) - left, aoBoxW);
      ctx.fillRect(cx + aoBoxW * 0.5, cy - aoBoxW * 0.5, (left + size) - (cx + aoBoxW * 0.5), aoBoxW);

      // Return Line on expanded tactical map
      if (returnLine && returnLine.enabled) {
        const side = (returnLine.side || 'bottom').toLowerCase();
        const offset = returnLine.offset !== undefined ? returnLine.offset : 0.10;
        const boxLeft = cx - aoBoxW * 0.5;
        const boxTop = cy - aoBoxW * 0.5;
        const zoneDepth = aoBoxW * offset;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 180, 255, 0.28)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 4]);

        if (side === 'bottom') {
          const rlY = boxTop + aoBoxW - zoneDepth;
          ctx.fillRect(boxLeft, rlY, aoBoxW, zoneDepth);
          ctx.beginPath(); ctx.moveTo(boxLeft, rlY); ctx.lineTo(boxLeft + aoBoxW, rlY); ctx.stroke();
        } else if (side === 'top') {
          const rlY = boxTop + zoneDepth;
          ctx.fillRect(boxLeft, boxTop, aoBoxW, zoneDepth);
          ctx.beginPath(); ctx.moveTo(boxLeft, rlY); ctx.lineTo(boxLeft + aoBoxW, rlY); ctx.stroke();
        } else if (side === 'left') {
          const rlX = boxLeft + zoneDepth;
          ctx.fillRect(boxLeft, boxTop, zoneDepth, aoBoxW);
          ctx.beginPath(); ctx.moveTo(rlX, boxTop); ctx.lineTo(rlX, boxTop + aoBoxW); ctx.stroke();
        } else if (side === 'right') {
          const rlX = boxLeft + aoBoxW - zoneDepth;
          ctx.fillRect(rlX, boxTop, zoneDepth, aoBoxW);
          ctx.beginPath(); ctx.moveTo(rlX, boxTop); ctx.lineTo(rlX, boxTop + aoBoxW); ctx.stroke();
        }
        ctx.restore();
      }

      // Targets across entire map
      if (targets) {
        for (const tgt of targets) {
          if (tgt.isDestroyed || tgt.isFalling) continue;
          if (!this.isTargetVisibleOnRadar(tgt, flightState, world, camera, canvasWidth, canvasHeight, sensorFusionActive)) {
            continue;
          }
          const tx = cx + tgt.x * scale;
          const ty = cy + tgt.y * scale;
          ctx.save();
          ctx.translate(tx, ty);
          const isDesignated = targeting && targeting.designatedTarget && targeting.designatedTarget.id === tgt.id;
          const isMultiLocked = targeting && targeting.multiLockedTargets && targeting.multiLockedTargets.some(m => m && m.id === tgt.id);
          const isLocked = (isDesignated || isMultiLocked) && targeting && targeting.lockState === 'LOCKED';
          ctx.strokeStyle = isLocked ? '#ff2200' : isDesignated ? '#00ffee' : '#00ff66';
          ctx.fillStyle = isLocked ? 'rgba(255, 34, 0, 0.9)' : isDesignated ? 'rgba(0, 255, 238, 0.85)' : 'rgba(0, 255, 102, 0.75)';
          ctx.lineWidth = isLocked || isDesignated ? 2.5 : 1.6;

          if (tgt.type === 'air') {
            ctx.beginPath();
            ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
          } else if (tgt.type === 'naval') {
            ctx.strokeRect(-5, -3, 10, 6);
            ctx.fillRect(-5, -3, 10, 6);
          } else {
            ctx.strokeRect(-4, -4, 8, 8);
            ctx.fillRect(-4, -4, 8, 8);
          }
          ctx.restore();
        }
      }

      // Missiles on tactical map (directional line vectors pointing in travel direction - Ace Combat style)
      if (particles && particles.missiles) {
        for (const m of particles.missiles) {
          const mx = cx + m.x * scale;
          const my = cy + m.y * scale;
          const cosH = Math.cos(m.heading);
          const sinH = Math.sin(m.heading);
          const lineLen = 11;

          ctx.save();
          const isThreat = m.isEnemy && !m.lostLock;
          ctx.strokeStyle = m.isEnemy ? (isThreat ? '#ff2200' : 'rgba(255, 68, 68, 0.55)') : '#ffaa00';
          ctx.lineWidth = isThreat ? 2.2 : 1.6;
          ctx.shadowColor = isThreat ? '#ff0000' : '#ff7700';
          ctx.shadowBlur = isThreat ? 6 : 3;

          // Trailing velocity line pointing in direction of travel
          ctx.beginPath();
          ctx.moveTo(mx - cosH * lineLen, my - sinH * lineLen);
          ctx.lineTo(mx, my);
          ctx.stroke();

          // Arrowhead / tip at head pointing forward
          const perpX = -sinH;
          const perpY = cosH;
          ctx.fillStyle = isThreat ? '#ffffff' : (m.isEnemy ? '#ff4422' : '#ffee77');
          ctx.beginPath();
          ctx.moveTo(mx + cosH * 2.0, my + sinH * 2.0);
          ctx.lineTo(mx - cosH * 3.5 + perpX * 2.5, my - sinH * 3.5 + perpY * 2.5);
          ctx.lineTo(mx - cosH * 1.8, my - sinH * 1.8);
          ctx.lineTo(mx - cosH * 3.5 - perpX * 2.5, my - sinH * 3.5 - perpY * 2.5);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }

      // Flares on tactical map
      if (particles && particles.flares) {
        for (const f of particles.flares) {
          const fx = cx + f.x * scale;
          const fy = cy + f.y * scale;
          ctx.fillStyle = '#ffdd44';
          ctx.beginPath();
          ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Player icon on relative location on map (NOT locked to center)
      const px = cx + flightState.x * scale;
      const py = cy + flightState.y * scale;

      ctx.save();
      ctx.translate(px, py);

      // Radar locator pulse ring around player
      const pulseRing = (performance.now() % 1200) / 1200;
      ctx.strokeStyle = `rgba(0, 255, 238, ${1.0 - pulseRing})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8 + pulseRing * 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(flightState.heading);

      // Heading vector line
      ctx.strokeStyle = 'rgba(0, 255, 238, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Player Chevron Icon
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00ffee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-8, -6.5);
      ctx.lineTo(-3.5, 0);
      ctx.lineTo(-8, 6.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

    } else {
      // ==========================================
      // NORMAL MODE: 4KM VICINITY RADAR
      // ==========================================
      const radarRange = 4000;
      const scale = halfSize / radarRange;

      // Draw AO boundary line if within 4km
      const mapHalf = (world && world.halfMapSize) ? world.halfMapSize : 15075;
      const bMinX = (-mapHalf - flightState.x) * scale;
      const bMaxX = (mapHalf - flightState.x) * scale;
      const bMinY = (-mapHalf - flightState.y) * scale;
      const bMaxY = (mapHalf - flightState.y) * scale;

      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(cx + bMinX, cy + bMinY, bMaxX - bMinX, bMaxY - bMinY);
      ctx.setLineDash([]);

      // Return Line on local radar if within range
      if (returnLine && returnLine.enabled) {
        const side = (returnLine.side || 'bottom').toLowerCase();
        const offset = returnLine.offset !== undefined ? returnLine.offset : 0.10;
        const mapSize = mapHalf * 2;
        const zoneDepth = mapSize * offset;

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 5]);
        ctx.fillStyle = 'rgba(0, 180, 255, 0.22)';

        if (side === 'bottom') {
          const rlWorldY = mapHalf - zoneDepth;
          const rly = cy + (rlWorldY - flightState.y) * scale;
          if (rly > top && rly < top + size) {
            ctx.fillRect(left, rly, size, (top + size) - rly);
            ctx.beginPath(); ctx.moveTo(left, rly); ctx.lineTo(left + size, rly); ctx.stroke();
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#00f0ff';
            ctx.textAlign = 'center';
            ctx.fillText('RETURN LINE', cx, Math.min(top + size - 6, rly + 12));
          }
        } else if (side === 'top') {
          const rlWorldY = -mapHalf + zoneDepth;
          const rly = cy + (rlWorldY - flightState.y) * scale;
          if (rly > top && rly < top + size) {
            ctx.fillRect(left, top, size, rly - top);
            ctx.beginPath(); ctx.moveTo(left, rly); ctx.lineTo(left + size, rly); ctx.stroke();
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#00f0ff';
            ctx.textAlign = 'center';
            ctx.fillText('RETURN LINE', cx, Math.max(top + 12, rly - 6));
          }
        } else if (side === 'left') {
          const rlWorldX = -mapHalf + zoneDepth;
          const rlx = cx + (rlWorldX - flightState.x) * scale;
          if (rlx > left && rlx < left + size) {
            ctx.fillRect(left, top, rlx - left, size);
            ctx.beginPath(); ctx.moveTo(rlx, top); ctx.lineTo(rlx, top + size); ctx.stroke();
          }
        } else if (side === 'right') {
          const rlWorldX = mapHalf - zoneDepth;
          const rlx = cx + (rlWorldX - flightState.x) * scale;
          if (rlx > left && rlx < left + size) {
            ctx.fillRect(rlx, top, (left + size) - rlx, size);
            ctx.beginPath(); ctx.moveTo(rlx, top); ctx.lineTo(rlx, top + size); ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Air, Naval & Ground Targets in vicinity
      if (targets) {
        for (const tgt of targets) {
          if (tgt.isDestroyed || tgt.isFalling) continue;
          if (!this.isTargetVisibleOnRadar(tgt, flightState, world, camera, canvasWidth, canvasHeight, sensorFusionActive)) {
            continue;
          }
          const tdx = (tgt.x - flightState.x) * scale;
          const tdy = (tgt.y - flightState.y) * scale;
          if (Math.abs(tdx) < halfSize && Math.abs(tdy) < halfSize) {
            ctx.save();
            ctx.translate(cx + tdx, cy + tdy);
            const isDesignated = targeting && targeting.designatedTarget && targeting.designatedTarget.id === tgt.id;
            const isMultiLocked = targeting && targeting.multiLockedTargets && targeting.multiLockedTargets.some(m => m && m.id === tgt.id);
            const isLocked = (isDesignated || isMultiLocked) && targeting && targeting.lockState === 'LOCKED';
            const isTargeted = isDesignated || isMultiLocked;
            ctx.strokeStyle = isLocked ? '#ff2200' : isDesignated ? '#00ffee' : isMultiLocked ? '#ffaa00' : '#00ff66';
            ctx.fillStyle = isLocked ? 'rgba(255, 34, 0, 0.9)' : isDesignated ? 'rgba(0, 255, 238, 0.85)' : isMultiLocked ? 'rgba(255, 170, 0, 0.85)' : 'rgba(0, 255, 102, 0.75)';
            ctx.lineWidth = isTargeted ? 2.5 : 1.6;

            if (tgt.type === 'air') {
              ctx.beginPath();
              ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0);
              ctx.closePath();
              ctx.stroke();
              ctx.fill();
            } else if (tgt.type === 'naval') {
              ctx.strokeRect(-5, -3, 10, 6);
              ctx.fillRect(-5, -3, 10, 6);
            } else {
              ctx.strokeRect(-4, -4, 8, 8);
              ctx.fillRect(-4, -4, 8, 8);
            }
            ctx.restore();
          }
        }
      }

      // Missiles in vicinity (directional line vectors pointing in travel direction - Ace Combat style)
      if (particles && particles.missiles) {
        for (const m of particles.missiles) {
          const mdx = (m.x - flightState.x) * scale;
          const mdy = (m.y - flightState.y) * scale;
          if (Math.abs(mdx) < halfSize && Math.abs(mdy) < halfSize) {
            const mx = cx + mdx;
            const my = cy + mdy;
            const cosH = Math.cos(m.heading);
            const sinH = Math.sin(m.heading);
            const lineLen = 15;

            ctx.save();
            const isThreat = m.isEnemy && !m.lostLock;
            ctx.strokeStyle = m.isEnemy ? (isThreat ? '#ff2200' : 'rgba(255, 68, 68, 0.55)') : '#ffaa00';
            ctx.lineWidth = isThreat ? 2.6 : 1.8;
            ctx.shadowColor = isThreat ? '#ff0000' : '#ff7700';
            ctx.shadowBlur = isThreat ? 8 : 4;

            // Trailing velocity line pointing in direction of travel
            ctx.beginPath();
            ctx.moveTo(mx - cosH * lineLen, my - sinH * lineLen);
            ctx.lineTo(mx, my);
            ctx.stroke();

            // Arrowhead at head pointing along heading
            const perpX = -sinH;
            const perpY = cosH;
            ctx.fillStyle = isThreat ? '#ffffff' : (m.isEnemy ? '#ff4422' : '#ffee77');
            ctx.beginPath();
            ctx.moveTo(mx + cosH * 3.0, my + sinH * 3.0);
            ctx.lineTo(mx - cosH * 4.5 + perpX * 3.2, my - sinH * 4.5 + perpY * 3.2);
            ctx.lineTo(mx - cosH * 2.2, my - sinH * 2.2);
            ctx.lineTo(mx - cosH * 4.5 - perpX * 3.2, my - sinH * 4.5 - perpY * 3.2);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          }
        }
      }

      // Flares in vicinity
      if (particles && particles.flares) {
        for (const f of particles.flares) {
          const fdx = (f.x - flightState.x) * scale;
          const fdy = (f.y - flightState.y) * scale;
          if (Math.abs(fdx) < halfSize && Math.abs(fdy) < halfSize) {
            ctx.fillStyle = '#ffdd44';
            ctx.beginPath();
            ctx.arc(cx + fdx, cy + fdy, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Player Aircraft Icon at Radar Center
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(flightState.heading);

      ctx.strokeStyle = 'rgba(0, 255, 102, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(halfSize * 0.88, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-9, -7.5);
      ctx.lineTo(-4.5, 0);
      ctx.lineTo(-9, 7.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    ctx.restore(); // Restore clip

    // 6. Header & Range Readouts
    if (isExpanded) {
      ctx.fillStyle = '#00ffee';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('TAC MAP // ENTIRE AO [30.1KM]', left, top - 8);

      ctx.textAlign = 'right';
      ctx.fillText('[HOLDING Z]', left + size, top - 8);

      let deg = Math.round((flightState.heading * 180 / Math.PI) + 360) % 360;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0, 255, 238, 0.85)';
      ctx.fillText(`POS: ${Math.round(flightState.x)}, ${Math.round(flightState.y)}`, left, top + size + 18);

      ctx.textAlign = 'right';
      ctx.fillText(`HDG ${String(deg).padStart(3, '0')}°`, left + size, top + size + 18);
    } else {
      ctx.fillStyle = '#00ff66';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('RDR 4.0KM', left, top + size + 18);

      let deg = Math.round((flightState.heading * 180 / Math.PI) + 360) % 360;
      ctx.textAlign = 'right';
      ctx.fillText(`HDG ${String(deg).padStart(3, '0')}° [HOLD Z: MAP]`, left + size, top + size + 18);
    }

    ctx.restore();
  }

  // Singleplayer Mission Dialogue Transmission (Ace Combat style top-right portrait & speech bubble)
  drawDialogueTransmission(ctx, canvasWidth, canvasHeight, dialogue) {
    if (!dialogue || !dialogue.text) return;

    ctx.save();
    // Entry / Exit animation interpolation
    let animAlpha = 1.0;
    let slideOffset = 0;
    const introDuration = 0.22;
    const outroDuration = 0.28;

    if (dialogue.elapsed < introDuration) {
      const p = Math.max(0.001, dialogue.elapsed / introDuration);
      animAlpha = p;
      slideOffset = (1.0 - Math.pow(p, 2)) * 60;
    } else if (dialogue.timer < outroDuration) {
      animAlpha = Math.max(0, dialogue.timer / outroDuration);
      slideOffset = (1.0 - animAlpha) * 40;
    }

    ctx.globalAlpha = animAlpha;

    // Portrait geometry (top right corner per reference screenshot)
    const portraitW = 86;
    const portraitH = 92;
    const portraitX = canvasWidth - portraitW - 24 + slideOffset;
    const portraitY = 18;

    // Speech bubble dynamic sizing based on text length & measurement
    ctx.font = "bold 18px 'Share Tech Mono', 'Courier New', monospace";
    const isMultiLine = dialogue.text.length > 36;
    const measuredW = ctx.measureText(dialogue.text).width;
    const maxBubbleW = Math.min(520, canvasWidth - portraitW - 70);
    const bubbleW = isMultiLine
      ? Math.max(340, Math.min(maxBubbleW, measuredW * 0.58 + 48))
      : Math.max(210, Math.min(maxBubbleW, measuredW + 48));
    const bubbleH = isMultiLine ? 78 : 64;
    const bubbleX = portraitX - bubbleW - 14;
    const bubbleY = portraitY + 6;

    // 1. Draw Speech Bubble Frame & Connecting Arrow Pointer
    ctx.fillStyle = 'rgba(8, 38, 18, 0.85)';
    ctx.strokeStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.0;

    const arrowY = bubbleY + bubbleH * 0.45;
    ctx.beginPath();
    ctx.moveTo(bubbleX, bubbleY);
    ctx.lineTo(bubbleX + bubbleW, bubbleY);
    ctx.lineTo(bubbleX + bubbleW, arrowY - 8);
    ctx.lineTo(portraitX - 2, arrowY); // Arrow tip towards portrait
    ctx.lineTo(bubbleX + bubbleW, arrowY + 8);
    ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH);
    ctx.lineTo(bubbleX, bubbleY + bubbleH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Draw Typewritten Dialogue Text (Centered per reference)
    ctx.save();
    ctx.font = "bold 18px 'Share Tech Mono', 'Courier New', monospace";
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = bubbleX + bubbleW * 0.5;
    const textY = bubbleY + bubbleH * 0.5;

    const currentText = dialogue.displayedText || '';
    if (isMultiLine) {
      const words = currentText.split(' ');
      let line1 = '';
      let line2 = '';
      for (const w of words) {
        if ((line1 + ' ' + w).length <= 32) {
          line1 = (line1 ? line1 + ' ' : '') + w;
        } else {
          line2 = (line2 ? line2 + ' ' : '') + w;
        }
      }
      ctx.fillText(line1, textX, textY - 11);
      ctx.fillText(line2, textX, textY + 13);
    } else {
      ctx.fillText(currentText, textX, textY + 1);
    }
    ctx.restore();

    // 3. Draw Portrait Outer Box & Glow
    ctx.fillStyle = '#061a10';
    ctx.strokeStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.4;
    ctx.fillRect(portraitX, portraitY, portraitW, portraitH);
    ctx.strokeRect(portraitX, portraitY, portraitW, portraitH);

    // 4. Portrait Content (Custom Image or Authentic Tactical Pilot Silhouette)
    if (dialogue.portraitImage && dialogue.portraitImage.complete && dialogue.portraitImage.naturalWidth > 0) {
      ctx.drawImage(dialogue.portraitImage, portraitX + 3, portraitY + 3, portraitW - 6, portraitH - 6);
      ctx.fillStyle = 'rgba(0, 255, 102, 0.22)';
      ctx.fillRect(portraitX + 3, portraitY + 3, portraitW - 6, portraitH - 6);
    } else {
      // High-Tech Generic Pilot Silhouette Vector
      ctx.save();
      const pcX = portraitX + portraitW * 0.5;
      const pcY = portraitY + 44;

      // Pilot helmet
      ctx.fillStyle = '#0f3822';
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pcX, pcY - 6, 26, Math.PI, 0, false);
      ctx.lineTo(pcX + 26, pcY + 16);
      ctx.lineTo(pcX - 26, pcY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tinted flight visor
      ctx.fillStyle = '#00ff66';
      ctx.beginPath();
      ctx.ellipse(pcX, pcY - 5, 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Visor reflection
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pcX - 10, pcY - 8);
      ctx.lineTo(pcX - 2, pcY - 12);
      ctx.stroke();

      // Oxygen mask & boom microphone
      ctx.fillStyle = '#082414';
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pcX, pcY + 12, 11, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mic boom
      ctx.beginPath();
      ctx.moveTo(pcX - 18, pcY + 6);
      ctx.lineTo(pcX - 5, pcY + 14);
      ctx.stroke();

      // Shoulders
      ctx.fillStyle = '#092215';
      ctx.beginPath();
      ctx.moveTo(pcX - 38, portraitY + portraitH - 4);
      ctx.lineTo(pcX - 24, pcY + 18);
      ctx.lineTo(pcX + 24, pcY + 18);
      ctx.lineTo(pcX + 38, portraitY + portraitH - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // CRT Scanlines across portrait
    ctx.save();
    ctx.fillStyle = 'rgba(0, 255, 102, 0.14)';
    for (let sy = portraitY + 2; sy < portraitY + portraitH; sy += 3) {
      ctx.fillRect(portraitX + 2, sy, portraitW - 4, 1);
    }
    ctx.restore();

    // 5. Callsign / Character Meta Info Under Portrait
    ctx.save();
    const metaX = portraitX + 2;
    const metaY = portraitY + portraitH + 13;

    // Callsign (bold phosphor green)
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 6;
    ctx.fillText((dialogue.speaker || 'UNKNOWN').toUpperCase(), metaX, metaY);

    // Aircraft / Role
    ctx.font = '10px monospace';
    ctx.fillStyle = '#a0ffcc';
    ctx.shadowBlur = 0;
    ctx.fillText((dialogue.aircraft || 'TAC-COM').toUpperCase(), metaX, metaY + 12);

    // Squadron / Affiliation
    ctx.font = '9px monospace';
    ctx.fillStyle = '#60b080';
    ctx.fillText((dialogue.squadron || 'ALLIED FORCES').toUpperCase(), metaX, metaY + 23);

    ctx.restore();

    // Holographic Entry Beaming sweep line effect
    if (dialogue.elapsed < introDuration) {
      const sweepY = portraitY + (dialogue.elapsed / introDuration) * (portraitH + 35);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bubbleX - 10, sweepY);
      ctx.lineTo(portraitX + portraitW + 10, sweepY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // Megaton Nuclear Atmospheric Whiteout Flash
  drawNukeFlash(ctx, canvasWidth, canvasHeight, nukeState) {
    if (!nukeState || nukeState.timer <= 0) return;
    ctx.save();
    const ratio = nukeState.timer / (nukeState.duration || 2.5);
    const alpha = Math.min(1.0, Math.pow(ratio, 0.55) * 1.35);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtle thermal amber secondary bloom ring
    if (alpha > 0.3) {
      const grad = ctx.createRadialGradient(
        canvasWidth * 0.5, canvasHeight * 0.5, 50,
        canvasWidth * 0.5, canvasHeight * 0.5, canvasWidth * 0.75
      );
      grad.addColorStop(0, `rgba(255, 240, 200, ${alpha * 0.6})`);
      grad.addColorStop(1, `rgba(255, 140, 40, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    ctx.restore();
  }

  // Cinematic Sector Fade Transition (Story progression / Sector transfers)
  drawFadeTransition(ctx, canvasWidth, canvasHeight, transition) {
    if (!transition || transition.alpha <= 0) return;
    ctx.save();

    // 1. Fullscreen pure black fade overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${transition.alpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Cinematic letterbox bars & high-tech sector info when sufficiently dark
    if (transition.alpha > 0.35 && transition.title) {
      const textAlpha = Math.min(1.0, (transition.alpha - 0.35) / 0.55);
      ctx.globalAlpha = textAlpha;

      const cx = canvasWidth * 0.5;
      const cy = canvasHeight * 0.5;

      // Cinematic letterbox bands (top & bottom)
      const barH = canvasHeight * 0.11;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, barH);
      ctx.fillRect(0, canvasHeight - barH, canvasWidth, barH);

      // Letterbox border lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, barH); ctx.lineTo(canvasWidth, barH);
      ctx.moveTo(0, canvasHeight - barH); ctx.lineTo(canvasWidth, canvasHeight - barH);
      ctx.stroke();

      // Mission title & sector name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = "bold 26px 'Share Tech Mono', 'Courier New', monospace";
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.fillText(transition.title.toUpperCase(), cx, cy - 24);

      // High-tech divider line
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx - 240, cy);
      ctx.lineTo(cx + 240, cy);
      ctx.stroke();

      // Diamond marker in center of line
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 5);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();

      // Subtitle (Time elapsed / unit movements)
      if (transition.subtitle) {
        ctx.font = "bold 14px 'Share Tech Mono', 'Courier New', monospace";
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10;
        ctx.fillText(transition.subtitle.toUpperCase(), cx, cy + 28);
      }

      // Tactical loading pulse ring
      const pulsePhase = (performance.now() * 0.0035) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.7)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cx, cy + 68, 14, pulsePhase, pulsePhase + 1.8);
      ctx.stroke();

      ctx.font = "11px monospace";
      ctx.fillStyle = '#8ec5ff';
      ctx.shadowBlur = 0;
      ctx.fillText('ESTABLISHING TACTICAL DATALINK...', cx, cy + 96);
    }

    ctx.restore();
  }
}
