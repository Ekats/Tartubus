import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { App as CapApp } from '@capacitor/app'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import NearMe from './components/NearMe'
import Favorites from './components/Favorites'
import BottomNav from './components/BottomNav'
import Settings from './components/Settings'
import InstallPrompt from './components/InstallPrompt'
import AndroidAppPrompt from './components/AndroidAppPrompt'
import DateTimePicker from './components/DateTimePicker'
import { useDarkMode } from './hooks/useDarkMode'
import { useGeolocation, getLocationConsent } from './hooks/useGeolocation'
import { useKeyboardInset } from './hooks/useKeyboardInset'
import { initializeCaches } from './services/digitransit'
import { CITY_ZONES } from './utils/geo'

// The Map tab brings the map library (MapLibre GL, ~1 MB): loaded when the tab is first opened
const StopFinder = lazy(() => import('./components/StopFinder'))

function App() {
  const [activeView, setActiveView] = useState('nearme')
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const keyboardOpen = useKeyboardInset()

  // Shared GPS location across all tabs - single source of truth
  const geolocationHook = useGeolocation()

  const [selectedStop, setSelectedStop] = useState(null)
  const [locationSelectionMode, setLocationSelectionMode] = useState(false)
  const [manualLocation, setManualLocation] = useState(null)
  const [selectedJourney, setSelectedJourney] = useState(null) // Lifted state for journey route view
  const [selectedRoute, setSelectedRoute] = useState(null) // Selected route from search
  const [showExitPrompt, setShowExitPrompt] = useState(false)
  const [lastBackPress, setLastBackPress] = useState(0)
  const [customTime, setCustomTime] = useState(null) // null = use current time, otherwise use Date object
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [mapZone, setMapZone] = useState(CITY_ZONES.tartu) // City zone the map shows; route search uses it
  // The map's own layers (stop view, stop popup) for the back button: set by StopFinder to a function
  // that closes the innermost one and returns true, or returns false when none is open
  const mapBackHandlerRef = useRef(null)
  // The map's route filter menu opens from the header; the filter itself stays in StopFinder,
  // which reports how many routes are picked for the button's badge
  const [routeFilterOpen, setRouteFilterOpen] = useState(false)
  const [routeFilterCount, setRouteFilterCount] = useState(0)

  useEffect(() => {
    if (activeView !== 'map') setRouteFilterOpen(false)
  }, [activeView])

  // Initialize caches on app startup
  useEffect(() => {
    initializeCaches();
  }, [])

  // The only place GPS starts automatically: at startup and when a manual location
  // is cleared, and only if the user allowed location. A manual location stops it.
  // (NearMe asks for consent; the map's tracking button is an explicit opt-in.)
  useEffect(() => {
    if (manualLocation) {
      geolocationHook.stopWatching();
    } else if (getLocationConsent() === 'granted') {
      geolocationHook.getLocation();
      geolocationHook.startWatching();
    }
  }, [manualLocation])

  // Android back button handler
  useEffect(() => {
    let backButtonListener;
    let removed = false;

    const setupBackButton = async () => {
      backButtonListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
        const now = Date.now();

        // First the map's stop view, then its stop popup
        if (activeView === 'map' && mapBackHandlerRef.current?.()) {
          return;
        }

        // Priority 1: Close journey route view
        if (selectedJourney) {
          setSelectedJourney(null);
          return;
        }

        // Priority 2: Close stop popup
        if (selectedStop) {
          setSelectedStop(null);
          return;
        }

        // Priority 3: Exit location selection mode
        if (locationSelectionMode) {
          setLocationSelectionMode(false);
          return;
        }

        // Priority 4: Clear route selection
        if (selectedRoute) {
          setSelectedRoute(null);
          return;
        }

        // Priority 5: Navigate to home view
        if (activeView !== 'nearme') {
          setActiveView('nearme');
          return;
        }

        // Priority 6: Show exit prompt or minimize app
        if (now - lastBackPress < 5000) {
          // User pressed back twice within 5 seconds - minimize app
          CapApp.minimizeApp();
        } else {
          // First back press - show exit prompt
          setShowExitPrompt(true);
          setLastBackPress(now);

          // Hide prompt after 3 seconds
          setTimeout(() => {
            setShowExitPrompt(false);
          }, 3000);
        }
      });
    };

    // (The effect re-runs on every state change: a listener that arrives after its cleanup ran is
    // removed at once, or two listeners would each handle the press)
    setupBackButton().then(() => {
      if (removed) backButtonListener?.remove();
    });

    // Cleanup
    return () => {
      removed = true;
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [selectedJourney, selectedStop, locationSelectionMode, selectedRoute, activeView, lastBackPress])

  // Handle destination search - user searches for where they want to GO
  const handleDestinationSelect = (location) => {
    // Create a virtual "stop" at the searched destination
    const destinationStop = {
      gtfsId: `search:${location.lat}:${location.lon}`,
      name: location.name || location.display_name || 'Search Result',
      lat: location.lat,
      lon: location.lon,
      isSearchResult: true,
      isPlace: !!location.isPlace
    };

    console.log('🎯 Destination selected:', destinationStop);

    // Open map view with this destination selected (will show "How to get here")
    setSelectedStop(destinationStop);
    setActiveView('map');
    setLocationSelectionMode(false);
  };

  // Handle route search - user searches for bus route number
  const handleRouteSelect = (route) => {
    console.log('🚌 Route selected:', route);

    // Store selected route and switch to map view
    setSelectedRoute(route);
    setActiveView('map');
  };

  const renderView = () => {
    switch (activeView) {
      case 'nearme':
        return <NearMe
          geolocationHook={geolocationHook}
          manualLocation={manualLocation}
          customTime={customTime}
          onShowRoute={handleRouteSelect}
          onNavigateToMap={(stop) => {
            if (stop?.selectLocation) {
              setLocationSelectionMode(true)
              setActiveView('map')
            } else {
              setSelectedStop(stop)
              setLocationSelectionMode(false)
              setActiveView('map')
            }
          }}
          onClearManualLocation={() => setManualLocation(null)}
        />
      case 'map':
        return <Suspense fallback={null}><StopFinder
          geolocationHook={geolocationHook}
          isDarkMode={isDarkMode}
          selectedStop={selectedStop}
          onStopDismiss={() => setSelectedStop(null)}
          locationSelectionMode={locationSelectionMode}
          manualLocation={manualLocation}
          selectedJourney={selectedJourney}
          selectedRoute={selectedRoute}
          customTime={customTime}
          onJourneyChange={setSelectedJourney}
          onRouteChange={setSelectedRoute}
          onZoneChange={setMapZone}
          backHandlerRef={mapBackHandlerRef}
          routeFilterOpen={routeFilterOpen}
          onRouteFilterOpenChange={setRouteFilterOpen}
          onRouteFilterCountChange={setRouteFilterCount}
          onLocationSelected={(location) => {
            setManualLocation(location)
            setLocationSelectionMode(false)
            setActiveView('nearme')
          }}
          onCancelLocationSelection={() => {
            setLocationSelectionMode(false)
            setActiveView('nearme')
          }}
        /></Suspense>
      case 'favorites':
        return <Favorites
          geolocationHook={geolocationHook}
          manualLocation={manualLocation}
          customTime={customTime}
          onShowRoute={handleRouteSelect}
          onNavigateToMap={(stop) => {
            setSelectedStop(stop)
            setActiveView('map')
          }}
        />
      case 'settings':
        return <Settings />
      default:
        return <NearMe />
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        customTime={customTime}
        onTimePickerOpen={() => setShowTimePicker(true)}
        routeFilterOpen={routeFilterOpen}
        routeFilterCount={routeFilterCount}
        onRouteFilterToggle={activeView === 'map' ? () => setRouteFilterOpen(open => !open) : undefined}
      />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
      {/* Bottom stack: search bar and tab bar. While the search field is typed in, the tab bar
          steps aside and the stack sits right on the keyboard */}
      <div className="fixed left-0 right-0 bottom-[var(--keyboard-inset,0px)] z-[1500]">
        <SearchBar
          onDestinationSelect={handleDestinationSelect}
          onRouteSelect={handleRouteSelect}
          routeSearchZone={mapZone}
          keyboardOpen={keyboardOpen}
        />
        {!keyboardOpen && <BottomNav activeView={activeView} onViewChange={setActiveView} />}
      </div>

      {/* Install prompts */}
      <InstallPrompt />
      <AndroidAppPrompt />

      {/* Exit prompt toast */}
      {showExitPrompt && (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+0.5rem)] left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-out">
          <div className="bg-gray-900 dark:bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg border border-gray-700">
            <p className="text-sm font-medium">Press back again to exit</p>
          </div>
        </div>
      )}

      {/* Date Time Picker Modal */}
      <DateTimePicker
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        customTime={customTime}
        onTimeChange={setCustomTime}
      />
    </div>
  )
}

export default App
