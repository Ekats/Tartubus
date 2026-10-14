import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../i18n';

// The map's stop flow without a real map: the map layers are stand-ins that show what they were given
const mocks = vi.hoisted(() => ({ getStopById: null }));

vi.mock('../../services/digitransit', () => ({
  getNearbyStops: vi.fn().mockResolvedValue([]),
  getStopById: (...args) => mocks.getStopById(...args),
  getStopsByRoutes: vi.fn().mockResolvedValue({ stops: [], routePatterns: [] }),
  getRouteShortNamesInZone: vi.fn().mockResolvedValue([]),
  planJourney: vi.fn().mockResolvedValue([]),
  decodePolyline: vi.fn(() => []),
  getWalkingRoute: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock('../../utils/geocoding', () => ({ reverseGeocode: vi.fn().mockResolvedValue('') }));
vi.mock('../StopCard', () => ({ default: ({ stop, onShowRoute }) => createElement('div', { id: 'stop-card' }, stop.name,
  onShowRoute && createElement('button', { id: 'card-route', onClick: () => onShowRoute({ type: 'route', routeNumber: '7', trip: { stops: [] } }) })) }));
vi.mock('../map/MapView', () => ({ default: ({ children, onMapClick }) => createElement('div', null,
  createElement('button', { id: 'empty-map', onClick: () => onMapClick?.({ lat: 58.38, lon: 26.72 }) }),
  children) }));
vi.mock('../map/MapMarker', () => ({ default: () => null }));
vi.mock('../map/MapPopup', () => ({ default: () => null }));
vi.mock('../map/RouteLinesLayer', () => ({ default: () => null }));
vi.mock('../map/TripLayer', () => ({ default: () => null }));
vi.mock('../map/JourneyLayer', () => ({ default: () => null }));
vi.mock('../map/StopsLayer', () => ({
  default: ({ points, onStopClick }) => points.map(p =>
    createElement('button', { key: p.id, className: 'stop', onClick: () => onStopClick(p.id) })),
}));
vi.mock('../map/StopPopup', () => ({
  default: ({ stop, departures, onOpen, onClose }) => createElement('div', { id: 'popup' },
    `${stop.name} ${stop.code} ${departures === null ? 'loading' : `${departures.length} departures`}`,
    createElement('button', { id: 'popup-open', onClick: onOpen }),
    createElement('button', { id: 'popup-close', onClick: onClose })),
}));

import StopFinder from '../StopFinder';
import { getNearbyStops, getRouteShortNamesInZone, planJourney } from '../../services/digitransit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STOP = { gtfsId: 'est:1', name: 'Raekoda', code: '7820', lat: 58.3800, lon: 26.7225 };

function geolocationHook() {
  return {
    location: { lat: 58.3776, lon: 26.7290, accuracy: null, hasRealFix: false },
    getLocation: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    watching: false,
  };
}

let root;
let container;
let backHandlerRef;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const $ = (selector) => container.querySelector(selector);
const click = async (el) => { await act(async () => el.click()); await flush(); };
const back = async () => {
  let consumed;
  await act(async () => { consumed = backHandlerRef.current(); });
  await flush();
  return consumed;
};

async function render(props = {}) {
  container = document.createElement('div');
  root = createRoot(container);
  backHandlerRef = { current: null };
  await act(async () => root.render(createElement(StopFinder, {
    geolocationHook: geolocationHook(), backHandlerRef, onStopDismiss: vi.fn(), ...props,
  })));
  await flush();
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  mocks.getStopById = vi.fn().mockResolvedValue({ ...STOP, stoptimesWithoutPatterns: [{ scheduledArrival: 0 }] });
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [STOP] });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('StopFinder stop box and back button', () => {
  it('a tap on a stop opens its box with departures, not the stop view', async () => {
    await render();
    await click($('button.stop'));
    expect($('#popup').textContent).toContain('Raekoda 7820 1 departures');
    expect(mocks.getStopById).toHaveBeenCalledWith('est:1', undefined);
    expect($('#stop-card')).toBeNull();
  });

  it('a tap on the box opens the stop view', async () => {
    await render();
    await click($('button.stop'));
    await click($('#popup-open'));
    expect($('#stop-card').textContent).toBe('Raekoda');
  });

  it('back closes the stop view, then the box, then gives the press to App', async () => {
    await render();
    await click($('button.stop'));
    await click($('#popup-open'));

    expect(await back()).toBe(true);
    expect($('#stop-card')).toBeNull();
    expect($('#popup')).not.toBeNull();

    expect(await back()).toBe(true);
    expect($('#popup')).toBeNull();

    expect(await back()).toBe(false);
  });

  it('the × and a tap on the empty map close the box', async () => {
    await render();
    await click($('button.stop'));
    await click($('#popup-close'));
    expect($('#popup')).toBeNull();
    await click($('button.stop'));
    await click($('#empty-map'));
    expect($('#popup')).toBeNull();
  });

  it('a stop opened from another tab opens the stop view directly; back closes it and tells App', async () => {
    const onStopDismiss = vi.fn();
    await render({ selectedStop: STOP, onStopDismiss });
    expect($('#stop-card')).not.toBeNull();
    expect($('#popup')).toBeNull();
    expect(await back()).toBe(true);
    expect($('#stop-card')).toBeNull();
    expect(onStopDismiss).toHaveBeenCalled();
  });

  it('the box goes when a journey is shown', async () => {
    await render();
    await click($('button.stop'));
    await act(async () => root.render(createElement(StopFinder, {
      geolocationHook: geolocationHook(), backHandlerRef, selectedJourney: { legs: [] },
    })));
    await flush();
    expect($('#popup')).toBeNull();
    expect(await back()).toBe(false);
  });

  it('forgets its back handler when unmounted', async () => {
    await render();
    act(() => root.unmount());
    expect(backHandlerRef.current).toBeNull();
    await render();
  });

  it('the route button in the stop view closes it and shows the bus on the map', async () => {
    const onRouteChange = vi.fn();
    await render({ onRouteChange });
    await click($('button.stop'));
    await click($('#popup-open'));
    await click($('#card-route'));
    expect($('#stop-card')).toBeNull();
    expect($('#popup')).toBeNull();
    expect(onRouteChange).toHaveBeenCalledWith({ type: 'route', routeNumber: '7', trip: { stops: [] } });
  });
});

// App's part of the route filter (the menu's open flag, the shown route) without App: held here
const harness = {};
function Harness({ initialOpen = false, initialRoute = null }) {
  const [open, setOpen] = useState(initialOpen);
  const [route, setRoute] = useState(initialRoute);
  harness.open = open;
  harness.route = route;
  harness.setRoute = setRoute;
  return createElement(StopFinder, {
    geolocationHook: harness.geo, backHandlerRef, onStopDismiss: vi.fn(),
    routeFilterOpen: open, onRouteFilterOpenChange: setOpen,
    selectedRoute: route, onRouteChange: setRoute,
    onRouteFilterCountChange: (n) => { harness.count = n; },
  });
}
async function renderHarness(props) {
  container = document.createElement('div');
  root = createRoot(container);
  backHandlerRef = { current: null };
  harness.geo = geolocationHook();
  await act(async () => root.render(createElement(Harness, props)));
  await flush();
  await flush();
}
const filterMenu = () => [...container.querySelectorAll('h3')].find(h => h.textContent === i18n.t('map.filterRoutes'));

describe('StopFinder route filter and back button', () => {
  it('back closes the stop box, then the filter menu, then clears the route shown, then gives the press to App', async () => {
    await renderHarness({ initialOpen: true });
    await click($('button.stop'));
    // A route shown from Near Me while the box is open (the filter hides the stop's marker, not the box)
    await act(async () => harness.setRoute({ routeNumber: '5' }));
    await flush();
    expect(harness.count).toBe(1);
    expect($('#popup')).not.toBeNull();

    expect(await back()).toBe(true);
    expect($('#popup')).toBeNull();
    expect(filterMenu()).toBeTruthy();

    expect(await back()).toBe(true);
    expect(harness.open).toBe(false);
    expect(filterMenu()).toBeFalsy();
    expect(harness.route).toEqual({ routeNumber: '5' });

    expect(await back()).toBe(true);
    expect(harness.route).toBeNull();
    expect(harness.count).toBe(0);

    expect(await back()).toBe(false);
  });

  it('back clears a filter picked in the menu', async () => {
    getRouteShortNamesInZone.mockResolvedValueOnce(['5', '7']);
    await renderHarness({ initialOpen: true });
    const route7 = [...container.querySelectorAll('button')].find(b => b.textContent === '7');
    await click(route7);
    expect(harness.count).toBe(1);

    expect(await back()).toBe(true); // the menu
    expect(await back()).toBe(true); // the filter
    expect(harness.count).toBe(0);
    expect(await back()).toBe(false);
  });

  it('the menu opens from App\'s flag; a tap on the empty map closes it', async () => {
    await renderHarness({ initialOpen: true });
    expect(filterMenu()).toBeTruthy();
    await click($('#empty-map'));
    expect(harness.open).toBe(false);
    expect(filterMenu()).toBeFalsy();
  });
});

describe('StopFinder searched place', () => {
  const PLACE = { gtfsId: 'search:58.32:26.61', name: 'Ropka järv', lat: 58.3214, lon: 26.6160, isSearchResult: true, isPlace: true };
  const near = (id, name, distance) => ({ gtfsId: id, name, code: id, lat: 58.32, lon: 26.62, distance,
    stoptimesWithoutPatterns: [{ scheduledArrival: 8 * 3600, serviceDay: 0, headsign: 'Tartu bussijaam', trip: { route: { shortName: '311' } } }] });

  it('shows its nearest stops (not a stop card), for the planned time, and plans journeys to those stops only', async () => {
    const customTime = new Date('2026-10-16T05:00:00Z');
    getNearbyStops.mockImplementation(async (lat, lon, radius) =>
      lat === PLACE.lat && radius === 500 ? [] : lat === PLACE.lat && radius === 2000
        ? [near('B', 'Kullerkupu', 630), near('A', 'Külitse järve', 530), near('C', 'Far', 900), near('D', 'Farther', 1500)]
        : []);
    planJourney.mockClear();
    await render({ selectedStop: PLACE, customTime, manualLocation: { lat: 58.38, lon: 26.72 } });
    await flush();

    expect($('#stop-card')).toBeNull();
    const list = $('[data-testid="place-stops"]').textContent;
    expect(list).toContain(i18n.t('map.nearestStops'));
    expect(list.indexOf('Külitse järve')).toBeLessThan(list.indexOf('Kullerkupu'));
    expect(list).not.toContain('Farther');
    expect(list).toContain('530 m');
    expect(getNearbyStops).toHaveBeenCalledWith(PLACE.lat, PLACE.lon, 2000, false, customTime);

    const destinations = planJourney.mock.calls.map(([, to]) => to);
    expect(destinations.length).toBe(3);
    expect(destinations).not.toContainEqual({ lat: PLACE.lat, lon: PLACE.lon });
    expect(planJourney.mock.calls.every(([, , options]) => options.dateTime === customTime.toISOString())).toBe(true);
    getNearbyStops.mockReset();
    getNearbyStops.mockResolvedValue([]);
  });

  it('a tap on a nearest stop opens its stop view', async () => {
    getNearbyStops.mockResolvedValue([near('A', 'Külitse järve', 530)]);
    mocks.getStopById = vi.fn(async (id) => ({ gtfsId: id, name: 'Külitse järve', stoptimesWithoutPatterns: [] }));
    await render({ selectedStop: PLACE });
    await flush();
    const row = [...container.querySelectorAll('[data-testid="place-stops"] button')].find(b => b.textContent.includes('Külitse järve'));
    await click(row);
    expect($('#stop-card').textContent).toBe('Külitse järve');
    getNearbyStops.mockResolvedValue([]);
  });
});

describe('StopFinder location tracking toast', () => {
  it('is in the app language', async () => {
    await i18n.changeLanguage('et');
    await render();
    const button = container.querySelector(`button[title="${i18n.t('map.startTracking')}"]`);
    expect(button).not.toBeNull();
    await act(async () => button.click());
    expect(container.textContent).toContain('Asukoha jälgimine käivitatud');
    expect(container.textContent).not.toContain('Location tracking started');
  });
});
