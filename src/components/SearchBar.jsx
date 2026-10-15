import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { forwardGeocode } from '../utils/geocoding';
import { searchRouteByNumber } from '../services/digitransit';
import { useTranslation } from 'react-i18next';
import BusIcon from './BusIcon';

// Address / route search at the bottom of the screen, right above the tab bar (or the keyboard)
function SearchBar({ onDestinationSelect, onRouteSelect, routeSearchZone, keyboardOpen }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [listMaxHeight, setListMaxHeight] = useState(null);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchRequestRef = useRef(0);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The results pop up from the field: they may use the space between the top header and the field
  const listOpen = showResults && searchResults.length > 0;
  useLayoutEffect(() => {
    if (!listOpen) return;
    const measure = () => {
      const field = searchRef.current?.getBoundingClientRect();
      if (!field) return;
      const header = document.querySelector('header')?.getBoundingClientRect();
      const top = Math.max(header?.bottom ?? 0, window.visualViewport?.offsetTop ?? 0);
      setListMaxHeight(Math.max(0, Math.floor(field.top - top - 8)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [listOpen, keyboardOpen]);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Check if query is just a number (route search)
    const isRouteNumber = /^\d+[a-zA-Z]?$/.test(searchQuery.trim());

    // Addresses need at least 2 characters; route numbers can be a single digit (routes 1-9)
    if (searchQuery.trim().length < (isRouteNumber ? 1 : 2)) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      // An address search can take two round trips (In-ADS, then Nominatim), so a
      // slower earlier query must not overwrite a newer one's results
      const requestId = ++searchRequestRef.current;
      setIsSearching(true);

      if (isRouteNumber) {
        // Search for bus route in the city zone the map shows (Tartu until the map is opened)
        const routes = await searchRouteByNumber(searchQuery.trim(), routeSearchZone);
        if (requestId !== searchRequestRef.current) return;

        const routeResults = routes.map(route => ({
          type: 'route',
          routeNumber: route.shortName,
          routeName: route.longName,
          patterns: route.patterns,
          gtfsId: route.gtfsId
        }));
        setSearchResults(routeResults);
        setShowResults(routeResults.length > 0);
      } else {
        // Search for address
        // The Land Board's rows show up at once; the spinner stays until the list is complete
        const results = await forwardGeocode(searchQuery, (partial) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResults(partial.map(r => ({ ...r, type: 'address' })));
          setShowResults(true);
        });
        if (requestId !== searchRequestRef.current) return;

        const addressResults = results.map(r => ({ ...r, type: 'address' }));
        setSearchResults(addressResults);
        setShowResults(addressResults.length > 0);
      }

      setIsSearching(false);
    }, 500); // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, routeSearchZone]);

  const handleResultClick = (result) => {
    if (result.type === 'route') {
      // Handle route selection
      onRouteSelect(result);
    } else {
      // Handle address selection
      onDestinationSelect({
        lat: result.lat,
        lon: result.lon,
        name: result.name,
        display_name: result.display_name,
        isPlace: !!result.isPlace
      });
    }
    // A search still filling in must not reopen the dropdown after this
    searchRequestRef.current++;
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    // Close the keyboard so the picked place can be seen
    inputRef.current?.blur();
  };

  return (
    <div ref={searchRef} data-keyboard-anchor className="relative h-[var(--search-bar-height)] px-2 flex items-center bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 transition-colors">
      <div className="relative flex-1 min-w-0">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder={t('header.searchAddress') || 'Search address...'}
          // Room on the right only while the clear button / spinner is there, so the
          // placeholder isn't cut off 40 px early
          className={`w-full pl-10 py-2 ${searchQuery ? 'pr-10' : 'pr-3'} text-sm text-ellipsis rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-500 transition-all`}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        {!isSearching && searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search results, popping up from the field. The best result is closest to the field
          (column-reverse), so rows filled in later land above and the shown ones don't move */}
      {listOpen && (
        <div
          className="absolute bottom-full left-2 right-2 mb-1 flex flex-col-reverse bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-y-auto"
          style={listMaxHeight !== null ? { maxHeight: listMaxHeight } : undefined}
        >
          {searchResults.map((result, index) => (
            <button
              key={index}
              onClick={() => handleResultClick(result)}
              className="flex-shrink-0 w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 first:border-b-0"
            >
              {result.type === 'route' ? (
                // Route result
                <div className="flex items-start gap-2">
                  <BusIcon className="h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {t('common.route')} {result.routeNumber}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {result.routeName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {result.patterns?.length || 0} {result.patterns?.length === 1 ? t('header.direction') : t('header.directions')}
                    </p>
                  </div>
                </div>
              ) : (
                // Address result
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {result.name || result.display_name}
                    </p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
