// The map data that ships with the app (public/map/, built by scripts/buildMapTiles.mjs): VersaTiles
// vector tiles of Estonia (zoom 6-9) and of the Tartu area (zoom 10-14), the fonts and the icons.
// index.json in that folder lists which tiles and font ranges exist.

export const MAP_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>' +
  ' · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank">CC BY 4.0</a>' +
  ' <a href="https://esa-worldcover.org/en/data-access" target="_blank">ESA WorldCover 2021</a>';

/**
 * Is this file in the map data? `file` is the path inside the folder:
 * "tiles/{z}/{x}/{y}.pbf" or "glyphs/{font}/{range}.pbf".
 */
export function isInMapData(index, file) {
  const [kind, ...rest] = file.split('/');
  if (kind === 'tiles' && rest.length === 3) {
    const [z, x, y] = rest.map(part => parseInt(part, 10));
    const range = index.tileRanges?.[z];
    return !!range && x >= range[0] && y >= range[1] && x <= range[2] && y <= range[3];
  }
  if (kind === 'glyphs' && rest.length === 2) {
    return (index.glyphRanges || []).includes(rest[1].replace(/\.pbf$/, ''));
  }
  return false;
}

/** The index's `bounds` (lon_min, lat_min, lon_max, lat_max) as MapLibre's maxBounds */
export const toMaxBounds = (bounds) => [[bounds[0], bounds[1]], [bounds[2], bounds[3]]];
