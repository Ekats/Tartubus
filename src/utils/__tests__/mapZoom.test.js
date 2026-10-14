import { describe, it, expect } from 'vitest';
import { toAppZoom, toMapZoom, toBounds, boundsOfCoords, APP_NO_CLUSTER_ZOOM } from '../mapZoom';

describe('app zoom <-> map zoom', () => {
  it('the map counts one level lower than the app logic', () => {
    expect(toMapZoom(13)).toBe(12);
    expect(toMapZoom(18)).toBe(17);
    expect(toAppZoom(12)).toBe(13);
    expect(toAppZoom(toMapZoom(15))).toBe(15);
  });

  it('a continuous map zoom becomes the nearest whole app zoom', () => {
    expect(toAppZoom(13.4)).toBe(14);
    expect(toAppZoom(13.5)).toBe(15);
    expect(toAppZoom(13.6)).toBe(15);
    expect(toAppZoom(10.38)).toBe(11);
  });

  it('clustering ends where the app says: clusters up to map zoom 11.x, none from 12', () => {
    // StopsLayer gets clusterMaxZoom = toMapZoom(APP_NO_CLUSTER_ZOOM) - 1
    expect(toMapZoom(APP_NO_CLUSTER_ZOOM) - 1).toBe(11);
  });
});

describe('toBounds', () => {
  it('turns a MapLibre bounds object into north/south/east/west', () => {
    const lngLatBounds = { getNorth: () => 58.4, getSouth: () => 58.3, getEast: () => 26.8, getWest: () => 26.6 };
    expect(toBounds(lngLatBounds)).toEqual({ north: 58.4, south: 58.3, east: 26.8, west: 26.6 });
  });
});

describe('boundsOfCoords', () => {
  it('gives [[west, south], [east, north]] for [lat, lon] pairs', () => {
    expect(boundsOfCoords([[58.37, 26.72], [58.35, 26.78], [58.39, 26.70]]))
      .toEqual([[26.70, 58.35], [26.78, 58.39]]);
  });

  it('is null for nothing to fit', () => {
    expect(boundsOfCoords([])).toBeNull();
    expect(boundsOfCoords(undefined)).toBeNull();
  });

  it('skips broken points', () => {
    expect(boundsOfCoords([[58.37, 26.72], [undefined, 26.9], null, [58.38, NaN]]))
      .toEqual([[26.72, 58.37], [26.72, 58.37]]);
  });
});
