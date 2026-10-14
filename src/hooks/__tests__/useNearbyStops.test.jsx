import { describe, it, expect, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/digitransit', () => ({
  getNearbyStopsWithMeta: vi.fn().mockResolvedValue({ stops: [{ gtfsId: 'Viro:1' }], source: 'live', fetchedAt: 1 }),
}));

import { useNearbyStops } from '../useNearbyStops';
import { getNearbyStopsWithMeta } from '../../services/digitransit';

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

  it('a failed refresh keeps the stops, but not when they are for another (planned) time', async () => {
    let hook;
    function Probe() {
      hook = useNearbyStops();
      return null;
    }
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await hook.fetchNearbyStops(58.38, 26.72, 500); });
    expect(hook.stops).toHaveLength(1);

    getNearbyStopsWithMeta.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await hook.fetchNearbyStops(58.38, 26.72, 500); });
    expect(hook.stops).toHaveLength(1);
    expect(hook.error).toBeNull();

    const planned = new Date(Date.now() + 86400000);
    getNearbyStopsWithMeta.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await hook.fetchNearbyStops(58.38, 26.72, 500, false, planned); });
    expect(getNearbyStopsWithMeta).toHaveBeenLastCalledWith(58.38, 26.72, 500, false, planned);
    expect(hook.stops).toHaveLength(0);
    expect(hook.error).toBe('offline');
    act(() => root.unmount());
  });
});
