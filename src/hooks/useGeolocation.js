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

// The user's answer to the location dialog: 'granted', 'declined', or null (not asked yet)
const LOCATION_CONSENT_KEY = 'location_consent';

export function getLocationConsent() {
  try {
    return localStorage.getItem(LOCATION_CONSENT_KEY);
  } catch {
    return null;
  }
}

export function setLocationConsent(value) {
  try {
    localStorage.setItem(LOCATION_CONSENT_KEY, value);
  } catch {
    // Storage unavailable - the choice just isn't remembered
  }
}

/**
 * Custom hook to get user's device location
 */
export function useGeolocation() {
  const [location, setLocation] = useState({
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
    accuracy: null,
    hasRealFix: false, // Track if we have a real GPS fix
  });
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null); // GeolocationPositionError code (1 = permission denied)
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);

  // Track last reported location to filter GPS drift
  const lastReportedLocation = useRef({
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON
  });
  const hasReceivedFirstFix = useRef(false); // Track if we've ever received a GPS fix

  // Location is in use once a request was made; errors that arrive while the page was
  // hidden (the browser can't answer then) must not strand the user on a stale error.
  const errorRef = useRef(null);
  errorRef.current = error;
  const requestedRef = useRef(false);
  const hiddenDuringRequestRef = useRef(false);
  const pendingRetryRef = useRef(false);
  const getLocationRef = useRef(null);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    requestedRef.current = true;
    hiddenDuringRequestRef.current = document.visibilityState === 'hidden';
    pendingRetryRef.current = false;
    setError(null);
    setErrorCode(null);
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

        // Always update on first fix, then only if moved significantly
        if (!hasReceivedFirstFix.current || distance >= MIN_DISTANCE_THRESHOLD) {
          setLocation({
            lat: newLat,
            lon: newLon,
            accuracy: position.coords.accuracy,
            hasRealFix: true,
          });
          lastReportedLocation.current = { lat: newLat, lon: newLon };
          hasReceivedFirstFix.current = true;
        }

        setError(null);
        setErrorCode(null);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        // Keep default location
        if (!hasReceivedFirstFix.current && hiddenDuringRequestRef.current) {
          // The request ran (partly) while the page was hidden: retry once visible
          // instead of surfacing the timeout
          if (document.visibilityState === 'hidden') {
            pendingRetryRef.current = true;
          } else {
            hiddenDuringRequestRef.current = false;
            getLocationRef.current?.();
          }
          return;
        }
        setError(err.message);
        setErrorCode(err.code);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased to 15s for Android GPS cold start
        maximumAge: 10000, // Allow cached position up to 10s old for faster response
      }
    );
  };

  // Watch for location changes (paused while the app is hidden)
  useEffect(() => {
    if (!navigator.geolocation || !watching) return;

    let watchId = null;
    const handlePosition = (position) => {
      const newLat = position.coords.latitude;
      const newLon = position.coords.longitude;

      // Calculate distance from last reported location
      const distance = calculateDistance(
        lastReportedLocation.current.lat,
        lastReportedLocation.current.lon,
        newLat,
        newLon
      );

      // Always update on first fix, then only if moved significantly (>10m)
      if (!hasReceivedFirstFix.current || distance >= MIN_DISTANCE_THRESHOLD) {
        console.log(`📍 Location changed by ${distance.toFixed(1)}m, updating...`);
        setLocation({
          lat: newLat,
          lon: newLon,
          accuracy: position.coords.accuracy,
          hasRealFix: true,
        });
        lastReportedLocation.current = { lat: newLat, lon: newLon };
        hasReceivedFirstFix.current = true;
      } else {
        console.log(`📍 GPS drift detected (${distance.toFixed(1)}m), ignoring...`);
      }

      setError(null);
      setErrorCode(null);
    };

    const handleError = (err) => {
      setError(err.message);
      setErrorCode(err.code);
    };

    const start = () => {
      if (watchId === null) {
        watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000, // Accept cached position up to 30s old
        });
      }
    };
    const stop = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [watching]);

  getLocationRef.current = getLocation;

  // Back from the background without a real fix: look again (the watch effect above
  // restarts itself, but a one-shot request that failed or never answered does not)
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'hidden') {
        hiddenDuringRequestRef.current = true;
        return;
      }
      if (requestedRef.current && !hasReceivedFirstFix.current && (pendingRetryRef.current || errorRef.current)) {
        getLocationRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, []);

  const startWatching = () => setWatching(true);
  const stopWatching = () => setWatching(false);

  return { location, error, errorCode, loading, getLocation, startWatching, stopWatching, watching };
}
