import { useMemo } from 'react';
import type { Guest, SeatingMap, Vocab } from '@/data/types';
import { allSeats, SEAT_SIZE } from './geometry';
import type { Violation } from './rules';
import { violatingSeatIds } from './rules';
import { cn, initials } from '@/lib/utils';

/**
 * The room.
 *
 * Dragging is native HTML5 drag-and-drop — cheap enough for a thousand seats —
 * and every action has a keyboard equivalent: seats are focusable, Enter opens
 * the assignment search, Backspace clears.
 */
export function SeatingCanvas({
  map,
  guests,
  tiers,
  violations,
  selectedSeatId,
  onSelectSeat,
  onAssign,
  onClear,
  zoom,
}: {
  map: SeatingMap;
  guests: Map<string, Guest>;
  tiers: Vocab[];
  violations: Violation[];
  selectedSeatId: string | null;
  onSelectSeat: (seatId: string | null) => void;
  onAssign: (seatId: string, guestId: string) => void;
  onClear: (seatId: string) => void;
  zoom: number;
}) {
  const positions = useMemo(() => allSeats(map), [map]);
  const flagged = useMemo(() => violatingSeatIds(violations), [violations]);
  const tierColor = useMemo(() => new Map(tiers.map((tier) => [tier.id, tier.color])), [tiers]);
  const zoneColor = useMemo(() => new Map(map.zones.map((zone) => [zone.id, zone.color])), [map.zones]);

  return (
    <div
      className="relative origin-top-left"
      style={{
        width: map.canvas.width,
        height: map.canvas.height,
        transform: `scale(${zoom})`,
        backgroundImage:
          'radial-gradient(circle, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)',
        backgroundSize: `${map.canvas.gridSize * 2}px ${map.canvas.gridSize * 2}px`,
      }}
      onClick={() => onSelectSeat(null)}
      data-testid="seating-canvas"
    >
      {map.elements.map((element) => {
        if ('seats' in element && element.kind === 'row') {
          return (
            <div
              key={element.id}
              className="absolute text-[10px] uppercase tracking-wide text-muted-foreground"
              style={{ left: element.x - 26, top: element.y + 4 }}
            >
              {element.label}
            </div>
          );
        }
        if (element.kind === 'table') {
          return (
            <div
              key={element.id}
              className="absolute grid place-items-center border border-border/80 bg-card/60 text-xs text-muted-foreground"
              style={{
                left: element.x,
                top: element.y,
                width: element.w,
                height: element.h,
                borderRadius: element.shape === 'round' ? '50%' : 'var(--radius)',
              }}
            >
              {element.label}
            </div>
          );
        }
        return (
          <div
            key={element.id}
            className={cn(
              'absolute grid place-items-center rounded-md border text-xs uppercase tracking-widest',
              element.kind === 'runway' || element.kind === 'stage'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground',
            )}
            style={{ left: element.x, top: element.y, width: element.w, height: element.h }}
          >
            {element.label}
          </div>
        );
      })}

      {positions.map(({ seat, element, x, y }) => {
        const guest = seat.guestId ? guests.get(seat.guestId) : undefined;
        const color = guest?.tierId ? tierColor.get(guest.tierId) : zoneColor.get(element.zoneId ?? '');
        const background = color?.startsWith('tier-') ? `var(--${color})` : color;
        const isFlagged = flagged.has(seat.id);
        const isSelected = selectedSeatId === seat.id;

        return (
          <button
            key={seat.id}
            type="button"
            data-testid="seat"
            data-seat-id={seat.id}
            data-occupied={guest ? 'true' : undefined}
            aria-label={
              guest
                ? `Seat ${seat.label}, ${guest.name}${isFlagged ? ', rule violation' : ''}`
                : `Seat ${seat.label}, empty`
            }
            aria-pressed={isSelected}
            title={guest ? `${seat.label} · ${guest.name}` : seat.label}
            className={cn(
              'absolute grid place-items-center rounded-[6px] border text-[9px] font-medium transition-[transform,box-shadow] duration-100',
              'hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              guest ? 'text-black/80' : 'border-dashed border-border text-muted-foreground/60',
              isSelected && 'ring-2 ring-ring',
              isFlagged && 'ring-2 ring-destructive',
            )}
            style={{
              left: x,
              top: y,
              width: SEAT_SIZE,
              height: SEAT_SIZE,
              background: guest ? (background ?? 'var(--muted-foreground)') : 'transparent',
            }}
            draggable={Boolean(guest)}
            onDragStart={(e) => {
              if (!guest) return;
              e.dataTransfer.setData('text/plain', guest.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const guestId = e.dataTransfer.getData('text/plain');
              if (guestId) onAssign(seat.id, guestId);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSeat(isSelected ? null : seat.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                onClear(seat.id);
              }
            }}
          >
            {guest ? initials(guest.name) : ''}
          </button>
        );
      })}
    </div>
  );
}
