// A popup bubble at a place on the map with React children as its content.
// Closes on its ×, or on a tap on the map; `onClose` is told either way.
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Popup } from 'maplibre-gl';
import { useMapContext } from './mapContext';

function MapPopup({ lat, lon, offset = 0, className = '', maxWidth = '300px', onClose, children }) {
  const { map } = useMapContext();
  const content = useMemo(() => document.createElement('div'), []);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const popup = new Popup({ offset, className, maxWidth, focusAfterOpen: false })
      .setLngLat([lon, lat])
      .setDOMContent(content)
      .addTo(map);
    let unmounting = false;
    popup.on('close', () => { if (!unmounting) onCloseRef.current?.(); });
    return () => {
      unmounting = true;
      popup.remove();
    };
  }, [map, content, lat, lon, offset, className, maxWidth]);

  return createPortal(children, content);
}

export default MapPopup;
