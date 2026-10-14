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
vi.mock('../services/digitransit', () => ({ initializeCaches: vi.fn(), getRouteShortNamesInZone: async () => ['5', '7'] }));
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
const routes = (selectedRoutes) => [...selectedRoutes].join(',') || 'all';
vi.mock('../components/Favorites', () => ({
  default: ({ onShowRoute, selectedRoutes }) => createElement('div', null, `FAVORITES routes=${routes(selectedRoutes)}`,
    createElement('button', { id: 'fav-show-route', onClick: () => onShowRoute({ routeNumber: '9' }) })),
}));
vi.mock('../components/Settings', () => ({ default: () => createElement('div', null, 'SETTINGS') }));
vi.mock('../components/BottomNav', () => ({
  default: ({ onViewChange }) => createElement('div', null,
    createElement('button', { id: 'to-nearme', onClick: () => onViewChange('nearme') }),
    createElement('button', { id: 'to-map', onClick: () => onViewChange('map') }),
    createElement('button', { id: 'to-favorites', onClick: () => onViewChange('favorites') }),
    createElement('button', { id: 'to-settings', onClick: () => onViewChange('settings') })),
}));
vi.mock('../components/NearMe', () => ({
  default: ({ onShowRoute, selectedRoutes, onClearRouteFilter }) => createElement('div', null, `NEARME routes=${routes(selectedRoutes)}`,
    createElement('button', { id: 'show-route', onClick: () => onShowRoute({ routeNumber: '5' }) }),
    createElement('button', { id: 'nearme-clear', onClick: onClearRouteFilter })),
}));
vi.mock('../components/StopFinder', () => ({
  default: ({ backHandlerRef, selectedJourney, selectedRoute, onJourneyChange, routeFilterOpen, selectedRoutes, onSelectedRoutesChange }) => {
    backHandlerRef.current = () => mocks.mapBack();
    return createElement('div', null,
      `MAP journey=${selectedJourney ? 'yes' : 'no'} route=${selectedRoute?.routeNumber ?? 'none'} menu=${!!routeFilterOpen} routes=${routes(selectedRoutes)}`,
      createElement('button', { id: 'show-journey', onClick: () => onJourneyChange({ legs: [] }) }),
      createElement('button', { id: 'pick-two', onClick: () => onSelectedRoutesChange(new Set(['5', '7'])) }));
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

describe('App route filter (one for the whole app)', () => {
  const has = (id) => !!container.querySelector(`#${id}`);
  const menu = () => container.querySelector('[data-testid="route-filter-menu"]');
  const menuRoute = async (name) => {
    const button = [...menu().querySelectorAll('button')].find(b => b.textContent === name);
    await act(async () => button.click());
    await flush();
  };

  it('has its header button and its menu on every tab', async () => {
    for (const tab of ['to-nearme', 'to-map', 'to-favorites', 'to-settings']) {
      await click(tab);
      expect(has('filter-toggle')).toBe(true);
      await click('filter-toggle');
      expect(menu()).not.toBeNull();
      await click('filter-toggle');
      expect(menu()).toBeNull();
    }
  });

  it('opens and closes the menu and shows how many routes are picked', async () => {
    await click('to-map');
    await click('filter-toggle');
    expect(text()).toContain('menu=true');
    expect(text()).toContain('filter open=true count=0');
    await menuRoute('7');
    expect(text()).toContain('count=1');
    expect(text()).toContain('routes=7');
    await click('pick-two');
    expect(text()).toContain('count=2');
    await click('filter-toggle');
    expect(text()).toContain('menu=false');
  });

  it('a filter set on the map filters Near Me and Favorites, and leaving the map keeps the menu open', async () => {
    await click('to-map');
    await click('filter-toggle');
    await menuRoute('7');
    await click('to-nearme');
    expect(text()).toContain('NEARME routes=7');
    expect(menu()).not.toBeNull();
    await click('to-favorites');
    expect(text()).toContain('FAVORITES routes=7');
  });

  it('Near Me\'s clear action clears it', async () => {
    await click('filter-toggle');
    await menuRoute('5');
    expect(text()).toContain('NEARME routes=5');
    await click('nearme-clear');
    expect(text()).toContain('NEARME routes=all');
    expect(text()).toContain('count=0');
  });

  it('back on Near Me closes the menu, then clears the filter, then goes on as usual', async () => {
    await click('filter-toggle');
    await menuRoute('7');
    await back();
    expect(menu()).toBeNull();
    expect(text()).toContain('NEARME routes=7');
    await back();
    expect(text()).toContain('NEARME routes=all');
    expect(text()).not.toContain('Press back again');
    await back();
    expect(text()).toContain('Press back again');
  });

  it('back on Favorites clears the filter before going to Near Me', async () => {
    await click('to-favorites');
    await click('filter-toggle');
    await menuRoute('7');
    await click('filter-toggle');
    await back();
    expect(text()).toContain('FAVORITES routes=all');
    await back();
    expect(text()).toContain('NEARME');
  });

  it('a route shown from Near Me stays only while the filter is just that route', async () => {
    await click('show-route');
    await click('filter-toggle');
    await menuRoute('5');
    expect(text()).toContain('route=5 menu=true routes=5');
    await menuRoute('7');
    expect(text()).toContain('route=none menu=true routes=5,7');
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
