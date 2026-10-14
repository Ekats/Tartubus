// The stops of a shown trip or journey: yellow stop icons drawn by the map, and white boxes (HTML)
// with the stop's name and time - always shown for the stops marked `permanent`, and for one other
// stop at a time after a tap on it (that box has a ×; a tap on the map closes it too).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pointCollection, stopIconName, STOP_COLOR_TRIP } from '../../utils/mapFeatures';
import { useMapContext, useGeoJsonLayers, useMapEvent, useClickableLayers, useStableValue } from './mapContext';
import MapMarker from './MapMarker';

const icons = (data) => data.features.map(feature => feature.properties.icon);
// The box's pointer ends at the stop's centre for a permanent label, at the icon's top edge for a tapped one
const LABEL_OFFSET = [0, -6];
const tappedOffset = (large) => [0, -(large ? 16 : 12) - 6];

/**
 * @param id - names the source and layer (two of these can be on the map)
 * @param markers - [{ key, lat, lon, large, permanent, first }]
 * @param renderBody(marker) - the box's content
 * @param onLabelsDrawn() - the always-shown boxes are on the map (again, after a change)
 */
function StopBoxesLayer({ id, markers, renderBody, onLabelsDrawn }) {
  const { t } = useTranslation();
  const { map } = useMapContext();
  const [openKey, setOpenKey] = useState(null);
  const layerId = `${id}-stops`;
  const layers = useMemo(() => [{
    id: layerId,
    type: 'symbol',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      // The larger (boarding, transfer, last) stops on top of the ones in between
      'symbol-sort-key': ['case', ['get', 'large'], 1, 0],
    },
  }], [layerId]);

  const points = useStableValue(markers.map(m => ({
    key: m.key, lat: m.lat, lon: m.lon, large: !!m.large, permanent: !!m.permanent,
    icon: stopIconName(STOP_COLOR_TRIP, !!m.large),
  })));
  const data = useMemo(() => pointCollection(points), [points]);

  useGeoJsonLayers({ sourceId: layerId, data, layers, icons });
  useClickableLayers([layerId]);

  useMapEvent('click', layerId, (e) => {
    const { key, permanent } = e.features[0].properties;
    setOpenKey(permanent ? null : key);
  });
  useMapEvent('click', null, (e) => {
    if (map.getLayer(layerId) && map.queryRenderedFeatures(e.point, { layers: [layerId] }).length > 0) return;
    setOpenKey(null);
  });

  // After the boxes' own markers were made (children's effects run first)
  const labelsKey = JSON.stringify(markers.filter(m => m.permanent).map(m => [m.key, m.lat, m.lon, m.name, m.time]));
  const onLabelsDrawnRef = useRef(onLabelsDrawn);
  onLabelsDrawnRef.current = onLabelsDrawn;
  useEffect(() => {
    onLabelsDrawnRef.current?.();
  }, [labelsKey]);

  // Another trip or journey: its stops have other keys
  const open = markers.find(m => m.key === openKey && !m.permanent);
  useEffect(() => {
    if (openKey && !open) setOpenKey(null);
  }, [openKey, open]);

  return (
    <>
      {markers.filter(m => m.permanent).map(m => (
        <MapMarker
          key={m.key}
          lat={m.lat}
          lon={m.lon}
          anchor="bottom"
          offset={LABEL_OFFSET}
          className={`journey-stop-box journey-stop-label${m.first ? ' journey-stop-first' : ''}`}
        >
          <div className="text-xs font-semibold">{renderBody(m)}</div>
        </MapMarker>
      ))}
      {open && (
        <MapMarker
          key={open.key}
          lat={open.lat}
          lon={open.lon}
          anchor="bottom"
          offset={tappedOffset(open.large)}
          className="journey-stop-box journey-stop-tapped"
          onClick={() => {}}
        >
          <div className="text-xs font-semibold">{renderBody(open)}</div>
          <button type="button" className="journey-stop-close" aria-label={t('common.close')} onClick={() => setOpenKey(null)}>×</button>
        </MapMarker>
      )}
    </>
  );
}

export default StopBoxesLayer;
