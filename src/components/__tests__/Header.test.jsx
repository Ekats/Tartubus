import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/digitransit', () => ({
  searchRouteByNumber: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../utils/geocoding', () => ({
  forwardGeocode: vi.fn().mockResolvedValue([]),
}));

import Header from '../Header';
import { searchRouteByNumber } from '../../services/digitransit';
import { forwardGeocode } from '../../utils/geocoding';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;

function type(value) {
  const input = container.querySelector('header input');
  // Set the value the way a user would, so React's onChange fires
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(createElement(Header, {
    isDarkMode: false, toggleDarkMode: () => {}, onDestinationSelect: () => {}, onRouteSelect: () => {},
    customTime: null, onTimePickerOpen: () => {},
  })));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('Header search', () => {
  it('searches single-digit route numbers', async () => {
    type('4');
    await act(async () => { vi.advanceTimersByTime(600); });

    expect(searchRouteByNumber).toHaveBeenCalledTimes(1);
    expect(searchRouteByNumber.mock.calls[0][0]).toBe('4');
    expect(forwardGeocode).not.toHaveBeenCalled();
  });

  it('still waits for 2 characters before an address search', async () => {
    type('a');
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(forwardGeocode).not.toHaveBeenCalled();

    type('ah');
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(forwardGeocode).toHaveBeenCalledWith('ah');
    expect(searchRouteByNumber).not.toHaveBeenCalled();
  });
});
