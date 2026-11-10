# API

The browser SDK is `window.hawkesAnalytics` (loaded from
`https://hawkesgen.ai/sdk/analytics@1.js`). The npm package `@hawkesgen/analytics` is a loader: it adds that script and
queues calls until it runs. Unity's `HawkesAnalytics` is the same methods over a jslib bridge. The full event contract
(every field, bots, the query API) is `docs/analytics.md` in Hawkes Gen.

## Load

### Script tag

```html
<script src="https://hawkesgen.ai/sdk/analytics@1.js" data-product="my-game" data-build="1.0.0" async></script>
```

Optional attributes: `data-debug="1"`, `data-endpoint="…"`. Always prefer `async`. Early calls:

```html
<script>window.hawkesAnalyticsQ = window.hawkesAnalyticsQ || []; hawkesAnalyticsQ.push(['ready']);</script>
```

### npm

```js
import analytics, { load } from '@hawkesgen/analytics';

load({ product: 'my-game', build: '1.0.0', debug: false });
```

`load` adds Gen's script once. Methods on the default export are safe before it arrives. `@hawkesgen/analytics/sdk` is
the SDK itself as a module, for a page that cannot load scripts from Hawkes Gen.

### Unity

```csharp
using Hawkes;
HawkesAnalytics.Ready();
HawkesAnalytics.LevelStart("3");
HawkesAnalytics.Death("imp");
HawkesAnalytics.LevelEnd("3", "complete");
HawkesAnalytics.Track("shop_purchase", "{\"item\":\"boots\"}");
```

Configure **Product** in `Assets/Resources/HawkesAnalyticsSettings.asset`. Nothing is sent in the Editor.

## Methods

| Method | What it does |
|---|---|
| `init(options)` | Set `product`, `build`, `debug`, `endpoint`, `context`, `anon`, `user`. Usually the script tag or `load` does this. |
| `config()` | Current `{ product, endpoint, build, debug, env, anon, session, optedOut, flags }`. |
| `ready(props?)` | `game_ready`: the player can play. Sends `ms` since `loadStart()` or navigation. |
| `loadStart()` | `game_load_start`: the game starts loading. |
| `levelStart(level, props?)` | A level begins. |
| `levelEnd(level, result, props?)` | A level ends. `result`: `complete`, `death`, `quit`, `restart`. |
| `death(cause, props?)` | The player died. |
| `choice(node, option, props?)` | A dialogue or branch choice. |
| `feature(name, props?)` | A feature was used. |
| `video(id, action, at?, props?)` | A cutscene. `action`: `play`, `complete`, `skip`. |
| `feedback({ rating, text?, context? })` | A rating or comment. |
| `ask(options)` | Show the feedback card. Returns a Promise with what the player said, or `null`. |
| `track(name, props?)` | A custom event. Name: `^[a-z][a-z0-9_]{1,39}$`. |
| `screen(name)` | Name the current screen (copied onto later events). |
| `setContext(ctx)` | Merged into every event; a `null` value removes a key. |
| `identify(id)` | Tie sessions to the site's own account id (4–64 of `A-Za-z0-9_-`; no email). `null` on sign-out. |
| `error(error, source?, props?)` | Report an error. |
| `frustration(kind, props?)` | Something got in the player's way (`out_of_credits`, `assistant_failed`, …). |
| `engage(name, seconds, props?)` | Time spent on something. |
| `activity()` | Keep active time and the session going when the SDK cannot see input (sandboxed frame). |
| `flush()` | Send the waiting batch now. |
| `optOut()` / `optIn()` | Stop or resume all sending for this browser (remembered). |
| `internal(on?)` | Mark this browser as internal testing (`?hawkes-internal=1`). |
| `on(type, fn)` / `off(type, fn)` | Watch `queued`, `batched`, `sent`, `acked`, `dropped`. See below. |

## Listeners

```js
hawkesAnalytics.on('acked', (info) => {
  // { id, name, fields, batch, queuedAt, ackedAt }
});
hawkesAnalytics.on('dropped', (info) => {
  // reason: 'opted out' | 'bad name' | 'no product' | 'queue full' | 'network gave up'
});
```

Callbacks run inline (no timers). A throwing one is ignored. While an `acked` listener exists, batches go by `fetch`
instead of a beacon so the answer can be seen. Through the npm loader, `on` / `off` before the script loads are queued.

## Debugging

- `?hawkes-analytics-debug=1` or `debug: true` logs each event and keeps them on `hawkesAnalytics.debugLog`.
- Warnings start with `[hawkes-analytics]` and appear once, with what happened and how to fix it.

## Events catalogue

See [Events](events.html) for recommended names and fields, and [Privacy](privacy.html) for every field the SDK sends
(and what it never does).
