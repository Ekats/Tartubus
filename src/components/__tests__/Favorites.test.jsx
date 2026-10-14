import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../i18n';

const favorites = [
  { gtfsId: 'Viro:1', name: 'Raekoja plats', code: '1', lat: 58.3781, lon: 26.7292 },
  { gtfsId: 'Viro:2', name: 'Kaubamaja', code: '2', lat: 58.3790, lon: 26.7230 },
];

vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ favorites, removeFavorite: vi.fn(), isFavorite: () => true, toggleFavorite: vi.fn() }),
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
let container;
async function render(location, props = {}) {
  await act(async () => root.render(createElement(Favorites, {
    geolocationHook: gps(location.lat, location.lon), onNavigateToMap: () => {}, manualLocation: null, customTime: null, ...props,
  })));
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.useFakeTimers();
  vi.clearAllMocks();
  getStopById.mockImplementation(async (gtfsId) => ({ ...favorites.find(f => f.gtfsId === gtfsId), stoptimesWithoutPatterns: [] }));
  container = document.createElement('div');
  root = createRoot(container);
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

  it('the route number of a departure shows the bus on the map (as Near Me)', async () => {
    const now = new Date();
    const secs = now.getHours() * 3600 + now.getMinutes() * 60 + 600;
    getStopById.mockImplementation(async (gtfsId) => ({
      ...favorites.find(f => f.gtfsId === gtfsId),
      stoptimesWithoutPatterns: gtfsId === 'Viro:1' ? [{
        scheduledArrival: secs, realtime: false, headsign: 'Annelinn', stopPosition: 1,
        trip: { route: { shortName: '7', longName: 'Raadi - Annelinn', gtfsId: 'Viro:r7' },
          stoptimes: [{ stop: { gtfsId: 'Viro:1', name: 'Raekoja plats' }, stopPosition: 1, scheduledArrival: secs }] },
      }] : [],
    }));
    const onShowRoute = vi.fn();
    await render({ lat: 58.378, lon: 26.729 }, { onShowRoute });
    await act(async () => container.querySelector('button[aria-label$=": 7"]').click());
    expect(onShowRoute).toHaveBeenCalledWith(expect.objectContaining({ type: 'route', routeNumber: '7', gtfsId: 'Viro:r7' }));
    expect(onShowRoute.mock.calls[0][0].trip.boardStopId).toBe('Viro:1');
  });

  it('with the app\'s route filter keeps every card but shows only the picked routes\' departures', async () => {
    const now = new Date();
    const secs = now.getHours() * 3600 + now.getMinutes() * 60 + 600;
    const departure = (shortName, i) => ({
      scheduledArrival: secs + i * 60, realtime: false, headsign: `Dest ${shortName}`, stopPosition: 1,
      trip: { route: { shortName, longName: `Long ${shortName}`, gtfsId: `Viro:r${shortName}` },
        stoptimes: [{ stop: { gtfsId: 'Viro:1', name: 'Raekoja plats' }, stopPosition: 1, scheduledArrival: secs }] },
    });
    getStopById.mockImplementation(async (gtfsId) => ({
      ...favorites.find(f => f.gtfsId === gtfsId),
      stoptimesWithoutPatterns: gtfsId === 'Viro:1'
        ? ['7', '4', '7', '7', '7', '7'].map(departure)
        : [departure('4', 0)],
    }));
    const routeButtons = () => [...container.querySelectorAll('button[aria-label*=": "]')].map(b => b.textContent);

    await render({ lat: 58.378, lon: 26.729 }, { onShowRoute: vi.fn(), selectedRoutes: new Set(['7']) });
    expect(routeButtons()).toEqual(['7', '7', '7']);
    expect(container.textContent).toContain('Show more (2)');
    expect(container.textContent).toContain('Raekoja plats');
    expect(container.textContent).toContain('Kaubamaja');
    expect(container.textContent).toContain('No upcoming departures');

    await render({ lat: 58.378, lon: 26.729 }, { onShowRoute: vi.fn(), selectedRoutes: new Set() });
    expect(routeButtons()).toEqual(['7', '4', '7', '4']);
    expect(container.textContent).not.toContain('No upcoming departures');
  });

  it('asks for the planned time, and after a failed fetch never shows another time\'s departures as last known', async () => {
    const customTime = new Date(Date.now() + 86400000);
    getStopById.mockImplementation(async (gtfsId) => ({ ...favorites.find(f => f.gtfsId === gtfsId), stoptimesWithoutPatterns: [], source: 'live', fetchedAt: Date.now() }));
    await render({ lat: 58.378, lon: 26.729 });

    // Same time, offline: the last copy stays, flagged
    getStopById.mockResolvedValue(null);
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(container.textContent).toContain('No connection');

    // Planned time, offline: the "now" copy is not shown as its last-known data
    await render({ lat: 58.378, lon: 26.729 }, { customTime });
    expect(getStopById).toHaveBeenLastCalledWith(expect.any(String), customTime);
    expect(container.textContent).not.toContain('No connection');
  });

  it('does not refetch departures when the user moves', async () => {
    await render({ lat: 58.378, lon: 26.729 });
    await render({ lat: 58.380, lon: 26.735 }); // ~400 m away
    await render({ lat: 58.383, lon: 26.740 });
    expect(getStopById).toHaveBeenCalledTimes(2);
  });
});
