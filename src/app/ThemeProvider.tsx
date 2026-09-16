import { useEffect, useRef } from 'react';
import { useStore } from '@/store';

/** Extract the hue of an `hsl(h s% l%)` token so the crossfade can match it. */
function hueOf(color: string): number {
  const match = /hsl\(\s*([\d.]+)/.exec(color);
  return match ? Number(match[1]) : 258;
}

function applyAccent(accent: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', accent);
  root.style.setProperty('--ring', accent);
  root.style.setProperty('--chart-1', accent);
  root.style.setProperty('--shell-gradient', accent);
}

/**
 * Applies the color scheme and the active accent.
 *
 * Changing an event theme should feel like the room changing color: a
 * full-screen gradient layer fades in at the new hue while the CSS variables
 * transition underneath. One paint, no remount — and nothing moves at all for
 * people who asked the platform to stop animating.
 */
export function ThemeProvider({ accent, children }: { accent?: string; children: React.ReactNode }) {
  const scheme = useStore((s) => s.scheme);
  const crossfadeTo = useStore((s) => s.crossfadeTo);
  const beginCrossfade = useStore((s) => s.beginCrossfade);
  const endCrossfade = useStore((s) => s.endCrossfade);
  const previousAccent = useRef<string | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    const resolve = () =>
      scheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : scheme;

    root.dataset.theme = resolve();
    if (scheme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => (root.dataset.theme = resolve());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [scheme]);

  useEffect(() => {
    if (!accent) return;
    const changed = previousAccent.current && previousAccent.current !== accent;
    previousAccent.current = accent;
    applyAccent(accent);
    if (!changed) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    beginCrossfade(accent);
    const timer = window.setTimeout(endCrossfade, 460);
    return () => window.clearTimeout(timer);
  }, [accent, beginCrossfade, endCrossfade]);

  return (
    <>
      {children}
      {crossfadeTo && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] animate-[atelier-crossfade_460ms_cubic-bezier(.4,0,.2,1)_forwards]"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, hsl(${hueOf(crossfadeTo)} 85% 60% / 0.55), transparent 70%)`,
          }}
        />
      )}
    </>
  );
}
