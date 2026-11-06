# Hawkes Analytics

Player analytics for web and Unity WebGL games, in one line. Who plays and comes back, where they drop off, levels and
deaths, errors and frame rates, ratings and comments, and what gets in their way (failed requests, rage clicks). It's
all read in Hawkes Studio's Analytics tab, and Studio's agents turn it into work. No cookies, no fingerprinting, no
third party: events go to Hawkes Gen only.

This repo is the SDK's home: the browser SDK (`hawkes-analytics.js`, what https://hawkesgen.ai/sdk/analytics@1.js
serves), the npm package `@hawkesgen/analytics` for bundled games, and the Unity package `com.hawkes.analytics`.
The contract (every event and field, bots, the query API) is `docs/analytics.md` in Hawkes Gen.

## Quickstart (5 minutes)

Pick your kind of game. Each one is copy, paste, play once, and see it in Hawkes Studio's Analytics tab.
`my-game` is your project's name in Hawkes Gen: swap in your own.

### 1. A web page or web game

Paste this in your page's `<head>`:

```html
<script src="https://hawkesgen.ai/sdk/analytics@1.js" data-product="my-game" data-build="1.0.0" defer></script>
```

Open the page with `?hawkes-analytics-debug=1` on the end and look in the browser console: each event is logged as it
happens. When the player can play, add `hawkesAnalytics.ready();` to your game's code.

### 2. A bundled game (npm: Vite, webpack, TypeScript)

```bash
npm install https://github.com/jgriffith3433/hawkes-analytics/archive/refs/tags/v1.3.1.tar.gz
```

```js
import analytics, { load } from '@hawkesgen/analytics';

load({ product: 'my-game', build: '1.0.0', debug: true }); // once, at startup
analytics.ready();                                          // the player can play
```

Run the game and look in the console for `[hawkes-analytics] game_ready`. Remove `debug: true` when you ship.

### 3. A Unity WebGL game

1. Window > Package Manager > + > Add package from git URL, then paste
   `https://github.com/jgriffith3433/hawkes-analytics.git?path=/Packages/com.hawkes.analytics#v1.3.1`
2. Assets > Create > Hawkes > Analytics Settings. Save it as `Assets/Resources/HawkesAnalyticsSettings.asset`, set
   **Product** to `my-game`, and tick **Debug**.
3. Call it from a script, when the title screen is interactive:

```csharp
using Hawkes;
HawkesAnalytics.Ready();
```

Build for WebGL, play it in a browser and look in the browser console for `[hawkes-analytics] game_ready`. Nothing is
sent in the Editor.

### If something is wrong

The SDK never breaks your game, and when something is off it says so in the console, in plain words: what happened and
how to fix it. Each warning starts with `[hawkes-analytics]` (`[HawkesAnalytics]` in Unity) and appears once.

| You see | What it means | Fix |
|---|---|---|
| `No product id, so nothing is being sent` | The page never told the SDK which game this is. | Add `data-product="my-game"` to the script tag, or call `hawkesAnalytics.init({ product: 'my-game' })`. Unity: set Product in the settings asset. |
| `The event name "…" was skipped` | Custom event names are 2 to 40 characters, a lowercase letter first, then a-z, 0-9 and `_`. | Rename it, like `shop_purchase`. |
| `Hawkes Gen's script could not be loaded` | An ad blocker, no connection, or a wrong address. | Check them. The game keeps running; no analytics are sent for that visit. |
| `hawkesAnalytics.… could not run` | A call got arguments the SDK could not use. | Check them against the examples below; the game is not affected. |
| Unity: `No settings found` | There is no `HawkesAnalyticsSettings` asset in a Resources folder. | Assets > Create > Hawkes > Analytics Settings, saved under `Assets/Resources`. |

## Add it to a project

**With Hawkes Studio:** Plugins > Hawkes Analytics > Install (or ask Talk: "add Hawkes Analytics"). Studio opens a pull
request into beta with the line or the package, for web and Unity projects alike, and shows when an upgrade is out.

### A web page or web game

One tag in every page (game pages and website pages alike):

```html
<script src="https://hawkesgen.ai/sdk/analytics@1.js" data-product="my-game" data-build="1.0.0" defer></script>
```

`data-product` is the project's name in Hawkes Gen. That alone gives page views, sessions, active time, referrers and
UTM, devices, load timings, errors, fps, outbound links, rage clicks and an exit snapshot. The game adds the rest:

```js
const a = window.hawkesAnalytics;
a.ready();                                  // the player can play
a.levelStart(2);  a.death('imp');  a.levelEnd(2, 'complete', { score: 10 });
a.feedback({ rating: 4, text: 'fun' });
await a.ask({ id: 'after-level-2', question: 'How was that level?', kind: 'stars', comment: true });
a.track('shop_purchase', { item: 'boots' }); // custom events: ^[a-z][a-z0-9_]{1,39}$
```

Always load it from Hawkes Gen rather than keeping a copy: a Gen release then updates every game at once.

### A bundled game (Vite, webpack, TypeScript)

```bash
npm install https://github.com/jgriffith3433/hawkes-analytics/archive/refs/tags/v1.3.1.tar.gz
```

```js
import analytics, { load } from '@hawkesgen/analytics';

load({ product: 'my-game', build: '1.0.0' }); // adds Hawkes Gen's script tag once
analytics.levelStart(2);                      // safe before it arrives: queued, then played back
```

The package keeps no copy of the SDK: it loads the same `analytics@1.js` and queues calls until it runs, so the game
never waits on it and never breaks without it. Types for everything ship with it. `@hawkesgen/analytics/sdk` is the SDK
itself as a module, for a page that can't load scripts from Hawkes Gen.

### Unity

Window > Package Manager > + > Add package from git URL:

```
https://github.com/jgriffith3433/hawkes-analytics.git?path=/Packages/com.hawkes.analytics#v1.3.1
```

or in `Packages/manifest.json`:

```json
"com.hawkes.analytics": "https://github.com/jgriffith3433/hawkes-analytics.git?path=/Packages/com.hawkes.analytics#v1.3.1"
```

Then Assets > Create > Hawkes > Analytics Settings, saved as `Assets/Resources/HawkesAnalyticsSettings.asset`, with the
product set. It starts itself when the game boots and loads the SDK into the page, so the game's website needs no
change.

```csharp
using Hawkes;
HawkesAnalytics.Ready();
HawkesAnalytics.LevelStart("3");
HawkesAnalytics.Death("imp");
HawkesAnalytics.LevelEnd("3", "complete");
HawkesAnalytics.Track("shop_purchase", "{\"item\":\"boots\"}");
HawkesAnalytics.Ask("after-level-3", "How was that level?", "level 3", stars: true);
```

In the Editor and outside WebGL nothing is sent (`logOutsideWebGL` in the settings logs each call instead).

## Debugging

`?hawkes-analytics-debug=1` on any page (or `debug: true`) logs each event to the console and keeps them on
`window.hawkesAnalytics.debugLog`. `hawkesAnalytics.optOut()` stops everything for that browser.

## Versions

One version for the whole repo, tagged `v<version>`: `1.<SDK version>.<patch>`. The major is the address pages load
(`analytics@1.js`); a breaking change ships as `analytics@2.js` and `2.0.0`. See [CHANGELOG.md](CHANGELOG.md).

Branches: work goes into `dev` or a branch, pull requests into `beta` merge themselves once checks pass, and `main`
moves when beta goes live; a new version on main is tagged and released by itself (`.github/workflows/release.yml`).

License: MIT.
