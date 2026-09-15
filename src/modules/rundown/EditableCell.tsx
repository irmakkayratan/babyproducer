import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A cell that behaves the way producers expect a spreadsheet to behave:
 * type and it commits on Enter or blur, Escape restores the previous value.
 * A value that cannot be parsed is rejected rather than silently zeroed.
 */
export function EditableCell({
  value,
  onCommit,
  parse,
  format,
  className,
  placeholder,
  ariaLabel,
  multiline,
}: {
  value: string;
  onCommit: (value: string) => void;
  parse?: (raw: string) => boolean;
  format?: (raw: string) => string;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft === value) return;
    if (parse && !parse(draft)) {
      setInvalid(true);
      setDraft(value);
      window.setTimeout(() => setInvalid(false), 800);
      return;
    }
    onCommit(format ? format(draft) : draft);
  }

  return (
    <input
      ref={ref}
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      spellCheck={multiline}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ref.current?.blur();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
          ref.current?.blur();
        }
      }}
      className={cn(
        'w-full truncate rounded-sm bg-transparent px-1.5 py-1 text-sm outline-hidden transition-colors',
        'hover:bg-accent/50 focus:bg-accent focus:ring-1 focus:ring-ring',
        invalid && 'ring-1 ring-destructive',
        className,
      )}
    />
  );
}
