import { describe, it, expect } from 'vitest';
import { keyboardLayout } from '../useKeyboardInset';

describe('keyboardLayout', () => {
  it('is closed with no keyboard', () => {
    expect(keyboardLayout({ layoutHeight: 800, vvHeight: 800, vvOffsetTop: 0, baseHeight: 800 }))
      .toEqual({ inset: 0, frozenHeight: null, open: false });
  });

  it('lifts the stack by the covered part when the keyboard is over the page (visual viewport only)', () => {
    expect(keyboardLayout({ layoutHeight: 800, vvHeight: 500, vvOffsetTop: 0, baseHeight: 800 }))
      .toEqual({ inset: 300, frozenHeight: null, open: true });
  });

  it('counts a scrolled visual viewport as visible', () => {
    // The browser panned the visual viewport 100 px down: 800 - (500 + 100) is covered
    expect(keyboardLayout({ layoutHeight: 800, vvHeight: 500, vvOffsetTop: 100, baseHeight: 800 }).inset).toBe(200);
  });

  it('does not lift a page the keyboard shrank (the Android app) - it only keeps the old height', () => {
    // Measured on Android 15: innerHeight 800 -> 546, visualViewport follows it. The kept height is
    // the fractional one (100vh was 800.73 there)
    expect(keyboardLayout({ layoutHeight: 546, vvHeight: 545.8, vvOffsetTop: 0, baseHeight: 800.73 }))
      .toEqual({ inset: 0, frozenHeight: 800.73, open: true });
  });

  it('ignores toolbar-sized changes', () => {
    expect(keyboardLayout({ layoutHeight: 800, vvHeight: 744, vvOffsetTop: 0, baseHeight: 800 }).open).toBe(false);
    expect(keyboardLayout({ layoutHeight: 744, vvHeight: 744, vvOffsetTop: 0, baseHeight: 800 }).open).toBe(false);
  });
});
