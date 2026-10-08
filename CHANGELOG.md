# Changelog

All notable changes to Tartu Bussid will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- 🐛 **Near Me live times updated only every ~90 s** instead of about once a minute: the refresh cache counted its age from when the answer arrived, so the 60 s refresh still found it fresh. Live times now update about every 60 s
- 🐛 **The map's stop card never updated** while it stayed open. It now reloads every 30 s, when the chosen time changes, and from a new refresh button on the card
- 🐛 **The map refreshed departures around your GPS position** even when you'd panned elsewhere; it now refreshes the area on screen
- 🔋 **Favorites and the map kept refreshing in the background**; they now pause while the app is hidden (like Near Me) and refresh as soon as you return
- 🔋 **Favorites reloaded every stop's departures on every 10 m of movement**; moving now only re-sorts the list by distance
- 🐛 **Routes 1–9 couldn't be searched** - search only started at 2 characters, so a single-digit route number never searched. Route numbers now search from the first digit; addresses still need 2 characters

### Changed
- 🚌 **New bus icon everywhere** - the bus emojis and the drawn bus icon in the app, and the website's favicon and install icon, now use the new red bus (`resources/icon.png`)
- 🔎 **Smaller search text** in the header search bar
- 🕒 **Timetable** shows one column fewer (5 on phones, 7 on tablets, 9 on wide screens), and the time tiles stretch to fill each row

## [3.4.3] - 2026-10-07

### Changed
- 🚌 **App icon background is white** instead of blue

## [3.4.2] - 2026-10-07

### Changed
- 🚌 **New app icon** - the Android launcher icon is the new red bus (regenerated from `resources/icon.png` for all screen densities, sized to fit inside round launcher shapes)

## [3.4.1] - 2026-10-05

### Fixed
- 🐛 **Stops shown twice on the map** - the bundled stop list was from November 2025 and the timetable feed has since renumbered every stop, so each stop appeared once with departures and once without. The stop list is now rebuilt nightly from the route data, and stops with the same stop code are merged
- 🐛 **Android app kept showing the previous version after an update** - the offline cache served the old pages until the app was opened a second time. The Android app no longer uses that cache; the website still does

### Changed
- 🌐 **Language list** - Ukrainian and Russian are now under "Show more" in Settings
- 📦 Stop list covers the supported cities only (2540 stops, 324 KB instead of 18 417 stops, 2.3 MB)

## [3.4.0] - 2026-10-04

Version numbers continue from the Google Play listing (3.3a). Everything since 1.5.4:

### Fixed
- 🐛 Journey planning with transfers crashed and ignored the chosen time
- 🐛 Route search returned nothing; a picked route is now shown on the map
- 🐛 Near Me stopped refreshing after the first update; live delays now refresh about once a minute
- 🐛 Favorites could be silently deleted when starring from two places
- 🐛 "Use manual location" was ignored and GPS started anyway; distances were measured from the city centre
- 🐛 Language, settings and dismissed prompts were lost on cache clears and on the second launch
- 🐛 Departure times ignored the chosen time and the device's time zone
- 🐛 Map route filter was empty; missing translations showed raw key names
- 🐛 Returning web users never received new versions

### Changed
- 🤖 Android: Capacitor 8, targets Android 16 (API 36); Android 7.0 is now the minimum
- 🚀 Signed Android builds, GitHub Releases and Google Play internal-track uploads are automated from `v*` tags
- 🔢 Settings shows the real version and build id

## [1.5.4] - 2025-11-13

### Fixed
- 🐛 **GPS startup issue on NearMe tab** - GPS now starts immediately when app launches (if permission already granted)
  - App.jsx now initializes GPS tracking at root level
  - No longer waiting for NearMe's permission checking logic to start GPS
  - Fixes issue where location wouldn't load until switching to Map tab

### Technical
- Moved GPS initialization from component level to App.jsx useEffect
- Checks localStorage for 'location_modal_seen' before starting GPS
- Ensures single GPS instance starts tracking on app mount

## [1.5.3] - 2025-11-13

### Fixed
- 🐛 **Critical: Fixed location persistence across tabs** - GPS location now shared across all tabs instead of resetting
  - Lifted `useGeolocation` hook to App.jsx for single source of truth
  - NearMe tab no longer resets to "Requesting location..." when switching from Map tab
  - Prevents showing default "Riia 2, Uueturu, Tartu" location after tab switches
- ⏱️ **Increased GPS timeout** - Changed from 5s to 15s for better Android GPS cold start reliability
- 📍 **Smarter location detection** - Now detects default coordinates to prevent premature reverse geocoding
- 🔧 **Better location caching** - Allows 10s cached position (maximumAge) for faster response

### Technical
- Shared geolocation state persists across component unmount/remount cycles
- App.jsx now manages single `useGeolocation()` instance passed as prop to NearMe and StopFinder
- Prevents multiple GPS instances from competing and causing state resets

### Documentation
- 📝 **Android build instructions** - Added Android Studio build process to INSTRUCTIONS.md
- Version management guidelines for versionCode increments

## [1.5.1] - 2025-11-11

### Added
- ⚡ **3-5x faster walking time loading** - Optimized API requests with batching and caching
  - Walking routes cached in memory for 15 minutes (instant on revisit)
  - Batched requests (2 at a time) to avoid API rate limits
  - Smart GPS drift filtering (>100m threshold) prevents unnecessary refetches
  - Only fetches walking routes for nearby stops (<2km)
- 🎨 **Enhanced map stop popups** - Map view now shows same rich information as other tabs
  - Distance with walking time display using street routing
  - Timetable button (green calendar icon) for daily schedules
  - Expandable departure cards showing upcoming stops
  - Progressive disclosure (show more/less buttons)
  - Favorite star toggle
  - Real-time delay indicators (red/green badges)
- 🔧 **Reusable StopCard component** - Eliminated ~200 lines of duplicate code
  - Single component used in NearMe, Favorites, and Map overlay
  - Ensures consistent UX across all views
  - Easier maintenance and future updates

### Performance
- Walking time requests use LRU cache (50 entry max) with automatic eviction
- GPS drift detection prevents refetching when user hasn't moved significantly
- Smart distance check skips slow API calls for faraway stops (>2km)
- Batched parallel requests (2 at a time) balance speed and API limits

### Fixed
- 🐛 **GPS drift no longer resets walking times** - Walking times persist during small GPS movements
- 🚫 **No timeouts for faraway stops** - Walking routes only fetched for reachable distances

## [1.5.0] - 2025-11-05

### Added
- 🗺️ **Interactive journey route visualization** - "How to get here" journey cards are now clickable
  - Click any journey plan to see the full route displayed on the map
  - Blue polylines for bus routes, dashed green polylines for walking segments
  - Yellow stop markers for ALL stops along the route (boarding, transfers, intermediate stops, destination)
  - Permanent tooltips for key stops showing exact times and instructions
  - "Exit Route View" button to return to normal map view
- 🔄 **Smart combined transfer tooltips** - Transfer points show single tooltip with both actions
  - "⬇️ Get off 🚌 [route] at [time]"
  - "⬆️ Board 🚌 [route] at [time]"
  - Prevents duplicate markers at the same location
- 🌐 **Full multilingual route support** - All journey route tooltips translated
  - Added translation keys for: `boardHere`, `getOffHere`, `getOff`, `board`, `at`, `arrives`, `transferPoint`, `estimatedTime`, `exitRouteView`
  - Supports English, Estonian, Ukrainian, and Russian
- 🔍 **Auto-zoom to route** - Map automatically fits entire journey in view when route is selected
- 💾 **Persistent route view** - Route visualization persists when switching between tabs
  - Lifted `selectedJourney` state to App component
  - Route view remains intact when navigating to other tabs and back
- ⏰ **Time displays on all stops** - Shows exact boarding/alighting times and estimated times for intermediate stops
- 🧭 **Clean route view** - All other bus stops are hidden when viewing a journey route for clarity

### Fixed
- 🗺️ **Map blank screen** - Fixed issue where keeping components mounted with CSS `hidden` broke Leaflet map initialization
- 🔍 **Map zoom reset** - Fixed map zooming to center instead of route when switching back to map tab
  - Added 100ms delay to fitBounds to ensure map is fully initialized
  - Modified LocationMarker to not zoom to user location when journey route is selected
- 🎯 **State persistence** - Route visualization no longer lost when switching tabs

### Technical
- Lifted `selectedJourney` state from StopFinder to App component for persistence
- Added `selectedJourney` prop to LocationMarker to prevent conflicting zoom behavior
- Enhanced journey visualization with combined transfer logic and duplicate prevention
- Updated all language files (en.json, et.json, uk.json, ru.json) with route visualization translations

## [1.4.2] - 2025-11-04

### Fixed
- 🎯 **GPS drift filtering** - Location only updates when user moves >10 meters, preventing constant refreshes
- 🔋 **Better battery life** - Significantly reduced unnecessary location updates and API calls
- 🗺️ **Journey planner stability** - "How to get there" no longer refreshes when standing still

### Technical
- Added distance-based filtering in `useGeolocation` hook with 10m threshold
- Location state only updates on significant movement, not GPS noise
- Console logs show filtered drift: "📍 GPS drift detected (X.Xm), ignoring..."

## [1.4.1] - 2025-11-04

### Fixed
- 🗺️ **Journey planner refresh loop** - "How to get there" no longer constantly refreshes due to GPS drift
- Journey plans now only refetch when location changes >100m or different stop is selected

## [1.4.0] - 2025-11-04

### Added
- 📅 **Daily timetable view** - new green calendar button shows full day schedule for any stop, grouped by route
- ⏰ **Clock time subtitles** - buses showing "X min" now also display arrival time underneath
- 📍 **Upcoming stop times** - expandable departure list now shows scheduled arrival time for each upcoming stop

### Changed
- 🕐 **Departed bus display** - departed buses now show their scheduled time (e.g., "15:30") instead of "Late"
- ⏱️ **Extended visibility** - departed buses remain visible for 10 minutes (unchanged, but now with clock time)
- 🎨 **Dark mode timetable** - daily timetable times use dark blue background with white text in dark mode

### Fixed
- 🔄 **Critical: Fixed infinite refresh loop** - GPS drift no longer triggers constant timetable refreshes
- 🚌 **Journey planner now works** - fixed blocking issue where constant refreshing prevented route planning
- 📱 **Scrollable modals** - all modals now scrollable on small screens (fixes accessibility issue where users couldn't get past location modal)
- 💾 **Cache expandable stops** - fixed buttons disappearing after tab switch (now caches full stop data including upcoming stops)
- 🗺️ **Large map cache skip** - map queries with 8km radius no longer cached to prevent quota issues

### Technical
- Intervals only restart if location changes >100m (prevents GPS drift refresh storms)
- Cache format updated to include all stoptimes from current position onwards
- Added `useRef` and `useCallback` to stabilize refresh intervals
- Modal containers now have `overflow-y-auto` and `max-h-[90vh]` for proper scrolling

## [1.3.1] - 2025-11-02

### Fixed
- 🔗 **Clickable GitHub links** - GitHub references in location modal now link to repository
- 🇪🇪 **Fixed Estonian translations** - "lähipeatus" (nearby stop) and "sihtkohta" (to destination) now grammatically correct
- ✅ **Honest privacy statements** - clarified that coordinates are sent to APIs (no misleading claims)
- 🔧 **Fixed GitHub Actions** - nightly route update workflow no longer tries to commit ignored 150MB file

## [1.3.0] - 2025-11-02

### Added
- 🖱️ **Click stops for location** - can now click on bus stop markers when selecting manual location (not just empty map areas)
- ⚠️ **Better permission help** - "Request Location" button now shows helpful modal with instructions when permission is blocked
- 🚌 **Journey planning with transfers** - "How to get here" shows routes with transfers when no direct bus is available
- 📍 **Nearby stops routing** - finds routes to stops within 300m of destination
- 🌐 **Ukrainian translation** - full Ukrainian language support

## [1.2.5] - 2025-11-02

### Added
- 🌐 **Ukrainian translation** - added full Ukrainian language support

## [1.2.4] - 2025-11-02

### Fixed
- 🐛 **Fixed location permission flow** - modal now shows BEFORE browser asks for location
- 🎨 **Blue stop icons** - non-nearby stops are now blue instead of gray for better visibility

### Added
- ⏰ **Late bus detection** - buses past scheduled time show as "Late" (grayed out, visible for 10 min)
- 🚫 **No ghost buses** - API startTime parameter + client-side filtering prevents showing departed buses
- 🎯 **Smart "How to get here"** - only shows for distant stops (hidden when stop is within walking distance)
- 🔒 **100% safe from ghost buses** - triple-layer protection (API filter, client filter, UI filter)

## [1.2.0] - 2025-10-30

### Added
- ✨ **Service Worker force update system** - automatic cache clearing on version updates
- ✨ **Location permission modal** - explains privacy/safety before requesting location
- ✨ **Fixed "Arriving" display** - shows buses under 2min as "Arriving" (matches physical bus stops)
- ✨ **Favorites sorted by distance** - closest stops appear first
- ✨ **Smooth map zooming** - improved zoom animations
- ✨ **Cache management buttons** - soft/full clear options in Settings
- ✨ **Request Location button** - appears when permission denied
- ✨ **Modal display fix** - location permission modal only shows once

## [1.1.0] - 2025-10-29

### Fixed
- ✨ Fixed manual location GPS interference
- ✨ Orange user location pin for better visibility
- ✨ Auto-pan to user location when opening map tab

### Added
- ✨ Expandable departure lists (3 → 8 → 20)
- ✨ Smart stop merging system (prevents disappearing stops)
- ✨ Distance-based cleanup for memory management

## Earlier Versions

See git history for changes before v1.1.0.

---

**Tartu Bussid** - Making bus schedules fast and easy! 🚌
