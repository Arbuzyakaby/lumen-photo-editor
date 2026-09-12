import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('../js/analysis.js', import.meta.url), 'utf8'), ctx);
const A = ctx.window.Analysis;

/** Deterministic generator so a failing roll can be reproduced. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fill = (n, f) => { const d = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) f(d, i * 4, i); return d; };

test('summarize: flat mid grey has no contrast, no colour and no clipping', () => {
  const s = A.summarize(fill(400, (d, i) => { d[i] = d[i + 1] = d[i + 2] = 128; d[i + 3] = 255; }), 1);
  assert.equal(s.n, 400);
  assert.ok(Math.abs(s.luma - 128 / 255) < 0.01);
  assert.ok(s.contrast < 0.01);
  assert.equal(s.saturation, 0);
  assert.equal(s.grayShare, 1);
  assert.equal(s.clipDark, 0);
  assert.equal(s.clipLight, 0);
  assert.equal(s.l.length, A.BINS);
  assert.equal(s.l[32], 400); // 128 >> 2
});

test('summarize: pure red lands in one hue bucket and counts as clipping-free colour', () => {
  const s = A.summarize(fill(100, (d, i) => { d[i] = 255; d[i + 3] = 255; }), 1);
  assert.equal(s.saturation, 1);
  assert.equal(s.grayShare, 0);
  assert.equal(s.hues[0], 100);
  assert.equal([...s.hues].filter(v => v > 0).length, 1);
  assert.ok(s.avg.r === 255 && s.avg.g === 0);
});

test('summarize: black and white halves clip on both ends', () => {
  const s = A.summarize(fill(200, (d, i, n) => { const v = n < 100 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }), 1);
  assert.equal(s.clipDark, 0.5);
  assert.equal(s.clipLight, 0.5);
  assert.ok(s.contrast > 0.9);
});

test('cumulative rises to exactly 1 and never falls', () => {
  const c = A.cumulative(Float32Array.from([1, 0, 3, 0, 6]));
  assert.equal(c.at(-1), 1);
  assert.ok(Math.abs(c[0] - 0.1) < 1e-6); // Float32Array, so compare with a tolerance
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1]);
  assert.deepEqual([...A.cumulative(new Float32Array(4))], [0, 0, 0, 0]); // empty histogram must not divide by zero
});

test('dominant returns the most common colours first with shares that sum to 1', () => {
  const d = fill(100, (x, i, n) => { const v = n < 70 ? 16 : 240; x[i] = x[i + 1] = x[i + 2] = v; x[i + 3] = 255; });
  const pal = A.dominant(d, 6, 1);
  assert.equal(pal.length, 2);
  assert.equal(pal[0].share, 0.7);
  assert.equal(pal[0].hex, '#101010');
  assert.equal(pal[1].hex, '#f0f0f0');
  assert.ok(Math.abs(pal.reduce((s, p) => s + p.share, 0) - 1) < 1e-6);
});

test('waveform is normalised and keeps columns in place', () => {
  const w = 8, h = 4;
  const d = fill(w * h, (x, i, n) => { const v = (n % w) < 4 ? 0 : 255; x[i] = x[i + 1] = x[i + 2] = v; x[i + 3] = 255; });
  const wave = A.waveform(d, w, h, 4);
  assert.equal(wave.cols, 4);
  assert.equal(wave.d.length, 4 * A.BINS);
  assert.ok(Math.max(...wave.d) === 1);
  assert.equal(wave.d[0 * A.BINS + 0], 1); // left half is black
  assert.equal(wave.d[3 * A.BINS + A.BINS - 1], 1); // right half is white
});

test('roll stays inside every setting range and touches only `keep` of them', () => {
  const rnd = seeded(7);
  for (let i = 0; i < 50; i++) {
    const keep = 1 + Math.floor(rnd() * 18);
    const out = A.roll(rnd, keep);
    assert.equal(Object.keys(out).length, A.ROLL.length);
    assert.ok(Object.values(out).filter(v => v !== 0).length <= keep);
    for (const spec of A.ROLL) {
      assert.ok(out[spec.k] >= spec.lo && out[spec.k] <= spec.hi, `${spec.k} = ${out[spec.k]}`);
      assert.equal(out[spec.k], Math.round(out[spec.k]));
    }
  }
  assert.ok(Object.values(A.roll(seeded(1))).filter(v => v !== 0).length <= 7); // no `keep` given — falls back to seven
  assert.ok(Object.values(A.roll(seeded(1), 99)).filter(v => v !== 0).length <= A.ROLL.length); // clamped to what exists
  assert.deepEqual(A.roll(seeded(42), 5), A.roll(seeded(42), 5)); // same seed, same look
});

test('painters only touch the context they are given', () => {
  const calls = [];
  const stub = new Proxy({}, {
    get(_, k) {
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'roundRect') return undefined; // exercise the rect fallback
      return (...a) => calls.push([k, ...a]);
    },
    set(_, k, v) { calls.push(['set', k, v]); return true; },
  });
  const s = A.summarize(fill(64, (d, i, n) => { d[i] = n * 4; d[i + 1] = 128; d[i + 2] = 255 - n * 4; d[i + 3] = 255; }), 1);
  A.drawHistogram(stub, 300, 120, s, 0.5);
  A.drawCurve(stub, 300, 120, A.cumulative(s.l), 0.5, '#ffd60a');
  A.drawRadar(stub, 240, 240, [{ n: 'a', v: 0.5 }, { n: 'b', v: -0.5 }, { n: 'c', v: 0 }], 0.5, '#ffd60a');
  A.drawBars(stub, 300, 60, [{ n: 'a', v: 0.5 }, { n: 'b', v: -1 }], 0.5, '#ffd60a');
  A.drawDonut(stub, 200, 200, [{ v: 1, c: '#f00' }, { v: 2, c: '#0f0' }], 0.5);
  A.drawWave(stub, 200, 100, A.waveform(fill(16, (d, i) => { d[i] = d[i + 1] = d[i + 2] = 90; d[i + 3] = 255; }), 4, 4, 4), 1);
  assert.ok(calls.filter(c => c[0] === 'clearRect').length >= 4);
  assert.ok(calls.some(c => c[0] === 'fill'));
  assert.ok(calls.some(c => c[0] === 'stroke'));
  assert.ok(calls.some(c => c[0] === 'rect')); // roundRect fallback was used
  A.drawBars(stub, 300, 60, [], 1, '#ffd60a'); // no changed settings — must not throw
});
