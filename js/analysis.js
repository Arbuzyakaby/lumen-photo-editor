/* Lumen analysis: image statistics, chart painting and the dice roll.
 * Pure math lives at the top (unit-tested in node); painters only ever touch a canvas context
 * handed to them, so nothing here looks anything up in the DOM.
 */
(function (root) {
  'use strict';
  const BINS = 64;
  const HUES = 12;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;

  // ---------- Pure statistics ----------

  /** Histograms, averages and hue spread from raw RGBA bytes. `step` skips pixels for speed. */
  function summarize(data, step) {
    step = Math.max(1, step || 1);
    const r = new Float32Array(BINS), g = new Float32Array(BINS), b = new Float32Array(BINS), l = new Float32Array(BINS);
    const hues = new Float32Array(HUES);
    let n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, ssat = 0, gray = 0, dark = 0, blown = 0;
    const stride = 4 * step;
    for (let i = 0; i < data.length; i += stride) {
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const L = R * 0.2126 + G * 0.7152 + B * 0.0722;
      r[R >> 2]++; g[G >> 2]++; b[B >> 2]++; l[clamp(L, 0, 255) >> 2]++;
      sr += R; sg += G; sb += B; sl += L; sl2 += L * L;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
      const sat = mx ? d / mx : 0;
      ssat += sat;
      if (d < 16) gray++;
      else {
        let h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
        h = ((h * 60 + 360) % 360);
        hues[Math.min(HUES - 1, Math.floor(h / 360 * HUES))] += sat;
      }
      if (L < 8) dark++;
      if (L > 247) blown++;
      n++;
    }
    if (!n) n = 1;
    const mean = sl / n;
    return {
      bins: BINS, n, r, g, b, l, hues,
      avg: { r: sr / n, g: sg / n, b: sb / n },
      luma: mean / 255,
      contrast: Math.sqrt(Math.max(0, sl2 / n - mean * mean)) / 128,
      saturation: ssat / n,
      grayShare: gray / n,
      clipDark: dark / n,
      clipLight: blown / n,
    };
  }

  /** Cumulative tone distribution, 0–1 per bin — the shape of the tone curve chart. */
  function cumulative(hist) {
    const out = new Float32Array(hist.length);
    let acc = 0, total = 0;
    for (let i = 0; i < hist.length; i++) total += hist[i];
    for (let i = 0; i < hist.length; i++) { acc += hist[i]; out[i] = total ? acc / total : 0; }
    return out;
  }

  /** Top colours by 4-bit-per-channel bucket, brightest-first within equal shares. */
  function dominant(data, count, step) {
    step = Math.max(1, step || 1);
    const map = new Map();
    let n = 0;
    for (let i = 0; i < data.length; i += 4 * step) {
      const k = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | data[i + 2] >> 4;
      const e = map.get(k);
      if (e) { e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2]; e.n++; }
      else map.set(k, { r: data[i], g: data[i + 1], b: data[i + 2], n: 1 });
      n++;
    }
    const hx = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
    return [...map.values()]
      .sort((a, z) => z.n - a.n)
      .slice(0, count || 6)
      .map(e => ({ hex: '#' + hx(e.r / e.n) + hx(e.g / e.n) + hx(e.b / e.n), share: e.n / (n || 1) }));
  }

  /** Luminance density per column — the waveform chart. cols × BINS values, 0–1. */
  function waveform(data, w, h, cols) {
    cols = Math.max(1, cols || 96);
    const out = new Float32Array(cols * BINS);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const L = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        out[Math.min(cols - 1, Math.floor(x / w * cols)) * BINS + (clamp(L, 0, 255) >> 2)]++;
      }
    }
    let mx = 1;
    for (let i = 0; i < out.length; i++) mx = Math.max(mx, out[i]);
    for (let i = 0; i < out.length; i++) out[i] /= mx;
    return { cols, bins: BINS, d: out };
  }

  // ---------- Smart crop ----------

  /** Coarse map of «what matters»: local contrast first, with colour and light as tie-breakers. */
  function energyMap(data, w, h, cols, rows) {
    cols = Math.max(4, cols || 40); rows = Math.max(4, rows || 40);
    const cell = new Float32Array(cols * rows), n = new Float32Array(cols * rows);
    const lum = new Float32Array(w * h);
    for (let p = 0, i = 0; p < lum.length; p++, i += 4) lum[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
    for (let y = 0; y < h; y++) {
      const gy = Math.min(rows - 1, Math.floor(y / h * rows)) * cols;
      for (let x = 0; x < w; x++) {
        const p = y * w + x, i = p * 4;
        const dx = x + 1 < w ? Math.abs(lum[p + 1] - lum[p]) : 0;
        const dy = y + 1 < h ? Math.abs(lum[p + w] - lum[p]) : 0;
        const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]);
        const k = gy + Math.min(cols - 1, Math.floor(x / w * cols));
        cell[k] += (dx + dy) * 3 + (mx ? (mx - mn) / mx : 0) * 0.3 + lum[p] * 0.06;
        n[k]++;
      }
    }
    for (let i = 0; i < cell.length; i++) cell[i] /= Math.max(1, n[i]);
    return { cols, rows, d: cell };
  }

  /** Best placement of a `ratio` crop over that map.
   *  `ox`/`oy` are −1…1 across whatever slack the crop leaves: 0 is dead centre, +1 flush right/bottom.
   *  `keep` is the share of the picture's energy the crop holds on to. */
  function smartCrop(map, ratio, imgRatio, steps) {
    const { cols, rows, d } = map;
    const cw = imgRatio > ratio ? ratio / imgRatio : 1;
    const ch = imgRatio > ratio ? 1 : imgRatio / ratio;
    const I = new Float64Array((cols + 1) * (rows + 1));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        I[(y + 1) * (cols + 1) + x + 1] = d[y * cols + x] + I[y * (cols + 1) + x + 1] + I[(y + 1) * (cols + 1) + x] - I[y * (cols + 1) + x];
      }
    }
    const box = (x0, y0, x1, y1) => I[y1 * (cols + 1) + x1] - I[y0 * (cols + 1) + x1] - I[y1 * (cols + 1) + x0] + I[y0 * (cols + 1) + x0];
    const total = box(0, 0, cols, rows) || 1;
    const S = Math.max(2, steps || 24);
    const span = k => (k < 1 ? Array.from({ length: S + 1 }, (_, i) => i / S * 2 - 1) : [0]);
    let best = { ox: 0, oy: 0, keep: 0, score: -Infinity };
    for (const ox of span(cw)) {
      for (const oy of span(ch)) {
        const x0 = (1 - cw) / 2 * (1 + ox), y0 = (1 - ch) / 2 * (1 + oy);
        const cx0 = Math.round(x0 * cols), cy0 = Math.round(y0 * rows);
        const cx1 = Math.min(cols, Math.max(cx0 + 1, Math.round((x0 + cw) * cols)));
        const cy1 = Math.min(rows, Math.max(cy0 + 1, Math.round((y0 + ch) * rows)));
        const keep = box(cx0, cy0, cx1, cy1) / total;
        // A gentle pull back to the middle, so a flat picture is not cropped off to one side at random.
        const score = keep - (Math.abs(ox) + Math.abs(oy)) * 0.05;
        if (score > best.score) best = { ox, oy, keep, score };
      }
    }
    return best;
  }

  // ---------- Dice ----------

  /** Tasteful random adjustments. Deterministic when handed a seeded `rnd`. */
  const ROLL = [
    { k: 'exposure', lo: -22, hi: 26 }, { k: 'brilliance', lo: 0, hi: 40 },
    { k: 'highlights', lo: -45, hi: 20 }, { k: 'shadows', lo: -25, hi: 45 },
    { k: 'contrast', lo: -18, hi: 45 }, { k: 'brightness', lo: -14, hi: 16 },
    { k: 'blacks', lo: -10, hi: 32 }, { k: 'saturation', lo: -35, hi: 32 },
    { k: 'vibrance', lo: -15, hi: 45 }, { k: 'warmth', lo: -40, hi: 40 },
    { k: 'tint', lo: -25, hi: 25 }, { k: 'hue', lo: -24, hi: 24 },
    { k: 'sharpness', lo: 0, hi: 40 }, { k: 'clarity', lo: -20, hi: 45 },
    { k: 'fade', lo: 0, hi: 38 }, { k: 'vignette', lo: -20, hi: 55 },
    { k: 'grain', lo: 0, hi: 40 }, { k: 'blur', lo: 0, hi: 8 },
  ];
  /** Each roll touches `keep` of the eighteen settings and leaves the rest at zero. */
  function roll(rnd, keep) {
    rnd = rnd || Math.random;
    const pool = ROLL.map(s => s);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const out = {};
    ROLL.forEach(s => (out[s.k] = 0));
    const take = clamp(keep || 7, 1, ROLL.length);
    pool.slice(0, take).forEach(s => {
      const v = Math.round(s.lo + rnd() * (s.hi - s.lo));
      out[s.k] = v;
    });
    return out;
  }

  // ---------- Chart painting ----------
  // Every painter takes (ctx, w, h, data, t) where t is 0–1 animation progress.

  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const GRID = 'rgba(255,255,255,.08)';
  const INK = 'rgba(235,235,245,.55)';
  const FONT = '600 10px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif';

  function frame(ctx, w, h, rows) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    for (let i = 0; i <= (rows || 4); i++) {
      const y = Math.round(h * i / (rows || 4)) + .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  /** Filled area of one histogram channel. */
  function area(ctx, w, h, a, mx, col, t) {
    const k = ease(t);
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let i = 0; i < a.length; i++) {
      ctx.lineTo(i / (a.length - 1) * w, h - Math.min(1, Math.sqrt(a[i] / mx)) * h * 0.94 * k);
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }

  function drawHistogram(ctx, w, h, s, t) {
    frame(ctx, w, h, 4);
    let mx = 1;
    [s.r, s.g, s.b, s.l].forEach(a => { for (let i = 1; i < BINS - 1; i++) mx = Math.max(mx, a[i]); });
    ctx.globalCompositeOperation = 'source-over';
    area(ctx, w, h, s.l, mx, 'rgba(255,255,255,.22)', t);
    ctx.globalCompositeOperation = 'screen';
    area(ctx, w, h, s.r, mx, 'rgba(255,69,58,.78)', t);
    area(ctx, w, h, s.g, mx, 'rgba(48,209,88,.72)', t);
    area(ctx, w, h, s.b, mx, 'rgba(10,132,255,.82)', t);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Cumulative tone curve against the straight line of an untouched image. */
  function drawCurve(ctx, w, h, cdf, t, accent) {
    frame(ctx, w, h, 4);
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.stroke(); ctx.setLineDash([]);
    const k = ease(t), last = Math.max(1, Math.floor((cdf.length - 1) * k));
    ctx.beginPath();
    for (let i = 0; i <= last; i++) ctx.lineTo(i / (cdf.length - 1) * w, h - cdf[i] * h);
    ctx.strokeStyle = accent || '#ffd60a'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(last / (cdf.length - 1) * w, h); ctx.lineTo(0, h); ctx.closePath();
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,214,10,.28)'); grd.addColorStop(1, 'rgba(255,214,10,0)');
    ctx.fillStyle = grd; ctx.fill();
  }

  /** Spider chart of the current adjustments: the middle ring is zero. */
  function drawRadar(ctx, w, h, items, t, accent) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 + 2, R = Math.min(w, h) / 2 - 26, k = ease(t), n = items.length;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = i / n * TAU - Math.PI / 2, r = R * ring / 4;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 2 ? 'rgba(255,255,255,.22)' : GRID;
      ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath();
    items.forEach((it, i) => {
      const a = i / n * TAU - Math.PI / 2, r = R * (0.5 + clamp(it.v, -1, 1) / 2) * k;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,214,10,.22)'; ctx.fill();
    ctx.strokeStyle = accent || '#ffd60a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = accent || '#ffd60a';
    items.forEach((it, i) => {
      const a = i / n * TAU - Math.PI / 2, r = R * (0.5 + clamp(it.v, -1, 1) / 2) * k;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, it.v ? 2.6 : 1.6, 0, TAU); ctx.fill();
    });
    ctx.font = FONT; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    items.forEach((it, i) => {
      const a = i / n * TAU - Math.PI / 2, r = R + 13;
      ctx.fillText(it.n, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    });
  }

  /** Horizontal bars around a zero axis — one per changed setting. */
  function drawBars(ctx, w, h, items, t, accent) {
    ctx.clearRect(0, 0, w, h);
    if (!items.length) return;
    const k = ease(t), pad = 74, zero = pad + (w - pad - 14) / 2, half = (w - pad - 14) / 2;
    const rowH = Math.min(26, h / items.length), bh = Math.min(11, rowH - 7);
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.moveTo(zero + .5, 0); ctx.lineTo(zero + .5, items.length * rowH); ctx.stroke();
    ctx.font = FONT; ctx.textBaseline = 'middle';
    items.forEach((it, i) => {
      const y = i * rowH + rowH / 2, len = half * clamp(Math.abs(it.v), 0, 1) * k;
      ctx.fillStyle = INK; ctx.textAlign = 'right';
      ctx.fillText(it.n, pad - 10, y);
      ctx.fillStyle = it.v < 0 ? 'rgba(10,132,255,.85)' : (accent || '#ffd60a');
      const x = it.v < 0 ? zero - len : zero;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y - bh / 2, Math.max(2, len), bh, bh / 2);
      else ctx.rect(x, y - bh / 2, Math.max(2, len), bh);
      ctx.fill();
    });
  }

  /** Ring of hue shares plus the neutral slice in the middle of the hole. */
  function drawDonut(ctx, w, h, segs, t) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 10, r0 = R * 0.58, k = ease(t);
    const total = segs.reduce((s, x) => s + x.v, 0) || 1;
    let a0 = -Math.PI / 2;
    segs.forEach(s => {
      const a1 = a0 + s.v / total * TAU * k;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1); ctx.arc(cx, cy, r0, a1, a0, true); ctx.closePath();
      ctx.fillStyle = s.c; ctx.fill();
      a0 = a1;
    });
    ctx.beginPath(); ctx.arc(cx, cy, r0 - 1, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
  }

  /** Luminance waveform: brightness distribution left-to-right across the frame. */
  function drawWave(ctx, w, h, wave, t) {
    ctx.clearRect(0, 0, w, h);
    const k = ease(t), cw = w / wave.cols, ch = h / wave.bins;
    for (let x = 0; x < wave.cols; x++) {
      for (let y = 0; y < wave.bins; y++) {
        const v = wave.d[x * wave.bins + y];
        if (v < 0.004) continue;
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, Math.sqrt(v) * 0.95 * k).toFixed(3)})`;
        ctx.fillRect(x * cw, h - (y + 1) * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = Math.round(h * i / 4) + .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  root.Analysis = {
    BINS, HUES, ROLL,
    summarize, cumulative, dominant, waveform, roll, energyMap, smartCrop,
    drawHistogram, drawCurve, drawRadar, drawBars, drawDonut, drawWave,
  };
})(typeof window !== 'undefined' ? window : globalThis);
