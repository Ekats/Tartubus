import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContext } from '../mapContext';
import RouteLinesLayer from '../RouteLinesLayer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Just enough of a MapLibre map with a loaded style
function fakeMap() {
  const sources = {};
  const layers = {};
  return {
    style: { _loaded: true },
    on: vi.fn(),
    off: vi.fn(),
    addSource: (id) => { sources[id] = { setData: vi.fn() }; },
    getSource: (id) => sources[id],
    removeSource: (id) => { delete sources[id]; },
    addLayer: (layer) => { layers[layer.id] = layer; },
    getLayer: (id) => layers[id],
    removeLayer: (id) => { delete layers[id]; },
    hasImage: () => true,
    layers,
  };
}

let root;
afterEach(() => {
  act(() => root.unmount());
});

describe('RouteLinesLayer', () => {
  it('draws the lines but takes no taps: a tap on a line is a tap on the map', () => {
    const map = fakeMap();
    const clickable = new Set();
    const lines = [{ positions: [[58.38, 26.72], [58.39, 26.73]], color: '#0066CC' }];
    root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(MapContext.Provider, { value: { map, styleVersion: 1, clickable } },
      createElement(RouteLinesLayer, { lines }))));

    expect(map.layers['route-line']).toBeDefined();
    expect(map.on).not.toHaveBeenCalled();
    expect(clickable.size).toBe(0);
    expect(document.querySelector('.maplibregl-popup')).toBeNull();
  });
});
