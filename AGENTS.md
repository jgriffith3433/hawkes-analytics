# hawkes-analytics: agent guide

The public home (MIT) of Hawkes Analytics' SDKs: `hawkes-analytics.js` (the browser SDK), `index.mjs`
(`@hawkesgen/analytics`, a loader with no copy of the SDK) and `Packages/com.hawkes.analytics` (Unity WebGL bridge).
The service that receives the events, the registry of products and the contract are in Hawkes Gen (private):
`src/analytics/`, `analytics/products.json`, `docs/analytics.md`. Field names are that contract's; change them there
first.

- **Who serves it:** Hawkes Gen serves `hawkes-analytics.js` at `/sdk/analytics@1.js` (and `/sdk/analytics.js`). Gen
  keeps a copy in `clients/js/`; a change here reaches players when Gen's copy is updated from a tag of this repo
  (Gen's `tools/sync-analytics-sdk.mjs`). Pages never keep a copy (Jaycee, 2026-10-27).
- **Never throws, never blocks, no dependencies.** The browser SDK is ES5 in one IIFE; keep it so.
- **Versions:** one for the repo, `1.<ANALYTICS_VERSION>.<patch>`, in `package.json`, the Unity `package.json` and the
  top of `CHANGELOG.md` (`tools/check.mjs` enforces it). A breaking change is a new major and a new `analytics@N.js`.
- **Unity:** every file and folder under `Packages/com.hawkes.analytics` needs a `.meta` with its own GUID; never change
  an existing GUID (games reference them). CI compiles Runtime + Samples against `DevTools/CompileCheck/UnityEngineStub.cs`.
  `tools/unity-check/` is a Unity 6 fixture (local `file:` path to the package) for Studio's Gen compile-only gate.
- **Checks:** `npm test` (the SDK in a fake browser, the loader, then `tools/check.mjs`).
- **Branches:** dev -> beta -> main. Pull requests into beta merge themselves when checks pass (`beta-automerge.yml`,
  label `hold` stops it). main is Jaycee's: it moves when beta goes live, and `release.yml` then tags `v<version>` and
  makes a GitHub release with both tarballs. No npm publish (that would be Jaycee's call).
- **Studio:** project `hawkes-analytics`; Studio's Hawkes Analytics plugin installs from this repo's tags.
