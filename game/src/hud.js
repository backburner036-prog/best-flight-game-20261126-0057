// hud.js — the instruments: artificial horizon, altimeter, airspeed,
// compass strip, fuel and throttle gauges, VSI, minimap, objective,
// timer and score. Everything is drawn live from the plane state.
import { CONFIG } from './config.js';
import { ISLANDS, RINGS, BEACON } from './world.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,18,30,0.62)';
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill(); ctx.stroke();
}

function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

// Big readouts: ALT / SPD / HDG, always ≥18px at 1280x720.
export function drawBigReadouts(ctx, W, plane, missionState) {
  const P = CONFIG.palette;
  panel(ctx, 16, 14, 352, 92);
  ctx.textAlign = 'left';
  const cols = [
    { label: 'ALT', value: `${fmt(plane.alt)} m`, warn: false },
    { label: 'SPD', value: `${fmt(plane.speed * 3.6)} km/h`, warn: plane.overspeed },
    { label: 'HDG', value: `${String(Math.round(((plane.heading * 180) / Math.PI) % 360 + 360) % 360).padStart(3, '0')}°`, warn: false },
  ];
  cols.forEach((c, i) => {
    const x = 30 + i * 114;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(c.label, x, 38);
    ctx.fillStyle = c.warn ? P.hudRed : P.hudText;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(c.value, x, 70);
  });
  // Warnings under the readouts.
  let warnY = 118;
  ctx.font = 'bold 17px sans-serif';
  if (plane.stalled) { ctx.fillStyle = P.hudRed; ctx.fillText('⚠ STALL — NOSE DOWN, ADD POWER', 16, warnY); warnY += 24; }
  if (plane.overspeed) { ctx.fillStyle = P.hudRed; ctx.fillText('⚠ OVERSPEED — THROTTLE BACK', 16, warnY); warnY += 24; }
  if (plane.fuel < CONFIG.fuel.reserveWarn) { ctx.fillStyle = P.hudAmber; ctx.fillText('⚠ LOW FUEL', 16, warnY); warnY += 24; }
  if (!plane.airborne && plane.speed < 5) { ctx.fillStyle = P.hudGreen; ctx.fillText('ON GROUND — W FOR THROTTLE', 16, warnY); }
}

// Compass strip across the top centre.
export function drawCompass(ctx, W, plane) {
  const cx = W / 2;
  const headingDeg = (((plane.heading * 180) / Math.PI) % 360 + 360) % 360;
  panel(ctx, cx - 190, 14, 380, 44);
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - 190, 14, 380, 44); ctx.clip();
  ctx.textAlign = 'center';
  // Tick marks every 15 degrees.
  for (let d = -180; d <= 180; d += 15) {
    const x = cx + d * 2.1;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x, 22, 1, d % 45 === 0 ? 12 : 6);
  }
  // Cardinal labels at their true bearings, not at tick positions.
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (const [degStr, name] of Object.entries(labels)) {
    const deg = Number(degStr);
    const delta = ((deg - headingDeg + 540) % 360) - 180;
    if (Math.abs(delta) > 168) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(name, cx + delta * 2.1, 52);
  }
  ctx.restore();
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 14); ctx.lineTo(cx + 7, 14); ctx.lineTo(cx, 26); ctx.closePath(); ctx.fill();
}

// Artificial horizon + VSI, bottom-left.
export function drawAttitude(ctx, W, H, plane) {
  const cx = 92, cy = H - 92, r = 62;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = plane.pitch * 90;
  ctx.fillStyle = '#2f6fd0';
  ctx.fillRect(-r - 4, -r - 4 - pitchPx, r * 2 + 8, r + 4 + pitchPx);
  ctx.fillStyle = '#8a6a3b';
  ctx.fillRect(-r - 4, pitchPx, r * 2 + 8, r + 4 - pitchPx);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r, -pitchPx - 1, r * 2, 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // Fixed aircraft symbol.
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.fillRect(cx - 26, cy - 2, 18, 4);
  ctx.fillRect(cx + 8, cy - 2, 18, 4);
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 18);
  // VSI (vertical speed) bar beside it.
  const vs = Math.max(-15, Math.min(15, plane.vspeed));
  panel(ctx, 168, H - 154, 26, 124);
  ctx.fillStyle = vs >= 0 ? CONFIG.palette.hudGreen : CONFIG.palette.hudRed;
  const vh = (vs / 15) * 52;
  ctx.fillRect(172, H - 92 - Math.max(0, vh), 18, Math.abs(vh) || 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('VSI', 181, H - 162);
}

// Fuel + throttle gauges, bottom-right.
export function drawFuelThrottle(ctx, W, H, plane) {
  const P = CONFIG.palette;
  const x = W - 216, y = H - 170;
  panel(ctx, x, y, 200, 140);
  ctx.textAlign = 'left';
  // Fuel bar.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('FUEL', x + 14, y + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 14, y + 30, 172, 16);
  ctx.fillStyle = plane.fuel < CONFIG.fuel.reserveWarn ? P.hudRed : P.hudGreen;
  ctx.fillRect(x + 14, y + 30, 172 * (plane.fuel / 100), 16);
  ctx.fillStyle = P.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${Math.round(plane.fuel)}%`, x + 14, y + 66);
  // Throttle bar.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('THROTTLE', x + 14, y + 88);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 14, y + 96, 172, 16);
  ctx.fillStyle = P.hudAmber;
  ctx.fillRect(x + 14, y + 96, 172 * plane.throttle, 16);
  // Damage readout.
  ctx.fillStyle = plane.damage > 60 ? P.hudRed : 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`DMG ${Math.round(plane.damage)}%   GEAR ${plane.gearDown ? 'DOWN' : 'UP'}`, x + 14, y + 132);
}

// Minimap, top-right: islands, runways, rings, beacon, plane and rival.
export function drawMinimap(ctx, W, plane, missionState, rival) {
  const size = 168, x0 = W - size - 16, y0 = 74;
  panel(ctx, x0, y0, size, size);
  const scale = size / 15000;
  const toMap = (x, z) => [x0 + size / 2 + x * scale, y0 + size / 2 + z * scale];
  ctx.fillStyle = '#1d6fb8';
  ctx.fillRect(x0 + 4, y0 + 4, size - 8, size - 8);
  for (const isl of ISLANDS) {
    const [mx, mz] = toMap(isl.x, isl.z);
    ctx.fillStyle = '#4f9e4d';
    ctx.beginPath(); ctx.arc(mx, mz, Math.max(3, isl.radius * scale), 0, Math.PI * 2); ctx.fill();
    if (isl.runway) {
      const [rx, rz] = toMap(isl.runway.x, isl.runway.z);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx - Math.sin(isl.runway.heading) * 8, rz - Math.cos(isl.runway.heading) * 8);
      ctx.lineTo(rx + Math.sin(isl.runway.heading) * 8, rz + Math.cos(isl.runway.heading) * 8);
      ctx.stroke();
    }
  }
  if (missionState && missionState.id === 'rings') {
    ctx.fillStyle = '#ffb020';
    RINGS.forEach((ring, i) => {
      if (i < missionState.ringsPassed) return;
      const [mx, mz] = toMap(ring.x, ring.z);
      ctx.beginPath(); ctx.arc(mx, mz, i === missionState.ringsPassed ? 5 : 3, 0, Math.PI * 2); ctx.fill();
    });
  }
  if (missionState && missionState.id === 'storm') {
    const [mx, mz] = toMap(BEACON.x, BEACON.z);
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (rival) {
    const [mx, mz] = toMap(rival.x, rival.z);
    ctx.fillStyle = '#d43d2a';
    ctx.beginPath(); ctx.arc(mx, mz, 4, 0, Math.PI * 2); ctx.fill();
  }
  const [px, pz] = toMap(plane.x, plane.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(Math.PI - plane.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('NUSA ARCHIPELAGO', x0 + size / 2, y0 + size + 16);
}

// Objective banner, timer and score, top centre under the compass.
export function drawMissionHud(ctx, W, missionState) {
  const mm = Math.floor(missionState.elapsed / 60);
  const ss = Math.floor(missionState.elapsed % 60).toString().padStart(2, '0');
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(missionState.objective, W / 2, 84);
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = CONFIG.palette.hudAmber;
  ctx.fillText(`TIME ${mm}:${ss}    SCORE ${missionState.score}`, W / 2, 108);
  // Flash message (ring passed, landing, ...).
  if (missionState.message && performance.now() / 1000 - missionState.messageAt < 2.6) {
    ctx.fillStyle = '#ffe08a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(missionState.message, W / 2, 150);
  }
}

export function drawAllHud(ctx, W, H, plane, missionState, rival) {
  drawBigReadouts(ctx, W, plane, missionState);
  drawCompass(ctx, W, plane);
  drawMinimap(ctx, W, plane, missionState, rival);
  drawAttitude(ctx, W, H, plane);
  drawFuelThrottle(ctx, W, H, plane);
  drawMissionHud(ctx, W, missionState);
}
