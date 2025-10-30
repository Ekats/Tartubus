/**
 * Settings storage utility using localStorage
 */

const SETTINGS_KEY = 'tartu-bus-settings';

const DEFAULT_SETTINGS = {
  nearbyRadius: 500, // meters
  maxStopsOnMap: 100, // maximum number of stops to display on map
  cityRadius: 8000, // meters from city center to show stops
};

/**
 * Get all settings
 */
export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Get a specific setting
 */
export function getSetting(key) {
  const settings = getSettings();
  return settings[key];
}

/**
 * Update a specific setting
 */
export function updateSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  return saveSettings(settings);
}
