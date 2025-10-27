import { useState, useEffect } from 'react';

const DEFAULT_LAT = parseFloat(import.meta.env.VITE_DEFAULT_LAT) || 58.3776;
const DEFAULT_LON = parseFloat(import.meta.env.VITE_DEFAULT_LON) || 26.7290;

/**
 * Custom hook to get user's device location
 */
export function useGeolocation() {
  const [location, setLocation] = useState({
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
    accuracy: null,
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        // Keep default location
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  return { location, error, loading, getLocation };
}
