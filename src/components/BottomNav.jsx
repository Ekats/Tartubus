function BottomNav({ activeView, onViewChange }) {
  const navItems = [
    { id: 'nearme', icon: '📍', label: 'Near Me' },
    { id: 'map', icon: '🗺️', label: 'Map' },
    { id: 'favorites', icon: '⭐', label: 'Favorites' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <nav className="bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex-1 flex flex-col items-center py-3 transition-colors ${
              activeView === item.id
                ? 'text-primary'
                : 'text-gray-500 hover:text-gray-700'
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
