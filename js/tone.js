/* Lumen tone math: point curves, the HSL mixer bands and split-toning tints. No DOM access —
 * app.js turns a state into plain arrays here and the engine only uploads them. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CHANNELS = ['m', 'r', 'g', 'b'];
  const IDENT = [[0, 0], [1, 1]];
  const MAX_POINTS = 12;

  /** Eight bands, like Lightroom's mixer. `h` is the band centre in degrees. */
  const BANDS = [
    { k: 'red', n: 'Красные', h: 0, c: '#ff453a' },
    { k: 'orange', n: 'Оранжевые', h: 30, c: '#ff9f0a' },
    { k: 'yellow', n: 'Жёлтые', h: 58, c: '#ffd60a' },
    { k: 'green', n: 'Зелёные', h: 115, c: '#30d158' },
    { k: 'aqua', n: 'Бирюзовые', h: 180, c: '#40c8e0' },
    { k: 'blue', n: 'Синие', h: 225, c: '#0a84ff' },
    { k: 'purple', n: 'Фиолетовые', h: 272, c: '#bf5af2' },
    { k: 'magenta', n: 'Пурпурные', h: 318, c: '#ff2d9b' },
  ];

  const freshCurve = () => ({ m: IDENT, r: IDENT, g: IDENT, b: IDENT });
  const freshHsl = () => BANDS.map(() => [0, 0, 0]);

  /** Coerce any stored/untrusted point list into a sorted one with fixed ends inside 0–1. */
  function cleanPoints(p) {
    if (!Array.isArray(p)) return IDENT;
    const pts = p.filter(q => Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1]))
      .map(q => [clamp(+q[0], 0, 1), clamp(+q[1], 0, 1)])
      .sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const q of pts) if (!out.length || q[0] - out[out.length - 1][0] > 0.01) out.push(q);
    if (out.length < 2) return IDENT;
    return out.slice(0, MAX_POINTS);
  }
  function cleanCurve(c) {
    const o = {};
    CHANNELS.forEach(k => (o[k] = cleanPoints(c && c[k])));
    return o;
  }
  const isIdentity = p => p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] === 1 && p[1][1] === 1;
  const curveIsIdentity = c => CHANNELS.every(k => isIdentity(c[k]));

  /**
   * Monotone cubic (Fritsch–Carlson) through the points, sampled at n steps.
   * Monotone so a curve never folds back and posterises the picture into bands.
   */
  function sample(points, n) {
    n = n || 256;
    const p = cleanPoints(points), k = p.length, out = new Float32Array(n);
    const dx = [], m = [], d = [];
    for (let i = 0; i < k - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; d[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
    m[0] = d[0]; m[k - 1] = d[k - 2];
    for (let i = 1; i < k - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < k - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    let seg = 0;
    for (let j = 0; j < n; j++) {
      const x = j / (n - 1);
      if (x <= p[0][0]) { out[j] = p[0][1]; continue; }
      if (x >= p[k - 1][0]) { out[j] = p[k - 1][1]; continue; }
      while (seg < k - 2 && x > p[seg + 1][0]) seg++;
      const h = dx[seg], t = (x - p[seg][0]) / h, t2 = t * t, t3 = t2 * t;
      out[j] = clamp((2 * t3 - 3 * t2 + 1) * p[seg][1] + (t3 - 2 * t2 + t) * h * m[seg] +
        (-2 * t3 + 3 * t2) * p[seg + 1][1] + (t3 - t2) * h * m[seg + 1], 0, 1);
    }
    return out;
  }

  /** 256×1 RGBA table: each colour channel runs through the master curve, then its own. */
  function lut(curve) {
    const c = cleanCurve(curve), m = sample(c.m), ch = [sample(c.r), sample(c.g), sample(c.b)];
    const out = new Uint8Array(256 * 4);
    const at = (a, x) => { const f = x * 255, i = Math.floor(f), t = f - i; return i >= 255 ? a[255] : a[i] + (a[i + 1] - a[i]) * t; };
    for (let i = 0; i < 256; i++) {
      for (let j = 0; j < 3; j++) out[i * 4 + j] = Math.round(at(ch[j], m[i]) * 255);
      out[i * 4 + 3] = 255;
    }
    return out;
  }

  /** Add a point, or move the nearest one if the new x is right on top of it. Ends stay pinned at x 0 and 1. */
  function addPoint(points, x, y) {
    const p = cleanPoints(points).map(q => q.slice());
    const near = p.findIndex(q => Math.abs(q[0] - x) < 0.03);
    if (near >= 0) { p[near][1] = clamp(y, 0, 1); return { points: p, index: near }; }
    if (p.length >= MAX_POINTS) return { points: p, index: -1 };
    p.push([clamp(x, 0.01, 0.99), clamp(y, 0, 1)]);
    p.sort((a, b) => a[0] - b[0]);
    return { points: p, index: p.findIndex(q => q[0] === clamp(x, 0.01, 0.99)) };
  }
  /** Move point i; inner points cannot cross their neighbours, the end points only move vertically. */
  function movePoint(points, i, x, y) {
    const p = points.map(q => q.slice());
    if (i < 0 || i >= p.length) return p;
    const last = p.length - 1;
    const lo = i === 0 ? 0 : p[i - 1][0] + 0.012, hi = i === last ? 1 : p[i + 1][0] - 0.012;
    p[i] = [i === 0 ? p[0][0] : i === last ? p[last][0] : clamp(x, lo, hi), clamp(y, 0, 1)];
    return p;
  }
  function removePoint(points, i) {
    if (i <= 0 || i >= points.length - 1) return points;
    return points.filter((_, j) => j !== i);
  }

  const CURVE_PRESETS = {
    linear: IDENT,
    scurve: [[0, 0], [0.25, 0.19], [0.75, 0.82], [1, 1]],
    matte: [[0, 0.08], [0.3, 0.3], [0.75, 0.78], [1, 0.95]],
    bright: [[0, 0], [0.4, 0.52], [1, 1]],
    moody: [[0, 0], [0.45, 0.36], [0.85, 0.82], [1, 0.94]],
  };

  function cleanHsl(h) {
    return BANDS.map((_, i) => {
      const r = Array.isArray(h) && Array.isArray(h[i]) ? h[i] : [];
      return [0, 1, 2].map(j => (Number.isFinite(+r[j]) ? clamp(Math.round(+r[j]), -100, 100) : 0));
    });
  }
  const hslIsZero = h => h.every(b => b.every(v => v === 0));
  /** Flat [hue, sat, lum] × 8 in shader units: hue in radians (±40°), sat and lum in ±1. */
  function hslUniform(h) {
    const out = new Float32Array(24);
    cleanHsl(h).forEach((b, i) => { out[i * 3] = b[0] / 100 * 40 * Math.PI / 180; out[i * 3 + 1] = b[1] / 100; out[i * 3 + 2] = b[2] / 100; });
    return out;
  }

  /** Split-toning tint: a hue (0–360) and strength (0–100) → a signed RGB push around neutral. */
  function tint(hue, sat) {
    const h = ((hue % 360) + 360) % 360 / 60, s = clamp(sat, 0, 100) / 100;
    const f = n => { const k = (n + h) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
    const rgb = [f(5), f(3), f(1)], avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
    return rgb.map(v => (v - avg) * s * 0.32);
  }

  root.Tone = { CHANNELS, BANDS, IDENT, MAX_POINTS, CURVE_PRESETS, freshCurve, freshHsl, cleanPoints, cleanCurve, curveIsIdentity, isIdentity,
    sample, lut, addPoint, movePoint, removePoint, cleanHsl, hslIsZero, hslUniform, tint };
})(typeof window !== 'undefined' ? window : globalThis);
