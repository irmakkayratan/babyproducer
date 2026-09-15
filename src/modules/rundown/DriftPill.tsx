import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';

/**
 * Signed, never flashing: green when the show is inside its plan, amber when
 * it is drifting, red when it is over. The sign is always shown so colour is
 * not the only signal.
 */
export function DriftPill({ seconds, className }: { seconds: number; className?: string }) {
  const magnitude = Math.abs(seconds);
  const tone =
    seconds > 120 ? 'over' : seconds > 30 ? 'warn' : seconds < -30 ? 'under' : 'level';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs transition-colors',
        tone === 'over' && 'bg-destructive/15 text-destructive',
        tone === 'warn' && 'bg-warning/15 text-warning',
        tone === 'under' && 'bg-success/15 text-success',
        tone === 'level' && 'bg-muted text-muted-foreground',
        className,
      )}
      data-numeric
      title={seconds >= 0 ? 'Running behind plan' : 'Running ahead of plan'}
    >
      {seconds === 0 ? 'on time' : `${seconds > 0 ? '+' : '−'}${formatDuration(magnitude)}`}
    </span>
  );
}
