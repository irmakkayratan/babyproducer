import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Minus, Plus, Printer, Search, Wand2 } from 'lucide-react';
import type { Guest, SeatingMap } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { VocabDot } from '@/components/VocabDot';
import { useStore } from '@/store';
import { assignSeat, clearSeat, getSeatingMap, putSeatingMap } from '@/data/seating';
import { db } from '@/data/db';
import { allSeats, seatCount } from './geometry';
import { buildPreset } from '@/data/seed/rooms';
import { assignmentBlocked, evaluateRules } from './rules';
import { SeatingCanvas } from './SeatingCanvas';
import { getTemplate } from '@/data/templates';
import { cn } from '@/lib/utils';

export function SeatingPage() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const guests = useStore((s) => s.guests);
  const loadGuests = useStore((s) => s.loadGuests);
  const reloadGuests = useStore((s) => s.reloadGuests);

  const event = events.find((e) => e.id === eventId);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const [map, setMap] = useState<SeatingMap | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(0.85);

  useEffect(() => {
    if (eventId) {
      setActiveEvent(eventId);
      void loadGuests(eventId);
    }
  }, [eventId, setActiveEvent, loadGuests]);

  useEffect(() => {
    if (!eventId || !event) return;
    void (async () => {
      const existing = await getSeatingMap(eventId);
      if (existing) {
        setMap(existing);
        return;
      }
      // A room is created from the event's template the first time seating is
      // opened — an empty canvas would be a worse starting point than a plan.
      const preset = getTemplate(event.templateId ?? 'blank').seatingPreset ?? 'none';
      const created = buildPreset(preset, eventId, { capacity: event.capacity ?? undefined });
      if (created) {
        await db.seatingMaps.put(created);
        setMap(created);
      }
    })();
  }, [eventId, event]);

  const guestsById = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests]);
  const violations = useMemo(() => (map ? evaluateRules(map, guests) : []), [map, guests]);
  const seated = useMemo(
    () => new Set(map ? allSeats(map).map((position) => position.seat.guestId).filter(Boolean) : []),
    [map],
  );

  const unseated = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return guests
      .filter((guest) => !seated.has(guest.id))
      .filter((guest) => !needle || `${guest.name} ${guest.company ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 300);
  }, [guests, seated, search]);

  const handleAssign = useCallback(
    async (seatId: string, guestId: string) => {
      if (!map) return;
      const blocking = assignmentBlocked(map, guests, seatId, guestId);
      if (blocking) {
        toast.error('Blocked by a seating rule', { description: blocking.message });
        return;
      }
      const next = await assignSeat(map.id, seatId, guestId);
      if (next) setMap(next);
      await reloadGuests();
    },
    [map, guests, reloadGuests],
  );

  const handleClear = useCallback(
    async (seatId: string) => {
      if (!map) return;
      const next = await clearSeat(map.id, seatId);
      if (next) setMap(next);
      await reloadGuests();
    },
    [map, reloadGuests],
  );

  /** Fill the room by tier, best seats first — a starting point, not a decision. */
  async function autoSeat() {
    if (!map) return;
    const tierOrder = new Map((workspace?.schema.tiers ?? []).map((tier, index) => [tier.id, index]));
    const queue = guests
      .filter((guest) => !seated.has(guest.id) && guest.statusId !== 'declined')
      .sort((a, b) => (tierOrder.get(a.tierId ?? '') ?? 99) - (tierOrder.get(b.tierId ?? '') ?? 99));

    const free = allSeats(map).filter((position) => !position.seat.guestId);
    let current = map;
    let placed = 0;

    for (const position of free) {
      const guest = queue[placed];
      if (!guest) break;
      if (assignmentBlocked(current, guests, position.seat.id, guest.id)) continue;
      const next = await assignSeat(current.id, position.seat.id, guest.id);
      if (next) current = next;
      placed++;
    }

    setMap(current);
    await reloadGuests();
    toast.success(`Seated ${placed} ${placed === 1 ? 'guest' : 'guests'}`, {
      description: 'By tier, best seats first. Move anyone who should sit elsewhere.',
    });
  }

  async function addRow() {
    if (!map) return;
    const { makeRow } = await import('./geometry');
    const next: SeatingMap = {
      ...map,
      elements: [
        ...map.elements,
        makeRow({ label: `R${map.elements.length + 1}`, seats: 10, x: 120, y: map.canvas.height - 80 }),
      ],
    };
    setMap(await putSeatingMap(next));
  }

  if (!event || !workspace) return null;

  if (!map) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        title="No room yet"
        description="This event's template does not include a room shape. Add one and start placing guests."
        action={
          <Button
            onClick={async () => {
              const created = buildPreset('theatre', event.id, { capacity: event.capacity ?? undefined })!;
              await db.seatingMaps.put(created);
              setMap(created);
            }}
          >
            <Plus className="size-4" /> Create a room
          </Button>
        }
      />
    );
  }

  const selectedSeat = selectedSeatId
    ? allSeats(map).find((position) => position.seat.id === selectedSeatId)
    : undefined;
  const total = seatCount(map);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 print:hidden sm:px-6">
        <div className="mr-auto flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            <span className="text-foreground" data-numeric>
              {seated.size}
            </span>{' '}
            of {total} seats filled
          </span>
          <Badge variant="muted">{guests.length - seated.size} unseated</Badge>
          {violations.length > 0 && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="size-3" />
              {violations.length} {violations.length === 1 ? 'issue' : 'issues'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
            <Minus className="size-4" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground" data-numeric>
            {Math.round(zoom * 100)}%
          </span>
          <Button size="icon-sm" variant="outline" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}>
            <Plus className="size-4" />
          </Button>
        </div>

        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="size-4" /> Row
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
        <Button size="sm" onClick={() => void autoSeat()}>
          <Wand2 className="size-4" /> Auto-seat
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className="min-h-0 flex-1 overflow-auto bg-muted/20 p-6 scrollbar-thin"
          data-testid="seating-scroll"
          tabIndex={0}
          role="region"
          aria-label="Room plan"
        >
          <SeatingCanvas
            map={map}
            guests={guestsById}
            tiers={workspace.schema.tiers}
            violations={violations}
            selectedSeatId={selectedSeatId}
            onSelectSeat={setSelectedSeatId}
            onAssign={(seatId, guestId) => void handleAssign(seatId, guestId)}
            onClear={(seatId) => void handleClear(seatId)}
            zoom={zoom}
          />
        </div>

        <aside className="flex w-80 shrink-0 flex-col border-l print:hidden">
          {selectedSeat && (
            <div className="border-b p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Seat {selectedSeat.seat.label}
              </p>
              {selectedSeat.seat.guestId ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {guestsById.get(selectedSeat.seat.guestId)?.name ?? 'Unknown guest'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void handleClear(selectedSeat.seat.id)}>
                    Clear
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a guest below, or drag one onto the seat.
                </p>
              )}
            </div>
          )}

          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search unseated guests…"
                aria-label="Search unseated guests"
                className="pl-9"
              />
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto scrollbar-thin"
            data-testid="unseated-list"
            tabIndex={0}
            role="region"
            aria-label="Unseated guests"
          >
            {unseated.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Everyone matching is seated.</p>
            ) : (
              unseated.map((guest) => (
                <UnseatedRow
                  key={guest.id}
                  guest={guest}
                  tierLabel={workspace.schema.tiers.find((tier) => tier.id === guest.tierId)}
                  canSeat={Boolean(selectedSeatId)}
                  onSeat={() => selectedSeatId && void handleAssign(selectedSeatId, guest.id)}
                />
              ))
            )}
          </div>

          {violations.length > 0 && (
            <div className="max-h-48 overflow-y-auto border-t p-3 scrollbar-thin" data-testid="violations">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Issues</p>
              <ul className="space-y-2 text-sm">
                {violations.map((violation, index) => (
                  <li key={`${violation.ruleId}-${index}`} className="flex gap-2">
                    <AlertTriangle
                      className={cn('mt-0.5 size-3.5 shrink-0', violation.severity === 'block' ? 'text-destructive' : 'text-warning')}
                    />
                    <span className="text-muted-foreground">{violation.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function UnseatedRow({
  guest,
  tierLabel,
  canSeat,
  onSeat,
}: {
  guest: Guest;
  tierLabel?: { id: string; label: string; color?: string; order: number };
  canSeat: boolean;
  onSeat: () => void;
}) {
  return (
    <div
      draggable
      data-testid="unseated-guest"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', guest.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="flex cursor-grab items-center gap-2 border-b border-border/60 px-3 py-2 text-sm hover:bg-accent/40 active:cursor-grabbing"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" data-testid="unseated-name">
          {guest.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {tierLabel ? <VocabDot vocab={tierLabel} /> : (guest.company ?? '—')}
        </p>
      </div>
      {canSeat && (
        <Button size="sm" variant="ghost" onClick={onSeat}>
          Seat
        </Button>
      )}
    </div>
  );
}
