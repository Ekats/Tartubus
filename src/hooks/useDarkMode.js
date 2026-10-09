import { useState, useEffect } from 'react';
import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';

// Native plugin (android/.../SystemBarColorPlugin.java) that paints the strips behind the system bars
const SystemBarColor = registerPlugin('SystemBarColor');

// Same as the bottom tab bar's background (bg-white / dark:bg-gray-800)
const BAR_COLOR_LIGHT = '#FFFFFF';
const BAR_COLOR_DARK = '#1F2937';

/**
 * Custom hook to manage dark mode
 */
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply or remove dark class on document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Colour the strips behind the status/navigation bars and keep their icons legible
    if (Capacitor.isNativePlatform()) {
      // Dark = light icons (for a dark strip). setStyle resets the strip colour, so colour it afterwards
      SystemBars.setStyle({ style: isDarkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light })
        .then(() => SystemBarColor.setColor({ color: isDarkMode ? BAR_COLOR_DARK : BAR_COLOR_LIGHT }))
        .catch(() => {});
    }

    // Save to localStorage
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      // Only auto-update if user hasn't manually set a preference
      const saved = localStorage.getItem('darkMode');
      if (saved === null) {
        setIsDarkMode(e.matches);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return { isDarkMode, toggleDarkMode };
}
