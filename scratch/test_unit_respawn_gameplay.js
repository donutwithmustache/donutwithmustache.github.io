const assert = require('assert');
const fs = require('fs');

// Mock browser globals
global.window = global;
global.document = {
  createElement: () => ({ getContext: () => ({}) })
};

// Mock audio & particles
const mockParticles = {
  emitAircraftDamage: () => {},
  spawnExplosion: () => {},
  particles: []
};
const mockAudio = {
  playMissileHitSound: () => {},
  playCrashSound: () => {},
  playTargetDestroyed: () => {}
};

// Read targets.js source and strip export
let targetsCode = fs.readFileSync('js/targets.js', 'utf8');
targetsCode = targetsCode.replace(/export\s+default\s+/g, '');
targetsCode = targetsCode.replace(/export\s+/g, '');
targetsCode += '\nglobal.TargetManager = TargetManager;\n';

eval(targetsCode);

console.log("Testing TargetManager unit respawn mechanics...");

const tm = new TargetManager();

// Create two test targets: one with canRespawn=false, one with canRespawn=true
const tgtNoRespawn = {
  id: 'tank_perm_dead',
  name: 'Heavy Tank',
  type: 'ground',
  groundType: 'tank',
  active: true,
  isDestroyed: true,
  respawnTimer: 14.0,
  canRespawn: false,
  hp: 0,
  maxHp: 64,
  x: 100,
  y: 100
};

const tgtRespawn = {
  id: 'mig21_respawn',
  name: 'MiG-21',
  type: 'air',
  aiType: 'rookie',
  active: true,
  isDestroyed: true,
  respawnTimer: 14.0,
  canRespawn: true,
  hp: 0,
  maxHp: 48,
  x: 200,
  y: 200
};

tm.targets = [tgtNoRespawn, tgtRespawn];

// Simulate 15 seconds passing (dt = 1.0 each tick)
for (let s = 0; s < 15; s++) {
  tm.update(1.0, null, mockParticles, null, null, null);
}

// 1. tgtNoRespawn must remain destroyed
assert.strictEqual(tgtNoRespawn.isDestroyed, true, "Target with canRespawn:false must stay destroyed");
console.log("PASS: Target with canRespawn=false stayed permanently destroyed after 15s.");

// 2. tgtRespawn must have respawned
assert.strictEqual(tgtRespawn.isDestroyed, false, "Target with canRespawn:true must revive after 14s");
assert.strictEqual(tgtRespawn.hp > 0, true, "Target with canRespawn:true must restore HP");
console.log("PASS: Target with canRespawn=true successfully respawned with HP restored.");

console.log(">>> ALL JS TARGET RESPAWN MECHANIC TESTS PASSED! <<<");
