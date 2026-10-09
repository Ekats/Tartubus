# Tartubus: Remaining Work

- **Status as of 2026-09-26:** the critical fixes are in [PR #2](https://github.com/Ekats/Tartubus/pull/2) (branch `claude/quirky-curie-tvlihl`): items 0.1, 1, 2, 3, 5, 6, 7 and 8 of `IMPLEMENTATION_PLAN.md`. **This file lists everything that is still open**, so it can be handed to an implementing agent on its own.
- **Update 2026-09-27:** items 0.2, 4, 9, 10, 11, 12, 13 and 14 are done (crossed out below), together with the hardcoded Near Me strings and the untranslated "permission denied" message.
- `IMPLEMENTATION_PLAN.md` keeps the full history (evidence and reasons for the done items). Item numbers here match it.

---

## Brief for the implementing agent

### Precedence

1. The task prompt you were given overrides this file.
2. The "Decisions" section is binding unless the task prompt overrides it. Don't stop to ask about those points.
3. If the code contradicts this file (already fixed, or moved), trust the code: adapt or skip the item and say so in your report.

### Finding code

`path:line` references are from commit `888a7f7` and have drifted, especially in `StopFinder.jsx`, `NearMe.jsx` and `digitransit.js`, which PR #2 changed. **Search for symbols**, using the line only as a hint:

| Item | Search for |
|------|-----------|
| 4 | `const saveFavorites` in `useFavorites.js`; `toggleFavorite(stop)` in `StopCard.jsx` and `StopFinder.jsx` |
| 9 | `'i18nextLng'` (2 places); `const FULL_CLEAR_VERSION` in `digitransit.js` |
| 10 | `location_modal_seen`; `useGeolocation()` in `Favorites.jsx`; `startWatching()` in `StopFinder.jsx` |
| 11 | ``const cacheKey = `stops_`` and `getStaleCache(` in `digitransit.js` |
| 12 | `arrivalTime.setHours(0, 0, 0, 0)` in `timeFormatter.js` and `CountdownTimer.jsx` |
| 13 | `const allRoutes = new Set()` and `const handleRefresh` in `StopFinder.jsx` |
| 14 | the keys in the item 14 table |

### Order and dependencies

Suggested order: **~~0.2~~ → ~~4~~ → ~~9~~ → ~~10~~ → ~~11~~ → ~~12~~ → ~~13~~ → ~~14~~ → backlog.** Skip F3–F5 unless the task prompt gives the owner's decision.

| Item | Needs | Why |
|------|-------|-----|
| 10 | 9 | Item 10 adds a key to the `STORAGE_KEYS` module that item 9 creates |
| 12 | 11 | Both change the compressed cache format; item 12 adds `serviceDay` to the `expandCachedStops()` that item 11 creates |
| 12 (cache bump) | 9 | Bumping `SOFT_CLEAR_VERSION` is only safe once item 9 makes the soft clear delete cache prefixes only |
| 11, 13, B12 | — | Reuse `src/utils/geo.js` (`CITY_ZONES`, `haversineDistance`, `isRouteInZone`), which already exists |

### Working rules

- **Start from the latest `master`** once PR #2 is merged; if it isn't merged yet, branch from `claude/quirky-curie-tvlihl`.
- **One commit per numbered item,** e.g. `fix(#4): share one favorites store between hook instances`.
- **After each commit** run `npm test` and `npm run build:skip-routes` (and `npm run lint:i18n` once item 0.2 adds it). Use `build:skip-routes`, **not** `npm run build`: its `prebuild` hook runs `fetchRoutes.js`, which needs an API key and rewrites the routes data file.
- **Add unit tests** for every item whose change is in a pure function or hook (4, 9, 10, 11, 12 at least). Tests live in `src/**/__tests__/` and `scripts/__tests__/`; `vitest` and `happy-dom` are installed. For a hook test without extra libraries, see `src/hooks/__tests__/useNearbyStops.test.jsx`. Where possible, show that a new test fails on the old code.
- **Dependencies:** use `npm install` (not `npm ci`) when adding one, and commit `package.json` and `package-lock.json` together. Don't add runtime dependencies.
- **Keep changes minimal** and match the surrounding style (functional React with hooks, plain JavaScript, Tailwind, `t()` with keys in all four locales). Don't reformat files or remove existing `console.log` calls.

### Don't

- Don't open, `cat` or diff `public/data/routes.min.json` whole (up to 86 MiB). Read specific fields with `node` or `python`.
- Don't edit `routes.min.json` or `stops.json` by hand, and don't run `npm run fetch-routes` or `npm run build`.
- Don't commit `public/data/routes.json`, `dist/`, `electron-app/`, `release/`, `node_modules/` or `.env`.
- Don't rewrite git history, force-push, push to `master`, push `v*` tags, create releases, or open/merge PRs unless the task prompt says so.
- Don't change the public shape of `useFavorites`, `useGeolocation` or `useNearbyStops` beyond what an item states.

### Environment facts

- Node 22 in CI; newer locally is fine. Run `npm install` first in a fresh clone.
- There's probably **no Digitransit API key** where you run; live API calls return 401. Use mocked `fetch`. For a real-browser check, run `npx vite preview` and Playwright with `page.route()` on `**/routing/v2/finland/gtfs/v1` to fake responses, and `page.clock` for timers.
- GitHub Actions can't be run locally. Lint workflows with `actionlint` and say in the report that they're unverified until CI runs them.

### What to report when done

For every item: done, adapted (how) or skipped (why); tests added; checks passed; checks that couldn't be run. Also list the drafted translation strings from item 14 for native review.

---

## A. Follow-ups from PR #2

These came out of the work on the critical fixes. **F1–F2 need someone with GitHub access; F3–F5 need a decision from the owner before anyone implements them.**

| # | What | Why it matters | Next step | Who |
|---|------|----------------|-----------|-----|
| F1 (reworked 2026-10-01, needs a CI run + secrets) | The release build passes locally exactly as CI runs it (JDK 21, Gradle 8.11.1, platform 35), so the old failure couldn't be reproduced. The job is now the reusable `.github/workflows/android.yml`: debug APK on pull requests, signed APK + AAB and a Play internal-track upload on `v*` tags; signing and version come from environment variables in `android/app/build.gradle`. Setup steps are in `ANDROID_BUILD.md`. Original: **Android release job still fails**; cause unknown | The APK is the only release format still not fixed. The logs of the failed runs have expired | Run `Build Multi-Platform Releases` via `workflow_dispatch` (or push a test tag), read the `build-android-apk` log, fix from it. Likely suspects: `assembleRelease` without signing config, or a Capacitor 7 / Java 21 / Android Gradle Plugin mismatch | Owner, or an agent with Actions access |
| F2 | **Verify the pipeline after merging PR #2** | The workflow changes (#6–#8) could only be linted and dry-run locally | After the merge: (1) `Deploy to GitHub Pages` runs and the site loads; (2) the next nightly `Update Route Data` commits a ~34 MiB `routes.min.json` and starts a deploy; (3) the following night creates **no** commit; (4) a `v*` tag produces a **draft** release; download the Windows/Linux/macOS builds and check that departures load (proves the API key is inside) | Owner |
| ~~F3~~ ✅ | **Done 2026-09-28 (owner chose 1 minute):** `STOPS_CACHE_DURATION` is now 1 minute, so the 30 s refresh gets fresh delays about once a minute. Original: **Near Me live delays update only every ~2 minutes** | The 30 s refresh goes through the 2-minute `stops_*` cache (existing behaviour, kept as is) | Decide: keep (fewer API calls) or pass `forceRefresh = true` in the Near Me interval so delays update every 30 s (4× the API requests per open screen) | Owner decides |
| ~~F4~~ ✅ | **Done 2026-09-28 (owner: yes):** App holds the map's current zone (`mapZone`, Tartu by default); `StopFinder` reports zone changes via `onZoneChange`, and `Header` searches with `searchRouteByNumber(number, routeSearchZone)`. Picking a route from the current zone doesn't move the map to another zone, so the filter isn't reset. Original: **Header route search always uses the Tartu zone** | The header doesn't know which zone the map shows, so a Tallinn user searching `4` gets Tartu's route 4; and picking it while the map is in Tallinn moves the map to Tartu, and the zone change clears the filter again | Lift the current city zone from `StopFinder` into `App` state, pass it to `Header` → `searchRouteByNumber(number, zone)`; in `StopFinder`, don't reset `selectedRoutes` on a zone change caused by a route pick | Owner decides whether Tallinn matters |
| F5 | **Deferred by the owner (2026-09-28).** **macOS desktop build is x64 only** | Apple silicon Macs run it through Rosetta | Optional: add `--arch=arm64` (or `universal`) to the macOS packaging step | Owner decides |

---

## B. Open items from the plan

### Phase 0

### ~~0.2 Add a locale consistency check~~ ✅

- **Status: done.** `scripts/checkLocales.js`, `npm run lint:i18n`, and a "Check translations" step in `deploy.yml` before the build.

- **Problem:** 12 translation keys used in code exist in none of the 4 locale files (item 14). Nothing catches this.
- **Why it matters:** it's the cheapest way to stop raw key names like `settings.clearRoutesConfirm` from reaching users again.
- **Change:**
  - Add `scripts/checkLocales.js`. It collects every `t('…')` key in `src/**/*.{js,jsx}`, flattens each `src/locales/*.json`, and exits non-zero on a missing key or a key present in some locales but not others.
  - Add a `"lint:i18n"` script and run it in `deploy.yml` before `npm run build`.
- **Size:** S.

### 0.3 Manual smoke-test checklist

Add it to `COMMANDS.md` or the PR template, and run it for every PR:

- Near Me loads, and departures change after 30 s without touching anything.
- Tap a stop more than 500 m away on the map; "How to get here" lists itineraries.
- Type `4` in search; route results appear; picking one draws it on the map.
- Star a stop in the map overlay, then star another from the header; both survive a reload.
- Decline location; relaunch; no permission prompt appears.
- Set a custom time for tomorrow morning; departures are listed and are not counted down as today.

### Phase 1

### ~~4. Favorites can be silently deleted~~ ✅

- **Status: done.** One module-level favorites store inside `useFavorites.js`, read through `useSyncExternalStore`; the hook's API is unchanged. Also syncs across tabs via the `storage` event, refuses address search results, and hides the star for them in `StopCard`. Tests in `src/hooks/__tests__/useFavorites.test.jsx` (all three fail on the old hook).

- **Evidence:**
  - `useFavorites` (`src/hooks/useFavorites.js`) keeps a separate `useState` copy per hook instance. It loads that copy once on mount and writes the **whole local copy** back on every change (`saveFavorites`, line 27).
  - `StopFinder` (line 330) and the `StopCard` in its overlay (`StopCard.jsx:21`) are live at the same time.
  - Starring stop X in the card and then stop Y from the header makes StopFinder save its old list plus Y, which deletes X.
- **Why it matters:** favorites are the only data that users build up themselves. Losing them silently is the worst kind of bug for trust, and users can't tell why it happened.
- **Change:**
  1. Turn favorites into a **single module-level store**, `src/stores/favoritesStore.js`. It holds one in-memory array, `getSnapshot()`, `subscribe()`, and `add`/`remove`/`toggle`/`clear`, which always read the current array and write it through to localStorage.
  2. Rewrite `useFavorites` on top of React 18's `useSyncExternalStore(subscribe, getSnapshot)`. Keep its public API (`favorites`, `addFavorite`, `removeFavorite`, `isFavorite`, `toggleFavorite`, `clearAllFavorites`) so no call sites change.
  3. Listen for the `storage` event so two open tabs stay in sync.
  4. Refuse to favorite pseudo-stops: `toggleFavorite`/`addFavorite` should ignore `stop.isSearchResult` or any `gtfsId` starting with `search:`. Also hide the star for search results in `StopCard` (line 109) and `StopFinder` (line 1855). This fixes the backlog item "bogus `search:lat:lon` favorites".
- **Check:** smoke test step 4. Add a unit test in which two hook instances add different stops in sequence and both remain.
- **Size:** S–M.

### Phase 3: Storage and location consent

### ~~9. Settings, language and route downloads are wiped by cache clears~~ ✅

- **Status: done, simpler than planned.** The only disposable localStorage entries are the `stops_*` and `route_*` caches (the walking-route cache is in memory), so instead of a `STORAGE_KEYS` module and keep-lists there is one `clearCachedData()` in `digitransit.js` that deletes just those prefixes. It is used by the startup cleanup, the soft-clear migration and Settings → Soft Clear. `FULL_CLEAR_VERSION` is `'never'` (D3), and the full-clear branch now also sets the soft-clear flag. The `i18nextLng` → `language` migration was skipped: the app never used i18next's language detector, so it never wrote `i18nextLng`. Also stops the app wiping other GitHub Pages sites' data on the shared `ekats.github.io` origin. Settings → Full Clear still calls `localStorage.clear()` on purpose. Tests: `src/services/__tests__/initializeCaches.test.js`.

- **Evidence:**
  - **Two hand-copied keep-lists** (`initializeCaches` in `digitransit.js`, and `handleSoftClearCache` in `Settings.jsx`) keep `i18nextLng`, but the app stores the language under **`language`** (`src/i18n.js:10, 41`). A third copy in `src/main.jsx` was removed in PR #2, because the service worker no longer triggers a storage wipe.
  - None of the lists keeps `routes_metadata`, `install_prompt_dismissed`, `android_app_prompt_dismissed`, and neither keeps `location_modal_seen`.
  - On first launch, the full-clear branch (`digitransit.js:926-940`) records `cache_full_clear_version` but **never** `cache_soft_clear_version`, so every new install runs a soft clear on its second launch.
  - Every localStorage key the app actually uses: `tartu_bus_favorites`, `tartu-bus-settings`, `darkMode`, `language`, `location_modal_seen`, `install_prompt_dismissed`, `android_app_prompt_dismissed`, `routes_metadata`, plus the version/hash keys and `stops_*`/`route_*` cache entries.
- **Why it matters:**
  - Every new user loses their language choice, location choice and dismissed prompts on the second launch, which looks like the app "forgot" them.
  - Losing `routes_metadata` also leaves an orphaned copy of up to 86 MiB in IndexedDB, while Settings claims the routes are "Bundled".
  - Lists that must stay in sync by hand guarantee that this happens again.
- **Change:**
  1. Create `src/utils/storage.js` exporting:
     - `STORAGE_KEYS`: one constant per key above. Use it everywhere instead of string literals.
     - `PRESERVED_KEYS`: every user-preference key above, excluding only the `stops_*`/`route_*` caches.
     - `softClearLocalStorage()`: preserve, clear, then restore.
  2. Replace the two inline copies with `softClearLocalStorage()`.
  3. **Invert the logic** so it can't drift again: instead of "clear everything except the keep list", **delete only known cache prefixes** (`stops_`, `route_`). New preference keys are then safe by default. `initializeCaches` already does exactly this at lines 979-990; the soft clear can become that same loop.
  4. In the full-clear branch, also set `SOFT_CLEAR_KEY`.
  5. Decide whether `FULL_CLEAR_VERSION` should still exist. It deletes favorites and has no purpose on a new install. Decided: set it to `'never'` (D3). The code already supports that value (line 929).
  6. One-time migration: if `i18nextLng` exists and `language` doesn't, copy it across.
- **Check:** a unit test that seeds every key, runs `softClearLocalStorage()`, and asserts that only `stops_*`/`route_*` are gone. Manually: fresh install → pick Estonian → relaunch twice → still Estonian.
- **Size:** S.

### ~~10. Declining location is not respected, and Favorites uses fake coordinates~~ ✅

- **Status: done.** The dialog's answer is stored as `location_consent` (`granted`/`declined`; helpers in `useGeolocation.js`). Only `App.jsx` starts GPS automatically, and only with consent granted and no manual location; explicit actions (Allow, "Use GPS", "Find nearby", the map's tracking button) count as consent. Near Me, the map and Favorites no longer start GPS themselves; the map also stopped switching GPS off for everyone when it unmounts. Favorites uses the shared GPS (fixes B11). Near Me, the map and Favorites ignore the default city-centre coordinates until a real fix or a manual location exists. Existing users are moved over from the browser's permission state (granted → granted, denied → declined, otherwise the dialog once more). A separate "Use my location" button (step 5) was not added: the existing "Use GPS" / "Find nearby" buttons already reverse a decline. Tests: 5 consent tests in `src/components/__tests__/NearMe.test.jsx` (all fail on the old code); also checked in Chromium against `vite preview` (decline → no geolocation calls across all tabs and a reload; allow → GPS keeps running after leaving the map).

- **Evidence:**
  - "Use Manual Location" (`NearMe.jsx:113`) sets the same `location_modal_seen = 'true'` as the Accept handler just above it.
  - `App.jsx:41-47` and `NearMe.jsx:55-70` treat that flag as permission and start GPS.
  - `StopFinder` starts GPS on mount without any check (lines 596-599 and 617-623).
  - `Favorites` creates its **own** `useGeolocation()` (line 12) instead of using the shared `geolocationHook` from `App`, and calls `startWatching()` on mount (lines 25-27).
  - `useGeolocation` starts at the hard-coded Tartu centre (58.3776, 26.7290), and Favorites computes distances, sort order and walking times from that point until a fix arrives. If location is denied, a fix never arrives.
- **Why it matters:**
  - **Consent:** the app claims to have a "use manual location" option and then asks for, or silently uses, GPS anyway. That's a trust problem, and under EU (GDPR/ePrivacy) expectations location access should follow the user's explicit choice.
  - **Correctness:** "300 m away" labels computed from a fake point are wrong for everyone not standing in Raekoja plats.
  - **Battery:** two watchers can be active at once (App's shared one and Favorites' own).
- **Change:**
  1. Add `STORAGE_KEYS.locationConsent` with the values `'granted' | 'declined'`, saved by the Accept/Decline handlers. Keep `location_modal_seen` only as "we've shown it".
  2. **One owner for GPS:** only `App` starts and stops the shared `geolocationHook`, and only when `locationConsent === 'granted'` and no manual location is set. Remove the `getLocation`/`startWatching` calls from `StopFinder` (596-599, 617-623) and from `Favorites` (25-27).
  3. Pass `geolocationHook` to `Favorites` (as `NearMe` and `StopFinder` already get it) and delete its private `useGeolocation()`.
  4. Everywhere a distance is shown or used for sorting, require `location.hasRealFix || manualLocation`. The hook already exposes `hasRealFix`. Without one, show no distance, sort favorites by the order they were added, and skip walking-time requests.
  5. Offer a visible "Use my location" button that sets consent to `granted`, so declining is reversible.
  6. **Migration for existing users** (`location_modal_seen` present, no consent key): read `navigator.permissions.query({name:'geolocation'})`. `granted` → set consent to `granted`; `denied` → `declined`; `prompt` → show the modal once more. On Capacitor, where the Permissions API may be missing, show the modal once.
- **Check:** smoke test step 5. Also: in Favorites with location denied, no distances are shown; with location allowed, the distances match the map.
- **Size:** M.

### Phase 4: Data correctness

### ~~11. The nearby-stops cache returns data for the wrong time and place~~ ✅

- **Status: done.** One `nearbyStopsCacheKey()` (3 decimals, ~110 m × ~60 m) replaces three copies of the key. Planned-time queries never read or write the cache and get their own in-flight slot (`requestKey` includes the minute). `expandCachedStops()` rebuilds `trip.route` and recomputes `distance` from the caller's point, and is used for both the fresh-cache path and the offline stale fallback. **For item 12:** add `serviceDay` to `expandCachedStops()` and to the compressed format in `getNearbyStops`. Tests: `src/services/__tests__/getNearbyStops.test.js` (all four fail on the old code).

- **Evidence:**
  - `getNearbyStops` (`digitransit.js:73-75`, with helpers at 1170-1188) keys its cache, **and** its in-flight request sharing, on coordinates rounded to 0.01° (a cell of about 1.1 km × 0.6 km at 58° N) plus radius, and leaves out `customTime`.
  - The cached payload holds departures for one exact time and `distance` values measured from one exact point.
  - The stale-cache fallback (`digitransit.js:269-275`) returns the **compressed** format without rebuilding `trip.route`.
- **Why it matters:** it shows wrong answers confidently:
  - Switching between "now" and a custom time within 2 minutes returns the other one's departures.
  - Moving the manual location by 300 m shows the old point's stops and distances.
  - Refreshing while offline puts `?` on every route badge. That's exactly when the fallback is meant to help.
- **Change:**
  1. Put the time into the key: `timeKey = customTime ? 't' + Math.floor(customTime / 60000) : 'now'`. Simpler still, **don't cache or share requests at all when `customTime` is set**; planned-time queries are rare and short-lived.
  2. Round to 3 decimals (about 110 m × 60 m) instead of 2. Also store the exact query point with the entry, and on a cache hit **recompute `distance`** from the caller's `lat/lon` (haversine from `src/utils/geo.js`), so distances are always right even inside a cell.
  3. Use the same key for in-flight sharing, so a request for another time or point never piggybacks on the wrong one.
  4. Extract the "compressed → full" rebuild (lines 80-104) into `expandCachedStops()` and use it on **both** the fresh-cache and stale-fallback paths.
- **Check:** unit tests for the key function (different `customTime` → different key; 300 m apart → different key) and for `expandCachedStops` (route short name survives the round trip). Manually: go offline and refresh; badges keep their route numbers.
- **Size:** S–M.

### ~~12. Departures are compared with the real clock, not the chosen time, and the service day is guessed~~ ✅

- **Status: done.** `serviceDay` is requested in all four stoptime queries and kept in the nearby-stops cache. New `getArrivalDate()` in `timeFormatter.js` gives the exact arrival time from `serviceDay` (falling back to the old guess, now relative to the reference time, when it's missing); `shouldShowDeparture`, `isDepartureLate` and `formatArrivalTime` take an optional `referenceTime` (null = now), and the two client-side filters in `digitransit.js` use `shouldShowDeparture`. Near Me, Favorites, the map's nearby-stops list and `StopCard` (new `customTime` prop) pass the chosen time; the map's routing and selected-stop fetches now request it too. With a chosen time, `CountdownTimer` shows the clock time and "+N min" and doesn't tick (D2). Clock times are formatted in `Europe/Tallinn`. Not changed: the dead `{false && <Popup>}` block in `StopFinder.jsx`; a map stop that already has departures isn't refetched when the time changes. Tests: `src/utils/__tests__/timeFormatter.test.js` (also pass with `TZ=America/New_York`) and `src/components/__tests__/CountdownTimer.test.jsx`.

- **Evidence:**
  - `shouldShowDeparture`, `isDepartureLate` and `formatArrivalTime` (`src/utils/timeFormatter.js:20-143`), `CountdownTimer.jsx`, and the client-side filter in `getNearbyStops` (`digitransit.js:170-188`) all build "today at N seconds after midnight" and compare it with `new Date()`.
  - They then use a "more than 12 h in the past means it's tomorrow" guess.
  - None of them receives `customTime`, and all of them assume the device is on Tallinn time.
- **Why it matters:**
  - Picking tomorrow at 08:00 hides tomorrow's departures as "430 minutes ago", so the stops look empty.
  - Picking tomorrow at 16:00 counts tomorrow's buses down as if they were leaving today.
  - An Estonian user travelling with a device on another time zone gets every countdown shifted by hours.
- **Change (the robust fix):**
  1. Add **`serviceDay`** to the `stoptimesWithoutPatterns` selection in the nearby-stops query, and to every other stoptime query (favorites, timetable). In the Digitransit/OTP schema, `Stoptime.serviceDay` is the Unix timestamp of the trip's service date at local midnight. The absolute departure time is then simply `(serviceDay + (realtime ? realtimeArrival : scheduledArrival)) * 1000`. It's exact, independent of the device's time zone, and correct across midnight. That removes the 12-hour heuristic everywhere.
  2. Keep `serviceDay` in the compressed cache format (item 11) and in `expandCachedStops`.
  3. Add a `referenceTime` parameter (default `new Date()`) to `shouldShowDeparture`, `isDepartureLate` and `formatArrivalTime`, and pass `customTime ?? new Date()` from `NearMe`, `Favorites`, `StopCard` and `CountdownTimer`.
  4. **Behaviour in planned-time mode** (resolved in "Decisions", D2): a live countdown ("50 min") makes no sense for a planned time. Recommendation: when `customTime` is set, show clock times ("08:12") and minutes *relative to the chosen time* ("+12 min"), and don't run the 1-second countdown timer.
  5. Format clock times in `Europe/Tallinn` explicitly with `Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit' })`, so they match stop displays whatever the device's time zone.
- **Check:** unit tests with a fixed `serviceDay`, `referenceTime` values on the same day, the next day and across midnight, plus a non-Tallinn `TZ` (run vitest with `TZ=America/New_York`). Manually: smoke test step 6.
- **Size:** M. The query change touches several call sites, which is why it's grouped with item 11.

### ~~13. "Filter routes" on the map is empty~~ ✅

- **Status: done (step 1).** New `getRouteShortNamesInZone(zone)` in `digitransit.js` lists the route numbers serving a city zone from the bundled route data (memoized per zone and route-data version). The map loads it when the filter panel opens (lazily, the route file is large) and merges it with route numbers seen in loaded departures, so the list is complete before any departures arrive and survives pans and zooms. **Step 2 not done:** the unused `handleRefresh` in `StopFinder.jsx` was left as it is (dead code is flagged, not deleted, per the owner's rules); wiring it to a button would be a new feature. Tests: `src/services/__tests__/getRouteShortNamesInZone.test.js`; also checked in Chromium with the departures API blocked (the filter lists Tartu's routes 4, 7 and 12, not Tallinn's).

- **Evidence:**
  - The filter list (`StopFinder.jsx:1202-1221`) is built from departures stored on `stops`.
  - Map stops now come from `stops.json` with `stoptimesWithoutPatterns: []` (line 577), and every pan or zoom replaces them with viewport-filtered, departure-less copies (line 1082).
  - Only the 30-second auto-refresh (line 932) adds departures back.
  - `handleRefresh` (line 1032) isn't connected to any button.
- **Why it matters:** the filter button opens an empty list for the first 30 s and again after every pan. It looks broken, and there's no refresh button to recover.
- **Change:**
  1. Build the list from the **bundled route data** for the current city zone instead of from live departures. Add `getRouteShortNamesInZone(cityBounds)` to `digitransit.js`, reusing the zone filter from `getStopsByRoutes` (lines 1222-1234), and memoize it per zone. It's static data, so it's always complete and available offline. Filtering stops already works through `stopToPatterns` (lines 1223-1251), which comes from the same route patterns, so the departures fallback there isn't needed for correctness.
  2. Either connect `handleRefresh` to a visible refresh button on the map or delete it (and the unused `nearbyRadius` variable inside it). Dead handlers hide bugs.
- **Check:** open the map and tap "Filter routes" at once; the list is full; pan and zoom; it stays full.
- **Size:** S.

### ~~14. Raw translation keys appear on screen~~ ✅

- **Status: done.** All 12 keys added in all four locales, and the dead `|| 'fallback'` text removed for them. Also added `nearMe.unableToFindStops` and `nearMe.findNextBuses` for strings that were hardcoded English, and Near Me now shows the translated `nearMe.locationDenied` instead of the browser's own "permission denied" text (`useGeolocation` exposes `errorCode`). **The Estonian, Russian and Ukrainian texts were drafted by the agent and need a native speaker's check**: the 14 new keys in `src/locales/{et,ru,uk}.json`. Other `t('…') || 'fallback'` uses in `Settings.jsx` whose keys already existed were left as they are.

- **Evidence:** these 12 keys are used in code and exist in none of `en/et/ru/uk.json`:

  | Key | Used at |
  |-----|---------|
  | `favorites.addToFavorites` | `StopCard.jsx:115` |
  | `nearMe.viewTimetable` | `StopCard.jsx:124` |
  | `nearMe.showOnMap` | `StopCard.jsx:135` |
  | `nearMe.dailyTimetable` | `StopCard.jsx:285` |
  | `nearMe.noTimetableData` | `StopCard.jsx:318` |
  | `settings.clearRoutesConfirm` | `Settings.jsx:118` |
  | `settings.downloaded` | `Settings.jsx:323` |
  | `settings.lastUpdated` | `Settings.jsx:328` |
  | `settings.routes` | `Settings.jsx:336` |
  | `settings.updating` | `Settings.jsx:354` |
  | `settings.revertToBundled` | `Settings.jsx:370` |
  | `settings.updateFailed` | `Settings.jsx:377` |

  i18next returns the key itself when a key is missing, which is truthy, so every `t(key) || 'fallback'` in the code **never** falls back.
- **Why it matters:** visible gibberish ("Stop 1234 • nearMe.dailyTimetable"), including inside a confirmation dialog the user has to understand before deleting data.
- **Change:**
  1. Add all 12 keys to all four locale files. English can be taken from the existing inline fallbacks. Draft the Estonian, Russian and Ukrainian texts yourself, matching the tone of nearby keys in each file, and list every drafted string in your report so a native speaker can check it.
  2. Remove the `|| 'fallback'` pattern (or switch to `t(key, { defaultValue })` where a fallback is really wanted), because the current pattern is dead code that gives false confidence.
  3. The Phase 0.2 check keeps this from recurring.
- **Size:** S.

---

## C. Backlog (confirmed, lower priority)

Independent; pick up in any order.

| # | Problem | Where | Why fix | Change | Size |
|---|---------|-------|---------|--------|------|
| B1 | **Map redraws every second.** A hidden `timeAgo` state updates every second, re-rendering the map and re-creating every marker's icon and position | `StopFinder.jsx:1279-1305` | Biggest performance cost left: constant marker churn drains battery and makes panning stutter on mid-range phones | Delete `timeAgo` if it's unused, or move it into a small child component that owns the interval. Memoize marker icons (`useMemo` keyed by stop id + favorite + selected) | S |
| B3 | Map refresh makes an uncached request covering a radius of 2 km or more every 30 s, and the result is thrown away on the next pan | `StopFinder.jsx:923-936` | API quota and mobile data use | Refresh departures only for stops in the viewport, which the map now shows from `stops.json`. Batch by stop id instead of radius. Pause while hidden | M |
| B4 | Favorites refetch every favorite's departures on each GPS move of 10 m or more | `Favorites.jsx:190` | Unneeded API load while walking: departures don't depend on where the user is | Remove `location.lat/lon` from the departures effect's dependencies. Only distances and walking times depend on location | S |
| B5 | Walking times in Near Me are computed for the old list after a move of more than 100 m | `NearMe.jsx` walking-time effect | Wrong walking minutes shown | Include the stops' identity in the effect key and cancel stale batches with a sequence ref | S |
| B6 | Search results can arrive out of order | `Header.jsx:38-60`, `useNearbyStops` | A slow older response can overwrite a newer one | Add a sequence counter or `AbortController` per request | S |
| B7 | The time picker's ±15/30 min buttons wrap past midnight without changing the date | `DateTimePicker.jsx` | A plan for 23:50 + 15 min lands on today at 00:05 | Use date arithmetic (`addMinutes` from date-fns) on the whole `Date` | S |
| B8 | Dark mode never follows the system theme | `useDarkMode.js` | A value saved on first load disables the system listener forever | Store an explicit override only when the user toggles; otherwise follow `prefers-color-scheme` | S |
| B9 | A storage-full failure leaves the route update spinner running forever | `digitransit.js:714` (`storeRoutesInIndexedDB`) | The user sees "Updating…" permanently | Add `tx.onabort` and `tx.onerror` that reject the promise; show `settings.updateFailed` | S |
| B10 | Favorite stars missing on clustered markers | `StopFinder.jsx` cluster icon | Favorites are detected through a marker `add` event that never fires for markers inside a cluster | Compute favorite state from data in `iconCreateFunction` (`cluster.getAllChildMarkers()` → stop ids) | S |
| B11 | Dev proxy slow-response timer starts when headers arrive | `vite.config.js:43` | Logs only measure the body; dev-only, so cosmetic | Record the start time in `proxyReq` (`req._start = Date.now()`) | XS |
| B12 | About seven copies of the haversine distance function | `StopFinder`, `useGeolocation`, `digitransit.js`, … | Drift risk; the item 2 and item 11 fixes need one shared helper anyway | `src/utils/geo.js` now has `haversineDistance`; replace the remaining copies with it | S |
| B13 | Git history growth | repo | Covered by item 6: once daily no-op commits stop, growth stops. Rewriting existing history isn't recommended (it would break every clone), and it's small in packed form anyway | — | — |

---

## Decisions

Binding unless the task prompt overrides them. (D1 and D4 from the plan are already applied in PR #2.)

- **D2. Display in planned-time mode (item 12, step 4):** when `customTime` is set, show the clock time plus "+N min" measured from the chosen time, and **don't** run the live countdown. With no `customTime`, keep today's behaviour.
- **D3. `FULL_CLEAR_VERSION` (item 9, step 5):** set it to `'never'`. A full wipe deletes favorites, and no pending migration needs it.
- **D5. Translations (item 14):** draft all four languages and list the Estonian, Russian and Ukrainian strings in your report for native review. Don't block on the review.

---

## Risks

| Risk | Where | Mitigation |
|------|-------|------------|
| The new consent logic re-prompts existing users | Item 10 | Migration step 6 maps the existing permission state; the modal shows at most once more |
| The `serviceDay` query change breaks cached data | Items 11–12 | Bump `SOFT_CLEAR_VERSION` in the same change, which after item 9 deletes only `stops_*`/`route_*` caches, so no user data is touched |
| The favorites store refactor changes the hook's API | Item 4 | Keep the exact return shape; covered by a two-instance unit test |

---

## Definition of done

Parts that need CI, a real device or the API key can't be finished by an agent alone; mark those "to verify".

- `npm test` and `npm run lint:i18n` pass locally and in `deploy.yml`.
- All six smoke-test steps in 0.3 pass on the web build **and** the Android build.
- F1 and F2 are closed: every release format builds, and the nightly update deploys real changes only.
- A user who picks a language, declines location and stars favorites keeps all three across relaunches and app updates.
