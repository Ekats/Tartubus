import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
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
vi.mock('../StopCard', () => ({ default: ({ stop }) => createElement('div', { id: 'stop-card' }, stop.name) }));
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
