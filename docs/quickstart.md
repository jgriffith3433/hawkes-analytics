# Quickstart (5 minutes)

Pick your kind of game. Each one is copy, paste, play once, and see it in Hawkes Studio's Analytics tab.
`my-game` is your project's name in Hawkes Gen: swap in your own.

## 1. A web page or web game

Paste this in your page's `<head>`:

```html
<script src="https://hawkesgen.ai/sdk/analytics@1.js" data-product="my-game" data-build="1.0.0" async></script>
```

The tag is `async`: it never holds up your page, even on a slow phone connection. Calls your game makes before it
arrives are not lost: push them as `[method, ...args]` and the SDK plays them back when it starts.

```html
<script>window.hawkesAnalyticsQ = window.hawkesAnalyticsQ || []; hawkesAnalyticsQ.push(['track', 'menu_opened']);</script>
```

Events are sent in batches, not one request each: a burst of events goes out as one request 2 seconds after the last
one (at most 5 seconds after the first, or at once at 20 events). When the player hides the tab, switches app or
leaves, whatever is still waiting is sent right then with `navigator.sendBeacon` (a `fetch` with `keepalive` if the
browser refuses). A timer runs only while events are waiting; an idle page makes no requests.

Open the page with `?hawkes-analytics-debug=1` on the end and look in the browser console: each event is logged as it
happens. When the player can play, add `hawkesAnalytics.ready();` to your game's code.

## 2. A bundled game (npm: Vite, webpack, TypeScript)

```bash
npm install https://github.com/jgriffith3433/hawkes-analytics/archive/refs/tags/v1.4.1.tar.gz
```

```js
import analytics, { load } from '@hawkesgen/analytics';

load({ product: 'my-game', build: '1.0.0', debug: true }); // once, at startup
analytics.ready();                                          // the player can play
```

Run the game and look in the console for `[hawkes-analytics] game_ready`. Remove `debug: true` when you ship.

## 3. A Unity WebGL game

1. Window > Package Manager > + > Add package from git URL, then paste
   `https://github.com/jgriffith3433/hawkes-analytics.git?path=/Packages/com.hawkes.analytics#v1.4.1`
2. Assets > Create > Hawkes > Analytics Settings. Save it as `Assets/Resources/HawkesAnalyticsSettings.asset`, set
   **Product** to `my-game`, and tick **Debug**.
3. Call it from a script, when the title screen is interactive:

```csharp
using Hawkes;
HawkesAnalytics.Ready();
```

Build for WebGL, play it in a browser and look in the browser console for `[hawkes-analytics] game_ready`. Nothing is
sent in the Editor.

**Want to see it work first?** Window > Package Manager > Hawkes Analytics > Samples > **Basic events** > Import. Open
`Assets/Samples/Hawkes Analytics/<version>/Basic events/HawkesAnalyticsSample.unity` and press Play: three buttons each
send an event, and the list on screen shows every call, newest first. In the Editor nothing leaves your machine; build
for WebGL with a Product in the settings and the same events reach Hawkes Studio.

Want the whole first session (`game_ready`, `level_start`, `death`, `level_end`) in one paste? See the
[recipes](recipes.md): plain web, Babylon.js and Unity WebGL, each tested.

## If something is wrong

The SDK never breaks your game, and when something is off it says so in the console, in plain words: what happened and
how to fix it. Each warning starts with `[hawkes-analytics]` (`[HawkesAnalytics]` in Unity) and appears once.

| You see | What it means | Fix |
|---|---|---|
| `No product id, so nothing is being sent` | The page never told the SDK which game this is. | Add `data-product="my-game"` to the script tag, or call `hawkesAnalytics.init({ product: 'my-game' })`. Unity: set Product in the settings asset. |
| `The event name "…" was skipped` | Custom event names are 2 to 40 characters, a lowercase letter first, then a-z, 0-9 and `_`. | Rename it, like `shop_purchase`. |
| `Hawkes Gen's script could not be loaded` | An ad blocker, no connection, or a wrong address. | Check them. The game keeps running; no analytics are sent for that visit. |
| `hawkesAnalytics.… could not run` | A call got arguments the SDK could not use. | Check them against the API; the game is not affected. |
| Unity: `No settings found` | There is no `HawkesAnalyticsSettings` asset in a Resources folder. | Assets > Create > Hawkes > Analytics Settings, saved under `Assets/Resources`. |

## Try the demo

The [demo](../index.html) on this site runs the real SDK in three steps. Paste the line, send an event, watch it get
acknowledged.
