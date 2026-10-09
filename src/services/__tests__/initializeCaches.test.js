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

  it('keeps recent departure caches (the offline fallback) and drops old or unreadable ones', () => {
    initializeCaches();
    const entry = ageHours => JSON.stringify({ data: [], timestamp: Date.now() - ageHours * 3600 * 1000 });
    localStorage.setItem('stops_58.380_26.720_500', entry(1));
    localStorage.setItem('stopdep_Viro:1', entry(1));
    localStorage.setItem('stops_58.390_26.720_500', entry(13));
    localStorage.setItem('stopdep_Viro:2', entry(13));
    localStorage.setItem('stops_58.400_26.720_500', '{');
    localStorage.setItem('language', 'ru');

    initializeCaches();

    expect(localStorage.getItem('stops_58.380_26.720_500')).not.toBeNull();
    expect(localStorage.getItem('stopdep_Viro:1')).not.toBeNull();
    expect(localStorage.getItem('stops_58.390_26.720_500')).toBeNull();
    expect(localStorage.getItem('stopdep_Viro:2')).toBeNull();
    expect(localStorage.getItem('stops_58.400_26.720_500')).toBeNull();
    expect(localStorage.getItem('language')).toBe('ru');
  });

  it('keeps only the 10 most recent location entries and 20 stop entries', () => {
    initializeCaches();
    for (let i = 0; i < 12; i++) {
      localStorage.setItem(`stops_58.${300 + i}_26.720_500`, JSON.stringify({ data: [], timestamp: Date.now() - i * 1000 }));
    }
    for (let i = 0; i < 23; i++) {
      localStorage.setItem(`stopdep_Viro:${i}`, JSON.stringify({ data: {}, timestamp: Date.now() - i * 1000 }));
    }

    initializeCaches();

    const count = prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).length;
    expect(count('stops_')).toBe(10);
    expect(count('stopdep_')).toBe(20);
    expect(localStorage.getItem('stops_58.300_26.720_500')).not.toBeNull(); // newest kept
    expect(localStorage.getItem('stops_58.311_26.720_500')).toBeNull(); // oldest evicted
  });
});

describe('clearCachedData', () => {
  it('removes only stops_, stopdep_ and route_ entries', () => {
    Object.entries(USER_DATA).forEach(([k, v]) => localStorage.setItem(k, v));
    localStorage.setItem('stops_1', 'a');
    localStorage.setItem('route_2', 'b');
    localStorage.setItem('stopdep_Viro:3', 'c');

    expect(clearCachedData()).toBe(3);
    expect(snapshot()).toEqual(USER_DATA);
  });
});
