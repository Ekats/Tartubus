import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSettings, updateSetting } from '../utils/settings';
import Feedback from './Feedback';

function Settings() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState(getSettings());
  const [saved, setSaved] = useState(false);

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
        </div>

        {/* Version info */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pb-4">
          Tartu Bussid v0.1.0
        </div>
      </div>
    </div>
  );
}

export default Settings;
