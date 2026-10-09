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
    <nav className="fixed bottom-0 left-0 right-0 z-[1500] h-[var(--bottom-nav-height)] pb-[env(safe-area-inset-bottom,0px)] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex h-full items-stretch justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
              activeView === item.id
                ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[11px] leading-tight font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
