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
        this.drawLandDecorations(ctx, isl);
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
      this.drawLandDecorations(ctx, isl);
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
  drawLandDecorations(ctx, isl) {
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
      // City: Urban road network and multi-story building blocks
      // 1. Street Grid
      const gridSpacing = Math.max(90, Math.min(180, Math.floor(rad / 3.5)));
      const minX = cx - rad;
      const maxX = cx + rad;
      const minY = cy - rad;
      const maxY = cy + rad;

      ctx.lineWidth = 18;
      ctx.strokeStyle = '#22262e';
      ctx.beginPath();
      let gx = minX + (Math.abs(minX) % gridSpacing);
      while (gx < maxX) {
        ctx.moveTo(gx, minY);
        ctx.lineTo(gx, maxY);
        gx += gridSpacing;
      }
      let gy = minY + (Math.abs(minY) % gridSpacing);
      while (gy < maxY) {
        ctx.moveTo(minX, gy);
        ctx.lineTo(maxX, gy);
        gy += gridSpacing;
      }
      ctx.stroke();

      // Road dividing stripes
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 230, 120, 0.35)';
      ctx.setLineDash([12, 16]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. City Buildings
      const bldgCount = Math.min(65, Math.max(16, Math.floor(rad / 18)));
      const bldgColors = ['#454b57', '#525966', '#3b404a', '#5d6473', '#666e7d'];

      for (let i = 0; i < bldgCount; i++) {
        const dist = Math.sqrt(rng()) * rad * 0.78;
        const angle = rng() * Math.PI * 2;
        const bwx = cx + Math.cos(angle) * dist;
        const bwy = cy + Math.sin(angle) * dist;
        const bw = 35 + rng() * 65;
        const bh = 35 + rng() * 65;

        // Building drop shadow
        ctx.fillStyle = 'rgba(12, 15, 20, 0.65)';
        ctx.fillRect(bwx - bw * 0.5 + 8, bwy - bh * 0.5 + 8, bw, bh);

        // Building rooftop
        ctx.fillStyle = bldgColors[Math.floor(rng() * bldgColors.length)];
        ctx.fillRect(bwx - bw * 0.5, bwy - bh * 0.5, bw, bh);

        // Rooftop border
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#262930';
        ctx.strokeRect(bwx - bw * 0.5, bwy - bh * 0.5, bw, bh);

        // Rooftop HVAC units or Helipad
        const featureRoll = rng();
        if (featureRoll < 0.22 && bw >= 45 && bh >= 45) {
          // Helipad: Yellow circle with white H
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(bwx, bwy, Math.min(bw, bh) * 0.3, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px "Quantico", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('H', bwx, bwy);
        } else if (featureRoll < 0.65) {
          // HVAC units (small rectangles)
          ctx.fillStyle = '#7a8391';
          const hvacW = 8 + rng() * 12;
          const hvacH = 6 + rng() * 10;
          ctx.fillRect(bwx - hvacW * 0.5, bwy - hvacH * 0.5, hvacW, hvacH);
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
