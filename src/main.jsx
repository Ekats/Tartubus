import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n' // Initialize i18n

// Listen for service worker messages (e.g., force reload on version update)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FORCE_RELOAD') {
      console.log(`🔄 New version ${event.data.version} detected - SOFT CACHE CLEAR and reloading`);

      // SOFT CLEAR - preserve favorites, settings, and important data
      const preserveKeys = [
        'tartu_bus_favorites',
        'tartu-bus-settings',
        'darkMode',
        'i18nextLng',
        'app_build_hash',
        'cache_soft_clear_version',
        'cache_full_clear_version',
        'location_modal_seen'
      ];

      const preserved = {};
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          preserved[key] = value;
        }
      });

      // Clear everything
      localStorage.clear();

      // Restore preserved data
      Object.entries(preserved).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      // Force reload
      window.location.reload(true);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
