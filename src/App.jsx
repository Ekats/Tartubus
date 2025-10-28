import { useState, useEffect } from 'react'
import Header from './components/Header'
import NearMe from './components/NearMe'
import StopFinder from './components/StopFinder'
import Favorites from './components/Favorites'
import BottomNav from './components/BottomNav'
import Settings from './components/Settings'
import { useDarkMode } from './hooks/useDarkMode'
import { initializeCaches } from './services/digitransit'

function App() {
  const [activeView, setActiveView] = useState('nearme')
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const [selectedStop, setSelectedStop] = useState(null)
  const [locationSelectionMode, setLocationSelectionMode] = useState(false)
  const [manualLocation, setManualLocation] = useState(null)

  // Initialize caches on app startup
  useEffect(() => {
    initializeCaches();
  }, [])

  const renderView = () => {
    switch (activeView) {
      case 'nearme':
        return <NearMe
          manualLocation={manualLocation}
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
          isDarkMode={isDarkMode}
          selectedStop={selectedStop}
          locationSelectionMode={locationSelectionMode}
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
        return <Favorites onNavigateToMap={(stop) => {
          setSelectedStop(stop)
          setActiveView('map')
        }} />
      case 'settings':
        return <Settings />
      default:
        return <NearMe />
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
      {/* Floating bottom navigation */}
      <BottomNav activeView={activeView} onViewChange={setActiveView} />
    </div>
  )
}

export default App
