// The recipes on the docs site (docs/recipes.md) are tested, so they never drift:
// - plain web and Babylon: the code is taken from the page itself and run in a page with no screen (a fake window whose
//   script tag runs this repo's hawkes-analytics.js). The events go to the BETA collect endpoint (the origin
//   https://sites.hawkesgen.ai, product hawkes-analytics: Gen's registry marks it env beta) and the test passes only when
//   each of game_ready, level_start, death and level_end comes back acknowledged. The session is marked internal.
// - Unity: the C# on the page is DevTools/CompileCheck/Recipes/HawkesRecipe.cs, which CI compiles (dotnet build
//   DevTools/CompileCheck); the jslib on the page is the one the package ships.
// Offline? HAWKES_RECIPES_OFFLINE=1 skips the two network tests (CI never sets it). HAWKES_BETA_COLLECT=<url> sends elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SDK = fs.readFileSync(path.join(ROOT, 'hawkes-analytics.js'), 'utf8');
const DOC = fs.readFileSync(path.join(ROOT, 'docs', 'recipes.md'), 'utf8');
const BETA_ORIGIN = 'https://sites.hawkesgen.ai';
const BETA_PRODUCT = 'hawkes-analytics';
const COLLECT = process.env.HAWKES_BETA_COLLECT || 'https://hawkesgen.ai/v1/analytics/collect';
const OFFLINE = process.env.HAWKES_RECIPES_OFFLINE === '1';
const FOUR = ['game_ready', 'level_start', 'death', 'level_end'];

/** The fenced code blocks of one `## ` section of the recipes page, by language. */
function blocks(heading: RegExp) {
  const out: Record<string, string[]> = {};
  const parts = DOC.split(/^## /m).slice(1);
  const sec = parts.find((p) => heading.test(p.split('\n')[0]));
  assert.ok(sec, `docs/recipes.md has no section matching ${heading}`);
  for (const m of sec!.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)) (out[m[1]] ??= []).push(m[2]);
  return out;
}
const mine = (code: string) => {
  assert.ok(code.includes('my-game'), 'the recipe shows my-game as the product');
  return code.replaceAll('my-game', BETA_PRODUCT);
};

/** A page with no screen: enough DOM for the SDK and the loader, a real network, a script tag that runs the SDK. */
function headlessPage() {
  const ls = new Map<string, string>([['hawkes.internal', '1']]); // an internal session: not a player in the numbers
  const store = { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => { ls.set(k, String(v)); }, removeItem: (k: string) => { ls.delete(k); } };
  const timer = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); t.unref?.(); return t; };
  const u = new URL(BETA_ORIGIN + '/recipes/');
  const doc: any = {
    visibilityState: 'visible', referrer: '', title: 'Recipe', readyState: 'complete', body: null, currentScript: null,
    addEventListener() {}, querySelector: () => null,
    createElement: (tag: string) => (tag === 'script' ? tag_() : { getContext: () => null }),
  };
  doc.head = doc.documentElement = { appendChild: (el: any) => { if (/analytics/.test(el.src || '')) queueMicrotask(() => runSdk(el)); } };
  function tag_() {
    const attrs: Record<string, string> = {}, on: Record<string, Function[]> = {};
    return {
      src: '', async: false,
      setAttribute(k: string, v: string) { attrs[k] = v; }, getAttribute: (k: string) => attrs[k] ?? null,
      addEventListener(ev: string, fn: Function) { (on[ev] ??= []).push(fn); },
      fire(ev: string) { (on[ev] ?? []).forEach((f) => f()); },
    };
  }
  const w: any = {
    document: doc, location: { href: u.href, host: u.host, hostname: u.hostname, pathname: u.pathname, search: '' },
    localStorage: store, sessionStorage: { ...store, getItem: () => null, setItem() {} },
    navigator: { language: 'en-US', maxTouchPoints: 0, hardwareConcurrency: 4, webdriver: false, onLine: true, userAgent: 'recipe-test' },
    // The page's own network, as a browser on the beta site would make it: the same POST with the page's Origin.
    fetch: (url: string, init: any) => fetch(process.env.HAWKES_BETA_COLLECT || url, { ...init, headers: { ...init.headers, Origin: BETA_ORIGIN } }),
    screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
    history: { pushState() {}, replaceState() {} },
    performance: { now: () => 1000, getEntriesByType: () => [] }, requestAnimationFrame: () => 1,
    crypto: webcrypto, URL, URLSearchParams, Date, console, addEventListener() {},
    setTimeout: timer, clearTimeout,
  };
  w.window = w; w.self = w; w.globalThis = w;
  vm.createContext(w);
  function runSdk(el: any) {
    doc.currentScript = el;
    try { vm.runInContext(SDK, w); } finally { doc.currentScript = null; }
    el.fire('load');
  }
  const sdk = () => w.hawkesAnalytics;
  return { w, doc, runSdk, sdk, tag_ };
}

/** Wait until every wanted event is acknowledged by the collect endpoint (or one is dropped), then say which were. */
async function acknowledged(a: any, want: string[]) {
  const acked: string[] = [], dropped: string[] = [];
  let done: (v?: unknown) => void;
  const all = new Promise((r) => { done = r; });
  a.on('acked', (i: any) => { acked.push(i.name); if (want.every((n) => acked.includes(n))) done(); });
  a.on('dropped', (i: any) => { dropped.push(i.name + ' (' + (i.reason || i.why || 'dropped') + ')'); done(); });
  a.flush();
  const giveUp = new Promise((r) => { const t = setTimeout(r, 20000); t.unref?.(); });
  await Promise.race([all, giveUp]);
  return { acked, dropped };
}

function explain(who: string, r: { acked: string[]; dropped: string[] }) {
  return `${who}: acknowledged by ${COLLECT} for ${BETA_ORIGIN}: [${r.acked.join(', ')}], dropped: [${r.dropped.join(', ')}]. ` +
    'Every event must be acknowledged. No network? HAWKES_RECIPES_OFFLINE=1 skips this test.';
}

test('docs/recipes.md has the three recipes, each with every event and the names of the catalogue', () => {
  const events = fs.readFileSync(path.join(ROOT, 'docs', 'events.md'), 'utf8');
  for (const n of FOUR) assert.ok(events.includes('`' + n + '`'), `docs/events.md lists ${n}`);
  const web = blocks(/^Plain web/).html.join('\n'), bab = blocks(/^Babylon/).js.join('\n'), uni = blocks(/^Unity/).csharp.join('\n');
  for (const [who, code, calls] of [
    ['plain web', web, ["'ready'", "'levelStart'", "'death'", "'levelEnd'"]],
    ['Babylon', bab, ['analytics.ready(', 'analytics.levelStart(', 'analytics.death(', 'analytics.levelEnd(']],
    ['Unity', uni, ['HawkesAnalytics.Ready(', 'HawkesAnalytics.LevelStart(', 'HawkesAnalytics.Death(', 'HawkesAnalytics.LevelEnd(']],
  ] as [string, string, string[]][]) for (const c of calls) assert.ok(code.includes(c), `the ${who} recipe calls ${c}`);
});

test('plain web recipe: the page runs, and game_ready, level_start, death and level_end are acknowledged by the beta collect endpoint', { skip: OFFLINE, timeout: 40000 }, async () => {
  const code = blocks(/^Plain web/).html[0];
  const p = headlessPage();
  // Run the page's scripts as a browser does: the async SDK tag arrives after the inline script has already run.
  let sdkTag: any = null;
  for (const m of code.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = (s: string) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const at = attrs(m[1]);
    if (at.src) {
      assert.match(at.src, /^https:\/\/hawkesgen\.ai\/sdk\/analytics@1\.js$/);
      assert.match(m[1], /\sasync(\s|$)/, 'the script tag is async');
      sdkTag = p.tag_();
      sdkTag.src = at.src;
      for (const [k, v] of Object.entries(at)) if (k !== 'src') sdkTag.setAttribute(k, k === 'data-product' ? BETA_PRODUCT : v);
    } else vm.runInContext(m[2], p.w);
  }
  assert.ok(sdkTag, 'the recipe has the SDK script tag');
  assert.equal(p.sdk(), undefined, 'the SDK has not arrived yet: calls are queued');
  p.runSdk(sdkTag);
  assert.equal(p.sdk().config().product, BETA_PRODUCT);
  assert.equal(p.sdk().config().env, 'beta');
  p.w.startLevel(1);
  p.w.playerDied(1, 'imp');
  const r = await acknowledged(p.sdk(), FOUR);
  assert.deepEqual(FOUR.filter((n) => !r.acked.includes(n)), [], explain('plain web', r));
});

test('Babylon recipe: events sent from a scene, acknowledged by the beta collect endpoint', { skip: OFFLINE, timeout: 40000 }, async () => {
  const code = mine(blocks(/^Babylon/).js[0]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hawkes-recipe-'));
  // A scene with just what the recipe uses of Babylon (no WebGL in a test), and the real npm loader.
  fs.writeFileSync(path.join(dir, 'babylon-stub.mjs'), `
    export class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      static Distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); } }
    class Observable { list = [];
      add(fn) { const o = { fn, once: false }; this.list.push(o); return o; }
      addOnce(fn) { const o = { fn, once: true }; this.list.push(o); return o; }
      remove(o) { this.list = this.list.filter((x) => x !== o); }
      notify() { for (const o of [...this.list]) { if (o.once) this.remove(o); o.fn(); } } }
    export class Scene { onBeforeRenderObservable = new Observable();
      executeWhenReady(fn) { fn(); } render() { this.onBeforeRenderObservable.notify(); } }
  `);
  const stubUrl = pathToFileURL(path.join(dir, 'babylon-stub.mjs')).href;
  fs.writeFileSync(path.join(dir, 'recipe.mjs'), code
    .replaceAll("'@hawkesgen/analytics'", JSON.stringify(pathToFileURL(path.join(ROOT, 'index.mjs')).href))
    .replaceAll("'@babylonjs/core'", JSON.stringify(stubUrl)));
  const p = headlessPage();
  (globalThis as any).window = p.w;
  try {
    const recipe: any = await import(pathToFileURL(path.join(dir, 'recipe.mjs')).href);
    const { Vector3, Scene }: any = await import(stubUrl);
    await new Promise((r) => setImmediate(r)); // the script tag the loader added has run
    assert.ok(p.sdk(), 'the loader added Hawkes Gen\'s script and it ran');
    assert.equal(p.sdk().config().product, BETA_PRODUCT);
    const scene = new Scene(), player = { position: new Vector3(0, 0, 0) }, goal = { position: new Vector3(30, 0, 0) };
    recipe.trackLevel(scene, { level: '1', player, goal });
    scene.render();                 // the first frame: level_start
    player.position.y = -20;        // the player falls out of the world: death, then level_end
    scene.render();
    scene.render();                 // nothing more once the level is over
    const r = await acknowledged(p.sdk(), FOUR);
    assert.deepEqual(FOUR.filter((n) => !r.acked.includes(n)), [], explain('Babylon', r));
    assert.equal(r.acked.filter((n) => n === 'level_end').length, 1, 'level_end is sent once');
  } finally {
    delete (globalThis as any).window;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Babylon recipe: reaching the goal ends the level as complete (no network)', async () => {
  const code = blocks(/^Babylon/).js[0];
  const sent: any[] = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hawkes-recipe-'));
  fs.writeFileSync(path.join(dir, 'recipe.mjs'), code
    .replaceAll("'@hawkesgen/analytics'", JSON.stringify(pathToFileURL(path.join(dir, 'analytics.mjs')).href))
    .replaceAll("'@babylonjs/core'", JSON.stringify(pathToFileURL(path.join(dir, 'babylon.mjs')).href)));
  fs.writeFileSync(path.join(dir, 'analytics.mjs'), `
    const log = globalThis.__recipeCalls; const a = new Proxy({}, { get: (_, m) => (...args) => log.push([m, ...args]) });
    export default a; export const load = () => {};`);
  fs.writeFileSync(path.join(dir, 'babylon.mjs'), `export const Vector3 = { Distance: (a, b) => Math.abs(a.x - b.x) };`);
  (globalThis as any).__recipeCalls = sent;
  try {
    const recipe: any = await import(pathToFileURL(path.join(dir, 'recipe.mjs')).href);
    const obs: Function[] = [];
    const scene = { executeWhenReady: (f: Function) => f(), onBeforeRenderObservable: { addOnce: (f: Function) => f(), add: (f: Function) => obs.push(f) } };
    const player = { position: { x: 0, y: 0 } };
    recipe.trackLevel(scene, { level: '2', player, goal: { position: { x: 1 } } });
    obs.forEach((f) => f());
    assert.deepEqual(sent.map((c) => c[0]), ['ready', 'levelStart', 'levelEnd']);
    assert.deepEqual(sent[2].slice(1), ['2', 'complete']);
  } finally {
    delete (globalThis as any).__recipeCalls;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Unity recipe: the page shows the C# CI compiles, and the jslib the package ships', () => {
  const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd();
  const u = blocks(/^Unity/);
  const cs = fs.readFileSync(path.join(ROOT, 'DevTools', 'CompileCheck', 'Recipes', 'HawkesRecipe.cs'), 'utf8');
  assert.equal(norm(u.csharp[0]), norm(cs), 'the C# on the page must be DevTools/CompileCheck/Recipes/HawkesRecipe.cs (CI compiles that file)');
  const jslib = fs.readFileSync(path.join(ROOT, 'Packages', 'com.hawkes.analytics', 'Runtime', 'Plugins', 'WebGL', 'HawkesAnalytics.jslib'), 'utf8');
  assert.equal(norm(u.js[0]), norm(jslib), 'the jslib on the page must be the package\'s HawkesAnalytics.jslib');
  const csproj = fs.readFileSync(path.join(ROOT, 'DevTools', 'CompileCheck', 'CompileCheck.csproj'), 'utf8');
  assert.ok(csproj.includes('Recipes/**/*.cs'), 'CompileCheck.csproj compiles the recipe');
});
