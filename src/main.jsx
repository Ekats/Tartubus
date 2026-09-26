import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n' // Initialize i18n

// Listen for service worker messages: when a new version has been installed,
// reload the next time the user returns to the app instead of mid-use.
// Stored-data migrations are handled by initializeCaches(), not here.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_READY') {
      console.log(`🔄 New version ${event.data.version} installed - will reload when the app is next opened`);

      const reloadWhenVisible = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', reloadWhenVisible);
          window.location.reload();
        }
      };
      document.addEventListener('visibilitychange', reloadWhenVisible);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
