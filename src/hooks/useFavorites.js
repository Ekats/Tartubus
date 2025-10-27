import { useState, useEffect } from 'react';

const FAVORITES_KEY = 'tartu_bus_favorites';

/**
 * Custom hook to manage favorite bus stops
 * Stores favorites in localStorage as an array of stop objects
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      setFavorites([]);
    }
  }, []);

  // Save to localStorage whenever favorites change
  const saveFavorites = (newFavorites) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  // Add a stop to favorites
  const addFavorite = (stop) => {
    if (!stop || !stop.gtfsId) {
      console.error('Invalid stop object');
      return;
    }

    // Check if already favorited
    if (favorites.some(fav => fav.gtfsId === stop.gtfsId)) {
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

    const newFavorites = [...favorites, favoriteStop];
    saveFavorites(newFavorites);
  };

  // Remove a stop from favorites
  const removeFavorite = (gtfsId) => {
    const newFavorites = favorites.filter(fav => fav.gtfsId !== gtfsId);
    saveFavorites(newFavorites);
  };

  // Check if a stop is favorited
  const isFavorite = (gtfsId) => {
    return favorites.some(fav => fav.gtfsId === gtfsId);
  };

  // Toggle favorite status
  const toggleFavorite = (stop) => {
    if (isFavorite(stop.gtfsId)) {
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
