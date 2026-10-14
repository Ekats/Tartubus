import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

// The Android back button: the map's own layers first (stop view, then stop box), then App's order
const mocks = vi.hoisted(() => ({ listeners: new Set(), mapBack: null, minimizeApp: null }));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: async (event, callback) => {
      mocks.listeners.add(callback);
      return { remove: () => mocks.listeners.delete(callback) };
    },
    minimizeApp: (...args) => mocks.minimizeApp(...args),
  },
}));
vi.mock('../services/digitransit', () => ({ initializeCaches: vi.fn() }));
vi.mock('../hooks/useKeyboardInset', () => ({ useKeyboardInset: () => false }));
vi.mock('../components/Header', () => ({
  default: ({ onRouteFilterToggle, routeFilterOpen, routeFilterCount }) => onRouteFilterToggle
    ? createElement('button', { id: 'filter-toggle', onClick: onRouteFilterToggle }, `filter open=${routeFilterOpen} count=${routeFilterCount}`)
    : null,
}));
vi.mock('../components/SearchBar', () => ({ default: () => null }));
vi.mock('../components/InstallPrompt', () => ({ default: () => null }));
vi.mock('../components/AndroidAppPrompt', () => ({ default: () => null }));
vi.mock('../components/DateTimePicker', () => ({ default: () => null }));
vi.mock('../components/Favorites', () => ({
  default: ({ onShowRoute }) => createElement('div', null, 'FAVORITES',
    createElement('button', { id: 'fav-show-route', onClick: () => onShowRoute({ routeNumber: '9' }) })),
}));
vi.mock('../components/Settings', () => ({ default: () => createElement('div', null, 'SETTINGS') }));
vi.mock('../components/BottomNav', () => ({
  default: ({ onViewChange }) => createElement('div', null,
    createElement('button', { id: 'to-map', onClick: () => onViewChange('map') }),
    createElement('button', { id: 'to-favorites', onClick: () => onViewChange('favorites') })),
}));
vi.mock('../components/NearMe', () => ({
  default: ({ onShowRoute }) => createElement('div', null, 'NEARME',
    createElement('button', { id: 'show-route', onClick: () => onShowRoute({ routeNumber: '5' }) })),
}));
vi.mock('../components/StopFinder', () => ({
  default: ({ backHandlerRef, selectedJourney, selectedRoute, onJourneyChange, routeFilterOpen, onRouteFilterCountChange }) => {
    backHandlerRef.current = () => mocks.mapBack();
    return createElement('div', null,
      `MAP journey=${selectedJourney ? 'yes' : 'no'} route=${selectedRoute?.routeNumber ?? 'none'} menu=${!!routeFilterOpen}`,
      createElement('button', { id: 'show-journey', onClick: () => onJourneyChange({ legs: [] }) }),
      createElement('button', { id: 'pick-two', onClick: () => onRouteFilterCountChange(2) }));
  },
}));

import App from '../App';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const click = async (id) => { await act(async () => container.querySelector(`#${id}`).click()); await flush(); };
const back = async () => {
  await act(async () => [...mocks.listeners].forEach(listener => listener({ canGoBack: false })));
  await flush();
};
const text = () => container.textContent;

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('location_consent', 'declined');
  mocks.listeners.clear();
  mocks.mapBack = vi.fn(() => false);
  mocks.minimizeApp = vi.fn();
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(createElement(App)));
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('App back button', () => {
  it('lets the map close its own layer first and stays on the map', async () => {
    await click('to-map');
    expect(text()).toContain('MAP');
    mocks.mapBack.mockReturnValueOnce(true);
    await back();
    expect(mocks.mapBack).toHaveBeenCalledTimes(1);
    expect(text()).toContain('MAP');
  });

  it('goes to Near Me once the map has nothing open', async () => {
    await click('to-map');
    await back();
    expect(mocks.mapBack).toHaveBeenCalledTimes(1);
    expect(text()).toContain('NEARME');
  });

  it('closes the map layers, then the journey, then leaves the map', async () => {
    await click('to-map');
    await click('show-journey');
    expect(text()).toContain('journey=yes');

    mocks.mapBack.mockReturnValueOnce(true); // e.g. the stop box
    await back();
    expect(text()).toContain('journey=yes');

    await back();
    expect(text()).toContain('MAP journey=no');

    await back();
    expect(text()).toContain('NEARME');
  });

  it('clears a route shown from Near Me before leaving the map', async () => {
    await click('show-route');
    expect(text()).toContain('route=5');
    await back();
    expect(text()).toContain('MAP journey=no route=none');
    await back();
    expect(text()).toContain('NEARME');
  });

  it('does not ask the map when another tab is shown', async () => {
    await back();
    expect(mocks.mapBack).not.toHaveBeenCalled();
  });

  it('keeps a single listener through re-renders, so a press is handled once', async () => {
    await click('to-map');
    await click('show-journey');
    expect(mocks.listeners.size).toBe(1);
    mocks.mapBack.mockReturnValueOnce(true);
    await back();
    expect(mocks.mapBack).toHaveBeenCalledTimes(1);
  });
});

describe('App header route filter button', () => {
  const has = (id) => !!container.querySelector(`#${id}`);

  it('is only in the header on the map tab', async () => {
    expect(has('filter-toggle')).toBe(false); // Near Me
    await click('to-favorites');
    expect(has('filter-toggle')).toBe(false);
    await click('to-map');
    expect(has('filter-toggle')).toBe(true);
  });

  it('opens and closes the map\'s filter menu and shows how many routes are picked', async () => {
    await click('to-map');
    await click('filter-toggle');
    expect(text()).toContain('menu=true');
    expect(text()).toContain('filter open=true count=0');
    await click('pick-two');
    expect(text()).toContain('count=2');
    await click('filter-toggle');
    expect(text()).toContain('menu=false');
  });

  it('the menu is closed again when the map is left and reopened', async () => {
    await click('to-map');
    await click('filter-toggle');
    await click('to-favorites');
    await click('to-map');
    expect(text()).toContain('menu=false');
  });
});

describe('App route button in Favorites', () => {
  it('shows the route on the map, and back clears it before leaving the map', async () => {
    await click('to-favorites');
    await click('fav-show-route');
    expect(text()).toContain('MAP journey=no route=9');
    await back();
    expect(text()).toContain('route=none');
    await back();
    expect(text()).toContain('NEARME');
  });
});
