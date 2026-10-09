import { useState, useCallback, useRef } from 'react';
import { getNearbyStopsWithMeta } from '../services/digitransit';

/**
 * Custom hook to fetch nearby bus stops.
 * `staleSince`: epoch ms the shown stops were fetched when they are a last-known copy
 * (the latest refresh failed), otherwise null.
 */
export function useNearbyStops() {
  const [stops, setStops] = useState([]);
  const [staleSince, setStaleSince] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refs keep fetchNearbyStops stable across renders (so effects and intervals
  // that depend on it are not torn down on every render)
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const requestSeqRef = useRef(0); // Ignore responses from superseded requests

  const fetchNearbyStops = useCallback(async (lat, lon, radius = 500, forceRefresh = false, customTime = null) => {
    const requestSeq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const { stops: nearbyStops, source, fetchedAt } = await getNearbyStopsWithMeta(lat, lon, radius, forceRefresh, customTime);
      if (requestSeq !== requestSeqRef.current) return; // A newer request was started
      setStops(nearbyStops);
      setStaleSince(source === 'stale' ? fetchedAt : null);
      setError(null); // Clear any previous errors on success
      setLoading(false);
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return; // A newer request was started
      console.error('Error fetching nearby stops:', err);

      // Only show error if we don't have any existing stops to display
      // This prevents error from hiding existing (cached/stale) data
      if (stopsRef.current.length === 0) {
        setError(err.message);
      } else {
        console.warn('Refresh failed, keeping existing stops displayed');
        setError(null); // Don't show error when we have data
      }

      setLoading(false);
      // Note: We intentionally DON'T clear stops on error
      // This keeps existing data visible even when refresh fails
    }
  }, []);

  return { stops, staleSince, loading, error, fetchNearbyStops };
}
