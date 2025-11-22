import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function AndroidAppPrompt() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if running on Android browser (not in Capacitor app)
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isCapacitor = window.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNative;
    const dismissed = localStorage.getItem('android_app_prompt_dismissed');

    if (isAndroid && !isCapacitor && !dismissed) {
      // Show after a short delay
      setTimeout(() => setShow(true), 2000);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('android_app_prompt_dismissed', 'true');
  };

  const handleGetApp = () => {
    window.open('https://play.google.com/store/apps/details?id=ee.tartu.bussid', '_blank');
    handleDismiss();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">📱</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t('androidPrompt.title', 'Get the App')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('androidPrompt.description', 'Tartu Bussid is available on Google Play. Get faster performance and offline support!')}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleGetApp}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              {t('androidPrompt.getApp', 'Get on Google Play')}
            </button>

            <button
              onClick={handleDismiss}
              className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {t('androidPrompt.dismiss', 'Continue in browser')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
