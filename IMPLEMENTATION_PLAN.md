# Tartubus: Implementation Plan for the Code Review Findings

- **Reviewed commit:** `888a7f7` (`master`, 2026-09-25)
- **Scope:** `src/`, `scripts/`, `.github/workflows/`, `public/service-worker.js`, `vite.config.js`, `index.html`
- **Status:** plan only. No code has been changed.

Every item below lists the problem, the evidence, **why it matters** (the reason for fixing it and for its place in the order), the concrete change, how to check it, and its size. File references use `path:line` at the reviewed commit.

---

## 0. How the work is ordered, and why

The order follows three rules:

1. **Broken core features first.** Journey planning, route search, auto-refresh and favorites are what people open the app for. Each one has a small, local fix.
2. **Then the delivery pipeline.** The service worker serves the old app from cache first, and route data never gets deployed. Until those are fixed, **no fix from Phase 1 reaches existing users**, even after it's merged. Phase 2 must ship before or together with Phase 1 going live, or the Phase 1 work stays invisible.
3. **Then data correctness and trust:** storage wipes, location consent, stale caches and wrong times. These cause wrong or lost data rather than outright failure, and they touch more files, so they go after the pipeline can deliver them.

Suggested PR split, with one commit per numbered item inside each PR:

| PR | Contents | Why grouped this way |
|----|----------|----------------------|
| A | Phase 0 (safety net) + Phase 1 (items 1–4) | Small, high-value fixes, plus the minimal tests that guard them |
| B | Phase 2 (items 5–8) | Service worker and CI changes are risky in their own way and should be reviewed separately from app logic |
| C | Phase 3 (items 9–10) | Storage and consent share one new module |
| D | Phase 4 (items 11–14) | Data-correctness fixes that share the `serviceDay` change |
| E+ | Phase 5 backlog | Independent and optional |

Merge **B before or together with A**, for the reason in rule 2.

---

## Phase 0: Safety net (before any fix)

### 0.1 Add a minimal unit-test setup

- **Problem:** the repo has no tests and no test script (`package.json` has only `dev`, `build`, `fetch-routes` and Android scripts). Every fix below would be checked only by hand.
- **Why it matters:** several fixes change pure functions (time formatting, cache keys, storage keep-lists). Those are cheap to test and easy to regress. The time and cache bugs (items 11–12) went unnoticed precisely because nothing exercises them.
- **Change:**
  - Add `vitest` (devDependency) and a `"test": "vitest run"` script. Vitest reuses `vite.config.js`, so there's no extra config.
  - Add `src/utils/__tests__/timeFormatter.test.js` and `src/services/__tests__/cacheKey.test.js`, and grow them with each fix below.
- **Size:** S.

### 0.2 Add a locale consistency check

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

---

## Phase 1: Broken core features

### 1. Multi-leg journey planning always fails

- **Evidence:** `src/components/StopFinder.jsx:792` reads `customTime?.toISOString()`, but `StopFinder` never destructures `customTime` from its props (`StopFinder.jsx:305-317`). `App.jsx` *does* pass `customTime={customTime}` to `StopFinder`. The `ReferenceError` is thrown synchronously inside `destinationsToTry.map`, caught at line 848, and turned into `setJourneyPlans([])`.
- **Second bug in the same path:** `planJourney` (`src/services/digitransit.js:1386`) computes `dateTime` but never adds it to the GraphQL query or to `variables` (`digitransit.js:1470-1488`). A custom time would be ignored even after the crash is fixed.
- **Why it matters:** "How to get here" is the only way to get routes with transfers. It fails for every stop more than 500 m away and for every address search. That is most real journeys, and it fails silently: the user just sees no options.
- **Change:**
  1. Add `customTime` to the `StopFinder` props destructuring.
  2. Add `customTime` to the journey effect's dependency array (currently `[selectedStop, location.lat, location.lon]`, line 858) and to the `currentParams` comparison, so changing the time re-plans.
  3. In `planJourney`, add `$dateTime: PlanDateTimeInput` to the query signature and pass `dateTime: $dateTime` to `planConnection`. Set `variables.dateTime = { earliestDeparture: dateTime }`, where `dateTime` is an ISO-8601 string with offset. `toISOString()` gives UTC with `Z`, which is valid for `OffsetDateTime`.
  4. Optional clean-up: the sort comparator at lines 834-842 returns `-1`/`1` depending only on `b.isMainStop`, so it isn't symmetric. Make it `(b.isMainStop - a.isMainStop)` inside the "similar duration" branch. An inconsistent comparator gives an engine-dependent order.
- **Check:** smoke test step 2. Then set a custom time 3 h ahead and confirm the first leg's `startTime` is at or after it.
- **Size:** S.

### 2. Route search never returns anything, and the selected route is never drawn

- **Evidence:**
  - `searchRouteByNumber` (`digitransit.js:555`) keeps only routes whose `gtfsId` contains `TARTU`. The same filter is used at `digitransit.js:515`.
  - All 2312 bundled routes use the `Viro:` feed prefix (for example `Viro:254190`); **0 match**.
  - Route `4` alone exists 6 times across Estonia, for example `Ringtee - Kummeli` and `Väike-Õismäe - Tiskre`. Filtering by number without geography would give wrong results.
  - Even with results, `StopFinder` receives `selectedRoute` (line 312) and never reads it. Meanwhile `App.jsx`'s Android back handler spends a press clearing that invisible selection.
- **Why it matters:** the search box advertises route search, and typing a number always shows nothing. The map already has a working route filter (`selectedRoutes` → `getStopsByRoutes` with city bounds, `StopFinder.jsx:1368-1424`), so the fix mostly means connecting existing parts.
- **Change:**
  1. Replace the `TARTU` substring filter with a **geographic** filter, the same one `getStopsByRoutes` already uses (`digitransit.js:1222-1234`): keep a route if any pattern stop lies within the active city zone (Tartu: centre 58.3776, 26.7290, radius 8 km). Move `CITY_ZONES` and the haversine helper out of `StopFinder.jsx:418-470` into `src/utils/geo.js` so the service and the component share one definition. This also starts on the "about seven copies of the distance function" clean-up.
  2. Better still, make `searchRouteByNumber` search the **bundled** routes (`loadRoutesFromBundle()`/`allRoutesCache`) instead of calling the API. The data is already in memory after first use, the lookup is instant and works offline, and it drops one API call per keystroke pause.
  3. Apply the same fix to the function containing the `TARTU` filter at line 515, or delete it if nothing calls it. Check with `grep`.
  4. In `StopFinder`, add an effect on `selectedRoute`. When it's set, call `setSelectedRoutes(new Set([selectedRoute.routeNumber]))` and fit the map to the route's pattern bounds. When the user clears the filter, call `onRouteChange(null)` so App state and map state agree and the back button no longer consumes a press for nothing.
- **Check:** smoke test step 3. Also add a unit test that `searchRouteByNumber('4')` against a fixture returns only routes with stops inside the Tartu zone.
- **Size:** M.

### 3. Near Me stops auto-refreshing after the first redraw

- **Evidence:**
  - `useNearbyStops` (`src/hooks/useNearbyStops.js:12`) creates a new `fetchNearbyStops` function on every render.
  - The interval effect in `NearMe.jsx:326-353` lists `fetchNearbyStops` as a dependency, so every render runs its cleanup (`clearInterval`).
  - The re-run then returns early at line 339, because the location hasn't changed by more than about 100 m. The interval is never recreated.
  - The interval callback also captures `customTime` from the first render, so it would refresh with a stale time.
- **Why it matters:** the headline promise of Near Me is live departures. A user standing at a stop, which is the main use case, gets a list that never updates; buses only disappear from it.
- **Change:**
  1. In `useNearbyStops`, wrap `fetchNearbyStops` in `useCallback` with `[]` dependencies. It reads `stops.length` in the error branch (line 26), so keep a `stopsRef` for that instead of closing over state. Add a request-sequence ref so a slower, older response can't overwrite a newer one (a backlog item).
  2. In `NearMe`, keep the latest `{lat, lon, customTime}` in a `latestParamsRef` that is updated on every render. Create the interval **once** (effect with `[]` dependencies, cleared on unmount); it reads the ref on every tick. That removes the fragile "restart only when moved more than 100 m" logic entirely.
  3. Pause the interval while `document.visibilityState === 'hidden'` and refresh immediately when the page becomes visible again. This saves battery and API quota on phones.
- **Check:** open Near Me, leave the device still, and watch the Network tab. There should be a request every 30 s, and none while the tab is in the background.
- **Size:** S.

### 4. Favorites can be silently deleted

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

---

## Phase 2: Delivery pipeline (gets fixes to users)

### 5. The service worker keeps serving the old app forever

- **Evidence:**
  - `public/service-worker.js:57` answers **every** same-origin GET cache-first, including `index.html`, the JS bundles and `data/*.json`.
  - The cache only changes when someone hand-edits `CACHE_VERSION` (line 1, currently `'1.5.5'`).
  - `vite.config.js` generates `__BUILD_HASH__` per build, but it's only written to localStorage and never compared with anything.
- **Why it matters:** this is the multiplier on everything else. A returning user keeps the cached `index.html`, which points at the old hashed bundle, so **none of the Phase 1 fixes would reach them**. The same goes for newer `stops.json`/`routes.min.json`.
- **Change:**
  1. **Per-build cache name.** Add a small Vite plugin in `vite.config.js` (a `closeBundle` hook) that replaces a `__BUILD_HASH__` placeholder in `dist/service-worker.js` with the build hash. That makes every deploy a byte-different service worker, which is what triggers a browser update. Set `const CACHE_VERSION = '__BUILD_HASH__'` in the source file.
  2. **Choose a strategy per request type:**
     - Navigations and `index.html`: **network-first**, falling back to cache when offline. This is what makes new deploys visible.
     - `assets/*` (Vite's content-hashed files): **cache-first**. They're immutable, so this is safe and fast.
     - `data/stops.json` (2.4 MB): **stale-while-revalidate**.
     - `data/routes.min.json` (**86 MiB**): stale-while-revalidate with a **conditional request**. Store the `ETag`/`Last-Modified` with the cached response and revalidate with `If-None-Match`; GitHub Pages answers `304` when nothing changed. A plain network-first would re-download 86 MiB on every launch, which would be expensive on mobile data.
  3. **Stop sending `FORCE_RELOAD` on every activation.** With a per-build name, every deploy would otherwise clear localStorage and reload the page in the middle of use. Post `{type: 'UPDATE_READY'}` instead, and in `main.jsx` reload only the next time the page goes from hidden to visible. Migrations of stored data belong in `initializeCaches` (see item 9), not in the service worker.
  4. Keep the previous cache's `assets/*` entries until the *next* activation, so an already-open old page can still lazy-load its own chunks.
- **Check:** build twice and confirm the two `dist/service-worker.js` files differ. Deploy to a test Pages branch or run `vite preview`; load, rebuild, reload once; DevTools → Application shows the new worker and the new bundle hash. Take the site offline and it still opens.
- **Size:** M. It's the riskiest change in the plan, which is why it's a PR of its own.

### 6. Nightly route data never reaches the live site, and a 86 MiB file is committed daily

- **Evidence:**
  - `scripts/fetchRoutes.js:75-76` writes a fresh `lastUpdated`/`version` into `routes.min.json` on every run, so the workflow's `git diff --quiet` check (`update-routes.yml:40`) never reports "unchanged".
  - Commits `48c4280` and `8b61b0e` contain identical route data, yet both were committed.
  - The push uses `GITHUB_TOKEN`. GitHub does not start new workflow runs from events caused by `GITHUB_TOKEN`, except `workflow_dispatch`/`repository_dispatch`, so `deploy.yml` never runs.
  - The last deploy was 2025-11-22, so the site's bundled routes are about 10 months old.
  - Partial mitigation already exists: Settings → "Update routes" downloads the file from `raw.githubusercontent.com/.../master/...` (`digitransit.js:665`). But that's manual, and few users will find it.
- **Why it matters:**
  - Users are planning on data that is 10 months stale.
  - The repo gains an 86 MiB blob every day for nothing.
  - **The file is already at 86 MiB, against GitHub's hard 100 MiB per-file limit.** Once the route data grows by about 14 %, the nightly push will be rejected outright.
- **Change:**
  1. **Make the output deterministic.** In `fetchRoutes.js`, compute a SHA-256 of `JSON.stringify(routes)`, compare it with the `contentHash` stored in the existing `routes.min.json`, and **don't write the file** when it's unchanged. Store `contentHash`, and set `lastUpdated`/`version` only when the content really changes. The existing `git diff --quiet` check then works as intended.
  2. **Stop writing `public/data/routes.json`** (`fetchRoutes.js:93-94`). It's a 210 MB pretty-printed copy that nothing reads, and because it sits in `public/`, every `npm run build` copies it into `dist/`. Also add it to `.gitignore`.
  3. **Trigger a deploy after a real change.** Add `permissions: actions: write` to `update-routes.yml`, and after the push run `gh workflow run deploy.yml --ref master` with `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. The `workflow_dispatch` event is exempt from the `GITHUB_TOKEN` restriction. (A `workflow_run` trigger in `deploy.yml` would also work, but it fires even when nothing changed.)
  4. **Get away from the 100 MiB wall.** This needs a decision from you; see §6. Options:
     - (a) Keep only routes with at least one stop inside the supported city zones (Tartu 8 km, Tallinn 20 km). That's likely a large reduction, since the feed covers all of Estonia.
     - (b) Drop per-pattern stop objects in favour of stop ids that reference `stops.json`.
     - (c) Stop committing the file: publish it as a release asset or Pages artifact built in CI.

     Option (a) is the smallest change and also shrinks what the app downloads.
  5. `scripts/fetchStops.js` doesn't load `.env`, unlike `fetchRoutes.js`. Add `import 'dotenv/config'` so local runs don't get a 401.
- **Check:** run the workflow twice in a row with `workflow_dispatch`. The second run must say unchanged and create no commit. After a real change, a `deploy.yml` run appears in Actions.
- **Size:** S for steps 1–3 and 5; M for step 4.

### 7. Release builds contain no API key

- **Evidence:** none of the five `npm run build:skip-routes` steps in `build-releases.yml` (lines 28, 63, 97, 135, 205) pass `VITE_DIGITRANSIT_API_KEY` or the `VITE_EMAILJS_*` secrets, unlike `deploy.yml`. Vite inlines `import.meta.env.VITE_*` at build time, so the value becomes `undefined`, and `digitransit.js:26` sends `digitransit-subscription-key: undefined`, which is rejected with 401.
- **Why it matters:** every downloadable build (web zip, APK, desktop) is dead on arrival: no stops, no departures, no feedback form.
- **Change:**
  - Add the same four-variable `env:` block to each build step. To avoid repeating it five times, set it once at the job or workflow level:

    ```yaml
    env:
      VITE_DIGITRANSIT_API_KEY: ${{ secrets.VITE_DIGITRANSIT_API_KEY }}
      VITE_EMAILJS_SERVICE_ID: ${{ secrets.VITE_EMAILJS_SERVICE_ID }}
      VITE_EMAILJS_TEMPLATE_ID: ${{ secrets.VITE_EMAILJS_TEMPLATE_ID }}
      VITE_EMAILJS_PUBLIC_KEY: ${{ secrets.VITE_EMAILJS_PUBLIC_KEY }}
    ```

  - Add a guard at the start of each build step, `test -n "$VITE_DIGITRANSIT_API_KEY" || { echo "API key secret missing"; exit 1; }`, so a missing secret fails the job instead of producing a silently broken build.
- **Note:** any `VITE_*` value is public by design, because it ends up in the JS that users download. That's acceptable for a Digitransit subscription key used from a client app, but don't put anything secret behind a `VITE_` prefix.
- **Size:** S.

### 8. Desktop (Electron) release jobs cannot succeed, so no release is ever created

- **Evidence:**
  - The desktop jobs (`build-releases.yml:109`, `176`, `246`) run `electron-packager .` on the repository root.
  - The root `package.json` has no `main` field, so Electron looks for `index.js`, which doesn't exist.
  - The root `package.json` declares `"type": "module"`, so the generated CommonJS `main.js` (`require(...)`) fails to load.
  - The `package-electron.json` the jobs write is never read by anything.
  - All 4 runs of this workflow failed (run `19184355086`: three desktop jobs and the Android job failed), `create-release` was skipped, and the repo has no releases.
- **Why it matters:** the release pipeline has never produced a release. Even the working web build is only available as a short-lived workflow artifact.
- **Change:**
  1. Package from a clean staging directory instead of the repo root:

     ```bash
     mkdir -p electron-app && cp -r dist electron-app/dist
     cat > electron-app/package.json <<'EOF'
     {"name":"tartubus","version":"<from tag>","main":"main.js"}
     EOF
     # write main.js (CommonJS is fine: no "type": "module" here)
     npx electron-packager electron-app Tartubus --platform=... --arch=x64 --out=release
     ```

     Better still, commit `electron/main.cjs` and `electron/package.json` to the repo instead of generating them with `echo`. Generated code in YAML is untestable and was the source of this bug.
  2. Take the version from the tag (`${GITHUB_REF_NAME#v}`) instead of the hard-coded `1.5.0`.
  3. **Android job:** the cause of its failure isn't known, because the logs have expired. Re-run it with `workflow_dispatch` after this PR and read the log. Likely suspects are `assembleRelease` without signing configuration, or a Capacitor 7 / Java 21 / AGP mismatch. Don't guess; fix from the log.
  4. Make `create-release` publish whatever succeeded (`if: always()` plus a per-artifact existence check), so a single broken platform no longer blocks the whole release.
- **Check:** push a `v1.5.6-rc1` tag on a fork or with `workflow_dispatch`; all jobs are green and a draft release has the 5 assets.
- **Size:** M.

---

## Phase 3: Storage and location consent

### 9. Settings, language and route downloads are wiped by cache clears

- **Evidence:**
  - **Three hand-copied keep-lists** (`src/main.jsx:14-23`, `digitransit.js:914-922`, `Settings.jsx:46-54`) all keep `i18nextLng`, but the app stores the language under **`language`** (`src/i18n.js:10, 41`).
  - None of the lists keeps `routes_metadata`, `install_prompt_dismissed`, `android_app_prompt_dismissed`, and two of them don't keep `location_modal_seen`.
  - On first launch, the full-clear branch (`digitransit.js:926-940`) records `cache_full_clear_version` but **never** `cache_soft_clear_version`, so every new install runs a soft clear on its second launch.
  - Every localStorage key the app actually uses: `tartu_bus_favorites`, `tartu-bus-settings`, `darkMode`, `language`, `location_modal_seen`, `install_prompt_dismissed`, `android_app_prompt_dismissed`, `routes_metadata`, plus the version/hash keys and `stops_*`/`route_*` cache entries.
- **Why it matters:**
  - Every new user loses their language choice, location choice and dismissed prompts on the second launch, which looks like the app "forgot" them.
  - Losing `routes_metadata` also leaves an orphaned copy of up to 86 MiB in IndexedDB, while Settings claims the routes are "Bundled".
  - Three lists that must stay in sync by hand guarantee that this happens again.
- **Change:**
  1. Create `src/utils/storage.js` exporting:
     - `STORAGE_KEYS`: one constant per key above. Use it everywhere instead of string literals.
     - `PRESERVED_KEYS`: every user-preference key above, excluding only the `stops_*`/`route_*` caches.
     - `softClearLocalStorage()`: preserve, clear, then restore.
  2. Replace the three inline copies with `softClearLocalStorage()`.
  3. **Invert the logic** so it can't drift again: instead of "clear everything except the keep list", **delete only known cache prefixes** (`stops_`, `route_`). New preference keys are then safe by default. `initializeCaches` already does exactly this at lines 979-990; the soft clear can become that same loop.
  4. In the full-clear branch, also set `SOFT_CLEAR_KEY`.
  5. Decide whether `FULL_CLEAR_VERSION` should still exist. It deletes favorites and has no purpose on a new install. Recommendation: set it to `'never'`. The code already supports that value (line 929).
  6. One-time migration: if `i18nextLng` exists and `language` doesn't, copy it across.
- **Check:** a unit test that seeds every key, runs `softClearLocalStorage()`, and asserts that only `stops_*`/`route_*` are gone. Manually: fresh install → pick Estonian → relaunch twice → still Estonian.
- **Size:** S.

### 10. Declining location is not respected, and Favorites uses fake coordinates

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

---

## Phase 4: Data correctness

### 11. The nearby-stops cache returns data for the wrong time and place

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

### 12. Departures are compared with the real clock, not the chosen time, and the service day is guessed

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
  4. **Behaviour in planned-time mode** (your decision, §6): a live countdown ("50 min") makes no sense for a planned time. Recommendation: when `customTime` is set, show clock times ("08:12") and minutes *relative to the chosen time* ("+12 min"), and don't run the 1-second countdown timer.
  5. Format clock times in `Europe/Tallinn` explicitly with `Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit' })`, so they match stop displays whatever the device's time zone.
- **Check:** unit tests with a fixed `serviceDay`, `referenceTime` values on the same day, the next day and across midnight, plus a non-Tallinn `TZ` (run vitest with `TZ=America/New_York`). Manually: smoke test step 6.
- **Size:** M. The query change touches several call sites, which is why it's grouped with item 11.

### 13. "Filter routes" on the map is empty

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

### 14. Raw translation keys appear on screen

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
  1. Add all 12 keys to all four locale files. English can be taken from the existing inline fallbacks. The Estonian, Russian and Ukrainian texts need a native speaker's check; I can draft them, but mark them for review.
  2. Remove the `|| 'fallback'` pattern (or switch to `t(key, { defaultValue })` where a fallback is really wanted), because the current pattern is dead code that gives false confidence.
  3. The Phase 0.2 check keeps this from recurring.
- **Size:** S.

---

## Phase 5: Backlog (confirmed, lower priority)

These are independent and can be picked up in any order. The size and the reason are given for each.

| # | Problem | Where | Why fix | Change | Size |
|---|---------|-------|---------|--------|------|
| B1 | **Map redraws every second.** A hidden `timeAgo` state updates every second, re-rendering the map and re-creating every marker's icon and position | `StopFinder.jsx:1279-1305` | Biggest performance cost left: constant marker churn drains battery and makes panning stutter on mid-range phones | Delete `timeAgo` if it's unused, or move it into a small child component that owns the interval. Memoize marker icons (`useMemo` keyed by stop id + favorite + selected) | S |
| B2 | 210 MB unused `routes.json` written into `public/` | `fetchRoutes.js:93-94` | Ends up in every local `dist/` | Covered by item 6, step 2 | S |
| B3 | Map refresh makes an uncached request covering a radius of 2 km or more every 30 s, and the result is thrown away on the next pan | `StopFinder.jsx:923-936` | API quota and mobile data use | Refresh departures only for stops in the viewport, which the map now shows from `stops.json`. Batch by stop id instead of radius. Pause while hidden | M |
| B4 | Favorites refetch every favorite's departures on each GPS move of 10 m or more | `Favorites.jsx:190` | Unneeded API load while walking: departures don't depend on where the user is | Remove `location.lat/lon` from the departures effect's dependencies. Only distances and walking times depend on location | S |
| B5 | Walking times in Near Me are computed for the old list after a move of more than 100 m | `NearMe.jsx` walking-time effect | Wrong walking minutes shown | Include the stops' identity in the effect key and cancel stale batches with a sequence ref | S |
| B6 | Search results can arrive out of order | `Header.jsx:38-60`, `useNearbyStops` | A slow older response can overwrite a newer one | Add a sequence counter or `AbortController` per request | S |
| B7 | The time picker's ±15/30 min buttons wrap past midnight without changing the date | `DateTimePicker.jsx` | A plan for 23:50 + 15 min lands on today at 00:05 | Use date arithmetic (`addMinutes` from date-fns) on the whole `Date` | S |
| B8 | Dark mode never follows the system theme | `useDarkMode.js` | A value saved on first load disables the system listener forever | Store an explicit override only when the user toggles; otherwise follow `prefers-color-scheme` | S |
| B9 | A storage-full failure leaves the route update spinner running forever | `digitransit.js:714` (`storeRoutesInIndexedDB`) | The user sees "Updating…" permanently | Add `tx.onabort` and `tx.onerror` that reject the promise; show `settings.updateFailed` | S |
| B10 | Favorite stars missing on clustered markers | `StopFinder.jsx` cluster icon | Favorites are detected through a marker `add` event that never fires for markers inside a cluster | Compute favorite state from data in `iconCreateFunction` (`cluster.getAllChildMarkers()` → stop ids) | S |
| B11 | Dev proxy slow-response timer starts when headers arrive | `vite.config.js:43` | Logs only measure the body; dev-only, so cosmetic | Record the start time in `proxyReq` (`req._start = Date.now()`) | XS |
| B12 | About seven copies of the haversine distance function | `StopFinder`, `useGeolocation`, `digitransit.js`, … | Drift risk; the item 2 and item 11 fixes need one shared helper anyway | Move to `src/utils/geo.js` (started in item 2) | S |
| B13 | Git history growth | repo | Covered by item 6: once daily no-op commits stop, growth stops. Rewriting existing history isn't recommended (it would break every clone), and it's small in packed form anyway | — | — |

---

## 6. Decisions I need from you before implementing

1. **Route file vs. GitHub's 100 MiB limit (item 6, step 4).** Recommended: (a), filter the bundled routes to the supported city zones. The alternatives are (b), a slimmer schema, and (c), not committing the file at all. Doing nothing means the nightly job starts failing once the national feed grows by about 14 %.
2. **Display in planned-time mode (item 12, step 4).** Recommended: clock times plus "+N min from the chosen time", with no live countdown. The alternative is to keep the countdowns relative to the chosen time.
3. **`FULL_CLEAR_VERSION` (item 9, step 5).** Recommended: set it to `'never'`. A full wipe deletes favorites, and there's no pending migration that needs it.
4. **Route search scope (item 2).** Only the Tartu zone, or the zone the map is currently in (Tartu or Tallinn)? Recommended: the current map zone, defaulting to Tartu, because `CITY_ZONES` already defines both.
5. **Translations (item 14).** Can you (or someone you trust) check the Estonian, Russian and Ukrainian strings I draft?

---

## 7. Risks and how they're contained

| Risk | Where | Mitigation |
|------|-------|------------|
| A service-worker bug strands users on a broken version | Item 5 | Separate PR; test with `vite preview` plus two builds; network-first HTML means a broken worker can be replaced by the next deploy. Keep a kill-switch: a worker that only calls `self.registration.unregister()` can be deployed if needed |
| The new consent logic re-prompts existing users | Item 10 | Migration step 6 maps the existing permission state; the modal shows at most once more |
| The `serviceDay` query change breaks cached data | Items 11–12 | Bump `SOFT_CLEAR_VERSION` in the same PR, which only deletes `stops_*`/`route_*` caches after item 9's inverted logic, so no user data is touched |
| Release workflow changes can't be tested locally | Items 7–8 | Test with `workflow_dispatch` on a branch first; `create-release` publishes a **draft** |
| The favorites store refactor changes the hook's API | Item 4 | Keep the exact return shape; covered by the two-instance unit test |

---

## 8. Definition of done

- `npm test` and `npm run lint:i18n` pass locally and in `deploy.yml`.
- All six smoke-test steps in §0.3 pass on the web build **and** the Android build.
- Two consecutive `Update Route Data` runs: the second creates no commit; a real data change triggers `Deploy to GitHub Pages`.
- A `v*` tag produces a draft release with the web zip, APK, and Windows, Linux and macOS builds, each of which can load departures (proving the API key is present).
- A returning user with the old service worker sees the new build after one reload, without losing favorites, language or settings.
