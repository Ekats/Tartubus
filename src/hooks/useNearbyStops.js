import { useState } from 'react';
import { getNearbyStops } from '../services/digitransit';

/**
 * Custom hook to fetch nearby bus stops
 */
export function useNearbyStops() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNearbyStops = async (lat, lon, radius = 500, forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const nearbyStops = await getNearbyStops(lat, lon, radius, forceRefresh);
      setStops(nearbyStops);
      setError(null); // Clear any previous errors on success
      setLoading(false);
    } catch (err) {
      console.error('Error fetching nearby stops:', err);

      // Only show error if we don't have any existing stops to display
      // This prevents error from hiding existing (cached/stale) data
      if (stops.length === 0) {
        setError(err.message);
      } else {
        console.warn('Refresh failed, keeping existing stops displayed');
        setError(null); // Don't show error when we have data
      }

      setLoading(false);
      // Note: We intentionally DON'T clear stops on error
      // This keeps existing data visible even when refresh fails
    }
  };

  return { stops, loading, error, fetchNearbyStops };
}
