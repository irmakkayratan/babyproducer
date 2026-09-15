import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import { deriveTimes, formatClock, formatDuration } from '@/lib/time';
import { useRundown } from './useRundown';
import { DriftPill } from './DriftPill';

/**
 * Full-screen, keyboard-first, dark: what the show caller looks at while the
 * room is dark. Current cue, next cue, elapsed against planned, and nothing
 * else competing for attention.
 */
export function CallerMode() {
  const { eventId, workspaceId } = useParams();
  const navigate = useNavigate();
  const events = useStore((s) => s.events);
  const event = events.find((e) => e.id === eventId);
  const { cues, meta, ready, actions } = useRundown(eventId);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const times = useMemo(() => deriveTimes(meta.showStart, cues), [meta.showStart, cues]);
  const index = cues.findIndex((cue) => cue.id === meta.callerCueId);
  const current = cues[index];
  const next = cues[index + 1];

  useEffect(() => {
    // Start at the top of the sheet if nobody has called a cue yet.
    if (cues.length > 0 && index < 0) actions.setCaller(cues[0].id);
  }, [cues, index, actions]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === ' ') {
        event.preventDefault();
        actions.setCaller(cues[index + 1]?.id ?? null);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (index > 0) actions.setCaller(cues[index - 1].id);
      }
      if (event.key === 'Escape') navigate(`/w/${workspaceId}/events/${eventId}/rundown`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, cues, index, navigate, workspaceId, eventId]);

  const elapsed = current?.actualStart
    ? Math.round((now - new Date(current.actualStart).getTime()) / 1000)
    : 0;
  const remaining = current ? current.durationSec - elapsed : 0;
  const drift = index >= 0 ? Math.round((now - new Date(times[index].plannedStart).getTime()) / 1000) : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background p-6 sm:p-10" data-testid="caller-mode">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {event?.name} · cue {index + 1} of {cues.length}
        </div>
        <div className="flex items-center gap-3">
          <DriftPill seconds={drift} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Leave caller mode"
            onClick={() => navigate(`/w/${workspaceId}/events/${eventId}/rundown`)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">On now</p>
          <h1 className="mt-2 font-display text-5xl leading-tight tracking-tight sm:text-7xl">
            {current?.label ?? (ready && cues.length > 0 ? 'End of show' : 'Standing by')}
          </h1>
          {current && (
            <p className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-2xl sm:text-3xl" data-numeric>
              <span className={remaining < 0 ? 'text-destructive' : 'text-foreground'}>
                {formatDuration(Math.abs(remaining))} {remaining < 0 ? 'over' : 'left'}
              </span>
              <span className="text-base text-muted-foreground">
                planned {formatDuration(current.durationSec)} · start {formatClock(times[index].plannedStart, event?.timezone)}
              </span>
            </p>
          )}
        </div>

        {next && (
          <div className="border-t pt-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Next</p>
            <p className="mt-1 text-2xl text-muted-foreground sm:text-3xl">{next.label}</p>
            {Object.entries(next.cells).filter(([, value]) => value).length > 0 && (
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground/80">
                {Object.entries(next.cells)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <span key={key}>
                      <span className="uppercase tracking-wide">{key}</span> {String(value)}
                    </span>
                  ))}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <kbd className="rounded border px-1.5 py-0.5 text-xs">space</kbd> next
        <kbd className="ml-3 rounded border px-1.5 py-0.5 text-xs">←</kbd> back
        <kbd className="ml-3 rounded border px-1.5 py-0.5 text-xs">esc</kbd> exit
        <Button
          className="ml-auto"
          size="lg"
          onClick={() => actions.setCaller(cues[index + 1]?.id ?? null)}
          disabled={!current}
        >
          Next cue
        </Button>
      </div>
    </div>
  );
}
