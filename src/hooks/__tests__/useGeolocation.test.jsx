import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useGeolocation } from '../useGeolocation';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let visibility = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });

function setVisibility(state) {
  visibility = state;
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

let root;
let api;
let watchPosition;
let clearWatch;
let nextId;

function render() {
  function Probe() {
    api = useGeolocation();
    return null;
  }
  root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
}

beforeEach(() => {
  visibility = 'visible';
  nextId = 1;
  watchPosition = vi.fn(() => nextId++);
  clearWatch = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
  });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useGeolocation watch', () => {
  it('does not watch until startWatching is called', () => {
    render();
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('clears the watch when hidden and restarts it when visible', () => {
    render();
    act(() => api.startWatching());
    expect(watchPosition).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(api.watching).toBe(true);

    setVisibility('visible');
    expect(watchPosition).toHaveBeenCalledTimes(2);
  });

  it('does not start a watch on visible when not watching', () => {
    render();
    setVisibility('hidden');
    setVisibility('visible');
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('does not start a watch if hidden when watching begins', () => {
    render();
    visibility = 'hidden';
    act(() => api.startWatching());
    expect(watchPosition).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(watchPosition).toHaveBeenCalledTimes(1);
  });

  it('clears the watch on unmount', () => {
    render();
    act(() => api.startWatching());
    act(() => root.unmount());
    expect(clearWatch).toHaveBeenCalledWith(1);
    root = createRoot(document.createElement('div')); // for afterEach
  });
});
