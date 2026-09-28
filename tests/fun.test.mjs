import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = f => { const c = { window: {} }; vm.runInNewContext(readFileSync(new URL('../js/' + f, import.meta.url), 'utf8'), c); return c.window; };
const F = load('fun.js').Fun, S = load('sound.js').Sound;
const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const J = x => JSON.parse(JSON.stringify(x));
const stats = o => ({ luma: 0.45, contrast: 0.22, saturation: 0.3, grayShare: 0.2, clipDark: 0, clipLight: 0, ...o });

test('critic: a balanced frame scores well, a blown-out dark mess scores badly', () => {
  const good = F.critic(stats(), {}, { changed: 3 }, seeded(3));
  const bad = F.critic(stats({ luma: 0.1, clipDark: 0.3, clipLight: 0.2, contrast: 0.05 }), {}, { changed: 3 }, seeded(3));
  assert.ok(good.score >= 7, `good ${good.score}`);
  assert.ok(bad.score <= 3, `bad ${bad.score}`);
  for (const r of [good, bad]) {
    assert.equal(r.lines.length, 3);
    assert.equal(new Set(r.lines).size, 3);
    assert.ok(r.rating >= 0 && r.rating <= 5);
    assert.ok(!r.lines.some(l => /\{\w+\}/.test(l)), 'placeholders filled');
  }
});

test('critic: crushed JPEG gets the fox, fun effects get a comment', () => {
  const r = F.critic(stats(), { jpeg: 90 }, {}, seeded(1));
  assert.equal(r.score, '🦊');
  const v = F.critic(stats(), { vhs: 80 }, {}, seeded(1));
  assert.ok(typeof v.score === 'number' && v.score >= 1 && v.score <= 10);
});

test('achievements: unlock once, sanitise storage, collector comes last', () => {
  const list = [];
  assert.deepEqual(J(F.unlock(list, 'export')), ['export']);
  assert.deepEqual(J(F.unlock(list, 'export')), []);
  assert.deepEqual(J(F.unlock(list, 'nope')), []);
  assert.deepEqual([...F.cleanUnlocked(['export', 'export', 'hax', 5])], ['export']);
  assert.deepEqual([...F.cleanUnlocked('junk')], []);
  const rest = F.ACHIEVEMENTS.map(a => a.id).filter(id => id !== 'all' && id !== 'export');
  let last = [];
  for (const id of rest) last = F.unlock(list, id);
  assert.deepEqual(J(last), [rest[rest.length - 1], 'all']);
});

test('sound: every event in every pack renders finite, normalised audio', () => {
  for (const p of S.PACKS) for (const e of S.EVENTS) {
    const a = S.synth(e, p.id, 22050, 1);
    let peak = 0;
    for (const v of a) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.5 && peak <= 0.91, `${p.id}/${e} peak ${peak}`);
    assert.ok(S.LEVEL[e] > 0, e);
  }
  // Detents must stay the quietest thing in the app.
  assert.ok(Object.values(S.LEVEL).every(v => v >= S.LEVEL.tick));
});
