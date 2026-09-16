import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { hashSeed } from '@/lib/rng';
import { cn } from '@/lib/utils';
import type { Event } from '@/data/types';

/**
 * Cover art is square by contract (Luma's 1:1, ≥800×800). Until an image is
 * uploaded, a deterministic gradient stands in — generated from the event name
 * so the same event always looks the same, with no network request.
 */
export function EventCoverArt({ event, className }: { event: Event; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    if (event.coverAssetId) {
      void db.assets.get(event.coverAssetId).then((asset) => {
        if (!asset || cancelled) return;
        revoked = URL.createObjectURL(asset.blob);
        setUrl(revoked);
      });
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [event.coverAssetId]);

  const seed = hashSeed(event.name);
  const hue = seed % 360;
  const accentHue = /hsl\(\s*([\d.]+)/.exec(event.theme?.accent ?? '')?.[1];
  const base = accentHue ? Number(accentHue) : hue;

  return (
    <div
      className={cn('relative overflow-hidden bg-muted', className)}
      style={
        url
          ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {
              background: `
                radial-gradient(130% 100% at 18% 12%, hsl(${base} 62% 52% / 0.85), transparent 62%),
                radial-gradient(90% 75% at 88% 85%, hsl(${(base + 18) % 360} 45% 32% / 0.8), transparent 60%),
                linear-gradient(165deg, hsl(${base} 22% 11%), hsl(${(base + 12) % 360} 28% 6%))`,
            }
      }
      role="img"
      aria-label={`Cover art for ${event.name}`}
    >
      {!url && (
        <span className="absolute inset-x-0 bottom-0 p-4 font-display text-lg leading-tight text-white/85 drop-shadow-sm">
          {event.name}
        </span>
      )}
    </div>
  );
}
