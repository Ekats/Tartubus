import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../i18n';

const favorites = [
  { gtfsId: 'Viro:1', name: 'Raekoja plats', code: '1', lat: 58.3781, lon: 26.7292 },
  { gtfsId: 'Viro:2', name: 'Kaubamaja', code: '2', lat: 58.3790, lon: 26.7230 },
];

vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ favorites, removeFavorite: vi.fn(), clearAllFavorites: vi.fn(), isFavorite: () => true, toggleFavorite: vi.fn() }),
}));
vi.mock('../../services/digitransit', () => ({
  getStopById: vi.fn(async (gtfsId) => ({ ...favorites.find(f => f.gtfsId === gtfsId), stoptimesWithoutPatterns: [] })),
  getNextStopName: vi.fn(),
  getWalkingRoute: vi.fn().mockResolvedValue(null),
}));

import Favorites from '../Favorites';
import { getStopById } from '../../services/digitransit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const gps = (lat, lon) => ({ location: { lat, lon, accuracy: 5, hasRealFix: true } });

let root;
async function render(location) {
  await act(async () => root.render(createElement(Favorites, {
    geolocationHook: gps(location.lat, location.lon), onNavigateToMap: () => {}, manualLocation: null, customTime: null,
  })));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  root = createRoot(document.createElement('div'));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('Favorites departures', () => {
  it('fetches each favorite once on open and again every 30 s', async () => {
    await render({ lat: 58.378, lon: 26.729 });
    expect(getStopById).toHaveBeenCalledTimes(2);

    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(getStopById).toHaveBeenCalledTimes(4);
  });

  it('does not refetch departures when the user moves', async () => {
    await render({ lat: 58.378, lon: 26.729 });
    await render({ lat: 58.380, lon: 26.735 }); // ~400 m away
    await render({ lat: 58.383, lon: 26.740 });
    expect(getStopById).toHaveBeenCalledTimes(2);
  });
});
