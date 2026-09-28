/* Lumen — UI layer. Depends on Engine (engine.js) and Scenes (scenes.js). */
(() => {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reflow = el => void el.offsetWidth;
  const restart = (el, cls) => { el.classList.remove(cls); reflow(el); el.classList.add(cls); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  // ---------- UI sound: sound.js synthesises, this only aims it ----------
  // Each sound is panned a touch toward the pointer, so a click seems to come from the control itself.
  let lastPX = innerWidth / 2;
  addEventListener('pointerdown', e => (lastPX = e.clientX), { capture: true, passive: true });
  addEventListener('pointermove', e => (lastPX = e.clientX), { passive: true });
  const sfx = (k, o) => Sound.play(k, { pan: (lastPX / Math.max(1, innerWidth) * 2 - 1) * 0.35, ...o });

  // ---------- Tools ----------
  const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    wand: I('<path d="M4 20 13.5 10.5" stroke-width="2.1"/><path d="m17.5 2.5 1.5 3.4 3.4 1.5-3.4 1.5-1.5 3.4-1.5-3.4L12.6 7.4l3.4-1.5z" fill="currentColor" stroke="none"/><path d="M6 3.6 6.8 5.4 8.6 6.2 6.8 7 6 8.8 5.2 7 3.4 6.2 5.2 5.4z" fill="currentColor" stroke="none"/><path d="M19.5 14.8 20.1 16.2 21.5 16.8 20.1 17.4 19.5 18.8 18.9 17.4 17.5 16.8 18.9 16.2z" fill="currentColor" stroke="none"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  const TOOLS = [
    { k: 'exposure', n: 'Экспозиция', g: 1, i: I('<path d="M12 3v18"/><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/><path d="M6 12h3M7.5 10.5v3" stroke-width="1.6"/><path d="M15 12h3" stroke="#000" stroke-width="1.6"/>') },
    { k: 'brilliance', n: 'Блеск', g: 1, i: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/><path d="M12 8a4 4 0 0 1 0 8z" fill="currentColor"/>') },
    { k: 'highlights', n: 'Света', g: 1, i: I('<circle cx="12" cy="12" r="9"/><path d="M5 9h14M4 12h16M5 15h14" opacity=".45"/><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z" fill="currentColor" stroke="none"/>') },
    { k: 'shadows', n: 'Тени', g: 1, i: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18a9 9 0 0 1-18 0z" fill="currentColor" stroke="none"/>') },
    { k: 'contrast', n: 'Контраст', g: 1, i: I('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>') },
    { k: 'brightness', n: 'Яркость', g: 1, i: I('<circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>') },
    { k: 'blacks', n: 'Точка чёрного', g: 1, i: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" fill="currentColor"/>') },
    { k: 'saturation', n: 'Насыщенность', g: 2, i: I('<path d="M12 3s6.5 6.6 6.5 11.2A6.5 6.5 0 0 1 5.5 14.2C5.5 9.6 12 3 12 3z"/><path d="M8.5 14.5a3.5 3.5 0 0 0 3.5 3.5" opacity=".6"/>') },
    { k: 'vibrance', n: 'Сочность', g: 2, i: I('<path d="M12 3s6.5 6.6 6.5 11.2A6.5 6.5 0 0 1 5.5 14.2C5.5 9.6 12 3 12 3z"/><path d="M5.8 13h12.4a6.5 6.5 0 0 1-12.4 0z" fill="currentColor" stroke="none"/>') },
    { k: 'warmth', n: 'Теплота', g: 2, i: I('<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><circle cx="12" cy="17.5" r="1.6" fill="currentColor"/>') },
    { k: 'tint', n: 'Оттенок', g: 2, i: I('<circle cx="9" cy="10" r="5"/><circle cx="15" cy="10" r="5"/><circle cx="12" cy="15" r="5"/>') },
    { k: 'hue', n: 'Тон цвета', min: -180, max: 180, g: 2, i: I('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>') },
    { k: 'sharpness', n: 'Резкость', min: 0, g: 3, i: I('<path d="M12 2 20 20H4z"/><path d="M12 9v6" opacity=".6"/>') },
    { k: 'clarity', n: 'Чёткость', g: 3, i: I('<path d="M12 2 4 7v10l8 5 8-5V7z"/><path d="M12 2v20M4 7l16 10M20 7 4 17" opacity=".45"/>') },
    { k: 'fade', n: 'Выцветание', min: 0, g: 4, i: I('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5" opacity=".5"/>') },
    { k: 'vignette', n: 'Виньетка', g: 4, i: I('<rect x="3" y="4" width="18" height="16" rx="4"/><ellipse cx="12" cy="12" rx="5" ry="4"/>') },
    { k: 'grain', n: 'Зерно', min: 0, g: 4, i: I('<circle cx="7" cy="7" r=".9" fill="currentColor"/><circle cx="12" cy="9" r=".9" fill="currentColor"/><circle cx="17" cy="6" r=".9" fill="currentColor"/><circle cx="8" cy="13" r=".9" fill="currentColor"/><circle cx="15" cy="13" r=".9" fill="currentColor"/><circle cx="11" cy="17" r=".9" fill="currentColor"/><circle cx="17" cy="18" r=".9" fill="currentColor"/><circle cx="6" cy="18" r=".9" fill="currentColor"/>') },
    { k: 'blur', n: 'Размытие', min: 0, g: 4, i: I('<circle cx="12" cy="12" r="8.5" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="3.5"/>') },
  ].map(t => ({ min: -100, max: 100, ...t }));
  const TOOL = Object.fromEntries(TOOLS.map(t => [t.k, t]));
  // Fun effects are 0–100 settings without a dial of their own in «Настройки» — like sepia and gray.
  const FUNS = [
    { k: 'jpeg', n: 'Шакалы', e: '🦊' }, { k: 'thermal', n: 'Тепловизор', e: '🌡️' }, { k: 'gameboy', n: 'Game Boy', e: '👾' },
    { k: 'vhs', n: 'VHS 1997', e: '📼' }, { k: 'acid', n: 'Кислота', e: '🍄' }, { k: 'pixel', n: 'Пиксели', e: '🧱' },
    { k: 'nightvision', n: 'ПНВ', e: '🥽' },
  ];
  const GRADE = { shHue: [0, 360], shSat: [0, 100], hiHue: [0, 360], hiSat: [0, 100], gBal: [-100, 100] };
  const ADJ = [...TOOLS.map(t => t.k), 'sepia', 'gray', ...FUNS.map(f => f.k), ...Object.keys(GRADE)];
  const LIM = Object.fromEntries(ADJ.map(k => [k, TOOL[k] ? [TOOL[k].min, TOOL[k].max] : GRADE[k] || [0, 100]]));
  const NAME = { ...Object.fromEntries(TOOLS.map(t => [t.k, t.n])), ...Object.fromEntries(FUNS.map(f => [f.k, f.n])), sepia: 'Сепия', gray: 'Ч/Б',
    shHue: 'Тон теней', shSat: 'Тонирование теней', hiHue: 'Тон светов', hiSat: 'Тонирование светов', gBal: 'Баланс тонирования' };
  const TAB = { adj: 0, filters: 1, color: 2, crop: 3, draw: 4, fun: 5 };

  const PRESETS = [
    { id: 'none', n: 'Оригинал', v: {} },
    { id: 'vivid', n: 'Яркий', v: { saturation: 22, vibrance: 28, contrast: 14, brilliance: 12 } },
    { id: 'vwarm', n: 'Яркий тёплый', v: { vibrance: 26, saturation: 14, warmth: 30, contrast: 12 } },
    { id: 'vcool', n: 'Яркий холодный', v: { vibrance: 26, saturation: 14, warmth: -30, contrast: 12 } },
    { id: 'drama', n: 'Драматичный', v: { contrast: 38, highlights: -40, shadows: -12, saturation: -25, clarity: 35, vignette: 40 } },
    { id: 'dwarm', n: 'Драм. тёплый', v: { contrast: 34, highlights: -35, saturation: -10, clarity: 30, warmth: 35, vignette: 35 } },
    { id: 'cine', n: 'Кино', v: { warmth: -14, tint: -10, contrast: 24, shadows: 16, saturation: -12, hue: -8, vignette: 26, fade: 8 } },
    { id: 'matte', n: 'Матовый', v: { fade: 42, contrast: -14, saturation: -14, clarity: 14 } },
    { id: 'mono', n: 'Моно', v: { gray: 100, contrast: 10 } },
    { id: 'silver', n: 'Серебристый', v: { gray: 100, fade: 30, exposure: 8, contrast: -10 } },
    { id: 'noir', n: 'Нуар', v: { gray: 100, contrast: 58, blacks: 30, clarity: 40, vignette: 55, grain: 20 } },
    { id: 'vintage', n: 'Винтаж', v: { sepia: 42, fade: 34, grain: 34, vignette: 30, contrast: -8 } },
    { id: 'film', n: 'Плёнка', v: { grain: 45, fade: 18, contrast: 14, warmth: 12, saturation: -12, highlights: -20 } },
    { id: 'dream', n: 'Мечта', v: { blur: 10, fade: 20, exposure: 12, tint: 15, saturation: 12, highlights: -15 } },
    { id: 'fried', n: 'Зажарка', fun: true, v: { jpeg: 55, saturation: 70, contrast: 50, sharpness: 70, warmth: 18 } },
    { id: 'tape', n: 'Кассета', fun: true, v: { vhs: 85, fade: 12, saturation: -10 } },
    { id: 'thermo', n: 'Хищник', fun: true, v: { thermal: 100, contrast: 10 } },
    { id: 'gb', n: 'Game Boy', fun: true, v: { gameboy: 100, contrast: 12 } },
    { id: 'trip', n: 'Трип', fun: true, v: { acid: 70, saturation: 20, vignette: 20 } },
    { id: 'spy', n: 'Шпион', fun: true, v: { nightvision: 100 } },
  ];

  const zeroAdj = () => Object.fromEntries(ADJ.map(k => [k, 0]));
  // ox/oy slide the crop window within whatever slack the aspect leaves — see Engine.paintGeo.
  const fresh = () => ({ ...zeroAdj(), rot: 0, flipH: false, flipV: false, straighten: 0, aspect: 'orig', ox: 0, oy: 0, preset: 'none', amt: 100, ink: [],
    curve: Tone.freshCurve(), hsl: Tone.freshHsl(), meme: { top: '', bottom: '' } });
  const GEOM = ['rot', 'flipH', 'flipV', 'straighten', 'aspect', 'ox', 'oy'];
  const geomSame = (a, b) => GEOM.every(k => a[k] === b[k]);

  let state = fresh(), hist = [fresh()], hi = 0, cur = 'exposure', tab = 0;
  let fullImg = null, src = null, srcName = '';
  let userPresets = store.get('lumen.presets', []);

  // ---------- App settings (accent, motion, preview quality) ----------
  const ACCENTS = [
    { id: 'gold', c: '#ffd60a', ink: '#1c1500', n: 'Золото' },
    { id: 'blue', c: '#0a84ff', ink: '#f2f8ff', n: 'Океан' },
    { id: 'pink', c: '#ff375f', ink: '#fff1f4', n: 'Закат' },
    { id: 'green', c: '#30d158', ink: '#04240e', n: 'Мята' },
    { id: 'purple', c: '#bf5af2', ink: '#fdf3ff', n: 'Сирень' },
  ];
  const QUALITY = [1200, 1800, 2400];
  const FONTS = ['modern', 'compact', 'creative'];
  const THEMES = ['system', 'light', 'dark'];
  const THEME_N = { system: 'системная', light: 'светлая', dark: 'тёмная' };
  const AMBIENTS = [
    { id: 'auto', n: 'Авто (из фото)', c: 'conic-gradient(from 210deg,#5e5ce6,#ff375f,#ff9f0a,#5e5ce6)' },
    { id: 'aurora', n: 'Сияние', c: 'linear-gradient(135deg,#0f2027,#2c5364 55%,#00c6ff)' },
    { id: 'sunset', n: 'Закат', c: 'linear-gradient(135deg,#ff512f,#dd2476)' },
    { id: 'ocean', n: 'Океан', c: 'linear-gradient(135deg,#005c97,#363795)' },
    { id: 'mint', n: 'Мята', c: 'linear-gradient(135deg,#11998e,#38ef7d)' },
    { id: 'grape', n: 'Виноград', c: 'linear-gradient(135deg,#654ea3,#eaafc8)' },
    { id: 'slate', n: 'Графит', c: 'linear-gradient(135deg,#232526,#414345)' },
  ];
  const DEF_SET = { theme: 'system', accent: 'gold', accentHex: '#ffc53d', font: 'modern', ambient: true, ambientStyle: 'auto', anim: true, tips: true, quality: 1800, promo: true, dice: 7,
    sound: true, volume: 70, pack: 'mech' };
  let settings = { ...DEF_SET, ...store.get('lumen.settings', {}) };
  // Storage is user-editable, so every field is coerced back into range before it reaches the UI.
  if (!/^#[0-9a-f]{6}$/i.test(String(settings.accentHex))) settings.accentHex = DEF_SET.accentHex;
  if (settings.accent !== 'custom' && !ACCENTS.some(a => a.id === settings.accent)) settings.accent = DEF_SET.accent;
  if (!FONTS.includes(settings.font)) settings.font = DEF_SET.font;
  if (!THEMES.includes(settings.theme)) settings.theme = DEF_SET.theme;
  if (!QUALITY.includes(settings.quality)) settings.quality = DEF_SET.quality;
  if (!AMBIENTS.some(a => a.id === settings.ambientStyle)) settings.ambientStyle = DEF_SET.ambientStyle;
  settings.dice = clamp(Math.round(+settings.dice || DEF_SET.dice), 3, 14);
  ['ambient', 'anim', 'tips', 'promo', 'sound'].forEach(k => (settings[k] = settings[k] !== false));
  settings.volume = clamp(Math.round(Number.isFinite(+settings.volume) ? +settings.volume : DEF_SET.volume), 0, 100);
  if (!Sound.PACKS.some(x => x.id === settings.pack)) settings.pack = DEF_SET.pack;

  const allPresets = () => [...PRESETS, ...userPresets];
  const presetById = id => allPresets().find(p => p.id === id) || PRESETS[0];
  function effective(s) {
    const p = presetById(s.preset).v, a = s.amt / 100, o = {};
    GEOM.forEach(k => (o[k] = s[k]));
    for (const k of ADJ) o[k] = clamp((s[k] || 0) + (p[k] || 0) * a, LIM[k][0], LIM[k][1]);
    // Curves, HSL and toning leave as engine-ready arrays; the curve table is rebuilt only when it changes.
    const c = s.curve || Tone.freshCurve();
    if (!Tone.curveIsIdentity(c)) { o.lutKey = JSON.stringify(c); o.lut = lutFor(o.lutKey, c); }
    if (s.hsl && !Tone.hslIsZero(s.hsl)) o.hslU = Tone.hslUniform(s.hsl);
    o.shT = Tone.tint(o.shHue, o.shSat); o.hiT = Tone.tint(o.hiHue, o.hiSat);
    return o;
  }
  let lutMemo = ['', null];
  const lutFor = (k, c) => (lutMemo[0] === k ? lutMemo[1] : (lutMemo = [k, Tone.lut(c)])[1]);

  // ---------- Preview rendering ----------
  let PREVIEW = settings.quality;
  const cv = $('#cv'), fx = $('#fx'), orig = $('#orig'), photo = $('#photo'), stage = $('#stage'), ink = $('#ink');
  let raf = 0, liveStroke = null, clipOn = false, scopeDirty = true;
  const scopeCv = document.createElement('canvas');
  /** The preview as pixels for histograms and the colour picker — without the clipping overlay painted in. */
  function frameCv() {
    if (!clipOn) return cv;
    if (scopeDirty) { Engine.render(scopeCv, src, effective(state), PREVIEW); scopeDirty = false; }
    return scopeCv;
  }
  const split = { on: false, x: 0.5, key: '' };
  const draw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawNow); };
  function drawNow() {
    if (!src) return;
    const w = cv.width, h = cv.height;
    Engine.render(cv, src, { ...effective(state), clip: clipOn }, PREVIEW);
    scopeDirty = true;
    if (cv.width !== w || cv.height !== h) fit();
    paintInk();
    schedHist();
    if (split.on) renderSplit();
    if (tab === TAB.color) schedCurve();
  }
  function paintInk() {
    if (ink.width !== cv.width || ink.height !== cv.height) { ink.width = cv.width; ink.height = cv.height; }
    paintLayer(ink.getContext('2d'), ink.width, ink.height, liveStroke ? [...state.ink, liveStroke] : state.ink);
  }
  /** Strokes and stickers, then meme captions and the VHS stamp — the same for preview and export. */
  function paintLayer(x, w, h, strokes) {
    Brush.render(x, strokes, w, h);
    Fun.overlay(x, w, h, { meme: state.meme, vhs: effective(state).vhs });
  }
  const hasLayer = () => state.ink.length > 0 || !!(state.meme.top || state.meme.bottom) || effective(state).vhs > 20;
  /** Engine render + drawing layer, used by export. */
  function renderFull(out, img, size) {
    Engine.render(out, img, effective(state), size);
    if (!hasLayer()) return out;
    const l = document.createElement('canvas');
    l.width = out.width; l.height = out.height;
    paintLayer(l.getContext('2d'), l.width, l.height, state.ink);
    out.getContext('2d').drawImage(l, 0, 0);
    return out;
  }
  function fit() {
    if (!cv.width) return;
    const r = stage.getBoundingClientRect();
    const k = Math.min((r.width - 8) / cv.width, (r.height - 8) / cv.height);
    photo.style.width = Math.floor(cv.width * k) + 'px';
    photo.style.height = Math.floor(cv.height * k) + 'px';
  }
  new ResizeObserver(fit).observe(stage);

  /** Snapshot the current frame and fade it out over the new render. */
  function crossfade(fn) {
    if (!cv.width) { fn(); drawNow(); return; }
    fx.width = cv.width; fx.height = cv.height;
    fx.getContext('2d').drawImage(cv, 0, 0);
    fx.style.transition = 'none'; fx.style.opacity = 1; reflow(fx);
    fn(); cancelAnimationFrame(raf); drawNow();
    requestAnimationFrame(() => { fx.style.transition = ''; fx.style.opacity = 0; });
  }
  const bump = () => restart(photo, 'bump');

  let tw = 0;
  function tweenTo(target, dur, done) {
    cancelAnimationFrame(tw);
    const from = { ...state }, keys = Object.keys(target), t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4);
      keys.forEach(k => (state[k] = t >= 1 ? target[k] : from[k] + (target[k] - from[k]) * e));
      syncUI(); drawNow();
      if (t < 1) tw = requestAnimationFrame(step); else if (done) done();
    };
    tw = requestAnimationFrame(step);
  }

  // ---------- Ambient backdrop ----------
  const ambs = [$('#ambA'), $('#ambB')];
  let ambI = 0, ambT = 0;
  function ambient() {
    if (!src) return;
    const t = document.createElement('canvas');
    Engine.render(t, src, effective(state), 64);
    const next = ambs[ambI ^= 1], prev = ambs[ambI ^ 1];
    next.style.backgroundImage = `url(${t.toDataURL()})`;
    next.classList.add('on'); prev.classList.remove('on');
  }
  // Backdrop is painted once per image: re-rendering it on every edit made the whole background flash.

  // ---------- History ----------
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Every history entry carries a readable label for the history panel, kept in a parallel array
  // so the entries themselves stay plain states that `same()` can compare.
  let labels = ['Открыто'];
  function commit(label) {
    if (same(state, hist[hi])) return;
    hist = hist.slice(0, hi + 1); labels = labels.slice(0, hi + 1);
    labels.push(label || describe(hist[hi], state));
    hist.push({ ...state });
    if (hist.length > 100) { hist.shift(); labels.shift(); }
    hi = hist.length - 1;
    updHist();
    checkState();
  }
  function go(d) {
    cancelAnimationFrame(tw); // a dice/auto/fry tween still running would write its values back over the jump
    commit(); // flush an edit still waiting on a debounced commit (wheel / arrow keys)
    goTo(hi + d);
  }
  function goTo(n) {
    if (n < 0 || n >= hist.length || n === hi) return;
    cancelAnimationFrame(tw);
    const prev = state, back = n < hi;
    hi = n;
    if (geomSame(prev, hist[n])) crossfade(() => (state = { ...hist[n] }));
    else { state = { ...hist[n] }; drawNow(); bump(); }
    syncUI(); updHist();
    sfx(back ? 'undo' : 'redo');
    if (back && bumpStat('undos') >= 30) award('time');
  }
  function updHist() {
    $('#undo').disabled = hi === 0; $('#redo').disabled = hi === hist.length - 1;
    if (histPop.classList.contains('open')) renderHistList();
    updStatus();
  }
  const fmtDeg = v => String(+(+v).toFixed(1)).replace('-', '−') + '°';
  /** What changed between two states, in words — used when a commit brings no label of its own. */
  function describe(a, b) {
    if (!a) return 'Правка';
    if (b.preset !== a.preset) return `Фильтр: ${presetById(b.preset).n}`;
    if (b.amt !== a.amt) return `Интенсивность ${Math.round(b.amt)}`;
    if (b.ink.length > a.ink.length) { const k = b.ink[b.ink.length - 1]; return k.t === 'sticker' ? `Стикер ${k.e}` : k.t === 'eraser' ? 'Ластик' : k.t === 'marker' ? 'Фломастер' : 'Штрих кистью'; }
    if (b.ink.length < a.ink.length) return b.ink.length ? 'Убран штрих' : 'Рисунок очищен';
    if (b.rot !== a.rot) return 'Поворот на 90°';
    if (b.flipH !== a.flipH || b.flipV !== a.flipV) return 'Отражение';
    if (b.aspect !== a.aspect) return `Пропорции: ${b.aspect === 'orig' ? 'исходные' : b.aspect}`;
    if (b.straighten !== a.straighten) return `Выпрямление ${fmtDeg(b.straighten)}`;
    if (b.ox !== a.ox || b.oy !== a.oy) return 'Сдвиг кадра';
    if (!same(a.curve, b.curve)) return 'Кривые';
    if (!same(a.hsl, b.hsl)) return 'HSL-микшер';
    if (!same(a.meme, b.meme)) return 'Мем-текст';
    const ch = ADJ.filter(k => Math.round(a[k]) !== Math.round(b[k]));
    if (ch.length === 1) return `${NAME[ch[0]]} ${GRADE[ch[0]] ? Math.round(b[ch[0]]) : fmt(b[ch[0]])}`;
    if (ch.length) return `${ch.length} ${plural(ch.length, 'настройка', 'настройки', 'настроек')}`;
    return 'Правка';
  }

  // Same detent click as the dial, for plain <input type=range> sliders (brush, export, dice).
  const rangeLast = new WeakMap();
  function rangeTick(el) {
    const lo = +el.min || 0, hi = +el.max || 100, det = Math.max(+el.step || 1, (hi - lo) / 100);
    const prev = rangeLast.get(el) ?? +el.value, cur = +el.value;
    if (Math.floor(prev / det) !== Math.floor(cur / det)) sfx('tick', { rate: 0.9 + 0.22 * (cur - lo) / (hi - lo || 1), gain: 0.7 });
    rangeLast.set(el, cur);
  }

  // ---------- Dial (ruler scrubber with momentum) ----------
  function Dial(el, o) {
    el.innerHTML = '<div class="rail"><div class="ticks"></div><div class="major"></div><div class="fill"></div><div class="zero"></div></div><div class="needle"></div>';
    el.tabIndex = 0;
    const rail = el.querySelector('.rail'), fill = el.querySelector('.fill'), zero = el.querySelector('.zero');
    const RW = 600;
    let min = o.min, max = o.max, step = o.step || 1, v = o.value || 0, ppu = RW / (max - min);
    let drag = false, sx = 0, sv = 0, lastX = 0, lastT = 0, vel = 0, mom = 0, wacc = null, wt = 0;
    const q = x => Math.round(clamp(x, min, max) / step) * step;
    function place(anim) {
      rail.classList.toggle('anim', !!anim);
      rail.style.transform = `translateX(${el.clientWidth / 2 - (v - min) * ppu}px)`;
      const z = (clamp(0, min, max) - min) * ppu, p = (v - min) * ppu, a = Math.min(z, p);
      fill.style.left = a + 'px'; fill.style.width = Math.abs(p - z) + 'px'; fill.style.backgroundPosition = `${-a}px 0`;
      zero.style.left = z + 'px';
    }
    const detent = () => Math.max(step, (max - min) / 100);
    function setV(nv) {
      nv = q(nv);
      if (nv === v) return;
      const crossedZero = min < 0 && nv === 0 && v !== 0;
      const det = detent(), crossedDetent = Math.floor(v / det) !== Math.floor(nv / det);
      v = nv; place(false); o.onInput(v);
      if (crossedZero) { restart(el, 'snap'); sfx('zero'); }
      else if (crossedDetent) sfx('tick', { rate: 0.9 + 0.22 * (v - min) / (max - min), gain: Math.min(1.3, Math.abs(vel) * 2 || 0.6) });
    }
    el.addEventListener('pointerdown', e => {
      cancelAnimationFrame(mom); wacc = null;
      drag = true; sx = lastX = e.clientX; sv = v; lastT = e.timeStamp; vel = 0;
      el.setPointerCapture(e.pointerId); el.classList.add('active');
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      let nv = sv - (e.clientX - sx) / ppu;
      if (min < 0 && Math.abs(nv * ppu) < 5) nv = 0; // magnetic zero
      const dt = Math.max(1, e.timeStamp - lastT);
      vel = (e.clientX - lastX) / dt * 0.8 + vel * 0.2;
      lastX = e.clientX; lastT = e.timeStamp;
      setV(nv);
    });
    const end = e => {
      if (!drag) return;
      drag = false; el.classList.remove('active');
      if (Math.abs(vel) > 0.35 && e.timeStamp - lastT < 80) {
        let vv = vel * 16, fv = v;
        const tick = () => {
          vv *= 0.92; fv -= vv / ppu;
          if (fv <= min || fv >= max) vv = 0;
          setV(fv);
          if (Math.abs(vv) > 0.3) mom = requestAnimationFrame(tick); else o.onChange(v);
        };
        mom = requestAnimationFrame(tick);
      } else o.onChange(v);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => api.animateTo(o.def ?? 0));
    el.addEventListener('wheel', e => {
      e.preventDefault(); cancelAnimationFrame(mom);
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wacc = (wacc ?? v) + d * 0.08 * (max - min) / 200;
      wacc = clamp(wacc, min, max);
      setV(wacc);
      clearTimeout(wt); wt = setTimeout(() => { wacc = null; o.onChange(v); }, 350);
    }, { passive: false });
    el.addEventListener('keydown', e => {
      const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      setV(v + d * step * (e.shiftKey ? 10 : 1));
      clearTimeout(wt); wt = setTimeout(() => o.onChange(v), 300);
    });
    new ResizeObserver(() => place(false)).observe(el);
    const api = {
      set(nv, anim) { v = q(nv); place(anim); },
      range(a, b, nv, s) { min = a; max = b; step = s || 1; ppu = RW / (max - min); v = q(nv); place(true); },
      animateTo(t) {
        cancelAnimationFrame(mom);
        const f = v, t0 = performance.now();
        const tick = now => {
          const k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3);
          setV(f + (t - f) * e);
          if (k < 1) mom = requestAnimationFrame(tick); else o.onChange(v);
        };
        mom = requestAnimationFrame(tick);
      },
      get value() { return v; },
    };
    place(false);
    return api;
  }

  // ---------- Horizontal scrollers: wheel, drag, arrows, edge fades ----------
  function hscroll(wrap) {
    const el = wrap.querySelector('.hs');
    const upd = () => {
      const max = el.scrollWidth - el.clientWidth - 2;
      wrap.classList.toggle('can-l', el.scrollLeft > 2);
      wrap.classList.toggle('can-r', el.scrollLeft < max);
    };
    el.addEventListener('scroll', upd, { passive: true });
    new ResizeObserver(upd).observe(el);
    new MutationObserver(upd).observe(el, { childList: true });
    el.addEventListener('wheel', e => {
      if (el.scrollWidth <= el.clientWidth) return;
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!raw) return;
      e.preventDefault();
      // deltaMode: 0 = pixels (most trackpads/mice), 1 = lines (some mice/Firefox), 2 = pages.
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? el.clientWidth : 1;
      const d = raw * unit * 1.4;
      el.scrollBy({ left: d, behavior: Math.abs(d) >= 40 ? 'smooth' : 'auto' });
    }, { passive: false });
    let down = false, sx = 0, sl = 0, dragged = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragged = false; sx = e.clientX; sl = el.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!dragged && Math.abs(dx) > 6) { dragged = true; el.classList.add('dragging'); }
      if (dragged) el.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false; el.classList.remove('dragging');
      setTimeout(() => (dragged = false), 0);
    });
    el.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    wrap.querySelector('.arr.l').onclick = () => el.scrollBy({ left: -el.clientWidth * 0.7, behavior: 'smooth' });
    wrap.querySelector('.arr.r').onclick = () => el.scrollBy({ left: el.clientWidth * 0.7, behavior: 'smooth' });
    upd();
  }
  $$('.scroller').forEach(hscroll);
  const centerIn = (el) => el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  // ---------- Tabs ----------
  const seg = $('#seg');
  function setTab(t) {
    tab = t;
    $$('#seg button').forEach(b => b.classList.toggle('on', +b.dataset.tab === t));
    seg.querySelector('.pill').style.transform = `translateX(${t * 100}%)`;
    $$('.panel').forEach(p => p.classList.toggle('on', +p.dataset.panel === t));
    photo.classList.toggle('drawing', t === TAB.draw);
    if (t !== TAB.fun) stickerMode(null);
    if (t === TAB.filters) setTimeout(() => centerIn($('.thumb.on')), 60);
    if (t === TAB.color) requestAnimationFrame(() => drawCurve(true));
    if (t === TAB.fun) setTimeout(() => centerIn($('.chip.on', funChips)), 60);
  }
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b && +b.dataset.tab !== tab) { sfx('select'); setTab(+b.dataset.tab); } });

  // ---------- Adjust panel ----------
  const chips = $('#chips'), val = $('#val'), lbl = $('#lbl');
  const fmt = v => { const r = Math.round(v); return (r > 0 ? '+' : '') + r; };
  (function renderChips() {
    let html = `<button class="chip auto" id="autoChip" data-tip="Автоулучшение"><div class="ring">${ICON.wand}</div><span class="nm">Авто</span></button>`;
    let g = 0;
    TOOLS.forEach(t => {
      if (t.g !== g) { html += '<span class="csep"></span>'; g = t.g; }
      html += `<button class="chip" data-k="${t.k}"><div class="ring"><span class="ic">${t.i}</span><span class="num"></span>` +
        `<svg class="arc" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26"/></svg></div><span class="nm">${t.n}</span></button>`;
    });
    chips.innerHTML = html;
  })();
  const dialAdj = Dial($('#dialAdj'), {
    min: -100, max: 100, value: 0,
    onInput: v => { state[cur] = v; val.textContent = fmt(v); updChips(); draw(); },
    onChange: () => commit(),
  });
  chips.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    if (c.id === 'autoChip') return autoEnhance();
    if (c.dataset.k !== cur) sfx('select');
    selectTool(c.dataset.k, true);
  });
  chips.addEventListener('dblclick', e => {
    const c = e.target.closest('.chip[data-k]');
    if (c && c.dataset.k === cur) dialAdj.animateTo(0);
  });
  $('#resetOne').onclick = () => dialAdj.animateTo(0);

  function selectTool(k, anim) {
    const t = TOOL[k];
    const changed = k !== cur;
    cur = k;
    $$('.chip[data-k]').forEach(c => c.classList.toggle('on', c.dataset.k === k));
    lbl.textContent = t.n;
    val.textContent = fmt(state[k]);
    if (changed || anim) dialAdj.range(t.min, t.max, state[k]); else dialAdj.set(state[k]);
    if (anim) { restart($('#adjHead'), 'swap'); centerIn($(`.chip[data-k="${k}"]`)); }
  }
  function updChips() {
    TOOLS.forEach(t => {
      const c = chips.querySelector(`[data-k="${t.k}"]`), v = state[t.k];
      const f = Math.abs(v) / Math.max(Math.abs(t.min), t.max);
      const arc = c.querySelector('.arc');
      arc.querySelector('circle').style.strokeDashoffset = 163.4 * (1 - f);
      arc.classList.toggle('neg', v < 0);
      c.classList.toggle('has', Math.round(v) !== 0);
      c.querySelector('.num').textContent = fmt(v);
    });
    $('#resetOne').classList.toggle('show', Math.round(state[cur]) !== 0);
  }

  function autoValues() {
    const t = document.createElement('canvas');
    Engine.render(t, src, { ...effective(state), ...zeroAdj() }, 220, true);
    const d = t.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, t.width, t.height).data;
    const L = [], S = [];
    for (let i = 0; i < d.length; i += 16) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      L.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      S.push(Math.max(r, g, b) - Math.min(r, g, b));
    }
    L.sort((a, b) => a - b);
    const p = f => L[Math.min(L.length - 1, Math.floor(f * L.length))];
    const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
    const p1 = p(0.01), p10 = p(0.1), p50 = p(0.5), p90 = p(0.9), p99 = p(0.99);
    const ev = Math.log2(0.46 / Math.max(0.04, p50)) / 1.5 * 100;
    return {
      exposure: Math.round(clamp(ev * 0.75, -60, 60)),
      shadows: Math.round(clamp((0.14 - p10) * 280, 0, 45)),
      highlights: Math.round(p99 > 0.95 ? clamp(-(p99 - 0.88) * 320, -50, 0) : 0),
      blacks: Math.round(p1 > 0.05 ? clamp(p1 * 260, 0, 30) : 0),
      contrast: Math.round(clamp((0.6 - (p90 - p10)) * 70, 0, 25)),
      vibrance: mean(S) < 0.22 ? 28 : 14,
      brilliance: 12,
    };
  }
  function autoEnhance() {
    const a = autoValues(), c = $('#autoChip');
    restart(c, 'spark');
    tweenTo(a, 700, () => { commit('Автоулучшение'); sfx('success'); toast('Автоулучшение применено'); });
  }

  // ---------- Filters panel ----------
  const thumbs = $('#thumbs');
  const dialAmt = Dial($('#dialAmt'), {
    min: 0, max: 100, value: 100, def: 100,
    onInput: v => { state.amt = v; $('#amtVal').textContent = Math.round(v); draw(); },
    onChange: () => commit(),
  });
  function thumbEl(p, user) {
    const b = document.createElement('button');
    b.className = 'thumb' + (user ? ' user' : '');
    b.dataset.id = p.id;
    const c = document.createElement('canvas');
    Engine.render(c, src, { ...fresh(), ...p.v, aspect: '1:1' }, 170);
    b.append(c);
    b.insertAdjacentHTML('beforeend', `<span>${esc(p.n)}</span>`);
    if (user) {
      const x = document.createElement('i');
      x.className = 'del'; x.innerHTML = ICON.x; x.title = 'Удалить пресет';
      x.addEventListener('click', e => { e.stopPropagation(); deletePreset(p.id, b); });
      b.append(x);
    }
    return b;
  }
  function buildThumbs() {
    thumbs.innerHTML = '';
    const add = document.createElement('button');
    add.className = 'thumb add'; add.dataset.tip = 'Сохранить текущий вид как пресет';
    add.innerHTML = `<div class="tile-add">${ICON.plus}</div><span>Новый</span>`;
    add.addEventListener('click', openPresetModal);
    bindTip(add);
    thumbs.append(add);
    PRESETS.forEach(p => {
      if (p.fun && !thumbs.querySelector('.tsep.fun')) { const s = document.createElement('span'); s.className = 'tsep fun'; thumbs.append(s); }
      thumbs.append(thumbEl(p));
    });
    if (userPresets.length) {
      const s = document.createElement('span'); s.className = 'tsep'; thumbs.append(s);
      userPresets.forEach(p => thumbs.append(thumbEl(p, true)));
    }
    markThumbs();
  }
  function markThumbs() {
    $$('.thumb[data-id]').forEach(t => t.classList.toggle('on', t.dataset.id === state.preset));
    $('#amtRow').classList.toggle('show', state.preset !== 'none');
    $('#amtLbl').textContent = state.preset === 'none' ? 'Интенсивность' : presetById(state.preset).n;
  }
  thumbs.addEventListener('click', e => {
    const b = e.target.closest('.thumb[data-id]');
    if (!b || b.dataset.id === state.preset) return;
    sfx('select');
    crossfade(() => { state.preset = b.dataset.id; state.amt = 100; });
    syncUI(); commit();
    if (b.dataset.id === 'noir') award('noir');
  });

  // ---------- Custom presets ----------
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  let pendingPreset = null;
  function openPresetModal() {
    const eff = effective(state);
    const v = {};
    ADJ.forEach(k => { const r = Math.round(eff[k]); if (r) v[k] = r; });
    const n = Object.keys(v).length;
    pendingPreset = v;
    Engine.render($('#presetPrev'), src, { ...fresh(), ...v, aspect: '1:1' }, 300);
    $('#presetName').value = `Мой пресет ${userPresets.length + 1}`;
    $('#presetInfo').textContent = n ? `Сохранит ${n} ${plural(n, 'настройку', 'настройки', 'настроек')}` : 'Сначала измените настройки или выберите фильтр';
    $('#presetSave').disabled = !n;
    openModal('#presetModal');
    setTimeout(() => { $('#presetName').focus(); $('#presetName').select(); }, 120);
  }
  function savePreset() {
    if (!pendingPreset || !Object.keys(pendingPreset).length) return;
    const name = $('#presetName').value.trim() || `Мой пресет ${userPresets.length + 1}`;
    const p = { id: 'u' + Date.now().toString(36), n: name, v: pendingPreset };
    userPresets.push(p);
    store.set('lumen.presets', userPresets);
    Object.assign(state, zeroAdj(), { preset: p.id, amt: 100 });
    closeModal();
    buildThumbs(); syncUI(); commit();
    if (tab !== 1) setTab(1);
    const el = thumbs.querySelector(`[data-id="${p.id}"]`);
    el.classList.add('new');
    setTimeout(() => centerIn(el), 80);
    toast(`Пресет «${name}» сохранён`);
  }
  function deletePreset(id, el) {
    const idx = userPresets.findIndex(p => p.id === id);
    if (idx < 0) return;
    const [p] = userPresets.splice(idx, 1);
    store.set('lumen.presets', userPresets);
    const wasActive = state.preset === id;
    el.classList.add('bye');
    setTimeout(() => {
      if (wasActive) { crossfade(() => (state.preset = 'none')); commit(); }
      buildThumbs(); syncUI();
    }, 320);
    toast(`Пресет «${p.n}» удалён`, 'Вернуть', () => {
      userPresets.splice(idx, 0, p);
      store.set('lumen.presets', userPresets);
      buildThumbs(); syncUI();
    });
  }
  $('#presetSave').onclick = savePreset;
  $('#presetCancel').onclick = closeModal;
  $('#presetName').addEventListener('keydown', e => { if (e.key === 'Enter') savePreset(); });

  // ---------- Crop panel ----------
  const dialStr = Dial($('#dialStr'), {
    min: -45, max: 45, step: 0.5, value: 0,
    onInput: v => { state.straighten = v; $('#sval').textContent = v.toFixed(1).replace('.0', '').replace('-', '−') + '°'; draw(); },
    onChange: () => commit(),
  });
  $$('[data-act]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'rotL') state.rot = (state.rot + 3) % 4;
    if (a === 'flipH') state.flipH = !state.flipH;
    if (a === 'flipV') state.flipV = !state.flipV;
    drawNow(); bump(); commit();
  }));
  $('#aspects').addEventListener('click', e => {
    const b = e.target.closest('[data-aspect]');
    if (!b || b.dataset.aspect === state.aspect) return;
    sfx('select');
    state.aspect = b.dataset.aspect;
    state.ox = 0; state.oy = 0; // a new ratio starts centred; «Умная обрезка» moves it from there
    syncUI(); drawNow(); commit();
  });

  // ---------- Smart crop ----------
  const RATIOS = ['1:1', '4:5', '3:2', '16:9', '9:16'];
  $('#smartCrop').onclick = () => {
    if (!src) return;
    // Geometry only (no colour, no blur), the whole frame: that is what the crop slides over.
    const c = document.createElement('canvas');
    Engine.render(c, src, { ...effective(state), aspect: 'orig', ox: 0, oy: 0, blur: 0 }, 380, true);
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    const map = Analysis.energyMap(d.data, c.width, c.height, 44, 44);
    const imgRatio = c.width / c.height;

    let aspect = state.aspect, best = null;
    if (aspect === 'orig') {
      // Nothing is cropped at «Исходные», so pick the ratio whose frame is densest in detail,
      // with a penalty that keeps it from throwing half the picture away for a small gain.
      let bestScore = -Infinity;
      for (const a of RATIOS) {
        const r = Engine.ASPECTS[a];
        const res = Analysis.smartCrop(map, r, imgRatio);
        const area = (imgRatio > r ? r / imgRatio : 1) * (imgRatio > r ? 1 : imgRatio / r);
        const score = res.keep / area - (1 - area) * 0.5;
        if (score > bestScore) { bestScore = score; aspect = a; best = res; }
      }
    } else best = Analysis.smartCrop(map, Engine.ASPECTS[aspect] || imgRatio, imgRatio);

    const same2 = aspect === state.aspect && Math.abs(best.ox - state.ox) < 0.02 && Math.abs(best.oy - state.oy) < 0.02;
    if (same2) return toast('Кадр уже собран по содержимому');
    const from = { ox: state.ox, oy: state.oy };
    if (aspect !== state.aspect) crossfade(() => { state.aspect = aspect; state.ox = from.ox; state.oy = from.oy; });
    syncUI();
    tweenTo({ ox: best.ox, oy: best.oy }, 520, () => {
      commit('Умная обрезка');
      toast(`Кадр ${aspect === 'orig' ? 'подобран' : aspect} · сохранено ${Math.round(best.keep * 100)}% деталей`, 'Отменить', () => go(-1));
    });
  };

  // ---------- Zoom & pan ----------
  let zoom = 1, panX = 0, panY = 0, panning = null;
  function clampPan() {
    if (zoom <= 1) { panX = panY = 0; return; }
    const w = photo.offsetWidth * (zoom - 1) / 2, h = photo.offsetHeight * (zoom - 1) / 2;
    panX = clamp(panX, -w, w); panY = clamp(panY, -h, h);
  }
  function applyZoom() {
    photo.style.transform = zoom === 1 ? '' : `translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(3)})`;
    $('#zoomVal').textContent = Math.round(zoom * 100) + '%';
    $('#zoomBar').classList.toggle('on', zoom !== 1);
    $('#zoomOut').disabled = zoom <= 1;
    $('#zoomIn').disabled = zoom >= 8;
    stage.classList.toggle('zoomed', zoom > 1);
  }
  /** Zoom around a screen point, so whatever is under the cursor stays under it. */
  function setZoom(z, cx, cy) {
    const prev = zoom;
    zoom = clamp(z, 1, 8);
    if (zoom === prev) return;
    if (cx != null) {
      const r = photo.getBoundingClientRect();
      panX -= (cx - (r.left + r.width / 2)) * (zoom / prev - 1);
      panY -= (cy - (r.top + r.height / 2)) * (zoom / prev - 1);
    }
    clampPan(); applyZoom();
  }
  const resetZoom = () => { zoom = 1; panX = panY = 0; applyZoom(); };
  stage.addEventListener('wheel', e => {
    if (!src) return;
    e.preventDefault();
    setZoom(zoom * Math.pow(1.0018, -e.deltaY * (e.deltaMode === 1 ? 18 : 1)), e.clientX, e.clientY);
  }, { passive: false });
  $('#zoomIn').onclick = () => setZoom(zoom * 1.5);
  $('#zoomOut').onclick = () => setZoom(zoom / 1.5);
  $('#zoomVal').onclick = resetZoom;
  photo.addEventListener('dblclick', () => { if (tab !== TAB.draw && !sticker) (zoom > 1 ? resetZoom() : setZoom(2)); });
  photo.addEventListener('pointerdown', e => {
    if (tab === TAB.draw || sticker || zoom === 1 || e.button !== 0 || !src) return;
    panning = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    photo.setPointerCapture(e.pointerId);
  });
  photo.addEventListener('pointermove', e => {
    if (!panning) return;
    panX = panning.px + (e.clientX - panning.x);
    panY = panning.py + (e.clientY - panning.y);
    clampPan(); applyZoom();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => photo.addEventListener(ev, () => (panning = null)));
  new ResizeObserver(() => { clampPan(); applyZoom(); }).observe(photo);

  function syncUI() {
    selectTool(cur, false); updChips();
    markThumbs();
    dialAmt.set(state.amt); $('#amtVal').textContent = Math.round(state.amt);
    $$('[data-aspect]').forEach(b => b.classList.toggle('on', b.dataset.aspect === state.aspect));
    dialStr.set(state.straighten); $('#sval').textContent = String(state.straighten).replace('-', '−') + '°';
    syncFun(); syncColor(); updStatus();
  }

  // ---------- Histogram ----------
  const hcv = $('#histCv'), hctx = hcv.getContext('2d'), hs = document.createElement('canvas');
  let histOn = store.get('lumen.hist', false), htimer = 0;
  function schedHist() { if (histOn) { clearTimeout(htimer); htimer = setTimeout(drawHist, 60); } }
  function drawHist() {
    if (!cv.width) return;
    const w = 180, h = Math.max(1, Math.round(w * cv.height / cv.width));
    hs.width = w; hs.height = h;
    const x = hs.getContext('2d', { willReadFrequently: true });
    x.drawImage(frameCv(), 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const R = new Float32Array(64), G = new Float32Array(64), B = new Float32Array(64), L = new Float32Array(64);
    for (let i = 0; i < d.length; i += 4) {
      R[d[i] >> 2]++; G[d[i + 1] >> 2]++; B[d[i + 2] >> 2]++;
      L[(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) >> 2]++;
    }
    let mx = 1;
    [R, G, B, L].forEach(a => { for (let i = 1; i < 63; i++) mx = Math.max(mx, a[i]); });
    const W = hcv.width, H = hcv.height;
    hctx.clearRect(0, 0, W, H);
    const area = (a, col) => {
      hctx.beginPath(); hctx.moveTo(0, H);
      for (let i = 0; i < 64; i++) hctx.lineTo(i / 63 * W, H - Math.min(1, Math.sqrt(a[i] / mx)) * H * 0.94);
      hctx.lineTo(W, H); hctx.closePath(); hctx.fillStyle = col; hctx.fill();
    };
    hctx.globalCompositeOperation = 'source-over';
    area(L, 'rgba(255,255,255,.2)');
    hctx.globalCompositeOperation = 'screen';
    area(R, 'rgba(255,69,58,.8)'); area(G, 'rgba(48,209,88,.75)'); area(B, 'rgba(10,132,255,.85)');
  }
  function toggleHist(on) {
    histOn = on ?? !histOn;
    store.set('lumen.hist', histOn);
    $('#hist').classList.toggle('on', histOn);
    $('#histBtn').classList.toggle('on', histOn);
    if (histOn) drawHist();
  }
  $('#histBtn').onclick = () => toggleHist();

  // ---------- Compare ----------
  function compare(on) {
    if (!src) return;
    if (on && !photo.classList.contains('comparing')) Engine.render(orig, src, { ...effective(state), ...zeroAdj() }, PREVIEW, true);
    photo.classList.toggle('comparing', on);
    stage.classList.toggle('comparing', on);
  }
  const cmp = $('#compare');
  cmp.addEventListener('pointerdown', () => compare(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => compare(false)));
  photo.addEventListener('pointerdown', e => { if (e.button === 0 && tab !== TAB.draw && !sticker && !split.on && zoom === 1 && !e.target.closest('.split')) compare(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => photo.addEventListener(ev, () => compare(false)));

  // ---------- Drawing: brush / marker / eraser ----------
  let brush = Brush.sanitize(store.get('lumen.brush', Brush.DEFAULT));
  let brushPresets = Brush.loadPresets(store.get('lumen.brushes', []));
  const dp = $('#drawPanel'), bprev = $('#brushPrev');
  const SWATCHES = ['#ffffff', '#1c1c1e', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d55'];
  $('#swatches').innerHTML = SWATCHES.map(c => `<button class="sw-dot" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('');
  const SL = { size: [1, 120, ' px'], opacity: [5, 100, '%'], soft: [0, 100, '%'], h: [0, 360, '°'], s: [0, 100, '%'], v: [0, 100, '%'] };

  function syncBrush() {
    const col = Brush.hsvToHex(brush.h, brush.s, brush.v);
    dp.style.setProperty('--bc', col);
    dp.style.setProperty('--hue', Brush.hsvToHex(brush.h, 100, 100));
    dp.style.setProperty('--sat0', Brush.hsvToHex(brush.h, 0, brush.v));
    $$('#drawTools .tool').forEach(b => b.classList.toggle('on', b.dataset.bt === brush.tool));
    for (const k in SL) {
      const r = dp.querySelector(`[data-b="${k}"]`), [lo, hi, u] = SL[k];
      r.value = brush[k]; r.style.setProperty('--p', ((brush[k] - lo) / (hi - lo) * 100) + '%');
      r.closest('label').querySelector('b').textContent = Math.round(brush[k]) + u;
    }
    $('#brushHex').value = col;
    $$('.sw-dot').forEach(d => d.classList.toggle('on', d.dataset.c === col));
    dp.classList.toggle('erasing', brush.tool === 'eraser');
    // live stroke preview
    const x = bprev.getContext('2d'), W = bprev.width, H = bprev.height;
    const s = Brush.makeStroke(brush, brush.size / 2 / W);
    for (let i = 0; i <= 24; i++) Brush.addPoint(s, 0.12 + i / 24 * 0.76, 0.5 + Math.sin(i / 24 * Math.PI * 2) * 0.18, 0);
    if (s.t === 'eraser') { s.t = 'brush'; s.c = '#8e8e93'; }
    Brush.render(x, [s], W, H);
    store.set('lumen.brush', brush);
  }
  dp.addEventListener('input', e => {
    const k = e.target.dataset.b;
    if (k) { rangeTick(e.target); brush[k] = +e.target.value; syncBrush(); }
    else if (e.target.id === 'brushHex') { brush = { ...brush, ...Brush.hexToHsv(e.target.value) }; syncBrush(); }
  });
  dp.addEventListener('click', e => {
    const t = e.target.closest('[data-bt]'), d = e.target.closest('.sw-dot');
    if (t && t.dataset.bt !== brush.tool) { sfx('select'); brush.tool = t.dataset.bt; if (brush.tool === 'marker' && brush.soft > 0) brush.soft = 0; syncBrush(); }
    if (d) { brush = { ...brush, ...Brush.hexToHsv(d.dataset.c) }; if (brush.tool === 'eraser') brush.tool = 'brush'; syncBrush(); }
  });
  $('#inkUndo').onclick = () => {
    if (!state.ink.length) return;
    state.ink = state.ink.slice(0, -1); paintInk(); commit();
  };
  $('#inkClear').onclick = () => {
    if (!state.ink.length) return;
    state.ink = []; paintInk(); commit(); toast('Рисунок очищен', 'Отменить', () => go(-1));
  };

  function renderBrushPresets() {
    $('#bpList').innerHTML = brushPresets.map(p => {
      const c = Brush.hsvToHex(p.h, p.s, p.v);
      return `<button class="bp" data-id="${esc(p.id)}" title="${esc(p.n)}"><i class="bp-dot ${p.tool}" style="--c:${c};--sz:${Math.max(6, Math.min(22, p.size / 3 + 5))}px"></i>` +
        `<span>${esc(p.n)}</span><em class="bp-del" data-del="${esc(p.id)}">${ICON.x}</em></button>`;
    }).join('') || '<span class="bp-empty">Сохраните любимую кисть — она появится здесь</span>';
  }
  $('#bpList').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      brushPresets = Brush.removePreset(brushPresets, del.dataset.del);
      store.set('lumen.brushes', brushPresets); renderBrushPresets(); return;
    }
    const b = e.target.closest('.bp');
    if (!b) return;
    const p = brushPresets.find(x => x.id === b.dataset.id);
    if (p) { brush = Brush.sanitize(p); syncBrush(); restart(b, 'tap'); }
  });
  $('#bpSave').onclick = () => {
    const names = { brush: 'Кисть', marker: 'Фломастер', eraser: 'Ластик' };
    $('#bpName').value = `${names[brush.tool]} ${Math.round(brush.size)} px`;
    openModal('#brushModal');
    setTimeout(() => $('#bpName').select(), 80);
  };
  const saveBrushPreset = () => {
    brushPresets = Brush.addPreset(brushPresets, brush, $('#bpName').value);
    store.set('lumen.brushes', brushPresets); renderBrushPresets(); closeModal();
    toast('Пресет кисти сохранён');
  };
  $('#bpOk').onclick = saveBrushPreset;
  $('#bpCancel').onclick = () => closeModal();
  $('#bpName').addEventListener('keydown', e => { if (e.key === 'Enter') saveBrushPreset(); });

  const inkPos = e => { const r = photo.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  let inkRaf = 0;
  photo.addEventListener('pointerdown', e => {
    if (tab !== TAB.draw || e.button !== 0 || !src) return;
    photo.setPointerCapture(e.pointerId);
    const r = photo.getBoundingClientRect();
    liveStroke = Brush.makeStroke(brush, brush.size / Math.max(r.width, r.height));
    Brush.addPoint(liveStroke, ...inkPos(e), 0);
    paintInk();
  });
  photo.addEventListener('pointermove', e => {
    if (!liveStroke) return;
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : [], evs = co.length ? co : [e];
    const r = photo.getBoundingClientRect(), minD = 1.5 / Math.max(r.width, r.height);
    evs.forEach(ev => Brush.addPoint(liveStroke, ...inkPos(ev), minD));
    cancelAnimationFrame(inkRaf); inkRaf = requestAnimationFrame(paintInk);
  });
  const endStroke = () => {
    if (!liveStroke) return;
    const s = liveStroke; liveStroke = null;
    state.ink = [...state.ink, s]; paintInk(); commit();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => photo.addEventListener(ev, endStroke));
  renderBrushPresets(); syncBrush();

  // ---------- Image loading ----------
  function setImage(img, name) {
    fullImg = img; srcName = name;
    const k = Math.min(1, 2400 / Math.max(img.width, img.height));
    if (k < 1) {
      src = document.createElement('canvas');
      src.width = Math.round(img.width * k); src.height = Math.round(img.height * k);
      const x = src.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, src.width, src.height);
    } else src = img;
    cancelAnimationFrame(tw); split.key = '';
    state = fresh(); hist = [fresh()]; labels = ['Открыто']; hi = 0; updHist();
    $('#fname').textContent = name;
    cancelAnimationFrame(raf); drawNow();
    resetZoom();
    photo.classList.add('nt'); fit(); reflow(photo); photo.classList.remove('nt');
    syncUI(); restart(photo, 'pop');
    buildThumbs(); ambient();
  }
  function openFile(f) {
    if (!f || !f.type.startsWith('image/')) return toast('Это не изображение', null, null, true);
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { setImage(img, f.name); URL.revokeObjectURL(url); };
    img.onerror = () => { toast('Не удалось открыть файл', null, null, true); URL.revokeObjectURL(url); };
    img.src = url;
  }
  const SCENES = { day: 'День у озера', night: 'Ночь у озера', meadow: 'Летний луг', dunes: 'Полдень в дюнах', city: 'Ночной город', aurora: 'Северное сияние', beach: 'Берег океана', fog: 'Туман в лесу' };
  function loadScene(k) { setImage(Scenes[k](), SCENES[k]); }

  // ---------- Samples popover ----------
  const pop = $('#samples'), brand = $('#samplesBtn');
  let thumbsDrawn = false;
  function togglePop(on) {
    on = on ?? !pop.classList.contains('open');
    if (on) {
      const r = brand.getBoundingClientRect();
      pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 12) + 'px';
      if (!thumbsDrawn) {
        // staggered so opening the popover never blocks on painting every scene at once
        $$('.sample').forEach((b, i) => setTimeout(() => { const c = b.querySelector('canvas'); c.getContext('2d').drawImage(Scenes[b.dataset.scene](), 0, 0, c.width, c.height); }, 40 + i * 60));
        thumbsDrawn = true;
      }
      hideTip();
    }
    if (on) { toggleMenu(false); toggleHistPop(false); }
    pop.classList.toggle('open', on); brand.classList.toggle('open', on);
    updatePromoVeil();
  }
  let eggN = 0, eggT = 0;
  brand.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('.logo')) {
      clearTimeout(eggT); eggT = setTimeout(() => (eggN = 0), 2500);
      if (++eggN >= 7) { eggN = 0; restart(brand.querySelector('.logo'), 'egg'); award('egg'); const r = brand.getBoundingClientRect(); confetti(r.left + 20, r.bottom, 80); return; }
    }
    togglePop();
  });
  pop.addEventListener('click', e => {
    e.stopPropagation();
    const s = e.target.closest('.sample');
    if (s) { loadScene(s.dataset.scene); togglePop(false); }
  });
  document.addEventListener('click', () => togglePop(false));
  $('#open2').onclick = () => { togglePop(false); $('#file').click(); };

  // ---------- Top bar ----------
  $('#undo').onclick = () => go(-1);
  $('#redo').onclick = () => go(1);
  $('#resetAll').onclick = () => {
    cancelAnimationFrame(tw);
    if (same(state, fresh())) return;
    if (geomSame(state, fresh())) crossfade(() => (state = fresh()));
    else { state = fresh(); drawNow(); bump(); }
    syncUI(); commit('Сброс'); toast('Все правки сброшены');
  };
  $('#open').onclick = () => $('#file').click();
  $('#file').onchange = e => { openFile(e.target.files[0]); e.target.value = ''; };

  // ---------- Modals ----------
  let activeModal = null;
  function openModal(sel) {
    closeModal(true); activeModal = $(sel); activeModal.classList.add('open'); hideTip(); updatePromoVeil();
    togglePop(false); toggleMenu(false); toggleHistPop(false); stickerMode(null);
    sfx('open');
  }
  function closeModal(silent) {
    if (activeModal) {
      activeModal.classList.remove('open');
      if (silent !== true) sfx('close');
      // The meme caption edits live; however the sheet is closed, what is on the photo becomes one history step.
      if (activeModal.id === 'memeModal') commit('Мем-текст');
      if (activeModal.id === 'criticModal') clearTimeout(crT);
    }
    activeModal = null; updatePromoVeil();
  }
  $$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) closeModal(); }));
  // A popover/menu/modal that reaches the bottom-left corner (the samples grid, at eight scenes tall,
  // does) used to bury the promo card outright — that read as the card randomly vanishing and
  // reappearing. Veiling it in step with whatever is covering it keeps the same fade both ways.
  function updatePromoVeil() {
    $('#promo').classList.toggle('veiled', pop.classList.contains('open') || menu.classList.contains('open') || histPop.classList.contains('open') || !!activeModal);
  }

  // ---------- Export ----------
  const ex = { fmt: 'jpeg', q: 92, res: 'orig', frame: 'none', ...store.get('lumen.export', {}) };
  const webpOK = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
  if (!webpOK && ex.fmt === 'webp') ex.fmt = 'jpeg';
  const EXT = { jpeg: '.jpg', png: '.png', webp: '.webp' };
  const RES = [['orig', 'Оригинал'], [3840, '4K'], [2560, '2.5K'], [1920, 'Full HD'], [1080, 'Соцсети']];
  const exCv = $('#exCv');
  let estT = 0, estId = 0;

  const baseName = n => n.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '').trim() || 'photo';
  const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
  function exportDims(res) {
    const L = Engine.layout(fullImg, effective(state)), long = Math.max(L.cw, L.ch);
    const target = Math.min(res === 'orig' ? long : Math.min(long, res), Engine.maxSize());
    const k = target / long;
    return { w: Math.round(L.cw * k), h: Math.round(L.ch * k), long: target, full: long };
  }
  function frameSize(w, h, f) {
    if (f === 'none') return { W: w, H: h, m: 0, b: 0 };
    const m = Math.round(Math.max(w, h) * (f === 'pola' ? 0.045 : 0.04));
    const b = f === 'pola' ? m * 4 : m;
    return { W: w + m * 2, H: h + m + b, m, b };
  }
  function frameify(c, f) {
    if (f === 'none') return c;
    const s = frameSize(c.width, c.height, f), o = document.createElement('canvas');
    o.width = s.W; o.height = s.H;
    const x = o.getContext('2d');
    x.fillStyle = f === 'black' ? '#0b0b0c' : f === 'pola' ? '#f6f3ec' : '#ffffff';
    x.fillRect(0, 0, s.W, s.H);
    if (f === 'pola') { x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = s.m * 0.25; }
    x.drawImage(c, s.m, s.m);
    return o;
  }
  function syncExport() {
    $$('#exFmt button').forEach((b, i) => {
      b.classList.toggle('on', b.dataset.v === ex.fmt);
      if (b.dataset.v === ex.fmt) $('#exFmt .pill').style.transform = `translateX(${i * 100}%)`;
      if (b.dataset.v === 'webp') b.disabled = !webpOK;
    });
    $('#exExt').textContent = EXT[ex.fmt];
    $('#exQRow').classList.toggle('shut', ex.fmt === 'png');
    $('#exQ').value = ex.q; $('#exQVal').textContent = ex.q + '%';
    $('#exQ').style.setProperty('--p', ((ex.q - 50) / 50 * 100) + '%');
    const full = exportDims('orig').long;
    $('#exRes').innerHTML = RES.map(([v, n]) => {
      const d = exportDims(v), dis = v !== 'orig' && v >= full;
      return `<button class="opt${ex.res === v ? ' on' : ''}" data-v="${v}"${dis ? ' disabled' : ''}>${n}<small>${d.w}×${d.h}</small></button>`;
    }).join('');
    if (ex.res !== 'orig' && ex.res >= full) { ex.res = 'orig'; $('#exRes .opt').classList.add('on'); }
    $$('#exFrame .opt').forEach(b => b.classList.toggle('on', b.dataset.v === ex.frame));
    const d = exportDims(ex.res), fs = frameSize(d.w, d.h, ex.frame);
    $('#exDims').textContent = `${fs.W} × ${fs.H} px`;
    store.set('lumen.export', { fmt: ex.fmt, q: ex.q, res: ex.res, frame: ex.frame });
  }
  function renderExPreview(anim) {
    const f = frameify(renderFull(document.createElement('canvas'), src, 900), ex.frame);
    const paint = () => { exCv.width = f.width; exCv.height = f.height; exCv.getContext('2d').drawImage(f, 0, 0); exCv.classList.remove('flip'); };
    if (anim) { exCv.classList.add('flip'); setTimeout(paint, 160); } else paint();
    estimate(f);
  }
  function estimate(f) {
    clearTimeout(estT);
    $('#exBytes').textContent = 'считаю…';
    const id = ++estId;
    estT = setTimeout(() => {
      const d = exportDims(ex.res), fs = frameSize(d.w, d.h, ex.frame);
      f.toBlob(b => {
        if (id !== estId || !b) return;
        const ratio = (fs.W * fs.H) / (f.width * f.height);
        $('#exBytes').textContent = '≈ ' + fmtBytes(b.size * ratio * (ex.fmt === 'png' ? 0.9 : 1));
      }, 'image/' + ex.fmt, ex.q / 100);
    }, 250);
  }
  function openExport() {
    if (!src) return;
    $('#exName').value = baseName(srcName) + '-lumen';
    ['#exSave', '#exCopy', '#exShare'].forEach(s => $(s).classList.remove('busy', 'done'));
    syncExport(); openModal('#exportModal'); renderExPreview(false);
  }
  $('#export').onclick = openExport;
  $('#exClose').onclick = closeModal;
  $('#exFmt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; ex.fmt = b.dataset.v; syncExport(); estimate(exCv); });
  $('#exQ').addEventListener('input', e => { rangeTick(e.target); ex.q = +e.target.value; $('#exQVal').textContent = ex.q + '%'; e.target.style.setProperty('--p', ((ex.q - 50) / 50 * 100) + '%'); estimate(exCv); });
  $('#exQ').addEventListener('change', syncExport);
  $('#exRes').addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; ex.res = b.dataset.v === 'orig' ? 'orig' : +b.dataset.v; syncExport(); estimate(exCv); });
  $('#exFrame').addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b || b.dataset.v === ex.frame) return; ex.frame = b.dataset.v; syncExport(); renderExPreview(true); });

  const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob()], 'x.jpg', { type: 'image/jpeg' })] }));
  $('#exShare').hidden = !canShare;

  async function doExport(kind, btn) {
    btn.classList.add('busy');
    await new Promise(r => setTimeout(r, 40));
    try {
      const d = exportDims(ex.res);
      const fin = frameify(renderFull(document.createElement('canvas'), fullImg, d.long), ex.frame);
      const type = kind === 'copy' ? 'image/png' : 'image/' + ex.fmt;
      const blob = await new Promise((res, rej) => fin.toBlob(b => (b ? res(b) : rej(new Error('encode'))), type, ex.q / 100));
      const name = baseName($('#exName').value) + (kind === 'copy' ? '.png' : EXT[ex.fmt]);
      if (kind === 'save') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } else if (kind === 'copy') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        await navigator.share({ files: [new File([blob], name, { type })], title: name });
      }
      btn.classList.remove('busy'); btn.classList.add('done');
      sfx(kind === 'save' ? 'shutter' : 'success');
      if (kind === 'save') {
        const n = bumpStat('exports');
        award('export'); if (n >= 10) award('export10');
        const r = btn.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top, 90);
      }
      const msg = kind === 'copy' ? 'Скопировано в буфер обмена' : kind === 'save' ? `Сохранено · ${fin.width}×${fin.height} · ${fmtBytes(blob.size)}` : 'Отправлено';
      setTimeout(() => { closeModal(); toast(msg); }, 950);
    } catch (err) {
      btn.classList.remove('busy');
      if (err && err.name === 'AbortError') return;
      console.error(err);
      toast(kind === 'copy' ? 'Браузер не разрешил копирование' : 'Не удалось экспортировать', null, null, true);
    } finally {
      drawNow();
    }
  }
  $('#exSave').onclick = e => doExport('save', e.currentTarget);
  $('#exCopy').onclick = e => doExport('copy', e.currentTarget);
  $('#exShare').onclick = e => doExport('share', e.currentTarget);
  $('#exName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#exSave').click(); });

  // ---------- Toast ----------
  let tt = 0;
  function toast(msg, actLabel, act, err) {
    const t = $('#toast'), b = $('#toastAct');
    $('#toastTxt').textContent = msg;
    t.querySelector('svg').style.color = err ? '#ff453a' : '';
    if (err) sfx('error');
    b.textContent = actLabel || '';
    t.classList.toggle('act', !!actLabel);
    b.onclick = () => { t.classList.remove('on'); act && act(); };
    t.classList.remove('on'); reflow(t); t.classList.add('on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), actLabel ? 4500 : 2400);
  }

  // ---------- Tooltips ----------
  const tip = $('#tip');
  let tipT = 0;
  function hideTip() { clearTimeout(tipT); tip.classList.remove('on'); }
  function bindTip(el) {
    el.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(tipT);
      tipT = setTimeout(() => {
        if (!settings.tips) return;
        if (el.closest('.modal:not(.open)') || pop.classList.contains('open') && el === brand) return;
        tip.innerHTML = esc(el.dataset.tip) + (el.dataset.key ? `<kbd>${esc(el.dataset.key)}</kbd>` : '');
        const r = el.getBoundingClientRect(), tw2 = tip.offsetWidth;
        const below = r.top < innerHeight / 2;
        tip.style.left = clamp(r.left + r.width / 2 - tw2 / 2, 8, innerWidth - tw2 - 8) + 'px';
        tip.style.top = (below ? r.bottom + 10 : r.top - tip.offsetHeight - 10) + 'px';
        tip.classList.add('on');
      }, 550);
    });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('pointerdown', hideTip);
  }
  $$('[data-tip]').forEach(bindTip);

  // ---------- Keyboard ----------
  addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, code = e.code;
    const typing = e.target.matches('input:not([type=range]), textarea');
    if (typing && e.key !== 'Escape' && !(mod && code === 'KeyK')) return;
    konami(e);
    if (e.key === 'Escape') { if (activeModal) closeModal(); togglePop(false); toggleMenu(false); toggleHistPop(false); stickerMode(null); if ($('#tour').classList.contains('on')) endTour(); return; }
    if (mod && code === 'KeyK') { e.preventDefault(); activeModal === $('#paletteModal') ? closeModal() : openPalette(); return; }
    if (activeModal) return;
    if (mod && e.shiftKey && code === 'KeyC' && !typing) { e.preventDefault(); copySettings(); return; }
    if (mod && e.shiftKey && code === 'KeyV' && !typing) { e.preventDefault(); pasteSettings(); return; }
    if (mod && code === 'KeyZ') { e.preventDefault(); go(e.shiftKey ? 1 : -1); }
    else if (mod && code === 'KeyY') { e.preventDefault(); go(1); }
    else if (mod && code === 'KeyO') { e.preventDefault(); $('#file').click(); }
    else if (mod && (code === 'KeyS' || code === 'KeyE')) { e.preventDefault(); openExport(); }
    else if (typing || mod) return;
    else if (code === 'Space' && !e.repeat) { e.preventDefault(); compare(true); }
    else if (code === 'KeyH') toggleHist();
    else if (code === 'KeyG') openCharts();
    else if (code === 'KeyI') openInfo();
    else if (code === 'KeyR') $('#dice').click();
    else if (code === 'KeyT') $('#themeBtn').click();
    else if (code === 'KeyC') $('#smartCrop').click();
    else if (code === 'Equal' || e.key === '+') setZoom(zoom * 1.5);
    else if (code === 'Minus' || e.key === '-') setZoom(zoom / 1.5);
    else if (code === 'Digit0') resetZoom();
    else if (e.key === ',') openSettings();
    else if (e.key === '?') openKeys();
    else if (code === 'KeyJ') toggleClip();
    else if (code === 'KeyY') toggleSplit();
    else if (code === 'KeyO') cycleGrid();
    else if (code === 'KeyM') toggleSound();
    else if (code === 'KeyL') toggleHistPop();
    else if (code === 'KeyF') fry();
    else if (/^Digit[1-6]$/.test(code)) { const t = +code.slice(-1) - 1; if (t !== tab) { sfx('select'); setTab(t); } }
  });
  addEventListener('keyup', e => { if (e.code === 'Space') compare(false); });

  // ---------- Drag & drop / paste ----------
  let dc = 0;
  addEventListener('dragenter', e => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); dc++; stage.classList.add('drag'); });
  addEventListener('dragleave', () => { if (--dc <= 0) { dc = 0; stage.classList.remove('drag'); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); dc = 0; stage.classList.remove('drag'); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]); });
  addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])][0]; if (f) openFile(f); });

  // ---------- Glass specular follows the pointer ----------
  addEventListener('pointermove', e => {
    const g = e.target.closest && e.target.closest('.glass');
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // ---------- Settings sheet ----------
  const accentHex = () => (settings.accent === 'custom' ? settings.accentHex : (ACCENTS.find(a => a.id === settings.accent) || ACCENTS[0]).c);
  /** Ink that stays readable on the chosen accent — a custom colour can be anything. */
  function accentInk(hex) {
    const n = parseInt(hex.slice(1), 16);
    const l = ((n >> 16 & 255) * 0.2126 + (n >> 8 & 255) * 0.7152 + (n & 255) * 0.0722) / 255;
    return l > 0.55 ? '#1c1500' : '#ffffff';
  }

  // «Система» is resolved here rather than in CSS: the stylesheet only ever sees data-theme="light"
  // or "dark", so no rule needs a media query of its own and the switch stays instant.
  const sysLight = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  const resolvedTheme = () => (settings.theme === 'system' ? (sysLight && sysLight.matches ? 'light' : 'dark') : settings.theme);
  function applyTheme() {
    const t = resolvedTheme();
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'light' ? '#eceef3' : '#050507';
    $$('#themeBtn .theme-ic svg').forEach(s => s.classList.toggle('on', s.dataset.th === settings.theme));
    $('#themeBtn').dataset.tip = `Тема: ${THEME_N[settings.theme]}`;
  }
  if (sysLight) sysLight.addEventListener('change', () => { if (settings.theme === 'system') applyTheme(); });
  $('#themeBtn').onclick = () => {
    settings.theme = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length];
    applySettings(); syncSettings(); hideTip();
    toast(`Тема: ${THEME_N[settings.theme]}`);
  };

  function applySettings() {
    const c = accentHex();
    const preset = settings.accent !== 'custom' && ACCENTS.find(x => x.id === settings.accent);
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-ink', preset ? preset.ink : accentInk(c));
    document.documentElement.dataset.font = settings.font;
    applyTheme();
    document.body.classList.toggle('no-anim', !settings.anim);
    document.body.classList.toggle('no-ambient', !settings.ambient);
    $('#ambientBox').className = 'ambient' + (settings.ambientStyle !== 'auto' ? ` custom-bg bg-${settings.ambientStyle}` : '');
    PREVIEW = settings.quality;
    Sound.setEnabled(settings.sound); Sound.setVolume(settings.volume / 100); Sound.setPack(settings.pack);
    $('#soundBtn').classList.toggle('muted', !settings.sound);
    $('#soundBtn').dataset.tip = settings.sound ? 'Звук включён' : 'Звук выключен';
    store.set('lumen.settings', settings);
  }
  function syncSettings() {
    $('#setAccent').innerHTML = ACCENTS.map(a =>
      `<button class="acc${a.id === settings.accent ? ' on' : ''}" data-acc="${a.id}" data-tip="${a.n}" aria-label="${a.n}" style="--c:${a.c}"></button>`).join('');
    $$('#setAccent .acc').forEach(bindTip);
    $('#setAmbient').innerHTML = AMBIENTS.map(a =>
      `<button class="acc${a.id === settings.ambientStyle ? ' on' : ''}" data-amb="${a.id}" data-tip="${a.n}" aria-label="${a.n}" style="--c:${a.c}"></button>`).join('');
    $$('#setAmbient .acc').forEach(bindTip);
    $('#setAccentHex').value = accentHex();
    $('#setAccentWell').style.setProperty('--bc', accentHex());
    $('#setAccentWell').classList.toggle('on', settings.accent === 'custom');
    $$('#setFont button').forEach((b, i) => {
      const on = b.dataset.v === settings.font;
      b.classList.toggle('on', on);
      if (on) $('#setFont .pill').style.transform = `translateX(${i * 100}%)`;
    });
    $$('#settingsModal [data-set]').forEach(b => {
      b.classList.toggle('on', !!settings[b.dataset.set]);
      b.setAttribute('aria-checked', String(!!settings[b.dataset.set]));
    });
    $$('#setTheme button').forEach((b, i) => {
      const on = b.dataset.v === settings.theme;
      b.classList.toggle('on', on);
      if (on) $('#setTheme .pill').style.transform = `translateX(${i * 100}%)`;
    });
    $$('#setQ button').forEach((b, i) => {
      const on = +b.dataset.v === settings.quality;
      b.classList.toggle('on', on);
      if (on) $('#setQ .pill').style.transform = `translateX(${i * 100}%)`;
    });
    $('#setVol').value = settings.volume;
    $('#setVol').style.setProperty('--p', settings.volume + '%');
    $('#setVolVal').textContent = settings.volume;
    $('#setPack').innerHTML = Sound.PACKS.map(p => `<button class="pack${p.id === settings.pack ? ' on' : ''}" data-pack="${p.id}"><em>${p.e}</em>${p.n}</button>`).join('');
    $('#packDesc').textContent = Sound.PACKS.find(p => p.id === settings.pack).d;
    const d = $('#setDice');
    d.value = settings.dice;
    d.style.setProperty('--p', ((settings.dice - 3) / 11 * 100) + '%');
    $('#setDiceVal').textContent = settings.dice;
    const p = userPresets.length, b = brushPresets.length;
    $('#setStorage').textContent =
      `${p} ${plural(p, 'пресет', 'пресета', 'пресетов')} и ${b} ${plural(b, 'кисть', 'кисти', 'кистей')}`;
  }
  function openSettings() { syncSettings(); openModal('#settingsModal'); }

  // ---------- App menu ----------
  const menu = $('#menu'), menuBtn = $('#menuBtn');
  function toggleMenu(on) {
    on = on ?? !menu.classList.contains('open');
    if (on) {
      const r = menuBtn.getBoundingClientRect();
      menu.style.left = clamp(r.right - 268, 12, Math.max(12, innerWidth - 280)) + 'px';
      menu.style.top = (r.bottom + 12) + 'px';
      togglePop(false); toggleHistPop(false); hideTip();
      updAchCount();
    }
    menu.classList.toggle('open', on);
    menuBtn.classList.toggle('on', on);
    updatePromoVeil();
  }
  menuBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  menu.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => toggleMenu(false));

  $('#settingsBtn').onclick = () => { toggleMenu(false); openSettings(); };
  $('#tourBtn').onclick = () => { toggleMenu(false); setTimeout(startTour, 200); };
  $('#paletteRow').onclick = () => { toggleMenu(false); openPalette(); };
  $('#keysBtn').onclick = () => { toggleMenu(false); openKeys(); };
  $('#achBtn').onclick = () => { toggleMenu(false); openAch(); };
  $('#copySet').onclick = () => { toggleMenu(false); copySettings(); };
  $('#pasteSet').onclick = () => { toggleMenu(false); pasteSettings(); };
  $('#setClose').onclick = closeModal;
  $('#settingsModal').addEventListener('click', e => {
    const t = e.target.closest('[data-set]'), a = e.target.closest('[data-acc]');
    const q = e.target.closest('#setQ button'), th = e.target.closest('#setTheme button');
    const f = e.target.closest('#setFont button'), amb = e.target.closest('[data-amb]');
    if (f) { settings.font = f.dataset.v; applySettings(); syncSettings(); }
    if (t) {
      const k = t.dataset.set;
      settings[k] = !settings[k];
      applySettings(); syncSettings();
      sfx(settings[k] ? 'on' : 'off');
      if (k === 'ambient' && settings.ambient) ambient();
      if (k === 'promo') { store.set('lumen.promoHidden', false); showPromo(settings.promo); }
    }
    if (a) { settings.accent = a.dataset.acc; applySettings(); syncSettings(); }
    if (th) { settings.theme = th.dataset.v; applySettings(); syncSettings(); }
    if (q) { settings.quality = +q.dataset.v; applySettings(); syncSettings(); drawNow(); }
    if (amb) { settings.ambientStyle = amb.dataset.amb; applySettings(); syncSettings(); }
    const pk = e.target.closest('[data-pack]');
    if (pk && pk.dataset.pack !== settings.pack) {
      settings.pack = pk.dataset.pack; applySettings(); syncSettings();
      sfx('select'); setTimeout(() => sfx('success'), 180);
      if (settings.pack === 'duck') award('duck');
    }
  });
  $('#setAccentHex').addEventListener('input', e => {
    settings.accent = 'custom'; settings.accentHex = e.target.value;
    applySettings(); syncSettings();
  });
  $('#setDice').addEventListener('input', e => {
    rangeTick(e.target);
    settings.dice = +e.target.value;
    e.target.style.setProperty('--p', ((settings.dice - 3) / 11 * 100) + '%');
    $('#setDiceVal').textContent = settings.dice;
    applySettings();
  });
  $('#setVol').addEventListener('input', e => {
    settings.volume = +e.target.value; applySettings();
    e.target.style.setProperty('--p', settings.volume + '%');
    $('#setVolVal').textContent = settings.volume;
    rangeTick(e.target);
  });
  $('#btnTour').onclick = () => { closeModal(); setTimeout(startTour, 280); };
  $('#btnWipe').onclick = () => {
    ['lumen.presets', 'lumen.brushes', 'lumen.export', 'lumen.hist', 'lumen.settings', 'lumen.tour', 'lumen.promoHidden', 'lumen.brush', 'lumen.ach', 'lumen.stats', 'lumen.clip']
      .forEach(k => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } });
    userPresets = []; brushPresets = []; unlocked = []; stats = {}; updAchCount();
    settings = { ...DEF_SET };
    applySettings(); buildThumbs(); renderBrushPresets(); syncSettings(); syncUI();
    toast('Сохранённые данные очищены');
  };

  // ---------- About ----------
  $('#aboutBtn').onclick = () => { toggleMenu(false); openModal('#aboutModal'); };
  $('#aboutClose').onclick = closeModal;

  // ---------- Charts & diagrams ----------
  const HUE_C = ['#ff453a', '#ff9f0a', '#ffd60a', '#a2e02a', '#30d158', '#2ee6b6', '#40c8e0', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d9b', '#ff375f'];
  const HUE_N = ['красный', 'оранжевый', 'жёлтый', 'лайм', 'зелёный', 'бирюзовый', 'голубой', 'синий', 'индиго', 'фиолетовый', 'розовый', 'малиновый'];
  const RADAR = ['exposure', 'contrast', 'highlights', 'shadows', 'saturation', 'warmth', 'clarity', 'vignette'];
  let chRaf = 0;

  /** Current look (adjustments + filter + strokes) rendered small, plus its pixels. */
  function snapshot(size) {
    const c = renderFull(document.createElement('canvas'), src, size);
    return { c, d: c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height) };
  }
  /** Size a chart canvas to its CSS box at device resolution and hand back a scaled context. */
  function prep(c, hCss) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(80, c.clientWidth || 320);
    c.style.height = hCss + 'px';
    c.width = Math.round(w * dpr); c.height = Math.round(hCss * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { x, w, h: hCss };
  }
  const norm = k => effective(state)[k] / Math.max(Math.abs(TOOL[k].min), TOOL[k].max);

  function openCharts() {
    if (!src) return;
    openModal('#chartsModal');
    cancelAnimationFrame(chRaf);
    requestAnimationFrame(() => {
      const { d } = snapshot(360);
      const s = Analysis.summarize(d.data, 1);
      const cdf = Analysis.cumulative(s.l);
      const wave = Analysis.waveform(d.data, d.width, d.height, 120);
      const eff = effective(state), acc = accentHex();
      const radar = RADAR.map(k => ({ n: TOOL[k].n, v: norm(k) }));
      const bars = TOOLS.map(t => ({ n: t.n, v: norm(t.k), raw: eff[t.k] }))
        .filter(b => Math.round(b.raw) !== 0)
        .sort((a, z) => Math.abs(z.v) - Math.abs(a.v))
        .slice(0, 9);
      const hsum = [...s.hues].reduce((a, x) => a + x, 0);
      const segs = [...s.hues].map((v, i) => ({ v, c: HUE_C[i] }));
      segs.push({ v: hsum * s.grayShare / Math.max(0.001, 1 - s.grayShare), c: 'rgba(255,255,255,.32)' });
      const top = [...s.hues].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).filter(x => x.v > 0).slice(0, 4);
      $('#chDonutLeg').innerHTML = top.map(x => `<span><i style="--c:${HUE_C[x.i]}"></i>${HUE_N[x.i]}</span>`).join('') +
        `<span><i style="--c:rgba(255,255,255,.32)"></i>нейтральный ${Math.round(s.grayShare * 100)}%</span>`;

      $('#chBarsEmpty').hidden = bars.length > 0;
      $('#chBars').style.display = bars.length ? '' : 'none';
      const A = prep($('#chHist'), 150), B = prep($('#chCurve'), 132), C = prep($('#chDonut'), 132),
        D = prep($('#chRadar'), 210), F = prep($('#chWave'), 150);
      const E = bars.length ? prep($('#chBars'), bars.length * 24 + 6) : null;
      // The waveform is thousands of cells, so it is painted once instead of every animation frame.
      Analysis.drawWave(F.x, F.w, F.h, wave, 1);
      const t0 = performance.now();
      const step = now => {
        const t = settings.anim ? Math.min(1, (now - t0) / 900) : 1;
        Analysis.drawHistogram(A.x, A.w, A.h, s, t);
        Analysis.drawCurve(B.x, B.w, B.h, cdf, t, acc);
        Analysis.drawDonut(C.x, C.w, C.h, segs, t);
        Analysis.drawRadar(D.x, D.w, D.h, radar, t, acc);
        if (E) Analysis.drawBars(E.x, E.w, E.h, bars, t, acc);
        if (t < 1) chRaf = requestAnimationFrame(step);
      };
      chRaf = requestAnimationFrame(step);
    });
  }
  $('#statsBtn').onclick = openCharts;
  $('#chClose').onclick = () => { cancelAnimationFrame(chRaf); closeModal(); };

  // ---------- Image info ----------
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  function openInfo() {
    if (!src) return;
    const { c, d } = snapshot(420);
    const s = Analysis.summarize(d.data, 2);
    const pal = Analysis.dominant(d.data, 6, 3);
    const p = $('#infoPrev');
    p.width = c.width; p.height = c.height;
    p.getContext('2d').drawImage(c, 0, 0);
    const W = fullImg.width, H = fullImg.height, g = gcd(W, H) || 1;
    const L = exportDims('orig'), eff = effective(state);
    // Counted over TOOLS, not ADJ: sepia/gray have no dial of their own and would inflate the total.
    const changed = TOOLS.filter(t => Math.round(eff[t.k]) !== 0).length;
    const cell = (n, v, sub) => `<div class="stat"><span>${n}</span><b>${v}${sub ? `<small>${sub}</small>` : ''}</b></div>`;
    const meter = (n, v, pct) => `<div class="stat"><span>${n}</span><b>${v}</b><div class="meter"><i data-w="${clamp(pct, 0, 100).toFixed(1)}"></i></div></div>`;
    const dec = (v, k) => (v * 100).toFixed(k).replace('.', ',');
    $('#infoName').textContent = srcName || 'Без имени';
    $('#infoStats').innerHTML =
      cell('Исходник', `${W} × ${H}`, 'px') +
      cell('Мегапикселей', (W * H / 1e6).toFixed(1).replace('.', ',')) +
      cell('Пропорции', `${Math.round(W / g)} : ${Math.round(H / g)}`) +
      cell('Кадр сейчас', `${L.w} × ${L.h}`, 'px') +
      cell('Штрихов', String(state.ink.length)) +
      cell('Настроек изменено', `${changed}`, `из ${TOOLS.length}`);
    $('#infoTone').innerHTML =
      meter('Средняя яркость', Math.round(s.luma * 100) + '%', s.luma * 100) +
      meter('Контраст', Math.round(s.contrast * 100) + '%', s.contrast * 100) +
      meter('Насыщенность', Math.round(s.saturation * 100) + '%', s.saturation * 100) +
      meter('Нейтральные тона', Math.round(s.grayShare * 100) + '%', s.grayShare * 100) +
      meter('Провалы в тень', dec(s.clipDark, 1) + '%', s.clipDark * 400) +
      meter('Пересветы', dec(s.clipLight, 1) + '%', s.clipLight * 400);
    $('#infoPal').innerHTML = pal.map((x, i) =>
      `<i style="--c:${x.hex};animation-delay:${i * 60}ms" data-p="${Math.round(x.share * 100)}%" title="${x.hex}"></i>`).join('');
    openModal('#infoModal');
    requestAnimationFrame(() => $$('#infoTone .meter i').forEach(el => (el.style.width = el.dataset.w + '%')));
  }
  $('#infoBtn').onclick = openInfo;
  $('#infoClose').onclick = closeModal;

  // ---------- Dice: shuffle the look ----------
  const PIPS = { 1: ['c'], 2: ['tl', 'br'], 3: ['tl', 'c', 'br'], 4: ['tl', 'tr', 'bl', 'br'], 5: ['tl', 'tr', 'c', 'bl', 'br'], 6: ['tl', 'ml', 'bl', 'tr', 'mr', 'br'] };
  const pips = $$('#die .pip');
  const setFace = n => pips.forEach(p => p.classList.toggle('on', PIPS[n].includes(p.dataset.p)));
  let rollT = 0;
  const spinMs = () => (settings.anim ? 780 : 0);
  setFace(5);
  $('#dice').onclick = () => {
    if (!src) return;
    const btn = $('#dice');
    const face = 1 + Math.floor(Math.random() * 6);
    let target = Analysis.roll(Math.random, settings.dice), crit = null;
    // Fun keys ride along at zero so a previous critical failure washes out on the next roll.
    FUNS.forEach(f => (target[f.k] = 0));
    if (face === 6 && Math.random() < 0.22) {
      crit = 'jackpot';
      target = { ...target, ...Object.fromEntries(TOOLS.map(t => [t.k, 0])), exposure: 8, contrast: 18, vibrance: 30, clarity: 20, highlights: -28, shadows: 22, warmth: 10, vignette: 18 };
    } else if (face === 1 && Math.random() < 0.22) {
      crit = 'critfail';
      target = { ...target, acid: 55, jpeg: 45, saturation: 80, contrast: 45 };
    }
    const n = Object.values(target).filter(v => v !== 0).length;
    Sound.rattle(Math.max(320, spinMs()), (lastPX / innerWidth * 2 - 1) * 0.35);
    if (bumpStat('dice') >= 10) award('dice');
    const spin = spinMs();
    if (spin) {
      btn.classList.add('rolling');
      clearInterval(rollT);
      rollT = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90); // faces flicker while it tumbles
    }
    setTimeout(() => {
      clearInterval(rollT);
      btn.classList.remove('rolling');
      setFace(face);
      restart(btn, 'lucky');
      if (tab !== 0) setTab(0);
      tweenTo(target, 820, () => {
        commit(`Кубик: ${face}`);
        if (crit === 'jackpot') { award('jackpot'); sfx('achieve'); const r = btn.getBoundingClientRect(); confetti(r.left + r.width / 2, r.bottom, 120); toast('🍀 Джекпот! Кубик подобрал красивый вид', 'Отменить', () => go(-1)); }
        else if (crit === 'critfail') { award('critfail'); sfx('error'); restart(photo, 'shake'); toast('💀 Критический провал. Кубик в ярости', 'Отменить', () => go(-1)); }
        else toast(`Выпало ${face} · перемешано ${n} ${plural(n, 'настройка', 'настройки', 'настроек')}`, 'Отменить', () => go(-1));
      });
    }, spin);
  };

  // ---------- Onboarding tour ----------
  const TOUR = [
    { e: '🌅', t: 'Добро пожаловать в Lumen', d: 'Фоторедактор целиком живёт в браузере: снимки никуда не загружаются, а весь цвет считает видеокарта. Полминуты — и вы знаете, где что лежит.', sel: '.topbar', pad: 8 },
    { e: '🖼️', t: 'Ваше фото', d: 'Перетащите файл в окно, вставьте из буфера или выберите тестовую сцену в меню слева. Удерживайте снимок мышью — покажем оригинал до правок.', sel: '#photo', pad: 10 },
    { e: '🎛️', t: 'Крутите линейку', d: 'Внизу шесть вкладок: настройки, фильтры, цвет, кадр, рисование и приколы. Линейка работает как в «Фото» на iPhone — тяните, крутите колесо, двойной клик сбрасывает.', sel: '.dock', pad: 10 },
    { e: '📈', t: 'Кривые и цвет', d: 'Во вкладке «Цвет» — тоновые кривые по каналам, HSL-микшер на восемь цветов и тонирование теней и светов. Как во взрослых редакторах.', sel: '#seg [data-tab="2"]', pad: 6 },
    { e: '🦊', t: 'А тут приколы', d: 'Шакалы, VHS 1997, тепловизор, Game Boy, стикеры, мем-текст и нейрокритик, который честно (почти) оценит ваш кадр.', sel: '#seg [data-tab="5"]', pad: 6 },
    { e: '⌘', t: 'Палитра команд', d: 'Ctrl K — и можно найти любую настройку, фильтр или действие по названию. Все горячие клавиши — по «?».', sel: '#paletteBtn', pad: 6 },
    { e: '🎲', t: 'Бросьте кубик', d: 'Кубик случайно перемешивает характеристики кадра — быстрый способ наткнуться на неожиданный вид. Размах броска настраивается.', sel: '#dice', pad: 6 },
    { e: '📊', t: 'Смотрите на графики', d: 'Гистограмма, тоновая кривая, круг оттенков, профиль настроек и волновая форма — чтобы видеть, что именно вы сделали с кадром.', sel: '#statsBtn', pad: 6 },
    { e: '⬇️', t: 'Сохраните результат', d: 'Экспорт в JPEG, PNG или WebP: размер, качество, рамка и примерный вес файла. Всё считается локально, прямо здесь.', sel: '#export', pad: 6 },
  ];
  let ti = 0;
  function placeTour() {
    const s = TOUR[ti], el = $(s.sel), spot = $('#tourSpot'), card = $('#tourCard');
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, bottom: innerHeight / 2 };
    const p = s.pad || 8;
    spot.style.left = (r.left - p) + 'px';
    spot.style.top = (r.top - p) + 'px';
    spot.style.width = (r.width + p * 2) + 'px';
    spot.style.height = (r.height + p * 2) + 'px';
    spot.style.borderRadius = Math.min(34, r.height / 2 + p) + 'px';
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const below = r.top + r.height / 2 < innerHeight / 2;
    card.style.left = clamp(r.left + r.width / 2 - cw / 2, 12, Math.max(12, innerWidth - cw - 12)) + 'px';
    card.style.top = clamp(below ? r.bottom + p + 16 : r.top - p - 16 - ch, 12, Math.max(12, innerHeight - ch - 12)) + 'px';
  }
  function renderTour() {
    const s = TOUR[ti];
    $('#tourBody').innerHTML = `<div class="tc-in"><span class="tour-emoji">${s.e}</span><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></div>`;
    $('#tourDots').innerHTML = TOUR.map((_, i) => `<i class="${i === ti ? 'on' : ''}"></i>`).join('');
    $('#tourPrev').style.visibility = ti ? 'visible' : 'hidden';
    $('#tourNext').textContent = ti === TOUR.length - 1 ? 'Начать' : 'Далее';
    placeTour();
  }
  function startTour() {
    ti = 0;
    closeModal(); togglePop(false); hideTip();
    $('#tour').classList.add('on');
    renderTour();
    requestAnimationFrame(placeTour); // card size is only known once it is on screen
  }
  function endTour() {
    $('#tour').classList.remove('on');
    store.set('lumen.tour', 1);
    if (settings.promo && !store.get('lumen.promoHidden', false)) setTimeout(() => showPromo(true), 1200);
  }
  $('#tourNext').onclick = () => { if (ti === TOUR.length - 1) { endTour(); toast('Готово — приятной ретуши'); } else { ti++; renderTour(); } };
  $('#tourPrev').onclick = () => { if (ti) { ti--; renderTour(); } };
  $('#tourSkip').onclick = endTour;
  addEventListener('resize', () => { if ($('#tour').classList.contains('on')) placeTour(); });

  // ---------- Corner promo ----------
  function showPromo(on) {
    $('#promo').classList.toggle('on', !!on);
    $('#promo').classList.toggle('gone', !on);
  }
  $('#promoX').onclick = () => {
    showPromo(false);
    store.set('lumen.promoHidden', true);
    toast('Уголок скрыт — вернуть можно в настройках');
  };

  // ---------- Stats & achievements ----------
  let unlocked = Fun.cleanUnlocked(store.get('lumen.ach', []));
  let stats = store.get('lumen.stats', {});
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) stats = {};
  function bumpStat(k) {
    stats[k] = (Number.isFinite(+stats[k]) ? +stats[k] : 0) + 1;
    store.set('lumen.stats', stats);
    return stats[k];
  }
  const achQueue = [];
  let achBusy = false;
  function award(id) {
    const got = Fun.unlock(unlocked, id);
    if (!got.length) return;
    store.set('lumen.ach', unlocked);
    achQueue.push(...got); updAchCount();
    if (!achBusy) nextAch();
  }
  function nextAch() {
    const id = achQueue.shift();
    if (!id) { achBusy = false; return; }
    achBusy = true;
    const a = Fun.ACHIEVEMENTS.find(x => x.id === id), el = $('#achPop');
    $('#apE').textContent = a.e; $('#apN').textContent = a.n;
    restart(el, 'on');
    sfx('achieve');
    setTimeout(() => confetti(innerWidth / 2, 64, 60), 160);
    setTimeout(() => { el.classList.remove('on'); setTimeout(nextAch, 450); }, 3200);
  }
  function updAchCount() { $('#achCount').textContent = `${unlocked.length}/${Fun.ACHIEVEMENTS.length}`; }
  function openAch() {
    const n = unlocked.length, t = Fun.ACHIEVEMENTS.length;
    $('#achSub').textContent = `Открыто ${n} из ${t}${n === t ? ' — вы легенда' : ''}`;
    $('#achList').innerHTML = Fun.ACHIEVEMENTS.map((a, i) => {
      const on = unlocked.includes(a.id);
      return `<div class="achi${on ? ' on' : ''}" style="animation-delay:${i * 22}ms"><span class="ae">${on ? a.e : '🔒'}</span><div><b>${esc(a.n)}</b><small>${esc(a.d)}</small></div></div>`;
    }).join('');
    $('#achBar').style.width = '0';
    openModal('#achModal');
    requestAnimationFrame(() => requestAnimationFrame(() => ($('#achBar').style.width = (n / t * 100) + '%')));
  }
  $('#achClose').onclick = closeModal;
  /** Awards that depend on the picture itself, checked on every commit. */
  function checkState() {
    const e = effective(state);
    if (e.saturation >= 100) award('eyes');
    if (e.jpeg >= 100) award('shakal');
    if (e.gameboy > 0 || e.pixel > 0) award('pixel');
    if (state.ink.filter(s => s.t === 'sticker').length >= 10) award('stickers');
    if (state.meme.top || state.meme.bottom) award('meme');
    if (!Tone.curveIsIdentity(state.curve)) award('curves');
  }

  // ---------- Confetti ----------
  const cfCv = $('#confetti');
  let cf = [], cfRaf = 0;
  function confetti(x, y, n) {
    if (!settings.anim) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cfCv.width !== Math.round(innerWidth * dpr) || cfCv.height !== Math.round(innerHeight * dpr)) {
      cfCv.width = Math.round(innerWidth * dpr); cfCv.height = Math.round(innerHeight * dpr);
    }
    const cols = [accentHex(), '#ff5a4f', '#3ddc6a', '#3d9bff', '#ffa726', '#c77dff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95, v = 6 + Math.random() * 10;
      cf.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, c: cols[i % cols.length], life: 0, round: Math.random() < 0.25 });
    }
    if (!cfRaf) cfRaf = requestAnimationFrame(cfStep);
  }
  function cfStep() {
    const x = cfCv.getContext('2d'), dpr = cfCv.width / innerWidth;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, innerWidth, innerHeight);
    cf = cf.filter(p => p.y < innerHeight + 40 && p.life < 240);
    for (const p of cf) {
      p.life++; p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save();
      x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(p.life * 0.15 + p.r));
      x.globalAlpha = Math.min(1, (240 - p.life) / 40);
      x.fillStyle = p.c;
      if (p.round) { x.beginPath(); x.arc(0, 0, p.w / 2, 0, 7); x.fill(); } else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    }
    cfRaf = cf.length ? requestAnimationFrame(cfStep) : 0;
  }

  // ---------- Before / after split ----------
  const splitEl = $('#split');
  function renderSplit() {
    const key = [cv.width, cv.height, ...GEOM.map(k => state[k])].join('|');
    if (key === split.key) return;
    Engine.render(orig, src, { ...effective(state), ...zeroAdj() }, PREVIEW, true);
    split.key = key;
  }
  function setSplitX(x) { split.x = clamp(x, 0.02, 0.98); photo.style.setProperty('--sx', (split.x * 100).toFixed(2) + '%'); }
  function toggleSplit(on) {
    if (!src) return;
    split.on = on ?? !split.on;
    split.key = '';
    if (split.on) renderSplit();
    photo.classList.toggle('split-on', split.on);
    $('#splitBtn').classList.toggle('on', split.on);
    setSplitX(split.x);
    sfx(split.on ? 'on' : 'off');
  }
  const splitDrag = e => { const r = photo.getBoundingClientRect(); setSplitX((e.clientX - r.left) / r.width); };
  photo.addEventListener('pointerdown', e => {
    if (!split.on || e.button !== 0 || tab === TAB.draw || sticker || zoom !== 1) return;
    splitEl.setPointerCapture(e.pointerId); splitEl.classList.add('drag'); splitDrag(e);
  });
  splitEl.addEventListener('pointerdown', e => { e.stopPropagation(); splitEl.setPointerCapture(e.pointerId); splitEl.classList.add('drag'); });
  splitEl.addEventListener('pointermove', e => { if (splitEl.hasPointerCapture(e.pointerId)) splitDrag(e); });
  ['pointerup', 'pointercancel'].forEach(ev => splitEl.addEventListener(ev, () => splitEl.classList.remove('drag')));
  $('#splitBtn').onclick = () => toggleSplit();
  // The compare path renders the same neutral frame into #orig, so the split must repaint after it.
  cmp.addEventListener('pointerup', () => (split.key = ''));

  // ---------- Composition grids ----------
  const GRIDS = ['off', 'thirds', 'golden', 'grid', 'diag'];
  const GRID_N = { off: 'выключена', thirds: 'правило третей', golden: 'золотое сечение', grid: 'сетка 6×6', diag: 'диагонали' };
  let gridMode = 'off';
  const gl = (a, b, c, d) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`;
  function gridSvg(m) {
    const cross = vs => vs.map(v => gl(v, 0, v, 100) + gl(0, v, 100, v)).join('');
    if (m === 'thirds') return cross([100 / 3, 200 / 3]);
    if (m === 'golden') return cross([38.2, 61.8]);
    if (m === 'grid') return cross([1, 2, 3, 4, 5].map(i => i * 100 / 6));
    if (m === 'diag') return gl(0, 0, 100, 100) + gl(100, 0, 0, 100) + gl(0, 50, 50, 0) + gl(50, 100, 100, 50);
    return '';
  }
  $('#gridOv .gfine').innerHTML = Array.from({ length: 11 }, (_, i) => (i + 1) * 100 / 12).map(v => gl(v, 0, v, 100) + gl(0, v, 100, v)).join('');
  function setGrid(m) {
    gridMode = m;
    $('#gridOv .gmain').innerHTML = gridSvg(m);
    photo.classList.toggle('grid-on', m !== 'off');
    $('#gridBtn').classList.toggle('on', m !== 'off');
  }
  function cycleGrid() {
    setGrid(GRIDS[(GRIDS.indexOf(gridMode) + 1) % GRIDS.length]);
    sfx(gridMode === 'off' ? 'off' : 'select');
    toast(`Сетка: ${GRID_N[gridMode]}`);
  }
  $('#gridBtn').onclick = cycleGrid;
  // While the straighten dial is held a fine grid appears, so horizons have something to line up to.
  $('#dialStr').addEventListener('pointerdown', () => photo.classList.add('aligning'));
  addEventListener('pointerup', () => photo.classList.remove('aligning'));

  // ---------- Clipping warning & sound toggle ----------
  function toggleClip() {
    if (!src) return;
    clipOn = !clipOn;
    $('#clipBtn').classList.toggle('on', clipOn);
    drawNow(); sfx(clipOn ? 'on' : 'off');
    toast(clipOn ? 'Пересветы — красным, провалы — синим' : 'Подсветка пересветов выключена');
  }
  $('#clipBtn').onclick = toggleClip;
  function toggleSound() {
    settings.sound = !settings.sound;
    applySettings();
    if (settings.sound) sfx('on');
    toast(settings.sound ? 'Звук включён' : 'Звук выключен');
  }
  $('#soundBtn').onclick = toggleSound;

  // ---------- Status bar: size, edits and the colour under the cursor ----------
  const stPix = $('#stPix');
  function updStatus() {
    if (!src || !fullImg) return;
    const L = exportDims('orig');
    $('#stDims').textContent = `${L.w} × ${L.h}`;
    $('#stEdits').textContent = hi ? `${hi} ${plural(hi, 'правка', 'правки', 'правок')}` : 'без правок';
  }
  let pixRaf = 0;
  photo.addEventListener('pointermove', e => {
    if (!src || !cv.width) return;
    cancelAnimationFrame(pixRaf);
    pixRaf = requestAnimationFrame(() => {
      const r = photo.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * cv.width), y = Math.floor((e.clientY - r.top) / r.height * cv.height);
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
      const d = frameCv().getContext('2d').getImageData(x, y, 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      $('#stSw').style.background = hex;
      $('#stHex').textContent = hex.toUpperCase();
      $('#stRgb').textContent = `${d[0]} · ${d[1]} · ${d[2]}`;
      stPix.classList.add('on');
    });
  });
  photo.addEventListener('pointerleave', () => { cancelAnimationFrame(pixRaf); stPix.classList.remove('on'); });

  // ---------- History panel ----------
  const histPop = $('#histPop');
  function renderHistList() {
    $('#hlist').innerHTML = labels.map((l, i) =>
      `<button class="hrow${i === hi ? ' on' : ''}${i > hi ? ' future' : ''}" data-i="${i}"><i>${i || '•'}</i><span>${esc(l)}</span></button>`).reverse().join('');
  }
  function toggleHistPop(on) {
    on = on ?? !histPop.classList.contains('open');
    if (on) {
      const r = $('#histList').getBoundingClientRect();
      histPop.style.left = clamp(r.left - 20, 12, Math.max(12, innerWidth - 292)) + 'px';
      histPop.style.top = (r.bottom + 12) + 'px';
      togglePop(false); toggleMenu(false); hideTip();
      renderHistList();
    }
    histPop.classList.toggle('open', on);
    $('#histList').classList.toggle('on', on);
    updatePromoVeil();
  }
  $('#histList').addEventListener('click', e => { e.stopPropagation(); toggleHistPop(); });
  histPop.addEventListener('click', e => {
    e.stopPropagation();
    const b = e.target.closest('.hrow');
    if (!b) return;
    // A pending debounced edit commits first and drops the redo branch — a clicked future row is then gone.
    const i = +b.dataset.i, was = hi;
    commit();
    if (hi !== was && i > was) return renderHistList();
    goTo(i);
  });
  document.addEventListener('click', () => toggleHistPop(false));

  // ---------- Copy / paste the look ----------
  function copySettings() {
    if (!src) return;
    const c = { curve: state.curve, hsl: state.hsl, preset: state.preset, amt: state.amt };
    ADJ.forEach(k => (c[k] = state[k]));
    store.set('lumen.clip', c);
    sfx('select');
    toast('Настройки скопированы — вставьте в другой кадр через Ctrl ⇧ V');
  }
  function pasteSettings() {
    const c = store.get('lumen.clip', null);
    if (!src || !c || typeof c !== 'object') return toast('Сначала скопируйте настройки', null, null, true);
    cancelAnimationFrame(tw);
    const next = { ...state };
    ADJ.forEach(k => { if (Number.isFinite(+c[k])) next[k] = clamp(+c[k], LIM[k][0], LIM[k][1]); });
    if (allPresets().some(p => p.id === c.preset)) next.preset = c.preset;
    if (Number.isFinite(+c.amt)) next.amt = clamp(+c.amt, 0, 100);
    next.curve = Tone.cleanCurve(c.curve); next.hsl = Tone.cleanHsl(c.hsl);
    crossfade(() => (state = next));
    syncUI(); commit('Вставка настроек'); sfx('success');
    toast('Настройки вставлены', 'Отменить', () => go(-1));
  }
  function applyPreset(id) {
    if (!src || id === state.preset) return;
    crossfade(() => { state.preset = id; state.amt = 100; });
    syncUI(); commit();
    if (id === 'noir') award('noir');
  }

  // ---------- Colour: curves, HSL mixer, split toning ----------
  const colorPanel = $('.panel.color'), curveCv = $('#curveCv');
  const CH_COL = { m: '#f2f2f7', r: '#ff5a4f', g: '#3ddc6a', b: '#3d9bff' };
  let curveCh = 'm', band = 0, colorMode = 'hsl', curveDrag = -1, curveOut = false, curveTickY = 0, curveLum = null, curveT = 0;
  function schedCurve() { clearTimeout(curveT); curveT = setTimeout(() => drawCurve(true), 140); }
  function curveHist() {
    if (!cv.width) return null;
    const w = 160, h = Math.max(1, Math.round(w * cv.height / cv.width)), t = document.createElement('canvas');
    t.width = w; t.height = h;
    const x = t.getContext('2d', { willReadFrequently: true });
    x.drawImage(frameCv(), 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, H = new Float32Array(64);
    for (let i = 0; i < d.length; i += 4) H[(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) >> 2]++;
    const mx = Math.max(1, ...H.slice(1, 63));
    return H.map(v => Math.min(1, Math.sqrt(v / mx)));
  }
  const CP = 9;
  function drawCurve(withHist) {
    if (tab !== TAB.color) return;
    if (withHist || !curveLum) curveLum = curveHist();
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = curveCv.clientWidth || 170, H = curveCv.clientHeight || 170;
    if (curveCv.width !== Math.round(W * dpr) || curveCv.height !== Math.round(H * dpr)) { curveCv.width = Math.round(W * dpr); curveCv.height = Math.round(H * dpr); }
    const x = curveCv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);
    const w = W - CP * 2, h = H - CP * 2, X = v => CP + v * w, Y = v => CP + (1 - v) * h;
    if (curveLum) {
      x.beginPath(); x.moveTo(X(0), Y(0));
      curveLum.forEach((v, i) => x.lineTo(X(i / 63), Y(v * 0.92)));
      x.lineTo(X(1), Y(0)); x.closePath();
      x.fillStyle = 'rgba(255,255,255,.1)'; x.fill();
    }
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; x.beginPath();
    for (let i = 1; i < 4; i++) { x.moveTo(X(i / 4), Y(0)); x.lineTo(X(i / 4), Y(1)); x.moveTo(X(0), Y(i / 4)); x.lineTo(X(1), Y(i / 4)); }
    x.stroke();
    x.setLineDash([3, 4]); x.strokeStyle = 'rgba(255,255,255,.2)';
    x.beginPath(); x.moveTo(X(0), Y(0)); x.lineTo(X(1), Y(1)); x.stroke(); x.setLineDash([]);
    const line = (k, alpha, lw) => {
      const s = Tone.sample(state.curve[k], 128);
      x.beginPath();
      s.forEach((v, i) => (i ? x.lineTo(X(i / 127), Y(v)) : x.moveTo(X(0), Y(v))));
      x.strokeStyle = CH_COL[k]; x.globalAlpha = alpha; x.lineWidth = lw; x.stroke(); x.globalAlpha = 1;
    };
    Tone.CHANNELS.forEach(k => { if (k !== curveCh && !Tone.isIdentity(state.curve[k])) line(k, 0.35, 1.2); });
    line(curveCh, 1, 2);
    state.curve[curveCh].forEach(([px, py], i) => {
      x.beginPath(); x.arc(X(px), Y(py), i === curveDrag ? 6 : 4.5, 0, 7);
      x.fillStyle = i === curveDrag ? CH_COL[curveCh] : '#141418'; x.fill();
      x.lineWidth = 2; x.strokeStyle = CH_COL[curveCh]; x.stroke();
    });
  }
  const curvePt = e => {
    const r = curveCv.getBoundingClientRect();
    return [clamp((e.clientX - r.left - CP) / (r.width - 2 * CP), 0, 1), clamp(1 - (e.clientY - r.top - CP) / (r.height - 2 * CP), -0.25, 1.25)];
  };
  const nearPoint = (e, pts) => {
    const [px, py] = curvePt(e), r = curveCv.getBoundingClientRect();
    return pts.findIndex(([qx, qy]) => Math.hypot((qx - px) * (r.width - 2 * CP), (qy - py) * (r.height - 2 * CP)) < 12);
  };
  function setCurve(pts) { state.curve = { ...state.curve, [curveCh]: pts }; draw(); drawCurve(false); }
  curveCv.addEventListener('pointerdown', e => {
    if (!src || e.button !== 0) return;
    const [px, py] = curvePt(e), pts = state.curve[curveCh], near = nearPoint(e, pts);
    if (near >= 0) curveDrag = near;
    else {
      const res = Tone.addPoint(pts, px, clamp(py, 0, 1));
      if (res.index < 0) return toast(`Не больше ${Tone.MAX_POINTS} точек на кривой`, null, null, true);
      curveDrag = res.index; setCurve(res.points); sfx('pop', { gain: 0.5 });
    }
    curveCv.setPointerCapture(e.pointerId);
    curveOut = false; curveTickY = Math.round(clamp(py, 0, 1) * 24);
    drawCurve(false);
  });
  curveCv.addEventListener('pointermove', e => {
    if (curveDrag < 0) return;
    const [px, py] = curvePt(e), pts = state.curve[curveCh];
    // Drag an inner point off the top or bottom to delete it, like in Photoshop.
    curveOut = curveDrag > 0 && curveDrag < pts.length - 1 && (py < -0.12 || py > 1.12);
    curveCv.classList.toggle('del', curveOut);
    setCurve(Tone.movePoint(pts, curveDrag, px, py));
    const ty = Math.round(clamp(py, 0, 1) * 24);
    if (ty !== curveTickY) { curveTickY = ty; sfx('tick', { rate: 0.9 + clamp(py, 0, 1) * 0.22, gain: 0.6 }); }
  });
  const curveUp = () => {
    if (curveDrag < 0) return;
    if (curveOut) { setCurve(Tone.removePoint(state.curve[curveCh], curveDrag)); sfx('close'); }
    curveDrag = -1; curveOut = false; curveCv.classList.remove('del');
    drawCurve(false); commit('Кривые');
  };
  curveCv.addEventListener('pointerup', curveUp);
  curveCv.addEventListener('pointercancel', curveUp);
  curveCv.addEventListener('dblclick', e => {
    const pts = state.curve[curveCh], near = nearPoint(e, pts);
    if (near > 0 && near < pts.length - 1) { setCurve(Tone.removePoint(pts, near)); commit('Кривые'); }
  });
  function segPick(sel, v) {
    [...document.querySelectorAll(sel + ' button')].forEach((b, i) => {
      const on = b.dataset.v === v;
      b.classList.toggle('on', on);
      if (on) $(sel + ' .pill').style.transform = `translateX(${i * 100}%)`;
    });
  }
  $('#curveCh').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === curveCh) return;
    curveCh = b.dataset.v; segPick('#curveCh', curveCh); sfx('select'); drawCurve(false);
  });
  function setColorMode(m) {
    colorMode = m; segPick('#colorMode', m);
    $$('.cpane').forEach(p => p.classList.toggle('on', p.dataset.cp === m));
  }
  $('#colorMode').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && b.dataset.v !== colorMode) { sfx('select'); setColorMode(b.dataset.v); }
  });
  $('#bands').innerHTML = Tone.BANDS.map((b, i) => `<button class="band" data-i="${i}" style="--c:${b.c}" data-tip="${b.n}" aria-label="${b.n}"><i></i></button>`).join('');
  $$('#bands .band').forEach(bindTip);
  function selBand(i) { band = i; syncColor(); }
  $('#bands').addEventListener('click', e => {
    const b = e.target.closest('.band');
    if (b && +b.dataset.i !== band) { sfx('select'); selBand(+b.dataset.i); }
  });
  const setRangeP = (r, v) => r.style.setProperty('--p', ((v - r.min) / (r.max - r.min) * 100) + '%');
  function syncColor() {
    segPick('#curveCh', curveCh);
    $$('#bands .band').forEach((b, i) => { b.classList.toggle('on', i === band); b.classList.toggle('has', state.hsl[i].some(v => v)); });
    colorPanel.style.setProperty('--band', Tone.BANDS[band].c);
    $$('[data-hsl]').forEach(r => {
      const v = state.hsl[band][+r.dataset.hsl];
      r.value = v; setRangeP(r, v);
      r.closest('label').querySelector('b').textContent = fmt(v);
    });
    $$('[data-g]').forEach(r => {
      const k = r.dataset.g, v = Math.round(state[k]);
      r.value = v; setRangeP(r, v);
      r.closest('label').querySelector('b').textContent = GRADE[k][1] === 360 ? v + '°' : k === 'gBal' ? fmt(v) : v + '%';
    });
    colorPanel.style.setProperty('--shc', `hsl(${state.shHue} 90% 55%)`);
    colorPanel.style.setProperty('--hic', `hsl(${state.hiHue} 90% 55%)`);
    if (tab === TAB.color) drawCurve(false);
  }
  colorPanel.addEventListener('input', e => {
    const r = e.target;
    if (r.dataset.hsl != null) { const h = state.hsl.map(b => b.slice()); h[band][+r.dataset.hsl] = +r.value; state.hsl = h; }
    else if (r.dataset.g) state[r.dataset.g] = +r.value;
    else return;
    rangeTick(r); syncColor(); draw();
  });
  colorPanel.addEventListener('change', e => {
    if (e.target.dataset.hsl != null) commit(`HSL: ${Tone.BANDS[band].n.toLowerCase()}`);
    else if (e.target.dataset.g) commit();
  });
  $('#curvePre').addEventListener('click', e => {
    const b = e.target.closest('[data-cv]');
    if (!b || !src) return;
    sfx('select');
    const lin = b.dataset.cv === 'linear';
    state.curve = lin ? Tone.freshCurve() : { ...state.curve, m: Tone.CURVE_PRESETS[b.dataset.cv].map(p => p.slice()) };
    curveCh = 'm'; draw(); syncColor();
    commit(lin ? 'Кривые сброшены' : `Кривая: ${b.textContent.toLowerCase()}`);
  });
  $('#colorReset').onclick = () => {
    state.curve = Tone.freshCurve(); state.hsl = Tone.freshHsl();
    Object.keys(GRADE).forEach(k => (state[k] = 0));
    draw(); syncColor(); commit('Цвет сброшен'); sfx('undo');
  };
  setColorMode('hsl');

  // ---------- Fun: effect deck ----------
  const funChips = $('#funChips');
  let curFun = 'jpeg';
  funChips.innerHTML = FUNS.map(f => `<button class="chip fun" data-f="${f.k}"><div class="ring"><span class="ic emo">${f.e}</span><span class="num"></span>` +
    `<svg class="arc" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26"/></svg></div><span class="nm">${f.n}</span></button>`).join('');
  const dialFun = Dial($('#dialFun'), {
    min: 0, max: 100, value: 0,
    onInput: v => { state[curFun] = v; $('#funVal').textContent = Math.round(v); updFunChips(); draw(); },
    onChange: () => commit(),
  });
  function selectFun(k, anim) {
    curFun = k;
    $$('.chip[data-f]').forEach(c => c.classList.toggle('on', c.dataset.f === k));
    $('#funLbl').textContent = NAME[k];
    $('#funVal').textContent = Math.round(state[k]);
    dialFun.set(state[k], anim);
    if (anim) { restart($('#funHead'), 'swap'); centerIn($(`.chip[data-f="${k}"]`)); }
  }
  function updFunChips() {
    FUNS.forEach(f => {
      const c = funChips.querySelector(`[data-f="${f.k}"]`), v = state[f.k];
      c.querySelector('.arc circle').style.strokeDashoffset = 163.4 * (1 - v / 100);
      c.classList.toggle('has', Math.round(v) !== 0);
      c.querySelector('.num').textContent = Math.round(v);
    });
    $('#funReset').classList.toggle('show', Math.round(state[curFun]) !== 0);
  }
  function syncFun() { selectFun(curFun, false); updFunChips(); }
  funChips.addEventListener('click', e => {
    const c = e.target.closest('.chip[data-f]');
    if (!c || !src) return;
    const k = c.dataset.f;
    if (k !== curFun) { sfx('select'); selectFun(k, true); }
    // Tapping an effect that is off switches it on at a telling strength — nobody wants to hunt for it on the dial.
    if (!Math.round(state[k])) dialFun.animateTo(k === 'jpeg' ? 60 : 85);
  });
  funChips.addEventListener('dblclick', e => { const c = e.target.closest('.chip[data-f]'); if (c && c.dataset.f === curFun) dialFun.animateTo(0); });
  $('#funReset').onclick = () => dialFun.animateTo(0);

  // ---------- Fun: deep fry ----------
  let fryN = 0, fryT = 0;
  function fry() {
    if (!src) return;
    clearTimeout(fryT); fryT = setTimeout(() => (fryN = 0), 6000);
    fryN++;
    const t = {
      jpeg: clamp(state.jpeg + 18, 0, 100), saturation: clamp(state.saturation + 22, -100, 100), contrast: clamp(state.contrast + 16, -100, 100),
      sharpness: clamp(state.sharpness + 25, 0, 100), warmth: clamp(state.warmth + 8, -100, 100),
    };
    const add = Array.from({ length: Math.random() < 0.5 ? 2 : 1 }, () => Brush.makeSticker(Fun.FRY[Math.floor(Math.random() * Fun.FRY.length)],
      0.12 + Math.random() * 0.76, 0.12 + Math.random() * 0.76, 0.08 + Math.random() * 0.1, (Math.random() - 0.5) * 0.9));
    state.ink = [...state.ink, ...add];
    sfx('sizzle'); restart(photo, 'shake'); restart($('#fryBtn'), 'sizzling');
    tweenTo(t, 420, () => { commit(`Зажарка ×${fryN}`); if (fryN >= 5) award('fry'); });
    if (fryN === 1) toast('🔥 Жарим. Жмите ещё — будет хрустящее');
    else if (fryN === 5) toast('🔥🔥🔥 Well done. Пиксели обуглились');
  }
  $('#fryBtn').onclick = fry;

  // ---------- Fun: stickers ----------
  let sticker = null, stickSize = 14;
  const stickPop = $('#stickPop');
  $('#stickGrid').innerHTML = Fun.STICKERS.map(e => `<button class="stk" data-e="${e}">${e}</button>`).join('');
  function stickerMode(e) {
    sticker = e || null;
    photo.classList.toggle('sticking', !!sticker);
    $('#stickerBtn').classList.toggle('on', !!sticker);
    $$('.stk').forEach(b => b.classList.toggle('on', b.dataset.e === sticker));
    if (!sticker) stickPop.classList.remove('open');
    else photo.style.setProperty('--stk', `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><text x='20' y='29' font-size='28' text-anchor='middle'>${sticker}</text></svg>`)}") 20 20, crosshair`);
  }
  $('#stickerBtn').onclick = e => {
    e.stopPropagation();
    if (!stickPop.classList.contains('open')) {
      const r = $('#stickerBtn').getBoundingClientRect();
      stickPop.style.left = clamp(r.left + r.width / 2 - 160, 12, Math.max(12, innerWidth - 332)) + 'px';
      stickPop.style.top = (r.top - 12) + 'px';
      stickPop.classList.add('open');
      if (!sticker) stickerMode(Fun.STICKERS[0]);
      sfx('open');
    } else { stickerMode(null); sfx('close'); }
  };
  stickPop.addEventListener('click', e => {
    e.stopPropagation();
    const b = e.target.closest('.stk');
    if (b) { sfx('select'); stickerMode(b.dataset.e); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#stickPop')) stickPop.classList.remove('open'); });
  const stickSz = $('#stickSz');
  const syncStickSz = () => { stickSz.value = stickSize; setRangeP(stickSz, stickSize); $('#stickSzVal').textContent = stickSize + '%'; };
  stickSz.addEventListener('input', () => { stickSize = +stickSz.value; syncStickSz(); rangeTick(stickSz); });
  syncStickSz();
  photo.addEventListener('pointerdown', e => {
    if (!sticker || e.button !== 0 || !src) return;
    const [x, y] = inkPos(e);
    state.ink = [...state.ink, Brush.makeSticker(sticker, x, y, stickSize / 100, (Math.random() - 0.5) * 0.5)];
    paintInk(); commit();
    sfx('pop', { rate: 0.85 + Math.random() * 0.35 });
  });

  // ---------- Fun: meme captions ----------
  const MEMES = [['Когда открыл фоторедактор', 'и сразу нажал «Шакалы»'], ['Никто:', 'Абсолютно никто:'], ['Я фотограф', 'Я так вижу'],
    ['Ожидание', 'Реальность'], ['Это не баг', 'Это фича'], ['Когда в пятницу вечером', 'просят выйти в субботу'], ['Мама, смотри', 'я дизайнер'],
    ['Это фиаско', 'братан'], ['Сделал фото', 'Сделал хуже'], ['Кот одобрил', 'Значит шедевр']];
  function openMeme() {
    if (!src) return;
    $('#memeTop').value = state.meme.top; $('#memeBot').value = state.meme.bottom;
    openModal('#memeModal');
    setTimeout(() => $('#memeTop').focus(), 120);
  }
  function liveMeme() { state.meme = { top: $('#memeTop').value, bottom: $('#memeBot').value }; paintInk(); }
  ['#memeTop', '#memeBot'].forEach(s => {
    $(s).addEventListener('input', liveMeme);
    $(s).addEventListener('keydown', e => { if (e.key === 'Enter') $('#memeOk').click(); });
  });
  $('#memeRand').onclick = () => {
    const m = MEMES[Math.floor(Math.random() * MEMES.length)];
    $('#memeTop').value = m[0]; $('#memeBot').value = m[1];
    liveMeme(); sfx('die');
  };
  $('#memeOk').onclick = () => closeModal();
  $('#memeClear').onclick = () => { $('#memeTop').value = $('#memeBot').value = ''; liveMeme(); closeModal(); };
  $('#memeBtn').onclick = openMeme;

  // ---------- Fun: neural critic ----------
  const CR_STEPS = ['Считаю пиксели…', 'Сверяюсь с Моной Лизой…', 'Советуюсь с котом…', 'Спорю с гистограммой…', 'Ищу горизонт…', 'Нагреваю нейроны…', 'Вспоминаю правило третей…'];
  let crT = 0;
  function openCritic() {
    if (!src) return;
    award('critic');
    openModal('#criticModal');
    runCritic();
  }
  function runCritic() {
    clearTimeout(crT);
    const body = $('#crBody'), bot = $('#crBot');
    bot.textContent = '🧐'; bot.classList.add('think');
    const steps = [...CR_STEPS].sort(() => Math.random() - 0.5).slice(0, 3);
    body.innerHTML = `<div class="cr-load">${steps.map((s, i) => `<div class="cr-step" style="animation-delay:${i * 420}ms"><i></i>${s}</div>`).join('')}</div>`;
    crT = setTimeout(() => {
      const { d } = snapshot(300);
      const st = Analysis.summarize(d.data, 2), eff = effective(state);
      const r = Fun.critic(st, eff, {
        changed: TOOLS.filter(t => Math.round(eff[t.k]) !== 0).length,
        stickers: state.ink.filter(s => s.t === 'sticker').length,
        meme: !!(state.meme.top || state.meme.bottom),
      });
      const num = typeof r.score === 'number';
      bot.classList.remove('think');
      bot.textContent = !num ? '🦊' : r.score >= 8.5 ? '🤩' : r.score >= 6 ? '🙂' : r.score >= 4 ? '😐' : '😬';
      const stars = [1, 2, 3, 4, 5].map(i => `<i class="${i <= r.rating ? 'on' : ''}" style="animation-delay:${200 + i * 90}ms">★</i>`).join('');
      body.innerHTML = `<div class="cr-score"><b>${num ? String(r.score).replace('.', ',') : r.score}</b><span>/10</span></div>` +
        `<div class="cr-stars">${stars}</div><div class="cr-verdict">${esc(r.verdict)}</div>` +
        `<ul class="cr-lines">${r.lines.map((l, i) => `<li style="animation-delay:${650 + i * 260}ms">${esc(l)}</li>`).join('')}</ul>`;
      sfx(num && r.score < 4 ? 'error' : 'success');
      if (r.score === 10) { award('masterpiece'); setTimeout(() => confetti(innerWidth / 2, innerHeight / 2, 140), 300); }
    }, 1500);
  }
  $('#crAgain').onclick = runCritic;
  $('#crOk').onclick = closeModal;
  $('#crClose').onclick = closeModal;
  $('#criticBtn').onclick = openCritic;

  // ---------- Command palette ----------
  let palItems = [], palSel = 0;
  const lower = s => s.toLowerCase().replace(/ё/g, 'е');
  function commands() {
    const A = (n, g, run, k, ic) => ({ n, g, run, k: k || '', ic });
    return [
      A('Экспорт', 'Действие', openExport, 'Ctrl S', '⬇️'),
      A('Открыть фото', 'Действие', () => $('#file').click(), 'Ctrl O', '🖼️'),
      A('Отменить', 'Действие', () => go(-1), 'Ctrl Z', '↩️'),
      A('Повторить', 'Действие', () => go(1), 'Ctrl ⇧ Z', '↪️'),
      A('Сбросить все правки', 'Действие', () => $('#resetAll').click(), '', '🧽'),
      A('Автоулучшение', 'Действие', () => src && autoEnhance(), '', '✨'),
      A('Бросить кубик', 'Действие', () => $('#dice').click(), 'R', '🎲'),
      A('Умная обрезка', 'Кадр', () => $('#smartCrop').click(), 'C', '✂️'),
      A('Повернуть на 90°', 'Кадр', () => $('[data-act="rotL"]').click(), '', '🔄'),
      A('Отразить по горизонтали', 'Кадр', () => $('[data-act="flipH"]').click(), '', '↔️'),
      A('Сравнение шторкой', 'Вид', () => toggleSplit(), 'Y', '🪟'),
      A('Сетка композиции', 'Вид', cycleGrid, 'O', '#️⃣'),
      A('Пересветы и провалы', 'Вид', toggleClip, 'J', '⚠️'),
      A('Гистограмма', 'Вид', () => toggleHist(), 'H', '📶'),
      A('Графики и диаграммы', 'Вид', openCharts, 'G', '📊'),
      A('Об изображении', 'Вид', openInfo, 'I', 'ℹ️'),
      A('История правок', 'Вид', () => toggleHistPop(true), 'L', '🕘'),
      A('Приблизить', 'Вид', () => setZoom(zoom * 1.5), '+', '🔍'),
      A('Сменить тему', 'Приложение', () => $('#themeBtn').click(), 'T', '🌓'),
      A('Настройки приложения', 'Приложение', openSettings, ',', '⚙️'),
      A('Включить или выключить звук', 'Приложение', toggleSound, 'M', '🔊'),
      A('Горячие клавиши', 'Приложение', openKeys, '?', '⌨️'),
      A('Достижения', 'Приложение', openAch, '', '🏆'),
      A('Скопировать настройки', 'Приложение', copySettings, 'Ctrl ⇧ C', '📋'),
      A('Вставить настройки', 'Приложение', pasteSettings, 'Ctrl ⇧ V', '📥'),
      A('Показать обучение', 'Приложение', startTour, '', '🎓'),
      A('Зажарить', 'Приколы', fry, 'F', '🔥'),
      A('Мем-текст', 'Приколы', openMeme, '', '💬'),
      A('Нейрокритик', 'Приколы', openCritic, '', '🧐'),
      A('Стикеры', 'Приколы', () => { setTab(TAB.fun); stickerMode(sticker || Fun.STICKERS[0]); }, '', '😎'),
      A('Кривые', 'Цвет', () => setTab(TAB.color), '', '📈'),
      A('Тонирование теней и светов', 'Цвет', () => { setTab(TAB.color); setColorMode('grade'); }, '', '🌗'),
      ...Tone.BANDS.map((b, i) => A(`HSL: ${b.n.toLowerCase()}`, 'Цвет', () => { setTab(TAB.color); setColorMode('hsl'); selBand(i); }, '', '🎨')),
      ...TOOLS.map(t => A(t.n, 'Настройка', () => { setTab(TAB.adj); selectTool(t.k, true); }, '', '🎛️')),
      ...FUNS.map(f => A(f.n, 'Эффект', () => { setTab(TAB.fun); selectFun(f.k, true); }, '', f.e)),
      ...allPresets().map(p => A(p.n, 'Фильтр', () => applyPreset(p.id), '', '🎞️')),
      ...Object.keys(SCENES).map(k => A(SCENES[k], 'Пример', () => loadScene(k), '', '🏞️')),
    ];
  }
  function renderPalette() {
    const toks = lower($('#palQ').value.trim()).split(/\s+/).filter(Boolean), all = commands();
    palItems = !toks.length ? all.slice(0, 40) : all.map(c => {
      const hay = lower(c.n + ' ' + c.g), n = lower(c.n);
      if (!toks.every(t => hay.includes(t))) return null;
      return { c, s: n.startsWith(toks[0]) ? 0 : n.split(/[\s:]+/).some(w => w.startsWith(toks[0])) ? 1 : 2 };
    }).filter(Boolean).sort((a, b) => a.s - b.s).map(x => x.c).slice(0, 40);
    palSel = clamp(palSel, 0, Math.max(0, palItems.length - 1));
    $('#palList').innerHTML = palItems.map((c, i) =>
      `<button class="pal-row${i === palSel ? ' on' : ''}" data-i="${i}" role="option"><em>${c.ic}</em><span>${esc(c.n)}</span><small>${esc(c.g)}</small>${c.k ? `<kbd>${esc(c.k)}</kbd>` : ''}</button>`).join('') ||
      '<div class="pal-empty">Ничего не нашлось. Попробуйте «кривые» или «шакал»</div>';
  }
  function markPal() {
    $$('.pal-row').forEach((r, i) => r.classList.toggle('on', i === palSel));
    const on = $('.pal-row.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    $('#palQ').value = ''; palSel = 0; renderPalette();
    openModal('#paletteModal');
    setTimeout(() => $('#palQ').focus(), 50);
    award('hacker');
  }
  function runPal(i) {
    const c = palItems[i];
    if (!c) return;
    closeModal(true);
    setTimeout(c.run, 30);
  }
  $('#palQ').addEventListener('input', () => { palSel = 0; renderPalette(); });
  $('#palQ').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      palSel = clamp(palSel + (e.key === 'ArrowDown' ? 1 : -1), 0, Math.max(0, palItems.length - 1));
      markPal(); sfx('tick', { gain: 0.7 });
    } else if (e.key === 'Enter') { e.preventDefault(); runPal(palSel); }
  });
  $('#palList').addEventListener('click', e => { const r = e.target.closest('.pal-row'); if (r) runPal(+r.dataset.i); });
  $('#palList').addEventListener('pointermove', e => {
    const r = e.target.closest('.pal-row');
    if (r && +r.dataset.i !== palSel) { palSel = +r.dataset.i; markPal(); }
  });
  $('#paletteBtn').onclick = openPalette;

  // ---------- Shortcuts sheet ----------
  const KEYS = [
    ['Правка', [['Ctrl Z', 'Отменить'], ['Ctrl ⇧ Z', 'Повторить'], ['Ctrl ⇧ C', 'Скопировать настройки'], ['Ctrl ⇧ V', 'Вставить настройки'], ['R', 'Бросить кубик'], ['C', 'Умная обрезка'], ['F', 'Зажарить']]],
    ['Вид', [['Пробел', 'Оригинал, пока удерживаете'], ['Y', 'Сравнение шторкой'], ['O', 'Сетка композиции'], ['J', 'Пересветы и провалы'], ['H', 'Гистограмма'], ['G', 'Графики'], ['I', 'Об изображении'], ['L', 'История правок'], ['+ − 0', 'Зум']]],
    ['Приложение', [['Ctrl K', 'Палитра команд'], ['Ctrl O', 'Открыть фото'], ['Ctrl S', 'Экспорт'], ['1…6', 'Вкладки'], ['T', 'Тема'], ['M', 'Звук'], [',', 'Настройки'], ['?', 'Эта шпаргалка'], ['Esc', 'Закрыть окно']]],
  ];
  function openKeys() {
    $('#keysList').innerHTML = KEYS.map(([g, list]) => `<div class="kgroup"><h3>${g}</h3><div class="rows">${list.map(([k, d]) =>
      `<div class="krow"><span>${esc(d)}</span><span class="kk">${k.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join('')}</span></div>`).join('')}</div></div>`).join('');
    openModal('#keysModal');
  }
  $('#keysClose').onclick = closeModal;

  // ---------- Easter eggs ----------
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let kI = 0, partyT = 0;
  function konami(e) {
    kI = e.code === KONAMI[kI] ? kI + 1 : e.code === KONAMI[0] ? 1 : 0;
    if (kI === KONAMI.length) { kI = 0; party(); }
  }
  function party() {
    award('konami');
    document.body.classList.add('party');
    sfx('achieve');
    for (let i = 0; i < 5; i++) setTimeout(() => confetti(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * 0.4, 70), i * 260);
    toast('🎮 Режим вечеринки: +30 к вайбу');
    clearTimeout(partyT); partyT = setTimeout(() => document.body.classList.remove('party'), 9000);
  }
  if (document.fonts) Promise.all(['40px Anton', '40px VT323'].map(f => document.fonts.load(f))).then(() => paintInk()).catch(() => {});
  updAchCount();

  // ---------- Boot ----------
  applySettings();
  applyZoom();
  toggleHist(histOn);
  selectTool('exposure', false);
  loadScene('day');
  if (!Engine.webgl) setTimeout(() => toast('WebGL недоступен — цветокоррекция отключена', null, null, true), 800);
  const seenTour = store.get('lumen.tour', 0);
  const hr = new Date().getHours();
  if (hr < 5) setTimeout(() => award('owl'), 4000);
  if (!seenTour) setTimeout(startTour, 950);
  else if (settings.promo && !store.get('lumen.promoHidden', false)) setTimeout(() => showPromo(true), 2600);
})();
