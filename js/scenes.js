/* Procedurally painted sample photos.
 * Everything is drawn at SS× and shrunk once at the end. Painted at 1:1 the dense far detail —
 * tree lines, grass blades, water streaks, city windows — is a pixel wide, and any rescale the
 * editor does turns it into visible shimmer. Supersampling resolves it before it can alias.
 */
window.Scenes = (() => {
  'use strict';
  const W = 1800, H = 1200, HZ = 780, SS = 2;
  const cache = {};

  function rng(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /** A canvas whose context works in 1800×1200 units while the bitmap underneath is SS× bigger. */
  function canvas() {
    const c = document.createElement('canvas');
    c.width = W * SS; c.height = H * SS;
    const x = c.getContext('2d');
    x.scale(SS, SS);
    return [c, x];
  }
  function shrink(big) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(big, 0, 0, W, H);
    return c;
  }
  const ridgeY = (px, base, amp, s) => base - amp * (0.5 + 0.5 * (
    Math.sin(px * 0.0029 + s) * 0.5 + Math.sin(px * 0.0083 + s * 1.7) * 0.28 +
    Math.sin(px * 0.021 + s * 2.3) * 0.14 + Math.sin(px * 0.057 + s * 3.1) * 0.08));

  function ridge(x, base, amp, s, fill) {
    x.beginPath(); x.moveTo(0, HZ + 4);
    for (let px = 0; px <= W; px += 5) x.lineTo(px, ridgeY(px, base, amp, s));
    x.lineTo(W, HZ + 4); x.closePath();
    x.fillStyle = fill; x.fill();
  }
  function pine(x, cx, by, h, col) {
    x.fillStyle = col;
    x.fillRect(cx - h * 0.018, by - h * 0.16, h * 0.036, h * 0.18);
    for (let i = 0; i < 5; i++) {
      const yb = by - h * 0.1 - i * h * 0.165, w = h * 0.3 * (1 - i * 0.17);
      x.beginPath(); x.moveTo(cx - w, yb); x.lineTo(cx, yb - h * 0.32); x.lineTo(cx + w, yb); x.closePath(); x.fill();
    }
  }
  function treeLine(x, base, amp, s, col, r, minH, maxH) {
    for (let px = -10; px <= W + 10; px += 7 + r() * 7) pine(x, px, ridgeY(px, base, amp, s) + 4, minH + r() * (maxH - minH), col);
  }
  /** Aerial perspective: a veil over the far detail, which is also what stops it reading as noise. */
  function haze(x, y0, y1, rgb, a0, a1) {
    const g = x.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(1, `rgba(${rgb},${a1})`);
    x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0);
  }
  /** Fold the painted sky and skyline back down over the water. A canvas may be drawn onto
   *  itself — the source is snapshotted first — so this needs no full-size temporary copy,
   *  which at SS× was the most expensive allocation in the whole file. */
  function mirror(x, c, alpha, blur, hz) {
    hz = hz || HZ;
    x.save();
    x.globalAlpha = alpha;
    if (blur && 'filter' in x) x.filter = `blur(${blur}px)`;
    x.translate(0, hz * 2); x.scale(1, -1);
    x.drawImage(c, 0, 0, W * SS, hz * SS, 0, 0, W, hz);
    x.restore();
  }
  function glow(x, px, py, rad, rgb, a) {
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  const vgrad = (x, y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hexN = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hexN(a), B = hexN(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  function hills(x, base, amp, s, fill) {
    x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 6) x.lineTo(px, base - amp * (0.5 + 0.5 * (Math.sin(px * 0.0021 + s) * 0.7 + Math.sin(px * 0.0057 + s * 2.1) * 0.3)));
    x.lineTo(W, H); x.closePath(); x.fillStyle = fill; x.fill();
  }

  function day() {
    const [c, x] = canvas(), r = rng(11);
    let g = x.createLinearGradient(0, 0, 0, HZ);
    g.addColorStop(0, '#1c68cf'); g.addColorStop(0.45, '#4f98e6'); g.addColorStop(0.82, '#a9d3f5'); g.addColorStop(1, '#dcefff');
    x.fillStyle = g; x.fillRect(0, 0, W, HZ);

    const sx = 1360, sy = 200;
    g = x.createRadialGradient(sx, sy, 0, sx, sy, 460);
    g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.05, 'rgba(255,253,235,1)');
    g.addColorStop(0.16, 'rgba(255,244,205,.5)'); g.addColorStop(0.45, 'rgba(255,240,210,.12)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, HZ);

    const cloud = (cx, cy, s, a) => {
      x.save(); x.globalAlpha = a;
      for (let i = 0; i < 26; i++) {
        const dx = (r() - 0.5) * 300 * s, px = cx + dx, py = cy + (r() - 0.5) * 40 * s + Math.abs(dx) * 0.12;
        const rad = (34 + r() * 50) * s * (1 - Math.abs(dx) / (360 * s));
        const gg = x.createRadialGradient(px, py - rad * 0.35, rad * 0.1, px, py, rad);
        gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(0.4, 'rgba(250,252,255,.7)');
        gg.addColorStop(0.75, 'rgba(226,236,248,.25)'); gg.addColorStop(1, 'rgba(214,228,244,0)');
        x.fillStyle = gg; x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
      }
      x.restore();
    };
    cloud(360, 190, 1.4, 0.95); cloud(860, 120, 0.85, 0.9); cloud(1560, 380, 1.1, 0.85);
    cloud(1100, 330, 0.7, 0.75); cloud(140, 420, 0.8, 0.7); cloud(640, 430, 0.55, 0.6);

    g = x.createLinearGradient(0, 330, 0, HZ);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, '#eef4fb'); g.addColorStop(0.32, '#a9c1dc'); g.addColorStop(1, '#7f9ec4');
    ridge(x, HZ - 50, 380, 1.3, g);
    haze(x, HZ - 220, HZ, '225,240,252', 0, 0.45);
    g = x.createLinearGradient(0, HZ - 240, 0, HZ); g.addColorStop(0, '#5b8c8a'); g.addColorStop(1, '#3d6b62');
    ridge(x, HZ - 20, 230, 4.4, g);
    g = x.createLinearGradient(0, HZ - 110, 0, HZ); g.addColorStop(0, '#2f6a3c'); g.addColorStop(1, '#224f2c');
    ridge(x, HZ + 2, 100, 7.7, g);
    treeLine(x, HZ + 2, 100, 7.7, '#1b4526', r, 20, 46);
    haze(x, HZ - 130, HZ + 4, '210,232,250', 0, 0.3);

    x.fillStyle = '#2a6aa8'; x.fillRect(0, HZ, W, H - HZ);
    mirror(x, c, 0.9, 2);
    g = x.createLinearGradient(0, HZ, 0, H);
    g.addColorStop(0, 'rgba(40,110,170,.25)'); g.addColorStop(0.5, 'rgba(20,80,140,.55)'); g.addColorStop(1, 'rgba(10,45,90,.9)');
    x.fillStyle = g; x.fillRect(0, HZ, W, H - HZ);
    for (let i = 0; i < 650; i++) {
      const t = Math.pow(r(), 1.6), y = HZ + 3 + t * (H - HZ), len = (10 + r() * 120) * (0.3 + t * 1.6);
      x.fillStyle = r() < 0.7 ? `rgba(255,255,255,${0.04 + r() * 0.1})` : `rgba(0,30,70,${0.08 + r() * 0.12})`;
      x.fillRect(r() * W - len / 2, y, len, 1 + t * 2.4);
    }
    for (let i = 0; i < 140; i++) {
      const y = HZ + 60 + Math.pow(r(), 0.8) * (H - HZ - 60), px = sx + (r() - 0.5) * (120 + (y - HZ) * 0.5);
      x.fillStyle = `rgba(255,252,235,${0.25 + r() * 0.5})`;
      x.fillRect(px, y, 4 + r() * 18, 1.4 + r() * 1.5);
    }

    x.beginPath(); x.moveTo(0, H - 260); x.bezierCurveTo(260, H - 250, 520, H - 120, 760, H); x.lineTo(0, H); x.closePath();
    g = x.createLinearGradient(0, H - 260, 0, H); g.addColorStop(0, '#4d7d34'); g.addColorStop(1, '#1f3c17');
    x.fillStyle = g; x.fill();
    pine(x, 70, H - 250, 520, '#12301a'); pine(x, 210, H - 215, 400, '#163a1f');
    pine(x, 330, H - 175, 300, '#1a4122'); pine(x, 440, H - 130, 210, '#1d4625');
    return c;
  }

  function night() {
    const [c, x] = canvas(), r = rng(29);
    let g = x.createLinearGradient(0, 0, 0, HZ);
    g.addColorStop(0, '#01030b'); g.addColorStop(0.4, '#060d2a'); g.addColorStop(0.8, '#122052'); g.addColorStop(1, '#25316a');
    x.fillStyle = g; x.fillRect(0, 0, W, HZ);
    glow(x, 1250, HZ, 700, '140,90,190', 0.35);

    // Milky Way
    const ax = 250, ay = -60, bx = 1650, by = 640, len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    const band = o => { const t = r(); return [ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]; };
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    for (let i = 0; i < 140; i++) { const [px, py] = band(gauss() * 120); glow(x, px, py, 60 + r() * 150, r() < 0.5 ? '180,160,235' : '140,170,240', 0.05 + r() * 0.05); }
    for (let i = 0; i < 50; i++) { const [px, py] = band(gauss() * 40); glow(x, px, py, 20 + r() * 60, '0,0,8', 0.3); }
    for (let i = 0; i < 2200; i++) {
      const [px, py] = band(gauss() * 150); if (py > HZ - 20) continue;
      const s = r() < 0.9 ? 1.2 : 1.8;
      x.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.55})`; x.fillRect(px, py, s, s);
    }
    for (let i = 0; i < 900; i++) {
      const px = r() * W, py = Math.pow(r(), 1.3) * (HZ - 40), s = Math.pow(r(), 4) * 1.9 + 0.5;
      x.globalAlpha = 0.3 + r() * 0.7;
      x.fillStyle = r() < 0.15 ? '#cfe0ff' : r() < 0.1 ? '#ffe4c4' : '#fff';
      x.beginPath(); x.arc(px, py, s, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const px = r() * W, py = r() * (HZ - 260);
      glow(x, px, py, 16, '210,225,255', 0.6);
      x.fillStyle = 'rgba(235,242,255,.55)';
      x.fillRect(px - 11, py - 0.6, 22, 1.2); x.fillRect(px - 0.6, py - 11, 1.2, 22);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 1.8, 0, Math.PI * 2); x.fill();
    }

    // Moon
    const mx = 420, my = 230;
    glow(x, mx, my, 380, '200,215,255', 0.4);
    glow(x, mx, my, 120, '220,230,255', 0.35);
    g = x.createRadialGradient(mx - 14, my - 14, 6, mx, my, 50);
    g.addColorStop(0, '#fffef6'); g.addColorStop(1, '#dfe2d2');
    x.fillStyle = g; x.beginPath(); x.arc(mx, my, 50, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(150,150,135,.22)';
    [[-16, -10, 9], [12, 8, 12], [18, -18, 5], [-6, 20, 7], [-24, 12, 4], [4, -26, 6], [26, 22, 4]].forEach(([dx, dy, rr]) => {
      x.beginPath(); x.arc(mx + dx, my + dy, rr, 0, Math.PI * 2); x.fill();
    });

    g = x.createLinearGradient(0, 380, 0, HZ); g.addColorStop(0, '#1b2656'); g.addColorStop(1, '#0f1738');
    ridge(x, HZ - 50, 380, 1.3, g);
    haze(x, HZ - 200, HZ, '60,70,130', 0, 0.3);
    ridge(x, HZ - 20, 230, 4.4, '#0b112c');
    ridge(x, HZ + 2, 100, 7.7, '#060919');
    treeLine(x, HZ + 2, 100, 7.7, '#04060f', r, 20, 46);

    const lights = [[1180, 0], [1214, 6], [1262, -2], [1300, 5]].map(([lx, dy]) => [lx, ridgeY(lx, HZ + 2, 100, 7.7) + 16 + dy]);
    lights.forEach(([lx, ly]) => { glow(x, lx, ly, 28, '255,180,90', 0.55); x.fillStyle = '#ffd79a'; x.fillRect(lx - 2, ly - 2, 4, 4); });

    x.fillStyle = '#050a1e'; x.fillRect(0, HZ, W, H - HZ);
    mirror(x, c, 0.75, 2.5);
    g = x.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, 'rgba(4,8,26,.35)'); g.addColorStop(1, 'rgba(1,2,8,.92)');
    x.fillStyle = g; x.fillRect(0, HZ, W, H - HZ);
    for (let i = 0; i < 110; i++) {
      const t = i / 110, y = HZ + 4 + Math.pow(t, 1.7) * (H - HZ - 4), w = (40 + t * 240) * (0.35 + r() * 0.9);
      x.fillStyle = `rgba(225,232,255,${(0.55 - t * 0.4) * (0.4 + r() * 0.6)})`;
      x.fillRect(mx - w / 2 + (r() - 0.5) * 30 * t, y, w, 1.4 + t * 3);
    }
    lights.forEach(([lx]) => {
      for (let j = 0; j < 26; j++) {
        const w = 3 + r() * 5;
        x.fillStyle = `rgba(255,190,110,${0.5 * (1 - j / 26)})`;
        x.fillRect(lx - w / 2 + (r() - 0.5) * 6, HZ + 6 + j * 9, w, 5);
      }
    });
    for (let i = 0; i < 400; i++) {
      const t = r(), len = 20 + r() * 140;
      x.fillStyle = `rgba(120,140,220,${0.03 + r() * 0.05})`;
      x.fillRect(r() * W, HZ + 4 + t * (H - HZ), len, 1.2 + t * 2);
    }

    x.beginPath(); x.moveTo(W, H - 280); x.bezierCurveTo(W - 260, H - 270, W - 540, H - 130, W - 800, H); x.lineTo(W, H); x.closePath();
    x.fillStyle = '#02030a'; x.fill();
    pine(x, W - 80, H - 270, 540, '#010207'); pine(x, W - 220, H - 235, 420, '#010207');
    pine(x, W - 345, H - 190, 310, '#02030a'); pine(x, W - 455, H - 140, 220, '#02030a');
    return c;
  }

  function meadow() {
    const [c, x] = canvas(), r = rng(7);
    x.fillStyle = vgrad(x, 0, 700, ['#2f7fe0', '#77b6f2', '#d7ecfb']); x.fillRect(0, 0, W, H);
    glow(x, 380, 170, 520, '255,250,225', 0.55);
    for (let i = 0; i < 9; i++) { const cx = r() * W, cy = 90 + r() * 300; for (let j = 0; j < 14; j++) glow(x, cx + (r() - 0.5) * 260, cy + (r() - 0.5) * 50, 40 + r() * 60, '255,255,255', 0.35); }
    hills(x, 640, 140, 0.4, vgrad(x, 450, 800, ['#8fb7a8', '#6f9a86']));
    haze(x, 560, 700, '215,235,245', 0.32, 0);
    hills(x, 760, 160, 2.2, vgrad(x, 600, 900, ['#7cb54a', '#4d8a2c']));
    hills(x, 900, 170, 4.1, vgrad(x, 720, H, ['#5ea83a', '#2e6b1d']));
    for (let i = 0; i < 2600; i++) {
      const t = Math.pow(r(), 0.7), y = 820 + t * (H - 820), px = r() * W, h = 6 + t * 26;
      x.strokeStyle = `rgba(${40 + r() * 60 | 0},${110 + r() * 70 | 0},${30 + r() * 30 | 0},.8)`; x.lineWidth = 1.2 + t * 1.5;
      x.beginPath(); x.moveTo(px, y); x.lineTo(px + (r() - 0.5) * 8, y - h); x.stroke();
      if (r() < 0.12) { x.fillStyle = ['#ffd23f', '#ffffff', '#ff6b9a', '#b58cff', '#ff8a3d'][r() * 5 | 0]; x.beginPath(); x.arc(px, y - h, 1.8 + t * 4, 0, Math.PI * 2); x.fill(); }
    }
    pine(x, 1480, 830, 360, '#1f4a22'); pine(x, 1560, 850, 300, '#23522a');
    return c;
  }

  /* Sand has no outlines — only shading. Each dune is a heightfield lit per column: the strip's
     top colour comes from how its own slope leans toward the sun, so crests catch the light and
     the far side falls away smoothly. Drawing the shadow as polygons left visible blocky wedges. */
  function dunes() {
    const [c, x] = canvas(), r = rng(3), SUN = 1380;
    x.fillStyle = vgrad(x, 0, 780, ['#2a67b8', '#6ea4db', '#b9cbd8', '#eed9b4']); x.fillRect(0, 0, W, H);
    glow(x, SUN, 250, 540, '255,243,203', 0.5);
    glow(x, SUN, 250, 150, '255,251,235', 0.75);
    haze(x, 560, 790, '242,219,178', 0, 0.55);

    const crest = (px, base, amp, s) => base - amp * (0.5 + 0.5 * (
      Math.sin(px * 0.0022 + s) * 0.62 + Math.sin(px * 0.0051 + s * 1.7) * 0.26 + Math.sin(px * 0.0113 + s * 2.4) * 0.12));

    const dune = (base, amp, s, lit, dark, deep) => {
      const STEP = 3;
      for (let px = -STEP; px <= W + STEP; px += STEP) {
        const y = crest(px, base, amp, s);
        const slope = (crest(px + 7, base, amp, s) - crest(px - 7, base, amp, s)) / 14;
        // Positive slope falls to the right; the face turned toward the sun is the lit one.
        // The direction swings smoothly across the frame — flipping its sign at the sun's own
        // column put a hard vertical seam down the picture.
        const facing = clamp(-slope * Math.tanh((SUN - px) / 420) * 7, -1, 1);
        const g = x.createLinearGradient(0, y, 0, y + amp * 1.6);
        g.addColorStop(0, mix(dark, lit, (facing + 1) / 2));
        g.addColorStop(1, deep);
        x.fillStyle = g;
        x.fillRect(px, y, STEP + 1, H - y);
      }
    };
    dune(760, 95, 0.3, '#f6e0b6', '#cdae86', '#d9bb8e');
    dune(880, 150, 2.6, '#f3cf92', '#b8905c', '#c79b62');
    dune(1060, 215, 5.0, '#eebf76', '#996c3c', '#a6743c');

    // wind ripples, lying along the slope and fading out with distance
    for (let i = 0; i < 240; i++) {
      const t = Math.pow(r(), 0.6), y0 = 900 + t * (H - 920), px = r() * W, len = (80 + r() * 280) * (0.4 + t);
      x.strokeStyle = `rgba(${110 + r() * 40 | 0},${66 + r() * 30 | 0},28,${0.04 + t * 0.07})`;
      x.lineWidth = 1.5 + t * 2.5;
      x.beginPath(); x.moveTo(px, y0);
      x.quadraticCurveTo(px + len / 2, y0 - 8 - t * 14, px + len, y0 + 2);
      x.stroke();
    }
    for (let i = 0; i < 800; i++) {
      const t = Math.pow(r(), 0.5), y = 920 + t * (H - 920);
      x.fillStyle = r() < 0.5 ? `rgba(255,244,214,${0.05 + r() * 0.14})` : `rgba(120,70,30,${0.04 + r() * 0.09})`;
      x.fillRect(r() * W, y, 1.6 + t * 2, 1.6 + t * 2);
    }
    return c;
  }

  function city() {
    const [c, x] = canvas(), r = rng(41), GY = 900;
    x.fillStyle = vgrad(x, 0, GY, ['#050817', '#141a44', '#3a2c6a', '#b0527a']); x.fillRect(0, 0, W, GY);
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.6})`; x.fillRect(r() * W, r() * 500, 1.6, 1.6); }
    const layer = (n, minH, maxH, col, lit) => {
      let px = -20;
      while (px < W) {
        const w = 50 + r() * 110, h = minH + r() * (maxH - minH), top = GY - h;
        x.fillStyle = col; x.fillRect(px, top, w, h);
        if (r() < 0.25) x.fillRect(px + w / 2 - 2, top - 40, 4, 40);
        if (lit) for (let wy = top + 12; wy < GY - 10; wy += 16) for (let wx = px + 8; wx < px + w - 10; wx += 13)
          if (r() < lit) { x.fillStyle = r() < 0.8 ? `rgba(255,${200 + r() * 40 | 0},${120 + r() * 60 | 0},.9)` : 'rgba(150,200,255,.85)'; x.fillRect(wx, wy, 6, 8); }
        x.fillStyle = col; px += w + r() * n;
      }
    };
    layer(10, 180, 420, '#1a1c3a', 0);
    haze(x, GY - 320, GY, '90,70,130', 0, 0.35);
    layer(20, 220, 560, '#0d0f24', 0.28);
    layer(40, 120, 300, '#07081a', 0.4);
    x.fillStyle = '#04050f'; x.fillRect(0, GY, W, H - GY);
    mirror(x, c, 0.6, 3, GY);
    x.fillStyle = vgrad(x, GY, H, ['rgba(4,5,15,.2)', 'rgba(2,2,8,.9)']); x.fillRect(0, GY, W, H - GY);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,200,140,${r() * 0.18})`; x.fillRect(r() * W, GY + r() * (H - GY), 20 + r() * 90, 1.8); }
    return c;
  }

  function aurora() {
    const [c, x] = canvas(), r = rng(17);
    x.fillStyle = vgrad(x, 0, HZ, ['#01040c', '#04142a', '#0b2a3f']); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1100; i++) { x.globalAlpha = 0.2 + r() * 0.8; x.fillStyle = '#fff'; x.fillRect(r() * W, r() * HZ, 1.6, 1.6); }
    x.globalAlpha = 1;
    x.save(); x.globalCompositeOperation = 'lighter';
    [[0.9, '60,255,160'], [0.6, '90,200,255'], [0.35, '200,90,255']].forEach(([a, rgb], k) => {
      for (let px = 0; px < W; px += 4) {
        const y = 260 + k * 60 + Math.sin(px * 0.004 + k) * 90 + Math.sin(px * 0.011 + k * 3) * 30, h = 160 + Math.sin(px * 0.007 + k * 2) * 90;
        const g = x.createLinearGradient(0, y - h, 0, y);
        g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.8, `rgba(${rgb},${0.09 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
        x.fillStyle = g; x.fillRect(px, y - h, 5, h);
      }
    });
    x.restore();
    ridge(x, HZ - 30, 260, 2.2, vgrad(x, 450, HZ, ['#dfe9f5', '#8fa6c4']));
    haze(x, HZ - 170, HZ, '120,150,190', 0, 0.28);
    ridge(x, HZ + 2, 110, 6.1, '#0a1624');
    treeLine(x, HZ + 2, 110, 6.1, '#040a12', r, 22, 50);
    x.fillStyle = '#e8f0fa'; x.fillRect(0, HZ, W, H - HZ);
    mirror(x, c, 0.35, 4);
    x.fillStyle = vgrad(x, HZ, H, ['rgba(120,150,190,.25)', 'rgba(20,35,60,.75)']); x.fillRect(0, HZ, W, H - HZ);
    return c;
  }

  /* Turquoise water and bright sand: the scene that pushes white balance and saturation. */
  function beach() {
    const [c, x] = canvas(), r = rng(53), SEA = 640, SAND = 820;
    x.fillStyle = vgrad(x, 0, SEA, ['#1a6fd4', '#63a9ea', '#bcdcf4', '#eaf4fb']); x.fillRect(0, 0, W, SEA);
    glow(x, 520, 150, 520, '255,250,232', 0.55);
    for (let i = 0; i < 7; i++) {
      const cx = r() * W, cy = 110 + r() * 300;
      for (let j = 0; j < 16; j++) {
        const px = cx + (r() - 0.5) * 380, py = cy + (r() - 0.5) * 50;
        glow(x, px, py, 50 + r() * 90, '255,255,255', 0.22);
      }
    }
    // sea: deep offshore, turquoise shallows
    x.fillStyle = vgrad(x, SEA, SAND, ['#0b6b8e', '#0f93a8', '#2fc0bd', '#8fe3d6']);
    x.fillRect(0, SEA, W, SAND - SEA);
    haze(x, SEA - 6, SEA + 40, '210,235,245', 0.5, 0);
    for (let i = 0; i < 420; i++) {
      const t = Math.pow(r(), 1.4), y = SEA + 4 + t * (SAND - SEA), len = (30 + r() * 200) * (0.3 + t * 1.4);
      x.fillStyle = r() < 0.55 ? `rgba(255,255,255,${0.05 + r() * 0.13})` : `rgba(4,60,80,${0.05 + r() * 0.1})`;
      x.fillRect(r() * W - len / 2, y, len, 1.4 + t * 2.6);
    }
    // surf: three foam lines, the closest one frothy
    [[SAND - 120, 0.35, 6], [SAND - 60, 0.5, 9], [SAND - 6, 0.8, 16]].forEach(([y0, a, th], li) => {
      x.beginPath(); x.moveTo(0, y0);
      for (let px = 0; px <= W; px += 8) x.lineTo(px, y0 + Math.sin(px * 0.006 + li * 2) * 9 + Math.sin(px * 0.017 + li) * 4);
      x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = th; x.lineJoin = 'round'; x.stroke();
      if (li === 2) for (let i = 0; i < 900; i++) {
        const px = r() * W, py = y0 + Math.sin(px * 0.006 + 4) * 9 + (r() - 0.5) * 34;
        x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
        x.beginPath(); x.arc(px, py, 1.4 + r() * 3.4, 0, Math.PI * 2); x.fill();
      }
    });
    // wet sand, then dry sand — the waterline is a wave with a soft trailing edge, not a band
    x.fillStyle = vgrad(x, SAND - 10, H, ['#c9ad86', '#e6cfa8', '#f3e2c2']); x.fillRect(0, SAND - 10, W, H - SAND + 10);
    x.beginPath(); x.moveTo(0, H); x.lineTo(0, SAND + 4);
    for (let px = 0; px <= W; px += 8) x.lineTo(px, SAND + 4 + Math.sin(px * 0.0055 + 1.3) * 12 + Math.sin(px * 0.016) * 5);
    x.lineTo(W, H); x.closePath();
    x.fillStyle = vgrad(x, SAND, SAND + 130, ['rgba(108,172,182,.38)', 'rgba(150,190,190,0)']); x.fill();
    for (let i = 0; i < 1400; i++) {
      const t = Math.pow(r(), 0.6), y = SAND + t * (H - SAND);
      x.fillStyle = r() < 0.5 ? `rgba(255,250,232,${0.06 + r() * 0.2})` : `rgba(140,105,60,${0.05 + r() * 0.14})`;
      x.fillRect(r() * W, y, 1.6 + t * 2.4, 1.6 + t * 2.4);
    }
    for (let i = 0; i < 26; i++) {
      const px = r() * W, py = SAND + 40 + Math.pow(r(), 0.7) * (H - SAND - 60), s = 4 + r() * 12;
      x.fillStyle = ['rgba(255,252,244,.85)', 'rgba(226,200,170,.8)', 'rgba(240,214,190,.75)'][r() * 3 | 0];
      x.beginPath(); x.ellipse(px, py, s, s * 0.66, r() * 3, 0, Math.PI * 2); x.fill();
    }
    // palm fronds leaning in from the top-left corner
    // Leaflets are filled and tapered rather than stroked — at this size a stroke reads as wire.
    const frond = (x0, y0, len, ang, spread, col) => {
      const tx = x0 + Math.cos(ang) * len, ty = y0 + Math.sin(ang) * len;
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(x0, y0 - 9);
      x.quadraticCurveTo((x0 + tx) / 2, (y0 + ty) / 2 - 18, tx, ty);
      x.quadraticCurveTo((x0 + tx) / 2, (y0 + ty) / 2 - 6, x0, y0 + 9);
      x.closePath(); x.fill();
      for (let i = 1; i <= 13; i++) {
        const t = i / 14;
        const lx = x0 + (tx - x0) * t, ly = y0 + (ty - y0) * t - Math.sin(t * Math.PI) * len * 0.11;
        const bl = len * 0.36 * Math.sin(t * Math.PI + 0.35);
        if (bl < len * 0.07) return; // a leaflet this short only reads as a stray wire
        [-1, 1].forEach(sgn => {
          const a2 = ang + sgn * spread;
          x.beginPath();
          x.moveTo(lx, ly - 5);
          x.quadraticCurveTo(lx + Math.cos(a2 - sgn * 0.32) * bl * 0.65, ly + Math.sin(a2 - sgn * 0.32) * bl * 0.65,
            lx + Math.cos(a2) * bl, ly + Math.sin(a2) * bl + bl * 0.32);
          x.quadraticCurveTo(lx + Math.cos(a2 + sgn * 0.18) * bl * 0.45, ly + Math.sin(a2 + sgn * 0.18) * bl * 0.45 + 7, lx, ly + 5);
          x.closePath(); x.fill();
        });
      }
    };
    frond(-40, -30, 620, 0.55, 0.85, 'rgba(12,40,22,.92)');
    frond(-60, 40, 520, 0.18, 0.9, 'rgba(16,50,28,.88)');
    frond(30, -60, 470, 1.05, 0.8, 'rgba(10,34,20,.9)');
    return c;
  }

  /* Fog: five receding tree lines, each washed out a little more. Low contrast on purpose —
     it is the scene that shows what «Чёткость», «Контраст» and «Выцветание» actually do. */
  function fog() {
    const [c, x] = canvas(), r = rng(67);
    x.fillStyle = vgrad(x, 0, H, ['#aab7be', '#c3ccd0', '#d6dcdc', '#c2c8c4']); x.fillRect(0, 0, W, H);
    glow(x, 1180, 120, 700, '255,250,230', 0.5);
    const LAYERS = [
      { y: 700, h: 150, col: '#8d9aa0', fog: 0.72, n: 26 },
      { y: 790, h: 230, col: '#74858a', fog: 0.56, n: 22 },
      { y: 880, h: 330, col: '#55696d', fog: 0.4, n: 17 },
      { y: 980, h: 450, col: '#3a4c4d', fog: 0.24, n: 13 },
      { y: 1120, h: 620, col: '#1e2c2b', fog: 0.08, n: 9 },
    ];
    LAYERS.forEach(({ y, h, col, fog: f, n }) => {
      for (let i = 0; i < n; i++) {
        const px = -60 + (i + r() * 0.7) * (W + 120) / n;
        const by = y + (r() - 0.5) * 26, th = h * (0.68 + r() * 0.64);
        x.fillStyle = col;
        x.fillRect(px - th * 0.012, by, th * 0.024, 40); // a trunk under the crown reads as depth
        pine(x, px, by, th, col);
      }
      // The veil is densest at the top of the layer and thins toward the viewer: a flat wash over
      // the whole frame laid a visible straight band across the middle of the picture.
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(217,223,222,${Math.min(1, f * 1.18).toFixed(3)})`);
      g.addColorStop(0.62, `rgba(214,220,219,${f})`);
      g.addColorStop(1, `rgba(206,212,211,${(f * 0.42).toFixed(3)})`);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
    // God rays: each beam is built from thin sub-strips whose alpha follows a sine, so the edges
    // fade into the fog instead of cutting it like glass.
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x0 = 880 + i * 105 + r() * 50, w0 = 40 + r() * 80, SUB = 11;
      for (let k = 0; k < SUB; k++) {
        const t = (k + 0.5) / SUB, a = Math.sin(t * Math.PI) * (0.035 + r() * 0.012);
        const sx = x0 + w0 * t, sw = w0 / SUB + 1;
        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(255,250,230,${a})`);
        g.addColorStop(0.55, `rgba(255,250,230,${a * 0.45})`);
        g.addColorStop(1, 'rgba(255,250,230,0)');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(sx, -20); x.lineTo(sx + sw, -20);
        x.lineTo(sx - 300 + sw * 2.6, H); x.lineTo(sx - 320, H);
        x.closePath(); x.fill();
      }
    }
    x.restore();
    // forest floor
    x.fillStyle = vgrad(x, 1060, H, ['rgba(120,126,112,.5)', 'rgba(62,68,56,.92)']); x.fillRect(0, 1060, W, H - 1060);
    for (let i = 0; i < 900; i++) {
      const t = Math.pow(r(), 0.7), y = 1070 + t * (H - 1070), px = r() * W, h = 10 + t * 46;
      x.strokeStyle = `rgba(${52 + r() * 40 | 0},${64 + r() * 36 | 0},${44 + r() * 26 | 0},${0.35 + t * 0.5})`;
      x.lineWidth = 1.4 + t * 2;
      x.beginPath(); x.moveTo(px, y); x.quadraticCurveTo(px + (r() - 0.5) * 14, y - h * 0.6, px + (r() - 0.5) * 26, y - h); x.stroke();
    }
    haze(x, 620, 1160, '216,222,220', 0.34, 0);
    return c;
  }

  const make = { day, night, meadow, dunes, city, aurora, beach, fog };
  return Object.fromEntries(Object.keys(make).map(k => [k, () => cache[k] || (cache[k] = shrink(make[k]()))]));
})();
