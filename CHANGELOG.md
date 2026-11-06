# Changelog

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
