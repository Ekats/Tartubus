// The lines of the filtered routes: one per pattern, in its direction's colour on a white casing,
// with arrows along it. A tap on a line is a tap on the map (lines take no taps of their own).
import { useMemo } from 'react';
import { lineCollection } from '../../utils/mapFeatures';
import { useGeoJsonLayers, ABOVE_LINES } from './mapContext';
import { arrowIconName } from './mapIcons';

const SOURCE = 'route-lines';
const round = { 'line-cap': 'round', 'line-join': 'round' };
const LAYERS = [
  { id: 'route-line-casing', type: 'line', layout: round, paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 } },
  { id: 'route-line', type: 'line', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 } },
  {
    id: 'route-line-arrows',
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 100,
      'icon-image': ['get', 'arrow'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];
const icons = (data) => data.features.map(feature => feature.properties.arrow);

/** @param lines - [{ positions: [[lat, lon]], color }] (see patternLines) */
function RouteLinesLayer({ lines }) {
  // `lines` is long (road geometry): the caller keeps it the same object while nothing changed
  const data = useMemo(
    () => lineCollection(lines.map(l => ({ ...l, arrow: arrowIconName(l.color) }))),
    [lines]
  );

  useGeoJsonLayers({ sourceId: SOURCE, data, layers: LAYERS, below: ABOVE_LINES, icons });

  return null;
}

export default RouteLinesLayer;
