import { describe, it, expect, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/digitransit', () => ({
  getNearbyStops: vi.fn().mockResolvedValue([{ gtfsId: 'Viro:1' }]),
}));

import { useNearbyStops } from '../useNearbyStops';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('useNearbyStops', () => {
  it('keeps fetchNearbyStops stable across re-renders', async () => {
    const seen = [];
    function Probe() {
      const { fetchNearbyStops } = useNearbyStops();
      seen.push(fetchNearbyStops);
      return null;
    }

    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Probe)));
    // Trigger state changes (loading → stops) that re-render the component
    await act(async () => { await seen[0](58.38, 26.72, 500); });

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
    act(() => root.unmount());
  });
});
