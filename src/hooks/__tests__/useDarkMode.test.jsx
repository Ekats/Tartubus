import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  setColor: vi.fn(() => Promise.resolve()),
  setStyle: vi.fn(() => Promise.resolve()),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
  registerPlugin: () => ({ setColor: mocks.setColor }),
  SystemBars: { setStyle: mocks.setStyle },
  SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT' },
}));

import { useDarkMode } from '../useDarkMode';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let state;

async function setup() {
  function Probe() {
    state = useDarkMode();
    return null;
  }
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Probe)));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => act(() => root.unmount()));

describe('useDarkMode system bar colour', () => {
  it('on native, sets the dark then the light strip colour and icon style', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    await setup();
    expect(mocks.setColor).toHaveBeenLastCalledWith({ color: '#FFFFFF' });
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });

    await act(async () => state.toggleDarkMode());
    expect(mocks.setColor).toHaveBeenLastCalledWith({ color: '#1F2937' });
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });

    await act(async () => state.toggleDarkMode());
    expect(mocks.setColor).toHaveBeenLastCalledWith({ color: '#FFFFFF' });
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
  });

  it('on native, colours the strip after setStyle (setStyle resets it)', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    await setup();
    expect(mocks.setStyle.mock.invocationCallOrder[0]).toBeLessThan(mocks.setColor.mock.invocationCallOrder[0]);
  });

  it('on web, never calls the plugins', async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    await setup();
    await act(async () => state.toggleDarkMode());
    expect(mocks.setColor).not.toHaveBeenCalled();
    expect(mocks.setStyle).not.toHaveBeenCalled();
  });
});
