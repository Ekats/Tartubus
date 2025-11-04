import { useState, useEffect, useRef } from 'react';

const DEFAULT_LAT = parseFloat(import.meta.env.VITE_DEFAULT_LAT) || 58.3776;
const DEFAULT_LON = parseFloat(import.meta.env.VITE_DEFAULT_LON) || 26.7290;

// Minimum distance in meters before updating location (prevents GPS drift spam)
const MIN_DISTANCE_THRESHOLD = 10; // 10 meters

/**
 * Calculate distance between two coordinates in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

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

  // Track last reported location to filter GPS drift
  const lastReportedLocation = useRef({
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON
  });

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLon = position.coords.longitude;

        // Calculate distance from last reported location
        const distance = calculateDistance(
          lastReportedLocation.current.lat,
          lastReportedLocation.current.lon,
          newLat,
          newLon
        );

        // Only update if moved significantly or this is first location
        if (distance >= MIN_DISTANCE_THRESHOLD || lastReportedLocation.current.lat === DEFAULT_LAT) {
          setLocation({
            lat: newLat,
            lon: newLon,
            accuracy: position.coords.accuracy,
          });
          lastReportedLocation.current = { lat: newLat, lon: newLon };
        }

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
        const newLat = position.coords.latitude;
        const newLon = position.coords.longitude;

        // Calculate distance from last reported location
        const distance = calculateDistance(
          lastReportedLocation.current.lat,
          lastReportedLocation.current.lon,
          newLat,
          newLon
        );

        // Only update if moved significantly (>10m) to prevent GPS drift spam
        if (distance >= MIN_DISTANCE_THRESHOLD) {
          console.log(`📍 Location changed by ${distance.toFixed(1)}m, updating...`);
          setLocation({
            lat: newLat,
            lon: newLon,
            accuracy: position.coords.accuracy,
          });
          lastReportedLocation.current = { lat: newLat, lon: newLon };
        } else {
          console.log(`📍 GPS drift detected (${distance.toFixed(1)}m), ignoring...`);
        }

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
