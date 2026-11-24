// Synthesised sound effects. Nothing plays until the player's first interaction.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.8;
let muted = false;
try { muted = localStorage.getItem("boc.muted") === "1"; } catch { /* no storage */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.2, slideTo?: number) {
  const a = ac(); if (!a || !master) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(dur: number, vol: number, filterFreq: number, start = 0) {
  const a = ac(); if (!a || !master) return;
  const t = a.currentTime + start;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "highpass"; f.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const SFX = {
  get muted() { return muted; },
  unlock() { ac(); },
  toggleMute() {
    muted = !muted;
    try { localStorage.setItem("boc.muted", muted ? "1" : "0"); } catch {}
    if (master) master.gain.value = muted ? 0 : volume;
    return muted;
  },
  jump: () => tone(380, 0, 0.12, "sine", 0.12, 620),
  land: () => tone(160, 0, 0.06, "sine", 0.08, 110),
  pickup: () => tone(520, 0, 0.08, "triangle", 0.15, 860),
  drop: () => tone(420, 0, 0.09, "triangle", 0.12, 240),
  squeak: () => { tone(900, 0, 0.12, "sine", 0.18, 1500); tone(1400, 0.1, 0.1, "sine", 0.12, 900); },
  hiss: () => noise(0.45, 0.25, 2500),
  bark: () => { tone(330, 0, 0.11, "sawtooth", 0.14, 200); tone(300, 0.15, 0.13, "sawtooth", 0.14, 170); },
  sniff: () => { noise(0.08, 0.12, 4000); noise(0.08, 0.12, 4000, 0.12); noise(0.08, 0.12, 4000, 0.24); },
  poof: () => noise(0.25, 0.15, 1200),
  hit: () => tone(200, 0, 0.15, "triangle", 0.15, 120),
  seatChime: () => tone(1046, 0, 0.12, "sine", 0.06),
  tick: () => tone(880, 0, 0.08, "square", 0.06),
  go: () => { tone(660, 0, 0.12, "triangle", 0.15); tone(990, 0.1, 0.25, "triangle", 0.15); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, "triangle", 0.14)),
  buzzer: () => { tone(220, 0, 0.5, "square", 0.08); tone(165, 0, 0.5, "square", 0.06); },
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, "triangle", 0.12)),
  good: () => { tone(660, 0, 0.12, "sine", 0.14); tone(990, 0.09, 0.2, "sine", 0.14); },
  bad: () => { tone(260, 0, 0.18, "triangle", 0.14, 180); },
  coin: () => { tone(988, 0, 0.08, "square", 0.06); tone(1319, 0.07, 0.18, "square", 0.06); },
  blip: () => tone(600 + Math.random() * 200, 0, 0.03, "triangle", 0.04),
};
