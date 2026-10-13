/**
 * Settings storage utility using localStorage
 */

const SETTINGS_KEY = 'tartu-bus-settings';

const DEFAULT_SETTINGS = {
  nearbyRadius: 500, // meters
  maxStopsOnMap: 100, // maximum number of stops to display on map
  mapStyle: 'natural', // PROTOTYPE (?proto=maplibre): basemap theme, one of MAP_STYLES
};

// PROTOTYPE: basemap themes of the MapLibre map; dark mode uses each theme's dark version
// (satellite has none). An open map hears about a change through MAP_STYLE_EVENT.
export const MAP_STYLES = ['natural', 'colorful', 'muted', 'gray', 'toner', 'satellite'];
export const MAP_STYLE_EVENT = 'mapstylechange';

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
