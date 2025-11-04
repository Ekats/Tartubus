import { useTranslation } from 'react-i18next';

function LocationPermissionInfo({ onAccept, onDecline }) {
  const { t } = useTranslation();

  // Helper to render text with GitHub link
  const renderWithGitHubLink = (text) => {
    const parts = text.split(/<github>|<\/github>/);
    if (parts.length === 3) {
      return (
        <>
          {parts[0]}
          <a
            href="https://github.com/ekats/Tartubus"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-800 dark:text-green-300 underline hover:text-green-900 dark:hover:text-green-200 font-semibold"
          >
            {parts[1]}
          </a>
          {parts[2]}
        </>
      );
    }
    return text;
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[2000] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-200 dark:border-gray-700 my-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">📍</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            {t('locationInfo.title') || 'Location Permission'}
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-700 dark:text-gray-300 text-center">
            {t('locationInfo.description') || 'We need your location to show you nearby bus stops and live departure times.'}
          </p>

          {/* Privacy & Safety Info */}
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-800 dark:text-green-400 flex items-center gap-2">
              <span>🔒</span>
              <span>{t('locationInfo.privacyTitle') || 'Your Privacy is Safe'}</span>
            </h3>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <p>• {t('locationInfo.noTracking') || 'No tracking or data collection'}</p>
              <p>• {t('locationInfo.neverStored') || 'Your location is never stored or sent to servers'}</p>
              <p>• {t('locationInfo.localOnly') || 'Used only on your device for finding nearby stops'}</p>
              <p>• {renderWithGitHubLink(t('locationInfo.openSource') || 'Fully open source - see the code yourself')}</p>
            </div>
          </div>

          {/* What happens if declined */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('locationInfo.canDecline') || "You can decline and set your location manually on the map if preferred."}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onAccept}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {t('locationInfo.allow') || 'Allow Location Access'}
          </button>
          <button
            onClick={onDecline}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {t('locationInfo.decline') || 'Use Manual Location'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationPermissionInfo;
