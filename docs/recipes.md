# Recipes

Three copy-paste recipes, one per kind of game. Each sends the four events a first session needs, with the names from
the [event catalogue](events.html): `game_ready`, `level_start`, `death` and `level_end`. Those four are what Studio's
funnel, levels and deaths pages read, so a game that sends them shows who comes back on day one.

Every recipe here is tested. `npm test` runs the plain web and Babylon code from this page in a page with no screen
and sends the events to the beta collect endpoint: the test passes only when each one comes back acknowledged. The
Unity code is the file CI compiles in `DevTools/CompileCheck`, and a test fails if this page and that file differ.
`my-game` is your project's name in Hawkes Gen: swap in your own.

| Recipe | You add | Events sent from |
|---|---|---|
| [Plain web](#plain-web-script-tag) | One script tag | Your page's own code |
| [Babylon.js](#babylon-js-npm) | `@hawkesgen/analytics` from npm | A Babylon scene |
| [Unity WebGL](#unity-webgl-package-and-jslib) | The `com.hawkes.analytics` package | A MonoBehaviour |

## Plain web (script tag)

Paste the tag in your page's `<head>` and the helper beside your game's code. The helper plays a call at once when the
SDK is there and queues it when it is not yet, so nothing is lost while the async tag loads.

```html
<script src="https://hawkesgen.ai/sdk/analytics@1.js" data-product="my-game" data-build="1.0.0" async></script>
<script>
  function hawkes(method) {
    var args = Array.prototype.slice.call(arguments);
    if (window.hawkesAnalytics) window.hawkesAnalytics[method].apply(null, args.slice(1));
    else (window.hawkesAnalyticsQ = window.hawkesAnalyticsQ || []).push(args);
  }

  // The player can play: the title screen is up.
  hawkes('ready');                                // game_ready

  function startLevel(level) {
    hawkes('levelStart', level);                  // level_start { level, attempt }
  }
  function playerDied(level, cause) {
    hawkes('death', cause, { where: 'bridge' });  // death { cause, where }
    hawkes('levelEnd', level, 'death');           // level_end { level, result, duration, deaths }
  }
  function finishLevel(level, score) {
    hawkes('levelEnd', level, 'complete', { score: score });
  }
</script>
```

Call `startLevel(1)` when a level begins, `playerDied(1, 'fall')` when the player dies and `finishLevel(1, 1200)` when
they win. Add `?hawkes-analytics-debug=1` to the page address to see each event in the console.

## Babylon.js (npm)

```bash
npm install https://github.com/jgriffith3433/hawkes-analytics/archive/refs/tags/v1.4.1.tar.gz
```

The events come from the scene itself: the first frame is the level start, a fall below the world is a death, and
reaching the goal is the end. `trackLevel` watches one level and reports each moment once.

```js
import analytics, { load } from '@hawkesgen/analytics';
import { Vector3 } from '@babylonjs/core';

load({ product: 'my-game', build: '1.0.0' }); // once, at startup

export function trackLevel(scene, { level, player, goal }) {
  let ended = false;
  const end = (result) => { if (!ended) { ended = true; analytics.levelEnd(level, result); } };

  scene.executeWhenReady(() => analytics.ready());                // game_ready
  scene.onBeforeRenderObservable.addOnce(() => analytics.levelStart(level)); // level_start

  scene.onBeforeRenderObservable.add(() => {
    if (ended) return;
    if (player.position.y < -10) {                                // fell out of the world
      analytics.death('fall', { where: 'bridge' });               // death
      end('death');                                               // level_end
    } else if (Vector3.Distance(player.position, goal.position) < 1.5) {
      end('complete');                                            // level_end
    }
  });
}
```

Call `trackLevel(scene, { level: '1', player, goal })` once after you build the scene. For the next attempt, build the
scene again and call it again: the SDK counts the attempts.

## Unity WebGL (package and jslib)

1. Window > Package Manager > + > Add package from git URL, then paste
   `https://github.com/jgriffith3433/hawkes-analytics.git?path=/Packages/com.hawkes.analytics#v1.4.1`
2. Assets > Create > Hawkes > Analytics Settings. Save it as `Assets/Resources/HawkesAnalyticsSettings.asset` and set
   **Product** to `my-game`.
3. Add this script to a GameObject and call its three methods from your game. Build for WebGL: nothing is sent in the
   Editor.

```csharp
using System.Collections.Generic;
using Hawkes;
using UnityEngine;

// Hawkes Analytics recipe: the four first-session events from a Unity WebGL game.
// Put this on any GameObject, then call the three methods from your game where those moments happen.
public class HawkesRecipe : MonoBehaviour
{
    const string Level = "1";

    void Start()
    {
        // The player can play: the title screen is up and answers input.
        HawkesAnalytics.Ready();
    }

    // A level begins (call it again for each attempt).
    public void OnLevelBegan()
    {
        HawkesAnalytics.LevelStart(Level);
    }

    // The player dies. The level ends with it, so the funnel sees where players give up.
    public void OnPlayerDied(string cause)
    {
        HawkesAnalytics.Death(cause, new Dictionary<string, object> { { "where", "bridge" } });
        HawkesAnalytics.LevelEnd(Level, "death");
    }

    // The player finishes the level.
    public void OnLevelFinished(int score)
    {
        HawkesAnalytics.LevelEnd(Level, "complete", new Dictionary<string, object> { { "score", score } });
    }
}
```

The package already holds the bridge: Unity compiles every `.jslib` under a `Plugins/WebGL` folder into the build, so
there is nothing for you to add. This is the file, `Runtime/Plugins/WebGL/HawkesAnalytics.jslib`, for reference.
`HawkesAnalytics.Ready()` and the other calls reach `window.hawkesAnalytics` through it, and it adds Gen's script tag
when the page has none, so the page needs no change.

```js
// The bridge from HawkesAnalytics.cs to window.hawkesAnalytics (Hawkes Gen's analytics SDK, docs/analytics.md).
// If the page hasn't loaded the SDK, Init adds its script tag with the product from the Unity settings; calls made
// before it loads wait in window.hawkesAnalyticsQ, which the SDK plays back when it starts. Nothing here throws.
mergeInto(LibraryManager.library, {
  HawkesAnalytics_Init: function (productPtr, srcPtr, endpointPtr, versionPtr, debug) {
    try {
      var product = UTF8ToString(productPtr), src = UTF8ToString(srcPtr), endpoint = UTF8ToString(endpointPtr), version = UTF8ToString(versionPtr);
      // The Game/v<n> folder the build was loaded from, when the page has one.
      var m = /\/Game\/v(\d+)\//i.exec(location.pathname);
      var scripts = document.querySelectorAll('script[src]');
      for (var i = 0; !m && i < scripts.length; i++) m = /\/Game\/v(\d+)\//i.exec(scripts[i].src);
      if (m) version = (version ? version + '+' : '') + 'v' + m[1];
      var a = window.hawkesAnalytics;
      if (a && a.init && a.config) {
        // The page loaded the SDK itself: fill in only what it doesn't have.
        var c = a.config(), o = {};
        if (!c.product && product) o.product = product;
        if (!c.build && version) o.build = version;
        if (debug) o.debug = true;
        a.init(o);
        return;
      }
      window.hawkesAnalyticsQ = window.hawkesAnalyticsQ || [];
      if (!src || document.querySelector('script[data-hawkes-analytics]')) return;
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-hawkes-analytics', 'unity');
      if (product) s.setAttribute('data-product', product);
      if (version) s.setAttribute('data-build', version);
      if (endpoint) s.setAttribute('data-endpoint', endpoint);
      if (debug) s.setAttribute('data-debug', '1');
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      try { console.warn('[hawkes-analytics] bridge', e); } catch (x) {}
    }
  },

  HawkesAnalytics_Call: function (methodPtr, argsPtr) {
    try {
      var method = UTF8ToString(methodPtr), args = JSON.parse(UTF8ToString(argsPtr) || '[]');
      var a = window.hawkesAnalytics;
      if (a && typeof a[method] === 'function') return void a[method].apply(null, args);
      var q = window.hawkesAnalyticsQ = window.hawkesAnalyticsQ || [];
      q.push([method].concat(args));
      if (q.length > 500) q.shift();
    } catch (e) {}
  },
});
```
