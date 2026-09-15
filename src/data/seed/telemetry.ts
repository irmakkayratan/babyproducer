/**
 * Simulated experiential telemetry.
 *
 * Real activations instrument the room — RFID gates, depth cameras, LED
 * playback health. This generates feeds with the shape those produce: a
 * smoothed random walk with day-part seasonality, plus scripted anomalies so
 * the alerting path has something honest to show.
 */
import type { TelemetrySeries } from '@/data/types';
import { createRng, type Rng } from '@/lib/rng';
import { ulid } from '@/lib/id';

export interface TelemetrySourceSpec {
  source: string;
  metric: string;
  unit: string;
  base: number;
  variance: number;
  /** Multiplies the value by hour of day, 0–23, to create a day shape. */
  dayShape?: number[];
  thresholds?: { warn?: number; critical?: number };
  anomaly?: { atFraction: number; multiplier: number; durationPoints: number };
}

const DOORS_SHAPE = [
  0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.15, 0.3, 0.5, 0.7, 0.9, 1, 1, 0.95, 0.9, 0.95, 1, 1, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1,
];

export const ACTIVATION_SOURCES: TelemetrySourceSpec[] = [
  {
    source: 'Entrance gate',
    metric: 'throughput',
    unit: 'people/min',
    base: 14,
    variance: 0.35,
    dayShape: DOORS_SHAPE,
    thresholds: { warn: 22, critical: 28 },
  },
  {
    source: 'Atrium',
    metric: 'occupancy',
    unit: 'people',
    base: 180,
    variance: 0.25,
    dayShape: DOORS_SHAPE,
    thresholds: { warn: 320, critical: 400 },
    anomaly: { atFraction: 0.62, multiplier: 2.1, durationPoints: 14 },
  },
  {
    source: 'LED volume',
    metric: 'dwellSec',
    unit: 'seconds',
    base: 96,
    variance: 0.3,
    dayShape: DOORS_SHAPE,
  },
  {
    source: 'RFID station 1',
    metric: 'interactions',
    unit: 'taps',
    base: 34,
    variance: 0.45,
    dayShape: DOORS_SHAPE,
  },
  {
    source: 'RFID station 2',
    metric: 'interactions',
    unit: 'taps',
    base: 22,
    variance: 0.5,
    dayShape: DOORS_SHAPE,
  },
  {
    source: 'Media server A',
    metric: 'uptime',
    unit: '%',
    base: 99.7,
    variance: 0.004,
    thresholds: { warn: 99, critical: 97 },
    anomaly: { atFraction: 0.62, multiplier: 0.965, durationPoints: 8 },
  },
];

export const SHOW_SOURCES: TelemetrySourceSpec[] = [
  {
    source: 'Front of house',
    metric: 'throughput',
    unit: 'people/min',
    base: 9,
    variance: 0.4,
    thresholds: { warn: 16, critical: 22 },
  },
  { source: 'House', metric: 'occupancy', unit: 'seats filled', base: 260, variance: 0.2 },
  { source: 'Backstage', metric: 'dwellSec', unit: 'seconds', base: 210, variance: 0.25 },
  {
    source: 'Broadcast feed',
    metric: 'uptime',
    unit: '%',
    base: 99.9,
    variance: 0.002,
    thresholds: { warn: 99.5, critical: 98 },
  },
];

function smoothedWalk(spec: TelemetrySourceSpec, points: number, start: Date, stepMs: number, rng: Rng) {
  const values: Array<{ t: string; v: number }> = [];
  let drift = 0;

  for (let i = 0; i < points; i++) {
    const at = new Date(start.getTime() + i * stepMs);
    const hourFactor = spec.dayShape ? spec.dayShape[at.getHours()] : 1;
    drift = drift * 0.82 + rng.normal(0, spec.variance) * 0.18;

    let value = spec.base * hourFactor * (1 + drift);

    if (spec.anomaly) {
      const anomalyStart = Math.floor(points * spec.anomaly.atFraction);
      if (i >= anomalyStart && i < anomalyStart + spec.anomaly.durationPoints) {
        value *= spec.anomaly.multiplier;
      }
    }

    values.push({ t: at.toISOString(), v: Number(Math.max(0, value).toFixed(2)) });
  }
  return values;
}

export function generateTelemetry(
  eventId: string,
  specs: TelemetrySourceSpec[],
  options: { start: Date; end: Date; stepMinutes?: number; seed: string },
): TelemetrySeries[] {
  const rng = createRng(`${options.seed}-telemetry`);
  const stepMs = (options.stepMinutes ?? 5) * 60_000;
  const points = Math.max(12, Math.min(600, Math.round((options.end.getTime() - options.start.getTime()) / stepMs)));

  return specs.map((spec) => ({
    id: ulid(Date.now(), rng.next),
    eventId,
    source: spec.source,
    metric: spec.metric,
    unit: spec.unit,
    thresholds: spec.thresholds,
    points: smoothedWalk(spec, points, options.start, stepMs, rng),
  }));
}
