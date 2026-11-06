# Event catalogue and naming guide

Good data starts with good names. This is the short list of events we recommend for a game, what to put in each, and
how to name your own. The full contract (every field, limits, the query API) is `docs/analytics.md` in Hawkes Gen.

## Naming rules

A custom event name is 2 to 40 characters: a **lowercase letter first**, then `a-z`, `0-9` and `_`.

| Do | Don't | Why |
|---|---|---|
| `shop_purchase` | `Shop Purchase` | No spaces, no capitals. |
| `level_end` | `levelEnd`, `LevelEnd` | snake_case, not camelCase. |
| `boss_defeated` | `boss-defeated`, `boss.defeated` | Only `_` joins words. |
| `purchase` with `{ item: 'boots' }` | `purchase_boots`, `purchase_shield`, … | Put what varies in a field, not in the name. |
| `tutorial_skip` | `skipped the tutorial!!` | Short, a thing then what happened. |

A name that breaks the rules is **skipped** (never sent, never throws), and the SDK warns once per name in the
console, whether or not debug is on, with the fixed name:

```
[hawkes-analytics] The event name "Level Start" was skipped (it has spaces): names are 2 to 40 characters, start with a
lowercase letter, and use only a-z, 0-9 and _. Rename it, for example "level_start". (https://github.com/…#readme)
```

More habits that keep data useful:

- **Prefer a standard event** (below) over a custom one with the same meaning. Studio's levels, deaths and funnel pages
  read them without setup.
- **Name it `thing_happened`**: `tutorial_complete`, `item_equip`, `shop_open`.
- **Fields are camelCase or snake_case, one style per game**, `^[A-Za-z_][A-Za-z0-9_]{0,39}$`, at most 30 per event.
  Strings up to 300 characters, no emails or names.
- **Don't build names from data** (`level_3_start`). A product keeps at most 50 distinct custom names; past that, new
  ones are dropped.
- **Put "where the player is" in the context**, not in every event: `setContext({ level: '3', mode: 'hard' })` is copied
  onto every event.

## Recommended events

The first 12 are standard events: each has a method on the SDK and Studio reads them without setup. `?` is optional.

| Event | Send it when | Fields | SDK call |
|---|---|---|---|
| `game_ready` | The player can play (title screen interactive) | `ms` (since load started) | `ready()` |
| `run_start` | A run, match or campaign begins | `run?`, `mode?` | `track('run_start', {...})` |
| `run_end` | It ends | `result` (`win`, `lose`, `quit`), `duration` (s), `score?` | `track('run_end', {...})` |
| `level_start` | A level begins (each attempt) | `level`, `attempt` | `levelStart(level)` |
| `level_end` | A level ends | `level`, `result` (`complete`, `death`, `quit`, `restart`), `duration` (s), `deaths`, `score?` | `levelEnd(level, result)` |
| `death` | The player dies | `cause` (`imp`, `fall`, `timer`), `where?` or `x`, `y` | `death(cause)` |
| `progress` | Progress that only grows | `step` (number), `of?`, `label?` | `track('progress', {...})` |
| `checkpoint` | A checkpoint is reached | `step`, `label?` | `track('checkpoint', {...})` |
| `choice` | A dialogue or branch choice | `node`, `option` | `choice(node, option)` |
| `feature` | A feature is used | `name`, `value?` | `feature(name)` |
| `video` | A cutscene or video | `action` (`play`, `complete`, `skip`), `id`, `at` (s) | `video(id, action, at)` |
| `feedback` | The player rates or comments | `rating` (`up`/`down` or 1 to 5), `text?`, `context?` | `feedback({...})` |

Custom events worth having (these are not standard: Studio lists them under custom events and you can chart them in a
funnel by name):

| Event | Send it when | Fields |
|---|---|---|
| `purchase` | Real money or premium currency is spent | `item`, `price`, `currency` (`usd`, `gems`), `source?` (`shop`, `offer`) |
| `shop_open` | The shop opens | `from?` (where the player came from) |
| `item_equip` | The player equips or uses an item | `item`, `slot?` |
| `tutorial_step` | A tutorial step is finished | `step` (number), `label?` |
| `tutorial_skip` | The player skips the tutorial | `step` (where) |
| `boss_defeated` | A boss goes down | `boss`, `attempt`, `duration` (s) |
| `achievement_unlock` | An achievement unlocks | `id` |
| `save_load` | The player loads a save | `slot`, `ageDays?` |

## Examples

```js
const a = window.hawkesAnalytics;

a.ready();
a.levelStart(3);                                   // level_start { level: "3", attempt: 1 }
a.death('imp', { where: 'bridge' });               // death { cause: "imp", where: "bridge" }
a.levelEnd(3, 'complete', { score: 1200 });        // level_end { level: "3", result, duration, deaths, score }
a.track('purchase', { item: 'boots', price: 1.99, currency: 'usd' });
a.track('Boss Defeated');                          // skipped, warns once: use "boss_defeated"
```

Unity: `HawkesAnalytics.Track("purchase", "{\"item\":\"boots\",\"price\":1.99,\"currency\":\"usd\"}");` (the same rules).
