import { useEffect, useRef, useState } from 'react';

// Smaller changes are browser toolbars coming and going, not a keyboard
const MIN_KEYBOARD = 120;

/**
 * Where the keyboard leaves the bottom search bar, in CSS px.
 * Two ways a keyboard shows up:
 * - over the page (Chrome, Safari): only the visual viewport shrinks - the bottom stack is
 *   lifted by `inset`, the gap between the layout viewport's bottom and the visible bottom
 * - by resizing the page (the Android app: the WebView itself is shrunk) - the fixed stack
 *   rides up on its own (inset 0), and the app keeps its pre-keyboard height (`frozenHeight`)
 *   so the lists and the map behind don't re-layout
 * `baseHeight` is the layout height before the keyboard opened.
 */
export function keyboardLayout({ layoutHeight, vvHeight, vvOffsetTop, baseHeight }) {
  const gap = Math.max(0, Math.round(layoutHeight - (vvHeight + vvOffsetTop)));
  const shrunk = Math.max(0, baseHeight - layoutHeight);
  const inset = gap >= MIN_KEYBOARD ? gap : 0;
  const frozenHeight = shrunk >= MIN_KEYBOARD ? baseHeight : null;
  return { inset, frozenHeight, open: inset > 0 || frozenHeight !== null };
}

/**
 * Keeps the bottom search field right above the keyboard while it is typed in (an element
 * inside `[data-keyboard-anchor]` has focus): sets `--keyboard-inset` and `--app-height` on
 * <html> and returns whether the keyboard is open. Other fields (feedback form) keep the
 * page's normal behaviour.
 */
export function useKeyboardInset() {
  const [open, setOpen] = useState(false);
  const baseRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    const style = document.documentElement.style;
    let frame = null;

    const update = () => {
      frame = null;
      const layoutHeight = window.innerHeight;
      const typing = !!document.activeElement?.closest?.('[data-keyboard-anchor]');
      const base = baseRef.current;
      // A rotation starts over; while the search field has focus the page only shrinks for the keyboard.
      // The visual viewport has the fractional height 100vh has (innerHeight is rounded)
      if (window.innerWidth !== base.width || !typing) {
        baseRef.current = { width: window.innerWidth, height: vv ? vv.height : layoutHeight };
      } else if (layoutHeight > base.height) {
        base.height = layoutHeight;
      }
      const layout = typing
        ? keyboardLayout({
          layoutHeight,
          vvHeight: vv ? vv.height : layoutHeight,
          vvOffsetTop: vv ? vv.offsetTop : 0,
          baseHeight: baseRef.current.height,
        })
        : { inset: 0, frozenHeight: null, open: false };
      style.setProperty('--keyboard-inset', `${layout.inset}px`);
      if (layout.frozenHeight !== null) style.setProperty('--app-height', `${layout.frozenHeight}px`);
      else style.removeProperty('--app-height');
      setOpen(layout.open);
    };
    // The visual and the layout viewport report one keyboard in separate events: handle them as one
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('resize', schedule);
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      style.removeProperty('--keyboard-inset');
      style.removeProperty('--app-height');
    };
  }, []);

  return open;
}
