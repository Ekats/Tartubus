import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../i18n';

vi.mock('../../hooks/useNearbyStops', () => ({
  useNearbyStops: () => ({ stops: [], loading: false, error: null, fetchNearbyStops: vi.fn() }),
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

afterEach(() => {
  act(() => root?.unmount());
});

describe('NearMe with location permission denied', () => {
  it('shows the GPS error when no manual location is set', async () => {
    const container = await render({ geolocationHook: deniedGeolocationHook(), manualLocation: null });
    expect(container.textContent).toContain(GPS_DENIED);
  });

  it('does not show the GPS error once a manual location is set', async () => {
    const container = await render({
      geolocationHook: deniedGeolocationHook(),
      manualLocation: { lat: 58.3800, lon: 26.7200 },
    });
    expect(container.textContent).not.toContain(GPS_DENIED);
  });
});
