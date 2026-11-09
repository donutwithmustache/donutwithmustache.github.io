// Aerodynamic Flight Physics Engine (Stalling, Input Refusal, 5s Spin Crash, and Low-Speed Drift)

export class FlightPhysics {
  constructor(aircraftConfig) {
    this.setConfig(aircraftConfig);
    this.reset();
  }

  setConfig(config) {
    this.config = config;
    this.p = config.physics;
  }

  reset(x = 0, y = 0, heading = 0, speed = 335) {
    this.x = x;
    this.y = y;
    this.heading = heading; // radians (0 = facing East/+X)
    
    // Body-frame velocity components:
    this.vForward = speed;
    this.vLateral = 0;
    
    // World velocity vector
    this.vx = Math.cos(heading) * speed;
    this.vy = Math.sin(heading) * speed;
    this.speed = speed;     // m/s
    
    // Angular dynamics
    this.omega = 0;         // current turn rate (rad/s)
    this.targetOmega = 0;
    
    // Flight state metrics
    this.alpha = 0;         // sideslip / angle-of-attack (radians)
    this.gForce = 1.0;      // Current G-load
    this.turnCompression = 0; // 0 to 1
    this.turnAuthority = 1.0;
    this.throttle = 0.70;   // 0.0 to 1.5
    this.isAirbraking = false;
    this.isAfterburning = false;
    this.isDrifting = false;
    this.isHighG = false;
    
    // Stall dynamics
    this.displayedKph = 300;
    this.isStalled = false;
    this.stallTimer = 0.0;
    this.isCrashed = false;
    this.wasStalled = false;
    this.stallTrajectoryAngle = heading;
    this.psmTrajectoryAngle = heading;
  }

  static wrapAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  update(dt, input) {
    const p = this.p;

    // 1. Throttle & Airbrake logic
    const targetThrottle = input.shift 
      ? 1.5 
      : (input.ctrl ? 0.0 : 0.70);

    this.isAirbraking = input.ctrl;
    this.isAfterburning = input.shift && this.throttle > 1.05;

    // Smooth fast throttle transition
    const throttleRate = input.ctrl ? 4.5 : (input.shift ? 4.0 : 2.5);
    this.throttle += (targetThrottle - this.throttle) * Math.min(1.0, throttleRate * dt);

    // 2. Turn Authority & Aerodynamic Steering
    this.speed = Math.hypot(this.vx, this.vy);
    const flightPathAngle = this.speed > 1.0 ? Math.atan2(this.vy, this.vx) : this.heading;

    // Turn Authority: High-Speed Compression & Low-Speed Dynamic Pressure
    let turnMult = 1.0;
    if (this.speed < p.cornerSpeed) {
      // Dynamic pressure drops as speed drops below corner speed:
      // Lower aerodynamic lift & control surface effectiveness -> wider turning circles at low speeds
      const minRef = p.forcedMinSpeed || 35.0;
      const ratio = Math.max(0, Math.min(1.0, (this.speed - minRef) / (p.cornerSpeed - minRef)));
      turnMult = 0.20 + 0.80 * Math.pow(ratio, 1.5);
      this.turnCompression = 0;
    } else {
      // High speed: aero-elastic compression
      const ratio = Math.min(1.0, (this.speed - p.cornerSpeed) / (p.maxSpeed - p.cornerSpeed));
      this.turnCompression = ratio;
      turnMult = 1.0 - p.compressionFactor * Math.pow(ratio, 1.20);
    }

    this.turnAuthority = Math.max(0.18, turnMult);

    // Scaled instantaneous turn rate: scales down with dynamic pressure at high Mach
    const speedRatio = Math.max(1.0, this.speed / p.cornerSpeed);
    const dynamicRateFactor = Math.pow(speedRatio, -0.65);
    const maxInstantTurnRate = p.baseTurnRate * this.turnAuthority * dynamicRateFactor;

    // Steering & Input Refusal During Stall
    const hasTVC = p.hasThrustVectoring || p.thrustVectoring;
    if (this.isStalled && !hasTVC) {
      // STALL (Conventional Aerodynamics): Plane refuses pilot steering input,
      // but retains its rotational inertia and continues rotating in the axis it was rotating in!
      this.targetOmega = this.omega;
      this.omega *= Math.exp(-0.25 * dt);
    } else {
      // NORMAL FLIGHT OR THRUST-VECTORING POST-STALL: Steering tracks mouse
      const dx = input.targetWorldX - this.x;
      const dy = input.targetWorldY - this.y;
      const distToTarget = Math.hypot(dx, dy);

      let angleError = 0;
      if (distToTarget > 15) {
        const desiredHeading = Math.atan2(dy, dx);
        angleError = FlightPhysics.wrapAngle(desiredHeading - this.heading);
      }

      const maxDeflectionAngle = 0.45; // ~26 degrees
      const deflectionFraction = Math.min(1.0, Math.abs(angleError) / maxDeflectionAngle);
      const smoothDeflection = Math.sin(deflectionFraction * Math.PI * 0.5);

      // In stall with 3D thrust vectoring nozzles, engine exhaust generates immediate turning authority:
      let effectiveTurnRate = maxInstantTurnRate;
      if (this.isStalled && hasTVC) {
        effectiveTurnRate = Math.max(2.8, p.baseTurnRate * 1.05);
      }

      this.targetOmega = Math.sign(angleError) * effectiveTurnRate * smoothDeflection;

      const responseRate = (this.isStalled && hasTVC) ? p.turnResponse * 1.3 : p.turnResponse;
      const dOmega = (this.targetOmega - this.omega) * responseRate * dt;
      this.omega += dOmega;
    }

    // Integrate heading FIRST: nose rotates according to pilot input (or spin inertia)
    this.heading = FlightPhysics.wrapAngle(this.heading + this.omega * dt);

    const minStallPhys = (100 + 250) / 3.6; // 97.22 m/s = 100 KPH displayed
    let forwardThrustAccel = 0;
    let inducedDrag = 0;

    if (this.isStalled) {
      // ========================================================
      // STALLED FLIGHT REGIME (TVC or CONVENTIONAL)
      // ========================================================
      if (hasTVC) {
        // Thrust-Vectoring Post-Stall Maneuver (Ace Combat PSM):
        if (this.isAfterburning) {
          this.speed = Math.min(p.maxSpeed, this.speed + p.accelAfterburner * dt);
        } else {
          const stallProgress = Math.min(1.0, this.stallTimer / 4.0);
          const targetDispKph = p.stallSpeed - (p.stallSpeed - 100) * stallProgress;
          const targetPhysSpeed = (targetDispKph + 250) / 3.6;
          if (this.speed > targetPhysSpeed) {
            const decelRate = ((p.stallSpeed - 100) / (3.6 * 4.0)) * 1.5;
            this.speed = Math.max(targetPhysSpeed, this.speed - decelRate * dt);
          }
        }
        this.speed = Math.max(minStallPhys, this.speed);
        this.vx = Math.cos(this.psmTrajectoryAngle) * this.speed;
        this.vy = Math.sin(this.psmTrajectoryAngle) * this.speed;
      } else {
        // Conventional Aerodynamic Stall (Su-27, F-15C, etc.):
        if (this.isAfterburning) {
          // Afterburner thrust pulls the aircraft forward along its nose
          this.vx += Math.cos(this.heading) * p.accelAfterburner * dt;
          this.vy += Math.sin(this.heading) * p.accelAfterburner * dt;
          this.speed = Math.hypot(this.vx, this.vy);
          this.stallTrajectoryAngle = Math.atan2(this.vy, this.vx);
        } else {
          // Momentum glide / flat spin: smoothly decelerate along entry trajectory
          const stallProgress = Math.min(1.0, this.stallTimer / 4.0);
          const targetDispKph = p.stallSpeed - (p.stallSpeed - 100) * stallProgress;
          const targetPhysSpeed = (targetDispKph + 250) / 3.6;
          if (this.speed > targetPhysSpeed) {
            const decelRate = ((p.stallSpeed - 100) / (3.6 * 4.0)) * 1.5;
            this.speed = Math.max(targetPhysSpeed, this.speed - decelRate * dt);
          }
          this.speed = Math.max(minStallPhys, this.speed);
          this.vx = Math.cos(this.stallTrajectoryAngle) * this.speed;
          this.vy = Math.sin(this.stallTrajectoryAngle) * this.speed;
        }
      }

      this.alpha = FlightPhysics.wrapAngle(this.heading - (hasTVC ? this.psmTrajectoryAngle : this.stallTrajectoryAngle));
      this.alphaDeg = Math.abs(this.alpha * 180 / Math.PI);

      const physKph = this.speed * 3.6;
      this.displayedKph = Math.max(100, Math.round(physKph - 250));

      // Stall recovery (hysteresis) or crash timeout:
      const recoveryThreshold = p.stallSpeed + 25;
      if (this.isAfterburning && this.displayedKph >= recoveryThreshold) {
        this.isStalled = false;
        this.stallTimer = 0;
        if (hasTVC) {
          // TVC snaps flight path instantly to where nose is pointed
          this.vx = Math.cos(this.heading) * this.speed;
          this.vy = Math.sin(this.heading) * this.speed;
        }
      } else {
        this.stallTimer += dt;
        if (this.stallTimer >= 4.0) {
          this.isCrashed = true;
        }
      }
    } else {
      // ========================================================
      // NORMAL FLIGHT (NOT STALLED)
      // ========================================================
      const cosH = Math.cos(this.heading);
      const sinH = Math.sin(this.heading);

      let vF = this.vx * cosH + this.vy * sinH;
      let vL = -this.vx * sinH + this.vy * cosH;

      if (vF < 0) vF = 0;

      this.alpha = FlightPhysics.wrapAngle(this.heading - flightPathAngle);
      this.alphaDeg = Math.abs(this.alpha * 180 / Math.PI);

      // Forward Thrust & Aerodynamic Drag
      forwardThrustAccel = 0;
      if (this.isAfterburning) {
        forwardThrustAccel = p.accelAfterburner;
      } else if (!this.isAirbraking) {
        if (this.speed <= p.normalMinSpeed) {
          forwardThrustAccel = p.accelCruise * 1.5;
        } else if (this.speed < p.cruiseSpeed) {
          forwardThrustAccel = 25;
        } else {
          forwardThrustAccel = -20;
        }
      }

      let dragMagnitude = p.highAlphaDrag || 70;
      if (this.isAfterburning) {
        dragMagnitude = p.inducedDragFactor || 12;
      }

      let compDamping = 1.0;
      if (this.turnCompression > 0.45) {
        compDamping = Math.max(0.02, 1.0 - (this.turnCompression - 0.45) / 0.35);
      }

      const alphaFactor = Math.sin(this.alpha) * Math.sin(this.alpha);
      inducedDrag = dragMagnitude * alphaFactor * compDamping;
      vF += (forwardThrustAccel - inducedDrag) * dt;

      if (this.isAirbraking) {
        const brakeAmount = (p.airbrakeDecel || 75) * dt;
        const currentV = Math.hypot(vF, vL);
        if (currentV > minStallPhys) {
          const newV = Math.max(minStallPhys, currentV - brakeAmount);
          const brakeRatio = newV / currentV;
          vF *= brakeRatio;
          vL *= brakeRatio;
        }
      }

      const minFwd = this.isAirbraking ? minStallPhys : p.normalMinSpeed;
      vF = Math.max(minFwd, Math.min(p.maxSpeed, vF));

      // Lateral Drift & Directional Stability:
      let gripFactor = 1.0;
      if (this.displayedKph < 500) {
        const speedRatio = Math.max(0, Math.min(1.0, (this.displayedKph - 150) / 350));
        gripFactor = 0.65 + 0.35 * Math.pow(speedRatio, 1.5);
      }

      const effectiveGrip = (p.grip || 3.0) * gripFactor * (2.0 - (p.driftTolerance || 0.7));
      const lateralDecay = Math.exp(-effectiveGrip * dt);
      vL *= lateralDecay;

      // Reconstruct World Velocity
      this.vx = vF * cosH - vL * sinH;
      this.vy = vF * sinH + vL * cosH;
      this.speed = Math.hypot(this.vx, this.vy);

      const absMinSpeed = this.isAirbraking ? minStallPhys : p.normalMinSpeed;
      if (this.speed < absMinSpeed) {
        const scale = absMinSpeed / Math.max(0.001, this.speed);
        this.vx *= scale;
        this.vy *= scale;
        this.speed = absMinSpeed;
      }

      const physKph = this.speed * 3.6;
      this.displayedKph = this.isAirbraking 
        ? Math.max(100, Math.round(physKph - 250))
        : Math.max(300, Math.round(physKph - 250));

      // Check stall entry:
      if (this.isAirbraking && this.displayedKph <= p.stallSpeed) {
        this.isStalled = true;
        this.stallTimer = 0;
        this.stallTrajectoryAngle = this.speed > 1.0 ? Math.atan2(this.vy, this.vx) : this.heading;
        this.psmTrajectoryAngle = this.stallTrajectoryAngle;
      } else {
        this.stallTimer = Math.max(0, this.stallTimer - dt * 3.0);
      }
    }

    this.wasStalled = this.isStalled;

    // Integrate position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 8. Real Scaled G-Force Calculation
    const newFlightPathAngle = this.speed > 1.0 ? Math.atan2(this.vy, this.vx) : this.heading;
    const flightPathTurnRate = Math.abs(FlightPhysics.wrapAngle(newFlightPathAngle - flightPathAngle)) / Math.max(0.001, dt);
    const centripetalAcc = this.speed * flightPathTurnRate;
    const linearAcc = Math.abs(forwardThrustAccel - inducedDrag);

    const maxAllowedG = 1.0 + ((p.maxG || 11.5) - 1.0) * (1.0 - this.turnCompression * 0.32);
    const rawG = Math.sqrt(1.0 + Math.pow(centripetalAcc / 9.81, 2) + Math.pow((linearAcc / 9.81) * 0.3, 2));
    this.gForce = Math.min(maxAllowedG, rawG);

    this.isHighG = this.gForce > 7.0;
    this.isDrifting = this.alphaDeg > 12.0 && this.speed > 60;

    return {
      x: this.x,
      y: this.y,
      heading: this.heading,
      speed: this.speed,
      vx: this.vx,
      vy: this.vy,
      alpha: this.alpha,
      alphaDeg: this.alphaDeg,
      gForce: this.gForce,
      throttle: this.throttle,
      isAirbraking: this.isAirbraking,
      isAfterburning: this.isAfterburning,
      isDrifting: this.isDrifting,
      isHighG: this.isHighG,
      turnAuthority: this.turnAuthority,
      turnCompression: this.turnCompression,
      flightPathAngle: newFlightPathAngle,
      displayedKph: this.displayedKph,
      isStalled: this.isStalled,
      stallTimer: this.stallTimer,
      isCrashed: this.isCrashed
    };
  }
}
