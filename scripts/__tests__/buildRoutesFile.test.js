// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildRoutesFile, buildStopsFile } from '../fetchRoutes.js';
import { mergeDuplicateStops } from '../../src/utils/geo.js';

const route = (gtfsId, lat, lon) => ({
  gtfsId, shortName: gtfsId.split(':')[1], patterns: [{ stops: [{ lat, lon }] }],
});
const tartu = route('Viro:2', 58.38, 26.72);
const tallinn = route('Viro:1', 59.43, 24.75);
const parnu = route('Viro:3', 58.385, 24.497); // Outside every city zone

describe('buildRoutesFile', () => {
  it('keeps only routes that serve a city zone, sorted by gtfsId', () => {
    const file = JSON.parse(buildRoutesFile([tartu, parnu, tallinn]));
    expect(file.routes.map(r => r.gtfsId)).toEqual(['Viro:1', 'Viro:2']);
    expect(file.routeCount).toBe(2);
    expect(file.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null when the routes are unchanged, even in a different order', () => {
    const first = buildRoutesFile([tartu, tallinn], null, new Date('2026-09-20T03:00:00Z'));
    expect(buildRoutesFile([tallinn, tartu, parnu], first, new Date('2026-09-21T03:00:00Z'))).toBeNull();
  });

  it('writes a new file when a route changes', () => {
    const first = buildRoutesFile([tartu, tallinn]);
    const moved = route('Viro:2', 58.37, 26.73);
    const next = buildRoutesFile([moved, tallinn], first);
    expect(next).not.toBeNull();
    expect(JSON.parse(next).contentHash).not.toBe(JSON.parse(first).contentHash);
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
