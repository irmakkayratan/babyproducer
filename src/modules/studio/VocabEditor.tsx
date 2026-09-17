import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { Vocab } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SWATCHES = ['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5', 'tier-6'];

/**
 * Editor for one categorical axis. Statuses, tiers, voices, cue types.
 *
 * An entry that is in use archives instead of deleting, so renaming a tier
 * never orphans the guests already carrying it.
 */
export function VocabEditor({
  title,
  description,
  entries,
  usage,
  onChange,
}: {
  title: string;
  description: string;
  entries: Vocab[];
  usage?: Map<string, number>;
  onChange: (entries: Vocab[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function update(id: string, patch: Partial<Vocab>) {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...entries];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((entry, order) => ({ ...entry, order })));
  }

  function add() {
    const label = draft.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `entry-${entries.length}`;
    if (entries.some((entry) => entry.id === id)) return;
    onChange([...entries, { id, label, order: entries.length, color: SWATCHES[entries.length % SWATCHES.length] }]);
    setDraft('');
  }

  return (
    <section className="rounded-lg border">
      <header className="border-b p-4">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="divide-y divide-border/60">
        {entries.map((entry, index) => {
          const used = usage?.get(entry.id) ?? 0;
          return (
            <div key={entry.id} className="flex items-center gap-2 p-2.5" data-testid="vocab-row">
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${entry.label} up`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => move(index, -1)}
                >
                  <GripVertical className="size-3.5" />
                </button>
              </div>

              <div className="flex gap-1">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`${entry.label} colour ${swatch}`}
                    aria-pressed={entry.color === swatch}
                    onClick={() => update(entry.id, { color: swatch })}
                    className={cn(
                      'size-4 rounded-full border-2 transition-transform hover:scale-110',
                      entry.color === swatch ? 'border-foreground' : 'border-transparent',
                    )}
                    style={{ background: `var(--${swatch})` }}
                  />
                ))}
              </div>

              <Input
                value={entry.label}
                aria-label={`Label for ${entry.id}`}
                onChange={(e) => update(entry.id, { label: e.target.value })}
                className="h-8 flex-1"
              />

              {used > 0 && (
                <span className="whitespace-nowrap text-xs text-muted-foreground" data-numeric>
                  {used} in use
                </span>
              )}

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={used > 0 ? `Archive ${entry.label}` : `Delete ${entry.label}`}
                title={used > 0 ? 'In use, so this archives it instead of deleting it' : 'Delete'}
                onClick={() =>
                  used > 0
                    ? update(entry.id, { archived: !entry.archived })
                    : onChange(entries.filter((candidate) => candidate.id !== entry.id))
                }
              >
                <Trash2 className={cn('size-3.5', entry.archived && 'text-destructive')} />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t p-2.5">
        <Input
          value={draft}
          placeholder={`Add to ${title.toLowerCase()}…`}
          aria-label={`New ${title}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="h-8"
        />
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </section>
  );
}
