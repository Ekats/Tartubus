import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FAVORITES_KEY = 'tartu_bus_favorites';
const stopX = { gtfsId: 'Viro:1', name: 'Raekoja plats', code: '1', lat: 58.38, lon: 26.72 };
const stopY = { gtfsId: 'Viro:2', name: 'Kaubamaja', code: '2', lat: 58.378, lon: 26.73 };

let useFavorites;
let root;

// Render two independent components that each call useFavorites(),
// like StopFinder and the StopCard in its overlay
async function renderTwoCallers() {
  const hooks = {};
  const Caller = ({ name }) => {
    hooks[name] = useFavorites();
    return null;
  };
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(
    createElement('div', null, createElement(Caller, { name: 'a' }), createElement(Caller, { name: 'b' }))
  ));
  return hooks;
}

const stored = () => JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]').map(f => f.gtfsId);

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules(); // fresh module-level store per test
  ({ useFavorites } = await import('../useFavorites'));
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('useFavorites', () => {
  it('keeps changes made through different callers', async () => {
    const hooks = await renderTwoCallers();

    await act(async () => hooks.a.toggleFavorite(stopX));
    await act(async () => hooks.b.toggleFavorite(stopY));

    expect(stored()).toEqual(['Viro:1', 'Viro:2']);
    expect(hooks.a.favorites.map(f => f.gtfsId)).toEqual(['Viro:1', 'Viro:2']);
    expect(hooks.b.isFavorite('Viro:1')).toBe(true);
  });

  it('does not store address search results as favorites', async () => {
    const hooks = await renderTwoCallers();
    const searchResult = { gtfsId: 'search:58.38:26.72', name: 'Riia 2', lat: 58.38, lon: 26.72, isSearchResult: true };

    await act(async () => hooks.a.toggleFavorite(searchResult));

    expect(stored()).toEqual([]);
  });

  it('picks up changes made in another tab', async () => {
    const hooks = await renderTwoCallers();

    localStorage.setItem(FAVORITES_KEY, JSON.stringify([stopX]));
    await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_KEY })));

    expect(hooks.a.isFavorite('Viro:1')).toBe(true);
  });
});
