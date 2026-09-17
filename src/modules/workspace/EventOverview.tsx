import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, ClipboardCheck, MapPin, Users } from 'lucide-react';
import { db } from '@/data/db';
import { useStore } from '@/store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EventCoverArt } from './EventCoverArt';
import { countdownParts, formatEventWindow } from '@/lib/time';
import { summarizeAdvance } from '@/modules/advancing/model';
import { formatNumber } from '@/lib/utils';

/** Quick links follow the same module toggles, and the same order, as the nav. */
const QUICK_LINKS = [
  { module: 'advancing', to: 'advancing', label: 'Advancing' },
  { module: 'guests', to: 'guests', label: 'Guest list' },
  { module: 'rundown', to: 'rundown', label: 'Run of show' },
  { module: 'seating', to: 'seating', label: 'Seating' },
  { module: 'checkin', to: 'checkin', label: 'Check-in' },
  { module: 'settlement', to: 'settlement', label: 'Settlement' },
] as const;


export function EventOverview() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const event = events.find((e) => e.id === eventId);
  const enabledModules = useStore(
    (s) => s.workspaces.find((workspace) => workspace.id === event?.workspaceId)?.enabledModules,
  );

  useEffect(() => {
    if (eventId) setActiveEvent(eventId);
  }, [eventId, setActiveEvent]);

  const counts = useLiveQuery(async () => {
    if (!eventId) return { guests: 0, confirmed: 0, arrived: 0 };
    const guests = await db.guests.where('eventId').equals(eventId).toArray();
    const arrivals = await db.arrivals.where('eventId').equals(eventId).toArray();
    const arrivedIds = new Set(arrivals.filter((a) => !a.undone).map((a) => a.guestId));
    return {
      guests: guests.length,
      confirmed: guests.filter((g) => g.statusId === 'confirmed' || arrivedIds.has(g.id)).length,
      arrived: arrivedIds.size,
    };
  }, [eventId]) ?? { guests: 0, confirmed: 0, arrived: 0 };

  // The advance is the headline on this page, so it is read here. Nobody
  // should have to click into the module to find out where the show stands.
  const advance = useLiveQuery(async () => {
    if (!eventId) return null;
    const sheet = await db.advanceSheets.where('eventId').equals(eventId).first();
    return sheet ? summarizeAdvance(sheet) : null;
  }, [eventId]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!event) {
    return <div className="p-8 text-sm text-muted-foreground">Event not found.</div>;
  }

  const countdown = countdownParts(event.doorsAt ?? event.startsAt);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <EventCoverArt event={event} className="aspect-square w-full rounded-lg border" />
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{event.kind}</Badge>
              <span className="text-xs text-muted-foreground">{event.timezone}</span>
            </div>
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight">{event.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                {formatEventWindow(event.startsAt, event.endsAt, event.timezone)}
              </span>
              {event.venue.name && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {event.venue.name}
                </span>
              )}
              {event.capacity != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" />
                  {formatNumber(event.capacity)} capacity
                </span>
              )}
            </div>
          </div>

          {advance && (enabledModules?.includes('advancing') ?? true) && (
            <Card className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <ClipboardCheck className="size-3.5" />
                  Advance
                </p>
                <Link
                  to={`/w/${event.workspaceId}/events/${event.id}/advancing`}
                  className="text-xs underline underline-offset-4 hover:no-underline"
                >
                  Open the advance
                </Link>
              </div>
              <p className="mt-2 font-mono text-3xl tabular sm:text-4xl" data-numeric>
                {Math.round(advance.readiness * 100)}%
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-[width] duration-500"
                  style={{ width: `${Math.round(advance.readiness * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {advance.applicable === advance.confirmed
                  ? 'Everything on the sheet is confirmed.'
                  : `${advance.applicable - advance.confirmed} of ${advance.applicable} still open` +
                    (advance.overdue.length > 0 ? `, ${advance.overdue.length} past its date` : '')}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {countdown.past ? 'Doors opened' : 'Doors in'}
            </p>
            <p className="mt-1 font-mono text-3xl tabular sm:text-4xl" data-numeric>
              {countdown.past
                ? '-'
                : `${countdown.days}d ${String(countdown.hours).padStart(2, '0')}:${String(
                    countdown.minutes,
                  ).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`}
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Guests" value={counts.guests} />
            <Stat label="Confirmed" value={counts.confirmed} />
            <Stat label="Arrived" value={counts.arrived} />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_LINKS.filter((link) => enabledModules?.includes(link.module) ?? true).map((link) => (
              <Button key={link.module} asChild variant="outline">
                <Link to={`/w/${event.workspaceId}/events/${event.id}/${link.to}`}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular" data-numeric>
        {formatNumber(value)}
      </p>
    </Card>
  );
}
