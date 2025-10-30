import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n' // Initialize i18n

// Listen for service worker messages (e.g., force reload on version update)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FORCE_RELOAD') {
      console.log(`🔄 New version ${event.data.version} detected - FULL CACHE CLEAR and reloading`);

      // FULL CLEAR - wipe everything including favorites
      localStorage.clear();

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
