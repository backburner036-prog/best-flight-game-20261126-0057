// world.js — the fictional Nusa archipelago: sea, volcanic island, beaches,
// runways and the ring course. All geometry is procedural; no assets.
import { CONFIG, makeRng } from './config.js';

// Islands: x/z in metres, height in metres. Pulau Api is volcanic.
export const ISLANDS = [
  {
    id: 'api', name: 'Pulau Api', x: 0, z: 0, radius: 1500, height: 430,
    volcano: true, runway: { x: 1395, z: 0, heading: 0, length: 760, width: 46 },
  },
  {
    id: 'karang', name: 'Pulau Karang', x: -3400, z: -2700, radius: 1050, height: 130,
    volcano: false, runway: { x: -2423, z: -2700, heading: 0, length: 640, width: 42 },
  },
  {
    id: 'sawah', name: 'Pulau Sawah', x: 2900, z: 3100, radius: 1250, height: 95,
    volcano: false, runway: { x: 1737, z: 3100, heading: 0, length: 680, width: 42 },
  },
  { id: 'batu', name: 'Pulau Batu', x: 3600, z: -2200, radius: 520, height: 60, volcano: false, runway: null },
  { id: 'ombak', name: 'Pulau Ombak', x: -2600, z: 3300, radius: 460, height: 48, volcano: false, runway: null },
];

// The 8-ring course: a loop out of Pulau Api, around the isles, back home.
export const RINGS = [
  { x: 900, z: -500, alt: 260, r: 42 },
  { x: 2100, z: -1600, alt: 330, r: 42 },
  { x: 3600, z: -2200, alt: 300, r: 40 },
  { x: 2600, z: 900, alt: 380, r: 42 },
  { x: 2900, z: 3100, alt: 300, r: 40 },
  { x: -600, z: 3600, alt: 360, r: 42 },
  { x: -2600, z: 3300, alt: 280, r: 40 },
  { x: -1200, z: 900, alt: 240, r: 42 },
];

// Storm Rescue beacon: the north tip of Pulau Karang.
export const BEACON = { x: -3400, z: -3600, alt: 160 };

// Ground height in metres at a point (0 = sea level), from the island
// profiles alone (before the runway aprons flatten it).
function islandHeightAt(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz) / isl.radius;
    if (d >= 1) continue;
    // Smooth cone: steep near the centre, beach-flat at the rim.
    const prof = Math.pow(1 - d, 1.6);
    let ih = isl.height * prof;
    if (isl.volcano) ih += 120 * Math.pow(Math.max(0, 1 - d * 3.2), 2);
    if (ih > h) h = ih;
  }
  return h;
}

// Each runway sits on a flat apron: real airfields are level, so the ground
// near a strip blends to the strip's own elevation instead of the hillside.
const RUNWAY_APRONS = ISLANDS.filter((i) => i.runway).map((isl) => ({
  runway: isl.runway,
  flat: Math.max(3, islandHeightAt(isl.runway.x, isl.runway.z)),
}));

export function groundHeightAt(x, z) {
  let h = islandHeightAt(x, z);
  for (const { runway: rw, flat } of RUNWAY_APRONS) {
    const dx = Math.sin(rw.heading), dz = Math.cos(rw.heading);
    const rx = x - rw.x, rz = z - rw.z;
    const along = rx * dx + rz * dz;
    const across = rx * Math.cos(rw.heading) - rz * Math.sin(rw.heading);
    const aHalf = rw.length / 2 + 220, cHalf = rw.width / 2 + 160;
    if (Math.abs(along) >= aHalf || Math.abs(across) >= cHalf) continue;
    const fa = 1 - Math.max(0, (Math.abs(along) - rw.length / 2) / 220);
    const fc = 1 - Math.max(0, (Math.abs(across) - rw.width / 2) / 160);
    const f = Math.min(fa, fc); // 1 on the strip, fading to 0 at the margin
    h = h * (1 - f) + flat * f;
  }
  return h;
}

// Clouds: fixed, seeded positions so every render is stable.
export function makeClouds(seed) {
  const rng = makeRng(seed);
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: (rng() * 2 - 1) * 6500,
      z: (rng() * 2 - 1) * 6500,
      alt: 420 + rng() * 420,
      size: 120 + rng() * 260,
      puffs: 3 + Math.floor(rng() * 3),
      storm: rng() < 0.3,
    });
  }
  return clouds;
}

// A runway as 4 corners (plus centreline ends) in world space.
export function runwayCorners(runway) {
  const dx = Math.sin(runway.heading), dz = Math.cos(runway.heading);
  const px = Math.cos(runway.heading), pz = -Math.sin(runway.heading);
  const hl = runway.length / 2, hw = runway.width / 2;
  const corner = (a, b) => ({
    x: runway.x + dx * a + px * b,
    z: runway.z + dz * a + pz * b,
    alt: Math.max(4, groundHeightAt(runway.x + dx * a + px * b, runway.z + dz * a + pz * b) + 1),
  });
  return [corner(-hl, -hw), corner(hl, -hw), corner(hl, hw), corner(-hl, hw)];
}

// Is the point over a runway strip (within half width, along its length)?
export function runwayUnder(x, z) {
  for (const isl of ISLANDS) {
    const rw = isl.runway;
    if (!rw) continue;
    const dx = Math.sin(rw.heading), dz = Math.cos(rw.heading);
    const rx = x - rw.x, rz = z - rw.z;
    const along = rx * dx + rz * dz;
    const across = rx * Math.cos(rw.heading) - rz * Math.sin(rw.heading);
    if (Math.abs(along) <= rw.length / 2 && Math.abs(across) <= rw.width / 2) {
      return { island: isl, runway: rw, along, across };
    }
  }
  return null;
}

// Distance from a point to the centre of the next ring (for the HUD marker).
export function distanceToRing(plane, ring) {
  const dx = ring.x - plane.x, dz = ring.z - plane.z, dy = ring.alt - plane.alt;
  return Math.sqrt(dx * dx + dz * dz + dy * dy);
}
