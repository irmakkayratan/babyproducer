import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { EventWizard } from '@/modules/workspace/EventWizard';
import { EventCoverArt } from '@/modules/workspace/EventCoverArt';
import { useStore } from '@/store';
import { formatEventWindow, relativeToNow } from '@/lib/time';

export function WorkspaceHome() {
  const { workspaceId } = useParams();
  const workspaces = useStore((s) => s.workspaces);
  const events = useStore((s) => s.events);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const [wizardOpen, setWizardOpen] = useState(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (workspaceId && workspace && workspaceId !== useStore.getState().activeWorkspaceId) {
      void setActiveWorkspace(workspaceId);
    }
  }, [workspaceId, workspace, setActiveWorkspace]);

  useEffect(() => {
    setActiveEvent(null);
  }, [setActiveEvent]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: events.filter((e) => new Date(e.endsAt).getTime() >= now),
      past: events.filter((e) => new Date(e.endsAt).getTime() < now).reverse(),
    };
  }, [events]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{workspace?.name ?? 'Events'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length} {events.length === 1 ? 'event' : 'events'}
            {workspace?.demo && ' · demo workspace'}
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="size-4" /> New event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          className="mt-10 rounded-lg border border-dashed"
          title="No events yet"
          description="Create one from a template — runway show, activation, keynote, conference or gala — and the vocabulary, cue columns and dashboards come with it."
          action={
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="size-4" /> Create your first event
            </Button>
          }
        />
      ) : (
        <div className="mt-8 space-y-10">
          <EventGrid title="Upcoming" events={upcoming} />
          {past.length > 0 && <EventGrid title="Past" events={past} dimmed />}
        </div>
      )}

      <EventWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function EventGrid({
  title,
  events,
  dimmed,
}: {
  title: string;
  events: ReturnType<typeof useStore.getState>['events'];
  dimmed?: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.id}
            to={`/w/${event.workspaceId}/events/${event.id}/overview`}
            className={`group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              dimmed ? 'opacity-70 hover:opacity-100' : ''
            }`}
          >
            <EventCoverArt event={event} className="aspect-square w-full" />
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-snug">{event.name}</h3>
                <Badge variant="muted">{event.kind}</Badge>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                {formatEventWindow(event.startsAt, event.endsAt)} · {relativeToNow(event.startsAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
