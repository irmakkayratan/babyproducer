import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Inputs that edit a record in place.
 *
 * They hold their own draft and commit on blur or Enter, rather than writing
 * on every keystroke: these sit over IndexedDB rows that several surfaces are
 * subscribed to, and a write per character would fight the user's cursor.
 * Escape abandons the edit, which is the only way back from a mistyped number
 * once the field has been cleared.
 */
interface InlineTextProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onCommit: (value: string) => void;
  label: string;
}

export function InlineText({ value, onCommit, label, className, ...props }: InlineTextProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  useEffect(() => {
    // Only follow the record when it changes underneath us, never mid-edit.
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  function commit(next: string) {
    if (next === committed.current) return;
    committed.current = next;
    onCommit(next);
  }

  return (
    <input
      {...props}
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(draft);
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setDraft(committed.current);
          (e.target as HTMLInputElement).blur();
        }
        props.onKeyDown?.(e);
      }}
      className={cn(
        'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm transition-colors',
        'hover:border-input focus:border-input placeholder:text-muted-foreground/70',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        className,
      )}
    />
  );
}

interface InlineNumberProps extends Omit<InlineTextProps, 'value' | 'onCommit'> {
  value: number;
  onCommit: (value: number) => void;
}

/** The same contract for money and counts: blank reads as zero, never NaN. */
export function InlineNumber({ value, onCommit, className, ...props }: InlineNumberProps) {
  return (
    <InlineText
      {...props}
      inputMode="decimal"
      value={Number.isFinite(value) ? String(value) : ''}
      onCommit={(next) => {
        const parsed = Number(next.replace(/[^0-9.-]/g, ''));
        onCommit(Number.isFinite(parsed) ? parsed : 0);
      }}
      className={cn('text-right font-mono tabular', className)}
    />
  );
}
