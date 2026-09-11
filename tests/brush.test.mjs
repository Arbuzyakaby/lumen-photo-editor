import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('../js/brush.js', import.meta.url), 'utf8'), ctx);
const B = ctx.window.Brush;

test('hsv ↔ hex round-trips primaries and greys', () => {
  assert.equal(B.hsvToHex(0, 100, 100), '#ff0000');
  assert.equal(B.hsvToHex(120, 100, 100), '#00ff00');
  assert.equal(B.hsvToHex(240, 100, 100), '#0000ff');
  assert.equal(B.hsvToHex(0, 0, 0), '#000000');
  assert.equal(B.hsvToHex(360, 0, 100), '#ffffff');
  for (const hex of ['#ff9500', '#34c759', '#5e5ce6', '#808080']) {
    const { h, s, v } = B.hexToHsv(hex);
    assert.equal(B.hsvToHex(h, s, v), hex);
  }
  assert.deepEqual({ ...B.hexToHsv('nope') }, { h: 0, s: 0, v: 0 });
});

test('sanitize clamps values and rejects unknown tools', () => {
  const b = B.sanitize({ tool: 'laser', size: 999, opacity: -4, soft: 'x', h: 400 });
  assert.equal(b.tool, 'brush');
  assert.equal(b.size, 120);
  assert.equal(b.opacity, 5);
  assert.equal(b.soft, B.DEFAULT.soft);
  assert.equal(b.h, 360);
  assert.equal(B.sanitize(null).tool, B.DEFAULT.tool);
});

test('presets: add, cap, remove, load untrusted storage', () => {
  let list = B.addPreset([], { tool: 'marker', size: 40 }, '  Мой маркер  ', 'p1');
  assert.equal(list.length, 1);
  assert.equal(list[0].n, 'Мой маркер');
  assert.equal(list[0].tool, 'marker');
  assert.equal(B.addPreset([], {}, '   ', 'p2')[0].n, 'Кисть');
  for (let i = 0; i < 40; i++) list = B.addPreset(list, {}, 'n' + i, 'x' + i);
  assert.equal(list.length, B.MAX_PRESETS);
  assert.equal(list.at(-1).id, 'x39');
  assert.equal(B.removePreset(list, 'x39').length, B.MAX_PRESETS - 1);
  assert.deepEqual([...B.loadPresets('garbage')], []);
  const loaded = B.loadPresets([{ id: 7, size: 5000 }, null, { n: 'no id' }]);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, '7');
  assert.equal(loaded[0].size, 120);
});

test('addPoint skips points closer than minD', () => {
  const s = B.makeStroke({ tool: 'brush' }, 0.01);
  assert.ok(B.addPoint(s, 0.1, 0.1, 0.05));
  assert.ok(!B.addPoint(s, 0.12, 0.1, 0.05));
  assert.ok(B.addPoint(s, 0.2, 0.1, 0.05));
  assert.equal(s.p.length, 4);
});

function mockCtx() {
  const log = [];
  const c = { log };
  for (const m of ['clearRect', 'save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'stroke'])
    c[m] = (...a) => log.push([m, ...a]);
  return new Proxy(c, { set(t, k, v) { log.push(['set', k, v]); t[k] = v; return true; } });
}

test('render: brush is soft & round, marker is hard, eraser cuts out', () => {
  const mk = tool => { const s = B.makeStroke({ tool, opacity: 100, soft: 50, h: 0, s: 100, v: 100 }, 0.02); s.p.push(0.1, 0.1, 0.5, 0.5, 0.9, 0.2); return s; };
  const c = mockCtx();
  B.render(c, [mk('brush'), mk('marker'), mk('eraser')], 1000, 500);
  const sets = k => c.log.filter(e => e[0] === 'set' && e[1] === k).map(e => e[2]);
  assert.deepEqual(sets('globalCompositeOperation'), ['source-over', 'source-over', 'destination-out']);
  assert.deepEqual(sets('lineCap'), ['round', 'square', 'round']);
  assert.equal(sets('lineWidth')[0], 20); // 0.02 × long side
  assert.equal(sets('filter').length, 2); // marker has no blur
  assert.ok(sets('globalAlpha')[1] <= 0.85);
  assert.equal(c.log.filter(e => e[0] === 'stroke').length, 3);
  assert.equal(sets('strokeStyle')[0], '#ff0000');
});

test('render skips empty strokes but still clears', () => {
  const c = mockCtx();
  B.render(c, [{ t: 'brush', p: [] }], 10, 10);
  assert.deepEqual(c.log.map(e => e[0]), ['clearRect']);
});
