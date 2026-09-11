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
  const out = build('<style>x</style><script>a</script><script>b</script><script>c</script><script>d</script>');
  assert.ok(out.includes(read('js/app.js').trimEnd()));
  assert.throws(() => build('<style></style><script></script>'), /expected 4/);
});

test('every demo scene has a sample button, a title and a painter', () => {
  const scenes = [...html.matchAll(/data-scene="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(scenes, ['day', 'night', 'meadow', 'dunes', 'city', 'aurora']);
  const app = read('js/app.js'), src = read('js/scenes.js');
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

test('backdrop is not re-rendered on edits', () => {
  const app = read('js/app.js');
  assert.doesNotMatch(app, /ambientSoon/);
  assert.equal([...app.matchAll(/(?<!function )\bambient\(\)/g)].length, 1); // only called from setImage
});
