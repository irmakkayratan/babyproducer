import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom has no matchMedia; the theme and reduced-motion code paths need it.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
