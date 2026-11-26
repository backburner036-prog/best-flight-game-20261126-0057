// flight.js — the flight model: throttle, pitch, roll, lift vs stall,
// overspeed, wind gusts, fuel burn and damage. Arcade feel, real trade-offs.
import { CONFIG } from './config.js';
import { groundHeightAt, runwayUnder } from './world.js';

export function makePlane() {
  return {
    x: 1395, z: -380, alt: 6,        // parked on Pulau Api runway
    heading: 0,                       // facing down the runway (north)
    pitch: 0, roll: 0,
    speed: 0, vspeed: 0,
    throttle: 0,
    fuel: CONFIG.fuel.start,
    damage: 0,
    gearDown: true,
    flaps: false,
    airborne: false,
    stalled: false,
    overspeed: false,
    crashed: null,                    // crash reason once it happens
    onGround: true,
  };
}

// One physics step. input: {throttleUp, throttleDown, pitchUp, pitchDown,
// rollLeft, rollRight, brake, flaps}. dt in seconds. wind: {x, z} m/s gust.
export function stepFlight(plane, input, dt, wind, time) {
  const F = CONFIG.flight;
  const prevAlt = plane.alt;

  // Throttle: W/S keys, clamped 0..1.
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.8);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.8);

  // Control authority grows with airspeed — sluggish on the ground, alive in the air.
  const authority = Math.min(1, plane.speed / 45 + 0.25);
  const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);

  // Pitch target follows the stick; the nose drops on its own in a stall
  // (applied below, once the stall state is known).
  const pitchStick = pitchIn * (pitchIn > 0 ? F.maxPitchUp : -F.maxPitchDown) * authority;
  plane.roll += rollIn * F.rollRate * authority * dt;
  plane.roll = Math.max(-F.maxBank, Math.min(F.maxBank, plane.roll));
  if (!rollIn) plane.roll *= Math.max(0, 1 - dt * 1.4); // wings level themselves

  // Turn: banked flight turns the heading; the turn rate is g*tan(bank)/speed.
  const turnRate = (F.gravity * Math.tan(plane.roll)) / Math.max(18, plane.speed);
  plane.heading += turnRate * dt;

  // Lift vs stall: below stall speed with the nose up, lift collapses; very
  // slow flight stalls whatever the pitch, and the nose drops on its own.
  const liftEff = plane.speed < F.stallSpeed
    ? 0.25 + 0.55 * (plane.speed / F.stallSpeed)
    : 1;
  plane.stalled = plane.speed < F.stallSpeed && plane.alt > 8
    && (plane.pitch > 0.12 || plane.speed < F.stallSpeed * 0.6);
  const pitchTarget = pitchStick + (plane.stalled ? -0.18 : 0);
  plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, dt * 3.2);

  // Speed: thrust minus drag minus the climb penalty, plus a gust push.
  const drag = F.drag * plane.speed * plane.speed;
  const climbPenalty = F.gravity * Math.sin(plane.pitch) * liftEff;
  const accel = plane.throttle * F.accel - drag - climbPenalty;
  plane.speed = Math.max(0, plane.speed + accel * dt);

  // Overspeed: past maxSpeed the airframe takes damage and shakes.
  plane.overspeed = plane.speed > F.maxSpeed;
  if (plane.overspeed) plane.damage += CONFIG.damage.overspeedPerSec * dt;

  // Vertical speed from pitch and lift; a stall sheds altitude fast.
  let climb = plane.speed * Math.sin(plane.pitch) * liftEff;
  if (plane.stalled) climb -= 14;
  if (plane.flaps && plane.speed < 55) climb += 2.5; // flaps add lift, slowly
  plane.vspeed = climb;
  plane.alt += climb * dt;

  // Wind gusts push the aircraft sideways and bob it.
  const gust = Math.sin(time * 0.9) * 0.6 + Math.sin(time * 2.3) * 0.4;
  plane.x += (Math.sin(plane.heading) * plane.speed + wind.x * gust) * dt;
  plane.z += (Math.cos(plane.heading) * plane.speed + wind.z * gust) * dt;
  plane.alt += wind.z * 0.12 * gust * dt;

  // Fuel burns with throttle; empty tank means the engine quits.
  const burn = CONFIG.fuel.burnIdle + plane.throttle * (CONFIG.fuel.burnFull - CONFIG.fuel.burnIdle);
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0) plane.throttle = 0;

  // Ground contact.
  const ground = groundHeightAt(plane.x, plane.z);
  const strip = runwayUnder(plane.x, plane.z);
  const groundLevel = strip ? Math.max(4, ground + 1) : ground;
  if (plane.alt <= groundLevel) {
    plane.alt = groundLevel;
    plane.onGround = true;
    plane.airborne = false;
    if (plane.vspeed < CONFIG.damage.crashVspeed) {
      plane.crashed = plane.stalled ? 'STALL' : 'TERRAIN';
    } else if (strip) {
      // Touchdown on a runway: soft is good, hard is damage; a fast
      // touchdown overruns and bends the airframe. Slow down enough and
      // the crew repairs the plane and refuels it.
      if (plane.vspeed < -5.5) plane.damage += CONFIG.damage.hardLanding;
      else if (plane.vspeed < -3.5) plane.damage += CONFIG.damage.roughLanding;
      if (plane.speed >= 55) plane.damage += CONFIG.damage.roughLanding;
      if (plane.damage >= 100) plane.crashed = 'TERRAIN';
      plane.pitch = 0; plane.roll = 0;
      plane.speed *= Math.max(0, 1 - dt * (input.brake ? 2.4 : 0.9));
      if (plane.speed < 8) { plane.damage = Math.max(0, plane.damage - 25); plane.fuel = Math.min(100, plane.fuel + 40); }
    } else if (plane.speed < 55) {
      // Wheels-down on flat ground beside the strip: survivable, but rough
      // and with no repair or refuel — only a runway gives you those.
      if (plane.vspeed < -5.5) plane.damage += CONFIG.damage.hardLanding;
      else if (plane.vspeed < -3.5) plane.damage += CONFIG.damage.roughLanding;
      if (plane.damage >= 100) plane.crashed = 'TERRAIN';
      plane.pitch = 0; plane.roll = 0;
      plane.speed *= Math.max(0, 1 - dt * (input.brake ? 2.8 : 1.4)); // grass drag
    } else {
      // Fast into rough terrain: that is a crash.
      plane.crashed = 'TERRAIN';
    }
  } else {
    plane.onGround = false;
    if (plane.alt > 12) plane.airborne = true;
  }

  if (plane.overspeed && plane.damage >= 100) plane.crashed = 'OVERSPEED';
  if (plane.damage >= 100 && !plane.crashed) plane.crashed = 'TERRAIN';
  if (plane.fuel <= 0 && plane.alt <= groundLevel + 0.5 && plane.speed < 6) plane.crashed = 'FUEL';

  return { touchedDown: plane.onGround && prevAlt > groundLevel + 0.5, strip };
}

// Restart the sortie from the home runway, keeping the mission.
export function resetPlane(plane, fuel) {
  const fresh = makePlane();
  fresh.fuel = fuel ?? CONFIG.fuel.start;
  Object.assign(plane, fresh);
}
