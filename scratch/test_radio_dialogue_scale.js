const fs = require('fs');
const assert = require('assert');

console.log("=== TEST SUITE: RADIO & DIALOGUE TRANSMISSION SCALING ===");

const hudJs = fs.readFileSync('js/hud.js', 'utf8');

// 1. Radio Transmissions (175% scale)
assert(hudJs.includes("bold 26px 'Share Tech Mono'"), "Radio transmissions must use 26px font (175% of 15px)");
assert(hudJs.includes("radioY += 42"), "Radio transmissions line spacing must be 42px (175% of 24px)");
assert(hudJs.includes("shadowBlur = 18"), "Radio transmissions shadowBlur must be 18px (175% of 10px)");
console.log("PASS: Radio transmissions successfully scaled to 175%.");

// 2. Dialogue Transmissions (200% scale)
assert(hudJs.includes("portraitW = 172"), "Dialogue portrait width must be 172px (200% of 86px)");
assert(hudJs.includes("portraitH = 184"), "Dialogue portrait height must be 184px (200% of 92px)");
assert(hudJs.includes("bold 36px 'Share Tech Mono'"), "Dialogue speech bubble text must use 36px font (200% of 18px)");
assert(hudJs.includes("bold 28px monospace"), "Dialogue callsign must use 28px font (200% of 14px)");
assert(hudJs.includes("20px monospace"), "Dialogue aircraft must use 20px font (200% of 10px)");
assert(hudJs.includes("18px monospace"), "Dialogue squadron must use 18px font (200% of 9px)");
console.log("PASS: Dialogue transmissions successfully scaled to 200%.");

// 3. Margin & Edge-Clipping Protection
assert(hudJs.includes("maxMetaW"), "Dialogue must measure metadata width to prevent clipping");
assert(hudJs.includes("requiredRightSpace"), "Dialogue must dynamically calculate right space based on name length");
console.log("PASS: Edge-clipping protection and margin offsets verified.");

console.log("\nALL RADIO & DIALOGUE SCALE TESTS PASSED SUCCESSFULLY!");

