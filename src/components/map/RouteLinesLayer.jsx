// The lines of the filtered routes: one per pattern, in its direction's colour on a white casing,
// with arrows along it. A tap on a line tells which route and direction it is.
import { useEffect, useMemo, useRef } from 'react';
import { Popup } from 'maplibre-gl';
import { lineCollection } from '../../utils/mapFeatures';
import { useMapContext, useGeoJsonLayers, useMapEvent, ABOVE_LINES } from './mapContext';
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

const line = (className, text, color) => {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  if (color) div.style.color = color;
  return div;
};

/** @param lines - [{ positions: [[lat, lon]], color, headsign, routeName, stopCount }] (see patternLines) */
function RouteLinesLayer({ lines }) {
  const { map } = useMapContext();
  // `lines` is long (road geometry): the caller keeps it the same object while nothing changed
  const data = useMemo(
    () => lineCollection(lines.map(l => ({ ...l, arrow: arrowIconName(l.color) }))),
    [lines]
  );

  useGeoJsonLayers({ sourceId: SOURCE, data, layers: LAYERS, below: ABOVE_LINES, icons });

  // The open popup goes when the lines do
  const popupRef = useRef(null);
  useEffect(() => () => popupRef.current?.remove(), []);

  useMapEvent('click', 'route-line', (e) => {
    const { color, routeName, headsign, stopCount } = e.features[0].properties;
    const content = document.createElement('div');
    content.className = 'text-sm';
    content.append(
      line('font-bold', `Route ${routeName}`, color),
      line('text-gray-700 font-semibold', `→ ${headsign}`),
      line('text-xs text-gray-500 mt-1', `${stopCount} stops`),
    );
    popupRef.current?.remove();
    popupRef.current = new Popup({ focusAfterOpen: false }).setLngLat(e.lngLat).setDOMContent(content).addTo(map);
  });

  return null;
}

export default RouteLinesLayer;
