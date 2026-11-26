// missions.js — the campaign: 3 missions with different goals, a free-flight
// mode, and the rival Rajawali-9 (pilot Kirana) flying the same course.
import { CONFIG } from './config.js';
import { RINGS, ISLANDS, BEACON } from './world.js';

export const MISSIONS = [
  {
    id: 'rings', name: 'Ring Run', short: '8 Rings',
    brief: 'Fly all 8 rings in order against the clock. Beat Kirana’s 2:30 to take the gold.',
    goal: 'Pass ring 1 of 8',
  },
  {
    id: 'hop', name: 'Island Hop', short: '3 Landings',
    brief: 'Land on all three island runways: Pulau Api, Pulau Karang, Pulau Sawah. Soft touchdowns score.',
    goal: 'Land at Pulau Api',
  },
  {
    id: 'storm', name: 'Storm Rescue', short: 'Beacon Run',
    brief: 'Crosswind storm, 42% fuel. Reach the rescue beacon off Pulau Karang before the tank runs dry.',
    goal: 'Reach the beacon',
  },
  {
    id: 'free', name: 'Free Flight', short: 'Explore',
    brief: 'No clock, no rival. Explore the Nusa archipelago and practise landings.',
    goal: 'Enjoy the islands',
  },
];

export function makeMissionState(missionId) {
  return {
    id: missionId,
    startTime: 0,
    elapsed: 0,
    ringsPassed: 0,
    landings: [],          // island ids already landed on, in order
    score: 0,
    ringScore: 0,
    landingScore: 0,
    complete: false,
    failed: false,
    beaconReached: false,
    message: '',
    messageAt: 0,
  };
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

// The rival flies the ring course on a fixed schedule; her position is a
// pure function of mission time, so she is a visible ghost to chase.
export function rivalPositionAt(timeSec) {
  const path = [
    { x: 1395, z: -380, alt: 40 },
    ...RINGS,
    { x: 1395, z: -380, alt: 40 },
  ];
  // Kirana covers the course in her par time, at a steady pace.
  const total = CONFIG.rival.ringRunPar;
  const t = Math.min(1, Math.max(0, timeSec / total));
  const segLen = [];
  let totalLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z, b.alt - a.alt);
    segLen.push(len); totalLen += len;
  }
  let dist = t * totalLen;
  for (let i = 0; i < segLen.length; i++) {
    if (dist <= segLen[i] || i === segLen.length - 1) {
      const a = path[i], b = path[i + 1];
      const f = segLen[i] ? Math.min(1, dist / segLen[i]) : 0;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, alt: a.alt + (b.alt - a.alt) * f, heading };
    }
    dist -= segLen[i];
  }
  return { ...path[path.length - 1], heading: 0 };
}

function flash(state, text, now) {
  state.message = text; state.messageAt = now;
}

// Per-frame mission logic. Returns nothing; mutates state and plane-adjacent
// facts (score, messages). `events` carries what just happened for the HUD.
export function stepMission(state, plane, now, dt, events) {
  state.elapsed += dt;
  const mission = missionById(state.id);

  if (state.id === 'rings') {
    const ring = RINGS[state.ringsPassed];
    if (ring) {
      const dx = ring.x - plane.x, dz = ring.z - plane.z, dy = ring.alt - plane.alt;
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      // Passing through the ring plane within its radius counts.
      if (dist < ring.r + 26) {
        const centreErr = Math.abs(dy) + Math.hypot(dx, dz) * 0.15;
        const precise = centreErr < 22;
        state.ringsPassed += 1;
        const pts = CONFIG.scoring.ring + (precise ? CONFIG.scoring.ringPrecisionBonus : 0);
        state.ringScore += pts; state.score += pts;
        events.push({ type: 'ring', n: state.ringsPassed, precise });
        flash(state, precise ? `RING ${state.ringsPassed}/8 — CLEAN +${pts}` : `RING ${state.ringsPassed}/8 +${pts}`, now);
        if (state.ringsPassed >= RINGS.length) finishMission(state, now, events);
      }
    }
  }

  if (state.id === 'hop') {
    const order = ['api', 'karang', 'sawah'];
    const next = order[state.landings.length];
    if (next && plane.onGround && plane.speed < 8) {
      const isl = ISLANDS.find((i) => i.id === next);
      const rw = isl.runway;
      const d = Math.hypot(plane.x - rw.x, plane.z - rw.z);
      if (d < 450) {
        state.landings.push(next);
        const pts = plane.damage < 30 ? CONFIG.scoring.smoothLanding : CONFIG.scoring.roughLanding;
        state.landingScore += pts; state.score += pts;
        events.push({ type: 'landing', island: isl.name, pts });
        flash(state, `LANDED — ${isl.name.toUpperCase()} +${pts}`, now);
        if (state.landings.length >= order.length) finishMission(state, now, events);
      }
    }
  }

  if (state.id === 'storm') {
    const d = Math.hypot(BEACON.x - plane.x, BEACON.z - plane.z);
    if (d < 220 && !state.beaconReached) {
      state.beaconReached = true;
      finishMission(state, now, events);
    }
    if (plane.fuel <= 0 && !plane.onGround && !state.complete) {
      state.failed = true;
      events.push({ type: 'failed', reason: 'FUEL' });
    }
  }
}

function finishMission(state, now, events) {
  state.complete = true;
  const par = state.id === 'rings' ? CONFIG.rival.ringRunPar
    : state.id === 'hop' ? CONFIG.rival.islandHopPar : CONFIG.rival.stormPar;
  const beatRival = state.id !== 'free' && state.elapsed < par;
  state.score += CONFIG.scoring.missionBonus + (beatRival ? CONFIG.scoring.rivalBeatBonus : 0);
  state.beatRival = beatRival;
  state.par = par;
  events.push({ type: 'complete', beatRival });
  flash(state, beatRival ? 'MISSION COMPLETE — YOU BEAT KIRANA!' : 'MISSION COMPLETE', now);
}

// Medal from time vs par (rings/hop/storm only).
export function medalFor(state) {
  if (!state.complete) return null;
  const ratio = state.elapsed / (state.par || 1);
  if (ratio <= 0.9) return 'GOLD';
  if (ratio <= 1.05) return 'SILVER';
  return 'BRONZE';
}

// Current objective line for the HUD.
export function objectiveText(state) {
  if (state.complete) return 'Mission complete — press Enter for debrief';
  if (state.id === 'rings') return `Pass ring ${Math.min(8, state.ringsPassed + 1)} of 8 — ${state.ringsPassed}/8 done`;
  if (state.id === 'hop') {
    const order = ['Pulau Api', 'Pulau Karang', 'Pulau Sawah'];
    return `Land at ${order[state.landings.length] ?? '—'} — ${state.landings.length}/3 done`;
  }
  if (state.id === 'storm') return 'Reach the rescue beacon — watch your fuel';
  return 'Free flight — explore the Nusa archipelago';
}
