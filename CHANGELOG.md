# Changelog

## 1.3.4 (2026-11-06)

- **Privacy and reliability story** (`docs/privacy.md`): every field a batch and an event carries, what is never sent,
  how opt-out and the offline queue work. No SDK code changed.
- Tests pin the exact fields sent (a new field fails until it is documented), that sending is a credential-less POST,
  that events queue offline and flush when the browser reconnects, and that opt-out sends and queues nothing and deletes
  what was waiting.
- Demo page: a **What we send** panel (every field, plus the last real event), an **opt-out toggle** and an offline
  status with the queue length.

## 1.3.3 (2026-11-06)

- **Event catalogue and naming guide** (`docs/events.md`): the recommended events for games (level_start, level_end,
  death, progress, purchase and more) with their fields, and the rules for names.
- The warning for a skipped event name now says why (spaces, capital letters) and suggests the fixed name
  (`Shop Purchase` -> `shop_purchase`). Still once per name.

## 1.3.2 (2026-11-06)

- Unity: a **Basic events** sample (Package Manager > Hawkes Analytics > Samples > Import). A scene with three buttons
  (`Track`, `Feature`, `levelStart` + `levelEnd`) and an on-screen list of every call, newest first. No Canvas or extra
  packages. In the Editor the list fills and nothing is sent; in WebGL with a Product set, the events reach Studio.
- CI compiles the sample too.

## 1.3.1 (2026-11-06)

- Every warning now says what happened and how to fix it, once each, whether or not debug is on: no product id (web and
  Unity), a bad event name, a call that could not run, the script failing to load (npm loader), no Unity settings asset.
- README: a 5-minute quickstart for web, npm and Unity, and a table of the warnings.

## 1.3.0 (2026-11-01)

First release from its own repo (the SDK was in Hawkes Gen's `clients/` until now). SDK v3, the one
https://hawkesgen.ai/sdk/analytics@1.js serves.

- Browser SDK: page views, sessions, active time from the first real input, devices, load timings, errors, fps,
  outbound links, rage clicks, the exit snapshot; levels, deaths, choices, features, videos, feedback and the `ask()`
  card, `identify()`, `frustration()`, `engage()`, `activity()`; opt-out; the offline queue.
- `@hawkesgen/analytics`: `load()` adds Hawkes Gen's script once, and every call is queued until it runs.
- Unity `com.hawkes.analytics` (was 0.1.0 inside Hawkes Gen): installable by git URL; same API, now on the repo's
  version.
