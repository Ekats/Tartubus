import { useTranslation } from 'react-i18next';
import BusIcon from './BusIcon';

// The address search lives at the bottom of the screen (SearchBar)
function Header({ isDarkMode, toggleDarkMode, customTime, onTimePickerOpen }) {
  const { t } = useTranslation();

  return (
    <header className="bg-primary dark:bg-gray-800 text-white shadow-lg z-[1100] relative transition-colors">
      <div className="px-3 py-3 flex items-center gap-2">
        {/* Logo */}
        <BusIcon className="h-6 flex-shrink-0" alt="Tartu Bussid" />

        <div className="flex-1" />

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
