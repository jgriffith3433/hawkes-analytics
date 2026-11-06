# What the SDK sends, and what it doesn't

Trust is part of the product, so this page is exact. Every field below is checked by `test/sdk.test.ts` ("what we send"):
add a field to the SDK and the tests fail until it is listed here and on the demo page's **What we send** panel.

Events go to one place, `https://hawkesgen.ai/v1/analytics/collect` (Hawkes Gen), as a plain POST with no cookies and
no credentials. No third party gets anything.

## Every batch

| Field | What it is |
|---|---|
| `product` | Your game's id (`data-product`). |
| `build` | `{ version, commit?, date? }` from `data-build` / `HAWKES_BUILD`. |
| `env` | `local`, `beta`, `preview` or `live`, worked out from the host name. |
| `anon` | A random id (`a_` + 16 letters and digits) kept in the browser's localStorage. Not derived from anything about the person. |
| `session` | A random id for this visit. A new tab or 30 idle minutes starts a new one. |
| `user` | Only if the game calls `identify(id)`: the site's own account id. Never an email or a name. |
| `sdk` | `js/<version>`. |
| `entry` | First batch of a visit only: `referrer` (host and path, no query), `landing` (path), `utm` (the five `utm_*` values). |
| `flags` | `webdriver`, `playtest`, `internal`, `automation`: so bots and our own testing can be told from players. |
| `device` | `screen`, `viewport`, `dpr`, `lang`, `tz`, `touch`, `conn`, `cores`, `mem`, `gpu` (see below). |
| `events` | The list of events. |

## Every event

`name`, `seq` (its number in the session), `t` (time), `active` (active milliseconds so far), `page` (path only, no query),
`screen`, `ctx` (what the game set with `setContext`) and `props` (the event's own details, see below).

## What the SDK collects by itself

| Event | `props` |
|---|---|
| `session_start` | `returning`, `visits`, `first_seen` (a date), `device` |
| `page_view` | `title` |
| `page_load` | `ttfb`, `dom`, `load`, `dns`, `connect`, `bytes`, `type` |
| `first_input` | `kind` (pointer, touch, key, wheel, mouse), `after`. Never which key or where. |
| `perf` | `fps`, `fps_p10`, `memory` (once an active minute) |
| `outbound` | `url` (host and path), `text` (the link's text, 60 characters) |
| `rage_click` | `x`, `y`, `target` (tag and id) |
| `error` | `message`, `stack`, `source`, `file`, `line`, `tag` (once per kind of error, 25 at most) |
| `exit` | `recent` (the names of the last 20 events), `state` (the game's own `hawkesPlaytest.state()`, if it has one), `active` |
| `session_end` | `active`, `reason` |

`gpu` is the graphics card's name (what WebGL reports), the one part of `device` that is hardware-specific: it tells us why
a game runs slowly on some machines. It is not used to follow anyone.

Everything else (`level_start`, `death`, `feedback` ...) is sent only because the game's own code called it, with the fields
that call gave. See [events.md](events.md).

## What Hawkes Gen adds when the request arrives

Any server sees a request's IP address and user agent, so Gen's service reads them, and keeps less than that: country,
region, city and time zone worked out from the IP (the IP itself is then thrown away: never written to the database or a
log), a salted one-way hash of the network (it links one person's visits across browsers and Hawkes products, which is why opt-out matters), and the browser, OS and device type from the user agent. That is documented in
Hawkes Gen's `docs/analytics.md` ("Place", "The network", "User agent"); it is not something the SDK sends.

## What it never sends

- No cookies. The SDK itself reads no IP address and does not send the user agent string.
- No keystrokes, no mouse trail, no screenshots, no text from the page. `feedback` text is only what a player typed into a
  feedback card and chose to send.
- No page query strings (they can hold tokens), no fingerprinting (no canvas, audio or font probing).
- No email or name. `identify()` accepts only an id of letters, digits, `_` and `-`.

## Opt-out

`hawkesAnalytics.optOut()` stops everything for that browser, now and on every later visit (it is remembered):

- nothing is recorded, queued or sent: events, errors, feedback, input tracking and the exit snapshot all stop;
- the batch waiting in the offline queue and the current session are deleted;
- the feedback card is not shown.

`hawkesAnalytics.optIn()` starts a new session. `hawkesAnalytics.config().optedOut` says which it is. Games should offer
this as a setting. The demo page has the toggle.

## Offline and reliability

- Events are batched (every 5 seconds or 20 events) and sent with `sendBeacon`, which survives the page closing.
- If the browser is offline, `sendBeacon` is refused or the server answers 5xx, the batch waits in localStorage
  (`hawkes.outbox`: at most 40 batches or about 300 KB, oldest dropped first) and is sent when the browser fires `online` or
  on the next visit. There is no retry timer: an idle page makes no requests.
- Batches are 200 events and 60 KB at most; the in-memory queue holds 500.
- The SDK never throws into the game and never blocks it. If storage is blocked it still works for that visit, without
  the queue.
