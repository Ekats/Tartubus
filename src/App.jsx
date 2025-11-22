import { useState, useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import Header from './components/Header'
import NearMe from './components/NearMe'
import StopFinder from './components/StopFinder'
import Favorites from './components/Favorites'
import BottomNav from './components/BottomNav'
import Settings from './components/Settings'
import InstallPrompt from './components/InstallPrompt'
import AndroidAppPrompt from './components/AndroidAppPrompt'
import DateTimePicker from './components/DateTimePicker'
import { useDarkMode } from './hooks/useDarkMode'
import { useGeolocation } from './hooks/useGeolocation'
import { initializeCaches } from './services/digitransit'

function App() {
  const [activeView, setActiveView] = useState('nearme')
  const { isDarkMode, toggleDarkMode } = useDarkMode()

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

  // Initialize caches on app startup
  useEffect(() => {
    initializeCaches();
  }, [])

  // Start GPS tracking on app startup
  useEffect(() => {
    // Check if user has seen the location modal and has permission
    const hasSeenModal = localStorage.getItem('location_modal_seen');

    if (hasSeenModal) {
      // Modal was seen before, safe to start GPS immediately
      geolocationHook.getLocation();
      geolocationHook.startWatching();
    }
    // If modal hasn't been seen, NearMe component will handle showing it and starting GPS
  }, [])

  // Android back button handler
  useEffect(() => {
    let backButtonListener;

    const setupBackButton = async () => {
      backButtonListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
        const now = Date.now();

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

    setupBackButton();

    // Cleanup
    return () => {
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
      name: location.display_name || 'Search Result',
      lat: location.lat,
      lon: location.lon,
      isSearchResult: true
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
        return <StopFinder
          geolocationHook={geolocationHook}
          isDarkMode={isDarkMode}
          selectedStop={selectedStop}
          locationSelectionMode={locationSelectionMode}
          manualLocation={manualLocation}
          selectedJourney={selectedJourney}
          selectedRoute={selectedRoute}
          customTime={customTime}
          onJourneyChange={setSelectedJourney}
          onRouteChange={setSelectedRoute}
          onLocationSelected={(location) => {
            setManualLocation(location)
            setLocationSelectionMode(false)
            setActiveView('nearme')
          }}
          onCancelLocationSelection={() => {
            setLocationSelectionMode(false)
            setActiveView('nearme')
          }}
        />
      case 'favorites':
        return <Favorites
          manualLocation={manualLocation}
          customTime={customTime}
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
        onDestinationSelect={handleDestinationSelect}
        onRouteSelect={handleRouteSelect}
        customTime={customTime}
        onTimePickerOpen={() => setShowTimePicker(true)}
      />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
      {/* Floating bottom navigation */}
      <BottomNav activeView={activeView} onViewChange={setActiveView} />

      {/* Install prompts */}
      <InstallPrompt />
      <AndroidAppPrompt />

      {/* Exit prompt toast */}
      {showExitPrompt && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-out">
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
