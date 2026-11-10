const fs = require('fs');
const text = fs.readFileSync('js/hud.js', 'utf8');

// Check Kill Confirm font
if (!text.includes("ctx.font = 'bold 15px monospace';") || !text.includes('let notifY = 95;')) {
  throw new Error('Kill confirm not reverted to 15px!');
}

// Check Compass/Heading tape font
if (!text.includes("ctx.font = 'bold 11px monospace';")) {
  throw new Error('Compass mission text not reverted to 11px!');
}

console.log('Verified: Kill confirm and Mission/Heading indicator fonts and scaling restored!');

