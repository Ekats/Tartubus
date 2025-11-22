import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../hooks/useFavorites';
import { getNextStopName, getDailyTimetable } from '../services/digitransit';
import { shouldShowDeparture, isDepartureLate, getDelayInfo, formatClockTime } from '../utils/timeFormatter';
import CountdownTimer from './CountdownTimer';

/**
 * Reusable StopCard component used in NearMe, Favorites, and StopFinder (map overlay)
 * Displays stop info, departures, and action buttons in a consistent way
 */
export default function StopCard({
  stop,
  distance,
  walkingTime,
  onNavigateToMap,
  showMapButton = true,
  variant = 'card', // 'card' | 'overlay'
}) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [expandedDepartures, setExpandedDepartures] = useState(new Set());
  const [expansionLevel, setExpansionLevel] = useState(0); // 0=3 items, 1=8 items, 2=all
  const [showTimetable, setShowTimetable] = useState(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  const toggleDepartureExpanded = (stopId, idx) => {
    const key = `${stopId}-${idx}`;
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

  const handleShowTimetable = async (stop) => {
    setLoadingTimetable(true);
    try {
      const timetable = await getDailyTimetable(stop.gtfsId);
      setShowTimetable({ stop, timetable });
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoadingTimetable(false);
    }
  };

  const expandStop = () => {
    if (expansionLevel === 0) setExpansionLevel(1);
    else if (expansionLevel === 1) setExpansionLevel(2);
  };

  const collapseStop = () => {
    if (expansionLevel === 2) setExpansionLevel(1);
    else if (expansionLevel === 1) setExpansionLevel(0);
  };

  // Filter valid departures
  const validDepartures = stop.stoptimesWithoutPatterns?.filter(dep =>
    shouldShowDeparture(dep.scheduledArrival, {
      realtimeArrival: dep.realtimeArrival,
      realtime: dep.realtime
    })
  ) || [];

  const totalDepartures = validDepartures.length;
  let visibleCount = 3;
  if (expansionLevel === 1) visibleCount = 8;
  if (expansionLevel >= 2) visibleCount = totalDepartures;

  const isOverlay = variant === 'overlay';
  const cardClasses = isOverlay
    ? ''
    : 'bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-gray-700';

  return (
    <>
      <div className={cardClasses}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold truncate ${isOverlay ? 'text-lg' : 'text-lg'} text-gray-800 dark:text-gray-100`}>
              {stop.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stop {stop.code}
              {distance !== undefined && distance !== Infinity && (
                <>
                  {' • '}
                  {walkingTime ? (
                    <span className="text-blue-600 dark:text-blue-400">
                      🚶 {Math.round(walkingTime.distance)}m (~{Math.ceil(walkingTime.duration / 60)} min)
                    </span>
                  ) : (
                    <span>{Math.round(distance)}m</span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(stop)}
              className={`rounded-full p-2 transition-colors ${
                isFavorite(stop.gtfsId)
                  ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-400 hover:text-yellow-500 dark:text-gray-500'
              }`}
              title={isFavorite(stop.gtfsId) ? t('favorites.removeFromFavorites') : t('favorites.addToFavorites')}
            >
              <svg className="h-6 w-6" fill={isFavorite(stop.gtfsId) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <button
              onClick={() => handleShowTimetable(stop)}
              className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-full p-2 transition-colors"
              title={t('nearMe.viewTimetable')}
              disabled={loadingTimetable}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </button>
            {showMapButton && onNavigateToMap && (
              <button
                onClick={() => onNavigateToMap(stop)}
                className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                title={t('nearMe.showOnMap')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Departures */}
        {validDepartures.length > 0 ? (
          <div className="space-y-2">
            {validDepartures.slice(0, visibleCount).map((departure, idx) => {
              const nextStop = getNextStopName(departure);
              const departureKey = `${stop.gtfsId}-${idx}`;
              const isDepartureExpanded = expandedDepartures.has(departureKey);
              const allStops = departure.trip?.stoptimes || [];
              const currentStopIndex = allStops.findIndex(st => st.stopPosition === departure.stopPosition);
              const remainingStops = currentStopIndex >= 0 ? allStops.slice(currentStopIndex + 1) : [];
              const realtimeData = {
                realtimeArrival: departure.realtimeArrival,
                realtime: departure.realtime,
                arrivalDelay: departure.arrivalDelay
              };
              const isLate = isDepartureLate(departure.scheduledArrival, realtimeData);
              const delayInfo = getDelayInfo(departure.scheduledArrival, realtimeData);

              return (
                <div key={idx} className={`border-t border-gray-100 dark:border-gray-700 ${isLate ? 'opacity-60' : ''}`}>
                  <button
                    onClick={() => remainingStops.length > 0 && toggleDepartureExpanded(stop.gtfsId, idx)}
                    className={`w-full flex items-center justify-between py-2 text-left ${remainingStops.length > 0 ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'}`}
                    disabled={remainingStops.length === 0}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`${isLate ? 'bg-gray-400 dark:bg-gray-600' : 'bg-blue-600 dark:bg-blue-600'} text-white font-bold px-3 py-1 rounded-md text-sm`}>
                        {departure.trip?.route?.shortName || '?'}
                      </div>
                      <div className="text-sm flex-1">
                        <div className={`${isLate ? 'text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          {departure.headsign || 'Unknown destination'}
                        </div>
                        {nextStop && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            → {nextStop}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <div className={`font-semibold ${isLate ? 'text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                          <CountdownTimer
                            scheduledArrival={departure.scheduledArrival}
                            realtimeData={realtimeData}
                          />
                        </div>
                        {delayInfo && (
                          <span className={`text-xs ${delayInfo.isLate ? 'text-red-500' : 'text-green-600'}`}>
                            {delayInfo.isLate ? `+${delayInfo.minutes}m` : `-${delayInfo.minutes}m`}
                          </span>
                        )}
                      </div>
                      {remainingStops.length > 0 && (
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isDepartureExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Expanded upcoming stops */}
                  {isDepartureExpanded && remainingStops.length > 0 && (
                    <div className="pl-4 pb-2 space-y-1">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        {t('nearMe.upcomingStops')}:
                      </p>
                      {remainingStops.map((upcomingStop, stopIdx) => (
                        <div key={stopIdx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="text-gray-400">•</span>
                          <span className="flex-1">{upcomingStop.stop?.name || 'Unknown'}</span>
                          <span className="text-gray-500 dark:text-gray-500">
                            {formatClockTime(upcomingStop.scheduledArrival)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Expansion buttons */}
            {totalDepartures > 3 && (
              <div className="pt-2">
                {expansionLevel === 0 && (
                  <button
                    onClick={expandStop}
                    className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 py-2 border-t border-gray-200 dark:border-gray-700"
                  >
                    {`··· ${t('nearMe.showMore')} (${Math.min(5, totalDepartures - 3)})`}
                  </button>
                )}
                {expansionLevel === 1 && totalDepartures > 8 && (
                  <div className="flex gap-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                    <button
                      onClick={collapseStop}
                      className="flex-1 text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 py-2"
                    >
                      − {t('nearMe.showLess')}
                    </button>
                    <button
                      onClick={expandStop}
                      className="flex-1 text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 py-2"
                    >
                      {`··· ${t('nearMe.showAll')} (${totalDepartures - 8})`}
                    </button>
                  </div>
                )}
                {expansionLevel === 2 && (
                  <button
                    onClick={collapseStop}
                    className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 py-2 border-t border-gray-200 dark:border-gray-700"
                  >
                    − {t('nearMe.showLess')}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            {t('nearMe.noDepartures')}
          </p>
        )}
      </div>

      {/* Timetable Modal */}
      {showTimetable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-[3000] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold">{showTimetable.stop.name}</h2>
              <p className="text-sm text-blue-100">
                Stop {showTimetable.stop.code} • {t('nearMe.dailyTimetable')}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {showTimetable.timetable.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(
                    showTimetable.timetable.reduce((groups, dep) => {
                      const route = dep.trip?.route?.shortName || '?';
                      if (!groups[route]) groups[route] = [];
                      groups[route].push(dep);
                      return groups;
                    }, {})
                  ).map(([route, departures]) => (
                    <div key={route} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                      <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">
                        Route {route}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {departures.map((dep, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-1 rounded text-sm"
                          >
                            {formatClockTime(dep.scheduledArrival)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('nearMe.noTimetableData')}
                </p>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowTimetable(null)}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
