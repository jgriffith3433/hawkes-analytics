# Changelog

## 1.3.0 (2026-11-01)

First release from its own repo (the SDK was in Hawkes Gen's `clients/` until now). SDK v3, the one
https://hawkesgen.ai/sdk/analytics@1.js serves.

- Browser SDK: page views, sessions, active time from the first real input, devices, load timings, errors, fps,
  outbound links, rage clicks, the exit snapshot; levels, deaths, choices, features, videos, feedback and the `ask()`
  card, `identify()`, `frustration()`, `engage()`, `activity()`; opt-out; the offline queue.
- `@hawkesgen/analytics`: `load()` adds Hawkes Gen's script once, and every call is queued until it runs.
- Unity `com.hawkes.analytics` (was 0.1.0 inside Hawkes Gen): installable by git URL; same API, now on the repo's
  version.
