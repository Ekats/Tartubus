import { useState } from 'react';
import { getNearbyStops } from '../services/digitransit';

/**
 * Custom hook to fetch nearby bus stops
 */
export function useNearbyStops() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNearbyStops = async (lat, lon, radius = 500) => {
    setLoading(true);
    setError(null);

    try {
      const nearbyStops = await getNearbyStops(lat, lon, radius);
      setStops(nearbyStops);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching nearby stops:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return { stops, loading, error, fetchNearbyStops };
}
