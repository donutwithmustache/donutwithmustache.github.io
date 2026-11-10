const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: PRE-MISSION LOADING SCREEN UPDATES ===');

// 1. Inspect index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes('<div class="loading-section-title">Objective:</div>')) {
  console.error('FAIL: Missing "Objective:" section title in index.html');
  process.exit(1);
}
console.log('PASS: "Objective:" header verified in index.html');

if (!html.includes('id="loading-map-canvas"')) {
  console.error('FAIL: Missing loading-map-canvas in index.html');
  process.exit(1);
}
console.log('PASS: loading-map-canvas verified in index.html');

if (!html.includes('id="loading-location-name"')) {
  console.error('FAIL: Missing loading-location-name in index.html');
  process.exit(1);
}
console.log('PASS: loading-location-name verified in index.html');

if (!html.includes('<span class="commence-label">LAUNCH</span>')) {
  console.error('FAIL: Missing "LAUNCH" button label in index.html');
  process.exit(1);
}
console.log('PASS: "LAUNCH" commence label verified in index.html');

// Topography text should be removed
if (html.includes('// SECTOR RADAR TOPOGRAPHY ACTIVE') || html.includes('CONTOUR MAPPING ENGAGED')) {
  console.error('FAIL: Obsolete topography text still present in index.html');
  process.exit(1);
}
console.log('PASS: Obsolete topography text successfully removed');

// Ability replaces countermeasures; gun and loadout status removed
if (!html.includes('id="loading-ability-name"')) {
  console.error('FAIL: Missing loading-ability-name in index.html');
  process.exit(1);
}
if (html.includes('id="loading-gun-info"') || html.includes('id="loading-flares-info"') || html.includes('id="loading-loadout-type"')) {
  console.error('FAIL: Gun, flares, or loadout status still present in index.html');
  process.exit(1);
}
console.log('PASS: Loadout menu verified: gun/loadout status removed, countermeasures replaced with ability');

// 2. Inspect css/menu.css
const cssPath = path.join(__dirname, '..', 'css', 'menu.css');
const css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes('.loading-loadout-container') || !css.includes('margin-top: auto;')) {
  console.error('FAIL: .loading-loadout-container missing margin-top: auto anchor');
  process.exit(1);
}
console.log('PASS: .loading-loadout-container anchored to bottom with margin-top: auto');

if (!css.includes('.loading-progress-fill') || !css.includes('background: #ff3344;')) {
  console.error('FAIL: .loading-progress-fill is not pure solid red (#ff3344)');
  process.exit(1);
}
console.log('PASS: .loading-progress-fill is solid red (#ff3344)');

if (css.includes('.loading-progress-fill {\n  height: 100%;\n  background: linear-gradient')) {
  console.error('FAIL: .loading-progress-fill still has gradient');
  process.exit(1);
}
console.log('PASS: Verified no gradient on loading progress bar');

// 3. Inspect mission files for name and location fields
const testFlightPath = path.join(__dirname, '..', 'data', 'missions', 'test_flight.json');
const tf = JSON.parse(fs.readFileSync(testFlightPath, 'utf8'));
if (!tf.name || !tf.location) {
  console.error('FAIL: test_flight.json missing name or location');
  process.exit(1);
}
console.log(`PASS: test_flight.json loaded with name "${tf.name}" and location "${tf.location}"`);

const tutPath = path.join(__dirname, '..', 'data', 'missions', 'tutorial.json');
const tut = JSON.parse(fs.readFileSync(tutPath, 'utf8'));
if (!tut.name || !tut.location || tut.loadout.mode !== 'forced') {
  console.error('FAIL: tutorial.json missing name, location, or forced loadout');
  process.exit(1);
}
console.log(`PASS: tutorial.json has forced loadout ${tut.loadout.aircraft} + ${tut.loadout.specialWeapon}`);

console.log('\nALL LOADING SCREEN VERIFICATION CHECKS PASSED!');

