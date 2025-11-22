import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import et from './locales/et.json';
import en from './locales/en.json';
import uk from './locales/uk.json';
import ru from './locales/ru.json';

// Get saved language or detect browser language, default to English for unsupported languages
const getSavedLanguage = () => {
  const saved = localStorage.getItem('language');
  console.log('🌐 Saved language from localStorage:', saved);
  if (saved) return saved;

  // Check browser language - detect Estonian, Ukrainian, Russian, or default to English
  const browserLang = navigator.language.split('-')[0];
  console.log('🌐 Browser language detected:', browserLang);
  const supportedLanguages = ['et', 'en', 'uk', 'ru'];
  let selectedLang = supportedLanguages.includes(browserLang) ? browserLang : 'en';
  console.log('🌐 Using language:', selectedLang);
  return selectedLang;
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      et: { translation: et },
      en: { translation: en },
      uk: { translation: uk },
      ru: { translation: ru },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en', // Default to English for unsupported languages
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
