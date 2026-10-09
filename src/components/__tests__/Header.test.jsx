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
    expect(forwardGeocode).toHaveBeenCalledWith('ah', expect.any(Function));
    expect(searchRouteByNumber).not.toHaveBeenCalled();
  });

  it('ignores an earlier address search that answers after a newer one started', async () => {
    const deferred = () => {
      let resolve;
      const promise = new Promise(r => { resolve = r; });
      return { promise, resolve };
    };
    const hit = (name) => [{ lat: 58.37, lon: 26.72, name, display_name: `${name}, Tartu linn` }];
    const first = deferred();
    const second = deferred();
    forwardGeocode.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const rows = () => [...container.querySelectorAll('header .absolute.top-full button p')].map(p => p.textContent);
    const spinning = () => !!container.querySelector('header svg.animate-spin');

    type('Võru tn 30');
    await act(async () => { vi.advanceTimersByTime(600); });
    type('Riia tn 2');
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(forwardGeocode).toHaveBeenCalledTimes(2);

    // The first, slower search lands second - it is superseded, so it changes nothing
    await act(async () => { first.resolve(hit('Võru tn 30')); });
    expect(rows()).toEqual([]);
    expect(spinning()).toBe(true);

    await act(async () => { second.resolve(hit('Riia tn 2')); });
    expect(rows()).toEqual(['Riia tn 2']);
    expect(spinning()).toBe(false);
  });
});

describe('Header search in two steps', () => {
  const place = (name) => ({ lat: 58.37, lon: 26.72, name, display_name: name });
  const rows = () => [...container.querySelectorAll('header .absolute.top-full button p')].map(p => p.textContent);
  const spinning = () => !!container.querySelector('header svg.animate-spin');

  // A search whose In-ADS rows can be shown (partial) and whose fill can be resolved later
  function pendingSearch() {
    let resolve;
    const search = { partial: null, finish: (list) => resolve(list) };
    forwardGeocode.mockImplementationOnce((query, onPartial) => {
      search.partial = onPartial;
      return new Promise(r => { resolve = r; });
    });
    return search;
  }

  async function startSearch(query) {
    type(query);
    await act(async () => { vi.advanceTimersByTime(600); });
  }

  it('shows the partial rows while the fill is pending, then appends the fillers below', async () => {
    const search = pendingSearch();
    await startSearch('Riia');

    act(() => search.partial([place('A'), place('B')]));
    expect(rows()).toEqual(['A', 'B']);
    expect(spinning()).toBe(true);

    await act(async () => { search.finish([place('A'), place('B'), place('C'), place('D'), place('E')]); });
    expect(rows()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(spinning()).toBe(false);
  });

  it('ignores the partial rows of a superseded search', async () => {
    const first = pendingSearch();
    await startSearch('Võru tn 30');
    const second = pendingSearch();
    await startSearch('Riia tn 2');

    act(() => first.partial([place('Old')]));
    expect(rows()).toEqual([]);

    act(() => second.partial([place('New')]));
    expect(rows()).toEqual(['New']);
  });

  it('stays closed when the fill lands after a partial row was clicked', async () => {
    const onDestinationSelect = vi.fn();
    await act(async () => root.render(createElement(Header, {
      isDarkMode: false, toggleDarkMode: () => {}, onDestinationSelect, onRouteSelect: () => {},
      customTime: null, onTimePickerOpen: () => {},
    })));
    const search = pendingSearch();
    await startSearch('Riia');
    act(() => search.partial([place('A')]));

    act(() => { container.querySelector('header .absolute.top-full button').click(); });
    expect(onDestinationSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'A' }));
    expect(rows()).toEqual([]);
    expect(spinning()).toBe(false);

    await act(async () => { search.finish([place('A'), place('B')]); });
    expect(rows()).toEqual([]);
    expect(container.querySelector('header input').value).toBe('');
  });
});
