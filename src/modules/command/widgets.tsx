/**
 * Widget registry.
 *
 * The grid knows nothing about any individual widget: adding one is a single
 * entry here, with its own settings schema and a component that receives the
 * event's data. That is what keeps the dashboard user-composable.
 */
import { lazy, Suspense, type ComponentType } from 'react';
import type { Arrival, Cue, Guest, MetricConfig, SchemaConfig, TelemetrySeries } from '@/data/types';
import { Skeleton } from '@/components/ui/skeleton';
import { compact, formatCurrency, formatNumber } from '@/lib/utils';
import { sumMetric } from '@/modules/metrics/engine';
import { formatDuration } from '@/lib/time';

const Sparkline = lazy(() => import('./Sparkline'));

export interface WidgetData {
  guests: Guest[];
  arrivals: Arrival[];
  telemetry: TelemetrySeries[];
  cues: Cue[];
  callerCueId: string | null;
  drift: number;
  schema: SchemaConfig;
  metrics: MetricConfig[];
  capacity: number | null;
  now: number;
}

export interface WidgetSetting {
  id: string;
  label: string;
  kind: 'select' | 'number';
  options?: Array<{ value: string; label: string }>;
}

export interface WidgetDefinition {
  key: string;
  title: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  settings?: (data: WidgetData) => WidgetSetting[];
  Component: ComponentType<{ data: WidgetData; settings: Record<string, string | number> }>;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'warn' | 'critical' | 'good';
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`font-mono text-3xl leading-none ${
          tone === 'critical' ? 'text-destructive' : tone === 'warn' ? 'text-warning' : tone === 'good' ? 'text-success' : ''
        }`}
        data-numeric
      >
        {value}
      </p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function seriesFor(data: WidgetData, settings: Record<string, string | number>, metric: string) {
  const preferred = settings.source ? data.telemetry.find((s) => s.source === settings.source) : undefined;
  return preferred ?? data.telemetry.find((series) => series.metric === metric) ?? data.telemetry[0];
}

function sourceSettings(data: WidgetData): WidgetSetting[] {
  return [
    {
      id: 'source',
      label: 'Source',
      kind: 'select',
      options: data.telemetry.map((series) => ({ value: series.source, label: `${series.source} · ${series.metric}` })),
    },
  ];
}

export const WIDGETS: WidgetDefinition[] = [
  {
    key: 'arrivals',
    title: 'Arrivals',
    description: 'How full the room is against what was expected.',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    Component: ({ data }) => {
      const arrived = new Set(data.arrivals.filter((a) => !a.undone).map((a) => a.guestId)).size;
      const expected = data.guests.filter((guest) => guest.statusId !== 'declined').length;
      const pct = expected ? Math.round((arrived / expected) * 100) : 0;
      return <Stat label="In the room" value={formatNumber(arrived)} sub={`${pct}% of ${formatNumber(expected)} expected`} />;
    },
  },
  {
    key: 'arrival-rate',
    title: 'Arrival rate',
    description: 'Check-ins per five minutes across the door window.',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    Component: ({ data }) => {
      const buckets = new Map<number, number>();
      for (const arrival of data.arrivals) {
        if (arrival.undone) continue;
        const bucket = Math.floor(new Date(arrival.at).getTime() / 300_000);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      }
      const points = [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([bucket, count]) => ({ t: new Date(bucket * 300_000).toISOString(), v: count }));
      return (
        <Suspense fallback={<Skeleton className="m-4 h-[calc(100%-2rem)]" />}>
          <Sparkline points={points} unit="check-ins / 5 min" />
        </Suspense>
      );
    },
  },
  {
    key: 'occupancy',
    title: 'Occupancy',
    description: 'Live headcount from a room sensor.',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    settings: sourceSettings,
    Component: ({ data, settings }) => {
      const series = seriesFor(data, settings, 'occupancy');
      if (!series) return <Stat label="Occupancy" value="-" sub="No sensor data" />;
      return (
        <Suspense fallback={<Skeleton className="m-4 h-[calc(100%-2rem)]" />}>
          <Sparkline points={series.points} unit={series.unit} thresholds={series.thresholds} />
        </Suspense>
      );
    },
  },
  {
    key: 'dwell',
    title: 'Dwell time',
    description: 'How long people stay with an installation.',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    settings: sourceSettings,
    Component: ({ data, settings }) => {
      const series = seriesFor(data, settings, 'dwellSec');
      const last = series?.points.at(-1)?.v ?? 0;
      return <Stat label={series ? `Dwell · ${series.source}` : 'Dwell'} value={formatDuration(last)} sub="median this window" />;
    },
  },
  {
    key: 'interactions',
    title: 'Interactions',
    description: 'Cumulative triggers across interactive stations.',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    Component: ({ data }) => {
      const total = data.telemetry
        .filter((series) => series.metric === 'interactions')
        .reduce((sum, series) => sum + series.points.reduce((s, point) => s + point.v, 0), 0);
      return <Stat label="Interactions" value={compact(Math.round(total))} sub="all stations" />;
    },
  },
  {
    key: 'systems',
    title: 'Systems',
    description: 'Playback and feed health against their thresholds.',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    Component: ({ data }) => {
      const systems = data.telemetry.filter((series) => series.metric === 'uptime');
      if (systems.length === 0) return <Stat label="Systems" value="-" sub="No feeds reporting" />;
      return (
        <div className="space-y-2 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Systems</p>
          {systems.map((series) => {
            const last = series.points.at(-1)?.v ?? 0;
            const critical = series.thresholds?.critical ?? 0;
            const warn = series.thresholds?.warn ?? 0;
            const tone = last <= critical ? 'text-destructive' : last <= warn ? 'text-warning' : 'text-success';
            return (
              <div key={series.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">{series.source}</span>
                <span className={`font-mono ${tone}`} data-numeric>
                  {last.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      );
    },
  },
  {
    key: 'show-drift',
    title: 'Show timing',
    description: 'Where the show is against the plan.',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    Component: ({ data }) => {
      const current = data.cues.find((cue) => cue.id === data.callerCueId);
      if (!current) return <Stat label="Show timing" value="-" sub="Nobody is calling the show" />;
      const tone = data.drift > 120 ? 'critical' : data.drift > 30 ? 'warn' : 'good';
      return (
        <Stat
          label="Show timing"
          value={`${data.drift >= 0 ? '+' : '−'}${formatDuration(Math.abs(data.drift))}`}
          sub={`on: ${current.label}`}
          tone={tone}
        />
      );
    },
  },
  {
    key: 'next-cue',
    title: 'Next cue',
    description: 'What the room is about to do.',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    Component: ({ data }) => {
      const index = data.cues.findIndex((cue) => cue.id === data.callerCueId);
      const next = index >= 0 ? data.cues[index + 1] : data.cues[0];
      return <Stat label="Next cue" value={next ? next.label : 'End of show'} sub={next ? formatDuration(next.durationSec) : undefined} />;
    },
  },
  {
    key: 'guest-mix',
    title: 'Room composition',
    description: 'Who is actually in the room, by voice.',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    Component: ({ data }) => {
      const arrived = new Set(data.arrivals.filter((a) => !a.undone).map((a) => a.guestId));
      const counts = new Map<string, number>();
      for (const guest of data.guests) {
        if (!arrived.has(guest.id)) continue;
        const key = guest.voiceId ?? 'unassigned';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const total = rows.reduce((sum, [, count]) => sum + count, 0) || 1;
      return (
        <div className="space-y-2 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">In the room by voice</p>
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nobody has arrived yet.</p>}
          {rows.map(([voiceId, count]) => {
            const label = data.schema.voices.find((voice) => voice.id === voiceId)?.label ?? voiceId;
            return (
              <div key={voiceId} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="truncate text-muted-foreground">{label}</span>
                  <span data-numeric>{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(count / total) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    },
  },
  {
    key: 'metric-total',
    title: 'Media value',
    description: 'Running total of a metric across the room.',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    settings: (data) => [
      {
        id: 'metricId',
        label: 'Metric',
        kind: 'select',
        options: data.metrics.map((metric) => ({ value: metric.id, label: metric.label })),
      },
      {
        id: 'scope',
        label: 'Scope',
        kind: 'select',
        options: [
          { value: 'arrived', label: 'In the room' },
          { value: 'all', label: 'Whole guest list' },
        ],
      },
    ],
    Component: ({ data, settings }) => {
      const metric = data.metrics.find((m) => m.id === settings.metricId) ?? data.metrics[0];
      if (!metric) return <Stat label="Media value" value="-" sub="No metric configured" />;
      const arrived = new Set(data.arrivals.filter((a) => !a.undone).map((a) => a.guestId));
      const scope = settings.scope === 'all' ? data.guests : data.guests.filter((guest) => arrived.has(guest.id));
      const total = sumMetric(metric, scope);
      return (
        <Stat
          label={metric.label}
          value={
            metric.format.style === 'currency'
              ? formatCurrency(total, metric.format.currency, 0)
              : formatNumber(total, metric.format.decimals)
          }
          sub={`${settings.scope === 'all' ? 'whole list' : 'in the room'} · ${scope.length} guests`}
        />
      );
    },
  },
  {
    key: 'alerts',
    title: 'Alerts',
    description: 'Thresholds currently breached.',
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 3, h: 2 },
    Component: ({ data }) => {
      // A breach earlier in the show still matters after it clears: report the
      // worst point in the window and say when it happened.
      const alerts = data.telemetry.flatMap((series) => {
        if (!series.thresholds) return [];
        const { warn, critical } = series.thresholds;
        const rising = series.metric !== 'uptime';
        const worst = series.points.reduce<{ v: number; t: string } | null>((best, point) => {
          if (!best) return point;
          return (rising ? point.v > best.v : point.v < best.v) ? point : best;
        }, null);
        if (!worst) return [];

        const breach = rising
          ? critical !== undefined && worst.v >= critical
            ? 'critical'
            : warn !== undefined && worst.v >= warn
              ? 'warn'
              : null
          : critical !== undefined && worst.v <= critical
            ? 'critical'
            : warn !== undefined && worst.v <= warn
              ? 'warn'
              : null;
        if (!breach) return [];

        const isNow = series.points.at(-1)?.t === worst.t;
        return [{ series, worst, breach, isNow }];
      });

      return (
        <div className="space-y-2 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alerts</p>
          {alerts.length === 0 ? (
            <p className="text-sm text-success">Everything stayed within thresholds.</p>
          ) : (
            alerts.map(({ series, worst, breach, isNow }) => (
              <p key={series.id} className={`text-sm ${breach === 'critical' ? 'text-destructive' : 'text-warning'}`}>
                {series.source} · {series.metric} peaked at {worst.v.toFixed(1)} {series.unit}{' '}
                <span className="text-muted-foreground">
                  {isNow
                    ? 'now'
                    : new Date(worst.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              </p>
            ))
          )}
        </div>
      );
    },
  },
];

export function getWidget(key: string): WidgetDefinition | undefined {
  return WIDGETS.find((widget) => widget.key === key);
}
