// An HTML element pinned to a place on the map; its content is the React children.
// For the few things that are HTML: pins and the labelled boxes. Anything numerous is a map layer.
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Marker } from 'maplibre-gl';
import { useMapContext } from './mapContext';

/**
 * @param anchor - which part of the element sits on the place ('center', 'bottom', ...)
 * @param offset - [x, y] pixels to shift it by
 * @param onClick - a tap on the element (the tap then does not reach the map)
 */
function MapMarker({ lat, lon, anchor = 'center', offset, className = '', zIndex, onClick, children }) {
  const { map } = useMapContext();
  const element = useMemo(() => document.createElement('div'), []);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const interactive = !!onClick;

  useEffect(() => {
    const marker = new Marker({ element, anchor, offset }).setLngLat([lon, lat]).addTo(map);
    return () => marker.remove();
    // lat/lon changes are applied by re-creating the marker: they are rare (a new fix, a new pin)
  }, [map, element, lat, lon, anchor, offset?.[0], offset?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the marker exists: MapLibre sets its own classes on the element when it is created
  useEffect(() => {
    const classes = className.split(' ').filter(Boolean);
    element.classList.add(...classes);
    element.style.zIndex = zIndex ?? '';
    element.style.pointerEvents = interactive ? 'auto' : 'none';
    element.style.cursor = interactive ? 'pointer' : '';
    return () => element.classList.remove(...classes);
  });

  useEffect(() => {
    if (!interactive) return undefined;
    const listener = (e) => {
      e.stopPropagation();
      onClickRef.current?.(e);
    };
    element.addEventListener('click', listener);
    return () => element.removeEventListener('click', listener);
  }, [element, interactive]);

  return createPortal(children, element);
}

export default MapMarker;
