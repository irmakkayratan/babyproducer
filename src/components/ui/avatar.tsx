import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';
import { hashSeed } from '@/lib/rng';
import { initials } from '@/lib/utils';

export const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = 'Avatar';

export const AvatarImage = AvatarPrimitive.Image;

export const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex size-full items-center justify-center rounded-full bg-muted text-xs font-medium', className)}
    {...props}
  />
));
AvatarFallback.displayName = 'AvatarFallback';

/**
 * Deterministic, locally generated avatar: the same name always produces the
 * same tile. No network request, so it works offline and leaks nothing.
 *
 * Two names are told apart by how light the tile is and which way the gradient
 * runs, which is all the variation a 28px circle can carry anyway.
 */
export function GeneratedAvatar({ name, className }: { name: string; className?: string }) {
  const seed = hashSeed(name);
  const lift = 22 + (seed % 26);
  const angle = seed % 360;
  return (
    <Avatar className={className}>
      <AvatarFallback
        style={{
          background: `linear-gradient(${angle}deg, hsl(0 0% ${lift}%), hsl(0 0% ${Math.round(lift * 0.45)}%))`,
          color: 'hsl(0 0% 100% / 0.92)',
        }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
