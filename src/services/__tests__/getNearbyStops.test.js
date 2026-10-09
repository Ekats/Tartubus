import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let getNearbyStops, getNearbyStopsWithMeta, getStopById, initializeCaches;

// One Tartu stop with one departure of route 4, ten minutes from now
function stopsResponse() {
  const now = new Date();
  const inTenMinutes = now.getHours() * 3600 + now.getMinutes() * 60 + 600;
  return {
    data: {
      stopsByRadius: {
        edges: [{
          node: {
            distance: 120,
            stop: {
              gtfsId: 'Viro:1', name: 'Raekoja plats', code: '1', lat: 58.3800, lon: 26.7220,
              stoptimesWithoutPatterns: [{
                scheduledArrival: inTenMinutes, scheduledDeparture: inTenMinutes,
                realtimeArrival: inTenMinutes, realtimeDeparture: inTenMinutes,
                arrivalDelay: 0, departureDelay: 0, realtime: false,
                headsign: 'Kummeli', stopPosition: 1,
                trip: {
                  route: { shortName: '4', longName: 'Ringtee - Kummeli', gtfsId: 'Viro:254190' },
                  stoptimes: [{ stop: { gtfsId: 'Viro:1', name: 'Raekoja plats' }, stopPosition: 1, scheduledArrival: inTenMinutes }],
                },
              }],
            },
          },
        }],
      },
    },
  };
}

let fetchMock;
beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn().mockImplementation(async () => ({ ok: true, json: async () => stopsResponse() }));
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules(); // fresh in-flight request map per test
  ({ getNearbyStops, getNearbyStopsWithMeta, getStopById, initializeCaches } = await import('../digitransit'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sentStartTime = call => JSON.parse(fetchMock.mock.calls[call][1].body).variables.startTime;

describe('getNearbyStops cache', () => {
  it('does not answer a planned-time query with cached "now" data', async () => {
    await getNearbyStops(58.38, 26.72, 500);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

    await getNearbyStops(58.38, 26.72, 500, false, tomorrow);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentStartTime(1)).toBe(Math.floor(tomorrow.getTime() / 1000) - 600);
  });

  it('does not reuse data fetched 300 m away', async () => {
    // ~290 m apart, but inside the same old ~1 km cache cell (both round to 58.38 / 26.72)
    await getNearbyStops(58.3800, 26.7160, 500);
    await getNearbyStops(58.3800, 26.7210, 500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recomputes distances from the caller\'s point on a cache hit', async () => {
    const first = await getNearbyStops(58.38000, 26.72000, 500);
    const second = await getNearbyStops(58.38040, 26.72040, 500); // same ~110 m cell

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second[0].distance).not.toBe(first[0].distance);
  });

  it('keeps route numbers when falling back to cached data offline', async () => {
    await getNearbyStops(58.38, 26.72, 500);
    fetchMock.mockRejectedValue(new Error('offline'));

    const stops = await getNearbyStops(58.38, 26.72, 500, true); // forced refresh fails

    expect(stops[0].stoptimesWithoutPatterns[0].trip.route.shortName).toBe('4');
  });
});

describe('getNearbyStopsWithMeta last-known fallback', () => {
  it('returns live data flagged live with the request time', async () => {
    const before = Date.now();
    const result = await getNearbyStopsWithMeta(58.38, 26.72, 500);

    expect(result.source).toBe('live');
    expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it('still has the last-known stops after the app restarts without a connection', async () => {
    initializeCaches(); // first launch (one-time migration)
    const online = await getNearbyStopsWithMeta(58.38, 26.72, 500);
    initializeCaches(); // the app is closed and opened again
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const offline = await getNearbyStopsWithMeta(58.38, 26.72, 500, true);

    expect(offline.source).toBe('stale');
    expect(offline.fetchedAt).toBe(online.fetchedAt);
    expect(offline.stops.map(s => s.name)).toEqual(['Raekoja plats']);
  });

  it('throws as before when the network fails and nothing is cached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getNearbyStopsWithMeta(58.38, 26.72, 500)).rejects.toThrow('Failed to fetch');
  });

  it('does not show a copy older than 12 hours', async () => {
    await getNearbyStopsWithMeta(58.38, 26.72, 500);
    const key = Object.keys(localStorage).find(k => k.startsWith('stops_'));
    const entry = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...entry, timestamp: Date.now() - 13 * 3600 * 1000 }));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getNearbyStopsWithMeta(58.38, 26.72, 500, true)).rejects.toThrow('Failed to fetch');
  });

  it('is live again as soon as a fetch succeeds', async () => {
    await getNearbyStopsWithMeta(58.38, 26.72, 500);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await getNearbyStopsWithMeta(58.38, 26.72, 500, true)).source).toBe('stale');

    expect((await getNearbyStopsWithMeta(58.38, 26.72, 500, true)).source).toBe('live');
  });

  it('keeps the plain getNearbyStops returning just the stops', async () => {
    expect(Array.isArray(await getNearbyStops(58.38, 26.72, 500))).toBe(true);
  });
});

describe('getStopById last-known fallback (Favorites)', () => {
  const stopResponse = () => ({ data: { stop: stopsResponse().data.stopsByRadius.edges[0].node.stop } });

  beforeEach(() => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => stopResponse() }));
  });

  it('returns the last-known departures flagged stale when the network fails, also after a restart', async () => {
    initializeCaches(); // first launch (one-time migration)
    const online = await getStopById('Viro:1');
    expect(online.source).toBe('live');
    initializeCaches(); // the app is closed and opened again
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const offline = await getStopById('Viro:1');

    expect(offline.source).toBe('stale');
    expect(offline.fetchedAt).toBe(online.fetchedAt);
    expect(offline.stoptimesWithoutPatterns[0].trip.route.shortName).toBe('4');
  });

  it('returns null as before when the network fails and nothing is cached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await getStopById('Viro:1')).toBeNull();
  });

  it('is live again after a successful fetch', async () => {
    await getStopById('Viro:1');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await getStopById('Viro:1')).source).toBe('stale');

    expect((await getStopById('Viro:1')).source).toBe('live');
  });

  it('never caches or falls back for a planned-time query', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    await getStopById('Viro:1', tomorrow);
    expect(Object.keys(localStorage).some(k => k.startsWith('stopdep_'))).toBe(false);

    await getStopById('Viro:1'); // fills the cache
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await getStopById('Viro:1', tomorrow)).toBeNull();
  });
});

describe('getNearbyStops refresh timing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is fresh at the 30 s refresh and expired at the 60 s one, even after a slow response', async () => {
    vi.useFakeTimers();
    // The response takes 8 s to arrive
    fetchMock.mockImplementationOnce(() => new Promise(resolve => setTimeout(
      () => resolve({ ok: true, json: async () => stopsResponse() }), 8000)));

    const first = getNearbyStops(58.3800, 26.7220, 500);
    await vi.advanceTimersByTimeAsync(8000);
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(22000); // 30 s after the request
    await getNearbyStops(58.3800, 26.7220, 500);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from the cache

    await vi.advanceTimersByTimeAsync(30000); // 60 s after the request
    await getNearbyStops(58.3800, 26.7220, 500);
    expect(fetchMock).toHaveBeenCalledTimes(2); // new data
  });
});
