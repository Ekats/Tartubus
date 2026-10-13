import { describe, it, expect, beforeEach } from 'vitest';
import { CollapsedAttributionControl } from '../attributionControl';
import { MAP_ATTRIBUTION } from '../../../utils/mapData';

// Just enough of a MapLibre map: events and a style with sources
function fakeMap(sources = {}) {
  const listeners = {};
  return {
    sources,
    on: (type, fn) => { (listeners[type] ||= new Set()).add(fn); },
    off: (type, fn) => { listeners[type]?.delete(fn); },
    fire: (type) => { [...(listeners[type] || [])].forEach(fn => fn({ type })); },
    count: (type) => listeners[type]?.size || 0,
    getStyle() { return { sources: this.sources }; },
  };
}
const SHOWN = 'maplibregl-compact-show';

describe('CollapsedAttributionControl', () => {
  let map, control, container;
  beforeEach(() => {
    map = fakeMap();
    control = new CollapsedAttributionControl();
    container = control.onAdd(map);
    document.body.replaceChildren(container);
  });
  const button = () => container.querySelector('.maplibregl-ctrl-attrib-button');
  const text = () => container.querySelector('.maplibregl-ctrl-attrib-inner').textContent;
  const loadStyle = (sources) => { map.sources = sources; map.fire('styledata'); };

  it('is collapsed when added, with the (i) button', () => {
    expect(container.classList.contains('maplibregl-compact')).toBe(true);
    expect(container.classList.contains(SHOWN)).toBe(false);
    expect(button()).not.toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });

  it('stays collapsed when a style with credits loads, and when it is replaced by another', () => {
    loadStyle({ tiles: { attribution: MAP_ATTRIBUTION } });
    expect(container.classList.contains(SHOWN)).toBe(false);
    loadStyle({});
    loadStyle({ tiles: { attribution: MAP_ATTRIBUTION } });
    expect(container.classList.contains(SHOWN)).toBe(false);
  });

  it('shows both credits, with their links', () => {
    loadStyle({ tiles: { attribution: MAP_ATTRIBUTION }, stops: {} });
    expect(text()).toMatch(/OpenStreetMap contributors/);
    expect(text()).toMatch(/ESA WorldCover 2021/);
    expect([...container.querySelectorAll('a')].map(a => a.getAttribute('href'))).toContain('https://www.openstreetmap.org/copyright');
  });

  it('opens on a tap on the (i) and closes on the next', () => {
    button().click();
    expect(container.classList.contains(SHOWN)).toBe(true);
    expect(button().getAttribute('aria-expanded')).toBe('true');
    button().click();
    expect(container.classList.contains(SHOWN)).toBe(false);
  });

  it('closes when the map is dragged; other map events leave it as it is', () => {
    button().click();
    map.fire('styledata');
    map.fire('resize');
    map.fire('moveend');
    expect(container.classList.contains(SHOWN)).toBe(true);
    map.fire('drag');
    expect(container.classList.contains(SHOWN)).toBe(false);
  });

  it('lists each credit once; a credit from a remote tile list is shown as plain text', () => {
    loadStyle({
      a: { attribution: MAP_ATTRIBUTION },
      b: { attribution: MAP_ATTRIBUTION },
      satellite: { attribution: '<a href="https://example.org" onclick="alert(1)">Imagery</a> &copy; Someone<img src=x onerror=alert(1)>' },
    });
    expect(text().match(/OpenStreetMap/g)).toHaveLength(1);
    expect(text()).toMatch(/Imagery © Someone/);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(3); // only the app's own credit line has links
  });

  it('takes its listeners and its element away when removed', () => {
    control.onRemove();
    expect(map.count('drag')).toBe(0);
    expect(map.count('styledata')).toBe(0);
    expect(document.body.contains(container)).toBe(false);
  });
});
