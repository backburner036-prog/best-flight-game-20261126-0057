// audio.js — all sound is synthesised with WebAudio: engine hum, wind,
// ring beep and touchdown thud. No audio files, no network.
export function makeAudio() {
  return {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    enabled: true,
    started: false,
  };
}

// Must be called from a user gesture (click / keypress) once.
export function startAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    // Engine: two detuned saws through a low-pass, gain follows throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const engineOsc2 = audio.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 58;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    audio.engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.ctx.destination);
    audio.engineOsc.start(); engineOsc2.start();
    audio.engineOsc2 = engineOsc2;
    // Wind: looped filtered noise, gain follows airspeed.
    const len = audio.ctx.sampleRate * 2;
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSrc = audio.ctx.createBufferSource();
    audio.windSrc.buffer = buf; audio.windSrc.loop = true;
    const windFilter = audio.ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 900; windFilter.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0.0;
    audio.windSrc.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.ctx.destination);
    audio.windSrc.start();
    audio.started = true;
  } catch {
    audio.started = false; // audio is decoration; the game plays without it
  }
}

// Called every frame: engine pitch follows throttle, wind follows speed.
export function updateAudio(audio, plane) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const throttle = plane.throttle;
  audio.engineGain.gain.setTargetAtTime(0.02 + throttle * 0.06, t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + plane.speed * 0.4, t, 0.1);
  if (audio.engineOsc2) audio.engineOsc2.frequency.setTargetAtTime(51 + throttle * 72 + plane.speed * 0.4, t, 0.1);
  audio.windGain.gain.setTargetAtTime(Math.min(0.09, plane.speed * 0.0011), t, 0.15);
}

function beep(audio, freq, dur, gain) {
  if (!audio.started || !audio.ctx) return;
  const osc = audio.ctx.createOscillator();
  osc.type = 'sine'; osc.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(gain, audio.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
  osc.connect(g); g.connect(audio.ctx.destination);
  osc.start(); osc.stop(audio.ctx.currentTime + dur);
}

export function playRingBeep(audio, precise) {
  beep(audio, precise ? 1320 : 880, 0.28, 0.16);
  if (precise) setTimeout(() => beep(audio, 1760, 0.2, 0.12), 90);
}

export function playTouchdown(audio) {
  if (!audio.started || !audio.ctx) return;
  const osc = audio.ctx.createOscillator();
  osc.type = 'sine'; osc.frequency.setValueAtTime(120, audio.ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, audio.ctx.currentTime + 0.22);
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.3, audio.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.25);
  osc.connect(g); g.connect(audio.ctx.destination);
  osc.start(); osc.stop(audio.ctx.currentTime + 0.26);
}

export function playCrash(audio) {
  beep(audio, 110, 0.7, 0.2);
  setTimeout(() => beep(audio, 82, 0.8, 0.18), 120);
}
