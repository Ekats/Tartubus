// The map itself: one MapLibre map drawing the bundled map data in the theme chosen in Settings.
// What is shown on it (stops, lines, pins) are the components placed inside as children.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_EVENT } from '../../utils/settings';
import { toMaxBounds } from '../../utils/mapData';
import { MapContext, ABOVE_LINES } from './mapContext';
import { CollapsedAttributionControl } from './attributionControl';
import { buildStyle, currentMapStyle, loadMapIndex, NOT_IN_MAP_DATA } from './mapStyle';

/**
 * @param {{lat, lon}} center, {number} zoom, {number} maxZoom - the first view (MapLibre zoom)
 * @param {{current}} mapRef - gets the MapLibre map while it exists
 * @param onMoveEnd(lat, lon, zoom) - the view stopped moving
 * @param onMapClick({lat, lon}) - a tap on the map itself, not on a stop, cluster or pin
 * @param onUserMove() - the user started to drag or zoom the map (not a move made by the app)
 */
function MapView({ isDarkMode, center, zoom, maxZoom, mapRef, onMoveEnd, onMapClick, onUserMove, children }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [map, setMap] = useState(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const [mapStyle, setMapStyle] = useState(currentMapStyle);
  const clickable = useMemo(() => new Set(), []);
  const handlers = useRef({});
  handlers.current = { onMoveEnd, onMapClick, onUserMove };

  useEffect(() => {
    const container = containerRef.current;
    let created;
    try {
      created = new MapLibreMap({
        container,
        center: [center.lon, center.lat],
        zoom,
        maxZoom,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
    } catch (err) {
      // No usable WebGL on this device: the Map tab says so instead of staying blank
      console.error('Map: could not create the map', err);
      setFailed(true);
      return undefined;
    }
    const mapInstance = created;
    mapInstance.touchZoomRotate.disableRotation();
    mapInstance.keyboard.disableRotation();
    // Bottom left: the map's round buttons sit in the bottom right corner
    mapInstance.addControl(new CollapsedAttributionControl(), 'bottom-left');

    let removed = false;
    // Nothing to show beyond the bundled data: keep the view inside Estonia
    loadMapIndex().then(({ bounds, minzoom }) => {
      if (removed) return;
      mapInstance.setMinZoom(minzoom);
      mapInstance.setMaxBounds(toMaxBounds(bounds));
    }).catch(err => console.error('Map: could not read the map data index', err));

    // A tile outside the detailed area is expected to fail (see the mapdata protocol): not worth a console line
    mapInstance.on('error', (e) => {
      if (e.error?.status !== NOT_IN_MAP_DATA) console.error(e.error);
    });

    mapInstance.on('style.load', () => {
      // See mapContext.js: fixes the stacking order of the layers added later. (Already there when the
      // event comes after a lost WebGL context was given back: MapLibre then redraws the same style.)
      if (!mapInstance.getLayer(ABOVE_LINES)) {
        mapInstance.addLayer({ id: ABOVE_LINES, type: 'background', layout: { visibility: 'none' } });
      }
      setStyleVersion(version => version + 1);
    });

    mapInstance.on('movestart', (e) => {
      // Only a gesture carries the browser event that caused it
      if (e.originalEvent) handlers.current.onUserMove?.();
    });
    mapInstance.on('moveend', () => {
      const { lat, lng } = mapInstance.getCenter();
      handlers.current.onMoveEnd?.(lat, lng, mapInstance.getZoom());
    });
    mapInstance.on('click', (e) => {
      const layers = [...clickable].filter(id => mapInstance.getLayer(id));
      if (layers.length > 0 && mapInstance.queryRenderedFeatures(e.point, { layers }).length > 0) return;
      handlers.current.onMapClick?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    // For the test scripts: when everything asked for has been drawn
    mapInstance.on('idle', () => { container.dataset.mapIdle = String(Math.round(performance.now())); });
    window.__tartubusMap = mapInstance;

    const onMapStyleChange = () => setMapStyle(currentMapStyle());
    window.addEventListener(MAP_STYLE_EVENT, onMapStyleChange);

    if (mapRef) mapRef.current = mapInstance;
    setMap(mapInstance);

    return () => {
      removed = true;
      window.removeEventListener(MAP_STYLE_EVENT, onMapStyleChange);
      if (window.__tartubusMap === mapInstance) delete window.__tartubusMap;
      if (mapRef) mapRef.current = null;
      mapInstance.remove();
    };
    // The map is created once; later moves go through mapRef
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The first style and every later one (theme changed in Settings, light <-> dark)
  useEffect(() => {
    if (!map) return undefined;
    let cancelled = false;
    buildStyle(mapStyle, isDarkMode)
      .then(style => { if (!cancelled && !map._removed) map.setStyle(style, { diff: false }); })
      .catch(err => console.error('Map: could not load the map style', err));
    return () => { cancelled = true; };
  }, [map, mapStyle, isDarkMode]);

  const context = useMemo(() => ({ map, styleVersion, clickable }), [map, styleVersion, clickable]);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-900">
        <p className="text-center text-gray-600 dark:text-gray-300 max-w-sm">{t('map.unavailable')}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      {map && styleVersion > 0 && (
        <MapContext.Provider value={context}>{children}</MapContext.Provider>
      )}
    </>
  );
}

export default MapView;
