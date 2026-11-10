// Automated test for Particle Engine Nodes & Scale and In-Game rendering
import { ParticleSystem } from '../js/particles.js';
import { AIRCRAFT_DATA } from '../js/aircraft.js';

console.log("=== TESTING AIRCRAFT PARTICLES, NODES & SCALE ===");

// 1. Verify MiG-17 single-engine exhaust
const ps = new ParticleSystem();
const mig17 = AIRCRAFT_DATA.mig17;
console.log("MiG-17 config:", {
  engineCount: mig17.physics.engineCount,
  scale: mig17.scale,
  nodes: mig17.nodes
});

// Mock performance.now for node test
if (typeof performance === 'undefined') {
  global.performance = { now: () => Date.now() };
}

// Emit afterburner on MiG-17
ps.reset();
ps.emitEnginePlume(500, 500, 0, 350, 1.0, true, mig17, 1.0);

// With 1 engine nozzle, each afterburner emission generates 2 particles (flame + glow) per nozzle
console.log(`MiG-17 particles generated: ${ps.particles.length}`);
if (ps.particles.length !== 2) {
  throw new Error(`Expected exactly 2 particles (1 nozzle x 2 flame/glow) for single-engine MiG-17, got ${ps.particles.length}`);
}

// Verify nozzle position: with heading 0 (cos=1, sin=0), ly=-36 * scale 0.78 = -28.08
const flame = ps.particles[0];
const expectedX = 500 + (-36 * 0.78);
console.log(`Flame particle pos: (${flame.x.toFixed(2)}, ${flame.y.toFixed(2)}), expected X ~ ${expectedX.toFixed(2)}`);
if (Math.abs(flame.x - expectedX) > 0.1 || Math.abs(flame.y - 500) > 0.1) {
  throw new Error(`MiG-17 nozzle particle position mismatch: got (${flame.x}, ${flame.y}), expected (${expectedX}, 500)`);
}
console.log("[PASS] Single engine MiG-17 generates exactly 1 centerline nozzle plume scaled by planeScale!");

// 2. Verify F-15C twin-engine exhaust
ps.reset();
const f15c = AIRCRAFT_DATA.f15c;
ps.emitEnginePlume(500, 500, 0, 350, 1.0, true, f15c, 1.0);
console.log(`F-15C particles generated: ${ps.particles.length}`);
if (ps.particles.length !== 4) {
  throw new Error(`Expected exactly 4 particles (2 nozzles x 2 flame/glow) for twin-engine F-15C, got ${ps.particles.length}`);
}
console.log("[PASS] Twin engine F-15C generates exactly 2 distinct nozzle plumes!");

// 3. Verify Wingtip Trails with custom nodes
ps.reset();
const flightState = {
  isHighG: true,
  gForce: 7.5,
  alphaDeg: 18.0,
  speed: 320
};
ps.updateWingtipTrails(500, 500, 0, flightState, mig17, 1.0);
console.log("Custom node wingtip trails count:", ps.nodeWingtipTrails ? ps.nodeWingtipTrails.length : 0);
if (!ps.nodeWingtipTrails || ps.nodeWingtipTrails.length !== 2) {
  throw new Error(`Expected 2 custom wingtip trail ribbons, got ${ps.nodeWingtipTrails ? ps.nodeWingtipTrails.length : 0}`);
}
console.log("[PASS] Custom wingtip trails spawned for each defined wingtip node!");

// 4. Verify Scale differences across airframes
console.log("\nScale comparison across fleet:");
for (const [id, p] of Object.entries(AIRCRAFT_DATA)) {
  const pScale = p.scale || 1.0;
  const pLen = p.physics.length || 105;
  const effectiveSize = (pLen * pScale).toFixed(1);
  console.log(`- ${id.padEnd(8)}: scale ${pScale.toFixed(2)}, length ${pLen}px -> rendered size ${effectiveSize}px`);
}

const migRenderSize = (mig17.physics.length * mig17.scale);
const f111RenderSize = (AIRCRAFT_DATA.f111f.physics.length * AIRCRAFT_DATA.f111f.scale);
console.log(`MiG-17 rendered size: ${migRenderSize.toFixed(1)}px vs F-111 rendered size: ${f111RenderSize.toFixed(1)}px`);
if (migRenderSize >= f111RenderSize * 0.6) {
  throw new Error(`MiG-17 size should be substantially smaller than heavy F-111!`);
}
console.log("[PASS] MiG-17 is authentically scaled down relative to heavy fighters!");

console.log("\nALL JS PARTICLE, NODE & SCALE TESTS PASSED 100%!");

