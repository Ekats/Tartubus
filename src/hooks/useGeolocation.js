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
  const [watching, setWatching] = useState(false);

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

  // Watch for location changes
  useEffect(() => {
    if (!navigator.geolocation || !watching) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000, // Accept cached position up to 30s old
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [watching]);

  const startWatching = () => setWatching(true);
  const stopWatching = () => setWatching(false);

  return { location, error, loading, getLocation, startWatching, stopWatching, watching };
}
