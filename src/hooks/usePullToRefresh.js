import { useEffect, useRef, useState } from 'react';

const TRIGGER_DISTANCE = 64; // px the content must be pulled down before a release refreshes
const MAX_DISTANCE = 96;
const RESISTANCE = 0.5; // The indicator moves half as far as the finger

/**
 * Pull-down-to-refresh for a scrollable element.
 * When the element is scrolled to the top and the user drags down past the trigger
 * distance and lets go, `onRefresh` is called. Returns how far the content is pulled
 * (px) and whether a release would refresh, for drawing an indicator.
 * The latest `onRefresh` is always used.
 */
export function usePullToRefresh(scrollRef, onRefresh, enabled = true) {
  const [pullDistance, setPullDistance] = useState(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;

    let startY = null;
    let distance = 0;

    const reset = () => {
      startY = null;
      distance = 0;
      setPullDistance(0);
    };

    const handleTouchStart = (event) => {
      // Only a pull that starts at the very top counts
      startY = element.scrollTop <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null;
      distance = 0;
    };

    const handleTouchMove = (event) => {
      if (startY === null) return;
      const dragged = event.touches[0].clientY - startY;
      if (dragged <= 0 || element.scrollTop > 0) {
        // Scrolling the list, not pulling
        if (distance !== 0) {
          distance = 0;
          setPullDistance(0);
        }
        return;
      }
      distance = Math.min(dragged * RESISTANCE, MAX_DISTANCE);
      setPullDistance(distance);
    };

    const handleTouchEnd = () => {
      const shouldRefresh = distance >= TRIGGER_DISTANCE;
      reset();
      if (shouldRefresh) onRefreshRef.current();
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', reset);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', reset);
    };
  }, [scrollRef, enabled]);

  return { pullDistance, willRefresh: pullDistance >= TRIGGER_DISTANCE };
}
