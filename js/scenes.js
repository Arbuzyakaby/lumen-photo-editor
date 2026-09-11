/* Procedurally painted sample photos: the same mountain lake by day and by night. */
window.Scenes = (() => {
  'use strict';
  const W = 1800, H = 1200, HZ = 780;
  const cache = {};

  function rng(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function canvas() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return [c, c.getContext('2d')];
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
    for (let px = -10; px <= W + 10; px += 6 + r() * 6) pine(x, px, ridgeY(px, base, amp, s) + 4, minH + r() * (maxH - minH), col);
  }
  function mirror(x, c, alpha, blur) {
    const t = document.createElement('canvas');
    t.width = W; t.height = HZ;
    t.getContext('2d').drawImage(c, 0, 0);
    x.save();
    x.globalAlpha = alpha;
    if (blur && 'filter' in x) x.filter = `blur(${blur}px)`;
    x.translate(0, HZ * 2); x.scale(1, -1);
    x.drawImage(t, 0, 0);
    x.restore();
  }
  function glow(x, px, py, rad, rgb, a) {
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
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
    g = x.createLinearGradient(0, HZ - 220, 0, HZ);
    g.addColorStop(0, 'rgba(225,240,252,0)'); g.addColorStop(1, 'rgba(225,240,252,.45)');
    x.fillStyle = g; x.fillRect(0, HZ - 220, W, 220);
    g = x.createLinearGradient(0, HZ - 240, 0, HZ); g.addColorStop(0, '#5b8c8a'); g.addColorStop(1, '#3d6b62');
    ridge(x, HZ - 20, 230, 4.4, g);
    g = x.createLinearGradient(0, HZ - 110, 0, HZ); g.addColorStop(0, '#2f6a3c'); g.addColorStop(1, '#224f2c');
    ridge(x, HZ + 2, 100, 7.7, g);
    treeLine(x, HZ + 2, 100, 7.7, '#1b4526', r, 18, 46);

    x.fillStyle = '#2a6aa8'; x.fillRect(0, HZ, W, H - HZ);
    mirror(x, c, 0.9, 2);
    g = x.createLinearGradient(0, HZ, 0, H);
    g.addColorStop(0, 'rgba(40,110,170,.25)'); g.addColorStop(0.5, 'rgba(20,80,140,.55)'); g.addColorStop(1, 'rgba(10,45,90,.9)');
    x.fillStyle = g; x.fillRect(0, HZ, W, H - HZ);
    for (let i = 0; i < 650; i++) {
      const t = Math.pow(r(), 1.6), y = HZ + 3 + t * (H - HZ), len = (10 + r() * 120) * (0.3 + t * 1.6);
      x.fillStyle = r() < 0.7 ? `rgba(255,255,255,${0.04 + r() * 0.1})` : `rgba(0,30,70,${0.08 + r() * 0.12})`;
      x.fillRect(r() * W - len / 2, y, len, 0.8 + t * 2.4);
    }
    for (let i = 0; i < 140; i++) {
      const y = HZ + 60 + Math.pow(r(), 0.8) * (H - HZ - 60), px = sx + (r() - 0.5) * (120 + (y - HZ) * 0.5);
      x.fillStyle = `rgba(255,252,235,${0.25 + r() * 0.5})`;
      x.fillRect(px, y, 4 + r() * 18, 1.2 + r() * 1.5);
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
      const s = r() < 0.9 ? 1 : 1.6;
      x.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.55})`; x.fillRect(px, py, s, s);
    }
    for (let i = 0; i < 900; i++) {
      const px = r() * W, py = Math.pow(r(), 1.3) * (HZ - 40), s = Math.pow(r(), 4) * 1.9 + 0.4;
      x.globalAlpha = 0.3 + r() * 0.7;
      x.fillStyle = r() < 0.15 ? '#cfe0ff' : r() < 0.1 ? '#ffe4c4' : '#fff';
      x.beginPath(); x.arc(px, py, s, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const px = r() * W, py = r() * (HZ - 260);
      glow(x, px, py, 16, '210,225,255', 0.6);
      x.fillStyle = 'rgba(235,242,255,.55)';
      x.fillRect(px - 11, py - 0.5, 22, 1); x.fillRect(px - 0.5, py - 11, 1, 22);
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
    g = x.createLinearGradient(0, HZ - 200, 0, HZ); g.addColorStop(0, 'rgba(60,70,130,0)'); g.addColorStop(1, 'rgba(60,70,130,.3)');
    x.fillStyle = g; x.fillRect(0, HZ - 200, W, 200);
    ridge(x, HZ - 20, 230, 4.4, '#0b112c');
    ridge(x, HZ + 2, 100, 7.7, '#060919');
    treeLine(x, HZ + 2, 100, 7.7, '#04060f', r, 18, 46);

    const lights = [[1180, 0], [1214, 6], [1262, -2], [1300, 5]].map(([lx, dy]) => [lx, ridgeY(lx, HZ + 2, 100, 7.7) + 16 + dy]);
    lights.forEach(([lx, ly]) => { glow(x, lx, ly, 28, '255,180,90', 0.55); x.fillStyle = '#ffd79a'; x.fillRect(lx - 2, ly - 2, 4, 4); });

    x.fillStyle = '#050a1e'; x.fillRect(0, HZ, W, H - HZ);
    mirror(x, c, 0.75, 2.5);
    g = x.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, 'rgba(4,8,26,.35)'); g.addColorStop(1, 'rgba(1,2,8,.92)');
    x.fillStyle = g; x.fillRect(0, HZ, W, H - HZ);
    for (let i = 0; i < 110; i++) {
      const t = i / 110, y = HZ + 4 + Math.pow(t, 1.7) * (H - HZ - 4), w = (40 + t * 240) * (0.35 + r() * 0.9);
      x.fillStyle = `rgba(225,232,255,${(0.55 - t * 0.4) * (0.4 + r() * 0.6)})`;
      x.fillRect(mx - w / 2 + (r() - 0.5) * 30 * t, y, w, 1.2 + t * 3);
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
      x.fillRect(r() * W, HZ + 4 + t * (H - HZ), len, 1 + t * 2);
    }

    x.beginPath(); x.moveTo(W, H - 280); x.bezierCurveTo(W - 260, H - 270, W - 540, H - 130, W - 800, H); x.lineTo(W, H); x.closePath();
    x.fillStyle = '#02030a'; x.fill();
    pine(x, W - 80, H - 270, 540, '#010207'); pine(x, W - 220, H - 235, 420, '#010207');
    pine(x, W - 345, H - 190, 310, '#02030a'); pine(x, W - 455, H - 140, 220, '#02030a');
    return c;
  }

  const vgrad = (x, y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
  function hills(x, base, amp, s, fill) {
    x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 6) x.lineTo(px, base - amp * (0.5 + 0.5 * (Math.sin(px * 0.0021 + s) * 0.7 + Math.sin(px * 0.0057 + s * 2.1) * 0.3)));
    x.lineTo(W, H); x.closePath(); x.fillStyle = fill; x.fill();
  }

  function meadow() {
    const [c, x] = canvas(), r = rng(7);
    x.fillStyle = vgrad(x, 0, 700, ['#2f7fe0', '#77b6f2', '#d7ecfb']); x.fillRect(0, 0, W, H);
    glow(x, 380, 170, 520, '255,250,225', 0.55);
    for (let i = 0; i < 9; i++) { const cx = r() * W, cy = 90 + r() * 300; for (let j = 0; j < 14; j++) glow(x, cx + (r() - 0.5) * 260, cy + (r() - 0.5) * 50, 40 + r() * 60, '255,255,255', 0.35); }
    hills(x, 640, 140, 0.4, vgrad(x, 450, 800, ['#8fb7a8', '#6f9a86']));
    hills(x, 760, 160, 2.2, vgrad(x, 600, 900, ['#7cb54a', '#4d8a2c']));
    hills(x, 900, 170, 4.1, vgrad(x, 720, H, ['#5ea83a', '#2e6b1d']));
    for (let i = 0; i < 2600; i++) {
      const t = Math.pow(r(), 0.7), y = 820 + t * (H - 820), px = r() * W, h = 6 + t * 26;
      x.strokeStyle = `rgba(${40 + r() * 60 | 0},${110 + r() * 70 | 0},${30 + r() * 30 | 0},.8)`; x.lineWidth = 1 + t * 1.5;
      x.beginPath(); x.moveTo(px, y); x.lineTo(px + (r() - 0.5) * 8, y - h); x.stroke();
      if (r() < 0.12) { x.fillStyle = ['#ffd23f', '#ffffff', '#ff6b9a', '#b58cff', '#ff8a3d'][r() * 5 | 0]; x.beginPath(); x.arc(px, y - h, 1.5 + t * 4, 0, Math.PI * 2); x.fill(); }
    }
    pine(x, 1480, 830, 360, '#1f4a22'); pine(x, 1560, 850, 300, '#23522a');
    return c;
  }

  function dunes() {
    const [c, x] = canvas(), r = rng(3);
    x.fillStyle = vgrad(x, 0, 720, ['#3d7fd1', '#8fc0ec', '#f3e3c4']); x.fillRect(0, 0, W, H);
    glow(x, 1320, 150, 420, '255,252,235', 0.8);
    const dune = (base, amp, s, top, bot, shade) => {
      x.beginPath(); x.moveTo(0, H);
      const pts = [];
      for (let px = 0; px <= W; px += 6) { const y = base - amp * Math.pow(0.5 + 0.5 * Math.sin(px * 0.0026 + s + Math.sin(px * 0.0011 + s) * 1.2), 1.6); pts.push([px, y]); x.lineTo(px, y); }
      x.lineTo(W, H); x.closePath(); x.fillStyle = vgrad(x, base - amp, H, [top, bot]); x.fill();
      x.save(); x.clip(); x.fillStyle = shade; // shadow side of each crest
      for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[i - 1][1]) x.fillRect(pts[i][0], pts[i][1], 6, 140);
      x.restore();
    };
    dune(720, 180, 0.3, '#e7b77c', '#d19a5c', 'rgba(150,80,40,.12)');
    dune(860, 220, 2.6, '#eaa865', '#c47f3f', 'rgba(130,60,25,.18)');
    dune(1060, 260, 5.0, '#f0b673', '#b86d31', 'rgba(110,45,15,.22)');
    for (let i = 0; i < 180; i++) { const y = 900 + r() * 300; x.fillStyle = 'rgba(120,60,20,.08)'; x.fillRect(r() * W, y, 60 + r() * 200, 2); }
    return c;
  }

  function city() {
    const [c, x] = canvas(), r = rng(41), GY = 900;
    x.fillStyle = vgrad(x, 0, GY, ['#050817', '#141a44', '#3a2c6a', '#b0527a']); x.fillRect(0, 0, W, GY);
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.6})`; x.fillRect(r() * W, r() * 500, 1.3, 1.3); }
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
    layer(20, 220, 560, '#0d0f24', 0.28);
    layer(40, 120, 300, '#07081a', 0.4);
    x.fillStyle = '#04050f'; x.fillRect(0, GY, W, H - GY);
    mirror(x, c, 0.6, 3);
    x.fillStyle = vgrad(x, GY, H, ['rgba(4,5,15,.2)', 'rgba(2,2,8,.9)']); x.fillRect(0, GY, W, H - GY);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,200,140,${r() * 0.18})`; x.fillRect(r() * W, GY + r() * (H - GY), 20 + r() * 90, 1.5); }
    return c;
  }

  function aurora() {
    const [c, x] = canvas(), r = rng(17);
    x.fillStyle = vgrad(x, 0, HZ, ['#01040c', '#04142a', '#0b2a3f']); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1100; i++) { x.globalAlpha = 0.2 + r() * 0.8; x.fillStyle = '#fff'; x.fillRect(r() * W, r() * HZ, 1.4, 1.4); }
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
    ridge(x, HZ + 2, 110, 6.1, '#0a1624');
    treeLine(x, HZ + 2, 110, 6.1, '#040a12', r, 20, 50);
    x.fillStyle = '#e8f0fa'; x.fillRect(0, HZ, W, H - HZ);
    mirror(x, c, 0.35, 4);
    x.fillStyle = vgrad(x, HZ, H, ['rgba(120,150,190,.25)', 'rgba(20,35,60,.75)']); x.fillRect(0, HZ, W, H - HZ);
    return c;
  }

  const make = { day, night, meadow, dunes, city, aurora };
  return Object.fromEntries(Object.keys(make).map(k => [k, () => cache[k] || (cache[k] = make[k]())]));
})();
