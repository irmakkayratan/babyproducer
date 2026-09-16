/**
 * Sets the one theme the product has.
 *
 * There used to be a light scheme and a per-event accent colour that faded in
 * when you moved between events. Both are gone: the palette is black and white
 * everywhere, so there is nothing left to switch between and nothing to fade.
 * The component stays because the shell still wraps the app in it, and because
 * this is where a theme would go if one ever comes back.
 */
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, []);

  return <>{children}</>;
}
