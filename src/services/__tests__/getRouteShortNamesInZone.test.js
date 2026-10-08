import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CITY_ZONES } from '../../utils/geo';

let getRouteShortNamesInZone;

const route = (gtfsId, shortName, lat, lon) => ({ gtfsId, shortName, patterns: [{ stops: [{ lat, lon }] }] });
const ROUTES = [
  route('Viro:1', '4', 58.37, 26.74),   // Tartu
  route('Viro:2', '7', 58.38, 26.72),   // Tartu
  route('Viro:3', '7', 58.39, 26.70),   // Tartu, same number in the other direction
  route('Viro:4', '4', 59.41, 24.66),   // Tallinn, outside every zone the app ships
  route('Viro:5', '72C', 57.98, 27.62), // Värska, outside every zone
];

// Not a zone the app ships - a second zone, so the filter is shown to be per-zone
const ELSEWHERE = { name: 'Elsewhere', center: { lat: 59.4370, lon: 24.7536 }, radius: 20000 };

let fetchMock;
beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: ROUTES }) });
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules(); // fresh route caches per test
  ({ getRouteShortNamesInZone } = await import('../digitransit'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getRouteShortNamesInZone', () => {
  it('lists each route number serving the zone once, without departures loaded', async () => {
    // Viro:4 (Tallinn) and Viro:5 (Värska) are outside Tartu, so neither shows up
    expect((await getRouteShortNamesInZone(CITY_ZONES.tartu)).sort()).toEqual(['4', '7']);
    expect(await getRouteShortNamesInZone(ELSEWHERE)).toEqual(['4']);
  });

  it('loads the route file once', async () => {
    await getRouteShortNamesInZone(CITY_ZONES.tartu);
    await getRouteShortNamesInZone(CITY_ZONES.tartu);
    await getRouteShortNamesInZone(ELSEWHERE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
