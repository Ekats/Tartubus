import { useState, useEffect } from 'react';
import { getSettings, updateSetting } from '../utils/settings';

function Settings() {
  const [settings, setSettings] = useState(getSettings());
  const [saved, setSaved] = useState(false);

  const radiusOptions = [
    { value: 300, label: '300m - Very close' },
    { value: 500, label: '500m - Default' },
    { value: 800, label: '800m - Nearby' },
    { value: 1000, label: '1km - Extended' },
    { value: 1500, label: '1.5km - Wide area' },
    { value: 2000, label: '2km - Very wide' },
  ];

  const maxStopsOptions = [
    { value: 50, label: '50 stops - Fast performance' },
    { value: 100, label: '100 stops - Balanced (default)' },
    { value: 200, label: '200 stops - More detail' },
    { value: 300, label: '300 stops - Maximum detail' },
    { value: 500, label: '500 stops - Show everything' },
  ];

  const handleRadiusChange = (e) => {
    const newRadius = parseInt(e.target.value);
    setSettings({ ...settings, nearbyRadius: newRadius });
    updateSetting('nearbyRadius', newRadius);

    // Show saved message
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleMaxStopsChange = (e) => {
    const newMaxStops = parseInt(e.target.value);
    setSettings({ ...settings, maxStopsOnMap: newMaxStops });
    updateSetting('maxStopsOnMap', newMaxStops);

    // Show saved message
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Settings</h1>
          <p className="text-sm text-gray-600">Configure your bus tracker preferences</p>
        </div>

        {/* Nearby Radius Setting */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Nearby Stops Range</h2>
            <p className="text-sm text-gray-600">
              How far to search when finding stops near you
            </p>
          </div>

          <div className="space-y-3">
            {radiusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name="radius"
                  value={option.value}
                  checked={settings.nearbyRadius === option.value}
                  onChange={handleRadiusChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="ml-3 text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Saved indicator */}
          {saved && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
              <span>✓</span>
              <span>Settings saved automatically</span>
            </div>
          )}
        </div>

        {/* Max Stops on Map Setting */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Map Stop Limit</h2>
            <p className="text-sm text-gray-600">
              Maximum number of stops to display on the map (higher = more detail but slower)
            </p>
          </div>

          <div className="space-y-3">
            {maxStopsOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name="maxStops"
                  value={option.value}
                  checked={settings.maxStopsOnMap === option.value}
                  onChange={handleMaxStopsChange}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="ml-3 text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            <span>About this app</span>
          </h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Privacy-focused - no tracking</p>
            <p>• Uses Digitransit API for schedules</p>
            <p>• OpenStreetMap for maps</p>
            <p>• All settings stored locally on your device</p>
          </div>
        </div>

        {/* Version info */}
        <div className="text-center text-xs text-gray-500 pb-4">
          Tartu Bussid v0.1.0
        </div>
      </div>
    </div>
  );
}

export default Settings;
