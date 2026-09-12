import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from '../build.mjs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');

test('index.html is in sync with sources (run `npm run build`)', () => {
  assert.equal(html, build(html));
});

test('build keeps `$` sequences from sources literally', () => {
  const out = build('<style>x</style><script>a</script><script>b</script><script>c</script><script>d</script><script>e</script>');
  assert.ok(out.includes(read('js/app.js').trimEnd()));
  assert.ok(out.includes(read('js/analysis.js').trimEnd()));
  assert.throws(() => build('<style></style><script></script>'), /expected 5/);
});

test('every demo scene has a sample button, a title and a painter', () => {
  const scenes = [...html.matchAll(/data-scene="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(scenes, ['day', 'night', 'meadow', 'dunes', 'city', 'aurora', 'beach', 'fog']);
  const app = read('js/app.js'), src = read('js/scenes.js');
  // Scenes are painted large and shrunk once — without that the far detail aliases into shimmer.
  assert.match(src, /SS = 2/);
  assert.match(src, /function shrink\(/);
  assert.match(src, /cache\[k\] = shrink\(make\[k\]\(\)\)/);
  const titles = /const SCENES = \{([^}]*)\}/.exec(app)[1];
  for (const k of scenes) {
    assert.match(titles, new RegExp(`\\b${k}:`));
    assert.match(src, new RegExp(`function ${k}\\(`));
  }
});

test('drawing UI is wired: 4th tab, ink layer, all brush controls', () => {
  assert.match(html, /data-tab="3"/);
  assert.match(html, /data-panel="3"/);
  assert.match(html, /<canvas id="ink">/);
  for (const k of ['size', 'opacity', 'soft', 'h', 's', 'v']) assert.match(html, new RegExp(`data-b="${k}"`));
  for (const t of ['brush', 'marker', 'eraser']) assert.match(html, new RegExp(`data-bt="${t}"`));
  for (const id of ['brushHex', 'bpList', 'bpSave', 'brushModal', 'bpName', 'bpOk', 'inkUndo', 'inkClear', 'brushPrev', 'swatches'])
    assert.match(html, new RegExp(`id="${id}"`), id);
});

test('settings, about, charts, info, tour and promo are all wired up', () => {
  for (const id of ['settingsModal', 'aboutModal', 'chartsModal', 'infoModal', 'tour', 'promo', 'dice', 'die'])
    assert.match(html, new RegExp(`id="${id}"`), id);
  for (const id of ['statsBtn', 'infoBtn', 'settingsBtn', 'aboutBtn', 'promoX', 'btnTour', 'btnWipe', 'setAccent', 'setQ', 'setDice', 'themeBtn', 'setTheme',
    'menu', 'menuBtn', 'tourBtn', 'smartCrop', 'zoomBar', 'zoomIn', 'zoomOut', 'setFont', 'setAccentHex'])
    assert.match(html, new RegExp(`id="${id}"`), id);
  // Settings moved out of the samples popover into a menu of their own: check which block
  // each row actually sits in, not how close the two happen to be in the file.
  const samplesBlock = html.slice(html.indexOf('id="samples"'), html.indexOf('id="menu"'));
  const menuBlock = html.slice(html.indexOf('id="menu"'), html.indexOf('<!-- New preset -->'));
  assert.doesNotMatch(samplesBlock, /id="settingsBtn"|id="aboutBtn"/);
  assert.match(samplesBlock, /id="open2"/);
  for (const id of ['settingsBtn', 'tourBtn', 'aboutBtn']) assert.match(menuBlock, new RegExp(`id="${id}"`), id);
  for (const id of ['chHist', 'chCurve', 'chDonut', 'chRadar', 'chBars', 'chWave'])
    assert.match(html, new RegExp(`<canvas id="${id}">`), id);
  for (const k of ['ambient', 'anim', 'tips', 'promo']) assert.match(html, new RegExp(`data-set="${k}"`), k);
  assert.equal([...html.matchAll(/class="pip"/g)].length, 7); // seven pip positions cover every face
  assert.match(html, /rupolitcompass\.website/);
});

test('settings that are persisted are also sanitised on load', () => {
  const app = read('js/app.js');
  assert.match(app, /store\.get\('lumen\.settings'/);
  assert.match(app, /if \(!QUALITY\.includes\(settings\.quality\)\)/);
  assert.match(app, /if \(!THEMES\.includes\(settings\.theme\)\)/);
  assert.match(app, /settings\.dice = clamp\(/);
});

test('theme: three choices, «система» resolved in JS, CSS themed by attribute only', () => {
  const app = read('js/app.js'), css = read('css/style.css');
  assert.match(app, /const THEMES = \['system', 'light', 'dark'\]/);
  assert.match(app, /matchMedia\('\(prefers-color-scheme: light\)'\)/);
  assert.match(app, /document\.documentElement\.dataset\.theme = t;/);
  assert.match(app, /meta\[name="theme-color"\]/);
  // The stylesheet must not branch on the OS itself — otherwise an explicit choice would be
  // overridden by the system whenever the two disagree.
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /:root\[data-theme="light"\]/);
  for (const token of ['--glass-bg', '--solid', '--track', '--surface', '--needle', '--page'])
    assert.ok(css.split(`${token}:`).length >= 3, `${token} needs a value in both themes`);
});

test('crop offsets travel through geometry, history and the geo cache key', () => {
  const app = read('js/app.js'), eng = read('js/engine.js');
  assert.match(app, /const GEOM = \['rot', 'flipH', 'flipV', 'straighten', 'aspect', 'ox', 'oy'\]/);
  assert.match(app, /aspect: 'orig', ox: 0, oy: 0/); // a fresh state starts centred
  assert.match(eng, /s\.ox \|\| 0, s\.oy \|\| 0/);      // …and both are part of the cache key
  assert.match(eng, /-clamp\(s\.ox \|\| 0, -1, 1\) \* slackX/);
  assert.match(app, /state\.ox = 0; state\.oy = 0;/);  // changing the ratio recentres
});

test('fonts and zoom are wired end to end', () => {
  const css = read('css/style.css'), app = read('js/app.js');
  for (const v of ['modern', 'compact', 'creative']) assert.match(html, new RegExp(`data-v="${v}"`), v);
  assert.match(css, /:root\[data-font="compact"\]/);
  assert.match(css, /:root\[data-font="creative"\]/);
  assert.match(css, /body \{ letter-spacing: var\(--tracking\); \}/);
  assert.match(app, /if \(!FONTS\.includes\(settings\.font\)\)/);
  assert.match(app, /dataset\.font = settings\.font/);
  assert.match(app, /function setZoom\(/);
  assert.match(app, /clamp\(z, 1, 8\)/);
  assert.match(app, /zoom === 1 \? '' : `translate\(/);
});

test('backdrop is not re-rendered on edits', () => {
  const app = read('js/app.js');
  assert.doesNotMatch(app, /ambientSoon/);
  // Exactly two callers: a new image, and switching the backdrop back on in settings.
  // Anything more means an edit path is repainting it and making the whole background flash.
  assert.equal([...app.matchAll(/(?<!function )\bambient\(\)/g)].length, 2);
  assert.match(app, /setImage[\s\S]*?buildThumbs\(\); ambient\(\);/);
});
