// The one place that knows how the map logic's numbers relate to MapLibre's.
//
// "App zoom" is the zoom the stop logic was written for (Leaflet's: whole numbers on 256 px tiles):
// the stop radius per zoom, the spread of overlapping stops, where clustering ends. MapLibre counts
// zoom on 512 px tiles, so the same view is one level lower there, and it zooms continuously.

export const toAppZoom = (mapZoom) => Math.round(mapZoom + 1);
export const toMapZoom = (appZoom) => appZoom - 1;

// Limits and defaults of the map screen, in app zoom
export const APP_START_ZOOM = 13;
export const APP_MAX_ZOOM = 18;
export const APP_FIT_MAX_ZOOM = 15; // fit-to-route / fit-to-journey never zooms in further
export const APP_NO_CLUSTER_ZOOM = 15; // stops are not clustered from here on

/** A MapLibre LngLatBounds as the plain object the stop logic filters with */
export const toBounds = (lngLatBounds) => ({
  north: lngLatBounds.getNorth(),
  south: lngLatBounds.getSouth(),
  east: lngLatBounds.getEast(),
  west: lngLatBounds.getWest(),
});

/**
 * The box around a list of [lat, lon] pairs, as MapLibre wants it: [[west, south], [east, north]].
 * null for an empty list.
 */
export function boundsOfCoords(coords) {
  const valid = (coords || []).filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (valid.length === 0) return null;
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const [lat, lon] of valid) {
    south = Math.min(south, lat); north = Math.max(north, lat);
    west = Math.min(west, lon); east = Math.max(east, lon);
  }
  return [[west, south], [east, north]];
}
