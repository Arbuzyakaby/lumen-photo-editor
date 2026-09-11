/* Lumen drawing layer: brush / marker / eraser strokes, color math, brush presets. No DOM access. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TOOLS = ['brush', 'marker', 'eraser'];
  const DEFAULT = { tool: 'brush', h: 48, s: 100, v: 100, size: 18, opacity: 100, soft: 30 };
  const MAX_PRESETS = 24;

  /** h 0–360, s/v 0–100 → "#rrggbb" */
  function hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; v = clamp(v, 0, 100) / 100;
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
  }
  function hexToHsv(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return { h: 0, s: 0, v: 0 };
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: Math.round((h * 60 + 360) % 360), s: Math.round(mx ? d / mx * 100 : 0), v: Math.round(mx * 100) };
  }

  /** Coerce any stored/untrusted brush into a valid one. */
  function sanitize(b) {
    b = b || {};
    const num = (k, lo, hi) => (Number.isFinite(+b[k]) ? clamp(+b[k], lo, hi) : DEFAULT[k]);
    return {
      tool: TOOLS.includes(b.tool) ? b.tool : DEFAULT.tool,
      h: num('h', 0, 360), s: num('s', 0, 100), v: num('v', 0, 100),
      size: num('size', 1, 120), opacity: num('opacity', 5, 100), soft: num('soft', 0, 100),
    };
  }

  function addPreset(list, brush, name, id) {
    const p = { id: id || 'b' + Date.now().toString(36), n: String(name || '').trim().slice(0, 24) || 'Кисть', ...sanitize(brush) };
    return [...list, p].slice(-MAX_PRESETS);
  }
  const removePreset = (list, id) => list.filter(p => p.id !== id);
  const loadPresets = raw => (Array.isArray(raw) ? raw.filter(p => p && p.id).map(p => ({ id: String(p.id), n: String(p.n || 'Кисть').slice(0, 24), ...sanitize(p) })) : []);

  /** Build a stroke from the brush. Points and width are normalised to the frame (0–1, width by long side). */
  function makeStroke(brush, widthNorm) {
    const b = sanitize(brush);
    return { t: b.tool, c: hsvToHex(b.h, b.s, b.v), w: widthNorm, o: b.opacity / 100, soft: b.soft / 100, p: [] };
  }
  /** Append a point unless it's closer than minD to the previous one (keeps strokes light). */
  function addPoint(stroke, x, y, minD) {
    const p = stroke.p, n = p.length;
    if (n && Math.hypot(x - p[n - 2], y - p[n - 1]) < (minD || 0)) return false;
    p.push(+x.toFixed(4), +y.toFixed(4));
    return true;
  }

  /** Paint strokes onto ctx sized w×h. Each stroke is one path so its own alpha never stacks. */
  function render(ctx, strokes, w, h) {
    ctx.clearRect(0, 0, w, h);
    const L = Math.max(w, h);
    for (const s of strokes || []) {
      if (!s.p || s.p.length < 2) continue;
      const lw = Math.max(0.5, s.w * L), marker = s.t === 'marker';
      ctx.save();
      ctx.globalCompositeOperation = s.t === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = marker ? Math.min(s.o, 0.85) : s.o;
      ctx.strokeStyle = ctx.fillStyle = s.t === 'eraser' ? '#000' : s.c;
      ctx.lineWidth = lw;
      ctx.lineCap = marker ? 'square' : 'round';
      ctx.lineJoin = marker ? 'bevel' : 'round';
      const blur = marker ? 0 : s.soft * lw * 0.35;
      if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.beginPath();
      const p = s.p;
      ctx.moveTo(p[0] * w, p[1] * h);
      if (p.length === 2) ctx.lineTo(p[0] * w + 0.01, p[1] * h);
      for (let i = 2; i < p.length - 2; i += 2) {
        const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
        ctx.quadraticCurveTo(p[i] * w, p[i + 1] * h, mx * w, my * h);
      }
      if (p.length > 2) ctx.lineTo(p[p.length - 2] * w, p[p.length - 1] * h);
      ctx.stroke();
      ctx.restore();
    }
  }

  root.Brush = { TOOLS, DEFAULT, MAX_PRESETS, hsvToHex, hexToHsv, sanitize, addPreset, removePreset, loadPresets, makeStroke, addPoint, render };
})(typeof window !== 'undefined' ? window : globalThis);
