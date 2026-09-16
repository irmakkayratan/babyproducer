import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';

/**
 * Signed, never flashing.
 *
 * The sign and the figure carry the meaning. Weight backs them up: a show
 * inside its plan is quiet, a show drifting gets an outline, and a show over
 * its plan is filled in so it stands out in a column of cues.
 */
export function DriftPill({ seconds, className }: { seconds: number; className?: string }) {
  const magnitude = Math.abs(seconds);
  const tone =
    seconds > 120 ? 'over' : seconds > 30 ? 'warn' : seconds < -30 ? 'under' : 'level';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs transition-colors',
        tone === 'over' && 'bg-foreground font-medium text-background',
        tone === 'warn' && 'border border-foreground/60 text-foreground',
        tone === 'under' && 'bg-muted text-foreground',
        tone === 'level' && 'bg-muted text-muted-foreground',
        className,
      )}
      data-numeric
      title={seconds >= 0 ? 'Running behind plan' : 'Running ahead of plan'}
    >
      {seconds === 0 ? 'on time' : `${seconds > 0 ? '+' : '-'}${formatDuration(magnitude)}`}
    </span>
  );
}
