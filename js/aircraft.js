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
    code: 'QAAM',
    type: 'air',
    pool: 2,
    cooldown: 4.5,            // Recharge time per slot in seconds (variable per weapon)
    rechargeTime: 4.5,
    defaultAmmo: 24,
    description: 'High-agility air-to-air missile with supreme tracking capabilities.'
  },
  saam: {
    id: 'saam',
    name: 'Semi-Active Air-to-Air Missile',
    code: 'SAAM',
    type: 'air',
    pool: 2,
    cooldown: 5.5,            // Recharge time per slot in seconds
    rechargeTime: 5.5,
    defaultAmmo: 20,
    description: 'Long-range radar-guided missile with extended flight envelope and high velocity.'
  },
  '4aam': {
    id: '4aam',
    name: '4-Target Air-to-Air Missile',
    code: '4AAM',
    type: 'air',
    isMultiLock: true,
    maxLocks: 4,
    pool: 4,
    cooldown: 7.0,            // Recharge time per slot in seconds
    rechargeTime: 7.0,
    defaultAmmo: 36,
    description: 'Multi-lock air-to-air missile system: locks and fires on up to 4 airborne targets in vicinity.'
  },
  hpaa: {
    id: 'hpaa',
    name: 'High-Power Air-to-Air Missile',
    code: 'HPAA',
    type: 'air',
    pool: 2,
    cooldown: 5.0,            // Recharge time per slot in seconds
    rechargeTime: 5.0,
    defaultAmmo: 18,
    description: 'Heavy missile with massive kinetic and explosive payload for high-damage strikes.'
  },
  ugb: {
    id: 'ugb',
    name: 'Unguided Heavy Bomb',
    code: 'UGB',
    type: 'ground',
    pool: 2,
    cooldown: 3.5,            // Recharge time per slot in seconds
    rechargeTime: 3.5,
    defaultAmmo: 44,
    description: 'Heavy free-fall high-explosive bomb with wide surface blast shockwave.'
  },
  lasm: {
    id: 'lasm',
    name: 'Long-Range Anti-Surface Missile',
    code: 'LASM',
    type: 'ground',
    pool: 2,
    cooldown: 6.0,            // Recharge time per slot in seconds
    rechargeTime: 6.0,
    defaultAmmo: 24,
    description: 'High-velocity sea-skimming cruise missile specialized for naval and hardened ground targets.'
  },
  sffs: {
    id: 'sffs',
    name: 'Submunition Cluster Dispenser',
    code: 'SFFS',
    type: 'ground',
    pool: 2,
    cooldown: 4.8,            // Recharge time per slot in seconds
    rechargeTime: 4.8,
    defaultAmmo: 32,
    description: 'Dispenses a wide carpet of explosive bomblets across a broad surface area.'
  },
  mpbm: {
    id: 'mpbm',
    name: 'Multi-Purpose Burst Missile',
    code: 'MPBM',
    type: 'all',
    pool: 1,
    cooldown: 9.0,            // Recharge time per slot in seconds
    rechargeTime: 9.0,
    defaultAmmo: 12,
    description: 'Tactical warhead that detonates a massive expanding thermal burst sphere.'
  }
};

// ------------------------------------------
// ABILITIES DICTIONARY TABLE
// ------------------------------------------
export const ABILITIES = {
  highGBreak: {
    id: 'highGBreak',
    name: 'High-G Break',
    code: 'BRK',
    charges: 3,
    rechargeTime: 10.0,
    description: 'Tactical high-G pitch break with defensive flare burst to shake missile locks.'
  },
  afterburnerSurge: {
    id: 'afterburnerSurge',
    name: 'Afterburner Overdrive',
    code: 'OVD',
    charges: 3,
    rechargeTime: 8.0,
    description: 'Injects chemical oxidizer into the afterburners for instant maximum forward speed surge.'
  },
  ecmJammer: {
    id: 'ecmJammer',
    name: 'ECM Jammer Suite',
    code: 'ECM',
    charges: 2,
    rechargeTime: 12.0,
    description: 'Emits a powerful wideband electronic warfare pulse that scrambles enemy missile locks.'
  },
  flareRing: {
    id: 'flareRing',
    name: '360° Flare Ring',
    code: 'FLR+',
    charges: 3,
    rechargeTime: 12.0,
    description: 'Discharges an omnidirectional radial ring of hot countermeasure flares.'
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
    sprite: './assets/planes/su27.png',
    tags: ['AIR_SUPERIORITY', 'SUPERMANEUVERABLE', 'PSM', 'HEAVY_FIGHTER'],
    
    // Core stats (SPD is active maneuverability stat)
    stats: {
      spd: 92, // Maneuverability
      def: 65,
      air: 95,
      gnd: 50
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
      ability: 'highGBreak',
      abilityCharges: 3,
      maxAbilityCharges: 3,
      abilityRecharge: 10.0
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
    sprite: './assets/planes/f15c.png',
    tags: ['AIR_SUPERIORITY', 'HIGH_SPEED', 'SUPERCRUISE', 'HEAVY_FIGHTER'],
    
    // Core stats
    stats: {
      spd: 75, // Maneuverability
      def: 75,
      air: 90,
      gnd: 40
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
      ability: 'afterburnerSurge',
      abilityCharges: 3,
      maxAbilityCharges: 3,
      abilityRecharge: 8.0
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
    sprite: './assets/planes/f111f.png',
    tags: ['STRIKE', 'VARIABLE_GEOMETRY', 'TERRAIN_FOLLOWING', 'SUPERCRUISE'],
    
    // Core stats
    stats: {
      spd: 45, // Maneuverability
      def: 90,
      air: 35,
      gnd: 98
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
      ability: 'ecmJammer',
      abilityCharges: 2,
      maxAbilityCharges: 2,
      abilityRecharge: 12.0
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
    sprite: './assets/planes/su57.png',
    tags: ['STEALTH', 'SUPERMANEUVERABLE', 'PSM', 'SUPERCRUISE', 'MULTIROLE'],

    // Core stats
    stats: {
      spd: 96, // 3D Thrust-vectoring maneuverability
      def: 70,
      air: 98,
      gnd: 65
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
      ability: 'ecmJammer',
      abilityCharges: 3,
      maxAbilityCharges: 3,
      abilityRecharge: 10.0
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
  'DRONE'                  // Unmanned autonomous combat aircraft
];

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
    sprite: data.sprite || `./assets/planes/${data.id}.png`,
    tags: Array.isArray(data.tags) ? data.tags.map(t => t.toUpperCase()) : [],
    stats: Object.assign({ spd: 75, def: 70, air: 75, gnd: 70 }, data.stats),
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
      ability: 'highGBreak',
      abilityCharges: 3,
      maxAbilityCharges: 3,
      abilityRecharge: 10.0
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
