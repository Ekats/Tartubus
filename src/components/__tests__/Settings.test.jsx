import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../i18n';

vi.mock('../../services/digitransit', () => ({
  updateRoutesFromGitHub: vi.fn(),
  getRoutesVersionInfo: () => ({ source: 'bundled' }),
  clearDownloadedRoutes: vi.fn(),
  clearCachedData: vi.fn(),
}));
vi.mock('../Feedback', () => ({ default: () => null }));

import Settings from '../Settings';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
async function render() {
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root.render(createElement(Settings)));
  return container;
}

const languages = container => [...container.querySelectorAll('input[name="language"]')].map(input => input.value);

function clickButton(container, label) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent.includes(label));
  if (!button) throw new Error(`No button "${label}"`);
  act(() => button.click());
}

afterEach(async () => {
  act(() => root?.unmount());
  await act(async () => { await i18n.changeLanguage('en'); });
});

describe('Settings language list', () => {
  it('shows Estonian and English, with Ukrainian and Russian under "Show more"', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    const container = await render();

    expect(languages(container)).toEqual(['et', 'en']);

    clickButton(container, 'Show more');
    expect(languages(container)).toEqual(['et', 'en', 'uk', 'ru']);

    clickButton(container, 'Show less');
    expect(languages(container)).toEqual(['et', 'en']);
  });

  it('starts expanded when the current language is one of the hidden ones', async () => {
    await act(async () => { await i18n.changeLanguage('uk'); });
    const container = await render();

    expect(languages(container)).toEqual(['et', 'en', 'uk', 'ru']);
  });
});
