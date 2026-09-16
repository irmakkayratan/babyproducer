import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { db } from '@/data/db';
import { useStore } from '@/store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EventCoverArt } from './EventCoverArt';
import { countdownParts, formatEventWindow } from '@/lib/time';
import { formatNumber } from '@/lib/utils';

/** Quick links follow the same module toggles as the navigation. */
const QUICK_LINKS = [
  { module: 'guests', to: 'guests', label: 'Guest list' },
  { module: 'rundown', to: 'rundown', label: 'Run of show' },
  { module: 'seating', to: 'seating', label: 'Seating' },
  { module: 'checkin', to: 'checkin', label: 'Check-in' },
] as const;

const ACCENTS = [
  'hsl(258 85% 68%)',
  'hsl(38 90% 62%)',
  'hsl(325 75% 65%)',
  'hsl(190 80% 52%)',
  'hsl(152 50% 52%)',
  'hsl(210 90% 62%)',
  'hsl(12 80% 62%)',
];

export function EventOverview() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const updateEvent = useStore((s) => s.updateEvent);
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
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event theme">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                aria-label={`Set theme accent ${accent}`}
                aria-pressed={event.theme?.accent === accent}
                onClick={() => void updateEvent(event.id, { theme: { ...(event.theme ?? {}), accent } })}
                className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  event.theme?.accent === accent ? 'border-foreground' : 'border-transparent'
                }`}
                style={{ background: accent }}
              />
            ))}
          </div>
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

          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {countdown.past ? 'Doors opened' : 'Doors in'}
            </p>
            <p className="mt-1 font-mono text-3xl tabular sm:text-4xl" data-numeric>
              {countdown.past
                ? '—'
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
