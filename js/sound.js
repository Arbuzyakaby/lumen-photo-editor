/* Lumen sound: every UI sound is synthesised once into a buffer and replayed, no audio files.
 * Mechanical clicks use modal synthesis — a handful of exponentially decaying sines at the
 * inharmonic ratios a small metal or plastic part rings at — plus a sub-millisecond noise
 * transient. That reads as a real detent instead of the buzzy square-wave blip it replaced.
 * `synth()` is pure (no Web Audio), so the whole bank is unit-tested in node.
 */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;

  const PACKS = [
    { id: 'mech', n: 'Механика', e: '⚙️', d: 'Сухие щелчки, как колёсико камеры' },
    { id: 'soft', n: 'Мягкая', e: '☁️', d: 'Приглушённые, будто через фетр' },
    { id: 'retro', n: '8-бит', e: '👾', d: 'Чиптюн из девяностых' },
    { id: 'duck', n: 'Утка', e: '🦆', d: 'Кря. Просто кря.' },
  ];
  const EVENTS = ['tick', 'zero', 'select', 'on', 'off', 'open', 'close', 'shutter', 'die', 'success', 'error', 'undo', 'redo', 'pop', 'achieve', 'sizzle'];
  const LEN = { sizzle: 0.75, achieve: 0.62, shutter: 0.24, success: 0.42, error: 0.34, open: 0.26, close: 0.24 };

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- primitives: each adds into `o` starting at t0 seconds ----------
  /** Damped partials [freq, amp, decay seconds] with a 0.3 ms attack so nothing pops. */
  function modes(o, sr, t0, list) {
    const s0 = Math.floor(t0 * sr), atk = sr * 0.0003;
    for (const [f, a, d] of list) {
      const n = Math.min(o.length - s0, Math.ceil(d * sr * 7));
      const w = TAU * f / sr, k = Math.exp(-1 / (d * sr));
      let env = a;
      for (let i = 0; i < n; i++) { o[s0 + i] += Math.sin(w * i) * env * Math.min(1, i / atk); env *= k; }
    }
  }
  /** A noise burst through a one-pole high-pass (hp) and low-pass (lp), both 0–1. */
  function noise(o, sr, t0, dur, amp, hp, lp, rnd) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.ceil(dur * sr * 5)), k = Math.exp(-1 / (dur * sr));
    let env = amp, lo = 0, prev = 0, hpo = 0;
    for (let i = 0; i < n; i++) {
      const x = rnd() * 2 - 1;
      hpo = hp * (hpo + x - prev); prev = x;
      lo += lp * (hpo - lo);
      o[s0 + i] += lo * env; env *= k;
    }
  }
  /** Whoosh: noise whose low-pass opens (or closes) over `dur`, under a rounded envelope. */
  function whoosh(o, sr, t0, dur, amp, lp0, lp1, rnd) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.floor(dur * sr));
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, lp = lp0 + (lp1 - lp0) * t, env = Math.sin(Math.PI * t) ** 2 * amp;
      a += lp * ((rnd() * 2 - 1) - a); b += lp * (a - b);
      o[s0 + i] += b * env;
    }
  }
  /** Pitch sweep with an exponential decay; shape 'sine' | 'square'. */
  function sweep(o, sr, t0, dur, f0, f1, amp, shape, decay) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.floor(dur * sr)), atk = sr * 0.0015;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, f = f0 * Math.pow(f1 / f0, t);
      ph += f / sr;
      const v = shape === 'square' ? (ph % 1 < 0.5 ? 1 : -1) * 0.5 : Math.sin(TAU * ph);
      const env = amp * Math.min(1, i / atk) * (decay ? Math.exp(-i / (decay * sr)) : 1 - t);
      o[s0 + i] += v * env;
    }
  }
  /** Chiptune note: a square with a flat body and a short release. */
  function chip(o, sr, t0, dur, f, amp, duty) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.floor(dur * sr));
    duty = duty || 0.5;
    for (let i = 0; i < n; i++) {
      const env = i > n - sr * 0.006 ? (n - i) / (sr * 0.006) : 1;
      o[s0 + i] += ((i * f / sr) % 1 < duty ? 0.5 : -0.5) * amp * env;
    }
  }
  /** Old consoles' noise channel: a 15-bit LFSR clocked at `rate`. */
  function lfsr(o, sr, t0, dur, rate, amp) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.floor(dur * sr));
    let reg = 0x7fff, acc = 0, v = 1;
    for (let i = 0; i < n; i++) {
      acc += rate / sr;
      while (acc >= 1) { acc--; const bit = (reg ^ (reg >> 1)) & 1; reg = (reg >> 1) | (bit << 14); v = reg & 1 ? 0.5 : -0.5; }
      o[s0 + i] += v * amp * (1 - i / n);
    }
  }
  /** RBJ band-pass, in place — used to shape a sawtooth into a duck's formants. */
  function bandpass(x, sr, f, q) {
    const w = TAU * f / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  }
  function quack(o, sr, t0, dur, f0, amp, rise) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.floor(dur * sr));
    const raw = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, f = f0 * (rise ? 0.8 + 0.35 * t : 1.08 - 0.3 * t) * (1 + 0.03 * Math.sin(TAU * 28 * i / sr));
      ph = (ph + f / sr) % 1;
      raw[i] = (ph * 2 - 1) * Math.min(1, i / (sr * 0.006)) * Math.pow(1 - t, 1.4);
    }
    const a = bandpass(raw, sr, 1150, 3.2), b = bandpass(raw, sr, 2650, 4.5), c = bandpass(raw, sr, 520, 2.5);
    for (let i = 0; i < n; i++) o[s0 + i] += (a[i] * 1.4 + b[i] * 0.9 + c[i] * 0.6) * amp;
  }
  /** Fat crackle: sparse random impulses ringing a little, like oil in a hot pan. */
  function crackle(o, sr, t0, dur, amp, rnd) {
    const s0 = Math.floor(t0 * sr), n = Math.min(o.length - s0, Math.floor(dur * sr));
    let lo = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, env = Math.min(1, t * 12) * (1 - t) ** 0.7;
      lo += 0.35 * ((rnd() * 2 - 1) - lo);
      o[s0 + i] += lo * 0.18 * amp * env;
      if (rnd() < 0.0022) modes(o, sr, t0 + i / sr, [[1800 + rnd() * 5200, amp * (0.3 + rnd() * 0.7) * env, 0.0012 + rnd() * 0.002]]);
    }
  }
  const marimba = f => [[f, 1, 0.16], [f * 3.93, 0.22, 0.035], [f * 9.2, 0.06, 0.012]];

  // ---------- mechanical / soft ----------
  function mech(o, sr, kind, P, rnd) {
    const M = (t, list) => modes(o, sr, t, list.map(([f, a, d]) => [f * P.fm, a, d * P.dm]));
    const click = (t, amp) => noise(o, sr, t, 0.0011 * P.dm, amp, 0.8, P.soft ? 0.35 : 0.9, rnd);
    switch (kind) {
      case 'tick': M(0, [[3150, 1, 0.006], [4920, 0.5, 0.004], [7300, 0.22, 0.0025], [1180, 0.35, 0.01]]); click(0, 0.35); break;
      case 'zero': M(0, [[1850, 1, 0.012], [2950, 0.55, 0.008], [640, 0.55, 0.028]]); click(0, 0.4); break;
      case 'select':
        M(0, [[2350, 1, 0.012], [3900, 0.5, 0.007], [820, 0.6, 0.022], [5600, 0.2, 0.003]]); click(0, 0.5);
        M(0.016, [[1650, 0.55, 0.01], [2700, 0.3, 0.007], [600, 0.3, 0.02]]); click(0.016, 0.25); break;
      case 'on': M(0, [[2100, 0.8, 0.01], [3400, 0.4, 0.006]]); M(0.028, [[3000, 1, 0.009], [4700, 0.45, 0.006], [980, 0.4, 0.018]]); click(0.028, 0.4); break;
      case 'off': M(0, [[3000, 0.8, 0.009], [4700, 0.35, 0.006]]); M(0.028, [[1900, 1, 0.012], [3000, 0.45, 0.007], [700, 0.45, 0.022]]); click(0.028, 0.35); break;
      case 'open': whoosh(o, sr, 0, 0.2, 0.9, 0.02, P.soft ? 0.12 : 0.3, rnd); M(0.17, [[2600, 0.25, 0.006], [900, 0.2, 0.015]]); break;
      case 'close': whoosh(o, sr, 0, 0.18, 0.8, P.soft ? 0.12 : 0.28, 0.02, rnd); M(0.16, [[1500, 0.3, 0.008], [560, 0.3, 0.02]]); break;
      case 'shutter':
        M(0, [[1300, 1, 0.02], [2150, 0.7, 0.014], [3500, 0.4, 0.008], [420, 0.6, 0.04]]); click(0, 0.9);
        whoosh(o, sr, 0.012, 0.065, 0.35, 0.08, 0.22, rnd);
        M(0.078, [[1150, 0.75, 0.018], [1900, 0.5, 0.012], [3100, 0.25, 0.007], [380, 0.5, 0.035]]); click(0.078, 0.6); break;
      case 'die': M(0, [[1900, 1, 0.018], [3100, 0.6, 0.01], [5200, 0.3, 0.005], [700, 0.45, 0.03]]); click(0, 0.6); break;
      case 'success': M(0, marimba(1318.5)); M(0.09, marimba(1975.5)); break;
      case 'error': M(0, [[330, 1, 0.06], [990, 0.28, 0.02], [1650, 0.1, 0.01]]); M(0.12, [[262, 1, 0.07], [786, 0.28, 0.02]]); break;
      case 'undo': sweep(o, sr, 0, 0.075, 980 * P.fm, 520 * P.fm, 0.45, 'sine', 0.03); click(0, 0.25); break;
      case 'redo': sweep(o, sr, 0, 0.075, 520 * P.fm, 980 * P.fm, 0.45, 'sine', 0.03); click(0, 0.25); break;
      case 'pop': sweep(o, sr, 0, 0.05, 380 * P.fm, 1150 * P.fm, 0.8, 'sine', 0.018); click(0.002, 0.2); break;
      case 'achieve':
        [1046.5, 1318.5, 1568, 2093].forEach((f, i) => M(i * 0.075, marimba(f)));
        M(0.3, [[5274, 0.16, 0.05], [6272, 0.12, 0.04], [7040, 0.1, 0.035]]); break;
      case 'sizzle': crackle(o, sr, 0, 0.72, 0.9, rnd); break;
    }
  }

  // ---------- 8-bit ----------
  function retro(o, sr, kind, rnd) {
    const C = (t, d, f, a, duty) => chip(o, sr, t, d, f, a, duty);
    switch (kind) {
      case 'tick': C(0, 0.014, 1760, 0.35, 0.25); break;
      case 'zero': C(0, 0.028, 880, 0.45, 0.5); break;
      case 'select': C(0, 0.028, 659, 0.45); C(0.03, 0.04, 988, 0.45); break;
      case 'on': C(0, 0.035, 523, 0.4); C(0.04, 0.05, 784, 0.4); break;
      case 'off': C(0, 0.035, 784, 0.4); C(0.04, 0.05, 523, 0.4); break;
      case 'open': [523, 659, 784].forEach((f, i) => C(i * 0.035, 0.035, f, 0.28, 0.25)); break;
      case 'close': [784, 659, 523].forEach((f, i) => C(i * 0.035, 0.035, f, 0.28, 0.25)); break;
      case 'shutter': lfsr(o, sr, 0, 0.12, 9000, 0.7); C(0.12, 0.05, 1046, 0.35, 0.125); break;
      case 'die': C(0, 0.025, 300 + Math.floor(rnd() * 6) * 110, 0.4, 0.25); lfsr(o, sr, 0, 0.02, 20000, 0.3); break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => C(i * 0.06, i === 3 ? 0.16 : 0.06, f, 0.35)); break;
      case 'error': C(0, 0.1, 196, 0.45); C(0.12, 0.18, 147, 0.45); break;
      case 'undo': sweep(o, sr, 0, 0.08, 1200, 400, 0.5, 'square'); break;
      case 'redo': sweep(o, sr, 0, 0.08, 400, 1200, 0.5, 'square'); break;
      case 'pop': sweep(o, sr, 0, 0.06, 300, 1400, 0.5, 'square'); break;
      case 'achieve': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => C(i * 0.08, i === 5 ? 0.2 : 0.075, f, 0.32, i % 2 ? 0.25 : 0.5)); break;
      case 'sizzle': lfsr(o, sr, 0, 0.7, 14000, 0.55); break;
    }
  }

  // ---------- duck ----------
  function duck(o, sr, kind, rnd) {
    const Q = (t, d, f, a, rise) => quack(o, sr, t, d, f, a, rise);
    switch (kind) {
      case 'tick': Q(0, 0.05, 560 + rnd() * 80, 0.35); break;
      case 'zero': Q(0, 0.08, 470, 0.55); break;
      case 'select': Q(0, 0.12, 390, 0.7); break;
      case 'on': Q(0, 0.1, 380, 0.6, true); break;
      case 'off': Q(0, 0.1, 420, 0.6); break;
      case 'open': case 'close': mech(o, sr, kind, { fm: 1, dm: 1 }, rnd); break;
      case 'shutter': Q(0, 0.1, 400, 0.8); Q(0.12, 0.12, 360, 0.8); break;
      case 'die': Q(0, 0.06, 420 + rnd() * 200, 0.5); break;
      case 'success': Q(0, 0.09, 380, 0.6, true); Q(0.1, 0.09, 450, 0.6, true); Q(0.2, 0.16, 540, 0.7, true); break;
      case 'error': Q(0, 0.3, 250, 0.8); break;
      case 'undo': Q(0, 0.09, 460, 0.5); break;
      case 'redo': Q(0, 0.09, 400, 0.5, true); break;
      case 'pop': Q(0, 0.05, 700, 0.5, true); break;
      case 'achieve': [360, 420, 500, 600].forEach((f, i) => Q(i * 0.1, 0.12, f, 0.6, true)); break;
      case 'sizzle': Q(0, 0.12, 420, 0.7); crackle(o, sr, 0.1, 0.6, 0.8, rnd); break;
    }
  }

  /** Render one sound to a Float32Array (mono). Variants detune the partials slightly so repeats never sound machine-gunned. */
  function synth(kind, pack, sr, variant) {
    sr = sr || 48000; variant = variant || 0;
    const rnd = rng(EVENTS.indexOf(kind) * 97 + variant * 13 + 5);
    const o = new Float32Array(Math.ceil(sr * (LEN[kind] || 0.16)));
    const jit = variant ? 1 + (rnd() - 0.5) * 0.06 : 1;
    if (pack === 'retro') retro(o, sr, kind, rnd);
    else if (pack === 'duck') duck(o, sr, kind, rnd);
    else if (pack === 'soft') mech(o, sr, kind, { fm: 0.56 * jit, dm: 1.9, soft: true }, rnd);
    else mech(o, sr, kind, { fm: jit, dm: 1 }, rnd);
    // Partials can still ring when the buffer ends; a 10 ms fade keeps that cut from clicking.
    const fade = Math.min(o.length, Math.floor(sr * 0.01));
    for (let i = 0; i < fade; i++) o[o.length - 1 - i] *= i / fade;
    if (pack === 'soft') { let lo = 0; for (let i = 0; i < o.length; i++) { lo += 0.22 * (o[i] - lo); o[i] = lo * 1.6; } }
    // Gentle saturation, then normalise so every sound in every pack sits at the same loudness.
    let peak = 0;
    for (let i = 0; i < o.length; i++) { o[i] = Math.tanh(o[i] * 1.2); peak = Math.max(peak, Math.abs(o[i])); }
    const k = peak > 0 ? 0.9 / peak : 0;
    for (let i = 0; i < o.length; i++) o[i] *= k;
    return o;
  }

  // Loudness per event: the dial detent must stay far below a shutter or a fanfare.
  const LEVEL = { tick: 0.16, zero: 0.3, select: 0.36, on: 0.34, off: 0.3, open: 0.2, close: 0.18, shutter: 0.6, die: 0.34, success: 0.34, error: 0.4, undo: 0.26, redo: 0.26, pop: 0.4, achieve: 0.42, sizzle: 0.4 };
  const VARIANTS = { tick: 4, die: 5, select: 2 };

  // ---------- Web Audio runtime ----------
  let actx = null, master = null, enabled = true, volume = 0.7, pack = 'mech', lastTick = 0;
  const cache = new Map();

  function ctx() {
    if (actx) return actx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    actx = new AC({ latencyHint: 'interactive' });
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.002; comp.release.value = 0.12;
    master = actx.createGain();
    master.gain.value = volume * volume;
    master.connect(comp).connect(actx.destination);
    return actx;
  }
  function buffer(kind, variant) {
    const key = pack + '|' + kind + '|' + variant;
    let b = cache.get(key);
    if (!b) {
      const data = synth(kind, pack, actx.sampleRate, variant);
      b = actx.createBuffer(1, data.length, actx.sampleRate);
      b.getChannelData(0).set(data);
      cache.set(key, b);
    }
    return b;
  }

  /** Play `kind`. opts: rate (pitch), gain (0–1+), pan (−1…1), delay (s). */
  function play(kind, opts) {
    if (!enabled || !LEVEL[kind]) return;
    opts = opts || {};
    const now = root.performance ? performance.now() : Date.now();
    if (kind === 'tick') { if (now - lastTick < 16) return; lastTick = now; }
    let ac;
    try { ac = ctx(); if (!ac) return; if (ac.state === 'suspended') ac.resume(); } catch { return; }
    const v = VARIANTS[kind] ? Math.floor(Math.random() * VARIANTS[kind]) : 0;
    const src = ac.createBufferSource();
    src.buffer = buffer(kind, v);
    src.playbackRate.value = clamp(opts.rate || 1, 0.25, 4);
    const g = ac.createGain();
    g.gain.value = LEVEL[kind] * clamp(opts.gain == null ? 1 : opts.gain, 0, 2);
    let node = src.connect(g);
    if (opts.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(opts.pan, -1, 1); node = node.connect(p); }
    node.connect(master);
    src.start(ac.currentTime + (opts.delay || 0));
  }
  /** A die tumbling across a table: impacts bunch up and soften as it settles. */
  function rattle(ms, pan) {
    let t = 0, i = 0;
    while (t < ms / 1000 && i < 14) {
      play('die', { delay: t, gain: 1 - i * 0.05, rate: 0.9 + Math.random() * 0.25, pan });
      t += 0.035 + Math.random() * 0.06 + i * 0.006; i++;
    }
  }
  function setPack(p) { if (PACKS.some(x => x.id === p)) pack = p; }
  function setVolume(v) { volume = clamp(v, 0, 1); if (master) master.gain.value = volume * volume; }
  function setEnabled(on) { enabled = !!on; }

  root.Sound = { PACKS, EVENTS, LEVEL, synth, play, rattle, setPack, setVolume, setEnabled, get pack() { return pack; } };
})(typeof window !== 'undefined' ? window : globalThis);
