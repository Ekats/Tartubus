import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRouteShortNamesInZone } from '../services/digitransit';
import { sortRouteNames } from '../utils/routeFilter';

// The route filter menu, opened from the header's filter button on every tab. It lists the routes
// serving the map's city zone (plus any picked ones, so they can always be unpicked)
function RouteFilterMenu({ zone, selectedRoutes, onToggleRoute, onClear }) {
  const { t } = useTranslation();
  const [zoneRouteNames, setZoneRouteNames] = useState([]);

  // Filled from the bundled route data when opened (loaded lazily: the route file is large)
  useEffect(() => {
    let cancelled = false;
    getRouteShortNamesInZone(zone)
      .then(names => { if (!cancelled) setZoneRouteNames(names); })
      .catch(err => console.error('Error loading routes for filter:', err));
    return () => { cancelled = true; };
  }, [zone]);

  const sortedRoutes = sortRouteNames(new Set([...zoneRouteNames, ...selectedRoutes]));

  return (
    <div className="absolute top-4 left-4 right-4 z-[1050] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700" data-testid="route-filter-menu">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t('map.filterRoutes')}</h3>
        {selectedRoutes.size > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            {t('map.clearFilters')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {sortedRoutes.map(route => (
          <button
            key={route}
            onClick={() => onToggleRoute(route)}
            className={`px-3 py-2 rounded-md text-sm font-bold transition-colors ${
              selectedRoutes.has(route)
                ? 'bg-primary dark:bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {route}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RouteFilterMenu;
