import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../hooks/useFavorites';
import { getStopById, getNextStopName } from '../services/digitransit';
import { shouldShowDeparture } from '../utils/timeFormatter';
import CountdownTimer from './CountdownTimer';

function Favorites({ onNavigateToMap }) {
  const { t } = useTranslation();
  const { favorites, removeFavorite, clearAllFavorites } = useFavorites();
  const [stopsWithDepartures, setStopsWithDepartures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedStops, setExpandedStops] = useState(new Map()); // Map of stopId -> expansion level
  const [expandedDepartures, setExpandedDepartures] = useState(new Set()); // Set of "stopId-departureIdx" keys

  // Fetch departure times for all favorite stops
  const fetchDepartures = async () => {
    if (favorites.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch departures for each favorite stop by querying the specific stop ID
      const stopsData = await Promise.all(
        favorites.map(async (favorite) => {
          try {
            // Query the specific stop by its gtfsId
            const stopWithDepartures = await getStopById(favorite.gtfsId);

            if (stopWithDepartures) {
              return stopWithDepartures;
            } else {
              // If stop not found (API error or stop removed), return favorite with empty departures
              console.warn(`Stop ${favorite.gtfsId} (${favorite.name}) not found`);
              return {
                ...favorite,
                stoptimesWithoutPatterns: [],
              };
            }
          } catch (err) {
            console.error(`Error fetching departures for ${favorite.name}:`, err);
            return {
              ...favorite,
              stoptimesWithoutPatterns: [],
              error: true,
            };
          }
        })
      );

      setStopsWithDepartures(stopsData);
    } catch (err) {
      console.error('Error fetching favorite stops:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch departures on mount and when favorites change
  useEffect(() => {
    fetchDepartures();
  }, [favorites.length]); // Re-fetch when favorites list changes

  // Auto-refresh departure times every 30 seconds
  useEffect(() => {
    if (favorites.length === 0) return;

    const interval = setInterval(() => {
      fetchDepartures();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [favorites.length]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchDepartures();
  };

  // Handle delete with confirmation
  const handleDelete = (stop) => {
    if (window.confirm(`Remove "${stop.name}" from favorites?`)) {
      removeFavorite(stop.gtfsId);
    }
  };

  // Handle clear all with confirmation
  const handleClearAll = () => {
    if (window.confirm(`Remove all ${favorites.length} favorite stops?`)) {
      clearAllFavorites();
    }
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

  // Empty state
  if (favorites.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 dark:bg-gray-900 px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">⭐</div>
          <div className="text-xl font-semibold mb-2">{t('favorites.noFavorites')}</div>
          <div className="text-sm">
            {t('favorites.addFromMap')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto dark:bg-gray-900 p-4 pb-48">
      {/* Header with refresh and clear buttons */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          ⭐ Favorite Stops ({favorites.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {favorites.length > 1 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Favorite stops list */}
      <div className="space-y-4">
        {stopsWithDepartures.map((stop) => (
          <div
            key={stop.gtfsId}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-gray-700"
          >
            {/* Stop header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
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
                  {stop.error && (
                    <span className="text-xs text-red-500 dark:text-red-400">⚠️</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Stop {stop.code}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onNavigateToMap(stop)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title="View on map"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(stop)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Remove from favorites"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Departures */}
            {stop.stoptimesWithoutPatterns && stop.stoptimesWithoutPatterns.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Next Buses:
                </p>
                {(() => {
                  const expansionLevel = expandedStops.get(stop.gtfsId) || 0;
                  // Filter out departures that are too far in the past
                  const validDepartures = stop.stoptimesWithoutPatterns.filter(dep =>
                    shouldShowDeparture(dep.scheduledArrival)
                  );
                  const totalDepartures = validDepartures.length;
                  let visibleCount = 3;
                  if (expansionLevel === 1) visibleCount = 8;
                  if (expansionLevel >= 2) visibleCount = totalDepartures;

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
                        <div key={idx}>
                          <button
                            onClick={() => remainingStops.length > 0 && toggleDepartureExpanded(stop.gtfsId, idx)}
                            className={`w-full flex items-center justify-between gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-left ${remainingStops.length > 0 ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : 'cursor-default'}`}
                            disabled={remainingStops.length === 0}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="bg-blue-600 dark:bg-blue-500 text-white px-2.5 py-1 rounded font-bold text-sm shrink-0">
                                {departure.trip?.route?.shortName || '?'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                  {departure.headsign || 'Unknown'}
                                </div>
                                {nextStop && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    → {nextStop}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                <CountdownTimer scheduledArrival={departure.scheduledArrival} />
                              </span>
                              {remainingStops.length > 0 && (
                                <svg className={`w-5 h-5 transition-transform text-blue-600 dark:text-blue-400 ${isDepartureExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          {isDepartureExpanded && remainingStops.length > 0 && (
                            <div className="pl-12 pr-2 pb-2 mt-1 text-xs">
                              <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 space-y-1">
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

                  if (totalDepartures <= 3) return null;

                  if (expansionLevel === 0) {
                    return (
                      <button
                        onClick={() => expandStop(stop.gtfsId)}
                        className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2"
                      >
                        {`··· ${t('nearMe.showMore')} (${Math.min(5, totalDepartures - 3)})`}
                      </button>
                    );
                  } else if (expansionLevel === 1 && totalDepartures > 8) {
                    return (
                      <div className="flex gap-2 pt-2">
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
                    return (
                      <button
                        onClick={() => collapseStop(stop.gtfsId)}
                        className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-2"
                      >
                        − {t('nearMe.showLess')}
                      </button>
                    );
                  }
                })()}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                {stop.error ? 'Failed to load departures' : 'No upcoming departures'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Favorites;
