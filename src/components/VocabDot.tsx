import type { Vocab } from '@/data/types';
import { cn } from '@/lib/utils';

/** Colour never carries meaning alone: the dot always travels with its label. */
export function VocabDot({ vocab, className }: { vocab?: Vocab; className?: string }) {
  if (!vocab) return <span className="text-muted-foreground">—</span>;
  const color = vocab.color?.startsWith('tier-') ? `var(--${vocab.color})` : (vocab.color ?? 'var(--muted-foreground)');
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{vocab.label}</span>
    </span>
  );
}
