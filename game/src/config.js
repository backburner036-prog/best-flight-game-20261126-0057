// config.js — all tuning numbers for Elang-7 Island Run in one place.
// Nothing here loads over the network; every value is a plain literal.
export const CONFIG = {
  canvas: { width: 1280, height: 720 },
  // Flight model (arcade, but lift really does fall off with speed).
  flight: {
    maxSpeed: 96,        // m/s, overspeed above this
    cruiseSpeed: 62,
    stallSpeed: 30,      // below this, lift collapses when the nose is up
    maxThrottle: 1,
    accel: 24,           // m/s^2 at full throttle
    drag: 0.0026,        // quadratic drag coefficient
    pitchRate: 0.85,     // rad/s at full elevator authority
    rollRate: 1.9,       // rad/s
    maxBank: 1.05,       // rad (~60 deg)
    maxPitchUp: 0.52,    // rad (~30 deg)
    maxPitchDown: -0.44,
    gravity: 9.81,
    liftFactor: 1.0,
  },
  fuel: {
    start: 100,
    stormStart: 42,      // Storm Rescue starts nearly dry on purpose
    burnIdle: 0.10,      // %/s at throttle 0
    burnFull: 0.55,      // %/s at throttle 1 (about 3 min of full power)
    reserveWarn: 25,
  },
  damage: {
    overspeedPerSec: 6,  // %/s while over maxSpeed
    hardLanding: 18,     // % for a hard touchdown
    roughLanding: 8,
    crashVspeed: -9,     // m/s vertical speed that always crashes
  },
  // Rival Rajawali-9 (pilot Kirana) target times, seconds.
  rival: { ringRunPar: 150, islandHopPar: 240, stormPar: 170 },
  scoring: {
    ring: 100,
    ringPrecisionBonus: 50,   // clean pass near the ring centre
    smoothLanding: 200,
    roughLanding: 80,
    missionBonus: 300,
    rivalBeatBonus: 250,
  },
  // Palette: one style for sky, sea and islands (blue sea, green island, sand).
  palette: {
    skyTop: '#2f6fd0',
    skyMid: '#7db4e8',
    skyHorizon: '#cfe8f7',
    sun: '#fff3b0',
    seaFar: '#1d6fb8',
    seaNear: '#2f9fd8',
    sand: '#e8d29a',
    grass: '#4f9e4d',
    jungle: '#2f7a33',
    volcanoRock: '#5d5348',
    volcanoLava: '#ff6a2a',
    runway: '#3a3f46',
    runwayMark: '#f5f5f0',
    ring: '#ffb020',
    ringGlow: '#ffe08a',
    rival: '#d43d2a',
    planeBody: '#f2f5f7',
    planeAccent: '#e8590c',
    hudText: '#ffffff',
    hudAmber: '#ffb020',
    hudRed: '#ff4d4d',
    hudGreen: '#58d68d',
  },
};

// Seeded RNG (mulberry32) so photo mode renders the same frame every time.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
