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

        // Trace polygon path
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        // 1. Shoreline animated ocean wave surf
        ctx.lineWidth = 64 + 10 + surfPhase * 32;
        ctx.strokeStyle = `rgba(215, 245, 255, ${surfAlpha})`;
        ctx.stroke();

        // 2. Shallow sand beach ring
        ctx.lineWidth = 64;
        ctx.strokeStyle = isl.sandColor || '#45594b';
        ctx.stroke();

        // 3. Crisp shoreline foam edge
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(235, 250, 255, 0.42)';
        ctx.stroke();

        // 4. Island landmass interior
        ctx.fillStyle = isl.color || '#1a382d';
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
      // 1. Shallow sand beach ring
      ctx.fillStyle = isl.sandColor || '#45594b';
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, isl.radius + 36, 0, Math.PI * 2);
      ctx.fill();

      // 2. Shoreline animated wave break
      const surfPhase = (this.waveTime * 0.8 + (Math.abs(isl.x) % 3)) % 1.0;
      const surfRadius = isl.radius + 10 + surfPhase * 26;
      const surfAlpha = Math.sin(surfPhase * Math.PI) * 0.38;
      ctx.strokeStyle = `rgba(215, 245, 255, ${surfAlpha})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(isl.x, isl.y, surfRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Island landmass
      ctx.fillStyle = isl.color || '#1a382d';
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

      // Fast point-in-polygon inclusion test
      const isPointInPoly = (px, py, pts) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const xi = pts[i].x, yi = pts[i].y;
          const xj = pts[j].x, yj = pts[j].y;
          const intersect = ((yi > py) !== (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      };

      const isInsideLand = (px, py) => {
        if (isl.points && isl.points.length >= 3) {
          return isPointInPoly(px, py, isl.points);
        }
        return Math.hypot(px - cx, py - cy) < rad - 20;
      };

      const blockSize = 140;
      const roadWidth = 24;
      const step = blockSize + roadWidth; // 164

      const startGx = Math.floor(minX / step) * step;
      const startGy = Math.floor(minY / step) * step;

      // 1. Asphalt Road Base
      ctx.fillStyle = '#1c2027';
      ctx.fillRect(minX - 50, minY - 50, (maxX - minX) + 100, (maxY - minY) + 100);

      // Road dividers (yellow dashes along corridors)
      ctx.strokeStyle = 'rgba(255, 215, 60, 0.40)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 16]);
      ctx.beginPath();
      for (let rx = startGx; rx <= maxX + step; rx += step) {
        const roadCenterX = rx - roadWidth * 0.5;
        ctx.moveTo(roadCenterX, minY);
        ctx.lineTo(roadCenterX, maxY);
      }
      for (let ry = startGy; ry <= maxY + step; ry += step) {
        const roadCenterY = ry - roadWidth * 0.5;
        ctx.moveTo(minX, roadCenterY);
        ctx.lineTo(maxX, roadCenterY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Dense City Blocks and Building Architecture
      const bldgColors = [
        '#3a404c', '#434a57', '#4e5666', '#545d6e',
        '#354252', '#2f3b49', '#5a6270', '#4a443e'
      ];

      const drawBuilding = (bx, by, bw, bh, brng) => {
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

        // Rooftop features
        const feature = brng();
        if (feature < 0.22 && bw >= 36 && bh >= 36) {
          // Helipad: yellow outer ring with white H
          const hcx = bx + bw * 0.5;
          const hcy = by + bh * 0.5;
          const hRad = Math.min(bw, bh) * 0.30;
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(hcx, hcy, hRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('H', hcx, hcy);
        } else if (feature < 0.60) {
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

          // Chiller vent grates
          ctx.fillStyle = '#788291';
          ctx.fillRect(boxX + 2, boxY + 2, boxW - 4, Math.max(2, boxH * 0.3));
        } else if (feature < 0.82) {
          // Twin HVAC pods
          ctx.fillStyle = '#6d7582';
          const pw = Math.max(6, bw * 0.22);
          const ph = Math.max(5, bh * 0.22);
          ctx.fillRect(bx + 4, by + 4, pw, ph);
          ctx.fillRect(bx + bw - pw - 4, by + bh - ph - 4, pw, ph);
        }
      };

      for (let bx = startGx; bx <= maxX; bx += step) {
        for (let by = startGy; by <= maxY; by += step) {
          const blockCenterX = bx + blockSize * 0.5;
          const blockCenterY = by + blockSize * 0.5;

          // Camera frustum culling
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

          // Test if block is situated on the land polygon
          if (!isInsideLand(blockCenterX, blockCenterY)) {
            continue;
          }

          // Deterministic seed per block
          const blockSeed = Math.abs(Math.floor((bx * 73856093) ^ (by * 19349663) ^ seed)) || 1;
          const brng = createSeededRandom(blockSeed);

          // Draw Sidewalk / Concrete Lot Base
          ctx.fillStyle = '#2b303a';
          ctx.fillRect(bx, by, blockSize, blockSize);

          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#20242c';
          ctx.strokeRect(bx, by, blockSize, blockSize);

          // Block Subdivision: 4 Layout Archetypes
          const layoutType = Math.floor(brng() * 4);

          if (layoutType === 0) {
            // 4 Dense Quadrant Towers
            const subSizeW = (blockSize - 16) * 0.5;
            const subSizeH = (blockSize - 16) * 0.5;
            for (let qx = 0; qx < 2; qx++) {
              for (let qy = 0; qy < 2; qy++) {
                const bwx = bx + 5 + qx * (subSizeW + 6);
                const bwy = by + 5 + qy * (subSizeH + 6);
                drawBuilding(bwx, bwy, subSizeW, subSizeH, brng);
              }
            }
          } else if (layoutType === 1) {
            // 1 Major Skyscraper + 1 Medium Building + Park Plaza
            const majorW = blockSize * 0.5 - 6;
            const majorH = blockSize - 12;
            drawBuilding(bx + 6, by + 6, majorW, majorH, brng);

            const rightW = blockSize * 0.5 - 10;
            const rightH = (blockSize - 18) * 0.5;
            drawBuilding(bx + majorW + 12, by + 6, rightW, rightH, brng);

            // Park Plaza with green trees
            const plazaX = bx + majorW + 12;
            const plazaY = by + rightH + 12;
            ctx.fillStyle = '#243b2a';
            ctx.fillRect(plazaX, plazaY, rightW, rightH);
            ctx.fillStyle = '#1c5230';
            for (let t = 0; t < 3; t++) {
              const tx = plazaX + 8 + brng() * (rightW - 16);
              const ty = plazaY + 6 + brng() * (rightH - 12);
              ctx.beginPath();
              ctx.arc(tx, ty, 5 + brng() * 4, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (layoutType === 2) {
            // 6 Row Buildings (3 columns x 2 rows)
            const subW = (blockSize - 16) / 3;
            const subH = (blockSize - 14) * 0.5;
            for (let rx = 0; rx < 3; rx++) {
              for (let ry = 0; ry < 2; ry++) {
                const bwx = bx + 4 + rx * (subW + 4);
                const bwy = by + 4 + ry * (subH + 6);
                drawBuilding(bwx, bwy, subW, subH, brng);
              }
            }
          } else {
            // 2 Long towers + central parking / alleyway
            const towerW = blockSize - 12;
            const towerH = (blockSize - 24) * 0.5;
            drawBuilding(bx + 6, by + 6, towerW, towerH, brng);
            drawBuilding(bx + 6, by + towerH + 18, towerW, towerH, brng);

            // Central alley / parking strip
            ctx.fillStyle = '#1e2229';
            ctx.fillRect(bx + 8, by + towerH + 8, blockSize - 16, 8);
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
