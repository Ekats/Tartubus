// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildRoutesFile } from '../fetchRoutes.js';

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
