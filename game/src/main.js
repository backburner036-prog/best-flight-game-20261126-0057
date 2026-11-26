// main.js — the game loop and state machine: menu, briefing, flying,
// debrief and crash. Also the deterministic photo mode (?shot=...) that
// stages the aircraft, camera and mission for each screenshot.
import { CONFIG, makeRng } from './config.js';
import { makePlane, stepFlight, resetPlane } from './flight.js';
import { makeClouds, RINGS } from './world.js';
import { renderWorld, drawPlane } from './render.js';
import { drawAllHud } from './hud.js';
import {
  MISSIONS, makeMissionState, missionById, rivalPositionAt,
  stepMission, medalFor, objectiveText,
} from './missions.js';
import { makeInput, attachInput, pollInput, wasPressed, clearPressed, clickedIn } from './input.js';
import { makeAudio, startAudio, updateAudio, playRingBeep, playTouchdown, playCrash } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') ?? 7);

const W = CONFIG.canvas.width, H = CONFIG.canvas.height;

const clouds = makeClouds(SEED);
const plane = makePlane();
const input = makeInput();
const audio = makeAudio();
attachInput(input, canvas, () => startAudio(audio));

let screen = 'menu';            // menu | briefing | flying | debrief | crash
let missionState = makeMissionState('rings');
let selectedMission = 0;
let time = 0;
let lastTs = 0;
let crashReason = null;
let debriefStats = null;
let menuButtons = [];
let camSmooth = { x: 0, z: 0, alt: 0, heading: 0 }; // lerped camera target

function windFor(missionId, t) {
  // Storm Rescue: strong crosswind. Others: light gusts.
  const base = missionId === 'storm' ? 14 : 4;
  return { x: Math.sin(t * 0.21) * base, z: Math.cos(t * 0.17) * base * 0.7 };
}

function startMission(id) {
  missionState = makeMissionState(id);
  missionState.objective = objectiveText(missionState);
  resetPlane(plane, id === 'storm' ? CONFIG.fuel.stormStart : CONFIG.fuel.start);
  if (id === 'hop') plane.fuel = 100;
  crashReason = null;
  debriefStats = null;
  screen = 'flying';
  statusEl.textContent = `${missionById(id).name} started.`;
}

function endFlightToDebrief() {
  debriefStats = {
    score: missionState.score,
    time: missionState.elapsed,
    fuel: Math.round(plane.fuel),
    damage: Math.round(plane.damage),
    rings: missionState.ringsPassed,
    landings: missionState.landings.length,
    medal: medalFor(missionState),
    beatRival: missionState.beatRival ?? false,
    complete: missionState.complete,
  };
  screen = 'debrief';
}

function crashFlight(reason) {
  crashReason = reason;
  playCrash(audio);
  screen = 'crash';
  statusEl.textContent = `Crashed: ${reason}. Press R to retry.`;
}

// ---- Photo mode: stage a deterministic frame for each screenshot. ----
function stageShot() {
  if (!SHOT) return;
  if (SHOT === 'cover') {
    startMission('rings');
    // Mid-flight, ring 1 dead ahead, home runway visible below.
    plane.x = 500; plane.z = -60; plane.alt = 250;
    plane.heading = Math.atan2(RINGS[0].x - 500, RINGS[0].z - (-60));
    plane.speed = 62; plane.throttle = 0.78; plane.pitch = 0.06;
    plane.fuel = 82; plane.airborne = true; plane.onGround = false;
    missionState.elapsed = 47; missionState.score = 0;
    time = 12;
  } else if (SHOT === 'landing') {
    startMission('hop');
    // Final approach to Pulau Api runway (centre 1395,0, heading north),
    // gear down, flaps out.
    plane.x = 1395; plane.z = -900;
    plane.alt = 62; plane.heading = 0;
    plane.speed = 42; plane.throttle = 0.42; plane.pitch = -0.05;
    plane.fuel = 64; plane.gearDown = true; plane.flaps = true;
    plane.airborne = true; plane.onGround = false;
    missionState.elapsed = 132; missionState.score = 200;
    missionState.landings = ['api'];
    time = 20;
  } else if (SHOT === 'rival') {
    startMission('rings');
    // Rival ahead and to the right, ring 2 ahead, storm clouds around.
    plane.x = 1500; plane.z = -1100; plane.alt = 320;
    plane.heading = Math.atan2(RINGS[1].x - 1500, RINGS[1].z - (-1100));
    plane.speed = 68; plane.throttle = 0.9; plane.pitch = 0.04;
    plane.fuel = 71; plane.airborne = true; plane.onGround = false;
    missionState.ringsPassed = 1; missionState.elapsed = 61; missionState.score = 150;
    time = 33;
  } else if (SHOT === 'debrief') {
    startMission('rings');
    missionState.complete = true;
    missionState.ringsPassed = 8;
    missionState.elapsed = 138; missionState.score = 1350; missionState.beatRival = true;
    missionState.par = CONFIG.rival.ringRunPar;
    plane.fuel = 38; plane.damage = 4;
    endFlightToDebrief();
  }
  if (SHOT !== 'debrief') {
    // Settle the camera once so the frame is stable.
    camSmooth.x = plane.x; camSmooth.z = plane.z; camSmooth.alt = plane.alt;
  }
  missionState.objective = objectiveText(missionState);
}

// ---- Menu / briefing / debrief / crash screens (all canvas-drawn). ----
function drawMenu() {
  ctx.fillStyle = '#0e1a2e';
  ctx.fillRect(0, 0, W, H);
  // Backdrop: a calm fly-over of the home island, drawn by the renderer.
  const demo = makePlane();
  demo.x = -800; demo.z = 1800; demo.alt = 420; demo.heading = 0.5; demo.speed = 55; demo.throttle = 0.6;
  renderWorld(ctx, W, H, demo, clouds, null, null, time, false);
  ctx.fillStyle = 'rgba(8,16,30,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('ELANG-7: ISLAND RUN', W / 2, 118);
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('3 Missions  ·  8 Rings  ·  1 Rival', W / 2, 158);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '20px sans-serif';
  ctx.fillText('Fly the Nusa archipelago. Beat pilot Kirana in her Rajawali-9.', W / 2, 192);

  menuButtons = [];
  MISSIONS.forEach((m, i) => {
    const y = 236 + i * 78;
    const selected = i === selectedMission;
    ctx.fillStyle = selected ? 'rgba(255,176,32,0.92)' : 'rgba(255,255,255,0.14)';
    ctx.strokeStyle = selected ? '#ffb020' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(W / 2 - 320, y, 640, 62, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = selected ? '#1a1206' : '#fff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${i + 1}. ${m.name} — ${m.short}`, W / 2 - 296, y + 38);
    ctx.textAlign = 'right';
    ctx.font = '18px sans-serif';
    ctx.fillText('ENTER ▸', W / 2 + 296, y + 37);
    menuButtons.push({ x: W / 2 - 320, y, w: 640, h: 62, i });
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '18px sans-serif';
  ctx.fillText('W/S throttle · ↑/↓ pitch · ←/→ roll · SPACE brake · F flaps · R reset · mouse: click menu, drag to steer', W / 2, 580);
  ctx.fillText('Click a mission or press 1–4, then ENTER. Land soft on runways to repair and refuel.', W / 2, 612);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Elang-7 · Kepulauan Nusa · an original game — no borrowed names, art or music', W / 2, 668);
}

function drawBriefing() {
  const m = MISSIONS[selectedMission];
  ctx.fillStyle = '#0e1a2e';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(m.name.toUpperCase(), W / 2, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  wrapText(m.brief, W / 2, 230, 760, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '20px sans-serif';
  ctx.fillText('Controls: W/S throttle · arrows pitch & roll · SPACE brake · F flaps · R reset', W / 2, 360);
  ctx.fillText('Rival target: ' + (m.id === 'rings' ? '2:30' : m.id === 'hop' ? '4:00' : m.id === 'storm' ? '2:50' : 'none — free flight'), W / 2, 398);
  ctx.fillStyle = '#58d68d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press ENTER to take off — click anywhere works too', W / 2, 480);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '17px sans-serif';
  ctx.fillText('ESC back to menu', W / 2, 520);
}

function wrapText(text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy); line = w; yy += lineH;
    } else line = test;
  }
  ctx.fillText(line, cx, yy);
}

function drawDebrief() {
  ctx.fillStyle = 'rgba(8,16,30,0.88)';
  ctx.fillRect(0, 0, W, H);
  const s = debriefStats;
  ctx.textAlign = 'center';
  ctx.fillStyle = s.complete ? '#58d68d' : '#ffb020';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(s.complete ? 'MISSION COMPLETE' : 'SORTIE OVER', W / 2, 130);
  if (s.medal) {
    ctx.fillStyle = s.medal === 'GOLD' ? '#ffd700' : s.medal === 'SILVER' ? '#dfe6ee' : '#cd7f32';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(`★ ${s.medal} MEDAL ★`, W / 2, 190);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '24px sans-serif';
  const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60).toString().padStart(2, '0');
  const rows = [
    `Score: ${s.score}`,
    `Time: ${mm}:${ss}   (Kirana's par ${Math.floor((missionState.par ?? 0) / 60)}:${String(Math.floor((missionState.par ?? 0) % 60)).padStart(2, '0')})`,
    `Rings: ${s.rings}/8    Landings: ${s.landings}/3`,
    `Fuel left: ${s.fuel}%    Damage: ${s.damage}%`,
    s.beatRival ? 'You beat Kirana — Rajawali-9 is behind you!' : 'Kirana finished ahead this time — fly it again.',
  ];
  rows.forEach((r, i) => ctx.fillText(r, W / 2, 250 + i * 44));
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ENTER — fly again    ·    ESC — menu', W / 2, 540);
}

function drawCrash() {
  ctx.fillStyle = 'rgba(20,4,4,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 60px sans-serif';
  ctx.fillText('CRASHED', W / 2, 220);
  const why = {
    STALL: 'You stalled — too slow with the nose up. Keep speed above 30 m/s.',
    TERRAIN: 'You hit the terrain. Watch the altimeter and the islands ahead.',
    OVERSPEED: 'Overspeed tore the airframe apart. Throttle back past 96 m/s.',
    FUEL: 'Out of fuel. Land on a runway to refuel before the tank runs dry.',
  }[crashReason] ?? 'The sortie ended in the sea.';
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  wrapText(why, W / 2, 290, 820, 32);
  ctx.fillStyle = '#ffb020';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('R — retry the mission    ·    ESC — menu', W / 2, 420);
}

// ---- Frame loop ----
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  time += dt;
  canvas.width = W; canvas.height = H; // fixed internal resolution
  pollInput(input);

  if (screen === 'menu') {
    if (wasPressed(input, 'ArrowDown')) selectedMission = (selectedMission + 1) % MISSIONS.length;
    if (wasPressed(input, 'ArrowUp')) selectedMission = (selectedMission - 1 + MISSIONS.length) % MISSIONS.length;
    for (let i = 0; i < 4; i++) if (wasPressed(input, `Digit${i + 1}`)) selectedMission = i;
    menuButtons.forEach((b) => { if (clickedIn(input, b.x, b.y, b.w, b.h)) selectedMission = b.i; });
    if (wasPressed(input, 'Enter') || input.mouse.clicked) screen = 'briefing';
    drawMenu();
  } else if (screen === 'briefing') {
    if (wasPressed(input, 'Enter') || input.mouse.clicked) startMission(MISSIONS[selectedMission].id);
    if (wasPressed(input, 'Escape')) screen = 'menu';
    drawBriefing();
  } else if (screen === 'flying') {
    const events = [];
    const wind = windFor(missionState.id, time);
    const res = stepFlight(plane, input, dt, wind, time);
    stepMission(missionState, plane, time, dt, events);
    missionState.objective = objectiveText(missionState);
    for (const ev of events) {
      if (ev.type === 'ring') playRingBeep(audio, ev.precise);
      if (ev.type === 'landing') playTouchdown(audio);
    }
    if (res.touchedDown && !events.some((e) => e.type === 'landing')) playTouchdown(audio);
    updateAudio(audio, plane);
    if (plane.crashed) { crashFlight(plane.crashed); return; }
    if (missionState.complete) { endFlightToDebrief(); return; }
    if (missionState.failed) { crashFlight('FUEL'); return; }
    if (wasPressed(input, 'KeyR')) startMission(missionState.id);
    if (wasPressed(input, 'Escape')) screen = 'menu';
    const rival = (missionState.id === 'rings' || missionState.id === 'hop')
      ? rivalPositionAt(missionState.elapsed) : null;
    renderWorld(ctx, W, H, plane, clouds, missionState, rival, time, missionState.id === 'storm');
    drawAllHud(ctx, W, H, plane, missionState, rival);
  } else if (screen === 'debrief') {
    if (wasPressed(input, 'Enter') || wasPressed(input, 'KeyR')) startMission(missionState.id);
    if (wasPressed(input, 'Escape')) screen = 'menu';
    // Keep the world behind the debrief panel.
    renderWorld(ctx, W, H, plane, clouds, missionState, null, time, false);
    drawDebrief();
  } else if (screen === 'crash') {
    if (wasPressed(input, 'KeyR')) startMission(missionState.id);
    if (wasPressed(input, 'Escape')) screen = 'menu';
    renderWorld(ctx, W, H, plane, clouds, missionState, null, time, false);
    drawCrash();
  }
  clearPressed(input);
}

// Photo mode renders one staged frame and stops the clock.
stageShot();
if (SHOT) {
  canvas.width = W; canvas.height = H;
  if (SHOT === 'debrief') {
    renderWorld(ctx, W, H, plane, clouds, missionState, null, time, false);
    drawDebrief();
  } else {
    // Photo-mode rival: parked 380 m ahead and 130 m to the side so she is
    // clearly visible in frame, with the next ring beyond her.
    const rival = SHOT === 'rival'
      ? { x: plane.x + Math.sin(plane.heading) * 380 + Math.cos(plane.heading) * 130, z: plane.z + Math.cos(plane.heading) * 380 - Math.sin(plane.heading) * 130, alt: plane.alt + 22, heading: plane.heading }
      : SHOT === 'cover' ? rivalPositionAt(47) : null;
    renderWorld(ctx, W, H, plane, clouds, missionState, rival, time, SHOT === 'rival');
    drawAllHud(ctx, W, H, plane, missionState, rival);
  }
  document.title = 'ELANG-7 shot ' + SHOT;
  window.__shotReady = true;
} else {
  // Debug/test handle (read-only state for the autopilot test; no network).
  window.__elang = {
    get plane() { return plane; },
    get mission() { return missionState; },
    get screen() { return screen; },
  };
  requestAnimationFrame(frame);
}
