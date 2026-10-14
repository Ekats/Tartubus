import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../i18n';

vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));
vi.mock('../../services/digitransit', () => ({
  getNextStopName: vi.fn(() => null),
  getDailyTimetable: vi.fn(),
}));

import StopCard from '../StopCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A departure 10 min from now with the rest of its trip
const now = new Date();
const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const secs = Math.round((now - midnight) / 1000) + 600;
const DEPARTURE = {
  scheduledArrival: secs, serviceDay: Math.round(midnight.getTime() / 1000), realtime: false, headsign: 'Annelinn', stopPosition: 1,
  trip: {
    route: { shortName: '7', longName: 'Raadi - Annelinn', gtfsId: 'Viro:r7' },
    stoptimes: [
      { stop: { gtfsId: 'Viro:1', name: 'Raekoda' }, stopPosition: 1, scheduledArrival: secs },
      { stop: { gtfsId: 'Viro:2', name: 'Kaubamaja' }, stopPosition: 2, scheduledArrival: secs + 120 },
    ],
  },
};
const STOP = { gtfsId: 'Viro:1', name: 'Raekoda', code: '7820', lat: 58.38, lon: 26.72, stoptimesWithoutPatterns: [DEPARTURE] };

let root;
let container;
function render(props) {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(createElement(StopCard, { stop: STOP, variant: 'overlay', showMapButton: false, ...props })));
}
const routeButton = () => container.querySelector(`button[aria-label="${i18n.t('nearMe.showRouteOnMap')}: 7"]`);

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => {
  act(() => root.unmount());
});

describe('StopCard route button', () => {
  it('the route number shows the bus on the map, with the same payload as Near Me', () => {
    const onShowRoute = vi.fn();
    render({ onShowRoute });
    act(() => routeButton().click());
    expect(onShowRoute).toHaveBeenCalledTimes(1);
    const payload = onShowRoute.mock.calls[0][0];
    expect(payload).toMatchObject({ type: 'route', routeNumber: '7', routeName: 'Raadi - Annelinn', gtfsId: 'Viro:r7', patterns: [] });
    expect(payload.trip.boardStopId).toBe('Viro:1');
    expect(payload.trip.stops.map(s => s.name)).toEqual(['Raekoda', 'Kaubamaja']);
  });

  it('is a plain label without onShowRoute', () => {
    render({});
    expect(routeButton()).toBeNull();
    expect(container.textContent).toContain('7');
  });
});
