import { describe, it, expect } from 'vitest';
import {
  directionColor, stopIconName, favoriteIconName, pointCollection, lineCollection,
  stopPoints, patternLines, journeyLines, journeyCoords, journeyStops,
} from '../mapFeatures';

const noDecode = () => [];

describe('directionColor', () => {
  it('blue for direction 0, yellow for 1, then green and orange, then around again', () => {
    expect([0, 1, 2, 3, 4].map(directionColor)).toEqual(['#0066CC', '#FBBF24', '#10B981', '#F59E0B', '#0066CC']);
  });
  it('a missing or negative direction counts as 0', () => {
    expect(directionColor(undefined)).toBe('#0066CC');
    expect(directionColor(null)).toBe('#0066CC');
    expect(directionColor(-1)).toBe('#0066CC');
  });
});

describe('GeoJSON builders', () => {
  it('pointCollection: [lon, lat] geometry, the rest as properties', () => {
    expect(pointCollection([{ id: 'a', lat: 58.37, lon: 26.72, icon: 'x' }])).toEqual({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [26.72, 58.37] }, properties: { id: 'a', icon: 'x' } }],
    });
  });

  it('lineCollection: [lat, lon] positions become [lon, lat]; a line needs two points', () => {
    const collection = lineCollection([
      { positions: [[58.37, 26.72], [58.38, 26.73]], color: '#0066CC' },
      { positions: [[58.37, 26.72]], color: 'one point' },
      { positions: [], color: 'none' },
    ]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[26.72, 58.37], [26.73, 58.38]] });
    expect(collection.features[0].properties).toEqual({ color: '#0066CC' });
  });
});

describe('stopPoints', () => {
  const stops = [
    { gtfsId: 'plain', lat: 1, lon: 2, adjustedLat: 1.1, adjustedLon: 2.1 },
    { gtfsId: 'near', lat: 1, lon: 2 },
    { gtfsId: 'route', lat: 1, lon: 2 },
    { gtfsId: 'fav', lat: 1, lon: 2 },
    { gtfsId: 'highlighted', lat: 1, lon: 2 },
    { gtfsId: 'nearfav', lat: 1, lon: 2 },
  ];
  const points = stopPoints(stops, {
    nearbyStopIds: new Set(['near', 'route', 'nearfav']),
    highlightedId: 'highlighted',
    stopToPatterns: new Map([['route', [{ directionId: 1 }, { directionId: 0 }]], ['highlighted', [{ directionId: 0 }]]]),
    isFavorite: id => id === 'fav' || id === 'nearfav',
  });
  const icon = id => points.find(p => p.id === id).icon;

  it('blue for any stop, at its spread-out position', () => {
    expect(icon('plain')).toBe(stopIconName('#2563EB', false));
    expect(points.find(p => p.id === 'plain')).toMatchObject({ lat: 1.1, lon: 2.1 });
  });
  it('green and larger when nearby', () => {
    expect(icon('near')).toBe(stopIconName('#10B981', true));
  });
  it('the first pattern\'s direction colour for a stop of a filtered route (wins over nearby; still larger)', () => {
    expect(icon('route')).toBe(stopIconName('#FBBF24', true));
  });
  it('red for the highlighted stop, even on a filtered route', () => {
    expect(icon('highlighted')).toBe(stopIconName('#EF4444', false));
  });
  it('the star for a favourite, larger when nearby', () => {
    expect(icon('fav')).toBe(favoriteIconName(false));
    expect(icon('nearfav')).toBe(favoriteIconName(true));
  });
  it('favourites last (drawn on top), the rest in their order', () => {
    expect(points.map(p => p.id)).toEqual(['plain', 'near', 'route', 'highlighted', 'fav', 'nearfav']);
    expect(points.filter(p => p.favorite).map(p => p.id)).toEqual(['fav', 'nearfav']);
  });
});

describe('patternLines', () => {
  it('follows the road geometry when there is one, else goes stop to stop', () => {
    const lines = patternLines([
      { routeShortName: '1', headsign: 'Nõlvaku', directionId: 0, coordinates: [[1, 2], [3, 4], [5, 6]], stops: [{ lat: 1, lon: 2 }, { lat: 5, lon: 6 }] },
      { routeShortName: '1', headsign: 'Kesklinn', directionId: 1, coordinates: [], stops: [{ lat: 5, lon: 6 }, { lat: 1, lon: 2 }] },
    ]);
    expect(lines).toEqual([
      { positions: [[1, 2], [3, 4], [5, 6]], color: '#0066CC', headsign: 'Nõlvaku', routeName: '1', stopCount: 2 },
      { positions: [[5, 6], [1, 2]], color: '#FBBF24', headsign: 'Kesklinn', routeName: '1', stopCount: 2 },
    ]);
  });
});

// A journey: walk, bus 6 (two stops in between), change at Raekoda to bus 4, walk
const at = (h, m) => new Date(2026, 9, 9, h, m).getTime();
const point = (name, lat, stop = true) => ({ name, lat, lon: 26.7, stop: stop ? { gtfsId: `id:${name}`, name } : null });
const journey = {
  start: new Date(2026, 9, 9, 14, 0).toISOString(),
  end: new Date(2026, 9, 9, 14, 40).toISOString(),
  legs: [
    { mode: 'WALK', from: point('Origin', 58.30, false), to: point('Vaksali', 58.31), geometry: 'walk1' },
    { mode: 'BUS', route: { shortName: '6' }, startTime: at(14, 5), endTime: at(14, 17), from: point('Vaksali', 58.31), to: point('Raekoda', 58.34),
      intermediateStops: [{ name: 'Riia', lat: 58.32, lon: 26.7 }, { name: 'Kesklinn', lat: 58.33, lon: 26.7 }] },
    { mode: 'BUS', route: { shortName: '4' }, startTime: at(14, 21), endTime: at(14, 33), from: point('Raekoda', 58.34), to: point('Annelinn', 58.36), intermediateStops: [] },
    { mode: 'WALK', from: point('Annelinn', 58.36), to: point('Destination', 58.37, false) },
  ],
};

describe('journeyLines / journeyCoords', () => {
  const decode = (geometry) => geometry === 'walk1' ? [[58.301, 26.7], [58.305, 26.7]] : [];
  const lines = journeyLines(journey, decode);

  it('one line per leg: walking green, thin and dashed; the bus blue and wider', () => {
    expect(lines.map(({ color, width, dashed }) => ({ color, width, dashed }))).toEqual([
      { color: '#10B981', width: 4, dashed: true },
      { color: '#3B82F6', width: 6, dashed: false },
      { color: '#3B82F6', width: 6, dashed: false },
      { color: '#10B981', width: 4, dashed: true },
    ]);
  });
  it('uses the leg geometry, or a straight line from start to end without one', () => {
    expect(lines[0].positions).toEqual([[58.301, 26.7], [58.305, 26.7]]);
    expect(lines[1].positions).toEqual([[58.31, 26.7], [58.34, 26.7]]);
  });
  it('journeyCoords: every start, geometry point and end, for fitting the map', () => {
    const coords = journeyCoords(journey, decode);
    expect(coords).toHaveLength(4 * 2 + 2);
    expect(coords[0]).toEqual([58.30, 26.7]);
    expect(coords[coords.length - 1]).toEqual([58.37, 26.7]);
  });
  it('nothing for no journey', () => {
    expect(journeyLines(null, noDecode)).toEqual([]);
    expect(journeyCoords(undefined, noDecode)).toEqual([]);
    expect(journeyStops(null)).toEqual([]);
  });
});

describe('journeyStops', () => {
  const stops = journeyStops(journey);
  const byKind = kind => stops.filter(s => s.kind === kind);

  it('the stops of the bus legs in order, the transfer stop only once', () => {
    expect(stops.map(s => `${s.kind}:${s.name}`)).toEqual([
      'board:Vaksali', 'mid:Riia', 'mid:Kesklinn', 'transfer:Raekoda', 'alight:Annelinn',
    ]);
  });
  it('the first boarding stop is labelled, with route and time', () => {
    expect(byKind('board')[0]).toMatchObject({ permanent: true, first: true, large: true, route: '6', time: '14:05', lat: 58.31 });
  });
  it('stops in between: small, on tap, their times spread evenly over the leg', () => {
    expect(byKind('mid').map(s => [s.permanent, s.large, s.route, s.time])).toEqual([
      [false, false, '6', '14:08'],
      [false, false, '6', '14:11'],
    ]);
  });
  it('the transfer stop is labelled with both buses', () => {
    expect(byKind('transfer')[0]).toMatchObject({ permanent: true, large: true, route: '6', time: '14:17', nextRoute: '4', nextTime: '14:21' });
  });
  it('the last stop is labelled as the place to get off', () => {
    expect(byKind('alight')[0]).toMatchObject({ permanent: true, last: true, large: true, route: '4', time: '14:33' });
  });

  it('changing buses at different stops: the first alighting and the second boarding stop open on tap', () => {
    const legs = [
      journey.legs[1],
      { mode: 'WALK', from: point('Raekoda', 58.34), to: point('Kaubamaja', 58.345) },
      { ...journey.legs[2], from: point('Kaubamaja', 58.345) },
    ];
    const two = journeyStops({ ...journey, legs });
    expect(two.filter(s => s.kind !== 'mid').map(s => [s.kind, s.name, s.permanent])).toEqual([
      ['board', 'Vaksali', true],
      ['alight', 'Raekoda', false],
      ['board', 'Kaubamaja', false],
      ['alight', 'Annelinn', true],
    ]);
    expect(two.find(s => s.name === 'Raekoda').last).toBe(false);
  });

  it('a leg without its own times uses the journey\'s', () => {
    const only = journeyStops({ ...journey, legs: [{ ...journey.legs[2], startTime: undefined, endTime: undefined }] });
    expect(only.map(s => s.time)).toEqual(['14:00', '14:40']);
  });
});
