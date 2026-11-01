// @hawkesgen/analytics (index.mjs): queues calls until Hawkes Gen's script has run, adds the script tag once, starts
// it with the options, never throws, and does nothing without a window. The SDK itself: sdk.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeWindow() {
  const added: any[] = [];
  const el = (tag: string) => {
    const attrs: Record<string, string> = {};
    const on: Record<string, Function[]> = {};
    return {
      tag, attrs, on,
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      getAttribute: (k: string) => attrs[k] ?? null,
      addEventListener: (ev: string, fn: Function) => { (on[ev] ??= []).push(fn); },
      fire: (ev: string) => (on[ev] ?? []).forEach((f) => f()),
    } as any;
  };
  const head = { appendChild: (s: any) => added.push(s) };
  const w: any = {
    document: { head, documentElement: head, createElement: el, querySelector: () => null },
    setTimeout: () => 0,
  };
  return { w, added };
}

async function fresh() {
  // A new module instance per test (its "loading" promise is per page).
  return import(`../index.mjs?t=${Math.random()}`);
}

test('without a window every call does nothing and load resolves null', async () => {
  delete (globalThis as any).window;
  const m = await fresh();
  assert.equal(m.hawkesAnalytics.track('x'), undefined);
  assert.equal(m.hawkesAnalytics.config(), null);
  assert.equal(m.hawkesAnalytics.loaded(), false);
  assert.equal(await m.load({ product: 'p' }), null);
});

test('calls before the SDK wait in hawkesAnalyticsQ; load adds the script once with init first', async () => {
  const { w, added } = fakeWindow();
  (globalThis as any).window = w;
  const m = await fresh();
  m.hawkesAnalytics.levelStart(2);
  const p = m.load({ product: 'phorigins', build: '1.10.0', debug: true });
  m.load({ product: 'phorigins' });
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'https://hawkesgen.ai/sdk/analytics@1.js');
  assert.equal(added[0].attrs['data-hawkes-analytics'], 'npm');
  assert.deepEqual(w.hawkesAnalyticsQ[0], ['levelStart', 2]);
  assert.deepEqual(w.hawkesAnalyticsQ[1], ['init', { product: 'phorigins', build: '1.10.0', debug: true }]);
  // The SDK arrives: later calls go straight to it.
  const got: any[] = [];
  w.hawkesAnalytics = { version: 3, track: (...a: any[]) => got.push(['track', ...a]), death: (...a: any[]) => got.push(['death', ...a]), config: () => ({ product: 'phorigins' }), ask: async () => ({ id: 'a', rating: 5 }) };
  added[0].fire('load');
  assert.equal(await p, w.hawkesAnalytics);
  m.hawkesAnalytics.death('imp', { where: 'bridge' });
  assert.deepEqual(got, [['death', 'imp', { where: 'bridge' }]]);
  assert.equal(m.hawkesAnalytics.loaded(), true);
  assert.deepEqual(m.hawkesAnalytics.config(), { product: 'phorigins' });
  assert.deepEqual(await m.hawkesAnalytics.ask({ id: 'a', question: 'q' }), { id: 'a', rating: 5 });
  delete (globalThis as any).window;
});

test('a page that already has the script tag gets no second one; a failed load resolves null', async () => {
  const { w, added } = fakeWindow();
  const existing: any = { on: {} as Record<string, Function[]>, addEventListener(ev: string, fn: Function) { (this.on[ev] ??= []).push(fn); } };
  w.document.querySelector = (sel: string) => (sel.includes('hawkesgen.ai/sdk/analytics') ? existing : null);
  (globalThis as any).window = w;
  const m = await fresh();
  const p = m.load();
  assert.equal(added.length, 0);
  existing.on.error[0]();
  assert.equal(await p, null);
  assert.equal(w.hawkesAnalyticsQ, undefined, 'no options: nothing queued');
  delete (globalThis as any).window;
});

test('the queue is capped and a throwing SDK never reaches the game', async () => {
  const { w } = fakeWindow();
  (globalThis as any).window = w;
  const m = await fresh();
  for (let i = 0; i < 600; i++) m.hawkesAnalytics.track('e', { i });
  assert.equal(w.hawkesAnalyticsQ.length, 500);
  assert.deepEqual(w.hawkesAnalyticsQ[0], ['track', 'e', { i: 100 }]);
  w.hawkesAnalytics = { version: 3, track: () => { throw new Error('boom'); } };
  assert.doesNotThrow(() => m.hawkesAnalytics.track('x'));
  delete (globalThis as any).window;
});

test('every method the loader offers is one the SDK has', () => {
  const sdk = fs.readFileSync(path.join(ROOT, 'hawkes-analytics.js'), 'utf8');
  const sdkMethods = JSON.parse(/var METHODS = (\[[^\]]+\])/.exec(sdk)![1].replace(/'/g, '"'));
  const loader = fs.readFileSync(path.join(ROOT, 'index.mjs'), 'utf8');
  const ours = JSON.parse(/const METHODS = (\[[^\]]+\])/.exec(loader)![1].replace(/'/g, '"'));
  for (const m of [...ours, 'ask', 'config']) assert.ok(sdkMethods.includes(m), m);
  for (const m of sdkMethods) assert.ok([...ours, 'ask', 'config'].includes(m), `the loader is missing ${m}`);
});
