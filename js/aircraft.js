// ==========================================
// AIRCRAFT DATA, SPECIAL WEAPONS & ABILITIES REGISTRY
// ==========================================

// ------------------------------------------
// SPECIAL WEAPONS DICTIONARY TABLE
// ------------------------------------------
export const SPECIAL_WEAPONS = {
  qaam: {
    id: 'qaam',
    name: 'Quick Air-to-Air Missile',
    subName: 'QUICK-MANEUVER AAM',
    code: 'QAAM',
    type: 'air',
    pool: 2,
    cooldown: 4.5,            // Recharge time per slot in seconds (variable per weapon)
    rechargeTime: 4.5,
    defaultAmmo: 24,
    sprite: './assets/weapons/r73.png',
    description: 'HIGHLY MANEUVERABLE MISSILE FOR HITTING VERY AGILE TARGETS'
  },
  saam: {
    id: 'saam',
    name: 'Semi-Active Air-to-Air Missile',
    subName: 'SEMI-ACTIVE AAM',
    code: 'SAAM',
    type: 'air',
    pool: 2,
    cooldown: 5.5,            // Recharge time per slot in seconds
    rechargeTime: 5.5,
    defaultAmmo: 20,
    sprite: './assets/weapons/aim7.png',
    description: 'SEMI-ACTIVE GUIDANCE REQUIRES MAINTAINING BORESIGHT RADAR LOCK'
  },
  '4aam': {
    id: '4aam',
    name: '4-Target Air-to-Air Missile',
    subName: '4x AIR-AIR MISSILE',
    code: '4AAM',
    type: 'air',
    isMultiLock: true,
    maxLocks: 4,
    pool: 4,
    cooldown: 7.0,            // Recharge time per slot in seconds
    rechargeTime: 7.0,
    defaultAmmo: 36,
    sprite: './assets/weapons/aim120.png',
    description: 'ACTIVE RADAR GUIDANCE TARGETS 4 DIFFERENT PLANES AT ONCE'
  },
  hpaa: {
    id: 'hpaa',
    name: 'High-Power Air-to-Air Missile',
    subName: 'HEAVY IMPACT AAM',
    code: 'HPAA',
    type: 'air',
    pool: 2,
    cooldown: 5.0,            // Recharge time per slot in seconds
    rechargeTime: 5.0,
    defaultAmmo: 18,
    sprite: './assets/weapons/aim54.png',
    description: 'HEAVY MISSILE WITH MASSIVE KINETIC & EXPLOSIVE HITBOX'
  },
  ugb: {
    id: 'ugb',
    name: 'Unguided Heavy Bomb',
    subName: 'FREE-FALL BOMB',
    code: 'UGB',
    type: 'ground',
    pool: 2,
    cooldown: 3.5,            // Recharge time per slot in seconds
    rechargeTime: 3.5,
    defaultAmmo: 44,
    sprite: './assets/weapons/mk84.png',
    description: 'HEAVY FREE-FALL HIGH-EXPLOSIVE BOMB WITH WIDE SHOCKWAVE'
  },
  lasm: {
    id: 'lasm',
    name: 'Long-Range Anti-Surface Missile',
    subName: 'ANTI-SURFACE MISSILE',
    code: 'LASM',
    type: 'ground',
    pool: 2,
    cooldown: 6.0,            // Recharge time per slot in seconds
    rechargeTime: 6.0,
    defaultAmmo: 24,
    sprite: './assets/weapons/agm88.png',
    description: 'HIGH-VELOCITY SEA-SKIMMING CRUISE STRIKE MISSILE'
  },
  sffs: {
    id: 'sffs',
    name: 'Submunition Cluster Dispenser',
    subName: 'CLUSTER BOMB',
    code: 'SFFS',
    type: 'ground',
    pool: 2,
    cooldown: 4.8,            // Recharge time per slot in seconds
    rechargeTime: 4.8,
    defaultAmmo: 32,
    sprite: './assets/weapons/cbu.png',
    description: 'WIDE CARPET OF EXPLOSIVE SUBMUNITIONS ACROSS BROAD AREA'
  },
  mpbm: {
    id: 'mpbm',
    name: 'Multi-Purpose Burst Missile',
    subName: 'BURST MISSILE',
    code: 'MPBM',
    type: 'all',
    pool: 1,
    cooldown: 9.0,            // Recharge time per slot in seconds
    rechargeTime: 9.0,
    defaultAmmo: 12,
    sprite: './assets/weapons/mpbm.png',
    description: 'TACTICAL EXPANDING THERMOBARIC BURST SPHERE DETONATION'
  }
};

// ------------------------------------------
// ABILITIES DICTIONARY TABLE
// ------------------------------------------
export const ABILITIES = {
  aoaLimiter: {
    id: 'aoaLimiter',
    name: 'AoA Limiter',
    code: 'AOA',
    duration: 1.5,
    cooldown: 5.0,
    charges: 1,
    rechargeTime: 5.0,
    description: 'Bypasses angle-of-attack limits below 400 kph, locking flight trajectory for up to 1.5s while allowing nose to point anywhere, followed by 1s mouse pointing. Cancels below 130 kph. 5s cooldown starts after ability ends.'
  },
  emDispenser: {
    id: 'emDispenser',
    name: 'Electromechanical Dispenser',
    code: 'EMD',
    duration: 2.0,
    cooldown: 35.0,
    charges: 1,
    rechargeTime: 35.0,
    description: 'Rapid-fires an intense continuous string of flares behind the plane for 2 seconds. Flares linger in the air 1 second longer. 35s cooldown starts after ability ends.'
  },
  sensorFusion: {
    id: 'sensorFusion',
    name: 'Sensor Fusion',
    code: 'SNS',
    duration: 5.0,
    cooldown: 20.0,
    charges: 1,
    rechargeTime: 20.0,
    description: 'Integrates radar and optical sensor arrays, making planes with stealth 1, 2, and 3 visible from 150% further distance for 5 seconds. 20s cooldown starts after ability ends.'
  },
  cobraManeuver: {
    id: 'cobraManeuver',
    name: 'Cobra Maneuver',
    code: 'CBR',
    duration: 1.8,
    cooldown: 25.0,
    charges: 1,
    rechargeTime: 25.0,
    description: 'Pitches airframe vertically into a Pugachev Cobra, rapidly shedding speed to just above stall speed while generating thick wing vapor. 25s cooldown starts after ability ends.'
  },
  emergencyAfterburner: {
    id: 'emergencyAfterburner',
    name: 'Emergency Stage Afterburner',
    code: 'E-AB',
    duration: 4.0,
    cooldown: 45.0,
    charges: 1,
    rechargeTime: 45.0,
    description: 'Injects emergency stage fuel boosting acceleration to 160% and top speed to 110% for 4 seconds before returning to normal. 45s cooldown starts after ability ends.'
  }
};

// ------------------------------------------
// COMBAT PLANE ROLES & DAMAGE PROFILES
// ------------------------------------------
export const PLANE_ROLES = {
  FIGHTER: {
    id: 'FIGHTER',
    name: 'Fighter',
    airMult: 1.00,       // 100% against air targets
    surfaceMult: 0.60,   // 60% against surface targets
    badge: 'AIR SUPERIORITY',
    description: 'Deals 100% damage against air targets and 60% damage against surface targets.'
  },
  STRIKE: {
    id: 'STRIKE',
    name: 'Strike',
    airMult: 0.60,       // 60% against air targets
    surfaceMult: 1.00,   // 100% against surface targets
    badge: 'GROUND ATTACK',
    description: 'Deals 60% damage against air targets and 100% damage against surface targets.'
  },
  MULTIROLE: {
    id: 'MULTIROLE',
    name: 'Multirole',
    airMult: 0.85,       // 85% against all targets
    surfaceMult: 0.85,   // 85% against all targets
    badge: 'MULTI-ROLE',
    description: 'Deals 85% damage against all targets.'
  },
  ECM: {
    id: 'ECM',
    name: 'ECM',
    airMult: 0.70,       // 70% against all targets
    surfaceMult: 0.70,   // 70% against all targets
    badge: 'ELECTRONIC WARFARE',
    description: 'Deals 70% damage against all targets.'
  }
};

// ------------------------------------------
// AIRCRAFT DEFINITIONS & UNIQUE LOADOUTS
// ------------------------------------------
export const AIRCRAFT_DATA = {
  su27: {
    id: 'su27',
    name: 'Su-27 Flanker',
    shortName: 'Su-27',
    role: 'Air Superiority Fighter',
    planeRole: 'FIGHTER',
    tier: 5,
    partSlots: 4,
    cost: 220000,
    sprite: './assets/planes/su27.png',
    tags: ['AIR_SUPERIORITY', 'SUPERMANEUVERABLE', 'PSM', 'HEAVY_FIGHTER'],
    
    // Core stats (SPD is active maneuverability stat)
    stats: {
      spd: 92, // Maneuverability
      def: 65,
      air: 95,
      gnd: 50,
      stealth: 0
    },

    // Weapons Loadout (Unique to Su-27)
    weapons: {
      gunAmmo: 600,             // 30mm GSh-30-1 internal cannon
      maxGunAmmo: 600,
      gunRpm: 1500,             // 1500 RPM heavy autocannon
      gunDamage: 1.6,           // Balanced for ~1.5s sustained fire to kill a fighter
      mslCount: 84,             // R-73 / Standard Missiles
      maxMslCount: 84,
      mslCooldown: 4.4,         // 4.4s slot recharge time (50% of previous rate)
      flareCount: 36,           // Twin APP-50 countermeasure dispensers
      maxFlareCount: 36,
      flarePool: 2,             // 2 flare reload slots [||]
      flareCooldown: 22.5,      // 22.5s slot recharge time (20% of previous rate)
      
      // 3 Special weapons available (only 1 equipped at a time)
      specialWeapons: ['qaam', '4aam', 'hpaa'],
      equippedSpecialWeapon: 'qaam',
      spwAmmo: {
        qaam: 24,
        '4aam': 32,
        hpaa: 18
      },

      // Aircraft tactical ability
      ability: 'cobraManeuver',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 25.0
    },

    // Aerodynamics & Physical Parameters
    physics: {
      mass: 16500,               // kg
      accelCruise: 70,            // m/s^2 forward thrust acceleration
      accelAfterburner: 155,      // m/s^2 punchy afterburner surge (accelerates easily through turns)
      airbrakeDecel: 95,          // m/s^2 airbrake braking (crisp bleed into stall)
      baseTurnRate: 2.7,          // rad/s (~155 deg/s pitch rate - supermaneuverable nose authority)
      turnResponse: 12.0,         // Rotational agility
      cornerSpeed: 275,           // m/s (~990 km/h physical, displays ~740 KPH)
      normalMinSpeed: 152.8,      // m/s (550 km/h physical / 300 KPH displayed normal straight flight floor)
      forcedMinSpeed: 97.22,      // m/s (350 km/h physical / 100 KPH displayed stall floor)
      stallSpeed: 275,            // Displayed KPH stall threshold (readily entered upon holding airbrake)
      cruiseSpeed: 320,           // m/s (~1152 km/h, displays ~902 KPH)
      maxSpeed: 520,              // m/s (~1872 km/h physical, displays ~1622 KPH)
      compressionFactor: 0.48,    // High-speed compression
      maxG: 12.0,                 // Structural G limit
      grip: 3.2,                  // Lateral drift decay rate at cruise
      highAlphaDrag: 75,          // Heavy induced drag when turning without afterburner (bleeds speed into stall)
      inducedDragFactor: 12.0,    // Low turn drag in afterburner: plane accelerates easily in turns
      driftTolerance: 0.95,       // Outstanding high-alpha post-stall drift capability
      engineCount: 2,
      nozzleSpacing: 22,
      wingspan: 88,
      wingtipChord: -19,
      length: 110,
      engineOffset: -48
    },
    
    description: 'Supreme maneuverability with thrust-vectoring agility. Equipped with QAAM/4AAM/HPAA and 36 flares.'
  },

  f15c: {
    id: 'f15c',
    name: 'F-15C Eagle',
    shortName: 'F-15C',
    role: 'All-Weather Air Superiority',
    planeRole: 'FIGHTER',
    tier: 4,
    partSlots: 3,
    cost: 180000,
    sprite: './assets/planes/f15c.png',
    tags: ['AIR_SUPERIORITY', 'HIGH_SPEED', 'SUPERCRUISE', 'HEAVY_FIGHTER'],
    
    // Core stats
    stats: {
      spd: 75, // Maneuverability
      def: 75,
      air: 90,
      gnd: 40,
      stealth: 0
    },

    // Weapons Loadout (Unique to F-15C Eagle benchmark)
    weapons: {
      gunAmmo: 940,             // 20mm M61A1 Vulcan cannon
      maxGunAmmo: 940,
      gunRpm: 4000,             // 4000 RPM high-rate rotary Gatling
      gunDamage: 0.65,          // Balanced for ~1.4s sustained fire to kill a fighter
      mslCount: 120,            // Standard Missiles
      maxMslCount: 120,
      mslCooldown: 4.4,         // 4.4s slot recharge time (50% of previous rate)
      flareCount: 30,           // AN/ALE-45 Countermeasure Flares
      maxFlareCount: 30,
      flarePool: 2,             // 2 flare reload slots [||]
      flareCooldown: 20.0,      // 20.0s slot recharge time (20% of previous rate)

      // 3 Special weapons available (only 1 equipped at a time)
      specialWeapons: ['4aam', 'saam', 'qaam'],
      equippedSpecialWeapon: '4aam',
      spwAmmo: {
        '4aam': 36,
        saam: 20,
        qaam: 24
      },

      // Aircraft tactical ability
      ability: 'emergencyAfterburner',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 45.0
    },

    // Aerodynamics & Physical Parameters
    physics: {
      mass: 20200,               // kg
      accelCruise: 62,            // m/s^2
      accelAfterburner: 142,      // m/s^2
      airbrakeDecel: 80,          // m/s^2
      baseTurnRate: 2.1,          // rad/s (~120 deg/s pitch rate - balanced fighter turn radius)
      turnResponse: 9.5,          // Crisp response
      cornerSpeed: 290,           // m/s (~1044 km/h physical, displays ~794 KPH)
      normalMinSpeed: 152.8,      // m/s (550 km/h physical / 300 KPH displayed normal straight flight floor)
      forcedMinSpeed: 97.22,      // m/s (350 km/h physical / 100 KPH displayed stall floor)
      stallSpeed: 280,            // Displayed KPH stall threshold
      cruiseSpeed: 335,           // m/s (~1206 km/h, displays ~956 KPH)
      maxSpeed: 541.7,            // m/s (~1950 km/h physical, displays as 1700 KPH top speed)
      compressionFactor: 0.58,    // Noticeable compression
      maxG: 11.5,                 // Structural G limit
      grip: 3.0,                  // Balanced lateral grip
      highAlphaDrag: 70,          // Heavy induced drag when turning without afterburner
      inducedDragFactor: 10.0,    // Low turn drag in afterburner
      driftTolerance: 0.70,
      engineCount: 2,
      nozzleSpacing: 20,
      wingspan: 78,
      wingtipChord: -16,
      length: 104,
      engineOffset: -46
    },

    description: 'The golden benchmark. Superb thrust-to-weight and energy retention. Equipped with 4AAM/SAAM/QAAM and 940 gun rounds.'
  },

  f111f: {
    id: 'f111f',
    name: 'F-111F Aardvark',
    shortName: 'F-111F',
    role: 'Heavy Strike Bomber / Interdictor',
    planeRole: 'STRIKE',
    tier: 2,
    partSlots: 2,
    cost: 75000,
    sprite: './assets/planes/f111f.png',
    tags: ['STRIKE', 'VARIABLE_GEOMETRY', 'TERRAIN_FOLLOWING', 'SUPERCRUISE'],
    
    // Core stats
    stats: {
      spd: 45, // Maneuverability
      def: 90,
      air: 35,
      gnd: 98,
      stealth: 0
    },

    // Weapons Loadout (Unique to F-111F Strike Interdictor)
    weapons: {
      gunAmmo: 1200,            // Heavy internal cannon drum
      maxGunAmmo: 1200,
      gunRpm: 3000,             // 3000 RPM strike strafing rate
      gunDamage: 0.85,          // Balanced for ~1.4s sustained fire to kill a fighter
      mslCount: 60,             // Dedicated strike bomber payload
      maxMslCount: 60,
      mslCooldown: 4.4,         // 4.4s slot recharge time (50% of previous rate)
      flareCount: 48,           // Large dual dispenser pack
      maxFlareCount: 48,
      flarePool: 4,             // 4 flare reload slots [||||] for heavy strike bomber
      flareCooldown: 17.5,      // 17.5s slot recharge time (20% of previous rate)

      // 3 Special weapons available (only 1 equipped at a time)
      specialWeapons: ['ugb', 'lasm', 'sffs'],
      equippedSpecialWeapon: 'ugb',
      spwAmmo: {
        ugb: 44,
        lasm: 24,
        sffs: 32
      },

      // Aircraft tactical ability
      ability: 'emDispenser',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 35.0
    },

    // Aerodynamics & Physical Parameters
    physics: {
      mass: 38500,               // kg
      accelCruise: 52,            // m/s^2
      accelAfterburner: 125,      // m/s^2
      airbrakeDecel: 85,          // m/s^2
      baseTurnRate: 1.4,          // rad/s (~80 deg/s pitch rate - heavy bomber turn radius)
      turnResponse: 4.8,          // Heavy rotational inertia
      cornerSpeed: 320,           // m/s (~1152 km/h physical, displays ~902 KPH)
      normalMinSpeed: 152.8,      // m/s (550 km/h physical / 300 KPH displayed normal straight flight floor)
      forcedMinSpeed: 97.22,      // m/s (350 km/h physical / 100 KPH displayed stall floor)
      stallSpeed: 260,            // Displayed KPH stall threshold
      cruiseSpeed: 360,           // m/s (~1296 km/h, displays ~1046 KPH)
      maxSpeed: 595.5,            // m/s (~2144 km/h physical, displays as 1894 KPH)
      compressionFactor: 0.76,    // Heavy high-speed compression
      maxG: 8.5,
      grip: 1.6,                  // Heavy drift / skid
      highAlphaDrag: 65,          // Heavy drag
      inducedDragFactor: 8.0,
      driftTolerance: 0.45,
      engineCount: 2,
      nozzleSpacing: 18,
      wingspan: 58,
      wingtipChord: -43,
      length: 118,
      engineOffset: -52
    },

    description: 'Heavy strike interdictor with massive surface strike payload. Equipped with UGB/LASM/SFFS and 48 flares.'
  },

  su57: {
    id: 'su57',
    name: 'Su-57 Felon',
    shortName: 'Su-57',
    role: '5th Gen Stealth Multirole',
    planeRole: 'MULTIROLE',
    tier: 9,
    partSlots: 5,
    cost: 850000,
    sprite: './assets/planes/su57.png',
    tags: ['STEALTH', 'SUPERMANEUVERABLE', 'PSM', 'SUPERCRUISE', 'MULTIROLE'],

    // Core stats
    stats: {
      spd: 96, // 3D Thrust-vectoring maneuverability
      def: 70,
      air: 98,
      gnd: 65,
      stealth: 3
    },

    // Weapons Loadout
    weapons: {
      gunAmmo: 700,             // 30mm 9A1-4071K internal cannon
      maxGunAmmo: 700,
      gunRpm: 1800,             // 1800 RPM modernized autocannon
      gunDamage: 1.4,           // Balanced for ~1.4s sustained fire to kill a fighter
      mslCount: 96,             // Internal tandem weapons bays
      maxMslCount: 96,
      mslCooldown: 4.4,         // 4.4s slot recharge time (50% of previous rate)
      flareCount: 40,           // UV missile warning countermeasure dispensers
      maxFlareCount: 40,
      flarePool: 3,             // 3 flare reload slots [|||] for 5th-gen fighter
      flareCooldown: 19.0,      // 19.0s slot recharge time (20% of previous rate)

      // 3 Special weapons available (only 1 equipped at a time)
      specialWeapons: ['qaam', '4aam', 'mpbm'],
      equippedSpecialWeapon: 'qaam',
      spwAmmo: {
        qaam: 28,
        '4aam': 36,
        mpbm: 14
      },

      // Aircraft tactical ability
      ability: 'aoaLimiter',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 5.0
    },

    // Aerodynamics & Physical Parameters
    physics: {
      mass: 18500,               // kg
      accelCruise: 76,            // m/s^2
      accelAfterburner: 165,      // m/s^2 (Izdeliye 30 3D TVC engines)
      airbrakeDecel: 85,          // m/s^2
      baseTurnRate: 2.9,          // rad/s (~166 deg/s pitch rate - extreme nose authority)
      turnResponse: 13.0,         // Ultra-crisp response
      cornerSpeed: 285,           // m/s (~1026 km/h physical, displays ~776 KPH)
      normalMinSpeed: 152.8,      // m/s (550 km/h physical / 300 KPH displayed normal straight flight floor)
      forcedMinSpeed: 97.22,      // m/s (350 km/h physical / 100 KPH displayed stall floor)
      stallSpeed: 260,            // Displayed KPH stall threshold
      cruiseSpeed: 340,           // m/s (~1224 km/h, displays ~974 KPH)
      maxSpeed: 565.0,            // m/s (~2034 km/h physical, displays ~1784 KPH)
      compressionFactor: 0.42,    // High-speed compression resistance
      maxG: 12.5,                 // Structural G limit
      grip: 3.2,                  // Lateral grip
      highAlphaDrag: 70,
      inducedDragFactor: 9.5,
      driftTolerance: 0.98,
      hasThrustVectoring: true,   // RETAINS NOSE/STEERING AUTHORITY EVEN IN A STALL!
      engineCount: 2,
      nozzleSpacing: 26,
      wingspan: 94,
      wingtipChord: -22,
      length: 114,
      engineOffset: -50
    },

    description: 'Next-gen stealth fighter with 3D all-axis thrust vectoring. Retains full nose authority during stalls.'
  },

  a4: {
    id: 'a4',
    name: 'A-4E Skyhawk',
    shortName: 'A-4E',
    role: 'Light Attack Strike Aircraft',
    planeRole: 'STRIKE',
    tier: 0,
    partSlots: 1,
    cost: 1000,
    sprite: './assets/planes/a4e.png',
    tags: ['STRIKE', 'CARRIER_CAPABLE', 'NAVAL'],
    stats: {
      spd: 48,
      def: 50,
      air: 40,
      gnd: 72,
      stealth: 0
    },
    weapons: {
      gunAmmo: 400,
      maxGunAmmo: 400,
      gunRpm: 1200,
      gunDamage: 1.1,
      mslCount: 40,
      maxMslCount: 40,
      mslCooldown: 4.4,
      flareCount: 20,
      maxFlareCount: 20,
      flarePool: 2,
      flareCooldown: 22.0,
      specialWeapons: ['ugb', 'lasm', 'saam'],
      equippedSpecialWeapon: 'ugb',
      spwAmmo: { ugb: 24, lasm: 14, saam: 12 },
      ability: 'emergencyAfterburner',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 45.0
    },
    physics: {
      mass: 8300,
      accelCruise: 50,
      accelAfterburner: 110,
      airbrakeDecel: 75,
      baseTurnRate: 1.9,
      turnResponse: 8.5,
      cornerSpeed: 240,
      normalMinSpeed: 130,
      forcedMinSpeed: 85,
      stallSpeed: 230,
      cruiseSpeed: 280,
      maxSpeed: 440,
      compressionFactor: 0.60,
      maxG: 9.0,
      grip: 2.8,
      highAlphaDrag: 65,
      inducedDragFactor: 11.0,
      driftTolerance: 0.65,
      engineCount: 1,
      nozzleSpacing: 0,
      wingspan: 60,
      wingtipChord: -14,
      length: 82,
      engineOffset: -38
    },
    description: 'Lightweight agile strike aircraft with dependable ground attack munitions and carrier capability.'
  },

  etendard: {
    id: 'etendard',
    name: 'Super Étendard IV',
    shortName: 'Étendard',
    role: 'Carrier Strike Multirole',
    planeRole: 'MULTIROLE',
    tier: 0,
    partSlots: 1,
    cost: 1000,
    sprite: './assets/planes/etendard_iv.png',
    tags: ['MULTIROLE', 'CARRIER_CAPABLE', 'NAVAL'],
    stats: {
      spd: 52,
      def: 54,
      air: 52,
      gnd: 62,
      stealth: 0
    },
    weapons: {
      gunAmmo: 500,
      maxGunAmmo: 500,
      gunRpm: 1300,
      gunDamage: 1.0,
      mslCount: 44,
      maxMslCount: 44,
      mslCooldown: 4.4,
      flareCount: 24,
      maxFlareCount: 24,
      flarePool: 2,
      flareCooldown: 22.0,
      specialWeapons: ['lasm', 'qaam', 'ugb'],
      equippedSpecialWeapon: 'lasm',
      spwAmmo: { lasm: 16, qaam: 16, ugb: 20 },
      ability: 'emergencyAfterburner',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 45.0
    },
    physics: {
      mass: 9200,
      accelCruise: 52,
      accelAfterburner: 118,
      airbrakeDecel: 78,
      baseTurnRate: 2.0,
      turnResponse: 9.0,
      cornerSpeed: 250,
      normalMinSpeed: 135,
      forcedMinSpeed: 88,
      stallSpeed: 240,
      cruiseSpeed: 290,
      maxSpeed: 460,
      compressionFactor: 0.58,
      maxG: 9.5,
      grip: 2.9,
      highAlphaDrag: 68,
      inducedDragFactor: 10.5,
      driftTolerance: 0.70,
      engineCount: 1,
      nozzleSpacing: 0,
      wingspan: 64,
      wingtipChord: -15,
      length: 88,
      engineOffset: -40
    },
    description: 'Versatile French carrier-borne multirole strike platform with deadly anti-ship and precision ordnance.'
  },

  mig17: {
    id: 'mig17',
    name: 'MiG-17PF Fresco',
    shortName: 'MiG-17PF',
    role: 'Radar Interceptor Fighter',
    planeRole: 'FIGHTER',
    tier: 0,
    partSlots: 1,
    cost: 1000,
    sprite: './assets/planes/mig17pf.png',
    tags: ['AIR_SUPERIORITY', 'INTERCEPTOR'],
    stats: {
      spd: 60,
      def: 45,
      air: 65,
      gnd: 35,
      stealth: 0
    },
    weapons: {
      gunAmmo: 350,
      maxGunAmmo: 350,
      gunRpm: 900,
      gunDamage: 1.8,
      mslCount: 36,
      maxMslCount: 36,
      mslCooldown: 4.4,
      flareCount: 18,
      maxFlareCount: 18,
      flarePool: 2,
      flareCooldown: 22.0,
      specialWeapons: ['qaam', 'saam', '4aam'],
      equippedSpecialWeapon: 'qaam',
      spwAmmo: { qaam: 18, saam: 14, '4aam': 18 },
      ability: 'emergencyAfterburner',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 45.0
    },
    physics: {
      mass: 6100,
      accelCruise: 54,
      accelAfterburner: 122,
      airbrakeDecel: 80,
      baseTurnRate: 2.3,
      turnResponse: 10.0,
      cornerSpeed: 245,
      normalMinSpeed: 130,
      forcedMinSpeed: 82,
      stallSpeed: 235,
      cruiseSpeed: 300,
      maxSpeed: 470,
      compressionFactor: 0.55,
      maxG: 10.0,
      grip: 3.0,
      highAlphaDrag: 64,
      inducedDragFactor: 10.0,
      driftTolerance: 0.72,
      engineCount: 1,
      nozzleSpacing: 0,
      wingspan: 58,
      wingtipChord: -14,
      length: 76,
      engineOffset: -36
    },
    description: 'High-turn-rate transonic interceptor equipped with radar-ranging avionics and heavy autocannons.'
  },

  f15manx: {
    id: 'f15manx',
    name: 'F-15 S/MTD Manx',
    shortName: 'F-15 MANX',
    role: 'Experimental 2D-TVC Fighter',
    planeRole: 'FIGHTER',
    tier: 7,
    partSlots: 4,
    cost: 320000,
    sprite: './assets/planes/f15manx.png',
    tags: ['EVO', 'AIR_SUPERIORITY', 'SUPERMANEUVERABLE', 'PSM', 'THRUST_VECTORING'],
    evoBaseId: 'f15c',
    stats: {
      spd: 88,
      def: 80,
      air: 96,
      gnd: 55,
      stealth: 1
    },
    weapons: {
      gunAmmo: 940,
      maxGunAmmo: 940,
      gunRpm: 4500,
      gunDamage: 0.75,
      mslCount: 130,
      maxMslCount: 130,
      mslCooldown: 4.0,
      flareCount: 36,
      maxFlareCount: 36,
      flarePool: 3,
      flareCooldown: 18.0,
      specialWeapons: ['4aam', 'saam', 'qaam'],
      equippedSpecialWeapon: '4aam',
      spwAmmo: { '4aam': 44, saam: 26, qaam: 30 },
      ability: 'emergencyAfterburner',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 40.0
    },
    physics: {
      mass: 19800,
      accelCruise: 70,
      accelAfterburner: 160,
      airbrakeDecel: 90,
      baseTurnRate: 2.6,
      turnResponse: 11.5,
      cornerSpeed: 295,
      normalMinSpeed: 140,
      forcedMinSpeed: 90,
      stallSpeed: 265,
      cruiseSpeed: 345,
      maxSpeed: 555,
      compressionFactor: 0.45,
      maxG: 12.0,
      grip: 3.2,
      highAlphaDrag: 68,
      inducedDragFactor: 9.8,
      driftTolerance: 0.90,
      hasThrustVectoring: true,
      engineCount: 2,
      nozzleSpacing: 20,
      wingspan: 80,
      wingtipChord: -16,
      length: 106,
      engineOffset: -46
    },
    description: 'EVO Special Airframe: Active canards and rectangular 2D thrust-vectoring nozzles unlock extreme pitch agility.'
  }
};

// ------------------------------------------
// STANDARD AIRCRAFT TAGS CATALOGUE
// ------------------------------------------
export const AIRCRAFT_TAGS = [
  'VTOL',                  // Vertical Take-Off and Landing
  'NAVAL',                 // Carrier-operable / Tailhook
  'CARRIER_CAPABLE',       // Certified for CATOBAR / STOBAR / STOVL
  'STEALTH',               // Low-observable radar cross section
  'SUPERCRUISE',           // Sustained supersonic flight without afterburners
  'PSM',                   // Post-Stall Maneuvering capable
  'THRUST_VECTORING',      // 2D or 3D TVC nozzles
  'VARIABLE_GEOMETRY',     // Swing-wing / variable-sweep wings
  'AIR_SUPERIORITY',       // Dedicated air-to-air fighter
  'STRIKE',                // Dedicated ground-attack / interdictor
  'MULTIROLE',             // Multi-mission air-to-air and air-to-ground
  'INTERCEPTOR',           // High-speed point defense interceptor
  'ELECTRONIC_WARFARE',    // Advanced EW jamming and SEAD
  'HEAVY_FIGHTER',         // Large airframe with extended payload
  'TERRAIN_FOLLOWING',     // Low-altitude strike radar
  'HIGH_SPEED',            // Mach 2.3+ high-velocity flight
  'GUNSHIP',               // Heavy sustained cannon armament
  'DRONE',                 // Unmanned autonomous combat aircraft
  'HIDDEN',                // Excluded from standard shop listings
  'SECRET',                // Secret unlock / prototype
  'EVO'                    // Evolution variant - obtainable only via Lv.5 upgrade
];

// Helper: Calculate upgrade cost from base plane cost and current level (levels 1 -> 5)
export function getUpgradeCost(baseCost, currentLevel) {
  const lvl = Math.max(1, Math.min(5, Number(currentLevel) || 1));
  const cost = Number(baseCost) || 1000;
  return Math.floor(cost * 0.12 * Math.pow(lvl, 1.5));
}

// Helper: Calculate stat multiplier based on upgrade level (+4% per level above 1)
export function getUpgradeStatMultiplier(level) {
  const lvl = Math.max(1, Math.min(5, Number(level) || 1));
  return 1 + (lvl - 1) * 0.04;
}

// Helper: Check if an aircraft is permitted to appear in the shop
// (Aircraft with HIDDEN, SECRET, or EVO never appear in the shop)
export function isAircraftInShop(aircraftOrId) {
  const plane = typeof aircraftOrId === 'string' ? AIRCRAFT_DATA[aircraftOrId] : aircraftOrId;
  if (!plane) return false;
  if (!Array.isArray(plane.tags)) return true;
  const upperTags = plane.tags.map(t => String(t).toUpperCase());
  return !upperTags.includes('HIDDEN') && !upperTags.includes('SECRET') && !upperTags.includes('EVO');
}

// Helper: Check if an aircraft possesses a specific tag
export function hasTag(aircraftOrId, tag) {
  const plane = typeof aircraftOrId === 'string' ? AIRCRAFT_DATA[aircraftOrId] : aircraftOrId;
  if (!plane || !Array.isArray(plane.tags)) return false;
  return plane.tags.includes(tag.toUpperCase());
}

// Helper: Get all aircraft that possess a specific tag
export function getAircraftByTag(tag) {
  const upper = tag.toUpperCase();
  return Object.values(AIRCRAFT_DATA).filter(p => Array.isArray(p.tags) && p.tags.includes(upper));
}

// Helper: Register or update an aircraft in the runtime registry
export function registerAircraft(data) {
  if (!data || !data.id) return null;
  // Apply schema defaults
  const normalized = {
    id: data.id,
    name: data.name || data.id.toUpperCase(),
    shortName: data.shortName || data.name || data.id.toUpperCase(),
    role: data.role || 'Multirole Fighter',
    planeRole: data.planeRole || 'MULTIROLE',
    tier: data.tier !== undefined ? Math.max(0, Math.min(10, Math.round(Number(data.tier) || 0))) : 0,
    partSlots: data.partSlots !== undefined ? Math.max(0, Math.round(Number(data.partSlots) || 0)) : 3,
    cost: data.cost !== undefined ? Math.max(0, Math.round(Number(data.cost) || 0)) : 0,
    sprite: data.sprite || `./assets/planes/${data.id}.png`,
    tags: Array.isArray(data.tags) ? data.tags.map(t => t.toUpperCase()) : [],
    stats: Object.assign({ spd: 75, def: 70, air: 75, gnd: 70, stealth: 0 }, data.stats),
    weapons: Object.assign({
      gunAmmo: 800,
      maxGunAmmo: 800,
      gunRpm: 3000,
      gunDamage: 1.0,
      mslCount: 80,
      maxMslCount: 80,
      mslCooldown: 4.4,
      flareCount: 30,
      maxFlareCount: 30,
      flarePool: 2,
      flareCooldown: 20.0,
      specialWeapons: ['qaam', '4aam', 'ugb'],
      equippedSpecialWeapon: 'qaam',
      spwAmmo: { qaam: 24, '4aam': 32, ugb: 40 },
      ability: 'emergencyAfterburner',
      abilityCharges: 1,
      maxAbilityCharges: 1,
      abilityRecharge: 45.0
    }, data.weapons),
    physics: Object.assign({
      mass: 18000,
      accelCruise: 65,
      accelAfterburner: 145,
      airbrakeDecel: 85,
      baseTurnRate: 2.2,
      turnResponse: 10.0,
      cornerSpeed: 280,
      normalMinSpeed: 152.8,
      forcedMinSpeed: 97.22,
      stallSpeed: 270,
      cruiseSpeed: 330,
      maxSpeed: 535,
      compressionFactor: 0.50,
      maxG: 11.5,
      grip: 3.0,
      highAlphaDrag: 70,
      inducedDragFactor: 10.0,
      driftTolerance: 0.75,
      hasThrustVectoring: false,
      engineCount: 2,
      nozzleSpacing: 20,
      wingspan: 80,
      wingtipChord: -18,
      length: 108,
      engineOffset: -46
    }, data.physics),
    description: data.description || ''
  };

  AIRCRAFT_DATA[normalized.id] = normalized;
  return normalized;
}

// Helper: Dynamically load all aircraft from data/aircraft/ if running on HTTP server
export async function loadAircraftFromData() {
  if (typeof fetch === 'undefined') return AIRCRAFT_DATA;
  try {
    const res = await fetch('./data/aircraft/manifest.json');
    if (!res.ok) return AIRCRAFT_DATA;
    const manifest = await res.json();
    if (manifest && Array.isArray(manifest.aircraft)) {
      for (const id of manifest.aircraft) {
        try {
          const planeRes = await fetch(`./data/aircraft/${id}.json`);
          if (planeRes.ok) {
            const planeData = await planeRes.json();
            registerAircraft(planeData);
          }
        } catch (e) {
          console.warn(`[AircraftLoader] Failed loading ${id}.json:`, e);
        }
      }
    }
  } catch (err) {
    // Local file:// or fetch blocked, fallback to compiled AIRCRAFT_DATA
    console.log('[AircraftLoader] Using built-in AIRCRAFT_DATA registry.');
  }
  return AIRCRAFT_DATA;
}

// Helper: Resolve aircraft stealth rating (0: None | 1: 1/4th Map | 2: 1/8th Map | 3: Visual Only | 4: Radar Ghost)
export function getTargetStealth(tgt) {
  if (!tgt) return 0;
  if (tgt.stealth !== undefined) return Math.max(0, Math.min(4, Math.round(Number(tgt.stealth) || 0)));
  if (tgt.stats && tgt.stats.stealth !== undefined) {
    return Math.max(0, Math.min(4, Math.round(Number(tgt.stats.stealth) || 0)));
  }
  if (tgt.aircraftConfig && tgt.aircraftConfig.stats && tgt.aircraftConfig.stats.stealth !== undefined) {
    return Math.max(0, Math.min(4, Math.round(Number(tgt.aircraftConfig.stats.stealth) || 0)));
  }
  const modelId = tgt.aircraft || tgt.model || tgt.planeId || tgt.id;
  if (modelId && AIRCRAFT_DATA[modelId] && AIRCRAFT_DATA[modelId].stats && AIRCRAFT_DATA[modelId].stats.stealth !== undefined) {
    return Math.max(0, Math.min(4, Math.round(Number(AIRCRAFT_DATA[modelId].stats.stealth) || 0)));
  }
  return 0;
}

// Helper: Resolve aircraft tier (0: Starter ... 10: Top Tier)
export function getAircraftTier(aircraftOrId) {
  const plane = typeof aircraftOrId === 'string' ? AIRCRAFT_DATA[aircraftOrId] : aircraftOrId;
  if (!plane) return 0;
  return plane.tier !== undefined ? Math.max(0, Math.min(10, Math.round(Number(plane.tier) || 0))) : 0;
}

// Helper: Resolve aircraft upgrade part slots count (e.g. 0 to 5+)
export function getAircraftPartSlots(aircraftOrId) {
  const plane = typeof aircraftOrId === 'string' ? AIRCRAFT_DATA[aircraftOrId] : aircraftOrId;
  if (!plane) return 0;
  return plane.partSlots !== undefined ? Math.max(0, Math.round(Number(plane.partSlots) || 0)) : 0;
}

// Helper: Resolve aircraft shop purchase cost (credits)
export function getAircraftCost(aircraftOrId) {
  const plane = typeof aircraftOrId === 'string' ? AIRCRAFT_DATA[aircraftOrId] : aircraftOrId;
  if (!plane) return 0;
  return plane.cost !== undefined ? Math.max(0, Math.round(Number(plane.cost) || 0)) : 0;
}
