import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import type { Arrival, Cue, TelemetrySeries } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/data/db';
import { useStore } from '@/store';
import { listArrivals } from '@/data/guests';
import { downloadFile, toCsv } from '@/data/io/csv';
import { deriveTimes, formatClock, formatDuration } from '@/lib/time';
import { scoreGuest, sumMetric } from '@/modules/metrics/engine';
import { useRundown } from '@/modules/rundown/useRundown';
import { compact, formatCurrency, formatNumber } from '@/lib/utils';
import { EventCoverArt } from '@/modules/workspace/EventCoverArt';

const RecapCharts = lazy(() => import('./RecapCharts'));

/**
 * The post-event report.
 *
 * Written as an editorial document rather than a dashboard dump: each section
 * carries one chart and one sentence of plain-language interpretation, so a
 * client can read it without a analyst sitting next to them.
 */
export function RecapPage() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const guests = useStore((s) => s.guests);
  const loadGuests = useStore((s) => s.loadGuests);
  const setActiveEvent = useStore((s) => s.setActiveEvent);

  const event = events.find((e) => e.id === eventId);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySeries[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { cues, meta } = useRundown(eventId);

  useEffect(() => {
    if (!eventId) return;
    setActiveEvent(eventId);
    setLoaded(false);
    // A report that renders before its data has arrived shows zeros, which in
    // a client-facing document is worse than showing nothing yet.
    void (async () => {
      const [, arrivalRows, telemetryRows] = await Promise.all([
        loadGuests(eventId),
        listArrivals(eventId),
        db.telemetry.where('eventId').equals(eventId).toArray(),
      ]);
      setArrivals(arrivalRows);
      setTelemetry(telemetryRows);
      setLoaded(true);
    })();
  }, [eventId, loadGuests, setActiveEvent]);

  const arrivedIds = useMemo(() => new Set(arrivals.map((arrival) => arrival.guestId)), [arrivals]);

  const funnel = useMemo(() => {
    const invited = guests.length;
    const confirmed = guests.filter(
      (guest) => guest.statusId !== 'invited' && guest.statusId !== 'declined',
    ).length;
    const arrived = arrivedIds.size;
    const partyTotal = arrivals.reduce((sum, arrival) => sum + arrival.partySize, 0);
    return { invited, confirmed, arrived, partyTotal };
  }, [guests, arrivedIds, arrivals]);

  const metricTotals = useMemo(() => {
    if (!workspace) return [];
    const inRoom = guests.filter((guest) => arrivedIds.has(guest.id));
    return workspace.metrics.map((metric) => ({
      metric,
      total: sumMetric(metric, inRoom),
      listTotal: sumMetric(metric, guests),
    }));
  }, [workspace, guests, arrivedIds]);

  const byVoice = useMemo(() => {
    if (!workspace) return [];
    const metric = workspace.metrics[0];
    const rows = new Map<string, { label: string; count: number; value: number }>();
    for (const guest of guests) {
      if (!arrivedIds.has(guest.id)) continue;
      const id = guest.voiceId ?? 'unassigned';
      const label = workspace.schema.voices.find((voice) => voice.id === id)?.label ?? 'Unassigned';
      const entry = rows.get(id) ?? { label, count: 0, value: 0 };
      entry.count += 1;
      if (metric) entry.value += scoreGuest(metric, guest).value;
      rows.set(id, entry);
    }
    return [...rows.values()].sort((a, b) => b.value - a.value);
  }, [workspace, guests, arrivedIds]);

  const topGuests = useMemo(() => {
    if (!workspace?.metrics[0]) return [];
    const metric = workspace.metrics[0];
    return guests
      .filter((guest) => arrivedIds.has(guest.id))
      .map((guest) => ({ guest, value: scoreGuest(metric, guest).value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [workspace, guests, arrivedIds]);

  const showPerformance = useMemo(() => {
    if (cues.length === 0) return null;
    const times = deriveTimes(meta.showStart, cues);
    const called = cues.filter((cue) => cue.actualStart);
    if (called.length < 2) return null;
    const deltas = called.map((cue) => {
      const index = cues.findIndex((candidate) => candidate.id === cue.id);
      return Math.round(
        (new Date(cue.actualStart!).getTime() - new Date(times[index].plannedStart).getTime()) / 1000,
      );
    });
    return {
      called: called.length,
      worst: deltas.reduce((max, delta) => (Math.abs(delta) > Math.abs(max) ? delta : max), 0),
      final: deltas.at(-1) ?? 0,
    };
  }, [cues, meta.showStart]);

  const arrivalCurve = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const arrival of arrivals) {
      const bucket = Math.floor(new Date(arrival.at).getTime() / 600_000);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, count]) => ({ t: new Date(bucket * 600_000).toISOString(), v: count }));
  }, [arrivals]);

  if (!event || !workspace) return null;
  const headlineMetric = metricTotals[0];

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-8" aria-busy="true">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
        <span className="sr-only">Building the report…</span>
      </div>
    );
  }

  function exportCsv() {
    const rows = guests
      .filter((guest) => arrivedIds.has(guest.id))
      .map((guest) => {
        const row: Record<string, string | number> = {
          Name: guest.name,
          Company: guest.company ?? '',
          Voice: workspace!.schema.voices.find((voice) => voice.id === guest.voiceId)?.label ?? '',
          Tier: workspace!.schema.tiers.find((tier) => tier.id === guest.tierId)?.label ?? '',
          Followers: guest.audience?.followers ?? '',
        };
        for (const metric of workspace!.metrics) {
          row[metric.label] = Math.round(scoreGuest(metric, guest).value);
        }
        return row;
      });
    downloadFile(`${event!.name.replace(/\W+/g, '-').toLowerCase()}-recap.csv`, toCsv(rows));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Post-event report</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{event.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border" data-testid="recap-headline">
        <EventCoverArt event={event} className="h-40 w-full" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Figure label="In the room" value={formatNumber(funnel.arrived)} note={`${funnel.partyTotal} including guests`} />
          <Figure
            label="Turnout"
            value={`${Math.round((funnel.arrived / Math.max(1, funnel.confirmed)) * 100)}%`}
            note={`of ${formatNumber(funnel.confirmed)} confirmed`}
          />
          {headlineMetric && (
            <Figure
              label={headlineMetric.metric.label}
              value={
                headlineMetric.metric.format.style === 'currency'
                  ? formatCurrency(headlineMetric.total, headlineMetric.metric.format.currency, 0)
                  : formatNumber(headlineMetric.total, 0)
              }
              note={`${Math.round((headlineMetric.total / Math.max(1, headlineMetric.listTotal)) * 100)}% of the invited list's potential`}
            />
          )}
        </div>
      </section>

      <Section
        title="Attendance"
        blurb={`${formatNumber(funnel.invited)} invited, ${formatNumber(funnel.confirmed)} confirmed, ${formatNumber(
          funnel.arrived,
        )} through the door — a ${Math.round((funnel.arrived / Math.max(1, funnel.invited)) * 100)}% conversion from invitation to attendance.`}
      >
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <RecapCharts
            kind="attendance"
            funnel={funnel}
            arrivalCurve={arrivalCurve}
            byVoice={byVoice}
            telemetry={telemetry}
          />
        </Suspense>
      </Section>

      {arrivalCurve.length > 1 && (
        <Section
          title="Arrival pattern"
          blurb="When the room actually filled, in ten-minute buckets. The shape tells you how to staff the door next time."
        >
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <RecapCharts kind="arrivals" funnel={funnel} arrivalCurve={arrivalCurve} byVoice={byVoice} telemetry={telemetry} />
          </Suspense>
        </Section>
      )}

      {byVoice.length > 0 && (
        <Section
          title="Room composition"
          blurb={`${byVoice[0].label} made up the largest share of value in the room${
            byVoice.length > 1 ? `, ahead of ${byVoice[1].label}` : ''
          }.`}
        >
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-2.5">Voice</th>
                  <th className="p-2.5 text-right">In the room</th>
                  <th className="p-2.5 text-right">{workspace.metrics[0]?.label ?? 'Value'}</th>
                </tr>
              </thead>
              <tbody>
                {byVoice.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-b-0">
                    <td className="p-2.5">{row.label}</td>
                    <td className="p-2.5 text-right" data-numeric>
                      {formatNumber(row.count)}
                    </td>
                    <td className="p-2.5 text-right" data-numeric>
                      {formatCurrency(row.value, workspace.metrics[0]?.format.currency, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {topGuests.length > 0 && (
        <Section
          title="Top contributors"
          blurb="The guests who carried the most value into the room, by the metric you configured."
        >
          <ol className="divide-y divide-border/60 overflow-hidden rounded-lg border">
            {topGuests.map(({ guest, value }, index) => (
              <li key={guest.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-5 text-muted-foreground" data-numeric>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{guest.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[guest.company, guest.audience?.followers ? `${compact(guest.audience.followers)} reach` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="font-mono" data-numeric>
                  {formatCurrency(value, workspace.metrics[0]?.format.currency, 0)}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {showPerformance && (
        <Section
          title="Show timing"
          blurb={`${showPerformance.called} cues were called live. The show ended ${
            showPerformance.final >= 0 ? 'behind' : 'ahead of'
          } plan by ${formatDuration(Math.abs(showPerformance.final))}, with a worst-case drift of ${formatDuration(
            Math.abs(showPerformance.worst),
          )}.`}
        >
          <CuePerformance cues={cues} showStart={meta.showStart} timezone={event.timezone} />
        </Section>
      )}

      {telemetry.length > 0 && (
        <Section
          title="Room telemetry"
          blurb="What the sensors saw: throughput, occupancy and dwell across the event window."
        >
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <RecapCharts kind="telemetry" funnel={funnel} arrivalCurve={arrivalCurve} byVoice={byVoice} telemetry={telemetry} />
          </Suspense>
        </Section>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        Generated {new Date().toLocaleString()} from data held in this browser. Metric weights are configurable in
        Studio; change one and every figure here follows.
      </p>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl" data-numeric>
        {value}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 break-inside-avoid">
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      {children}
    </section>
  );
}

function CuePerformance({ cues, showStart, timezone }: { cues: Cue[]; showStart: string; timezone: string }) {
  const times = deriveTimes(showStart, cues);
  const called = cues.map((cue, index) => ({ cue, planned: times[index] })).filter((row) => row.cue.actualStart);

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2.5">Cue</th>
            <th className="p-2.5 text-right">Planned</th>
            <th className="p-2.5 text-right">Actual</th>
            <th className="p-2.5 text-right">Delta</th>
          </tr>
        </thead>
        <tbody>
          {called.slice(0, 12).map(({ cue, planned }) => {
            const delta = Math.round(
              (new Date(cue.actualStart!).getTime() - new Date(planned.plannedStart).getTime()) / 1000,
            );
            return (
              <tr key={cue.id} className="border-b border-border/60 last:border-b-0">
                <td className="p-2.5">{cue.label}</td>
                <td className="p-2.5 text-right font-mono" data-numeric>
                  {formatClock(planned.plannedStart, timezone)}
                </td>
                <td className="p-2.5 text-right font-mono" data-numeric>
                  {formatClock(cue.actualStart!, timezone)}
                </td>
                <td
                  className={`p-2.5 text-right font-mono ${delta > 30 ? 'text-destructive' : delta < -30 ? 'text-success' : ''}`}
                  data-numeric
                >
                  {delta >= 0 ? '+' : '−'}
                  {formatDuration(Math.abs(delta))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
