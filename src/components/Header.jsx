function Header() {
  return (
    <header className="bg-primary text-white shadow-lg z-10">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚌</span>
          <h1 className="text-xl font-bold">Tartu Bussid</h1>
        </div>
        <div className="text-sm opacity-90">
          Live Tracker
        </div>
      </div>
    </header>
  );
}

export default Header;
