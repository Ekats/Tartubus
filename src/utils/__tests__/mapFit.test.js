import { describe, it, expect } from 'vitest';
import { freeArea, paddingFor, overflowOf, hasOverflow, grownPadding, anyUnder, FIT_MARGIN, LABEL_MARGIN } from '../mapFit';

// A phone: the map is 360 x 676, the filter button ends 76 px down, the tab bar is 56 px,
// the two round buttons sit in the bottom right corner
const size = { width: 360, height: 676 };
const roundButtons = { left: 296, top: 492, right: 344, bottom: 604 };

describe('freeArea', () => {
  it('is the whole map without controls', () => {
    expect(freeArea({ size })).toEqual({ left: 0, top: 0, right: 360, bottom: 676 });
  });

  it('starts below the top controls and ends above the tab bar', () => {
    expect(freeArea({ size, topControlsBottom: 76, tabBarHeight: 56 })).toEqual({ left: 0, top: 76, right: 360, bottom: 620 });
  });

  it('keeps beside narrow buttons (the two round ones)', () => {
    expect(freeArea({ size, topControlsBottom: 76, tabBarHeight: 56, buttons: roundButtons }))
      .toEqual({ left: 0, top: 76, right: 296, bottom: 620 });
  });

  it('keeps above wide buttons (with "exit route view" in the column)', () => {
    const withExit = { left: 118, top: 440, right: 344, bottom: 604 };
    expect(freeArea({ size, topControlsBottom: 76, tabBarHeight: 56, buttons: withExit }))
      .toEqual({ left: 0, top: 76, right: 360, bottom: 440 });
  });

  it('ignores buttons that are not there', () => {
    expect(freeArea({ size, buttons: { left: 0, top: 0, right: 0, bottom: 0 } }).right).toBe(360);
  });
});

describe('paddingFor', () => {
  it('is the distance from each map edge to the free area, plus the margin', () => {
    const area = { left: 0, top: 76, right: 296, bottom: 620 };
    expect(paddingFor(size, area)).toEqual({ top: 76 + FIT_MARGIN, left: FIT_MARGIN, right: 64 + FIT_MARGIN, bottom: 56 + FIT_MARGIN });
    expect(paddingFor(size, area, 0)).toEqual({ top: 76, left: 0, right: 64, bottom: 56 });
  });
});

describe('overflowOf', () => {
  const area = { left: 0, top: 76, right: 296, bottom: 620 };

  it('is nothing for a box inside the area', () => {
    const over = overflowOf(area, [{ left: 40, top: 120, right: 200, bottom: 180 }]);
    expect(over).toEqual({ top: 0, left: 0, right: 0, bottom: 0 });
    expect(hasOverflow(over)).toBe(false);
  });

  it('measures how far a box runs off the left edge and under the top controls', () => {
    const over = overflowOf(area, [{ left: -27, top: 60, right: 140, bottom: 120 }]);
    expect(over).toEqual({ top: 16 + LABEL_MARGIN, left: 27 + LABEL_MARGIN, right: 0, bottom: 0 });
    expect(hasOverflow(over)).toBe(true);
  });

  it('takes the worst box per side', () => {
    const over = overflowOf(area, [
      { left: 100, top: 200, right: 310, bottom: 260 },
      { left: 150, top: 300, right: 330, bottom: 640 },
    ], 0);
    expect(over).toEqual({ top: 0, left: 0, right: 34, bottom: 20 });
  });

  it('a box touching the edge still lacks the margin', () => {
    expect(overflowOf(area, [{ left: 0, top: 200, right: 100, bottom: 260 }]).left).toBe(LABEL_MARGIN);
  });
});

describe('grownPadding', () => {
  const padding = { top: 100, left: 24, right: 88, bottom: 80 };

  it('adds what stuck out, rounded up', () => {
    expect(grownPadding(padding, { top: 0, left: 33.2, right: 0, bottom: 0 }, size))
      .toEqual({ top: 100, left: 58, right: 88, bottom: 80 });
  });

  it('gives up (null) when no room would be left to fit anything in', () => {
    expect(grownPadding(padding, { top: 0, left: 150, right: 60, bottom: 0 }, size)).toBeNull();
    expect(grownPadding(padding, { top: 300, left: 0, right: 0, bottom: 150 }, size)).toBeNull();
  });
});

describe('anyUnder', () => {
  const point = (x, y) => ({ left: x, right: x, top: y, bottom: y });

  it('finds a stop or a label under the round buttons, or closer to them than the margin', () => {
    expect(anyUnder(roundButtons, [point(100, 300), point(320, 550)])).toBe(true);
    expect(anyUnder(roundButtons, [{ left: 200, top: 470, right: 300, bottom: 500 }])).toBe(true);
    expect(anyUnder(roundButtons, [point(292, 550)])).toBe(true);
    expect(anyUnder(roundButtons, [point(292, 550)], 0)).toBe(false);
  });

  it('is false when everything is clear of them', () => {
    expect(anyUnder(roundButtons, [point(100, 300), point(280, 600), { left: 150, top: 200, right: 280, bottom: 260 }])).toBe(false);
    expect(anyUnder(roundButtons, [])).toBe(false);
  });
});
