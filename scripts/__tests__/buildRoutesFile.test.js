// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildRoutesFile, buildStopsFile, routeIdsForZones } from '../fetchRoutes.js';
import { mergeDuplicateStops, CITY_ZONES } from '../../src/utils/geo.js';

const route = (gtfsId, lat, lon) => ({
  gtfsId, shortName: gtfsId.split(':')[1], patterns: [{ stops: [{ lat, lon }] }],
});
const tartu = route('Viro:2', 58.38, 26.72);
const tartuWest = route('Viro:1', 58.37, 26.68);
const tallinn = route('Viro:4', 59.43, 24.75); // Outside every city zone - the app is Tartu-only
const parnu = route('Viro:3', 58.385, 24.497); // Outside every city zone

describe('buildRoutesFile', () => {
  it('keeps only routes that serve a city zone, sorted by gtfsId', () => {
    const file = JSON.parse(buildRoutesFile([tartu, parnu, tartuWest, tallinn]));
    expect(file.routes.map(r => r.gtfsId)).toEqual(['Viro:1', 'Viro:2']);
    expect(file.routeCount).toBe(2);
    expect(file.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null when the routes are unchanged, even in a different order', () => {
    const first = buildRoutesFile([tartu, tartuWest], null, new Date('2026-09-20T03:00:00Z'));
    expect(buildRoutesFile([tartuWest, tartu, parnu, tallinn], first, new Date('2026-09-21T03:00:00Z'))).toBeNull();
  });

  it('writes a new file when a route changes', () => {
    const first = buildRoutesFile([tartu, tartuWest]);
    const moved = route('Viro:2', 58.37, 26.73);
    const next = buildRoutesFile([moved, tartuWest], first);
    expect(next).not.toBeNull();
    expect(JSON.parse(next).contentHash).not.toBe(JSON.parse(first).contentHash);
  });
});

describe('routeIdsForZones', () => {
  const zones = Object.values(CITY_ZONES);
  const stop = (lat, lon, ...routeIds) => ({ gtfsId: `s:${lat},${lon}`, lat, lon, routes: routeIds.map(gtfsId => ({ gtfsId })) });

  it('ignores a stop inside the bounding box but outside the zone radius', () => {
    // The box corner is ~11.3 km from the centre of the 8 km Tartu zone
    const { center, radius } = CITY_ZONES.tartu;
    const dLat = radius / 111320;
    const dLon = radius / (111320 * Math.cos(center.lat * Math.PI / 180));
    const corner = stop(center.lat + dLat, center.lon + dLon, 'Viro:corner');

    expect(routeIdsForZones([corner, stop(center.lat, center.lon, 'Viro:middle')], zones)).toEqual(['Viro:middle']);
  });

  it('deduplicates and sorts the ids', () => {
    const { center } = CITY_ZONES.tartu;
    const stops = [
      stop(center.lat, center.lon, 'Viro:7', 'Viro:4'),
      stop(center.lat + 0.001, center.lon, 'Viro:4', 'Viro:12'),
    ];

    expect(routeIdsForZones(stops, zones)).toEqual(['Viro:12', 'Viro:4', 'Viro:7']);
  });

  it('returns nothing for no stops, and for stops that serve no route', () => {
    const { center } = CITY_ZONES.tartu;
    expect(routeIdsForZones([], zones)).toEqual([]);
    expect(routeIdsForZones([{ gtfsId: 's:1', lat: center.lat, lon: center.lon }], zones)).toEqual([]);
  });
});

describe('buildStopsFile', () => {
  const stop = (gtfsId, code, lat, lon) => ({ gtfsId, name: `Stop ${code}`, code, lat, lon, extra: 'dropped' });
  const routes = [
    { gtfsId: 'Viro:r2', patterns: [{ stops: [stop('Viro:20', 'B-1', 58.38, 26.72), stop('Viro:99', 'Z-1', 58.385, 24.497)] }] },
    { gtfsId: 'Viro:r1', patterns: [{ stops: [stop('Viro:10', 'A-1', 58.37, 26.74), stop('Viro:20', 'B-1', 58.38, 26.72)] }] },
  ];

  it('lists each stop inside a city zone once, sorted by gtfsId, with only the map fields', () => {
    const stops = JSON.parse(buildStopsFile(routes));
    expect(stops).toEqual([
      { gtfsId: 'Viro:10', name: 'Stop A-1', code: 'A-1', lat: 58.37, lon: 26.74 },
      { gtfsId: 'Viro:20', name: 'Stop B-1', code: 'B-1', lat: 58.38, lon: 26.72 },
    ]);
  });

  it('returns null when the stops are unchanged', () => {
    const first = buildStopsFile(routes);
    expect(buildStopsFile([...routes].reverse(), first)).toBeNull();
  });

  it('writes a new file when the feed renumbers a stop', () => {
    const first = buildStopsFile(routes);
    const renumbered = [{ gtfsId: 'Viro:r1', patterns: [{ stops: [stop('Viro:431', 'A-1', 58.37, 26.74)] }] }];
    expect(JSON.parse(buildStopsFile(renumbered, first)).map(s => s.gtfsId)).toEqual(['Viro:431']);
  });
});

describe('mergeDuplicateStops', () => {
  const departure = [{ scheduledArrival: 1 }];

  it('merges an old bundled stop with its renumbered live copy, keeping the one with departures', () => {
    const bundled = { gtfsId: 'Viro:25598', code: '7820134-1', name: 'Lootuse', stoptimesWithoutPatterns: [] };
    const live = { gtfsId: 'Viro:431433', code: '7820134-1', name: 'Lootuse', stoptimesWithoutPatterns: departure };
    const other = { gtfsId: 'Viro:5', code: '7820001-1', name: 'Other', stoptimesWithoutPatterns: [] };

    expect(mergeDuplicateStops([bundled, other, live])).toEqual([live, other]);
    expect(mergeDuplicateStops([live, other, bundled])).toEqual([live, other]);
  });

  it('keeps stops without a code apart by gtfsId', () => {
    const a = { gtfsId: 'Viro:1', name: 'Ropka' };
    const b = { gtfsId: 'Viro:2', name: 'Ropka' };
    expect(mergeDuplicateStops([a, b, a])).toEqual([a, b]);
  });
});
