import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import et from './locales/et.json';
import en from './locales/en.json';

// Get saved language or detect browser language, default to Estonian
const getSavedLanguage = () => {
  const saved = localStorage.getItem('language');
  console.log('🌐 Saved language from localStorage:', saved);
  if (saved) return saved;

  // Check browser language - if it's English, use English, otherwise default to Estonian
  const browserLang = navigator.language.split('-')[0];
  console.log('🌐 Browser language detected:', browserLang);
  const selectedLang = browserLang === 'en' ? 'en' : 'et';
  console.log('🌐 Using language:', selectedLang);
  return selectedLang;
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      et: { translation: et },
      en: { translation: en },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'et', // Default to Estonian
    interpolation: {
      escapeValue: false,
    },
  });

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  document.documentElement.lang = lng;
});

export default i18n;
