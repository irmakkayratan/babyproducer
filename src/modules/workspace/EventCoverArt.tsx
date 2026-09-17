import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { hashSeed } from '@/lib/rng';
import { cn } from '@/lib/utils';
import type { Event } from '@/data/types';

/**
 * Cover art is square by contract (1:1, at least 800x800). Until someone
 * uploads an image, a placeholder stands in. It is built from a hash of the
 * event name, so the same event always looks the same and nothing is fetched.
 *
 * The placeholder is greyscale like everything else. What varies between events
 * is the angle of the wash and how bright it is, which is enough to tell two
 * cards apart in a list without introducing a colour.
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
  const angle = seed % 360;
  // 26% to 54%: bright enough to read as a deliberate surface, dark enough to
  // keep the event name legible in white on top of it.
  const lift = 26 + (seed % 29);

  return (
    <div
      className={cn('relative overflow-hidden bg-muted', className)}
      style={
        url
          ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {
              background: `
                radial-gradient(130% 100% at 18% 12%, hsl(0 0% ${lift}% / 0.9), transparent 62%),
                radial-gradient(90% 75% at 88% 85%, hsl(0 0% ${Math.round(lift * 0.5)}% / 0.85), transparent 60%),
                linear-gradient(${angle}deg, hsl(0 0% 11%), hsl(0 0% 4%))`,
            }
      }
      role="img"
      aria-label={`Cover art for ${event.name}`}
    >
      {!url && (
        <span className="absolute inset-x-0 bottom-0 p-4 font-display text-lg leading-tight text-foreground/90 drop-shadow-sm">
          {event.name}
        </span>
      )}
    </div>
  );
}
