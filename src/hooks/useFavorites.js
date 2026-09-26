import { useSyncExternalStore } from 'react';

const FAVORITES_KEY = 'tartu_bus_favorites';

// One shared favorites list for every useFavorites() caller. Each caller used to keep
// its own copy and write it back whole, so two mounted components (e.g. StopFinder and
// the StopCard in its overlay) could overwrite each other's changes.
let favoritesCache = null;
const listeners = new Set();

function readFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
}

function getSnapshot() {
  if (favoritesCache === null) {
    favoritesCache = readFavorites();
  }
  return favoritesCache;
}

function notify() {
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keep other open tabs in sync (key is null when localStorage was cleared)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === FAVORITES_KEY || event.key === null) {
      favoritesCache = readFavorites();
      notify();
    }
  });
}

// Save to localStorage and update every caller
function saveFavorites(newFavorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    favoritesCache = newFavorites;
    notify();
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
}

/**
 * Custom hook to manage favorite bus stops
 * Stores favorites in localStorage as an array of stop objects
 */
export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot);

  // Add a stop to favorites
  const addFavorite = (stop) => {
    if (!stop || !stop.gtfsId) {
      console.error('Invalid stop object');
      return;
    }

    // Address search results are not stops
    if (stop.isSearchResult || stop.gtfsId.startsWith('search:')) {
      return;
    }

    const current = getSnapshot();

    // Check if already favorited
    if (current.some(fav => fav.gtfsId === stop.gtfsId)) {
      console.log('Stop already favorited');
      return;
    }

    // Store minimal information needed
    const favoriteStop = {
      gtfsId: stop.gtfsId,
      name: stop.name,
      code: stop.code,
      lat: stop.lat,
      lon: stop.lon,
      addedAt: Date.now(),
    };

    saveFavorites([...current, favoriteStop]);
  };

  // Remove a stop from favorites
  const removeFavorite = (gtfsId) => {
    saveFavorites(getSnapshot().filter(fav => fav.gtfsId !== gtfsId));
  };

  // Check if a stop is favorited
  const isFavorite = (gtfsId) => {
    return favorites.some(fav => fav.gtfsId === gtfsId);
  };

  // Toggle favorite status
  const toggleFavorite = (stop) => {
    if (getSnapshot().some(fav => fav.gtfsId === stop.gtfsId)) {
      removeFavorite(stop.gtfsId);
    } else {
      addFavorite(stop);
    }
  };

  // Clear all favorites
  const clearAllFavorites = () => {
    saveFavorites([]);
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    clearAllFavorites,
  };
}
