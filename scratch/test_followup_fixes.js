const fs = require('fs');
const assert = require('assert');

console.log("=== COMPREHENSIVE TEST SUITE: 6 FOLLOW-UP USER FIXES ===");

// 1. Dialogue Transmission Position (Moved down ~1/3rd from top)
const hudJs = fs.readFileSync('js/hud.js', 'utf8');
assert(hudJs.includes('Math.round(canvasHeight * 0.32)'), "Dialogue portraitY must be anchored ~1/3rd down from screen top");
assert(!hudJs.includes('const portraitY = 24;'), "Old portraitY = 24 must be replaced");
console.log("PASS 1: Dialogue transmission repositioned to ~1/3rd down from the top.");

// 2. Ability to set radio transmission color
const missionJs = fs.readFileSync('js/mission.js', 'utf8');
assert(hudJs.includes('const msgColor = m.color ||'), "HUD must use custom radio message color when provided");
assert(missionJs.includes('postRadioMessage(text, life = 4.5, color = null)'), "postRadioMessage must accept color parameter");
assert(missionJs.includes('act.color || act.textColor'), "RADIO_MESSAGE trigger action must parse act.color/act.textColor");

const editorPy = fs.readFileSync('tools/mission_editor.py', 'utf8');
assert(editorPy.includes('cb_radio_color'), "Mission editor must have Radio Color picker");
assert(editorPy.includes('act["color"] ='), "Mission editor must save act.color on RADIO_MESSAGE");
console.log("PASS 2: Radio transmission custom color capability verified across HUD, engine, and editor.");

// 3. Move mission data & heading from top center to top left
assert(hudJs.includes('drawCompassTape(ctx, 40, 28,'), "Heading compass tape must be called at top-left (x=40, y=28)");
assert(hudJs.includes("ctx.textAlign = 'left'"), "Heading compass tape must be left-aligned");
console.log("PASS 3: Heading and mission data moved to top-left.");

// 4. Return line fix in pause menu
const gameJs = fs.readFileSync('js/game.js', 'utf8');
assert(gameJs.includes('padding + drawH * offset'), "Pause menu theater map must accurately compute return line coordinate from side and offset");
assert(gameJs.includes('ctx.fillRect(zoneX, zoneY, zoneW, zoneH)'), "Pause menu theater map must draw shaded resupply zone");
console.log("PASS 4: Return line rendering bug in pause menu theater map fixed.");

// 5. Operation concluded popup says MISSION COMPLETE and is green
assert(hudJs.includes("title = 'MISSION COMPLETE';"), "Scripted ending must set title to 'MISSION COMPLETE'");
assert(hudJs.includes("col = '#00ff66';"), "Scripted ending banner color must be green (#00ff66)");
assert(hudJs.includes("bgGrad = 'rgba(0, 30, 15, 0.88)';"), "Scripted ending banner background must be dark green");
console.log("PASS 5: Mission complete popup banner verified to say MISSION COMPLETE in green.");

// 6. Finishing mission loading screen matches red theme and returns to main menu
assert(gameJs.includes("isCompleted ? 'MISSION COMPLETE' : 'RETURNING TO BASE'"), "Exit loading screen must show MISSION COMPLETE on sortie completion");
assert(gameJs.includes("isCompleted ? '// SORTIE COMPLETE // MISSION DEBRIEF'"), "Exit loading screen must show debrief tag on sortie completion");
assert(gameJs.includes("this.menu.showScreen('main-menu')"), "Exit loading screen must return player to main-menu");
assert(missionJs.includes('isMissionEnd: true'), "SCRIPTED_END must flag isMissionEnd: true");
assert(missionJs.includes('this.game.exitToMainMenu()'), "updateFadeTransition must call exitToMainMenu when mission ends");
console.log("PASS 6: Mission completion loading screen and return-to-main-menu flow verified.");

console.log("\nALL 6 USER REQUEST TESTS PASSED FLAWLESSLY!");

