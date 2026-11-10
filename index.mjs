// @hawkesgen/analytics: Hawkes Analytics for bundled web games and apps (Vite, webpack, TypeScript).
//
//   import analytics, { load } from '@hawkesgen/analytics';
//   load({ product: 'phorigins', build: '1.10.0' });   // adds Hawkes Gen's script tag once
//   analytics.levelStart(2);                           // safe before the SDK arrives: queued, then played back
//
// This module keeps no copy of the SDK. It loads https://hawkesgen.ai/sdk/analytics@1.js (the one every Hawkes page
// loads), so a Hawkes Gen deploy updates every game at once. Until it arrives, calls wait in window.hawkesAnalyticsQ
// as [method, ...args], which the SDK plays back when it starts. Nothing here throws, and in Node (SSR, tests) every
// call does nothing. A plain HTML page needs none of this: one <script> tag is enough (README.md).

export const SDK_MAJOR = 1;
export const SDK_URL = `https://hawkesgen.ai/sdk/analytics@${SDK_MAJOR}.js`;

const METHODS = ['init', 'track', 'screen', 'setContext', 'loadStart', 'ready', 'levelStart', 'levelEnd', 'death', 'choice', 'feature', 'video', 'feedback', 'error', 'optOut', 'optIn', 'internal', 'flush', 'activity', 'identify', 'frustration', 'engage', 'on', 'off'];
const QUEUE_MAX = 500;

const win = () => (typeof window !== 'undefined' && window.document ? window : null);
/** The real SDK, once Hawkes Gen's script has run. */
const sdk = () => {
  const w = win();
  const a = w && w.hawkesAnalytics;
  return a && a.version && typeof a.track === 'function' ? a : null;
};

function call(method, args) {
  try {
    const a = sdk();
    if (a) return a[method](...args);
    const w = win();
    if (!w) return undefined;
    const q = (w.hawkesAnalyticsQ = w.hawkesAnalyticsQ || []);
    q.push([method, ...args]);
    if (q.length > QUEUE_MAX) q.shift();
  } catch (e) {
    /* never break the game */
  }
  return undefined;
}

let loading = null;

/**
 * Adds Hawkes Gen's SDK script to the page (once) and starts it with these options. Resolves with the SDK when it has
 * run, or null when it can't load (offline, blocked, no window): the game never depends on it.
 * @param {import('./index.d.ts').LoadOptions} [options]
 */
export function load(options = {}) {
  const w = win();
  if (!w) return Promise.resolve(null);
  const { src = SDK_URL, product, build, endpoint, debug, context, anon, user } = options;
  const init = {};
  if (product) init.product = product;
  if (build) init.build = build;
  if (endpoint) init.endpoint = endpoint;
  if (debug) init.debug = true;
  if (context) init.context = context;
  if (anon) init.anon = anon;
  if (user !== undefined) init.user = user;
  if (Object.keys(init).length) call('init', [init]);
  if (sdk()) return Promise.resolve(sdk());
  if (loading) return loading;
  loading = new Promise((resolve) => {
    try {
      const doc = w.document;
      let s = doc.querySelector('script[data-hawkes-analytics]') || doc.querySelector('script[src*="hawkesgen.ai/sdk/analytics"]');
      const done = () => resolve(sdk());
      if (!s) {
        s = doc.createElement('script');
        s.src = src;
        s.async = true;
        s.setAttribute('data-hawkes-analytics', 'npm');
        (doc.head || doc.documentElement).appendChild(s);
      }
      s.addEventListener('load', done);
      s.addEventListener('error', () => {
        try { console.warn(`[hawkes-analytics] Hawkes Gen's script could not be loaded from ${s.src || src}, so no analytics are sent (the game is not affected). Check the player's connection or an ad blocker, and that the address is ${SDK_URL}.`); } catch { /* no console */ }
        resolve(null);
      });
      // A tag that was already on the page may have run (or failed) before we listened.
      w.setTimeout(done, 15000);
    } catch (e) {
      resolve(null);
    }
  });
  return loading;
}

/** window.hawkesAnalytics when it has loaded, else a stand-in that queues every call for it. */
export const hawkesAnalytics = {};
for (const m of METHODS) hawkesAnalytics[m] = (...args) => call(m, args);
/** ask() needs the card, so it waits for the SDK; null when it never arrives. */
hawkesAnalytics.ask = async (options) => {
  try {
    const a = sdk() || (await load());
    return a ? a.ask(options) : null;
  } catch (e) {
    return null;
  }
};
/** What the SDK knows now (product, env, ids, flags), or null before it has loaded. */
hawkesAnalytics.config = () => {
  try {
    const a = sdk();
    return a ? a.config() : null;
  } catch (e) {
    return null;
  }
};
/** True once Hawkes Gen's script has run. */
hawkesAnalytics.loaded = () => !!sdk();

export default hawkesAnalytics;
