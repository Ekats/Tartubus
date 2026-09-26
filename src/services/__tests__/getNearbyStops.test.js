import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let getNearbyStops;

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
  ({ getNearbyStops } = await import('../digitransit'));
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
