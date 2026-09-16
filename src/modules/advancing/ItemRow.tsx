import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { AdvanceItem, AdvanceLogistics, AdvanceParty, AdvanceStatus } from '@/data/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineText } from '@/components/InlineInput';
import { fromInputValue, toDateInputValue, toDateTimeInputValue } from '@/lib/time';
import { cn } from '@/lib/utils';
import { isOverdue, nextStatus, STATUS_LABEL } from './model';

/**
 * The four states of a line on an advance, drawn so you can scan a sheet of
 * eighty of them and see what is left.
 *
 * With one colour available they separate by weight and by edge, and they are
 * ordered so that the page gets visually quieter as the advance gets done:
 * missing is an open dashed outline, requested is a solid outline, confirmed
 * is filled in, and not needed recedes into the background.
 */
const STATUS_STYLE: Record<AdvanceStatus, string> = {
  missing: 'border border-dashed border-foreground/70 text-foreground hover:bg-foreground/10',
  requested: 'border border-foreground/70 bg-foreground/10 text-foreground hover:bg-foreground/20',
  confirmed: 'border border-foreground bg-foreground text-background hover:bg-foreground/90',
  na: 'border border-transparent bg-muted text-muted-foreground hover:bg-muted/80',
};

/** Which structured fields an item shows, by what kind of thing it is. */
const LOGISTICS_FIELDS: Record<
  NonNullable<AdvanceLogistics['kind']>,
  Array<{ key: keyof AdvanceLogistics; label: string; type: 'text' | 'datetime-local' | 'number' }>
> = {
  travel: [
    { key: 'provider', label: 'Carrier', type: 'text' },
    { key: 'reference', label: 'Flight / reference', type: 'text' },
    { key: 'from', label: 'From', type: 'text' },
    { key: 'to', label: 'To', type: 'text' },
    { key: 'startsAt', label: 'Departs', type: 'datetime-local' },
    { key: 'endsAt', label: 'Arrives', type: 'datetime-local' },
  ],
  stay: [
    { key: 'provider', label: 'Property', type: 'text' },
    { key: 'reference', label: 'Confirmation', type: 'text' },
    { key: 'quantity', label: 'Rooms', type: 'number' },
    { key: 'startsAt', label: 'Check-in', type: 'datetime-local' },
    { key: 'endsAt', label: 'Check-out', type: 'datetime-local' },
  ],
  transfer: [
    { key: 'provider', label: 'Supplier', type: 'text' },
    { key: 'from', label: 'Pick-up', type: 'text' },
    { key: 'to', label: 'Drop-off', type: 'text' },
    { key: 'quantity', label: 'Seats', type: 'number' },
    { key: 'startsAt', label: 'Pick-up time', type: 'datetime-local' },
  ],
  schedule: [
    { key: 'startsAt', label: 'Starts', type: 'datetime-local' },
    { key: 'endsAt', label: 'Ends', type: 'datetime-local' },
  ],
  spec: [
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'unit', label: 'Unit', type: 'text' },
  ],
};

export interface ItemRowProps {
  item: AdvanceItem;
  parties: AdvanceParty[];
  onPatch: (patch: Partial<AdvanceItem>) => void;
  onRemove: () => void;
  now: number;
}

/**
 * One line of the advance.
 *
 * The status button is the primary control. A producer hits it fifty times
 * while working the phone, so it comes first, it is wide, and it is drawn the
 * same way the missing panel draws the same four states.
 */
export function ItemRow({ item, parties, onPatch, onRemove, now }: ItemRowProps) {
  const [open, setOpen] = useState(false);
  const overdue = isOverdue(item, now);
  const fields = item.logistics ? LOGISTICS_FIELDS[item.logistics.kind] : undefined;
  const party = parties.find((candidate) => candidate.id === item.partyId);

  function patchLogistics(patch: Partial<AdvanceLogistics>) {
    onPatch({ logistics: { ...(item.logistics ?? { kind: 'spec' }), ...patch } });
  }

  return (
    <div
      // An overdue line is marked in the margin. A tint under the status chip
      // would cost it the contrast it needs.
      className={cn(
        'border-b border-border/60 px-3 py-2 last:border-b-0',
        overdue && 'border-l-2 border-l-destructive pl-2.5',
      )}
      data-testid="advance-item"
      data-status={item.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPatch({ status: nextStatus(item.status) })}
          aria-label={`${item.label}: ${STATUS_LABEL[item.status]}. Change status`}
          data-testid="advance-status"
          className={cn(
            'w-24 shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            STATUS_STYLE[item.status],
          )}
        >
          {STATUS_LABEL[item.status]}
        </button>

        <div className="flex min-w-48 flex-1 items-center gap-1.5">
          <InlineText
            label="Item"
            value={item.label}
            onCommit={(label) => onPatch({ label })}
            className="font-medium"
          />
          {item.required && (
            <Badge variant="muted" className="shrink-0 text-[10px]">
              Required
            </Badge>
          )}
          {party && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {party.name}
            </Badge>
          )}
        </div>

        <InlineText
          label={`Answer for ${item.label}`}
          value={item.detail ?? ''}
          placeholder="Answer…"
          onCommit={(detail) => onPatch({ detail })}
          className="min-w-40 flex-1"
        />

        <InlineText
          label={`Owner for ${item.label}`}
          value={item.owner ?? ''}
          placeholder="Owner"
          onCommit={(owner) => onPatch({ owner })}
          className="w-28 shrink-0 text-xs"
        />

        <input
          type="date"
          aria-label={`Due date for ${item.label}`}
          value={toDateInputValue(item.dueAt)}
          onChange={(e) => onPatch({ dueAt: fromInputValue(e.target.value) })}
          className={cn(
            'w-32 shrink-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs',
            'hover:border-input focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
            overdue && 'text-destructive',
          )}
        />

        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={open ? `Hide details for ${item.label}` : `Show details for ${item.label}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      </div>

      {open && (
        <div className="mt-2 grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields?.map((field) => (
            <label key={String(field.key)} className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{field.label}</span>
              {field.type === 'datetime-local' ? (
                <input
                  type="datetime-local"
                  aria-label={`${field.label} for ${item.label}`}
                  value={toDateTimeInputValue(item.logistics?.[field.key] as string | undefined)}
                  onChange={(e) => patchLogistics({ [field.key]: fromInputValue(e.target.value) })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                />
              ) : (
                <InlineText
                  label={`${field.label} for ${item.label}`}
                  inputMode={field.type === 'number' ? 'numeric' : undefined}
                  value={String(item.logistics?.[field.key] ?? '')}
                  onCommit={(value) =>
                    patchLogistics({
                      [field.key]: field.type === 'number' ? Number(value) || undefined : value || undefined,
                    })
                  }
                  className="h-8 border-input"
                />
              )}
            </label>
          ))}

          <label className="space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</span>
            <InlineText
              label={`Notes for ${item.label}`}
              value={item.notes ?? ''}
              onCommit={(notes) => onPatch({ notes })}
              className="h-8 border-input"
            />
          </label>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            {parties.length > 0 && (
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Party</span>
                <select
                  aria-label={`Party for ${item.label}`}
                  value={item.partyId ?? ''}
                  onChange={(e) => onPatch({ partyId: e.target.value || undefined })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Everyone</option>
                  {parties.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={item.required}
                aria-label={`${item.label} is required`}
                onChange={(e) => onPatch({ required: e.target.checked })}
                className="size-4 rounded border-input"
              />
              Required to run the show
            </label>

            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
