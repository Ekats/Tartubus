import { useState, useEffect, useRef } from 'react';
import { forwardGeocode } from '../utils/geocoding';
import { searchRouteByNumber } from '../services/digitransit';
import { useTranslation } from 'react-i18next';

function Header({ isDarkMode, toggleDarkMode, onDestinationSelect, onRouteSelect, customTime, onTimePickerOpen }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

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

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);

      // Check if query is just a number (route search)
      const isRouteNumber = /^\d+[a-zA-Z]?$/.test(searchQuery.trim());

      if (isRouteNumber) {
        // Search for bus route
        const routes = await searchRouteByNumber(searchQuery.trim());
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
        const results = await forwardGeocode(searchQuery);
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
  }, [searchQuery]);

  const handleResultClick = (result) => {
    if (result.type === 'route') {
      // Handle route selection
      onRouteSelect(result);
    } else {
      // Handle address selection
      onDestinationSelect({
        lat: result.lat,
        lon: result.lon,
        display_name: result.display_name
      });
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <header className="bg-primary dark:bg-gray-800 text-white shadow-lg z-[1100] relative transition-colors">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Logo */}
        <span className="text-2xl flex-shrink-0">🚌</span>

        {/* Address Search Bar */}
        <div ref={searchRef} className="flex-1 relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder={t('header.searchAddress') || 'Search address...'}
              className="w-full px-4 py-2 pr-10 rounded-lg bg-white/10 dark:bg-gray-700 text-white placeholder-white/60 dark:placeholder-gray-400 border border-white/20 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-white/30 dark:focus:ring-blue-500 transition-all"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto z-50">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  {result.type === 'route' ? (
                    // Route result
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
                      </svg>
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
                          {result.display_name}
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Time Picker Button */}
        <button
          onClick={onTimePickerOpen}
          className={`p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 ${customTime ? 'text-blue-300' : ''}`}
          title={customTime ? t('timePicker.customTimeActive') : t('timePicker.planAhead')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

export default Header;
