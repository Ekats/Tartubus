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
  it('is not there without a toggle', () => {
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

describe('Header size', () => {
  // The map fit, the stop view overlay and the trip labels depend on the bar staying 60 px tall:
  // py-2 (2 × 8 px) around 44 px buttons (p-2 around 28 px icons)
  it('has bigger buttons and logo in a bar of the same height', () => {
    render({ onRouteFilterToggle: vi.fn() });
    expect(container.querySelector('[data-testid="header-bar"]').className).toContain('py-2');
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBe(3);
    buttons.forEach(button => {
      expect(button.className).toContain('p-2');
      expect(button.querySelector('svg').getAttribute('class')).toBe('w-7 h-7');
    });
    expect(container.querySelector('img').className).toContain('h-9');
  });
});
