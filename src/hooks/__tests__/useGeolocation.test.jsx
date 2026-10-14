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

describe('useGeolocation one-shot request', () => {
  const timeout = { code: 3, message: 'Timeout expired' };
  const getCurrentPosition = () => navigator.geolocation.getCurrentPosition;
  const fail = (call, err) => act(() => getCurrentPosition().mock.calls[call][1](err));

  it('surfaces an error that arrives while the page is visible', () => {
    render();
    act(() => api.getLocation());
    fail(0, timeout);
    expect(api.error).toBe('Timeout expired');
    expect(api.errorCode).toBe(3);
    expect(api.loading).toBe(false);
    expect(getCurrentPosition()).toHaveBeenCalledTimes(1);
  });

  it('retries on visible instead of surfacing an error that arrived while hidden', () => {
    render();
    act(() => api.getLocation());
    setVisibility('hidden');
    fail(0, timeout);
    expect(api.error).toBeNull();

    setVisibility('visible');
    expect(getCurrentPosition()).toHaveBeenCalledTimes(2);
    expect(api.error).toBeNull();
    expect(api.loading).toBe(true);
  });

  it('retries once when the timeout arrives after returning from the background', () => {
    render();
    act(() => api.getLocation());
    setVisibility('hidden');
    setVisibility('visible');
    fail(0, timeout);
    expect(getCurrentPosition()).toHaveBeenCalledTimes(2);
    expect(api.error).toBeNull();

    fail(1, timeout); // a foreground timeout is then shown, not retried forever
    expect(getCurrentPosition()).toHaveBeenCalledTimes(2);
    expect(api.errorCode).toBe(3);
  });

  it('retries on visible when an error is showing and there is no fix', () => {
    render();
    act(() => api.getLocation());
    fail(0, timeout);
    setVisibility('hidden');
    setVisibility('visible');
    expect(getCurrentPosition()).toHaveBeenCalledTimes(2);
    expect(api.error).toBeNull();
  });

  it('does not request location on visible when none was requested', () => {
    render();
    setVisibility('hidden');
    setVisibility('visible');
    expect(getCurrentPosition()).not.toHaveBeenCalled();
  });
});

describe('useGeolocation errors after a fix', () => {
  const position = { coords: { latitude: 58.38, longitude: 26.73, accuracy: 10 } };
  const watchSuccess = () => act(() => watchPosition.mock.calls.at(-1)[0](position));
  const watchFail = (err) => act(() => watchPosition.mock.calls.at(-1)[1](err));

  it('ignores a watch timeout once a real fix exists', () => {
    render();
    act(() => api.startWatching());
    watchSuccess();
    watchFail({ code: 3, message: 'Timeout expired' });
    expect(api.error).toBeNull();
    expect(api.location.hasRealFix).toBe(true);
  });

  it('still reports a denied permission after a fix', () => {
    render();
    act(() => api.startWatching());
    watchSuccess();
    watchFail({ code: 1, message: 'User denied Geolocation' });
    expect(api.errorCode).toBe(1);
  });

  it('a watch timeout before any fix is reported, and stopping tracking clears it', () => {
    render();
    act(() => api.startWatching());
    watchFail({ code: 3, message: 'Timeout expired' });
    expect(api.errorCode).toBe(3);
    act(() => api.stopWatching());
    expect(api.error).toBeNull();
    expect(api.errorCode).toBeNull();
  });
});
