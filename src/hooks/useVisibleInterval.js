import { useEffect, useRef } from 'react';

/**
 * Call `callback` every `delay` ms while the page is visible.
 * Pauses while the app is in the background and calls `callback` once as soon
 * as it's visible again. The latest `callback` is always used, so it can read
 * current props/state without restarting the timer.
 */
export function useVisibleInterval(callback, delay, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let interval = null;
    const start = () => {
      if (!interval) interval = setInterval(() => callbackRef.current(), delay);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        callbackRef.current();
        start();
      }
    };

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay, enabled]);
}
