import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useVisibleInterval } from '../useVisibleInterval';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let visibility = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });

function setVisibility(state) {
  visibility = state;
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

let root;
function render(callback, enabled = true) {
  function Probe() {
    useVisibleInterval(callback, 30000, enabled);
    return null;
  }
  root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useVisibleInterval', () => {
  it('calls back every interval while visible', () => {
    const callback = vi.fn();
    render(callback);
    act(() => { vi.advanceTimersByTime(90000); });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('pauses while hidden and calls back once when visible again', () => {
    const callback = vi.fn();
    render(callback);
    setVisibility('hidden');
    act(() => { vi.advanceTimersByTime(120000); });
    expect(callback).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(callback).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does nothing when disabled', () => {
    const callback = vi.fn();
    render(callback, false);
    act(() => { vi.advanceTimersByTime(90000); });
    setVisibility('hidden');
    setVisibility('visible');
    expect(callback).not.toHaveBeenCalled();
  });
});
