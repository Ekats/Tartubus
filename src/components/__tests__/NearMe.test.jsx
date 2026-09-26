import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../i18n';

const mocks = vi.hoisted(() => ({ fetchNearbyStops: vi.fn() }));

vi.mock('../../hooks/useNearbyStops', () => ({
  useNearbyStops: () => ({ stops: [], loading: false, error: null, fetchNearbyStops: mocks.fetchNearbyStops }),
}));
vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock('../../utils/geocoding', () => ({ reverseGeocode: vi.fn().mockResolvedValue('Raekoja plats') }));
vi.mock('../../services/digitransit', () => ({
  getNextStopName: vi.fn(), getDailyTimetable: vi.fn(), getWalkingRoute: vi.fn(),
}));

import NearMe from '../NearMe';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GPS_DENIED = 'User denied geolocation prompt';

function deniedGeolocationHook() {
  return {
    location: { lat: 58.3776, lon: 26.7290, accuracy: null, hasRealFix: false },
    error: GPS_DENIED,
    errorCode: 1, // GeolocationPositionError.PERMISSION_DENIED
    loading: false,
    getLocation: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  };
}

let root;
async function render(props) {
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(createElement(NearMe, props)));
  return container;
}

// Let the async permission check settle
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

function idleGeolocationHook() {
  return {
    location: { lat: 58.3776, lon: 26.7290, accuracy: null, hasRealFix: false }, // default coords, no fix
    error: null,
    errorCode: null,
    loading: false,
    getLocation: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  };
}

function setBrowserPermission(state) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: async () => ({ state, addEventListener: () => {} }) },
  });
}

function clickButton(container, label) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent.includes(label));
  if (!button) throw new Error(`No button "${label}"`);
  act(() => button.click());
}

beforeEach(() => {
  localStorage.clear();
  mocks.fetchNearbyStops.mockClear();
  setBrowserPermission('prompt');
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('NearMe location consent', () => {
  it('remembers "Use Manual Location": no GPS and no dialog on the next visit', async () => {
    const hook = idleGeolocationHook();
    let container = await render({ geolocationHook: hook, manualLocation: null });
    await flush();
    clickButton(container, 'Use Manual Location');

    expect(localStorage.getItem('location_consent')).toBe('declined');

    act(() => root.unmount());
    const nextHook = idleGeolocationHook();
    container = await render({ geolocationHook: nextHook, manualLocation: null });
    await flush();

    expect(container.textContent).not.toContain('Allow Location Access');
    expect(nextHook.getLocation).not.toHaveBeenCalled();
    expect(nextHook.startWatching).not.toHaveBeenCalled();
  });

  it('allowing stores consent and starts GPS', async () => {
    const hook = idleGeolocationHook();
    const container = await render({ geolocationHook: hook, manualLocation: null });
    await flush();
    clickButton(container, 'Allow Location Access');

    expect(localStorage.getItem('location_consent')).toBe('granted');
    expect(hook.startWatching).toHaveBeenCalled();
  });

  it('does not look up stops around the default city-centre coordinates', async () => {
    localStorage.setItem('location_consent', 'declined');
    const container = await render({ geolocationHook: idleGeolocationHook(), manualLocation: null });
    await flush();

    expect(mocks.fetchNearbyStops).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('No bus stops found nearby');
  });

  it('moves an earlier user who allowed location to "granted" without asking again', async () => {
    localStorage.setItem('location_modal_seen', 'true');
    setBrowserPermission('granted');
    const hook = idleGeolocationHook();
    const container = await render({ geolocationHook: hook, manualLocation: null });
    await flush();

    expect(localStorage.getItem('location_consent')).toBe('granted');
    expect(hook.startWatching).toHaveBeenCalled();
    expect(container.textContent).not.toContain('Allow Location Access');
  });

  it('moves an earlier user who blocked location to "declined" without asking again', async () => {
    localStorage.setItem('location_modal_seen', 'true');
    setBrowserPermission('denied');
    const hook = idleGeolocationHook();
    const container = await render({ geolocationHook: hook, manualLocation: null });
    await flush();

    expect(localStorage.getItem('location_consent')).toBe('declined');
    expect(hook.getLocation).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Allow Location Access');
  });
});

describe('NearMe with location permission denied', () => {
  it('shows a translated error when no manual location is set', async () => {
    const container = await render({ geolocationHook: deniedGeolocationHook(), manualLocation: null });
    expect(container.textContent).toContain('Unable to find nearby stops');
    expect(container.textContent).toContain('Location permission denied');
    expect(container.textContent).not.toContain(GPS_DENIED); // the browser's own wording
  });

  it('does not show the GPS error once a manual location is set', async () => {
    const container = await render({
      geolocationHook: deniedGeolocationHook(),
      manualLocation: { lat: 58.3800, lon: 26.7200 },
    });
    expect(container.textContent).not.toContain('Unable to find nearby stops');
    expect(container.textContent).not.toContain('Location permission denied');
  });

  it('shows the browser message for other GPS errors, such as a timeout', async () => {
    const hook = { ...deniedGeolocationHook(), error: 'Timeout expired', errorCode: 3 };
    const container = await render({ geolocationHook: hook, manualLocation: null });
    expect(container.textContent).toContain('Timeout expired');
  });
});
