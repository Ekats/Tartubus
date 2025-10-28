import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNearbyStops } from '../hooks/useNearbyStops';
import { useFavorites } from '../hooks/useFavorites';
import { formatDistance } from '../utils/timeFormatter';
import { getSetting } from '../utils/settings';
import { reverseGeocode } from '../utils/geocoding';
import { getNextStopName } from '../services/digitransit';
import CountdownTimer from './CountdownTimer';

function NearMe({ onNavigateToMap }) {
  const { t } = useTranslation();
  const { location, error: locationError, loading: locationLoading, getLocation, startWatching } = useGeolocation();
  const { stops, loading: stopsLoading, error: stopsError, fetchNearbyStops } = useNearbyStops();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [hasSearched, setHasSearched] = useState(true); // Start as true for auto-trigger
  const [address, setAddress] = useState(t('nearMe.requestingLocation'));

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
          setAddress(t('nearMe.noLocation'));
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

  // Auto-refresh departure times every 30 seconds
  useEffect(() => {
    if (!location.lat || !location.lon) return;

    const interval = setInterval(() => {
      const radius = getSetting('nearbyRadius') || 500;
      // Refresh without force (use cache if available < 2 min old)
      fetchNearbyStops(location.lat, location.lon, radius, false);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [location.lat, location.lon]);

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
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{t('nearMe.currentLocation')}</div>
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
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('nearMe.title')}</h2>
            <button
              onClick={handleFindNearby}
              className="text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-2"
              disabled={loading}
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              {loading ? t('nearMe.refreshing') : t('nearMe.refresh')}
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
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                    {stop.name}
                    {(() => {
                      // Get the most common next stop from departures
                      const nextStops = stop.stoptimesWithoutPatterns
                        ?.map(dep => getNextStopName(dep))
                        .filter(Boolean);

                      if (nextStops && nextStops.length > 0) {
                        // Find most common next stop
                        const counts = {};
                        nextStops.forEach(name => counts[name] = (counts[name] || 0) + 1);
                        const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                        return <span className="text-gray-500 dark:text-gray-400 font-normal"> → {mostCommon}</span>;
                      }
                      return null;
                    })()}
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('map.stop')} {stop.code} • {t('nearMe.distance', { distance: Math.round(stop.distance) })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(stop)}
                    className={`rounded-full p-2 transition-colors ${
                      isFavorite(stop.gtfsId)
                        ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-500'
                        : 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400'
                    }`}
                    title={isFavorite(stop.gtfsId) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg className="h-6 w-6" fill={isFavorite(stop.gtfsId) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onNavigateToMap(stop)}
                    className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                    title="Show on map"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Departures */}
              {stop.stoptimesWithoutPatterns && stop.stoptimesWithoutPatterns.length > 0 ? (
                <div className="space-y-2">
                  {stop.stoptimesWithoutPatterns.slice(0, 3).map((departure, idx) => {
                    const nextStop = getNextStopName(departure);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-primary dark:bg-blue-600 text-white font-bold px-3 py-1 rounded-md text-sm">
                            {departure.trip?.route?.shortName || '?'}
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-700 dark:text-gray-300">
                              {departure.headsign || departure.trip?.route?.longName || 'Unknown destination'}
                            </div>
                            {nextStop && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                → {nextStop}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                          <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-2">{t('nearMe.noDepartures')}</div>
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
