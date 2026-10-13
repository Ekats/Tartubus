import { createContext, useContext, useEffect, useRef } from 'react';
import { ensureIcons } from './mapIcons';
import { mapIsAlive, styleIsReady } from './mapState';

const EMPTY = { type: 'FeatureCollection', features: [] };

// What MapView hands to the layers inside it:
//   map          - the MapLibre map
//   styleVersion - goes up every time a style has loaded. A new style (theme, light <-> dark) drops
//                  every source, layer and image, so the layers add theirs again when it changes.
//   clickable    - ids of the layers whose features take a tap themselves; a tap on one of them is
//                  not a tap "on the map"
export const MapContext = createContext(null);
export const useMapContext = () => useContext(MapContext);

// Layers are stacked in the order they are added. These two empty layers (added by MapView with every
// style) fix the order whatever is added when: lines go under ABOVE_LINES, everything else on top.
export const ABOVE_LINES = 'app-above-lines';

export { mapIsAlive, styleIsReady };

export function removeLayers(map, layerIds, sourceId) {
  if (!mapIsAlive(map)) return;
  for (const id of layerIds) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (sourceId && map.getSource(sourceId)) map.removeSource(sourceId);
}

/**
 * A GeoJSON source with its layers, kept on the map while the component is mounted:
 * added now and after every style load, removed on unmount, the data replaced when it changes.
 * `layers` are layer specs without `source`; `below` is a layer id to put them under.
 */
export function useGeoJsonLayers({ sourceId, data, sourceOptions, layers, below, icons }) {
  const { map, styleVersion } = useMapContext();
  const dataRef = useRef(data);
  dataRef.current = data;
  const layerIds = layers.map(layer => layer.id);
  const applied = useRef(0);

  // `icons(data)` names the pictures the data's features use: they are put into the style before the
  // data, because a feature laid out without its picture stays without it
  const apply = (next) => {
    const seq = ++applied.current;
    const names = icons ? icons(next) : [];
    const setData = () => { if (mapIsAlive(map)) map.getSource(sourceId)?.setData(next); };
    if (names.every(name => map.hasImage(name))) {
      setData();
    } else {
      ensureIcons(map, names)
        .then(ok => { if (ok && seq === applied.current) setData(); })
        .catch(err => console.error('Map icons:', err));
    }
  };

  useEffect(() => {
    if (!styleIsReady(map) || map.getSource(sourceId)) return undefined;
    map.addSource(sourceId, { type: 'geojson', data: EMPTY, ...sourceOptions });
    for (const layer of layers) {
      map.addLayer({ ...layer, source: sourceId }, below && map.getLayer(below) ? below : undefined);
    }
    apply(dataRef.current);
    return () => removeLayers(map, layerIds, sourceId);
    // The layer specs are constants of the calling component
  }, [map, styleVersion, sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (styleIsReady(map) && map.getSource(sourceId)) apply(data);
  }, [map, sourceId, data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A map event handler that always calls the latest `handler`; `layerId` limits it to one layer's features */
export function useMapEvent(type, layerId, handler) {
  const { map, styleVersion } = useMapContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!mapIsAlive(map)) return undefined;
    const listener = (e) => handlerRef.current?.(e);
    if (layerId) map.on(type, layerId, listener); else map.on(type, listener);
    return () => {
      if (map._removed) return;
      if (layerId) map.off(type, layerId, listener); else map.off(type, listener);
    };
  }, [map, styleVersion, type, layerId]);
}

/** Marks layers as taking taps themselves (see `clickable` above) while the component is mounted */
export function useClickableLayers(layerIds) {
  const { clickable } = useMapContext();
  const key = layerIds.join(',');
  useEffect(() => {
    layerIds.forEach(id => clickable.add(id));
    return () => layerIds.forEach(id => clickable.delete(id));
  }, [clickable, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The same object as last time while the value's content is unchanged. The map screen works its lists
 * out anew on every render; this keeps a re-render from sending the same data to the map again.
 */
export function useStableValue(value) {
  const last = useRef({ key: null, value });
  const key = JSON.stringify(value);
  if (last.current.key !== key) last.current = { key, value };
  return last.current.value;
}
