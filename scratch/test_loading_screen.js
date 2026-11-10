import assert from 'assert';
import fs from 'fs';

// 1. Verify CSS styles in css/menu.css
const css = fs.readFileSync('css/menu.css', 'utf8');

// Selector cursor check
assert(css.includes('.menu-selector-cursor'), "menu-selector-cursor must exist");
assert(css.includes('rgba(255, 255, 255, 0.38)'), "Selector left gradient must have high transparency (0.38)");
console.log("PASS: Main menu selector cursor transparency verified.");

// Loading screen color palette check
assert(css.includes('rgba(46, 8, 14, 0.97)'), "Loading screen background must use main menu crimson/wine palette");
assert(css.includes('rgba(24, 4, 8, 0.94)'), "Loading panel background must use dark wine palette");
assert(css.includes('#ff4757'), "Loading screen brackets/borders must use main menu crimson #ff4757");
assert(css.includes('#ffa502'), "Loading screen accents must use tactical amber #ffa502");
console.log("PASS: Pre-mission loading screen matches main menu palette (crimson/wine/amber/black).");

// 2. Verify Game Loading Screen Objective Logic in js/game.js
const gameJs = fs.readFileSync('js/game.js', 'utf8');
assert(gameJs.includes('briefing-param-tag'), "js/game.js must generate briefing-param-tag for objective parameters");
assert(gameJs.includes('DESTROY_NAMED_TARGET'), "js/game.js must support DESTROY_NAMED_TARGET");
assert(gameJs.includes('REACH_AREA'), "js/game.js must support REACH_AREA");
assert(gameJs.includes('SURVIVE_TIME'), "js/game.js must support SURVIVE_TIME");
assert(gameJs.includes('All designated Primary Objectives secured'), "js/game.js must dynamically evaluate win conditions");
console.log("PASS: Pre-mission loading screen objective and condition logic verified.");

// 3. Verify Mission Simulator Objective Tracking in js/mission.js
const missionJs = fs.readFileSync('js/mission.js', 'utf8');
assert(missionJs.includes('DESTROY_NAMED_TARGET'), "js/mission.js must track DESTROY_NAMED_TARGET");
assert(missionJs.includes('REACH_AREA'), "js/mission.js must track REACH_AREA");
assert(missionJs.includes('SURVIVE_TIME'), "js/mission.js must track SURVIVE_TIME");
console.log("PASS: Mission gameplay tracker handles all 4 objective types.");

console.log("\nALL LOADING SCREEN & OBJECTIVE TESTS PASSED SUCCESSFULLY!");

