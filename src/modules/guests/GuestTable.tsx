import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import type { Guest, MetricConfig, SchemaConfig } from '@/data/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildGuestColumns, type ColumnContext, type GuestColumn } from './columns';
import { useStore } from '@/store';

/**
 * The dense table is the product for a guest-list manager, so it is
 * virtualized: only the visible rows exist in the DOM, and each row subscribes
 * to nothing — the parent hands it the record it already has.
 */
export function GuestTable({
  guests,
  schema,
  metrics,
  arrived,
  onCheckIn,
}: {
  guests: Guest[];
  schema: SchemaConfig;
  metrics: MetricConfig[];
  arrived: Set<string>;
  onCheckIn: (guest: Guest) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const hiddenColumns = useStore((s) => s.hiddenColumns);
  const sort = useStore((s) => s.sort);
  const setSort = useStore((s) => s.setSort);
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const openGuest = useStore((s) => s.openGuest);
  const density = useStore((s) => s.density);

  const fieldDefs = useMemo(() => schema.fields.filter((f) => f.entity === 'guest'), [schema.fields]);
  const columns = useMemo(
    () => buildGuestColumns(metrics, fieldDefs).filter((column) => !hiddenColumns.includes(column.id)),
    [metrics, fieldDefs, hiddenColumns],
  );

  const rowHeight = density === 'compact' ? 40 : 52;
  const virtualizer = useVirtualizer({
    count: guests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const context: ColumnContext = { schema, metrics, arrived };
  const gridTemplate = `40px ${columns.map((c) => `${c.width}px`).join(' ')} 104px`;
  const selected = new Set(selection);
  const allSelected = guests.length > 0 && selection.length === guests.length;

  function headerClick(column: GuestColumn) {
    if (!column.sortable) return;
    const existing = sort.find((entry) => entry.id === column.id);
    if (!existing) setSort([{ id: column.id, desc: false }]);
    else if (!existing.desc) setSort([{ id: column.id, desc: true }]);
    else setSort([]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div
        className="sticky top-0 z-10 grid items-center border-b bg-card/95 text-xs font-medium text-muted-foreground backdrop-blur-sm"
        style={{ gridTemplateColumns: gridTemplate }}
        role="row"
      >
        <div className="flex h-9 items-center justify-center">
          <Checkbox
            checked={allSelected ? true : selection.length > 0 ? 'indeterminate' : false}
            aria-label="Select all guests"
            onCheckedChange={() => setSelection(allSelected ? [] : guests.map((g) => g.id))}
          />
        </div>
        {columns.map((column) => {
          const sorted = sort.find((entry) => entry.id === column.id);
          return (
            <button
              key={column.id}
              type="button"
              onClick={() => headerClick(column)}
              className={cn(
                'flex h-9 items-center gap-1 px-2 text-left hover:text-foreground',
                column.align === 'right' && 'justify-end',
                !column.sortable && 'cursor-default',
              )}
            >
              {column.label}
              {sorted && (sorted.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
            </button>
          );
        })}
        <div className="sticky right-0 bg-card/95 px-2 text-right backdrop-blur-sm">Check-in</div>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto scrollbar-thin" data-testid="guest-table-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const guest = guests[virtualRow.index];
            const isArrived = arrived.has(guest.id);
            return (
              <div
                key={guest.id}
                role="row"
                data-testid="guest-row"
                className={cn(
                  'absolute inset-x-0 grid cursor-pointer items-center border-b border-border/60 text-sm transition-colors hover:bg-accent/40',
                  selected.has(guest.id) && 'bg-primary/5',
                )}
                style={{
                  gridTemplateColumns: gridTemplate,
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => openGuest(guest.id)}
              >
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(guest.id)}
                    aria-label={`Select ${guest.name}`}
                    onCheckedChange={() => toggleSelected(guest.id)}
                  />
                </div>
                {columns.map((column) => (
                  <div
                    key={column.id}
                    className={cn('min-w-0 truncate px-2', column.align === 'right' && 'text-right')}
                  >
                    {column.render(guest, context)}
                  </div>
                ))}
                <div
                  className="sticky right-0 bg-background/95 px-2 text-right backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isArrived ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Check className="size-3.5" /> In
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onCheckIn(guest)}>
                      Check in
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
