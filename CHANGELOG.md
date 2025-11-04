# Changelog

All notable changes to Tartu Bussid will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
