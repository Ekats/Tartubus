import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement, act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { usePullToRefresh } from '../usePullToRefresh';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let state;

async function setup({ onRefresh, enabled = true }) {
  function Probe() {
    const ref = useRef(null);
    state = usePullToRefresh(ref, onRefresh, enabled);
    return createElement('div', { ref, 'data-testid': 'scroller' });
  }
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
  return container.querySelector('[data-testid="scroller"]');
}

const touch = (element, type, clientY) => act(() => {
  const event = new Event(type, { bubbles: true });
  event.touches = clientY === undefined ? [] : [{ clientY }];
  element.dispatchEvent(event);
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('usePullToRefresh', () => {
  it('refreshes when pulled down past the trigger distance at the top and released', async () => {
    const onRefresh = vi.fn();
    const element = await setup({ onRefresh });

    touch(element, 'touchstart', 100);
    touch(element, 'touchmove', 180); // 80 px drag -> 40 px pull
    expect(state.pullDistance).toBe(40);
    expect(state.willRefresh).toBe(false);

    touch(element, 'touchmove', 260); // 160 px drag -> 80 px pull
    expect(state.willRefresh).toBe(true);

    touch(element, 'touchend');
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(state.pullDistance).toBe(0);
  });

  it('does not refresh after a short pull', async () => {
    const onRefresh = vi.fn();
    const element = await setup({ onRefresh });

    touch(element, 'touchstart', 100);
    touch(element, 'touchmove', 160);
    touch(element, 'touchend');

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores a drag that starts while the list is scrolled down', async () => {
    const onRefresh = vi.fn();
    const element = await setup({ onRefresh });
    element.scrollTop = 200;

    touch(element, 'touchstart', 100);
    touch(element, 'touchmove', 400);
    touch(element, 'touchend');

    expect(state.pullDistance).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', async () => {
    const onRefresh = vi.fn();
    const element = await setup({ onRefresh, enabled: false });

    touch(element, 'touchstart', 100);
    touch(element, 'touchmove', 400);
    touch(element, 'touchend');

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
