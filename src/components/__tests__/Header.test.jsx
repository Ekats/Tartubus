import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../i18n';
import Header from '../Header';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;
function render(props = {}) {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(createElement(Header, { isDarkMode: false, toggleDarkMode: vi.fn(), onTimePickerOpen: vi.fn(), ...props })));
}
const filterButton = () => container.querySelector('[data-testid="route-filter-button"]');

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => {
  act(() => root.unmount());
});

describe('Header route filter button', () => {
  it('is not there without a toggle (tabs other than the map)', () => {
    render();
    expect(filterButton()).toBeNull();
  });

  it('toggles the menu and has no count badge while no route is picked', () => {
    const onRouteFilterToggle = vi.fn();
    render({ onRouteFilterToggle });
    expect(filterButton().getAttribute('aria-label')).toBe(i18n.t('map.filterRoutes'));
    expect(filterButton().getAttribute('aria-expanded')).toBe('false');
    expect(filterButton().textContent).toBe('');
    act(() => filterButton().click());
    expect(onRouteFilterToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the number of picked routes and whether the menu is open', () => {
    render({ onRouteFilterToggle: vi.fn(), routeFilterOpen: true, routeFilterCount: 2 });
    expect(filterButton().textContent).toBe('2');
    expect(filterButton().getAttribute('aria-expanded')).toBe('true');
  });
});
