import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSettings, updateSetting } from '../utils/settings';
import { updateRoutesFromGitHub, getRoutesVersionInfo, clearDownloadedRoutes } from '../services/digitransit';
import Feedback from './Feedback';

function Settings() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState(getSettings());
  const [saved, setSaved] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [routesInfo, setRoutesInfo] = useState(getRoutesVersionInfo());
  const [updatingRoutes, setUpdatingRoutes] = useState(false);
  const [routesUpdateError, setRoutesUpdateError] = useState(null);
  const [routesExpanded, setRoutesExpanded] = useState(false);
  const [cacheExpanded, setCacheExpanded] = useState(false);

  const radiusOptions = [
    { value: 300, label: `300m - ${t('settings.veryClose')}` },
    { value: 500, label: `500m - ${t('settings.default')}` },
    { value: 800, label: `800m - ${t('settings.nearby')}` },
    { value: 1000, label: `1km - ${t('settings.extended')}` },
    { value: 1500, label: `1.5km - ${t('settings.wideArea')}` },
    { value: 2000, label: `2km - ${t('settings.veryWide')}` },
  ];

  const handleRadiusChange = (e) => {
    const newRadius = parseInt(e.target.value);
    setSettings({ ...settings, nearbyRadius: newRadius });
    updateSetting('nearbyRadius', newRadius);

    // Show saved message
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSoftClearCache = () => {
    if (window.confirm(t('settings.softClearConfirm') || 'Clear cached data? Your favorites and settings will be preserved.')) {
      // Clear all cache except preserved keys
      const preserveKeys = [
        'tartu_bus_favorites',
        'tartu-bus-settings',
        'darkMode',
        'i18nextLng',
        'app_build_hash',
        'cache_soft_clear_version',
        'cache_full_clear_version'
      ];

      const preserved = {};
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          preserved[key] = value;
        }
      });

      // Clear everything
      localStorage.clear();

      // Restore preserved data
      Object.entries(preserved).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      setCacheCleared(true);
      setTimeout(() => {
        setCacheCleared(false);
        // Reload page to reinitialize caches
        window.location.reload();
      }, 1500);
    }
  };

  const handleFullClearCache = () => {
    if (window.confirm(t('settings.fullClearConfirm') || '⚠️ WARNING: This will delete EVERYTHING including your favorites and settings! Are you sure?')) {
      if (window.confirm(t('settings.fullClearConfirm2') || 'This action cannot be undone. Delete all data?')) {
        // Nuclear option - clear absolutely everything
        localStorage.clear();

        setCacheCleared(true);
        setTimeout(() => {
          setCacheCleared(false);
          // Reload page to reinitialize caches
          window.location.reload();
        }, 1500);
      }
    }
  };

  const handleUpdateRoutes = async () => {
    setUpdatingRoutes(true);
    setRoutesUpdateError(null);

    try {
      const result = await updateRoutesFromGitHub();
      setRoutesInfo(getRoutesVersionInfo());
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        // Reload to use new routes
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to update routes:', error);
      setRoutesUpdateError(error.message);
      setUpdatingRoutes(false);
    }
  };

  const handleClearDownloadedRoutes = () => {
    if (window.confirm(t('settings.clearRoutesConfirm') || 'Revert to bundled routes? Downloaded routes will be deleted.')) {
      clearDownloadedRoutes();
      setRoutesInfo(getRoutesVersionInfo());
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-4 pb-48 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('settings.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.description')}</p>
        </div>

        {/* Language Setting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('settings.language')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings.languageDescription')}
            </p>
          </div>

          <div className="space-y-3">
            <label
              className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <input
                type="radio"
                name="language"
                value="et"
                checked={i18n.language === 'et'}
                onChange={() => handleLanguageChange('et')}
                className="w-4 h-4 text-primary focus:ring-primary"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">🇪🇪 {t('settings.estonian')}</span>
            </label>
            <label
              className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <input
                type="radio"
                name="language"
                value="en"
                checked={i18n.language === 'en'}
                onChange={() => handleLanguageChange('en')}
                className="w-4 h-4 text-primary focus:ring-primary"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">🇬🇧 {t('settings.english')}</span>
            </label>
            <label
              className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <input
                type="radio"
                name="language"
                value="uk"
                checked={i18n.language === 'uk'}
                onChange={() => handleLanguageChange('uk')}
                className="w-4 h-4 text-primary focus:ring-primary"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">🇺🇦 {t('settings.ukrainian')}</span>
            </label>
            <label
              className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <input
                type="radio"
                name="language"
                value="ru"
                checked={i18n.language === 'ru'}
                onChange={() => handleLanguageChange('ru')}
                className="w-4 h-4 text-primary focus:ring-primary"
              />
              <span className="ml-3 text-gray-700 dark:text-gray-300">🇷🇺 {t('settings.russian')}</span>
            </label>
          </div>
        </div>

        {/* Nearby Radius Setting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('settings.nearbyRadius')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings.nearbyRadiusDescription')}
            </p>
          </div>

          <div className="space-y-3">
            {radiusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="radio"
                  name="radius"
                  value={option.value}
                  checked={settings.nearbyRadius === option.value}
                  onChange={handleRadiusChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="ml-3 text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Saved indicator */}
          {saved && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <span>✓</span>
              <span>Settings saved automatically</span>
            </div>
          )}
        </div>

        {/* Feedback Section */}
        <Feedback />

        {/* Support Section */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">☕</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('settings.supportUs')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.supportDescription')}
              </p>
            </div>
          </div>
          <a
            href="https://ko-fi.com/ekats"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 text-center shadow-lg"
          >
            ☕ {t('settings.buyMeACoffee')}
          </a>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            <span>{t('settings.aboutApp')}</span>
          </h3>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>• {t('settings.privacyFocused')}</p>
            <p>• {t('settings.usesDigitransit')}</p>
            <p>• {t('settings.usesOSM')}</p>
            <p>• {t('settings.localSettings')}</p>
          </div>

          {/* GitHub Stars Badge */}
          <div className="mt-4 flex justify-center">
            <a
              href="https://github.com/ekats/Tartubus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img
                src="https://img.shields.io/github/stars/ekats/Tartubus?style=social"
                alt="GitHub stars"
                className="h-5"
              />
            </a>
          </div>
        </div>

        {/* Advanced: Route Data Update (Collapsible) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setRoutesExpanded(!routesExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🚌</span>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {t('settings.routeData') || 'Route Data Update'}
              </h2>
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-xl">
              {routesExpanded ? '▼' : '▶'}
            </span>
          </button>

          {routesExpanded && (
            <div className="p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.routeDataDescription') || 'Update route information to get the latest bus routes and stops.'}
              </p>

              {/* Current version info */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('settings.dataSource') || 'Data Source'}:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {routesInfo.source === 'downloaded' ? (t('settings.downloaded') || 'Downloaded') : (t('settings.bundled') || 'Bundled')}
                    </span>
                  </div>
                  {routesInfo.lastUpdated && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('settings.lastUpdated') || 'Last Updated'}:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {new Date(routesInfo.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {routesInfo.routeCount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('settings.routes') || 'Routes'}:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {routesInfo.routeCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Update button */}
              <button
                onClick={handleUpdateRoutes}
                disabled={updatingRoutes}
                className="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {updatingRoutes ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>{t('settings.updating') || 'Updating...'}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{t('settings.updateRoutes') || 'Update Routes'}</span>
                  </>
                )}
              </button>

              {/* Clear downloaded routes button */}
              {routesInfo.source === 'downloaded' && (
                <button
                  onClick={handleClearDownloadedRoutes}
                  className="mt-3 w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {t('settings.revertToBundled') || 'Revert to Bundled Data'}
                </button>
              )}

              {/* Error message */}
              {routesUpdateError && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                  <p className="font-medium">{t('settings.updateFailed') || 'Update failed'}:</p>
                  <p>{routesUpdateError}</p>
                </div>
              )}

              {/* Info note */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-medium">ℹ️ {t('settings.note') || 'Note'}:</span> {t('settings.routeUpdateNote') || 'Routes are automatically updated nightly on GitHub. Download size is approximately 60 MB.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Advanced: Cache Management (Collapsible) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setCacheExpanded(!cacheExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🗑️</span>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {t('settings.cacheManagement') || 'Cache Management'}
              </h2>
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-xl">
              {cacheExpanded ? '▼' : '▶'}
            </span>
          </button>

          {cacheExpanded && (
            <div className="p-6 pt-0 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.cacheDescription') || 'Clear cached data if you experience issues.'}
              </p>

              <div className="space-y-3">
                {/* Soft Clear Button */}
                <button
                  onClick={handleSoftClearCache}
                  className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🧹</span>
                  <span>{t('settings.softClear') || 'Soft Clear (Keep Favorites)'}</span>
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {t('settings.softClearDesc') || 'Clears cache but preserves favorites and settings'}
                </p>

                {/* Full Clear Button */}
                <button
                  onClick={handleFullClearCache}
                  className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>💥</span>
                  <span>{t('settings.fullClear') || 'Full Clear (Delete Everything)'}</span>
                </button>
                <p className="text-xs text-red-600 dark:text-red-400 text-center font-medium">
                  ⚠️ {t('settings.fullClearDesc') || 'WARNING: Deletes favorites, settings, everything!'}
                </p>
              </div>

              {cacheCleared && (
                <div className="mt-3 bg-green-100 dark:bg-green-900/30 border border-green-500 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-2 rounded-lg text-sm text-center">
                  ✅ {t('settings.cacheCleared') || 'Cache cleared! Reloading...'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Version info */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pb-4">
          Tartu Bussid v1.5.0
        </div>
      </div>
    </div>
  );
}

export default Settings;
