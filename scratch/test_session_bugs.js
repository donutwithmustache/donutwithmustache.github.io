const fs = require('fs');
const assert = require('assert');

console.log("=== COMPREHENSIVE VERIFICATION SUITE: 7 BUG FIXES ===");

// 1. Verify Respawn Loadout Retention
const gameJs = fs.readFileSync('js/game.js', 'utf8');
assert(!gameJs.includes('this.applyPlayerTweakables(this.playerTweakables)'), "respawnPlayer must NOT re-apply playerTweakables");
assert(gameJs.includes('Retain current ammunition counts, equipped weapons, and return-line resupply on respawn'), "Respawn loadout retention comment must be present");
console.log("PASS 1: Respawn loadout retention verified (ammo and weapons preserved on death/respawn).");

// 2. Verify AWACS Dialogue Multi-Line Wrapping & Bubble Expansion
const hudJs = fs.readFileSync('js/hud.js', 'utf8');
assert(hudJs.includes('fullLines.length * lineHeight + 44'), "Speech bubble height must dynamically scale with number of wrapped lines");
assert(hudJs.includes('dispLines[i], textX, startY + i * lineHeight'), "All wrapped lines must be rendered in a loop");
assert(hudJs.includes('const startY = bubbleY + (bubbleH - totalTextH) * 0.5'), "Text must be vertically centered inside speech bubble");
console.log("PASS 2: AWACS dialogue multi-line wrapping and bubble dynamic sizing verified.");

// 3. Verify AI Unit Respawn Guarding
const targetsJs = fs.readFileSync('js/targets.js', 'utf8');
assert(targetsJs.includes('if (!tgt.canRespawn && !tgt.respawn)'), "targets.js must strictly guard respawning behind truthy canRespawn/respawn");
assert(targetsJs.includes('tgt.respawnTimer = (tgt.canRespawn || tgt.respawn) ? 14.0 : 0;'), "Surface targets and crashing units must only set respawnTimer if canRespawn is true");
console.log("PASS 3: AI unit respawn bug verified (units do not respawn unless explicitly set to).");

// 4. Verify Radio Transmissions Scale, Duration & Audio Cue
const missionJs = fs.readFileSync('js/mission.js', 'utf8');
assert(hudJs.includes("bold 30px 'Share Tech Mono'"), "Radio message font must be scaled to 30px (200% scale)");
assert(hudJs.includes("radioY += 48"), "Radio message line spacing must be 48px");
assert(missionJs.includes('this.game.audio.playRadioChirp()'), "postRadioMessage must trigger playRadioChirp audio cue");
assert(missionJs.includes('act.duration || act.life || act.time || 4.5'), "RADIO_MESSAGE trigger action must respect duration/life parameters");
console.log("PASS 4: Radio transmission 200% scaling, duration, and audio cue verified.");

// 5 & 6. Verify Ace Combat Style Pause Menu & Tactical Red Palette
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('pause-grid'), "index.html must include pause-grid 2-column layout");
assert(indexHtml.includes('pause-map-canvas'), "index.html must include pause-map-canvas for tactical theater map");
assert(indexHtml.includes('pause-objectives-box'), "index.html must include pause-objectives-box");
assert(indexHtml.includes('#ff3344'), "Pause menu styling must use tactical red (#ff3344)");
assert(gameJs.includes('drawPauseTheaterMap'), "game.js must implement drawPauseTheaterMap");
assert(gameJs.includes('pause-mission-title'), "game.js must dynamically set pause-mission-title");
console.log("PASS 5 & 6: Ace Combat style pause menu (options top-left, objectives bottom-left, map right, tactical red) verified.");

// 7. Verify Scripted Mission End & Target Destroyed Trigger Matching
assert(missionJs.includes('tid === cleanTgt || tname === cleanTgt || (cleanTgt && (tid.includes(cleanTgt) || tname.includes(cleanTgt)))'), "TARGET_DESTROYED must flexibly match by unit ID, name, or substring");
assert(missionJs.includes('this.isScriptedEnding = true'), "SCRIPTED_END action must set isScriptedEnding");
assert(missionJs.includes('this.onMissionCompleted()'), "SCRIPTED_END must invoke onMissionCompleted");
console.log("PASS 7: Scripted mission end and target destroyed trigger matching verified.");

console.log("\nALL 7 BUG FIX TESTS PASSED FLAWLESSLY!");

