// Release checks with no network and no Unity: one version everywhere, the SDK's major matches the address pages load,
// every Unity package file and folder has its .meta (games reference the GUIDs) with a unique GUID, and the npm package
// ships what it says. `npm test` runs it after the tests; CI runs both.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPM = path.join(ROOT, 'Packages', 'com.hawkes.analytics');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const problems = [];
const fail = (m) => problems.push(m);

const pkg = JSON.parse(read('package.json'));
const upm = JSON.parse(read('Packages/com.hawkes.analytics/package.json'));
const semver = /^\d+\.\d+\.\d+$/;
if (pkg.name !== '@hawkesgen/analytics') fail(`package.json name is ${pkg.name}`);
if (!semver.test(pkg.version)) fail(`package.json version ${pkg.version} is not x.y.z`);
if (upm.name !== 'com.hawkes.analytics') fail(`Unity package name is ${upm.name}`);
if (upm.version !== pkg.version) fail(`Unity package ${upm.version} and package.json ${pkg.version} differ: one version for the repo (tag v<version>)`);

// The top CHANGELOG entry is this version.
const top = /^## \[?(\d+\.\d+\.\d+)/m.exec(read('CHANGELOG.md'));
if (!top || top[1] !== pkg.version) fail(`CHANGELOG.md's newest entry (${top?.[1]}) is not ${pkg.version}`);

// analytics@<major>.js is what pages load: the npm major and the loader's address follow it.
const loader = read('index.mjs');
const major = Number(/export const SDK_MAJOR = (\d+);/.exec(loader)?.[1]);
if (major !== Number(pkg.version.split('.')[0])) fail(`index.mjs SDK_MAJOR ${major} is not package.json's major (${pkg.version})`);
const settings = read('Packages/com.hawkes.analytics/Runtime/HawkesAnalyticsSettings.cs');
if (!settings.includes(`https://hawkesgen.ai/sdk/analytics@${major}.js`)) fail(`HawkesAnalyticsSettings.cs sdkUrl is not analytics@${major}.js`);
const sdkVersion = Number(/var ANALYTICS_VERSION = (\d+);/.exec(read('hawkes-analytics.js'))?.[1]);
if (sdkVersion !== Number(pkg.version.split('.')[1])) fail(`hawkes-analytics.js ANALYTICS_VERSION ${sdkVersion} is not package.json's minor (${pkg.version}): 1.<sdk version>.<patch>`);

// Every file in "files" exists.
for (const f of pkg.files) if (!fs.existsSync(path.join(ROOT, f))) fail(`package.json files lists ${f}, which is missing`);

// .meta for every file and folder; GUIDs unique.
const guids = new Map();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p);
    if (e.name.endsWith('.meta')) {
      const g = /^guid: ([0-9a-f]{32})$/m.exec(fs.readFileSync(p, 'utf8'))?.[1];
      if (!g) fail(`${rel} has no guid`);
      else if (guids.has(g)) fail(`${rel} has the same guid as ${guids.get(g)}`);
      else guids.set(g, rel);
      if (!fs.existsSync(p.slice(0, -5))) fail(`${rel} has nothing to describe`);
      continue;
    }
    if (e.name.startsWith('.') || e.name.endsWith('~')) continue;
    if (!fs.existsSync(p + '.meta')) fail(`${rel} has no .meta`);
    if (e.isDirectory()) walk(p);
  }
})(UPM);

// Docs sources the package build renders to dist/docs/ (tools/docs.mjs).
for (const f of ['quickstart.md', 'recipes.md', 'events.md', 'privacy.md', 'api.md']) {
  if (!fs.existsSync(path.join(ROOT, 'docs', f))) fail(`docs/${f} is missing (beta docs pages are built from it)`);
}

// The privacy story: every field the SDK puts in a batch is in docs/privacy.md and on the demo page's "What we send" panel.
const demoPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'example', 'index.html');
const privacy = read('docs/privacy.md'), demo = fs.readFileSync(demoPath, 'utf8');
for (const f of ['product', 'build', 'env', 'anon', 'session', 'user', 'sdk', 'entry', 'flags', 'device', 'events']) {
  if (!privacy.includes(`| \`${f}\``)) fail(`docs/privacy.md does not list the batch field ${f}`);
  if (!new RegExp(`\\['${f}(\\[\\]|')`).test(demo)) fail(`example/index.html's What we send panel does not list ${f}`);
}

// The playtest contract: the demo is published as the beta site and Studio plays it, so window.hawkesPlaytest must exist as
// soon as the head scripts have run (no waiting for load or network) and list every scenario Studio plays. Only the
// scripts without a src are evaluated, in a bare fake window with no network.
const SCENARIOS = ['smoke', 'phone', 'inspector', 'mobile', 'docs'];
{
  const head = demo.split(/<body[\s>]/i)[0];
  const noop = () => {};
  const stub = new Proxy(noop, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : stub), apply: () => stub, construct: () => stub });
  const win = { location: { search: '', href: 'http://localhost/', origin: 'http://localhost' }, navigator: { userAgent: 'check' },
    document: { readyState: 'loading', addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => stub, head: stub, body: stub, documentElement: stub },
    addEventListener: noop, URLSearchParams, URL, setTimeout: noop, clearTimeout: noop, setInterval: noop, fetch: () => new Promise(noop), console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array, crypto: { getRandomValues: (a) => a } };
  win.window = win; win.self = win; win.globalThis = win;
  vm.createContext(win);
  for (const m of head.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { vm.runInContext(m[1], win, { timeout: 2000 }); } catch (e) { fail(`the demo's head script threw before window.hawkesPlaytest was defined: ${e && e.message || e}`); break; }
  }
  const pt = win.hawkesPlaytest;
  if (!pt || typeof pt.scenarios !== 'function' || typeof pt.start !== 'function') {
    fail(`${path.relative(ROOT, demoPath)} does not define window.hawkesPlaytest synchronously: Studio could not play the beta site (it needs scenarios() and start() from a head script, not after load)`);
  } else {
    let ids = [];
    try { ids = pt.scenarios().map((s) => s.id); } catch (e) { fail(`window.hawkesPlaytest.scenarios() threw: ${e && e.message || e}`); }
    for (const id of SCENARIOS) if (!ids.includes(id)) fail(`window.hawkesPlaytest is missing the scenario "${id}" (found: ${ids.join(', ') || 'none'})`);
  }

  // The scenarios wait on the SDK's listener events, never on a timer that checks again and again.
  if (/setInterval/.test(head) || /await wait\(100\)/.test(head)) fail('the demo\'s playtest contract polls (setInterval or a repeated wait(100)): wait on listener events instead');

  // The docs-link step: a broken internal link fails the step naming the link, and the real site has none.
  if (pt && typeof pt._checkLinks === 'function') {
    const page = (links) => ({ status: 200, text: links.map((h) => `<a href="${h}">x</a>`).join('\n') });
    const site = {
      'http://localhost/s/index.html': page(['docs/', 'docs/privacy.html', 'https://example.com/out', '#top', 'mailto:a@b.c']),
      'http://localhost/s/docs/': page(['../index.html', 'events.html', 'gone.html#part']),
      'http://localhost/s/docs/privacy.html': page(['./']),
      'http://localhost/s/docs/events.html': page(['api.html']),
    };
    const get = async (u) => site[u] || { status: 404, text: '' };
    const r = await pt._checkLinks(get, 'http://localhost/s/index.html');
    if (r.broken.length !== 2 || !r.broken.some((b) => b.link === 'gone.html#part' && b.status === 404 && b.from === 'docs/') || !r.broken.some((b) => b.link === 'api.html' && b.from === 'docs/events.html')) {
      fail(`the docs-link step did not name the broken links (got ${JSON.stringify(r.broken)})`);
    }
    // The real demo and the docs pages the package build renders from docs/*.md.
    const built = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'docs.mjs')], { encoding: 'utf8' });
    if (built.status !== 0) fail(`tools/docs.mjs failed: ${built.stderr}`);
    else {
      const dist = path.join(ROOT, 'dist');
      const real = async (u) => {
        let p = decodeURIComponent(new URL(u).pathname.replace(/^\/s\//, ''));
        if (p === '' || p.endsWith('/')) p += 'index.html';
        const file = p === 'index.html' ? demoPath : path.join(dist, p);
        return fs.existsSync(file) && fs.statSync(file).isFile() ? { status: 200, text: fs.readFileSync(file, 'utf8') } : { status: 404, text: '' };
      };
      const rr = await pt._checkLinks(real, 'http://localhost/s/index.html');
      for (const b of rr.broken) fail(`docs link "${b.link}" returns ${b.status}, linked from ${b.from}`);
      if (rr.checked < 6) fail(`the docs-link step only checked ${rr.checked} pages: it should reach the demo, docs/ and every docs page`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`✓ @hawkesgen/analytics and com.hawkes.analytics ${pkg.version} (analytics@${major}.js, SDK v${sdkVersion}), ${guids.size} .meta files`);
