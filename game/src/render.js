// render.js — the chase view: a 2.5D canvas projection of the archipelago
// with the Elang-7 always centred in the lower frame. Sky, sun, clouds,
// sea, islands, runways, rings, rival and the aircraft itself.
import { CONFIG } from './config.js';
import { ISLANDS, RINGS, BEACON, groundHeightAt, runwayCorners } from './world.js';

// Build a camera basis from the plane: behind it, slightly above, looking
// along its heading with half its pitch so the view never fights the pilot.
export function makeCamera(plane) {
  const back = 15, up = 4.5;
  const fx = Math.sin(plane.heading), fz = Math.cos(plane.heading);
  const cam = {
    x: plane.x - fx * back,
    z: plane.z - fz * back,
    alt: plane.alt + up,
    heading: plane.heading,
    pitch: plane.pitch * 0.5,
    focal: 0,
  };
  return cam;
}

// Project a world point to screen space. Returns null when behind the camera.
export function project(cam, px, py, pz, W, H) {
  const dx = px - cam.x, dy = py - cam.alt, dz = pz - cam.z;
  const ch = Math.cos(cam.heading), sh = Math.sin(cam.heading);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // Forward / right / up in camera space.
  const fwd = dx * sh * cp + dy * sp + dz * ch * cp;
  if (fwd < 2) return null;
  const right = dx * ch - dz * sh;
  const up = -dx * sh * sp + dy * cp - dz * ch * sp;
  const focal = (H / 2) / Math.tan((62 * Math.PI) / 360);
  return {
    x: W / 2 + (right / fwd) * focal,
    y: H * 0.46 - (up / fwd) * focal,
    s: focal / fwd, // screen scale at this depth
    dist: fwd,
  };
}

function drawSky(ctx, W, H, plane, time) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  g.addColorStop(0, CONFIG.palette.skyTop);
  g.addColorStop(0.55, CONFIG.palette.skyMid);
  g.addColorStop(1, CONFIG.palette.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.62);
  // Sun, fixed in the sky ahead-left.
  const sunX = W * 0.78, sunY = H * 0.13;
  const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
  sg.addColorStop(0, 'rgba(255,243,176,0.95)');
  sg.addColorStop(0.25, 'rgba(255,243,176,0.55)');
  sg.addColorStop(1, 'rgba(255,243,176,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
  ctx.fillStyle = CONFIG.palette.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
}

// Sea fills the lower half; the horizon line follows the camera pitch.
export function drawSea(ctx, W, H, plane) {
  const horizonY = H * 0.46 + plane.pitch * 320;
  const g = ctx.createLinearGradient(0, horizonY, 0, H);
  g.addColorStop(0, CONFIG.palette.seaFar);
  g.addColorStop(1, CONFIG.palette.seaNear);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, horizonY), W, H);
  // Sun glitter on the water, faint and close under the sun.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 10; i++) {
    const y = horizonY + 24 + i * 22;
    const w = 40 + i * 10;
    ctx.fillRect(W * 0.76 - w / 2, y, w, 2);
  }
  return horizonY;
}

// One island: sand rim, grass body, jungle heart, volcano cone if it has one.
function drawIsland(ctx, isl, cam, W, H) {
  const P = CONFIG.palette;
  const steps = 26;
  const rim = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = isl.x + Math.cos(a) * isl.radius;
    const z = isl.z + Math.sin(a) * isl.radius;
    const p = project(cam, x, 3, z, W, H);
    if (p) rim.push(p);
  }
  if (rim.length < 3) return;
  const poly = (pts, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.fill();
  };
  poly(rim, P.sand);
  // Grass: same outline shrunk toward the centre, raised a little.
  const grass = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = isl.x + Math.cos(a) * isl.radius * 0.86;
    const z = isl.z + Math.sin(a) * isl.radius * 0.86;
    const p = project(cam, x, isl.height * 0.12 + 4, z, W, H);
    if (p) grass.push(p);
  }
  if (grass.length >= 3) poly(grass, P.grass);
  // Jungle heart.
  const jungle = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = isl.x + Math.cos(a) * isl.radius * 0.5;
    const z = isl.z + Math.sin(a) * isl.radius * 0.5;
    const p = project(cam, x, isl.height * 0.4 + 6, z, W, H);
    if (p) jungle.push(p);
  }
  if (jungle.length >= 3) poly(jungle, P.jungle);
  // Volcano cone + lava cap for Pulau Api.
  if (isl.volcano) {
    const apex = project(cam, isl.x, isl.height + 120, isl.z, W, H);
    const baseL = project(cam, isl.x - isl.radius * 0.34, isl.height * 0.5, isl.z, W, H);
    const baseR = project(cam, isl.x + isl.radius * 0.34, isl.height * 0.5, isl.z, W, H);
    if (apex && baseL && baseR) {
      ctx.fillStyle = P.volcanoRock;
      ctx.beginPath();
      ctx.moveTo(baseL.x, baseL.y); ctx.lineTo(apex.x, apex.y); ctx.lineTo(baseR.x, baseR.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.volcanoLava;
      ctx.beginPath();
      ctx.arc(apex.x, apex.y + 4, Math.max(3, apex.s * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Island name, drawn at the island's projected centre.
  const c = project(cam, isl.x, isl.height * 0.55 + 10, isl.z, W, H);
  if (c && c.dist < 9000) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `bold ${Math.max(13, Math.min(26, c.s * 0.16))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isl.name.toUpperCase(), c.x, c.y);
  }
}

function drawRunway(ctx, isl, cam, W, H) {
  const rw = isl.runway;
  if (!rw) return;
  const P = CONFIG.palette;
  const corners = runwayCorners(rw).map((c) => project(cam, c.x, c.alt, c.z, W, H));
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = P.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath(); ctx.fill();
  // Centreline dashes + threshold bars.
  ctx.strokeStyle = P.runwayMark;
  ctx.lineWidth = Math.max(1.5, corners[0].s * 0.012);
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  const a = project(cam, rw.x - Math.sin(rw.heading) * rw.length * 0.42, 6, rw.z - Math.cos(rw.heading) * rw.length * 0.42, W, H);
  const b = project(cam, rw.x + Math.sin(rw.heading) * rw.length * 0.42, 6, rw.z + Math.cos(rw.heading) * rw.length * 0.42, W, H);
  if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.setLineDash([]);
  const label = project(cam, rw.x, 12, rw.z, W, H);
  if (label && label.dist < 6000) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RUNWAY ${isl.name.toUpperCase()}`, label.x, label.y - 14);
  }
}

// A ring: a glowing circle standing in the sky, its near half brighter.
function drawRing(ctx, ring, cam, W, H, index, active) {
  const P = CONFIG.palette;
  const pts = [];
  const steps = 24;
  // Ring plane faces along the course (toward the previous ring / start).
  const prev = index === 0 ? { x: 350, z: 1050 } : RINGS[index - 1];
  const hx = ring.x - prev.x, hz = ring.z - prev.z;
  const hl = Math.hypot(hx, hz) || 1;
  const nx = hx / hl, nz = hz / hl; // ring normal (course direction)
  const ux = -nz, uz = nx;          // ring "right" on the ground
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = ring.x + ux * Math.cos(a) * ring.r;
    const y = ring.alt + Math.sin(a) * ring.r;
    const z = ring.z + uz * Math.cos(a) * ring.r;
    const p = project(cam, x, y, z, W, H);
    if (p) pts.push(p);
  }
  if (pts.length < 4) return;
  ctx.lineWidth = active ? 7 : 4;
  ctx.strokeStyle = active ? P.ringGlow : 'rgba(255,176,32,0.55)';
  ctx.shadowColor = P.ring; ctx.shadowBlur = active ? 16 : 6;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;
  if (active) {
    const c = project(cam, ring.x, ring.alt, ring.z, W, H);
    if (c) {
      ctx.fillStyle = P.ring;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${index + 1}`, c.x, c.y - c.s * 0.055 - 18);
    }
  }
}

function drawCloud(ctx, cloud, cam, W, H, storm) {
  const c = project(cam, cloud.x, cloud.alt, cloud.z, W, H);
  if (!c || c.dist < 40) return;
  const s = c.s * (cloud.size / 260);
  ctx.fillStyle = storm ? 'rgba(70,76,92,0.85)' : 'rgba(255,255,255,0.92)';
  for (let i = 0; i < cloud.puffs; i++) {
    const ox = (i - cloud.puffs / 2) * s * 0.55;
    ctx.beginPath();
    ctx.ellipse(c.x + ox, c.y - (i % 2) * s * 0.18, s * 0.55, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The rival Rajawali-9: a small red aircraft ahead, with a distance marker.
function drawRival(ctx, rival, cam, W, H) {
  const p = project(cam, rival.x, rival.alt, rival.z, W, H);
  if (!p || p.dist < 20) return;
  const s = Math.max(8, Math.min(70, p.s * 0.16));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = CONFIG.palette.rival;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-s * 0.9, -s * 0.12, s * 1.8, s * 0.24);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(12, s * 0.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`KIRANA · ${Math.round(p.dist)}m`, 0, -s * 0.7);
  ctx.restore();
}

// The player's Elang-7, drawn big in the lower centre: fuselage, wings,
// tail, cockpit and a blurred spinning propeller.
export function drawPlane(ctx, W, H, plane, time) {
  const P = CONFIG.palette;
  const cx = W / 2, cy = H * 0.66;
  const S = W / 1280; // scale with canvas width
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.55);
  // Shake at overspeed / in a stall.
  if (plane.overspeed || plane.stalled) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  }
  // Wings.
  ctx.fillStyle = P.planeAccent;
  ctx.beginPath();
  ctx.moveTo(-150 * S, 8 * S); ctx.lineTo(150 * S, 8 * S);
  ctx.lineTo(128 * S, 26 * S); ctx.lineTo(-128 * S, 26 * S);
  ctx.closePath(); ctx.fill();
  // Tail.
  ctx.fillStyle = P.planeAccent;
  ctx.beginPath();
  ctx.moveTo(-34 * S, -58 * S); ctx.lineTo(34 * S, -58 * S);
  ctx.lineTo(22 * S, -38 * S); ctx.lineTo(-22 * S, -38 * S);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-6 * S, -66 * S, 12 * S, 34 * S);
  // Fuselage.
  const fg = ctx.createLinearGradient(0, -30 * S, 0, 30 * S);
  fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.6, P.planeBody); fg.addColorStop(1, '#c8d2d8');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34 * S, 74 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cockpit canopy.
  ctx.fillStyle = '#1b3a5c';
  ctx.beginPath(); ctx.ellipse(0, -34 * S, 16 * S, 24 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-5 * S, -42 * S, 6 * S, 9 * S, 0, 0, Math.PI * 2); ctx.fill();
  // Orange cheatline + "ELANG-7" on the fuselage.
  ctx.fillStyle = P.planeAccent;
  ctx.fillRect(-30 * S, 18 * S, 60 * S, 7 * S);
  ctx.fillStyle = '#22303a';
  ctx.font = `bold ${15 * S}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ELANG-7', 0, 48 * S);
  // Propeller blur: two translucent arcs spinning with throttle.
  const prop = 0.25 + plane.throttle * 0.75;
  ctx.fillStyle = `rgba(120,130,140,${0.25 + prop * 0.4})`;
  const spin = time * (6 + plane.throttle * 40);
  ctx.save();
  ctx.translate(0, -78 * S);
  ctx.rotate(spin % Math.PI);
  ctx.beginPath(); ctx.ellipse(0, 0, 52 * S, 5 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// Full world render for one frame.
export function renderWorld(ctx, W, H, plane, clouds, missionState, rival, time, storm) {
  const cam = makeCamera(plane);
  drawSky(ctx, W, H, plane, time);
  const horizonY = drawSea(ctx, W, H, plane);
  // Draw far-to-near: sort islands by distance from the camera.
  const sorted = [...ISLANDS].sort((a, b) => {
    const da = Math.hypot(a.x - cam.x, a.z - cam.z);
    const db = Math.hypot(b.x - cam.x, b.z - cam.z);
    return db - da;
  });
  for (const isl of sorted) {
    drawIsland(ctx, isl, cam, W, H);
    drawRunway(ctx, isl, cam, W, H);
  }
  // Rings (only the active one glows; the rest are dim guides).
  if (missionState && missionState.id === 'rings') {
    RINGS.forEach((ring, i) => {
      if (i >= missionState.ringsPassed) drawRing(ctx, ring, cam, W, H, i, i === missionState.ringsPassed);
    });
  }
  // Storm beacon.
  if (missionState && missionState.id === 'storm' && !missionState.beaconReached) {
    const b = project(cam, BEACON.x, BEACON.alt, BEACON.z, W, H);
    if (b) {
      ctx.fillStyle = '#ff5d5d';
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`▲ BEACON ${Math.round(b.dist)}m`, b.x, b.y - 12);
    }
  }
  // Clouds far-to-near.
  const sortedClouds = [...clouds].sort((a, b) => {
    const da = Math.hypot(a.x - cam.x, a.z - cam.z);
    const db = Math.hypot(b.x - cam.x, b.z - cam.z);
    return db - da;
  });
  for (const cl of sortedClouds) drawCloud(ctx, cl, cam, W, H, storm && cl.storm);
  if (rival) drawRival(ctx, rival, cam, W, H);
  drawPlane(ctx, W, H, plane, time);
  return { cam, horizonY };
}
