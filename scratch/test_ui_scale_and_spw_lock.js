const assert = require('assert');
const fs = require('fs');

console.log('--- RUNNING SPW LEVEL LOCK & FORCED LOADOUT RESTORATION TEST SUITE ---');

// 1. Mock minimal environment
global.SPECIAL_WEAPONS = {
  qaam: { code: 'QAAM', name: 'Quick-Maneuver Air-to-Air Missile', defaultAmmo: 24, pool: 2, cooldown: 4.0 },
  '4aam': { code: '4AAM', name: '4-Target Air-to-Air Missile', defaultAmmo: 36, pool: 4, cooldown: 5.0 },
  saam: { code: 'SAAM', name: 'Semi-Active Air-to-Air Missile', defaultAmmo: 20, pool: 2, cooldown: 4.5 },
  ugb: { code: 'UGB', name: 'Unguided Heavy Bomb', defaultAmmo: 44, pool: 2, cooldown: 3.5 }
};

global.AIRCRAFT_DATA = {
  f15c: {
    id: 'f15c',
    name: 'F-15C Eagle',
    weapons: {
      specialWeapons: ['4aam', 'saam', 'qaam'],
      equippedSpecialWeapon: '4aam',
      spwAmmo: { '4aam': 36, saam: 20, qaam: 24 }
    }
  }
};

global.localStorage = {
  _store: {},
  getItem(key) { return this._store[key] || null; },
  setItem(key, val) { this._store[key] = String(val); },
  removeItem(key) { delete this._store[key]; }
};

// Evaluate profile.js
let profileCode = fs.readFileSync('G:/bot/dmlBrowser/js/profile.js', 'utf8');
profileCode = profileCode.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
profileCode = profileCode.replace(/export\s+class\s+ProfileManager/, 'global.ProfileManager = class ProfileManager');
profileCode = profileCode.replace(/export\s+/g, '');
eval(profileCode);

const pm = new ProfileManager();
pm.profiles['testuser'] = {
  username: 'testuser',
  credits: 100000,
  ownedPlanes: ['f15c'],
  equippedPlane: 'f15c',
  upgrades: { f15c: 1 },
  equippedSpw: { f15c: '4aam' }
};
pm.activeProfile = pm.profiles['testuser'];

// Test SPW Level Locking (Level 1, 3, 5)
console.log('Testing SPW Unlock Requirements by Plane Upgrade Level...');
// Level 1: index 0 (4aam) is unlocked, index 1 (saam) and index 2 (qaam) are locked
assert.strictEqual(pm.isSpwUnlocked('f15c', '4aam'), true, 'Level 1 plane should have 1st SPW unlocked');
assert.strictEqual(pm.isSpwUnlocked('f15c', 'saam'), false, 'Level 1 plane should have 2nd SPW locked');
assert.strictEqual(pm.isSpwUnlocked('f15c', 'qaam'), false, 'Level 1 plane should have 3rd SPW locked');

// Try equipping locked weapon at level 1 -> must fail
assert.strictEqual(pm.setEquippedSpw('f15c', 'saam'), false, 'Equipping locked SPW must fail');
assert.strictEqual(pm.getEquippedSpw('f15c'), '4aam', 'Equipped weapon should remain 4aam');

// Upgrade to Level 2: 2nd and 3rd still locked
pm.activeProfile.upgrades.f15c = 2;
assert.strictEqual(pm.isSpwUnlocked('f15c', 'saam'), false, 'Level 2 plane still has 2nd SPW locked');

// Upgrade to Level 3: 2nd SPW (saam) unlocked, 3rd (qaam) locked
pm.activeProfile.upgrades.f15c = 3;
assert.strictEqual(pm.isSpwUnlocked('f15c', 'saam'), true, 'Level 3 plane unlocks 2nd SPW');
assert.strictEqual(pm.isSpwUnlocked('f15c', 'qaam'), false, 'Level 3 plane still has 3rd SPW locked');
assert.strictEqual(pm.setEquippedSpw('f15c', 'saam'), true, 'Equipping 2nd SPW at Level 3 succeeds');
assert.strictEqual(pm.getEquippedSpw('f15c'), 'saam', 'Equipped weapon is now saam');

// Upgrade to Level 5: 3rd SPW (qaam) unlocked
pm.activeProfile.upgrades.f15c = 5;
assert.strictEqual(pm.isSpwUnlocked('f15c', 'qaam'), true, 'Level 5 plane unlocks 3rd SPW');
assert.strictEqual(pm.setEquippedSpw('f15c', 'qaam'), true, 'Equipping 3rd SPW at Level 5 succeeds');
assert.strictEqual(pm.getEquippedSpw('f15c'), 'qaam', 'Equipped weapon is now qaam');

// If level is reduced (or fallback check), getEquippedSpw falls back to index 0
pm.activeProfile.upgrades.f15c = 1;
assert.strictEqual(pm.getEquippedSpw('f15c'), '4aam', 'Fallback to level 1 default weapon when weapon is locked');
console.log('✓ SPW Level Locking passed with 100% precision.');

// Test Forced Loadout Persistence Bug Fix
console.log('Testing Forced Loadout -> Normal Mission Loadout Restoration...');
global.profileManager = pm;
pm.activeProfile.upgrades.f15c = 5;
pm.setEquippedSpw('f15c', '4aam');

// Mock Game instance
class MockPhysics {
  constructor() { this.x = 0; this.y = 0; this.heading = 0; this.speed = 300; }
  setConfig() {}
  reset(x, y, h, s) { this.x = x; this.y = y; this.heading = h; this.speed = s; }
  update() { return { x: this.x, y: this.y, heading: this.heading, speed: this.speed }; }
}

global.ABILITIES = { emergencyAfterburner: { code: 'E-AB', name: 'Emergency Afterburner', charges: 1, duration: 4.0 } };

const gameCode = fs.readFileSync('G:/bot/dmlBrowser/js/game.js', 'utf8');
// Extract relevant methods
function extractMethod(src, name) {
  const startIdx = src.indexOf('\n  ' + name + '(');
  if (startIdx === -1) throw new Error('Method not found: ' + name);
  const endIdx = src.indexOf('\n  }', startIdx);
  const block = src.slice(startIdx, endIdx + 4).trim();
  return 'function ' + block.replace(new RegExp('^' + name), '');
}

class TestGame {
  constructor() {
    this.currentAircraftId = 'f15c';
    this.equippedAircraftId = 'f15c';
    this.aircraftConfig = JSON.parse(JSON.stringify(AIRCRAFT_DATA.f15c));
    this.physics = new MockPhysics();
    this.weapons = {};
    this.audio = { playSwitchSound() {} };
    this.input = {};
    this.loadAircraftWeapons(this.aircraftConfig);
  }
  updateUIButtons() {}
  unloadLevel() {}
  showMissionLoadingScreen() {}
}

TestGame.prototype.loadAircraftWeapons = eval('(' + extractMethod(gameCode, 'loadAircraftWeapons') + ')');
TestGame.prototype.equipSpecialWeapon = eval('(' + extractMethod(gameCode, 'equipSpecialWeapon') + ')');
TestGame.prototype.selectAircraft = eval('(' + extractMethod(gameCode, 'selectAircraft') + ')');
TestGame.prototype.applyForcedLoadout = eval('(' + extractMethod(gameCode, 'applyForcedLoadout') + ')');
TestGame.prototype.restoreEquippedLoadout = eval('(' + extractMethod(gameCode, 'restoreEquippedLoadout') + ')');

const game = new TestGame();
// Initial state: F-15C with 4AAM
assert.strictEqual(game.weapons.equippedSpwId, '4aam', 'Initial weapon must be 4aam');

// 1. Play Tutorial (Forced F-15C + UGB)
game.applyForcedLoadout({ mode: 'forced', aircraft: 'f15c', specialWeapon: 'ugb' });
assert.strictEqual(game.weapons.equippedSpwId, 'ugb', 'Tutorial forced weapon must be ugb');
assert.strictEqual(AIRCRAFT_DATA.f15c.weapons.equippedSpecialWeapon, '4aam', 'Global AIRCRAFT_DATA must NOT be mutated by forced loadout');

// 2. Player Equips 4AAM in Hangar
pm.setEquippedSpw('f15c', '4aam');

// 3. Enter Test Flight (Mode: player)
game.restoreEquippedLoadout();
assert.strictEqual(game.weapons.equippedSpwId, '4aam', 'Test flight must restore player equipped weapon 4aam!');
console.log('✓ Forced loadout bug resolved: Test Flight properly restores player 4AAM weapon.');

// Test HUD UI 30% Scale Checks
console.log('Verifying HUD scale elements in js/hud.js...');
const hudCode = fs.readFileSync('G:/bot/dmlBrowser/js/hud.js', 'utf8');
assert.ok(hudCode.includes('ctx.scale(0.70, 0.70);'), 'drawCustomFlightConsole must scale by 0.70');
assert.ok(hudCode.includes('Math.round((isExpanded ? 198 : 132) * 0.70);'), 'drawRadarMinimap must scale radarHalfSize by 0.70');
assert.ok(hudCode.includes('font = "bold 21px \'Share Tech Mono\''), 'Radio transmission font must be 21px (was 30px)');
assert.ok(hudCode.includes('portraitW = 120;'), 'Dialogue portrait width must be 120 (was 172)');
assert.ok(hudCode.includes('portraitH = 129;'), 'Dialogue portrait height must be 129 (was 184)');
console.log('✓ All Flight UI elements verified at 30% smaller (0.70 scale).');

// Test Hangar layout & rotation checks
console.log('Verifying Hangar centering, rotation & spidergraph 1:1 aspect ratio...');
const menuCss = fs.readFileSync('G:/bot/dmlBrowser/css/menu.css', 'utf8');
const hangarJs = fs.readFileSync('G:/bot/dmlBrowser/js/hangar.js', 'utf8');

assert.ok(menuCss.includes('.hangar-center-stage {\n  position: absolute;\n  top: 48%;\n  left: 50%;'), 'hangar-center-stage must be left: 50%');
assert.ok(menuCss.includes('.hangar-bottom-center {\n  position: absolute;\n  bottom: 24px;\n  left: 50%;'), 'hangar-bottom-center must be left: 50%');
assert.ok(menuCss.includes('transform: rotate(45deg);'), 'hangar-plane-sprite must have rotate(45deg)');
assert.ok(hangarJs.includes('const centerX = Math.round(w * 0.50);'), 'renderTarmac must center yellow line at w * 0.50');
assert.ok(menuCss.includes('width: 260px;\n  height: 260px;'), 'hangar-radar-container must be 1:1 aspect ratio square');
assert.ok(menuCss.includes('width: 54px;\n  height: 54px;'), 'spw-thumb-box must be a square');
assert.ok(menuCss.includes('transform: rotate(-45deg);'), 'spw-thumb-box img must be rotated 45 degrees');
assert.ok(!hangarJs.includes('r * 1.2'), 'renderSpiderGraph must not stretch with r * 1.2');

console.log('✓ Hangar centering, plane 45deg rotation, square SPW icon, and 1:1 spidergraph verified.');

console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
