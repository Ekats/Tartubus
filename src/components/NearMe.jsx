import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNearbyStops } from '../hooks/useNearbyStops';
import { useFavorites } from '../hooks/useFavorites';
import { formatDistance, shouldShowDeparture } from '../utils/timeFormatter';
import { getSetting } from '../utils/settings';
import { reverseGeocode } from '../utils/geocoding';
import { getNextStopName } from '../services/digitransit';
import CountdownTimer from './CountdownTimer';
import LocationPermissionInfo from './LocationPermissionInfo';

function NearMe({ onNavigateToMap, manualLocation: manualLocationProp, onClearManualLocation }) {
  const { t } = useTranslation();
  const { location, error: locationError, loading: locationLoading, getLocation, startWatching, stopWatching } = useGeolocation();
  const { stops, loading: stopsLoading, error: stopsError, fetchNearbyStops } = useNearbyStops();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [hasSearched, setHasSearched] = useState(true); // Start as true for auto-trigger
  const [address, setAddress] = useState(t('nearMe.requestingLocation'));
  const [expandedStops, setExpandedStops] = useState(new Map()); // Map of stopId -> expansion level (0=collapsed, 1=medium, 2=full)
  const [expandedDepartures, setExpandedDepartures] = useState(new Set()); // Set of "stopId-departureIdx" keys
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showLocationInfo, setShowLocationInfo] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  // Check if browser will ask for permission (not already granted)
  useEffect(() => {
    const checkPermission = async () => {
      // Check if we've already shown the modal or have permission
      const hasSeenModal = localStorage.getItem('location_modal_seen');

      if (!navigator.permissions) {
        // Permissions API not supported - try to get location directly
        // Only show modal if we haven't seen it before
        if (!hasSeenModal) {
          setShowLocationInfo(true);
        } else {
          // Try to get location, it will either work or fail silently
          getLocation();
          startWatching();
        }
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });

        if (result.state === 'prompt') {
          // Browser will prompt - show our info modal first only if not seen before
          if (!hasSeenModal) {
            setShowLocationInfo(true);
          }
        } else if (result.state === 'granted') {
          // Already granted - proceed directly
          getLocation();
          startWatching();
        } else if (result.state === 'denied') {
          // Permission denied - show button to request again
          setLocationPermissionDenied(true);
        }

        // Listen for permission changes
        result.addEventListener('change', () => {
          if (result.state === 'denied') {
            setLocationPermissionDenied(true);
          } else if (result.state === 'granted') {
            setLocationPermissionDenied(false);
            getLocation();
            startWatching();
          }
        });
      } catch (err) {
        // Fallback if permissions query fails
        if (!hasSeenModal) {
          setShowLocationInfo(true);
        } else {
          getLocation();
          startWatching();
        }
      }
    };

    checkPermission();
  }, []);

  const handleAllowLocation = () => {
    setShowLocationInfo(false);
    localStorage.setItem('location_modal_seen', 'true');
    getLocation();
    startWatching();
  };

  const handleDeclineLocation = () => {
    setShowLocationInfo(false);
    localStorage.setItem('location_modal_seen', 'true');
    // User declined, they can use manual location
  };

  // Detect when GPS location is successfully acquired (not default coordinates)
  useEffect(() => {
    if (location.lat && location.lon && !manualLocationProp) {
      // If we have actual GPS coordinates (user must have granted permission)
      // Check if it's not the default Tartu coordinates
      const isDefaultCoords = Math.abs(location.lat - 58.3776) < 0.0001 && Math.abs(location.lon - 26.7290) < 0.0001;

      if (!isDefaultCoords) {
        // We got real GPS location, permission was granted
        setLocationPermissionDenied(false);
      }
    }
  }, [location.lat, location.lon, manualLocationProp]);

  // Stop watching location when manual location is set
  useEffect(() => {
    if (manualLocationProp) {
      stopWatching();
    } else {
      startWatching();
    }
  }, [manualLocationProp]);

  const handleFindNearby = () => {
    const loc = activeLocation;
    // If we already have location, just refresh the stops
    if (loc.lat && loc.lon) {
      const radius = getSetting('nearbyRadius') || 500;
      // Force refresh to bypass cache and get fresh departure times
      fetchNearbyStops(loc.lat, loc.lon, radius, true);
    } else {
      // Otherwise, get location first
      getLocation();
      setHasSearched(true);
    }
  };

  const handleSetManualLocation = () => {
    setShowLocationPicker(true);
  };

  const handleUseGPS = () => {
    if (onClearManualLocation) {
      onClearManualLocation();
    }
    getLocation();
  };

  const expandStop = (stopId) => {
    setExpandedStops(prev => {
      const newMap = new Map(prev);
      const currentLevel = newMap.get(stopId) || 0;
      newMap.set(stopId, currentLevel + 1);
      return newMap;
    });
  };

  const collapseStop = (stopId) => {
    setExpandedStops(prev => {
      const newMap = new Map(prev);
      newMap.delete(stopId);
      return newMap;
    });
  };

  const toggleDepartureExpanded = (stopId, departureIdx) => {
    const key = `${stopId}-${departureIdx}`;
    setExpandedDepartures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Use manual location if set, otherwise use GPS location
  const activeLocation = manualLocationProp || location;

  // Fetch address when location is available
  useEffect(() => {
    const loc = activeLocation;
    if (loc.lat && loc.lon) {
      reverseGeocode(loc.lat, loc.lon).then(addr => {
        if (addr) {
          setAddress(addr);
        } else {
          setAddress(t('nearMe.noLocation'));
        }
      });
    }
  }, [activeLocation.lat, activeLocation.lon, manualLocationProp]);

  // Fetch stops when location is available
  useEffect(() => {
    const loc = activeLocation;
    if (loc.lat && loc.lon && hasSearched) {
      const radius = getSetting('nearbyRadius') || 500;
      fetchNearbyStops(loc.lat, loc.lon, radius);
    }
  }, [activeLocation.lat, activeLocation.lon, hasSearched, manualLocationProp]);

  // Auto-refresh departure times every 30 seconds
  useEffect(() => {
    const loc = activeLocation;
    if (!loc.lat || !loc.lon) return;

    const interval = setInterval(() => {
      const radius = getSetting('nearbyRadius') || 500;
      // Refresh without force (use cache if available < 2 min old)
      fetchNearbyStops(loc.lat, loc.lon, radius, false);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeLocation.lat, activeLocation.lon, manualLocationProp]);

  const loading = locationLoading || stopsLoading;
  const error = locationError || stopsError;

  return (
    <div className="p-4 pb-48 h-full overflow-y-auto dark:bg-gray-900">
      {/* Location Permission Info Modal */}
      {showLocationInfo && (
        <LocationPermissionInfo
          onAccept={handleAllowLocation}
          onDecline={handleDeclineLocation}
        />
      )}
      {/* Your Location Display */}
      {activeLocation.lat && activeLocation.lon && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100 flex-1 min-w-0">
              <span className="text-lg shrink-0">📍</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  {manualLocationProp ? t('nearMe.manualLocation') : t('nearMe.currentLocation')}
                </div>
                <div className="text-sm font-medium truncate">{address}</div>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {manualLocationProp ? (
                <button
                  onClick={handleUseGPS}
                  className="px-2.5 py-1.5 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap"
                  title={t('nearMe.useGPS')}
                >
                  {t('nearMe.useGPS')}
                </button>
              ) : locationPermissionDenied ? (
                <button
                  onClick={() => {
                    getLocation();
                    startWatching();
                  }}
                  className="px-2.5 py-1.5 text-xs bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors whitespace-nowrap flex items-center gap-1"
                  title={t('nearMe.requestLocation')}
                >
                  <span>📍</span>
                  <span>{t('nearMe.requestLocation')}</span>
                </button>
              ) : null}
              <button
                onClick={handleSetManualLocation}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                title={t('nearMe.setLocation')}
              >
                {t('nearMe.setLocation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Location button when no location available */}
      {!activeLocation.lat && !activeLocation.lon && !loading && (
        <div className="mb-4">
          <button
            onClick={handleSetManualLocation}
            className="w-full bg-blue-600 dark:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('nearMe.setLocation')}
          </button>
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
                  {(() => {
                    const expansionLevel = expandedStops.get(stop.gtfsId) || 0;
                    // Filter out departures that are too far in the past (keep recent ones showing "Arriving")
                    const validDepartures = stop.stoptimesWithoutPatterns.filter(dep =>
                      shouldShowDeparture(dep.scheduledArrival)
                    );
                    const totalDepartures = validDepartures.length;
                    let visibleCount = 3; // Start with 3
                    if (expansionLevel === 1) visibleCount = 8; // Medium expansion
                    if (expansionLevel >= 2) visibleCount = totalDepartures; // Full expansion

                    return validDepartures
                      .slice(0, visibleCount)
                      .map((departure, idx) => {
                        const nextStop = getNextStopName(departure);
                        const departureKey = `${stop.gtfsId}-${idx}`;
                        const isDepartureExpanded = expandedDepartures.has(departureKey);
                        const allStops = departure.trip?.stoptimes || [];
                        const currentStopIndex = allStops.findIndex(st => st.stopPosition === departure.stopPosition);
                        const remainingStops = currentStopIndex >= 0 ? allStops.slice(currentStopIndex + 1) : [];

                        return (
                          <div key={idx} className="border-t border-gray-100 dark:border-gray-700">
                            <button
                              onClick={() => remainingStops.length > 0 && toggleDepartureExpanded(stop.gtfsId, idx)}
                              className={`w-full flex items-center justify-between py-2 text-left ${remainingStops.length > 0 ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'}`}
                              disabled={remainingStops.length === 0}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="bg-primary dark:bg-blue-600 text-white font-bold px-3 py-1 rounded-md text-sm">
                                  {departure.trip?.route?.shortName || '?'}
                                </div>
                                <div className="text-sm flex-1">
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
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-800 dark:text-gray-100">
                                  <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                                </div>
                                {remainingStops.length > 0 && (
                                  <svg className={`w-5 h-5 transition-transform text-blue-600 dark:text-blue-400 ${isDepartureExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                            {isDepartureExpanded && remainingStops.length > 0 && (
                              <div className="pl-12 pr-2 pb-2 text-xs">
                                <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 space-y-1">
                                  <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('nearMe.upcomingStops')}</div>
                                  {remainingStops.slice(0, 10).map((stopTime, sIdx) => (
                                    <div key={sIdx} className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                      <span className="text-gray-400">•</span>
                                      <span>{stopTime.stop?.name || 'Unknown'}</span>
                                    </div>
                                  ))}
                                  {remainingStops.length > 10 && (
                                    <div className="text-gray-500 dark:text-gray-500 italic">
                                      + {t('nearMe.moreStops', { count: remainingStops.length - 10 })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                  })()}
                  {(() => {
                    const expansionLevel = expandedStops.get(stop.gtfsId) || 0;
                    const totalDepartures = stop.stoptimesWithoutPatterns.length;

                    if (totalDepartures <= 3) return null; // No buttons needed

                    if (expansionLevel === 0) {
                      // Collapsed - show "Show more" button
                      return (
                        <button
                          onClick={() => expandStop(stop.gtfsId)}
                          className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2 border-t border-gray-100 dark:border-gray-700"
                        >
                          {`··· ${t('nearMe.showMore')} (${Math.min(5, totalDepartures - 3)})`}
                        </button>
                      );
                    } else if (expansionLevel === 1 && totalDepartures > 8) {
                      // Medium - show both "Show more" and "Show less"
                      return (
                        <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                          <button
                            onClick={() => collapseStop(stop.gtfsId)}
                            className="flex-1 text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-2"
                          >
                            − {t('nearMe.showLess')}
                          </button>
                          <button
                            onClick={() => expandStop(stop.gtfsId)}
                            className="flex-1 text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2"
                          >
                            {`··· ${t('nearMe.showAll')} (${totalDepartures - 8})`}
                          </button>
                        </div>
                      );
                    } else {
                      // Fully expanded or medium with <= 8 total - just show "Show less"
                      return (
                        <button
                          onClick={() => collapseStop(stop.gtfsId)}
                          className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-2 border-t border-gray-100 dark:border-gray-700"
                        >
                          − {t('nearMe.showLess')}
                        </button>
                      );
                    }
                  })()}
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

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('nearMe.setLocationTitle')}</h2>
              <button
                onClick={() => setShowLocationPicker(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('nearMe.setLocationDescription')}
            </p>
            <button
              onClick={() => {
                setShowLocationPicker(false);
                onNavigateToMap({ selectLocation: true });
              }}
              className="w-full bg-blue-600 dark:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors mb-3"
            >
              {t('nearMe.pickOnMap')}
            </button>
            <button
              onClick={() => setShowLocationPicker(false)}
              className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('nearMe.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NearMe;
