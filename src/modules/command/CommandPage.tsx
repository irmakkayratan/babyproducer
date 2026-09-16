import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import GridLayout, { type Layout, type LayoutItem } from 'react-grid-layout';
import { Plus, RotateCcw, Settings2, X } from 'lucide-react';
import type { Arrival, Dashboard, TelemetrySeries, WidgetInstance } from '@/data/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { db } from '@/data/db';
import { useStore } from '@/store';
import { listArrivals } from '@/data/guests';
import { useRundown } from '@/modules/rundown/useRundown';
import { deriveTimes } from '@/lib/time';
import { getWidget, WIDGETS, type WidgetData } from './widgets';
import { ulid } from '@/lib/id';
import 'react-grid-layout/css/styles.css';

const COLUMNS = 12;
const ROW_HEIGHT = 56;

const DEFAULT_WIDGETS = [
  'arrivals',
  'show-drift',
  'metric-total',
  'dwell',
  'arrival-rate',
  'occupancy',
  'guest-mix',
  'systems',
  'alerts',
];

function defaultLayout(): WidgetInstance[] {
  let x = 0;
  let y = 0;
  return DEFAULT_WIDGETS.flatMap((key) => {
    const definition = getWidget(key);
    if (!definition) return [];
    if (x + definition.defaultSize.w > COLUMNS) {
      x = 0;
      y += definition.defaultSize.h;
    }
    const instance: WidgetInstance = {
      id: ulid(),
      widgetKey: key,
      settings: {},
      layout: { x, y, w: definition.defaultSize.w, h: definition.defaultSize.h },
    };
    x += definition.defaultSize.w;
    return [instance];
  });
}

/**
 * The show-floor dashboard: dark, dense, and arranged by whoever is watching
 * it. Layout is persisted per dashboard so the screen comes back exactly as it
 * was left.
 */
export function CommandPage() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const guests = useStore((s) => s.guests);
  const loadGuests = useStore((s) => s.loadGuests);

  const event = events.find((e) => e.id === eventId);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySeries[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [width, setWidth] = useState(1200);
  const { cues, meta } = useRundown(eventId);

  useEffect(() => {
    if (eventId) {
      setActiveEvent(eventId);
      void loadGuests(eventId);
    }
  }, [eventId, setActiveEvent, loadGuests]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const measure = () => setWidth(Math.max(600, window.innerWidth - (window.innerWidth >= 768 ? 300 : 32)));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      const [existing, arrivalRows, telemetryRows] = await Promise.all([
        db.dashboards.where('eventId').equals(eventId).first(),
        listArrivals(eventId),
        db.telemetry.where('eventId').equals(eventId).toArray(),
      ]);
      setArrivals(arrivalRows);
      setTelemetry(telemetryRows);

      if (existing) {
        setDashboard(existing);
        return;
      }
      const iso = new Date().toISOString();
      const created: Dashboard = {
        id: ulid(),
        eventId,
        name: 'Command Center',
        widgets: defaultLayout(),
        createdAt: iso,
        updatedAt: iso,
        rev: 1,
      };
      await db.dashboards.put(created);
      setDashboard(created);
    })();
  }, [eventId]);

  const save = useCallback(async (next: Dashboard) => {
    const stamped = { ...next, updatedAt: new Date().toISOString(), rev: next.rev + 1 };
    setDashboard(stamped);
    await db.dashboards.put(stamped);
  }, []);

  const drift = useMemo(() => {
    if (!meta.callerCueId) return 0;
    const times = deriveTimes(meta.showStart, cues);
    const index = cues.findIndex((cue) => cue.id === meta.callerCueId);
    if (index < 0) return 0;
    return Math.round((now - new Date(times[index].plannedStart).getTime()) / 1000);
  }, [meta.callerCueId, meta.showStart, cues, now]);

  const data: WidgetData | null = useMemo(() => {
    if (!workspace) return null;
    return {
      guests,
      arrivals,
      telemetry,
      cues,
      callerCueId: meta.callerCueId,
      drift,
      schema: workspace.schema,
      metrics: workspace.metrics,
      capacity: event?.capacity ?? null,
      now,
    };
  }, [workspace, guests, arrivals, telemetry, cues, meta.callerCueId, drift, event?.capacity, now]);

  if (!event || !workspace || !dashboard || !data) return null;

  const layout: LayoutItem[] = dashboard.widgets.map((widget) => ({
    i: widget.id,
    ...widget.layout,
    minW: getWidget(widget.widgetKey)?.minSize.w ?? 2,
    minH: getWidget(widget.widgetKey)?.minSize.h ?? 2,
  }));

  function onLayoutChange(next: Layout) {
    if (!dashboard) return;
    const byId = new Map(next.map((item) => [item.i, item]));
    const widgets = dashboard.widgets.map((widget) => {
      const item = byId.get(widget.id);
      return item ? { ...widget, layout: { x: item.x, y: item.y, w: item.w, h: item.h } } : widget;
    });
    void save({ ...dashboard, widgets });
  }

  function addWidget(key: string) {
    if (!dashboard) return;
    const definition = getWidget(key);
    if (!definition) return;
    const maxY = dashboard.widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.h), 0);
    void save({
      ...dashboard,
      widgets: [
        ...dashboard.widgets,
        {
          id: ulid(),
          widgetKey: key,
          settings: {},
          layout: { x: 0, y: maxY, w: definition.defaultSize.w, h: definition.defaultSize.h },
        },
      ],
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
        <p className="mr-auto text-sm text-muted-foreground">
          {dashboard.name} · {dashboard.widgets.length} widgets · layout saved on this device
        </p>
        <Button size="sm" variant="ghost" onClick={() => void save({ ...dashboard, widgets: defaultLayout() })}>
          <RotateCcw className="size-4" /> Reset layout
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Add widget
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
            <DropdownMenuLabel>Widgets</DropdownMenuLabel>
            {WIDGETS.map((widget) => (
              <DropdownMenuItem key={widget.key} onSelect={() => addWidget(widget.key)}>
                <span className="min-w-0">
                  <span className="block font-medium">{widget.title}</span>
                  <span className="block text-xs text-muted-foreground">{widget.description}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/10 p-3 scrollbar-thin" data-testid="command-grid">
        <GridLayout
          className="layout"
          layout={layout}
          width={width}
          gridConfig={{ cols: COLUMNS, rowHeight: ROW_HEIGHT, margin: [12, 12] }}
          dragConfig={{ cancel: '.widget-no-drag' }}
          onLayoutChange={onLayoutChange}
        >
          {dashboard.widgets.map((widget) => {
            const definition = getWidget(widget.widgetKey);
            if (!definition) return <div key={widget.id} />;
            const settings = definition.settings?.(data) ?? [];

            return (
              <div
                key={widget.id}
                data-testid="widget"
                data-widget={widget.widgetKey}
                className="group relative overflow-hidden rounded-lg border bg-card"
              >
                <div className="widget-no-drag absolute right-1.5 top-1.5 z-10 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  {settings.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={`Settings for ${definition.title}`}>
                          <Settings2 className="size-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="space-y-3">
                        {settings.map((setting) => (
                          <div key={setting.id} className="space-y-1.5">
                            <Label htmlFor={`${widget.id}-${setting.id}`}>{setting.label}</Label>
                            <Select
                              value={String(widget.settings[setting.id] ?? setting.options?.[0]?.value ?? '')}
                              onValueChange={(value) =>
                                void save({
                                  ...dashboard,
                                  widgets: dashboard.widgets.map((candidate) =>
                                    candidate.id === widget.id
                                      ? { ...candidate, settings: { ...candidate.settings, [setting.id]: value } }
                                      : candidate,
                                  ),
                                })
                              }
                            >
                              <SelectTrigger id={`${widget.id}-${setting.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {setting.options?.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${definition.title}`}
                    onClick={() =>
                      void save({
                        ...dashboard,
                        widgets: dashboard.widgets.filter((candidate) => candidate.id !== widget.id),
                      })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <definition.Component
                  data={data}
                  settings={widget.settings as Record<string, string | number>}
                />
              </div>
            );
          })}
        </GridLayout>
      </div>
    </div>
  );
}
