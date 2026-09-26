import { describe, it, expect, beforeEach } from 'vitest';
import { initializeCaches, clearCachedData } from '../digitransit';

// Everything the app stores for the user, plus a key from another app on the same
// origin (all GitHub Pages sites of one account share ekats.github.io's localStorage)
const USER_DATA = {
  tartu_bus_favorites: '[{"gtfsId":"Viro:1"}]',
  'tartu-bus-settings': '{"nearbyRadius":800}',
  darkMode: 'true',
  language: 'et',
  location_modal_seen: 'true',
  install_prompt_dismissed: 'true',
  android_app_prompt_dismissed: 'true',
  routes_metadata: '{"version":1}',
  'other-app-state': 'keep me',
};

const snapshot = () => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]));

beforeEach(() => {
  localStorage.clear();
});

describe('initializeCaches', () => {
  it('keeps user data across the first launches of a new install', () => {
    initializeCaches(); // launch 1: empty storage
    Object.entries(USER_DATA).forEach(([k, v]) => localStorage.setItem(k, v)); // user picks language, etc.

    initializeCaches(); // launch 2: used to run a soft clear that wiped most of this
    initializeCaches(); // launch 3

    expect(snapshot()).toMatchObject(USER_DATA);
  });

  it('removes cached API data', () => {
    initializeCaches();
    localStorage.setItem('stops_58.38_26.72_500', '{}');
    localStorage.setItem('route_Viro:1', '{}');
    localStorage.setItem('language', 'ru');

    initializeCaches();

    expect(localStorage.getItem('stops_58.38_26.72_500')).toBeNull();
    expect(localStorage.getItem('route_Viro:1')).toBeNull();
    expect(localStorage.getItem('language')).toBe('ru');
  });
});

describe('clearCachedData', () => {
  it('removes only stops_ and route_ entries', () => {
    Object.entries(USER_DATA).forEach(([k, v]) => localStorage.setItem(k, v));
    localStorage.setItem('stops_1', 'a');
    localStorage.setItem('route_2', 'b');

    expect(clearCachedData()).toBe(2);
    expect(snapshot()).toEqual(USER_DATA);
  });
});
