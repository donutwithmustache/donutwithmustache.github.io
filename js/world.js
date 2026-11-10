// Environment: Finite Area of Operation (AO), Archipelago, Shoreline Surf, and Clouds
import { CLOUDS_LAYER_1, CLOUDS_LAYER_2 } from './clouds-data.js';

// Map Size: 2x larger (30,150 meters across / 15,075m half-width)
export const MAP_SIZE = 30150;
export const HALF_MAP_SIZE = MAP_SIZE * 0.5; // 15075 meters

// Fast, robust 32-bit deterministic PRNG (Mulberry32)
function createSeededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor() {
    this.mapSize = MAP_SIZE;
    this.halfMapSize = HALF_MAP_SIZE;

    // Fixed, deterministic static world features across all clients
    this.islands = this.generateIslands(133701);
    // Static immutable clouds (no runtime procedural generation, identical on all clients)
    this.cloudsLayer1 = CLOUDS_LAYER_1;
    this.cloudsLayer2 = CLOUDS_LAYER_2;
    this.waves = this.generateWaves(999901, 1500);

    this.windTime = 0;
    this.waveTime = 0;
  }

  // Fast 2D point-in-polygon ray-casting test
  isPointInPoly(px, py, pts) {
    if (!pts || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > py) !== (yj > py))
        && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Check if a world point lies inside any island other than currentIsland
  isPointInOtherIsland(px, py, currentIsland) {
    if (!this.islands) return false;
    for (let k = 0; k < this.islands.length; k++) {
      const other = this.islands[k];
      if (other === currentIsland) continue;
      if (other.points && other.points.length >= 3) {
        if (this.isPointInPoly(px, py, other.points)) return true;
      } else if (other.radius) {
        const dist = Math.hypot(px - other.x, py - other.y);
        if (dist <= other.radius) return true;
      }
    }
    return false;
  }

  // Minimum distance from point (px, py) to a 2D line segment (x1, y1)-(x2, y2)
  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  // Compute inward distance from a point (px, py) to the island boundary. Returns 0 if outside.
  distToIslandBorder(px, py, isl) {
    if (isl.points && isl.points.length >= 3) {
      if (!this.isPointInPoly(px, py, isl.points)) return 0;
      let minDist = Infinity;
      const pts = isl.points;
      for (let i = 0; i < pts.length; i++) {
        const next = (i + 1) % pts.length;
        const d = this.distToSegment(px, py, pts[i].x, pts[i].y, pts[next].x, pts[next].y);
        if (d < minDist) minDist = d;
      }
      return minDist;
    } else if (isl.radius) {
      const distFromCenter = Math.hypot(px - isl.x, py - isl.y);
      return Math.max(0, isl.radius - distFromCenter);
    }
    return 0;
  }

  // Decompose polygon perimeter into subsegments that face open water (filtering out segments over other land)
  getWaterFacingPerimeterChains(isl) {
    const pts = isl.points;
    if (!pts || pts.length < 3) return [];

    const subStep = 45;
    const subSegments = [];

    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      const edgeLen = Math.hypot(edgeDx, edgeDy);
      if (edgeLen < 1) continue;

      const numSubs = Math.max(1, Math.ceil(edgeLen / subStep));
      const stepX = edgeDx / numSubs;
      const stepY = edgeDy / numSubs;

      // Normal vectors perpendicular to the edge
      const tx = edgeDx / edgeLen;
      const ty = edgeDy / edgeLen;
      const edgeMidX = (p1.x + p2.x) * 0.5;
      const edgeMidY = (p1.y + p2.y) * 0.5;
      // Test 4m along candidate normal to determine outward direction
      const isN1Inside = this.isPointInPoly(edgeMidX - ty * 4, edgeMidY + tx * 4, pts);
      const outNx = isN1Inside ? ty : -ty;
      const outNy = isN1Inside ? -tx : tx;

      for (let s = 0; s < numSubs; s++) {
        const sx1 = p1.x + stepX * s;
        const sy1 = p1.y + stepY * s;
        const sx2 = p1.x + stepX * (s + 1);
        const sy2 = p1.y + stepY * (s + 1);
        const smidX = (sx1 + sx2) * 0.5;
        const smidY = (sy1 + sy2) * 0.5;

        // Test if this subsegment lies on or directly borders another landmass
        const testOutX = smidX + outNx * 22;
        const testOutY = smidY + outNy * 22;
        const isOverOtherLand =
          this.isPointInOtherIsland(smidX, smidY, isl) ||
          this.isPointInOtherIsland(testOutX, testOutY, isl);

        subSegments.push({
          p1: { x: sx1, y: sy1 },
          p2: { x: sx2, y: sy2 },
          isWater: !isOverOtherLand
        });
      }
    }

    // Assemble consecutive water-facing subsegments into stroke paths
    const chains = [];
    let currentChain = null;

    for (const sub of subSegments) {
      if (sub.isWater) {
        if (!currentChain) {
          currentChain = [sub.p1, sub.p2];
          chains.push(currentChain);
        } else {
          currentChain.push(sub.p2);
        }
      } else {
        currentChain = null;
      }
    }

    // Merge loop endpoints if both wrap around
    if (chains.length > 1) {
      const first = chains[0];
      const last = chains[chains.length - 1];
      const d = Math.hypot(first[0].x - last[last.length - 1].x, first[0].y - last[last.length - 1].y);
      if (d < 2) {
        chains[0] = last.concat(first.slice(1));
        chains.pop();
      }
    }

    return chains;
  }

  // Deterministic fixed wave fields
  generateWaves(seed, count) {
    const rng = createSeededRandom(seed);
    const waves = [];
    const span = this.mapSize;
    for (let i = 0; i < count; i++) {
      waves.push({
        x: (rng() - 0.5) * span,
        y: (rng() - 0.5) * span,
        length: 32 + rng() * 48,
        speed: 10 + rng() * 12,
        phase: rng() * Math.PI * 2,
        angle: -0.45 + (rng() - 0.5) * 0.28
      });
    }
    return waves;
  }

  // Fixed deterministic archipelago clusters across the 30km map
  generateIslands(seed) {
    const rng = createSeededRandom(seed);
    const islands = [];

    // Strategic theater clusters across the 30km combat airspace
    const clusters = [
      { cx: 0, cy: 0, spread: 3500, count: 10 },
      { cx: -6500, cy: -5000, spread: 3200, count: 8 },
      { cx: 7000, cy: 4500, spread: 3400, count: 8 },
      // Far Left Center Archipelago (Fortified SAM island chain)
      { cx: -11200, cy: 0, spread: 3200, count: 12 },
      { cx: -9000, cy: 0, spread: 2600, count: 5 },
      { cx: 4500, cy: -1500, spread: 2400, count: 5 }
    ];

    for (const c of clusters) {
      for (let i = 0; i < c.count; i++) {
        const radius = 300 + rng() * 480;
        const ix = c.cx + (rng() - 0.5) * c.spread;
        const iy = c.cy + (rng() - 0.5) * c.spread;
        // Keep comfortably inside AO borders
        const clampedX = Math.max(-this.halfMapSize + 2000, Math.min(this.halfMapSize - 2000, ix));
        const clampedY = Math.max(-this.halfMapSize + 2000, Math.min(this.halfMapSize - 2000, iy));

        islands.push({
          x: clampedX,
          y: clampedY,
          radius,
          landType: 'island',
          color: rng() > 0.3 ? '#1a382d' : '#162e24',
          sandColor: '#45594b'
        });
      }
    }
    return islands;
  }

  draw(ctx, camera, returnLine = null) {
    const viewWidth = ctx.canvas.width / camera.zoom;
    const viewHeight = ctx.canvas.height / camera.zoom;

    // Timing progression
    this.waveTime += 0.016;

    // 1. Deep Ocean Base Background
    const oceanGrad = ctx.createLinearGradient(
      camera.x - viewWidth * 0.5,
      camera.y - viewHeight * 0.5,
      camera.x + viewWidth * 0.5,
      camera.y + viewHeight * 0.5
    );
    oceanGrad.addColorStop(0, '#091b2c');
    oceanGrad.addColorStop(1, '#0d273f');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(camera.x - viewWidth * 0.7, camera.y - viewHeight * 0.7, viewWidth * 1.4, viewHeight * 1.4);

    // 2. Animated Ocean Waves (drifting swells)
    ctx.save();
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';

    for (const w of this.waves) {
      const driftDist = (this.waveTime * w.speed) % 240;
      const wx = w.x + Math.cos(w.angle) * driftDist;
      const wy = w.y + Math.sin(w.angle) * driftDist;

      // View frustum culling
      if (
        wx + 60 < camera.x - viewWidth * 0.6 ||
        wx - 60 > camera.x + viewWidth * 0.6 ||
        wy + 60 < camera.y - viewHeight * 0.6 ||
        wy - 60 > camera.y + viewHeight * 0.6
      ) {
        continue;
      }

      const pulse = Math.sin(this.waveTime * 2.4 + w.phase);
      const alpha = 0.12 + 0.09 * pulse;
      if (alpha <= 0.02) continue;

      ctx.strokeStyle = `rgba(140, 205, 235, ${alpha})`;
      const r = w.length * 0.65;
      ctx.beginPath();
      ctx.arc(wx, wy, r, w.angle - 0.55, w.angle + 0.55);
      ctx.stroke();

      if (pulse > 0.35) {
        ctx.strokeStyle = `rgba(210, 240, 255, ${alpha * 0.75})`;
        ctx.beginPath();
        ctx.arc(wx - Math.cos(w.angle) * 3, wy - Math.sin(w.angle) * 3, r * 0.85, w.angle - 0.38, w.angle + 0.38);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Fixed Terrain Islands & Shoreline Surf (Organic coastlines & Polygonal islands)
    ctx.save();
    for (const isl of this.islands) {
      // Frustum culling
      if (
        isl.x + isl.radius + 150 < camera.x - viewWidth * 0.6 ||
        isl.x - isl.radius - 150 > camera.x + viewWidth * 0.6 ||
        isl.y + isl.radius + 150 < camera.y - viewHeight * 0.6 ||
        isl.y - isl.radius - 150 > camera.y + viewHeight * 0.6
      ) {
        continue;
      }

      // Check for Custom Polygonal Island
      if (isl.points && isl.points.length >= 3) {
        const pts = isl.points;
        const surfPhase = (this.waveTime * 0.8 + (Math.abs(isl.x) % 3)) % 1.0;
        const surfAlpha = Math.sin(surfPhase * Math.PI) * 0.38;

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Filter perimeter edges: only stroke ocean wave surf & beach on edges facing water
        const waterChains = this.getWaterFacingPerimeterChains(isl);

        for (const chain of waterChains) {
          if (chain.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(chain[0].x, chain[0].y);
          for (let k = 1; k < chain.length; k++) {
            ctx.lineTo(chain[k].x, chain[k].y);
          }

          // 1. Shoreline animated ocean wave surf (only on ocean-facing coast)
          ctx.lineWidth = 64 + 10 + surfPhase * 32;
          ctx.strokeStyle = `rgba(215, 245, 255, ${surfAlpha})`;
          ctx.stroke();

          // 2. Shallow sand beach ring (only on ocean-facing coast)
          ctx.lineWidth = 64;
          ctx.strokeStyle = isl.sandColor || (isl.landType === 'city' ? '#252930' : '#45594b');
          ctx.stroke();

          // 3. Crisp shoreline foam edge
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(235, 250, 255, 0.42)';
          ctx.stroke();
        }

        // 4. Island landmass interior (cleanly fills entire island)
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = isl.color || (isl.landType === 'city' ? '#222730' : '#1a382d');
        ctx.fill();

        // 5. Land decorations (Vegetation, Dunes/Rocks, City Buildings)
        ctx.save();
        ctx.clip();
        this.drawLandDecorations(ctx, isl, camera, viewWidth, viewHeight);
        ctx.restore();

        ctx.restore();
        continue;
      }

      // Circular Island (Smooth concentric sand beach & wave break)
      // Check which angular arcs face open ocean water vs neighboring land
      const numArcs = 48;
      const arcStep = (Math.PI * 2) / numArcs;
      const waterArcs = [];

      for (let k = 0; k < numArcs; k++) {
        const a1 = k * arcStep;
        const a2 = (k + 1) * arcStep;
        const amid = (a1 + a2) * 0.5;
        const testX = isl.x + (isl.radius + 20) * Math.cos(amid);
        const testY = isl.y + (isl.radius + 20) * Math.sin(amid);
        const midX = isl.x + isl.radius * Math.cos(amid);
        const midY = isl.y + isl.radius * Math.sin(amid);
        const isOverOtherLand =
          this.isPointInOtherIsland(midX, midY, isl) ||
          this.isPointInOtherIsland(testX, testY, isl);

        if (!isOverOtherLand) {
          waterArcs.push({ a1, a2 });
        }
      }

      const surfPhase = (this.waveTime * 0.8 + (Math.abs(isl.x) % 3)) % 1.0;
      const surfRadius = isl.radius + 10 + surfPhase * 26;
      const surfAlpha = Math.sin(surfPhase * Math.PI) * 0.38;

      ctx.save();
      if (waterArcs.length === numArcs) {
        // Island is surrounded entirely by water
        // 1. Shallow sand beach ring
        ctx.fillStyle = isl.sandColor || (isl.landType === 'city' ? '#252930' : '#45594b');
        ctx.beginPath();
        ctx.arc(isl.x, isl.y, isl.radius + 36, 0, Math.PI * 2);
        ctx.fill();

        // 2. Shoreline animated wave break
        ctx.strokeStyle = `rgba(215, 245, 255, ${surfAlpha})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(isl.x, isl.y, surfRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Island touches or overlaps another landmass: only stroke water-facing arcs
        ctx.lineCap = 'round';
        for (const arc of waterArcs) {
          // 1. Shallow sand beach arc
          ctx.strokeStyle = isl.sandColor || (isl.landType === 'city' ? '#252930' : '#45594b');
          ctx.lineWidth = 36;
          ctx.beginPath();
          ctx.arc(isl.x, isl.y, isl.radius + 18, arc.a1, arc.a2);
          ctx.stroke();

          // 2. Shoreline wave break arc
          ctx.strokeStyle = `rgba(215, 245, 255, ${surfAlpha})`;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(isl.x, isl.y, surfRadius, arc.a1, arc.a2);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 3. Island landmass
      ctx.fillStyle = isl.color || (isl.landType === 'city' ? '#222730' : '#1a382d');
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius, 0, Math.PI * 2);
      ctx.fill();

      // 4. Land decorations (Vegetation, Dunes/Rocks, City Buildings)
      ctx.save();
      ctx.clip();
      this.drawLandDecorations(ctx, isl, camera, viewWidth, viewHeight);
      ctx.restore();
    }
    ctx.restore();

    // 4. Area of Operation (AO) Boundary & Ace Combat Return Line Overlay
    this.drawBoundary(ctx, camera, viewWidth, viewHeight, returnLine);

    // 5. Cloud Layers (Atmospheric Depth - Permanently static geographic landmarks)
    this.drawCloudLayer(ctx, this.cloudsLayer1, camera, viewWidth, viewHeight);
    this.drawCloudLayer(ctx, this.cloudsLayer2, camera, viewWidth, viewHeight);
  }

  // Deterministic internal terrain decoration rendering (vegetation, desert dunes/rocks, city buildings)
  drawLandDecorations(ctx, isl, camera = null, viewWidth = 0, viewHeight = 0) {
    const landType = isl.landType || (isl.theme || 'island');
    const rad = isl.radius || 350;
    const cx = isl.x;
    const cy = isl.y;
    const seed = Math.abs(Math.floor((cx * 137.0) ^ (cy * 313.0) ^ (rad * 19.0))) || 1;
    const rng = createSeededRandom(seed);

    if (landType === 'island') {
      // Vegetation: Dense clusters of lush tropical / temperate tree canopies
      const clusterCount = Math.min(45, Math.max(10, Math.floor(rad / 22)));
      const foliageColors = [
        'rgba(18, 48, 32, 0.95)',
        'rgba(26, 68, 45, 0.95)',
        'rgba(36, 88, 58, 0.92)',
        'rgba(48, 112, 74, 0.90)',
        'rgba(62, 142, 94, 0.85)'
      ];

      for (let i = 0; i < clusterCount; i++) {
        const dist = Math.sqrt(rng()) * rad * 0.82;
        const angle = rng() * Math.PI * 2;
        const wx = cx + Math.cos(angle) * dist;
        const wy = cy + Math.sin(angle) * dist;
        const subPuffs = 3 + Math.floor(rng() * 3);

        for (let p = 0; p < subPuffs; p++) {
          const ox = (rng() - 0.5) * 36;
          const oy = (rng() - 0.5) * 36;
          const puffRad = 14 + rng() * 32;
          const col = foliageColors[Math.floor(rng() * foliageColors.length)];

          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(wx + ox, wy + oy, puffRad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (landType === 'desert') {
      // Desert: Warm windblown sand dune ridges and rocky mesa outcroppings
      // 1. Sand Dunes (layered curved wave crests)
      const duneCount = Math.min(14, Math.max(4, Math.floor(rad / 55)));
      for (let i = 0; i < duneCount; i++) {
        const dist = Math.sqrt(rng()) * rad * 0.75;
        const angle = rng() * Math.PI * 2;
        const dwx = cx + Math.cos(angle) * dist;
        const dwy = cy + Math.sin(angle) * dist;
        const duneLen = 70 + rng() * 160;
        const windAngle = 0.52 + (rng() - 0.5) * 0.25;
        const dx = Math.cos(windAngle) * duneLen;
        const dy = Math.sin(windAngle) * duneLen;
        const cpOffset = (rng() - 0.5) * 30;

        // Shadow slope
        ctx.beginPath();
        ctx.moveTo(dwx - dx * 0.5, dwy - dy * 0.5);
        ctx.quadraticCurveTo(dwx - dy * 0.1, dwy + dx * 0.1 + cpOffset, dwx + dx * 0.5, dwy + dy * 0.5);
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(150, 115, 60, 0.45)';
        ctx.stroke();

        // Crisp dune crest
        ctx.beginPath();
        ctx.moveTo(dwx - dx * 0.5, dwy - dy * 0.5);
        ctx.quadraticCurveTo(dwx - dy * 0.1, dwy + dx * 0.1 + cpOffset, dwx + dx * 0.5, dwy + dy * 0.5);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(238, 212, 150, 0.65)';
        ctx.stroke();
      }

      // 2. Rock Boulders / Mesa outcrops
      const rockCount = Math.min(40, Math.max(12, Math.floor(rad / 25)));
      const rockColors = [
        '#42301c',
        '#543d24',
        '#684c2d',
        '#382716',
        '#7d5c37'
      ];
      for (let i = 0; i < rockCount; i++) {
        const dist = Math.sqrt(rng()) * rad * 0.82;
        const angle = rng() * Math.PI * 2;
        const rwx = cx + Math.cos(angle) * dist;
        const rwy = cy + Math.sin(angle) * dist;
        const rw = 12 + rng() * 26;
        const rh = 10 + rng() * 22;
        const rRot = rng() * Math.PI;

        ctx.save();
        ctx.translate(rwx, rwy);
        ctx.rotate(rRot);

        // Cast shadow
        ctx.fillStyle = 'rgba(25, 18, 10, 0.5)';
        ctx.beginPath();
        ctx.ellipse(rw * 0.2, rh * 0.2, rw * 0.9, rh * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boulder body
        ctx.fillStyle = rockColors[Math.floor(rng() * rockColors.length)];
        ctx.beginPath();
        ctx.ellipse(0, 0, rw * 0.8, rh * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Top highlight
        ctx.fillStyle = 'rgba(215, 180, 130, 0.35)';
        ctx.beginPath();
        ctx.ellipse(-rw * 0.18, -rh * 0.18, rw * 0.45, rh * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    } else if (landType === 'city') {
      // City: Dense urban road networks, structured city blocks, and multi-story building clusters
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      if (isl.points && isl.points.length >= 3) {
        for (const pt of isl.points) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
      } else {
        minX = cx - rad;
        maxX = cx + rad;
        minY = cy - rad;
        maxY = cy + rad;
      }

      // 1. Pristine Industrial / Dock Gray Apron Base (covers the 200m border buffer zone cleanly)
      ctx.fillStyle = '#222730';
      ctx.fillRect(minX - 50, minY - 50, (maxX - minX) + 100, (maxY - minY) + 100);

      const blockSize = 140;
      const roadWidth = 24;
      const step = blockSize + roadWidth; // 164

      const startGx = Math.floor(minX / step) * step;
      const startGy = Math.floor(minY / step) * step;

      // 2. Identify active city blocks strictly at least 200 meters from the island border
      const activeBlocks = new Map();
      const BORDER_BUFFER = 196; // 200m cutoff with slight rounding margin

      for (let bx = startGx; bx <= maxX; bx += step) {
        for (let by = startGy; by <= maxY; by += step) {
          const gx = Math.round(bx / step);
          const gy = Math.round(by / step);

          // Test all 4 corners, center, and 4 edge midpoints
          // Every point of the block must be >= BORDER_BUFFER inside the island
          const pCenter = { x: bx + blockSize * 0.5, y: by + blockSize * 0.5 };
          const pTL = { x: bx, y: by };
          const pTR = { x: bx + blockSize, y: by };
          const pBL = { x: bx, y: by + blockSize };
          const pBR = { x: bx + blockSize, y: by + blockSize };
          const pTC = { x: bx + blockSize * 0.5, y: by };
          const pBC = { x: bx + blockSize * 0.5, y: by + blockSize };
          const pML = { x: bx, y: by + blockSize * 0.5 };
          const pMR = { x: bx + blockSize, y: by + blockSize * 0.5 };

          const testPoints = [pCenter, pTL, pTR, pBL, pBR, pTC, pBC, pML, pMR];
          let blockValid = true;

          for (const tp of testPoints) {
            const d = this.distToIslandBorder(tp.x, tp.y, isl);
            if (d < BORDER_BUFFER) {
              blockValid = false;
              break;
            }
          }

          if (blockValid) {
            activeBlocks.set(`${gx},${gy}`, { bx, by, gx, gy });
          }
        }
      }

      if (activeBlocks.size === 0) {
        // Island is too small for 200m setback; remains clean gray apron
        return;
      }

      const hasBlock = (gx, gy) => activeBlocks.has(`${gx},${gy}`);

      // 3. Road Pavement & Perimeter Boulevards (Clean grid cutoff at 200m boundary)
      ctx.fillStyle = '#171a22';

      // Pave only roads adjacent to active blocks (never spilling into the 200m gray apron)
      for (const block of activeBlocks.values()) {
        const { bx, by, gx, gy } = block;

        // North street pavement
        if (!hasBlock(gx, gy - 1)) {
          ctx.fillRect(bx - roadWidth, by - roadWidth, step + roadWidth, roadWidth);
        }
        // South street pavement
        ctx.fillRect(bx - roadWidth, by + blockSize, step + roadWidth, roadWidth);

        // West street pavement
        if (!hasBlock(gx - 1, gy)) {
          ctx.fillRect(bx - roadWidth, by - roadWidth, roadWidth, step + roadWidth);
        }
        // East street pavement
        ctx.fillRect(bx + blockSize, by - roadWidth, roadWidth, step + roadWidth);
      }

      // Road dividers, arterial avenues, and perimeter boulevards
      for (const block of activeBlocks.values()) {
        const { bx, by, gx, gy } = block;

        // South horizontal corridor
        const southY = by + blockSize + roadWidth * 0.5;
        if (hasBlock(gx, gy + 1)) {
          // Interior Street between active blocks
          if (gy % 2 === 0) {
            // Major Arterial Avenue: Double solid yellow lines
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(bx - roadWidth * 0.5, southY - 2.5);
            ctx.lineTo(bx + blockSize + roadWidth * 0.5, southY - 2.5);
            ctx.moveTo(bx - roadWidth * 0.5, southY + 2.5);
            ctx.lineTo(bx + blockSize + roadWidth * 0.5, southY + 2.5);
            ctx.stroke();
          } else {
            // Local Street: Dashed white lane line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            ctx.moveTo(bx - roadWidth * 0.5, southY);
            ctx.lineTo(bx + blockSize + roadWidth * 0.5, southY);
            ctx.stroke();
          }
        } else {
          // South Perimeter Boulevard: Crisp outer boundary curb line facing the 200m gray apron
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(bx - roadWidth, by + blockSize + roadWidth);
          ctx.lineTo(bx + blockSize + roadWidth, by + blockSize + roadWidth);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([8, 12]);
          ctx.beginPath();
          ctx.moveTo(bx, southY);
          ctx.lineTo(bx + blockSize, southY);
          ctx.stroke();
        }

        // North perimeter street (if top neighbor inactive)
        if (!hasBlock(gx, gy - 1)) {
          const northY = by - roadWidth * 0.5;
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(bx - roadWidth, by - roadWidth);
          ctx.lineTo(bx + blockSize + roadWidth, by - roadWidth);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([8, 12]);
          ctx.beginPath();
          ctx.moveTo(bx, northY);
          ctx.lineTo(bx + blockSize, northY);
          ctx.stroke();
        }

        // East vertical corridor
        const eastX = bx + blockSize + roadWidth * 0.5;
        if (hasBlock(gx + 1, gy)) {
          // Interior Street
          if (gx % 2 === 0) {
            // Major Arterial Avenue: Double solid yellow lines
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(eastX - 2.5, by - roadWidth * 0.5);
            ctx.lineTo(eastX - 2.5, by + blockSize + roadWidth * 0.5);
            ctx.moveTo(eastX + 2.5, by - roadWidth * 0.5);
            ctx.lineTo(eastX + 2.5, by + blockSize + roadWidth * 0.5);
            ctx.stroke();
          } else {
            // Local Street: Dashed white lane line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            ctx.moveTo(eastX, by - roadWidth * 0.5);
            ctx.lineTo(eastX, by + blockSize + roadWidth * 0.5);
            ctx.stroke();
          }
        } else {
          // East Perimeter Boulevard: Crisp outer boundary curb line facing the 200m gray apron
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(bx + blockSize + roadWidth, by - roadWidth);
          ctx.lineTo(bx + blockSize + roadWidth, by + blockSize + roadWidth);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([8, 12]);
          ctx.beginPath();
          ctx.moveTo(eastX, by);
          ctx.lineTo(eastX, by + blockSize);
          ctx.stroke();
        }

        // West perimeter street (if left neighbor inactive)
        if (!hasBlock(gx - 1, gy)) {
          const westX = bx - roadWidth * 0.5;
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(bx - roadWidth, by - roadWidth);
          ctx.lineTo(bx - roadWidth, by + blockSize + roadWidth);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([8, 12]);
          ctx.beginPath();
          ctx.moveTo(westX, by);
          ctx.lineTo(westX, by + blockSize);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // Crosswalks (pedestrian zebra stripes) at intersections between active blocks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([3, 4]);
      for (const block of activeBlocks.values()) {
        const { bx, by, gx, gy } = block;
        if (hasBlock(gx, gy - 1)) {
          ctx.beginPath();
          ctx.moveTo(bx + 12, by - 3);
          ctx.lineTo(bx + blockSize - 12, by - 3);
          ctx.stroke();
        }
        if (hasBlock(gx, gy + 1)) {
          ctx.beginPath();
          ctx.moveTo(bx + 12, by + blockSize + 3);
          ctx.lineTo(bx + blockSize - 12, by + blockSize + 3);
          ctx.stroke();
        }
        if (hasBlock(gx - 1, gy)) {
          ctx.beginPath();
          ctx.moveTo(bx - 3, by + 12);
          ctx.lineTo(bx - 3, by + blockSize - 12);
          ctx.stroke();
        }
        if (hasBlock(gx + 1, gy)) {
          ctx.beginPath();
          ctx.moveTo(bx + blockSize + 3, by + 12);
          ctx.lineTo(bx + blockSize + 3, by + blockSize - 12);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // 4. Diversified Building Architecture (10 Archetypes & < 1.5% Helipads)
      const bldgColors = [
        '#3a404c', '#434a57', '#4e5666', '#545d6e',
        '#354252', '#2f3b49', '#5a6270', '#4a443e'
      ];

      const drawGenericBuilding = (bx, by, bw, bh, brng) => {
        // Drop shadow
        ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
        ctx.fillRect(bx + 6, by + 8, bw, bh);

        // Building rooftop
        const col = bldgColors[Math.floor(brng() * bldgColors.length)];
        ctx.fillStyle = col;
        ctx.fillRect(bx, by, bw, bh);

        // Parapet border
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#22262e';
        ctx.strokeRect(bx, by, bw, bh);

        // Elevator penthouse / HVAC chillers
        const boxW = Math.max(10, bw * 0.35);
        const boxH = Math.max(8, bh * 0.35);
        const boxX = bx + (bw - boxW) * 0.5;
        const boxY = by + (bh - boxH) * 0.5;
        ctx.fillStyle = '#2d333d';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#1d2127';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
      };

      for (const block of activeBlocks.values()) {
        const { bx, by } = block;

        // Frustum culling
        if (camera && viewWidth > 0 && viewHeight > 0) {
          if (
            bx + blockSize < camera.x - viewWidth * 0.6 ||
            bx > camera.x + viewWidth * 0.6 ||
            by + blockSize < camera.y - viewHeight * 0.6 ||
            by > camera.y + viewHeight * 0.6
          ) {
            continue;
          }
        }

        const blockSeed = Math.abs(Math.floor((bx * 73856093) ^ (by * 19349663) ^ seed)) || 1;
        const brng = createSeededRandom(blockSeed);

        // Concrete sidewalk / lot base
        ctx.fillStyle = '#282e38';
        ctx.fillRect(bx, by, blockSize, blockSize);
        ctx.strokeStyle = '#1c2027';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, blockSize, blockSize);

        // 10 Distinct Architectural Archetypes
        const archetype = Math.floor(brng() * 10);

        if (archetype === 0) {
          // Archetype 0: Stepped High-Rise Skyscraper (Tiered Tower with pulsing beacon needle)
          const baseW = blockSize - 24;
          const baseH = blockSize - 24;
          const basePadX = bx + 12;
          const basePadY = by + 12;

          ctx.fillStyle = 'rgba(10, 14, 20, 0.70)';
          ctx.fillRect(basePadX + 8, basePadY + 10, baseW, baseH);
          ctx.fillStyle = '#394250';
          ctx.fillRect(basePadX, basePadY, baseW, baseH);
          ctx.strokeStyle = '#232932';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(basePadX, basePadY, baseW, baseH);

          // Tier 2 setback
          const t2W = baseW * 0.74;
          const t2H = baseH * 0.74;
          const t2X = bx + (blockSize - t2W) * 0.5;
          const t2Y = by + (blockSize - t2H) * 0.5;
          ctx.fillStyle = 'rgba(10, 14, 20, 0.50)';
          ctx.fillRect(t2X + 5, t2Y + 6, t2W, t2H);
          ctx.fillStyle = '#454f60';
          ctx.fillRect(t2X, t2Y, t2W, t2H);
          ctx.strokeStyle = '#252b36';
          ctx.strokeRect(t2X, t2Y, t2W, t2H);

          // Tier 3 top penthouse
          const t3W = t2W * 0.65;
          const t3H = t2H * 0.65;
          const t3X = bx + (blockSize - t3W) * 0.5;
          const t3Y = by + (blockSize - t3H) * 0.5;
          ctx.fillStyle = '#2d3644';
          ctx.fillRect(t3X, t3Y, t3W, t3H);

          // Rooftop communications spire / needle with blinking red beacon
          const spireX = bx + blockSize * 0.5;
          const spireY = by + blockSize * 0.5;
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(spireX, spireY, 4, 0, Math.PI * 2);
          ctx.fill();

          const beaconBlink = Math.sin(this.waveTime * 3.5) > 0;
          ctx.fillStyle = beaconBlink ? '#ef4444' : '#6b1c1c';
          ctx.beginPath();
          ctx.arc(spireX, spireY, 2.2, 0, Math.PI * 2);
          ctx.fill();

          // Ultra-rare helipad on skyscraper (only 1.2% chance)
          if (brng() < 0.012) {
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(spireX, spireY, 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('H', spireX, spireY);
          }
        } else if (archetype === 1) {
          // Archetype 1: Reflective Glass Corporate Monoliths with Central Landscaped Plaza
          const tw = 48;
          const th = blockSize - 24;

          // Tower 1 (West)
          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(bx + 12 + 6, by + 12 + 8, tw, th);
          ctx.fillStyle = '#253a4c';
          ctx.fillRect(bx + 12, by + 12, tw, th);
          ctx.strokeStyle = '#1b2936';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 12, by + 12, tw, th);

          // Diagonal glass glare ribbon
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx + 14, by + 28);
          ctx.lineTo(bx + 54, by + 68);
          ctx.stroke();

          // Tower 2 (East)
          const t2X = bx + blockSize - 12 - tw;
          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(t2X + 6, by + 12 + 8, tw, th);
          ctx.fillStyle = '#284054';
          ctx.fillRect(t2X, by + 12, tw, th);
          ctx.strokeStyle = '#1b2936';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(t2X, by + 12, tw, th);

          // Diagonal glass glare ribbon
          ctx.beginPath();
          ctx.moveTo(t2X + 4, by + 28);
          ctx.lineTo(t2X + 44, by + 68);
          ctx.stroke();

          // Central landscaped plaza between monoliths
          const plX = bx + 62;
          const plW = t2X - plX - 4;
          ctx.fillStyle = '#202630';
          ctx.fillRect(plX, by + 16, plW, th - 8);
          // Green shade trees in plaza
          ctx.fillStyle = '#166534';
          for (let ty = by + 28; ty <= by + th; ty += 28) {
            ctx.beginPath();
            ctx.arc(plX + plW * 0.5, ty, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (archetype === 2) {
          // Archetype 2: Twin Towers with Elevated Pedestrian Skybridge
          const tw = 40;
          const th = blockSize - 28;

          // Tower 1
          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(bx + 12 + 6, by + 14 + 8, tw, th);
          ctx.fillStyle = '#3e4756';
          ctx.fillRect(bx + 12, by + 14, tw, th);
          ctx.strokeStyle = '#222832';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 12, by + 14, tw, th);

          // Tower 2
          const t2X = bx + blockSize - 12 - tw;
          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(t2X + 6, by + 14 + 8, tw, th);
          ctx.fillStyle = '#3e4756';
          ctx.fillRect(t2X, by + 14, tw, th);
          ctx.strokeStyle = '#222832';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(t2X, by + 14, tw, th);

          // Elevated Glass Skybridge spanning between towers
          const bridgeY = by + blockSize * 0.5 - 11;
          const bridgeH = 22;
          const bridgeX = bx + 12 + tw;
          const bridgeW = t2X - bridgeX;

          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(bridgeX + 3, bridgeY + 6, bridgeW, bridgeH);
          ctx.fillStyle = '#475569';
          ctx.fillRect(bridgeX, bridgeY, bridgeW, bridgeH);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bridgeX, bridgeY, bridgeW, bridgeH);

          // Skybridge glass windows
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(bridgeX + 4, bridgeY + 4, bridgeW - 8, 4);
          ctx.fillRect(bridgeX + 4, bridgeY + bridgeH - 8, bridgeW - 8, 4);
        } else if (archetype === 3) {
          // Archetype 3: Government / Corporate Quadrangle (O-shaped complex with central fountain)
          const outerW = blockSize - 20;
          const outerH = blockSize - 20;
          const outerX = bx + 10;
          const outerY = by + 10;
          const ringThickness = 24;

          // Shadow
          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(outerX + 6, outerY + 8, outerW, outerH);

          // Outer building ring
          ctx.fillStyle = '#475569';
          ctx.fillRect(outerX, outerY, outerW, outerH);
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(outerX, outerY, outerW, outerH);

          // Inner Courtyard cutout
          const inX = outerX + ringThickness;
          const inY = outerY + ringThickness;
          const inW = outerW - ringThickness * 2;
          const inH = outerH - ringThickness * 2;
          ctx.fillStyle = '#1e242d';
          ctx.fillRect(inX, inY, inW, inH);
          ctx.strokeStyle = '#334155';
          ctx.strokeRect(inX, inY, inW, inH);

          // Central circular fountain in courtyard
          const fcx = inX + inW * 0.5;
          const fcy = inY + inH * 0.5;
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(fcx, fcy, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 4 Corner ornamental hedge squares
          ctx.fillStyle = '#15803d';
          ctx.fillRect(inX + 4, inY + 4, 8, 8);
          ctx.fillRect(inX + inW - 12, inY + 4, 8, 8);
          ctx.fillRect(inX + 4, inY + inH - 12, 8, 8);
          ctx.fillRect(inX + inW - 12, inY + inH - 12, 8, 8);
        } else if (archetype === 4) {
          // Archetype 4: Industrial Logistics & Cylindrical Storage Silos Depot
          // North warehouse with corrugated metal roof
          const whW = blockSize - 20;
          const whH = 52;
          const whX = bx + 10;
          const whY = by + 10;

          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(whX + 5, whY + 6, whW, whH);
          ctx.fillStyle = '#374151';
          ctx.fillRect(whX, whY, whW, whH);
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(whX, whY, whW, whH);

          // Linear skylight ridges across warehouse
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 2;
          for (let rx = whX + 16; rx <= whX + whW - 16; rx += 22) {
            ctx.beginPath();
            ctx.moveTo(rx, whY + 6);
            ctx.lineTo(rx, whY + whH - 6);
            ctx.stroke();
          }

          // South half: 4 Cylindrical storage silos / fuel tanks
          const siloCoords = [
            { x: bx + 32, y: by + 94 },
            { x: bx + 64, y: by + 94 },
            { x: bx + 96, y: by + 94 },
            { x: bx + 48, y: by + 120 }
          ];

          for (const s of siloCoords) {
            // Silo shadow
            ctx.fillStyle = 'rgba(10, 14, 20, 0.60)';
            ctx.beginPath();
            ctx.arc(s.x + 4, s.y + 5, 13, 0, Math.PI * 2);
            ctx.fill();

            // Silo metal body
            ctx.fillStyle = '#4b5563';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 13, 0, Math.PI * 2);
            ctx.fill();

            // Specular crescent ring & outer rim
            ctx.strokeStyle = '#9ca3af';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Top center maintenance hatch
            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (archetype === 5) {
          // Archetype 5: High-Density Residential Apartments with Rooftop Solar Panel Arrays
          const subW = (blockSize - 24) * 0.5;
          const subH = (blockSize - 24) * 0.5;

          for (let qx = 0; qx < 2; qx++) {
            for (let qy = 0; qy < 2; qy++) {
              const ax = bx + 8 + qx * (subW + 8);
              const ay = by + 8 + qy * (subH + 8);

              // Building shadow & base
              ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
              ctx.fillRect(ax + 5, ay + 6, subW, subH);
              ctx.fillStyle = '#334155';
              ctx.fillRect(ax, ay, subW, subH);
              ctx.strokeStyle = '#1e293b';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(ax, ay, subW, subH);

              // Solar panel rows (cyan photovoltaic cells)
              ctx.fillStyle = '#0c4a6e';
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.40)';
              ctx.lineWidth = 1;
              for (let sy = ay + 6; sy <= ay + subH - 12; sy += 10) {
                ctx.fillRect(ax + 6, sy, subW - 12, 7);
                ctx.strokeRect(ax + 6, sy, subW - 12, 7);
              }
            }
          }
        } else if (archetype === 6) {
          // Archetype 6: Corporate HQ & Technology Center (Solar arrays, HVAC units + Executive Helipad)
          const bldW = blockSize - 20;
          const bldH = blockSize - 20;
          const bldX = bx + 10;
          const bldY = by + 10;

          ctx.fillStyle = 'rgba(10, 14, 20, 0.70)';
          ctx.fillRect(bldX + 6, bldY + 8, bldW, bldH);
          ctx.fillStyle = '#374151';
          ctx.fillRect(bldX, bldY, bldW, bldH);
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bldX, bldY, bldW, bldH);

          // Dark blue photovoltaic solar panel arrays on one wing
          const solarW = Math.round(bldW * 0.45);
          const solarH = Math.round(bldH * 0.65);
          const solarX = bldX + bldW - solarW - 8;
          const solarY = bldY + 8;
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(solarX, solarY, solarW, solarH);
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(solarX, solarY, solarW, solarH);
          // Solar panel grid gridlines
          for (let gx = solarX + 8; gx < solarX + solarW; gx += 8) {
            ctx.beginPath(); ctx.moveTo(gx, solarY); ctx.lineTo(gx, solarY + solarH); ctx.stroke();
          }
          for (let gy = solarY + 8; gy < solarY + solarH; gy += 8) {
            ctx.beginPath(); ctx.moveTo(solarX, gy); ctx.lineTo(solarX + solarW, gy); ctx.stroke();
          }

          // Rooftop HVAC chiller units
          ctx.fillStyle = '#64748b';
          ctx.fillRect(bldX + 8, bldY + 8, 22, 14);
          ctx.fillRect(bldX + 8, bldY + 26, 22, 14);

          // Executive Corporate Helipad on the other wing
          const hcx = bldX + 28;
          const hcy = bldY + bldH * 0.65;
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(hcx, hcy, 18, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('H', hcx, hcy);
        } else if (archetype === 7) {
          // Archetype 7: Civic Plaza & Grand Central Urban Park
          // Decorative stone promenade
          ctx.fillStyle = '#262f3d';
          ctx.fillRect(bx + 8, by + 8, blockSize - 16, blockSize - 16);
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 8, by + 8, blockSize - 16, blockSize - 16);

          // Central ornamental reflecting pool / basin
          const poolW = blockSize * 0.5;
          const poolH = blockSize * 0.36;
          const poolX = bx + (blockSize - poolW) * 0.5;
          const poolY = by + (blockSize - poolH) * 0.5;

          ctx.fillStyle = '#0369a1';
          ctx.fillRect(poolX, poolY, poolW, poolH);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(poolX, poolY, poolW, poolH);

          // Clustered shade trees
          const treePoints = [
            { x: bx + 22, y: by + 22, r: 8 },
            { x: bx + 36, y: by + 26, r: 10 },
            { x: bx + blockSize - 24, y: by + 24, r: 9 },
            { x: bx + blockSize - 36, y: by + 34, r: 8 },
            { x: bx + 22, y: by + blockSize - 24, r: 9 },
            { x: bx + 34, y: by + blockSize - 34, r: 7 },
            { x: bx + blockSize - 24, y: by + blockSize - 24, r: 9 },
            { x: bx + blockSize - 36, y: by + blockSize - 36, r: 8 }
          ];

          ctx.fillStyle = '#15803d';
          for (const tp of treePoints) {
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, tp.r, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (archetype === 8) {
          // Archetype 8: Tech Innovation Campus with Angled Wings & Paved Parking Lot
          // Two L-shaped modular research pavilions
          const pav1W = blockSize - 24;
          const pav1H = 38;
          ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
          ctx.fillRect(bx + 12 + 5, by + 12 + 6, pav1W, pav1H);
          ctx.fillStyle = '#3c4656';
          ctx.fillRect(bx + 12, by + 12, pav1W, pav1H);
          ctx.strokeStyle = '#1e242d';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 12, by + 12, pav1W, pav1H);

          // Central glass skylight atrium
          ctx.fillStyle = '#1e3a5f';
          ctx.fillRect(bx + blockSize * 0.5 - 18, by + 18, 36, 26);
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + blockSize * 0.5 - 18, by + 18, 36, 26);

          // South parking lot with painted white parking stalls
          const lotX = bx + 12;
          const lotY = by + 60;
          const lotW = blockSize - 24;
          const lotH = blockSize - 72;

          ctx.fillStyle = '#1c2027';
          ctx.fillRect(lotX, lotY, lotW, lotH);
          ctx.strokeStyle = '#374151';
          ctx.strokeRect(lotX, lotY, lotW, lotH);

          // Parking stall lines & parked cars
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
          ctx.lineWidth = 1;
          const carColors = ['#cbd5e1', '#b91c1c', '#1d4ed8', '#475569', '#d97706'];
          let carIdx = 0;
          for (let px = lotX + 10; px <= lotX + lotW - 14; px += 14) {
            ctx.beginPath();
            ctx.moveTo(px, lotY + 4);
            ctx.lineTo(px, lotY + 18);
            ctx.stroke();

            // Parked car
            if (brng() < 0.65) {
              ctx.fillStyle = carColors[(carIdx++) % carColors.length];
              ctx.fillRect(px + 2, lotY + 6, 8, 12);
            }
          }
        } else {
          // Archetype 9: Mixed Commercial City Block (6 Row Stores & Rooftop Water Towers)
          const subW = (blockSize - 20) / 3;
          const subH = (blockSize - 18) * 0.5;

          for (let rx = 0; rx < 3; rx++) {
            for (let ry = 0; ry < 2; ry++) {
              const rbx = bx + 6 + rx * (subW + 4);
              const rby = by + 6 + ry * (subH + 6);
              drawGenericBuilding(rbx, rby, subW, subH, brng);

              // Rooftop traditional wooden/steel water tower on selected row buildings
              if (rx === 1 && ry === 0) {
                const wcx = rbx + subW * 0.5;
                const wcy = rby + subH * 0.5;
                ctx.fillStyle = '#78350f';
                ctx.beginPath();
                ctx.arc(wcx, wcy, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          }
        }
      }
    }
  }

  // Draw military combat zone perimeter, restricted airspace, and Ace Combat Return Line
  drawBoundary(ctx, camera, viewWidth, viewHeight, returnLine = null) {
    const minX = -this.halfMapSize;
    const maxX = this.halfMapSize;
    const minY = -this.halfMapSize;
    const maxY = this.halfMapSize;

    ctx.save();

    // Restricted airspace darkening outside the map
    ctx.fillStyle = 'rgba(5, 2, 8, 0.55)';
    // Left exterior
    if (camera.x - viewWidth * 0.7 < minX) {
      ctx.fillRect(camera.x - viewWidth * 0.7, camera.y - viewHeight * 0.7, minX - (camera.x - viewWidth * 0.7), viewHeight * 1.4);
    }
    // Right exterior
    if (camera.x + viewWidth * 0.7 > maxX) {
      ctx.fillRect(maxX, camera.y - viewHeight * 0.7, (camera.x + viewWidth * 0.7) - maxX, viewHeight * 1.4);
    }
    // Top exterior
    if (camera.y - viewHeight * 0.7 < minY) {
      ctx.fillRect(camera.x - viewWidth * 0.7, camera.y - viewHeight * 0.7, viewWidth * 1.4, minY - (camera.y - viewHeight * 0.7));
    }
    // Bottom exterior
    if (camera.y + viewHeight * 0.7 > maxY) {
      ctx.fillRect(camera.x - viewWidth * 0.7, maxY, viewWidth * 1.4, (camera.y + viewHeight * 0.7) - maxY);
    }

    // ----------------------------------------------------
    // ACE COMBAT RETURN LINE (Resupply Line)
    // ----------------------------------------------------
    if (returnLine && returnLine.enabled) {
      const side = (returnLine.side || 'bottom').toLowerCase();
      const offset = returnLine.offset !== undefined ? returnLine.offset : 0.10;
      const zoneDepth = this.mapSize * offset;

      let rlX1 = minX, rlY1 = minY, rlX2 = maxX, rlY2 = maxY;
      let zoneX = minX, zoneY = minY, zoneW = this.mapSize, zoneH = this.mapSize;
      let isVertical = false;

      if (side === 'bottom') {
        const rlY = maxY - zoneDepth;
        rlX1 = minX; rlY1 = rlY; rlX2 = maxX; rlY2 = rlY;
        zoneX = minX; zoneY = rlY; zoneW = this.mapSize; zoneH = zoneDepth;
      } else if (side === 'top') {
        const rlY = minY + zoneDepth;
        rlX1 = minX; rlY1 = rlY; rlX2 = maxX; rlY2 = rlY;
        zoneX = minX; zoneY = minY; zoneW = this.mapSize; zoneH = zoneDepth;
      } else if (side === 'left') {
        const rlX = minX + zoneDepth;
        rlX1 = rlX; rlY1 = minY; rlX2 = rlX; rlY2 = maxY;
        zoneX = minX; zoneY = minY; zoneW = zoneDepth; zoneH = this.mapSize;
        isVertical = true;
      } else if (side === 'right') {
        const rlX = maxX - zoneDepth;
        rlX1 = rlX; rlY1 = minY; rlX2 = rlX; rlY2 = maxY;
        zoneX = rlX; zoneY = minY; zoneW = zoneDepth; zoneH = this.mapSize;
        isVertical = true;
      }

      // 1. Shaded Return / Resupply Base Zone
      ctx.save();
      ctx.fillStyle = 'rgba(0, 160, 255, 0.14)';
      ctx.fillRect(zoneX, zoneY, zoneW, zoneH);

      // Subtle tactical hazard hatching inside return zone
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.18)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const step = 450;
      if (!isVertical) {
        for (let hx = minX - zoneDepth; hx < maxX + zoneDepth; hx += step) {
          ctx.moveTo(hx, zoneY);
          ctx.lineTo(hx + zoneDepth, zoneY + zoneH);
        }
      } else {
        for (let hy = minY - zoneDepth; hy < maxY + zoneDepth; hy += step) {
          ctx.moveTo(zoneX, hy);
          ctx.lineTo(zoneX + zoneW, hy + zoneDepth);
        }
      }
      ctx.stroke();

      // 2. Thick Glowing Blue/Cyan Return Line
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 5.5;
      ctx.setLineDash([48, 22]);
      ctx.shadowColor = '#00bbff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(rlX1, rlY1);
      ctx.lineTo(rlX2, rlY2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Return Line Text Banner
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';

      if (!isVertical) {
        const labelY = (side === 'bottom') ? rlY1 + 38 : rlY1 - 22;
        for (let lx = minX + 2400; lx < maxX; lx += 3600) {
          if (Math.abs(lx - camera.x) < viewWidth * 0.6) {
            ctx.fillText('<< RETURN LINE // RESUPPLY BASE (REARMS AIRCRAFT) >>', lx, labelY);
          }
        }
      } else {
        const labelX = (side === 'right') ? rlX1 + 38 : rlX1 - 38;
        for (let ly = minY + 2400; ly < maxY; ly += 3600) {
          if (Math.abs(ly - camera.y) < viewHeight * 0.6) {
            ctx.save();
            ctx.translate(labelX, ly);
            ctx.rotate(side === 'right' ? Math.PI * 0.5 : -Math.PI * 0.5);
            ctx.fillText('<< RETURN LINE // RESUPPLY BASE >>', 0, 0);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    // Glowing combat zone perimeter line
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 4.5;
    ctx.setLineDash([32, 20]);
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 14;
    ctx.strokeRect(minX, minY, this.mapSize, this.mapSize);
    ctx.setLineDash([]);

    // Corner bracket markers in world space
    const cb = 140;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffff44';
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(minX, minY + cb); ctx.lineTo(minX, minY); ctx.lineTo(minX + cb, minY);
    // Top-Right
    ctx.moveTo(maxX - cb, minY); ctx.lineTo(maxX, minY); ctx.lineTo(maxX, minY + cb);
    // Bottom-Left
    ctx.moveTo(minX, maxY - cb); ctx.lineTo(minX, maxY); ctx.lineTo(minX + cb, maxY);
    // Bottom-Right
    ctx.moveTo(maxX - cb, maxY); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX, maxY - cb);
    ctx.stroke();

    // Boundary labels along borders (rendered if in view)
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';

    const step = 4000;
    // North border labels
    if (Math.abs(minY - camera.y) < viewHeight * 0.6) {
      for (let x = minX + 2500; x < maxX; x += step) {
        if (Math.abs(x - camera.x) < viewWidth * 0.6) {
          ctx.fillText('<< AREA OF OPERATION BORDER // RESTRICTED AIRSPACE >>', x, minY + 36);
        }
      }
    }
    // South border labels
    if (Math.abs(maxY - camera.y) < viewHeight * 0.6) {
      for (let x = minX + 2500; x < maxX; x += step) {
        if (Math.abs(x - camera.x) < viewWidth * 0.6) {
          ctx.fillText('<< AREA OF OPERATION BORDER // RESTRICTED AIRSPACE >>', x, maxY - 20);
        }
      }
    }
    // West border labels
    if (Math.abs(minX - camera.x) < viewWidth * 0.6) {
      ctx.save();
      ctx.translate(minX + 36, camera.y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('<< AREA OF OPERATION BORDER // RESTRICTED AIRSPACE >>', 0, 0);
      ctx.restore();
    }
    // East border labels
    if (Math.abs(maxX - camera.x) < viewWidth * 0.6) {
      ctx.save();
      ctx.translate(maxX - 20, camera.y);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('<< AREA OF OPERATION BORDER // RESTRICTED AIRSPACE >>', 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  // Draw cloud layer with exact puff bounding radius (100% immune to edge-popping)
  drawCloudLayer(ctx, clouds, camera, viewWidth, viewHeight) {
    ctx.save();
    const halfViewW = viewWidth * 0.5;
    const halfViewH = viewHeight * 0.5;

    for (const c of clouds) {
      const margin = (c.boundingRadius || c.radius || 300) + 150;
      // Generous bounding frustum culling: clouds never pop at screen edges
      if (
        Math.abs(c.x - camera.x) > halfViewW + margin ||
        Math.abs(c.y - camera.y) > halfViewH + margin
      ) {
        continue;
      }

      ctx.fillStyle = `rgba(235, 248, 255, ${c.alpha})`;
      for (const puff of c.puffs) {
        ctx.beginPath();
        ctx.arc(c.x + puff.ox, c.y + puff.oy, puff.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
