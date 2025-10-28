import { useTranslation } from 'react-i18next';

function BottomNav({ activeView, onViewChange }) {
  const { t } = useTranslation();

  const navItems = [
    { id: 'nearme', icon: '📍', label: t('tabs.nearMe') },
    { id: 'map', icon: '🗺️', label: t('tabs.map') },
    { id: 'favorites', icon: '⭐', label: t('tabs.favorites') },
    { id: 'settings', icon: '⚙️', label: t('tabs.settings') },
  ];

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-[1500] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl transition-colors">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex-1 flex flex-col items-center py-3 transition-colors rounded-2xl ${
              activeView === item.id
                ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <span className="text-2xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
