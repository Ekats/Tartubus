import { useState, useEffect } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNearbyStops } from '../hooks/useNearbyStops';
import { formatDistance } from '../utils/timeFormatter';
import { getSetting } from '../utils/settings';
import { reverseGeocode } from '../utils/geocoding';
import CountdownTimer from './CountdownTimer';

function NearMe({ onNavigateToMap }) {
  const { location, error: locationError, loading: locationLoading, getLocation, startWatching } = useGeolocation();
  const { stops, loading: stopsLoading, error: stopsError, fetchNearbyStops } = useNearbyStops();
  const [hasSearched, setHasSearched] = useState(true); // Start as true for auto-trigger
  const [address, setAddress] = useState('Loading location...');

  // Auto-start on mount
  useEffect(() => {
    getLocation();
    startWatching();
  }, []);

  const handleFindNearby = () => {
    // If we already have location, just refresh the stops
    if (location.lat && location.lon) {
      const radius = getSetting('nearbyRadius') || 500;
      // Force refresh to bypass cache and get fresh departure times
      fetchNearbyStops(location.lat, location.lon, radius, true);
    } else {
      // Otherwise, get location first
      getLocation();
      setHasSearched(true);
    }
  };

  // Fetch address when location is available
  useEffect(() => {
    if (location.lat && location.lon) {
      reverseGeocode(location.lat, location.lon).then(addr => {
        if (addr) {
          setAddress(addr);
        } else {
          setAddress('Location found');
        }
      });
    }
  }, [location.lat, location.lon]);

  // Fetch stops when location is available
  useEffect(() => {
    if (location.lat && location.lon && hasSearched) {
      const radius = getSetting('nearbyRadius') || 500;
      fetchNearbyStops(location.lat, location.lon, radius);
    }
  }, [location.lat, location.lon, hasSearched]);

  const loading = locationLoading || stopsLoading;
  const error = locationError || stopsError;

  return (
    <div className="p-4 h-full overflow-y-auto dark:bg-gray-900">
      {/* Your Location Display */}
      {location.lat && location.lon && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <span className="text-lg">📍</span>
            <div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Your Location</div>
              <div className="text-sm font-medium">{address}</div>
            </div>
          </div>
        </div>
      )}

      {/* Big "Near Me" Button - only show if not searched and not loading */}
      {!hasSearched && !loading && (
        <button
          onClick={handleFindNearby}
          disabled={loading}
          className="w-full bg-primary dark:bg-blue-600 text-white font-bold py-6 px-8 rounded-2xl shadow-xl hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xl"
        >
          <span className="flex items-center justify-center gap-3">
            <span className="text-2xl">📍</span>
            Near Me - Find Next Buses
          </span>
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-semibold">Unable to find nearby stops</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nearby Stops List */}
      {stops.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Nearby Stops</h2>
            <button
              onClick={handleFindNearby}
              className="text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-2"
              disabled={loading}
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {stops.map((stop) => (
            <div
              key={stop.gtfsId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              {/* Stop Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{stop.name}</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Stop {stop.code} • {formatDistance(stop.distance)} away
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigateToMap(stop)}
                    className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                    title="Show on map"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="text-2xl">🚏</span>
                </div>
              </div>

              {/* Departures */}
              {stop.stoptimesWithoutPatterns && stop.stoptimesWithoutPatterns.length > 0 ? (
                <div className="space-y-2">
                  {stop.stoptimesWithoutPatterns.slice(0, 3).map((departure, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary dark:bg-blue-600 text-white font-bold px-3 py-1 rounded-md text-sm">
                          {departure.trip?.route?.shortName || '?'}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {departure.headsign || departure.trip?.route?.longName || 'Unknown destination'}
                        </div>
                      </div>
                      <div className="font-semibold text-gray-800 dark:text-gray-100">
                        <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-2">No upcoming departures</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading State - only show when no stops yet */}
      {loading && stops.length === 0 && (
        <div className="mt-4 text-center text-gray-600 dark:text-gray-400">
          <div className="text-4xl mb-2 animate-bounce">🚏</div>
          <div>Searching for nearby stops...</div>
        </div>
      )}

      {/* No Stops Found */}
      {!loading && hasSearched && stops.length === 0 && !error && (
        <div className="mt-6 text-center text-gray-600 dark:text-gray-400">
          <div className="text-4xl mb-2">🤷</div>
          <div className="font-medium">No bus stops found nearby</div>
          <div className="text-sm mt-1">Try increasing the search radius or moving to a different location</div>
        </div>
      )}
    </div>
  );
}

export default NearMe;
