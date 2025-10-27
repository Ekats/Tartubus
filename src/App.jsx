import { useState } from 'react'
import Header from './components/Header'
import NearMe from './components/NearMe'
import StopFinder from './components/StopFinder'
import BottomNav from './components/BottomNav'
import Settings from './components/Settings'

function App() {
  const [activeView, setActiveView] = useState('nearme')

  const renderView = () => {
    switch (activeView) {
      case 'nearme':
        return <NearMe />
      case 'map':
        return <StopFinder />
      case 'favorites':
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">⭐</div>
              <div className="text-xl font-semibold">Favorites</div>
              <div className="text-sm mt-2">Coming soon...</div>
            </div>
          </div>
        )
      case 'settings':
        return <Settings />
      default:
        return <NearMe />
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
      <BottomNav activeView={activeView} onViewChange={setActiveView} />
    </div>
  )
}

export default App
