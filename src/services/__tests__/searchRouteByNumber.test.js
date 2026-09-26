import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchRouteByNumber } from '../digitransit';
import { CITY_ZONES } from '../../utils/geo';

// Real-shaped routes: every Estonian route uses the 'Viro:' feed prefix,
// and the same route number exists in several cities.
const tartuRoute4 = {
  gtfsId: 'Viro:254190', shortName: '4', longName: 'Ringtee - Kummeli',
  patterns: [{ stops: [{ lat: 58.3700, lon: 26.7400 }, { lat: 58.3900, lon: 26.7000 }] }],
};
const tallinnRoute4 = {
  gtfsId: 'Viro:253081', shortName: '4', longName: 'Väike-Õismäe - Tiskre',
  patterns: [{ stops: [{ lat: 59.4100, lon: 24.6600 }] }],
};
const tartuRoute41 = {
  gtfsId: 'Viro:254999', shortName: '41', longName: 'Some other line',
  patterns: [{ stops: [{ lat: 58.3776, lon: 26.7290 }] }],
};

function mockRoutesResponse(routes) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { routes } }),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchRouteByNumber', () => {
  it('returns the Tartu route with that number, not other cities\' routes', async () => {
    mockRoutesResponse([tartuRoute4, tallinnRoute4, tartuRoute41]);

    const routes = await searchRouteByNumber('4');

    expect(routes.map(r => r.gtfsId)).toEqual(['Viro:254190']);
  });

  it('searches another zone when asked', async () => {
    mockRoutesResponse([tartuRoute4, tallinnRoute4]);

    const routes = await searchRouteByNumber('4', CITY_ZONES.tallinn);

    expect(routes.map(r => r.gtfsId)).toEqual(['Viro:253081']);
  });
});
