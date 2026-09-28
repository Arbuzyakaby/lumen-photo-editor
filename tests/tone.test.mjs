import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('../js/tone.js', import.meta.url), 'utf8'), ctx);
const T = ctx.window.Tone;
const J = x => JSON.parse(JSON.stringify(x));

test('identity curve gives an identity table', () => {
  const lut = T.lut(T.freshCurve());
  for (let i = 0; i < 256; i++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(lut[i * 4 + c] - i) <= 1, `${i}/${c}`);
  assert.ok(T.curveIsIdentity(T.freshCurve()));
});

test('curves stay monotone, even with a steep point in the middle', () => {
  for (const pts of [T.CURVE_PRESETS.scurve, T.CURVE_PRESETS.moody, [[0, 0], [0.2, 0.9], [0.25, 0.92], [1, 1]]]) {
    const s = T.sample(pts, 256);
    for (let i = 1; i < s.length; i++) assert.ok(s[i] >= s[i - 1] - 1e-6, `dip at ${i}`);
    assert.ok(Math.abs(s[0] - pts[0][1]) < 1e-6 && Math.abs(s[255] - pts[pts.length - 1][1]) < 1e-6);
  }
});

test('the master curve runs before each channel curve', () => {
  const lut = T.lut({ m: [[0, 0.5], [1, 0.5]], r: [[0, 0], [1, 1]], g: [[0, 1], [1, 0]], b: T.IDENT });
  assert.ok(Math.abs(lut[0] - 128) <= 1);        // r: flat master at 0.5
  assert.ok(Math.abs(lut[255 * 4 + 1] - 127) <= 1); // g: inverted 0.5
});

test('points: add, move within neighbours, remove, and sanitise junk', () => {
  let { points, index } = T.addPoint(T.IDENT, 0.5, 0.7);
  assert.equal(points.length, 3); assert.equal(index, 1);
  points = T.movePoint(points, 1, 5, 0.2);
  assert.ok(points[1][0] < 1 && points[1][1] === 0.2);
  points = T.movePoint(points, 0, 0.6, 0.1); // ends slide only vertically
  assert.deepEqual(J(points[0]), [0, 0.1]);
  assert.equal(T.removePoint(points, 1).length, 2);
  assert.equal(T.removePoint(points, 0).length, 3); // ends can't go
  assert.deepEqual(J(T.cleanPoints('x')), J(T.IDENT));
  assert.deepEqual(J(T.cleanPoints([[0.5, 2], [-1, 0]])), J([[0, 0], [0.5, 1]]));
  assert.ok(T.cleanPoints(Array.from({ length: 40 }, (_, i) => [i / 39, i / 39])).length <= T.MAX_POINTS);
});

test('HSL and toning helpers', () => {
  assert.ok(T.hslIsZero(T.freshHsl()));
  const h = T.cleanHsl([[500, -500, 'x']]);
  assert.deepEqual(J(h[0]), [100, -100, 0]);
  assert.equal(h.length, 8);
  const u = T.hslUniform(h);
  assert.equal(u.length, 24);
  assert.ok(Math.abs(u[0] - 40 * Math.PI / 180) < 1e-6);
  assert.ok(T.tint(200, 0).every(v => v === 0));
  const red = T.tint(0, 100);
  assert.ok(red[0] > 0 && red[1] < 0 && red[2] < 0);
});
