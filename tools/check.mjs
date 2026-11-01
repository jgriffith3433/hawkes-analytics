// Release checks with no network and no Unity: one version everywhere, the SDK's major matches the address pages load,
// every Unity package file and folder has its .meta (games reference the GUIDs) with a unique GUID, and the npm package
// ships what it says. `npm test` runs it after the tests; CI runs both.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`✓ @hawkesgen/analytics and com.hawkes.analytics ${pkg.version} (analytics@${major}.js, SDK v${sdkVersion}), ${guids.size} .meta files`);
