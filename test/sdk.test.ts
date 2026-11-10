// The analytics SDK (hawkes-analytics.js) in a fake browser: batching, sessions, active time, the offline queue,
// opt-out, env detection, flags, the exit snapshot, the Unity bridge's early queue. The script runs as a classic script
// in a vm context whose globals are the fake window. (Hawkes Gen's own tests check that it serves this file.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'hawkes-analytics.js'), 'utf8');
/** Objects made inside the vm context have its prototypes: compare them as JSON. */
const plainOf = (v: unknown) => JSON.parse(JSON.stringify(v));
const T0 = Date.UTC(2026, 9, 19, 12, 0, 0);

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

type Opts = { url?: string; attrs?: Record<string, string>; ls?: MemStorage; ss?: MemStorage; clock?: { t: number }; webdriver?: boolean; online?: boolean; beacon?: boolean; before?: (w: any) => void };

/** One page load. Storages and the clock can be shared between loads (a reload, a new tab). */
function page(o: Opts = {}) {
  const clock = o.clock ?? { t: T0 };
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const listeners = new Map<string, Function[]>();
  const sent: any[] = [];
  const fetched: any[] = [];
  const u = new URL(o.url ?? 'https://sickofitgame.com/Game/?utm_source=reddit&utm_medium=social');
  const loc: any = { href: u.href, host: u.host, hostname: u.hostname, pathname: u.pathname, search: u.search };
  class FDate extends Date {
    constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(clock.t); }
    static now() { return clock.t; }
  }
  const on = (scope: string) => (type: string, fn: Function) => { const k = `${scope}:${type}`; listeners.set(k, [...(listeners.get(k) ?? []), fn]); };
  const doc: any = {
    visibilityState: 'visible', referrer: 'https://www.reddit.com/r/indiegames/?x=1', title: 'Sick Of It', readyState: 'loading', body: null,
    currentScript: { getAttribute: (k: string) => (o.attrs ?? { 'data-product': 'sickofit', 'data-build': '1.4.2' })[k] ?? null },
    addEventListener: on('doc'), querySelector: () => null, createElement: () => ({ getContext: () => null }),
  };
  const w: any = {
    document: doc, location: loc, localStorage: o.ls ?? new MemStorage(), sessionStorage: o.ss ?? new MemStorage(),
    navigator: {
      language: 'en-US', maxTouchPoints: 0, hardwareConcurrency: 8, webdriver: o.webdriver ?? false, onLine: o.online ?? true,
      sendBeacon: (url: string, body: string) => { if (o.beacon === false) return false; sent.push({ url, ...JSON.parse(body) }); return true; },
    },
    fetch: (url: string, init: any) => { fetched.push({ url, init }); return Promise.reject(new Error('offline')); },
    screen: { width: 1920, height: 1080 }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2,
    history: { pushState: (_s: any, _t: any, p: string) => { loc.pathname = p; }, replaceState: () => {} },
    performance: { now: () => 1234, getEntriesByType: () => [{ responseStart: 120, domContentLoadedEventEnd: 800, loadEventEnd: 1500, domainLookupStart: 0, domainLookupEnd: 10, connectStart: 10, connectEnd: 40, transferSize: 5000, type: 'navigate' }] },
    requestAnimationFrame: () => 1, crypto: webcrypto, URL, URLSearchParams, Date: FDate, console: { log() {}, warn() {} },
    setTimeout: (fn: () => void, ms: number) => { const id = nextId++; timers.push({ at: clock.t + (ms || 0), fn, id }); return id; },
    clearTimeout: (id: number) => { const i = timers.findIndex((x) => x.id === id); if (i >= 0) timers.splice(i, 1); },
    addEventListener: on('win'),
  };
  w.window = w;
  o.before?.(w);
  vm.createContext(w);
  vm.runInContext(SRC, w);
  const fire = (scope: 'win' | 'doc', type: string, ev: any = {}) => { for (const fn of listeners.get(`${scope}:${type}`) ?? []) fn({ type, ...ev }); };
  /** Move the clock, running timers as they come due. */
  const advance = (ms: number) => {
    const end = clock.t + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      clock.t = Math.max(clock.t, next.at);
      next.fn();
    }
    clock.t = end;
  };
  const events = () => sent.flatMap((b) => b.events);
  const names = () => events().map((e: any) => e.name);
  const hide = () => { doc.visibilityState = 'hidden'; fire('doc', 'visibilitychange'); };
  const show = () => { doc.visibilityState = 'visible'; fire('doc', 'visibilitychange'); };
  return { w, a: w.hawkesAnalytics, sent, fetched, events, names, advance, fire, hide, show, clock, ls: o.ls, ss: o.ss };
}

test('batches: every 5 s, or at 20 events; one session per batch, entry with the first', () => {
  const p = page();
  assert.equal(p.sent.length, 0, 'nothing goes out at once');
  p.advance(5000);
  assert.equal(p.sent.length, 1);
  const b = p.sent[0];
  assert.equal(b.url, 'https://hawkesgen.ai/v1/analytics/collect');
  assert.equal(b.product, 'sickofit');
  assert.deepEqual(b.build, { version: '1.4.2' });
  assert.equal(b.env, 'live');
  assert.match(b.anon, /^a_[a-z0-9]{16}$/);
  assert.match(b.session, /^s_[a-z0-9]{16}$/);
  assert.deepEqual(b.entry, { referrer: 'www.reddit.com/r/indiegames/', landing: '/Game/', utm: { source: 'reddit', medium: 'social' } });
  assert.equal(b.device.screen, '1920x1080');
  assert.equal(b.device.viewport, '1280x720');
  assert.equal(b.device.dpr, 2);
  assert.equal(b.device.lang, 'en-US');
  assert.equal(b.device.cores, 8);
  assert.deepEqual(b.events.map((e: any) => e.name), ['session_start', 'page_view']);
  assert.deepEqual(b.events.map((e: any) => e.seq), [0, 1]);
  assert.equal(b.events[0].props.returning, false);

  p.a.setContext({ level: '2', mode: 'story', junk: { no: 1 } });
  for (let i = 0; i < 20; i++) p.a.track('tick', { i });
  assert.equal(p.sent.length, 2, '20 events go at once');
  assert.equal(p.sent[1].events.length, 20);
  assert.equal(p.sent[1].entry, undefined, 'entry only until it went once');
  assert.deepEqual(p.sent[1].events[0].ctx, { level: '2', mode: 'story' });
  assert.equal(p.sent[1].events[19].seq, 21);

  // The load timings arrive after load.
  p.fire('win', 'load');
  p.advance(6000);
  assert.ok(p.names().includes('page_load'));
  assert.equal(p.events().find((e: any) => e.name === 'page_load').props.ttfb, 120);

  // SPA routes count as page views.
  p.w.history.pushState({}, '', '/Game/shop');
  p.a.flush();
  const pv = p.events().filter((e: any) => e.name === 'page_view');
  assert.equal(pv.length, 2);
  assert.equal(pv[1].page, '/Game/shop');
});

test('the build: data-build, init({ build }), and window.HAWKES_BUILD over both', () => {
  const p = page({ attrs: {} });
  p.advance(6000);
  assert.equal(p.sent.length, 0, 'no product, nothing sent');
  p.a.init({ product: 'phorigins', build: '0.9' });
  assert.equal(p.sent.length, 1, 'init sends what waited');
  assert.equal(p.sent[0].product, 'phorigins');
  assert.deepEqual(p.sent[0].build, { version: '0.9' });
  p.w.HAWKES_BUILD = { version: '1.0.0', commit: 'a1b2c3d', date: '2026-10-18' };
  p.a.track('thing');
  p.a.flush();
  assert.deepEqual(p.sent[1].build, { version: '1.0.0', commit: 'a1b2c3d', date: '2026-10-18' });
});

test('sessions: a reload continues, 30 idle minutes start a new one, a new tab is a new one', () => {
  const ls = new MemStorage(), ss = new MemStorage(), clock = { t: T0 };
  const p1 = page({ ls, ss, clock });
  p1.advance(5000);
  const s1 = p1.sent[0].session;
  p1.advance(60_000);
  const p2 = page({ ls, ss, clock });
  p2.advance(5000);
  assert.equal(p2.sent[0].session, s1, 'a reload keeps the session');
  assert.deepEqual(p2.sent[0].events.map((e: any) => [e.name, e.seq]), [['page_view', 2]], 'seq goes on');

  p2.advance(31 * 60_000);
  p2.fire('win', 'pointerdown');
  p2.advance(5000);
  const after = p2.sent.slice(1);
  assert.equal(after[0].session, s1);
  assert.deepEqual(after[0].events.map((e: any) => e.name), ['session_end']);
  assert.notEqual(after[1].session, s1);
  assert.equal(after[1].events[0].name, 'session_start');
  assert.equal(after[1].events[0].seq, 0);
  assert.equal(after[1].events[0].props.returning, true);
  assert.ok(after[1].entry, 'a new session sends its entry');

  const tab = page({ ls, clock });
  tab.advance(5000);
  assert.notEqual(tab.sent[0].session, s1);
  assert.equal(tab.sent[0].anon, p1.sent[0].anon, 'the same player');
  assert.equal(tab.sent[0].events[0].props.visits, 3);
});

test('active time: visible and an input in the last 60 s; nothing before the first real input, sent once as first_input', () => {
  const idle = page();
  idle.advance(45_000);
  idle.fire('win', 'keydown', { isTrusted: false }); // a page script's synthetic event
  idle.a.track('untouched');
  idle.hide();
  idle.show();
  idle.advance(10_000);
  idle.a.flush();
  assert.equal(idle.events().find((e: any) => e.name === 'untouched').active, 0, 'a page nobody touched has no active time');
  assert.ok(!idle.names().includes('first_input'));
  assert.equal(idle.events().find((e: any) => e.name === 'exit').props.active, 0);

  const p = page();
  p.advance(2500);
  p.fire('win', 'keydown');
  p.advance(30_000);
  p.a.track('one');
  p.advance(10 * 60_000); // idle: only 60 s after the last input count
  p.a.track('two');
  p.fire('win', 'pointerdown');
  p.advance(20_000);
  p.hide();
  p.advance(5 * 60_000); // hidden: nothing counts
  p.show();
  p.advance(10_000);
  p.a.track('three');
  p.a.flush();
  const ev = Object.fromEntries(p.events().map((e: any) => [e.name, e]));
  assert.equal(ev.one.active, 30_000);
  assert.equal(ev.two.active, 60_000);
  assert.equal(ev.exit.props.active, 80);
  assert.equal(ev.three.active, 90_000, 'coming back counts as activity');
  assert.deepEqual(plainOf(ev.first_input.props), { kind: 'key', after: 2.5 });
  assert.equal(p.names().filter((n: string) => n === 'first_input').length, 1, 'once per session');
});

test('the exit snapshot: the last 20 events, the game state trimmed, active time; once per hide', () => {
  const big = { ready: true, status: 'running', scene: 'Level 2', blob: 'x'.repeat(20_000), nested: { a: 1 } };
  const p = page({ before: (w) => { w.hawkesPlaytest = { state: () => big, start() {} }; } });
  for (let i = 0; i < 25; i++) p.a.track('step', { i });
  p.hide();
  p.fire('win', 'pagehide');
  const exits = p.events().filter((e: any) => e.name === 'exit');
  assert.equal(exits.length, 1, 'visibility hidden and pagehide make one exit');
  const x = exits[0].props;
  assert.equal(x.recent.length, 20);
  assert.equal(x.recent[19].name, 'step');
  assert.equal(x.state._trimmed, true);
  assert.equal(x.state.scene, 'Level 2');
  assert.equal(x.state.blob.length, 200);
  assert.equal(x.state.nested, undefined);
  assert.equal(typeof x.active, 'number');
  assert.equal(p.names().at(-1), 'session_end');
  assert.ok(p.sent.every((b: any) => JSON.stringify(b).length < 64 * 1024), 'every batch under 64 KB');
});

test('the offline queue: kept in localStorage, capped, sent on the next visit', () => {
  const ls = new MemStorage(), clock = { t: T0 };
  const p = page({ ls, clock, online: false });
  p.advance(5000);
  assert.equal(p.sent.length, 0);
  const box = JSON.parse(ls.getItem('hawkes.outbox')!);
  assert.equal(box.length, 1);
  for (let i = 0; i < 100; i++) { p.a.track('xx'); p.a.flush(); }
  assert.ok(JSON.parse(ls.getItem('hawkes.outbox')!).length <= 40, 'capped');

  const next = page({ ls, clock });
  next.fire('win', 'load');
  next.advance(1500);
  assert.ok(next.sent.length >= 40, 'retried on the next visit');
  assert.equal(ls.getItem('hawkes.outbox'), null);

  // sendBeacon refused and fetch failing: into the queue too.
  const ls2 = new MemStorage();
  const q = page({ ls: ls2, beacon: false });
  q.advance(5000);
  assert.equal(q.fetched.length, 1);
  assert.equal(q.fetched[0].init.keepalive, true);
  return new Promise<void>((r) => setTimeout(() => { assert.equal(JSON.parse(ls2.getItem('hawkes.outbox')!).length, 1); r(); }, 10));
});

test('listeners: queued, batched, sent, acked in order; dropped with a reason', async () => {
  const p = page();
  p.w.fetch = async () => ({ ok: true, status: 200 });
  const seen: string[] = [], drops: any[] = [];
  for (const t of ['queued', 'batched', 'sent', 'acked']) p.a.on(t, (i: any) => seen.push(t + ':' + i.name));
  p.a.on('dropped', (i: any) => drops.push(plainOf(i)));
  p.a.init({ product: 'x' });
  await new Promise((r) => setTimeout(r, 5));
  seen.length = 0;
  p.a.track('one', { a: 1 });
  p.a.flush();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(seen, ['queued:one', 'batched:one', 'sent:one', 'acked:one']);
  p.a.track('Bad Name');
  p.a.optOut();
  p.a.track('two');
  assert.deepEqual(drops.map((d) => [d.name, d.reason]), [['Bad Name', 'bad name'], ['two', 'opted out']]);
});

test('opt-out stops everything and is remembered; opt-in starts a session', () => {
  const ls = new MemStorage(), clock = { t: T0 };
  const p = page({ ls, clock });
  p.a.optOut();
  p.a.track('xx');
  p.advance(10_000);
  p.hide();
  assert.equal(p.sent.length, 0);
  const again = page({ ls, clock });
  again.a.track('xx');
  again.advance(10_000);
  assert.equal(again.sent.length, 0);
  assert.equal(again.a.config().optedOut, true);
  again.a.optIn();
  again.a.track('back');
  again.a.flush();
  assert.deepEqual(again.names(), ['session_start', 'back']);
});

test('env from the hostname', () => {
  const env = (url: string) => page({ url }).a.config().env;
  assert.equal(env('https://sickofitgame.com/'), 'live');
  assert.equal(env('https://www.phorigins.com/play'), 'live');
  assert.equal(env('https://sickofit.hawkesgen.ai/Game/'), 'beta');
  assert.equal(env('https://sickofit.hawkesgen.ai/c/c_123/Game/'), 'preview');
  assert.equal(env('http://localhost:5173/'), 'local');
  assert.equal(env('http://127.0.0.1:8080/'), 'local');
});

test('flags: webdriver, the playtest bot, internal (remembered)', () => {
  const ls = new MemStorage(), clock = { t: T0 };
  assert.equal(page({ webdriver: true }).a.config().flags.webdriver, true);
  assert.equal(page({ url: 'https://sickofitgame.com/Game/?playtest=level-1' }).a.config().flags.playtest, true);
  assert.equal(page().a.config().flags.automation, undefined);
  assert.equal(page({ before: (w) => { w.__playwright__binding__ = () => {}; } }).a.config().flags.automation, '__playwright__binding__');
  assert.equal(page({ before: (w) => { w.document.$cdc_asdjflasutopfhvcZLmcfl_ = {}; } }).a.config().flags.automation, 'cdc_');
  const bot = page({ before: (w) => { w.hawkesPlaytest = { state: () => ({ ready: true, status: 'idle' }), start() {} }; } });
  assert.equal(bot.a.config().flags.playtest, false);
  bot.w.hawkesPlaytest.start('smoke');
  assert.equal(bot.a.config().flags.playtest, true, 'the runner called start()');

  assert.equal(page({ ls, clock, url: 'https://sickofitgame.com/?hawkes-internal=1' }).a.config().flags.internal, true);
  const later = page({ ls, clock });
  assert.equal(later.a.config().flags.internal, true, 'remembered');
  later.advance(5000);
  assert.equal(later.sent[0].flags.internal, true);
  assert.equal(page({ ls, clock, url: 'https://sickofitgame.com/?hawkes-internal=0' }).a.config().flags.internal, false);
});

test('the game API: levels time themselves and count deaths; errors are deduped', () => {
  const p = page({ url: 'https://sickofitgame.com/?hawkes-analytics-debug=1' });
  p.a.loadStart();
  p.advance(2000);
  p.a.ready();
  p.a.screen('level');
  p.a.levelStart(3);
  p.advance(4000);
  p.a.death('imp', { where: 'bridge' });
  p.a.death('fall');
  p.advance(6500);
  p.a.levelEnd(3, 'complete', { score: 10 });
  p.a.choice('door', 'left');
  p.a.feature('rewind');
  p.a.video('intro', 'skip', 3.25);
  p.a.feedback({ rating: 4, text: 'fun', context: 'level 3' });
  p.a.track('Bad Name!');
  p.a.track(null as any, 5 as any);
  p.a.setContext(null as any);
  p.fire('win', 'error', { message: 'boom', error: { stack: 'Error: boom\n at a.js:1' } });
  p.fire('win', 'error', { message: 'boom', error: { stack: 'Error: boom\n at a.js:1' } });
  p.fire('win', 'unhandledrejection', { reason: new Error('nope') });
  const log = p.a.debugLog;
  const by = (n: string) => log.filter((e: any) => e.name === n);
  assert.equal(by('game_ready')[0].props.ms, 2000);
  assert.equal(by('level_start')[0].props.level, '3');
  assert.equal(by('level_start')[0].screen, 'level');
  assert.deepEqual(plainOf(by('death')[0].props), { cause: 'imp', where: 'bridge' });
  const end = by('level_end')[0].props;
  assert.equal(end.duration, 10.5);
  assert.equal(end.deaths, 2);
  assert.equal(end.score, 10);
  assert.equal(by('level_end')[0].ctx.level, '3');
  assert.deepEqual(plainOf(by('choice')[0].props), { node: 'door', option: 'left' });
  assert.equal(by('video')[0].props.at, 3.3);
  assert.equal(by('feedback')[0].props.rating, 4);
  assert.equal(by('error').length, 2, 'the same error once');
  assert.equal(by('error')[1].props.source, 'promise');
  assert.equal(log.some((e: any) => e.name === 'Bad Name!'), false);
  p.a.flush();
  assert.ok(log.every((e: any) => e.sent), 'debugLog shows what went out');
});

test('never throws: blocked storage, a failing beacon, early calls from the Unity bridge', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const p = page({ before: (w) => {
    Object.defineProperty(w, 'localStorage', { get() { throw new Error('SecurityError'); } });
    w.sessionStorage = blocked;
    w.navigator.sendBeacon = () => { throw new Error('nope'); };
    w.hawkesAnalyticsQ = [['setContext', { character: 'susan' }], ['track', 'unity_boot', { a: 1 }], ['nope']];
  } });
  p.a.track('xx');
  p.a.flush();
  p.a.ask({ id: 'q', question: 'ok?' });
  p.hide();
  assert.ok(p.fetched.length >= 1, 'fell back to fetch');
  const body = JSON.parse(p.fetched[0].init.body);
  const boot = body.events.find((e: any) => e.name === 'unity_boot');
  assert.deepEqual(boot.ctx, { character: 'susan' });
  assert.equal(p.w.hawkesAnalyticsQ.length, 0);
});

test('ask(): a card that sends feedback; once per session, and not for 7 days after a dismiss', async () => {
  // Just enough DOM for the card: every element can hold children, a shadow root is itself, selectors find one child each.
  const el = (): any => {
    const found = new Map<string, any>();
    const e: any = {
      children: [] as any[], removed: false, value: '',
      setAttribute() {}, addEventListener() {}, focus() {}, attachShadow() { return e; },
      appendChild(c: any) { e.children.push(c); return c; }, remove() { e.removed = true; },
      querySelector(sel: string) { if (!found.has(sel)) found.set(sel, el()); return found.get(sel); },
      querySelectorAll() { return e.children; },
    };
    return e;
  };
  const ls = new MemStorage(), clock = { t: T0 };
  const withDom = (w: any) => { w.document.body = el(); w.document.createElement = () => el(); };
  const p = page({ ls, clock, before: withDom });
  const answer = p.a.ask({ id: 'after-level-1', question: 'Fun?', context: 'level 1' });
  const card = p.w.document.body.children[0];
  const row = card.querySelector('.ha-r');
  assert.equal(row.children.length, 2, 'thumbs up and down');
  row.children[0].onclick();
  p.a.flush();
  const fb = p.events().find((e: any) => e.name === 'feedback');
  assert.deepEqual(fb.props, { id: 'after-level-1', rating: 'up', context: 'level 1' });
  p.advance(1500);
  assert.deepEqual(plainOf(await answer), { id: 'after-level-1', rating: 'up', context: 'level 1' });
  assert.equal(card.removed, true);
  assert.equal(await p.a.ask({ id: 'after-level-1', question: 'Fun?' }), null, 'once per session');

  const stars = p.a.ask({ id: 'ending', question: 'Rate it', kind: 'stars' });
  const card2 = p.w.document.body.children[1];
  assert.equal(card2.querySelector('.ha-r').children.length, 5);
  card2.querySelector('.ha-x').onclick();
  assert.equal(await stars, null);

  const tab = page({ ls, clock, before: withDom });
  assert.equal(await tab.a.ask({ id: 'ending', question: 'Rate it' }), null, 'dismissed: not for 7 days');
  clock.t += 8 * 86_400_000;
  const later = page({ ls, clock, before: withDom });
  void later.a.ask({ id: 'ending', question: 'Rate it' });
  assert.equal(later.w.document.body.children.length, 1, 'shown again after 7 days');
});

test('the Unity bridge (.jslib): loads the SDK with the product and build, and queues calls until it runs', () => {
  const JSLIB = fs.readFileSync(path.join(ROOT, 'Packages', 'com.hawkes.analytics', 'Runtime', 'Plugins', 'WebGL', 'HawkesAnalytics.jslib'), 'utf8');
  const p = page({ url: 'https://sickofitgame.com/Game/v12/', before: (w) => {
    const added: any[] = [];
    const lib: any = {};
    const d = w.document;
    d.head = { appendChild: (s: any) => added.push(s) };
    d.querySelectorAll = () => [];
    d.querySelector = (sel: string) => (sel === 'script[data-hawkes-analytics]' ? added[0] ?? null : null);
    d.createElement = () => { const attrs: Record<string, string> = {}; return { attrs, setAttribute: (k: string, v: string) => { attrs[k] = v; }, getAttribute: (k: string) => attrs[k] ?? null }; };
    new Function('mergeInto', 'LibraryManager', 'UTF8ToString', 'window', 'document', 'location', JSLIB)((_l: any, o: any) => Object.assign(lib, o), { library: lib }, (s: string) => s, w, d, w.location);
    lib.HawkesAnalytics_Init('sickofit', 'https://hawkesgen.ai/sdk/analytics@1.js', '', '1.4.2', 0);
    lib.HawkesAnalytics_Init('sickofit', 'https://hawkesgen.ai/sdk/analytics@1.js', '', '1.4.2', 0);
    assert.equal(added.length, 1, 'one script tag');
    assert.equal(added[0].src, 'https://hawkesgen.ai/sdk/analytics@1.js');
    assert.equal(added[0].attrs['data-build'], '1.4.2+v12');
    lib.HawkesAnalytics_Call('setContext', '[{"level":"1"}]');
    lib.HawkesAnalytics_Call('track', '["unity_boot",{"a":1}]');
    assert.equal(w.hawkesAnalyticsQ.length, 2);
    d.currentScript = added[0]; // the SDK runs from that tag
    w.bridge = lib;
  } });
  p.w.bridge.HawkesAnalytics_Call('death', '["imp"]'); // now straight to the SDK
  p.a.flush();
  assert.equal(p.sent[0].product, 'sickofit');
  assert.deepEqual(p.sent[0].build, { version: '1.4.2+v12' });
  const boot = p.events().find((e: any) => e.name === 'unity_boot');
  assert.deepEqual(boot.ctx, { level: '1' });
  assert.ok(p.names().includes('death'));
});

test('v2: identify ties batches to an account, activity keeps active time, frustration and engage, no repeated exits', () => {
  const ls = new MemStorage();
  const p = page({ ls });
  p.advance(5000);
  assert.equal(p.sent[0].user, undefined, 'no account until identify');
  p.a.track('before');
  p.a.identify('usr_0123456789abcdef');
  assert.equal(p.sent[1].user, undefined, 'what came before goes without the id');
  assert.deepEqual(p.sent[1].events.map((e: any) => e.name), ['before']);
  p.a.frustration('out_of_credits', { need: 8 });
  p.a.engage('drive', 42.34);
  p.a.engage('drive', 0);
  p.a.flush();
  assert.equal(p.sent[2].user, 'usr_0123456789abcdef');
  assert.deepEqual(plainOf(p.sent[2].events.map((e: any) => [e.name, e.props])), [['frustration', { kind: 'out_of_credits', need: 8 }], ['engage', { name: 'drive', seconds: 42.3 }]]);
  assert.equal(ls.getItem('hawkes.user'), 'usr_0123456789abcdef', 'remembered for the next page');
  p.a.identify('no spaces allowed');
  p.a.track('xx');
  p.a.flush();
  assert.equal(p.sent[3].user, 'usr_0123456789abcdef', 'a bad id is ignored');
  p.a.identify(null);
  p.a.track('yy');
  p.a.flush();
  assert.equal(p.sent[4].user, undefined, 'signed out');

  // Input the page can't see (a sandboxed game frame) still counts as activity.
  p.a.activity();
  p.a.flush();
  const before = p.events().at(-1).active;
  assert.equal(p.events().at(-1).name, 'first_input');
  assert.equal(p.events().at(-1).props.kind, 'forwarded');
  for (let i = 0; i < 10; i++) { p.advance(50_000); p.a.activity(); }
  p.a.track('later');
  p.a.flush();
  assert.ok(p.events().at(-1).active - before >= 490_000, 'active time kept going with activity()');

  // Hidden, shown, hidden with nothing in between: one exit, not two.
  p.hide();
  p.show();
  p.hide();
  p.show();
  assert.equal(p.names().filter((n: string) => n === 'exit').length, 1);
  p.a.track('more');
  p.hide();
  assert.equal(p.names().filter((n: string) => n === 'exit').length, 2, 'something new happened: a new exit');
});

test('v2: a page without storage takes its ids from init', () => {
  const p = page({ before: (w) => { Object.defineProperty(w, 'localStorage', { get() { throw new Error('sandboxed'); } }); Object.defineProperty(w, 'sessionStorage', { get() { throw new Error('sandboxed'); } }); } });
  p.a.init({ product: 'hawkesgen', anon: 'a_fromtheserver01', user: 'usr_0123456789abcdef' });
  assert.equal(p.sent[0].anon, 'a_fromtheserver01');
  assert.equal(p.sent[0].user, 'usr_0123456789abcdef');
  const q = page();
  const mine = q.a.config().anon;
  q.a.init({ anon: 'a_fromtheserver01' });
  assert.equal(q.a.config().anon, mine, 'a page with its own storage keeps its own id');
});

test('warnings: a missing product id says what happened and how to fix it, once, with debug off', () => {
  const warns: string[] = [];
  const p = page({ attrs: {}, before: (w) => { w.console.warn = (...a: any[]) => warns.push(a.join(' ')); } });
  p.advance(6000); // the first batch is due, but there is nowhere to send it
  assert.equal(p.sent.length, 0);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /^\[hawkes-analytics\] No product id, so nothing is being sent/);
  assert.match(warns[0], /data-product="my-game"/);
  assert.match(warns[0], /init\(\{ product: 'my-game' \}\)/);
  p.a.track('more'); p.a.flush(); p.advance(6000);
  assert.equal(warns.length, 1, 'once, not on every flush');
  p.a.init({ product: 'my-game' });
  assert.equal(p.sent.length, 1, 'and fixing it sends what waited');
});

test('warnings: no warning when the product is set; a bad event name and a failing call explain themselves', () => {
  const warns: string[] = [];
  const p = page({ before: (w) => { w.console.warn = (...a: any[]) => warns.push(a.join(' ')); } });
  p.advance(6000);
  assert.deepEqual(warns, []);
  p.a.track('Shop Purchase');
  p.a.track('Shop Purchase');
  assert.equal(warns.length, 1);
  assert.match(warns[0], /The event name "Shop Purchase" was skipped \(it has spaces\): names are 2 to 40 characters, start with a lowercase letter/);
  assert.match(warns[0], /Rename it, for example "shop_purchase"\./);
  p.a.track('shop_purchase', { get x() { throw new Error('boom'); } });
  assert.equal(warns.length, 2);
  assert.match(warns[1], /hawkesAnalytics\.track\(\) could not run \(boom\) and was skipped; your game is not affected\./);
});

test('warnings: names with spaces or capitals are skipped, each warned once, with the fixed name suggested', () => {
  const warns: string[] = [];
  const p = page({ before: (w) => { w.console.warn = (...a: any[]) => warns.push(a.join(' ')); } });
  p.a.track('Level Start'); p.a.track('Level Start');
  assert.equal(warns.length, 1, 'the same bad name warns once');
  assert.match(warns[0], /"Level Start" was skipped \(it has spaces\)/);
  assert.match(warns[0], /for example "level_start"/);
  p.a.track('levelEnd'); p.a.track('levelEnd'); p.a.track('Death');
  assert.equal(warns.length, 3, 'each different bad name warns once');
  assert.match(warns[1], /\(it has capital letters\)/);
  assert.match(warns[1], /for example "level_end"/);
  assert.match(warns[2], /for example "death"/);
  p.a.track('level_start'); p.a.flush();
  assert.equal(warns.length, 3, 'a good name says nothing');
  const names = p.sent.flatMap((b: any) => b.events.map((e: any) => e.name));
  assert.ok(names.includes('level_start') && !names.includes('Level Start') && !names.includes('Death'));
});

// ---- the privacy and reliability story (docs/privacy.md, the "What we send" panel on the demo page)
// These pin the exact field names: a new field in a batch must be added to docs/privacy.md and the demo panel too.

test('what we send: a batch has exactly these fields, and nothing that identifies a person', () => {
  const p = page();
  p.a.setContext({ level: '3' });
  p.a.track('demo_click', { at: 1 });
  p.advance(5000);
  const b = p.sent[0];
  const { url: _beacon, ...batch } = plainOf(b); // url is the fake beacon's own bookkeeping
  assert.deepEqual(Object.keys(batch).sort(), ['anon', 'build', 'device', 'entry', 'env', 'events', 'flags', 'product', 'sdk', 'session']);
  for (const k of Object.keys(plainOf(b.flags))) assert.ok(['webdriver', 'playtest', 'internal', 'automation'].includes(k), `unexpected flag ${k}`);
  const dev = plainOf(b.device);
  for (const k of Object.keys(dev)) assert.ok(['screen', 'viewport', 'dpr', 'lang', 'tz', 'touch', 'conn', 'cores', 'mem', 'gpu'].includes(k), `unexpected device field ${k}`);
  assert.deepEqual(Object.keys(plainOf(b.entry)).sort(), ['landing', 'referrer', 'utm']);
  for (const e of b.events) for (const k of Object.keys(plainOf(e))) assert.ok(['name', 'seq', 't', 'active', 'page', 'screen', 'ctx', 'props'].includes(k), `unexpected event field ${k}`);
  // Sent as is: no cookies, no IP or user agent string collected by the SDK, no page URL query, no text typed by the player.
  const text = JSON.stringify(b);
  assert.ok(!/x=1|\?/.test(JSON.stringify([b.entry.referrer, b.entry.landing, b.events.map((e: any) => e.page)])), 'host and path only: never a query string');
  assert.equal(b.entry.referrer, 'www.reddit.com/r/indiegames/');
  assert.ok(!/userAgent|cookie|email/i.test(text));
  assert.match(b.anon, /^a_[a-z0-9]{16}$/, 'an anonymous random id');
  assert.equal(b.user, undefined, 'no account id unless the game calls identify()');
  const start = b.events.find((e: any) => e.name === 'session_start');
  assert.deepEqual(Object.keys(plainOf(start.props)).sort(), ['device', 'first_seen', 'returning', 'visits']);
});

test('what we send: the request is a plain POST with no credentials', () => {
  const p = page({ beacon: false });
  p.advance(5000);
  assert.equal(p.fetched[0].url, 'https://hawkesgen.ai/v1/analytics/collect');
  assert.equal(p.fetched[0].init.credentials, 'omit');
  assert.equal(p.fetched[0].init.method, 'POST');
});

test('offline: events queue while the browser is offline and flush when it reconnects', () => {
  const ls = new MemStorage(), p = page({ ls, online: false });
  p.a.track('shop_open');
  p.advance(5000);
  assert.equal(p.sent.length, 0, 'nothing is sent while offline');
  const waiting = JSON.parse(ls.getItem('hawkes.outbox')!).map((s: string) => JSON.parse(s)).flatMap((b: any) => b.events.map((e: any) => e.name));
  assert.ok(waiting.includes('shop_open'), 'the event waits in localStorage');
  p.w.navigator.onLine = true;
  p.fire('win', 'online');
  assert.ok(p.names().includes('shop_open'), 'sent on reconnect, in the same page');
  assert.equal(ls.getItem('hawkes.outbox'), null, 'the queue is emptied once sent');
});

test('offline: a failed send is kept and retried on reconnect; a server error too', async () => {
  const ls = new MemStorage(), p = page({ ls, beacon: false });
  p.a.track('a_thing');
  p.advance(5000);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(JSON.parse(ls.getItem('hawkes.outbox')!).length, 1, 'fetch failed: the batch is kept');
  p.w.navigator.sendBeacon = (url: string, body: string) => { p.sent.push({ url, ...JSON.parse(body) }); return true; };
  p.fire('win', 'online');
  assert.ok(p.names().includes('a_thing'));
  assert.equal(ls.getItem('hawkes.outbox'), null);
});

test('opt-out: nothing is sent, queued or kept, and the waiting queue is deleted', () => {
  const ls = new MemStorage(), p = page({ ls, online: false });
  p.a.track('before');
  p.advance(5000);
  assert.ok(ls.getItem('hawkes.outbox'), 'something is waiting offline');
  p.a.optOut();
  assert.equal(ls.getItem('hawkes.outbox'), null, 'opting out deletes what was waiting');
  p.w.navigator.onLine = true;
  p.fire('win', 'online');
  p.fire('win', 'pointerdown', { isTrusted: true });
  p.a.track('after');
  p.a.error(new Error('boom'));
  p.a.feedback({ rating: 5 });
  p.a.flush();
  p.advance(60_000);
  p.hide();
  assert.equal(p.sent.length, 0, 'no beacon');
  assert.equal(p.fetched.length, 0, 'no fetch');
  assert.equal(ls.getItem('hawkes.outbox'), null, 'nothing queued');
  assert.equal(p.a.config().optedOut, true);
});

test('batching: five quick events are one request; a burst waits for quiet; a steady trickle still goes within 5 s', () => {
  const p = page();
  p.advance(2000);
  assert.equal(p.sent.length, 1, 'the page-load events go out together');
  for (let i = 0; i < 5; i++) { p.a.track('demo_click', { i }); p.advance(300); }
  assert.equal(p.sent.length, 1, 'nothing goes out while the clicks keep coming');
  p.advance(2000);
  assert.equal(p.sent.length, 2, 'one request for the five clicks');
  assert.deepEqual(p.sent[1].events.map((e: any) => e.name), ['demo_click', 'demo_click', 'demo_click', 'demo_click', 'demo_click']);
  p.advance(60_000);
  assert.equal(p.sent.length, 2, 'an idle page sends nothing more: no polling');

  // One event every second never goes quiet: the 5 s cap sends it anyway.
  for (let i = 0; i < 6; i++) { p.a.track('tick'); p.advance(1000); }
  assert.equal(p.sent.length, 3, 'sent 5 s after the first event of the trickle');
  assert.ok(p.sent[2].events.length >= 5);
  // 20 events go at once.
  for (let i = 0; i < 20; i++) p.a.track('burst');
  assert.equal(p.sent.length, 4);
});

test('page hide: queued events are sent at once with sendBeacon, with the exit; pagehide sends what came after', () => {
  const p = page();
  p.advance(2000);
  const before = p.sent.length;
  p.a.track('level_end_click');
  assert.equal(p.sent.length, before, 'still waiting for the timer');
  p.hide();
  assert.equal(p.sent.length, before + 1, 'hiding sent them, one request');
  assert.deepEqual(p.sent[before].events.map((e: any) => e.name), ['level_end_click', 'exit', 'session_end']);
  assert.equal(p.fetched.length, 0, 'sendBeacon took it');
  p.a.track('late');
  p.fire('win', 'pagehide');
  assert.equal(p.sent.length, before + 2, 'pagehide after a hide still flushes what came since');
  assert.deepEqual(p.sent[before + 1].events.map((e: any) => e.name), ['late']);
  p.advance(60_000);
  assert.equal(p.sent.length, before + 2);
});

test('page hide: when sendBeacon refuses, fetch with keepalive carries the batch', () => {
  const p = page({ beacon: false });
  p.a.track('before_hide');
  p.fire('win', 'pagehide');
  assert.equal(p.sent.length, 0);
  assert.equal(p.fetched.length, 1);
  assert.equal(p.fetched[0].init.keepalive, true);
  assert.equal(p.fetched[0].init.credentials, 'omit');
  assert.ok(JSON.parse(p.fetched[0].init.body).events.some((e: any) => e.name === 'before_hide'));
});

test('async: calls made before the script arrives are played back, in order, and the documented tags are async', () => {
  const p = page({ before: (w) => { w.hawkesAnalyticsQ = [['track', 'menu_opened'], ['screen', 'menu']]; } });
  p.a.flush();
  const names = p.names();
  assert.ok(names.indexOf('menu_opened') > names.indexOf('session_start'));
  assert.ok(names.includes('screen'));
  for (const f of ['README.md', 'example/index.html', 'hawkes-analytics.js']) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const tags = text.match(/<script src="https:\/\/hawkesgen\.ai\/sdk\/analytics@1\.js"[^>]*>|&lt;script src="https:\/\/hawkesgen\.ai\/sdk\/analytics@1\.js"[^&]*&gt;/g) ?? [];
    assert.ok(tags.length > 0, `${f} shows the script tag`);
    for (const t of tags) assert.ok(/\basync\b/.test(t) && !/\bdefer\b/.test(t), `${f}: ${t} is async`);
  }
});
