import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../../i18n';

// MapMarker stand-in: the element with MapMarker's own click handling (its listener gets the event)
vi.mock('../MapMarker', () => ({
  default: ({ className, onClick, children }) => createElement('div', { className, onClick }, children),
}));

import StopPopup from '../StopPopup';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STOP = { lat: 58.38, lon: 26.72, name: 'Raekoda', code: '7820' };
// A departure in `minutes` from now, today
const inMinutes = (minutes, route, headsign) => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    // (half a minute over, so the whole minutes don't drop by one while the test runs)
    scheduledArrival: Math.round((now - midnight) / 1000) + minutes * 60 + 30,
    serviceDay: Math.round(midnight.getTime() / 1000),
    realtime: false,
    headsign,
    trip: { route: { shortName: route } },
  };
};

let root;
let container;
let onOpen;
let onClose;
function render(departures) {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(createElement(StopPopup, { stop: STOP, iconSize: 24, departures, onOpen, onClose })));
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  onOpen = vi.fn();
  onClose = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('StopPopup', () => {
  it('shows the stop with a loading line while departures load', () => {
    render(null);
    expect(container.textContent).toContain('Raekoda 7820');
    expect(container.textContent).toContain(i18n.t('common.loading'));
    expect(container.querySelector('.journey-stop-box')).not.toBeNull();
  });

  it('says so when there are no departures', () => {
    render([]);
    expect(container.textContent).toContain(i18n.t('nearMe.noDepartures'));
  });

  it('shows the next three departures with route, headsign and minutes', () => {
    render([inMinutes(5, '7', 'Annelinn'), inMinutes(12, '4', 'Ränilinn'), inMinutes(20, '6', 'Nõlvaku'), inMinutes(30, '9', 'Lõunakeskus')]);
    const rows = [...container.querySelectorAll('.map-stop-popup-row')].map(r => r.textContent);
    expect(rows).toEqual(['7Annelinn5 min', '4Ränilinn12 min', '6Nõlvaku20 min']);
  });

  it('a tap on the box opens the stop, a tap on the × only closes the box', () => {
    render([]);
    act(() => container.querySelector('.map-stop-popup').click());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    act(() => container.querySelector('.journey-stop-close').click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
