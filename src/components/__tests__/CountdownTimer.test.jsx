import { describe, it, expect, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import CountdownTimer from '../CountdownTimer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Service day 2026-09-28 in Tallinn (local midnight = 21:00 UTC the day before)
const SERVICE_DAY = Date.UTC(2026, 8, 27, 21, 0, 0) / 1000;
const EIGHT_TWELVE = 8 * 3600 + 12 * 60;

let root;
async function render(props) {
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(createElement(CountdownTimer, props)));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
});

describe('CountdownTimer with a planned time', () => {
  it('shows the clock time and minutes after the chosen time, not a countdown', async () => {
    const planned0800 = new Date(Date.UTC(2026, 8, 28, 5, 0)); // 08:00 in Tallinn
    const container = await render({
      scheduledArrival: EIGHT_TWELVE,
      realtimeData: { serviceDay: SERVICE_DAY },
      referenceTime: planned0800,
    });

    expect(container.textContent).toBe('08:12+12 min');
  });
});
