import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Monitor,
  Pin,
  PinOff,
  Play,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import type { Cue, RundownColumn } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/EmptyState';
import { useStore } from '@/store';
import { deriveTimes, formatClock, formatDuration, parseDuration, totalRuntimeSec } from '@/lib/time';
import { DEFAULT_RUNDOWN_COLUMNS } from '@/data/defaults';
import { getTemplate } from '@/data/templates';
import { useRundown } from './useRundown';
import { EditableCell } from './EditableCell';
import { DriftPill } from './DriftPill';
import { CallerBar } from './CallerBar';
import { PrintSheet } from './PrintSheet';
import { seedRundown } from '@/data/seed/rundowns';
import { getScenario } from '@/data/seed/scenarios';
import { cn } from '@/lib/utils';

export function RundownPage() {
  const { eventId, workspaceId } = useParams();
  const navigate = useNavigate();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const event = events.find((e) => e.id === eventId);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (eventId) setActiveEvent(eventId);
  }, [eventId, setActiveEvent]);

  /**
   * A brand-new rundown starts from the event's template: its department
   * columns, and for a demo event, the scenario's cue stack.
   */
  const seed = useCallback(
    (doc: Parameters<typeof seedRundown>[0]) => {
      if (!event) return;
      const template = getTemplate(event.templateId ?? 'blank');
      const columns = template.rundownColumns ?? DEFAULT_RUNDOWN_COLUMNS;
      const scenario = [...(workspace?.demo ? ['aurelia', 'lumen', 'nova'] : [])]
        .map(getScenario)
        .find((candidate) => candidate?.name === event.name);

      seedRundown(doc, {
        eventId: event.id,
        templateId: scenario ? scenario.templateId : 'none',
        showStart: event.startsAt,
        doorsAt: event.doorsAt,
        columns,
        seed: scenario?.seed ?? event.id,
      });
    },
    [event, workspace?.demo],
  );

  const { cues, meta, ready, actions } = useRundown(eventId, seed);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const times = useMemo(() => deriveTimes(meta.showStart, cues), [meta.showStart, cues]);
  const runtime = useMemo(() => totalRuntimeSec(meta.showStart, cues), [meta.showStart, cues]);
  const callerIndex = cues.findIndex((cue) => cue.id === meta.callerCueId);

  const liveDrift = useMemo(() => {
    if (callerIndex < 0) return 0;
    return Math.round((now - new Date(times[callerIndex].plannedStart).getTime()) / 1000);
  }, [callerIndex, now, times]);

  const columns: RundownColumn[] = meta.columns.length > 0 ? meta.columns : DEFAULT_RUNDOWN_COLUMNS;
  const gridTemplate = `84px 78px minmax(220px,1.4fr) ${columns.map((c) => `minmax(120px, ${c.width}px)`).join(' ')} 92px`;

  if (!event) return null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col print:block print:h-auto">
      <PrintSheet
        eventName={event.name}
        venue={event.venue.name}
        timezone={event.timezone}
        cues={cues}
        times={times}
        columns={columns}
      />
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 print:hidden sm:px-6">
        <div className="mr-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Show start <span className="font-mono text-foreground" data-numeric>{formatClock(meta.showStart, event.timezone)}</span>
          </span>
          <span className="text-muted-foreground">
            Runtime <span className="font-mono text-foreground" data-numeric>{formatDuration(runtime, { forceHours: true })}</span>
          </span>
          <Badge variant="muted">{cues.length} cues</Badge>
          {callerIndex >= 0 && <DriftPill seconds={liveDrift} />}
        </div>

        <Button
          size="sm"
          variant={callerIndex >= 0 ? 'default' : 'outline'}
          onClick={() => navigate(`/w/${workspaceId}/events/${eventId}/rundown/caller`)}
          disabled={cues.length === 0}
        >
          <Play className="size-4" /> Show caller
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.open(`/show/${eventId}/timer`, '_blank')}>
          <Monitor className="size-4" /> Stage timer
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
        <Button size="sm" onClick={() => actions.insert(cues.length)}>
          <Plus className="size-4" /> Cue
        </Button>
      </div>

      {callerIndex >= 0 && (
        <CallerBar
          cues={cues}
          times={times}
          callerIndex={callerIndex}
          drift={liveDrift}
          onAdvance={() => actions.setCaller(cues[callerIndex + 1]?.id ?? null)}
          onBack={() => actions.setCaller(cues[callerIndex - 1]?.id ?? null)}
          onStop={() => actions.setCaller(null)}
          onMessage={(text) => actions.message(text)}
        />
      )}

      {!ready ? (
        <div className="flex-1" />
      ) : cues.length === 0 ? (
        <EmptyState
          className="flex-1"
          title="No cues yet"
          description="Build the show minute by minute. Start times are calculated from durations, so a change anywhere re-times everything below it."
          action={
            <Button onClick={() => actions.insert(0, { label: 'Doors open', durationSec: 1800 })}>
              <Plus className="size-4" /> Add the first cue
            </Button>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin print:hidden" data-testid="rundown-scroll">
          <div
            className="sticky top-0 z-10 grid items-center border-b bg-card/95 text-xs font-medium text-muted-foreground backdrop-blur-sm"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="px-2 py-2">Start</div>
            <div className="px-2 py-2">Duration</div>
            <div className="px-2 py-2">Cue</div>
            {columns.map((column) => (
              <div key={column.id} className="truncate px-2 py-2">
                {column.label}
              </div>
            ))}
            <div className="px-2 py-2 text-right">Actions</div>
          </div>

          {cues.map((cue, index) => (
            <CueRow
              key={cue.id}
              cue={cue}
              index={index}
              columns={columns}
              gridTemplate={gridTemplate}
              plannedStart={times[index].plannedStart}
              drift={times[index].driftSec}
              anchored={times[index].anchored}
              isCaller={index === callerIndex}
              timezone={event.timezone}
              onUpdate={actions.update}
              onCell={actions.cell}
              onRemove={actions.remove}
              onMove={actions.move}
              onCall={() => actions.setCaller(cue.id)}
              onAnchor={() =>
                actions.update(cue.id, {
                  anchor: cue.anchor ? undefined : { at: times[index].plannedStart, mode: 'hard' },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CueRow({
  cue,
  index,
  columns,
  gridTemplate,
  plannedStart,
  drift,
  anchored,
  isCaller,
  timezone,
  onUpdate,
  onCell,
  onRemove,
  onMove,
  onCall,
  onAnchor,
}: {
  cue: Cue;
  index: number;
  columns: RundownColumn[];
  gridTemplate: string;
  plannedStart: string;
  drift: number;
  anchored: boolean;
  isCaller: boolean;
  timezone: string;
  onUpdate: (cueId: string, patch: Partial<Cue>) => void;
  onCell: (cueId: string, columnId: string, value: string) => void;
  onRemove: (cueId: string) => void;
  onMove: (from: number, to: number) => void;
  onCall: () => void;
  onAnchor: () => void;
}) {
  return (
    <div
      data-testid="cue-row"
      data-caller={isCaller || undefined}
      className={cn(
        'grid items-center border-b border-border/60 transition-colors hover:bg-accent/20',
        isCaller && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="font-mono text-sm" data-numeric>
          {formatClock(plannedStart, timezone)}
        </span>
        {anchored && (
          <span title={`Anchored · ${drift >= 0 ? 'late' : 'early'} by ${formatDuration(Math.abs(drift))}`}>
            <Pin className="size-3 text-primary" />
          </span>
        )}
      </div>

      <EditableCell
        ariaLabel={`Duration for ${cue.label}`}
        className="font-mono"
        value={formatDuration(cue.durationSec)}
        parse={(raw) => parseDuration(raw) !== null}
        onCommit={(raw) => {
          const seconds = parseDuration(raw);
          if (seconds !== null) onUpdate(cue.id, { durationSec: seconds });
        }}
      />

      <EditableCell
        ariaLabel={`Label for cue ${index + 1}`}
        className="font-medium"
        value={cue.label}
        onCommit={(label) => onUpdate(cue.id, { label })}
      />

      {columns.map((column) => (
        <EditableCell
          key={column.id}
          ariaLabel={`${column.label} for ${cue.label}`}
          className="text-muted-foreground"
          value={String(cue.cells[column.id] ?? '')}
          onCommit={(value) => onCell(cue.id, column.id, value)}
        />
      ))}

      <div className="flex items-center justify-end gap-0.5 px-1">
        <Button size="icon-sm" variant="ghost" aria-label="Move up" onClick={() => onMove(index, index - 1)}>
          <ChevronUp className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Move down" onClick={() => onMove(index, index + 2)}>
          <ChevronDown className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Options for ${cue.label}`}>
              ⋯
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{cue.label}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onCall}>
              <Play className="size-4" /> Call from here
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAnchor}>
              {cue.anchor ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              {cue.anchor ? 'Remove anchor' : 'Anchor to this time'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onRemove(cue.id)}>
              <Trash2 className="size-4" /> Delete cue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
