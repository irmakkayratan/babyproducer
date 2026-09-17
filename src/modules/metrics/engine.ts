/**
 * Metric evaluation.
 *
 * A metric is data: a formula string, a list of variables saying where each
 * token comes from, and weight tables the user can edit. MIV and EMV are just
 * two such records, the engine has no special knowledge of either.
 */
import type { Guest, MetricConfig, MetricVariable, WeightTable } from '@/data/types';
import { evaluateFormula, FormulaError } from '@/lib/formula';
import { hashSeed } from '@/lib/rng';

export interface MetricResult {
  value: number;
  parts: Record<string, number>;
  error?: string;
}

function readPath(guest: Guest, path: string): number | undefined {
  const value = path
    .split('.')
    .reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), guest);
  return typeof value === 'number' ? value : undefined;
}

function weightFor(table: WeightTable, guest: Guest): number {
  const key =
    table.keyedBy === 'voiceId'
      ? guest.voiceId
      : table.keyedBy === 'tierId'
        ? guest.tierId
        : guest.audience?.platform;
  if (!key) return table.fallback;
  return table.entries[key] ?? table.fallback;
}

function resolveVariable(variable: MetricVariable, guest: Guest, metric: MetricConfig): number {
  const source = variable.source;
  switch (source.kind) {
    case 'constant':
      return source.value;
    case 'field':
      return readPath(guest, source.path) ?? variable.fallback ?? 0;
    case 'weight': {
      const table = metric.weightTables.find((t) => t.id === source.table);
      return table ? weightFor(table, guest) : (variable.fallback ?? 0);
    }
  }
}

/**
 * The metric half of the hash only changes when the user edits the metric, but
 * it was being re-serialised for every guest in the room. It is memoised
 * against the config object itself: the store is immer-backed, so editing a
 * weight produces a new `MetricConfig` and therefore a new key, while scoring
 * a table does not re-stringify the same definition thousands of times.
 */
const metricShapeCache = new WeakMap<MetricConfig, string>();

function metricShape(metric: MetricConfig): string {
  const cached = metricShapeCache.get(metric);
  if (cached !== undefined) return cached;
  const shape = String(hashSeed(JSON.stringify([metric.formula, metric.variables, metric.weightTables])));
  metricShapeCache.set(metric, shape);
  return shape;
}

/**
 * A score is cached against a hash of everything that produced it, so editing
 * one weight invalidates every affected guest without a migration pass. The
 * table recomputes lazily as rows scroll into view.
 */
export function metricInputHash(metric: MetricConfig, guest: Guest): string {
  return String(
    hashSeed(
      JSON.stringify([
        metricShape(metric),
        guest.voiceId,
        guest.tierId,
        guest.audience,
        guest.rev,
      ]),
    ),
  );
}

export function evaluateMetric(metric: MetricConfig, guest: Guest): MetricResult {
  const parts: Record<string, number> = {};
  for (const variable of metric.variables) {
    parts[variable.id] = resolveVariable(variable, guest, metric);
  }

  try {
    const value = evaluateFormula(metric.formula, parts);
    // A formula that divides by a missing weight can produce NaN; a visible
    // zero with an error beats a row that explodes.
    if (!Number.isFinite(value)) return { value: 0, parts, error: 'Formula produced no value' };
    return { value, parts };
  } catch (error) {
    return {
      value: 0,
      parts,
      error: error instanceof FormulaError ? error.message : 'Could not evaluate this metric',
    };
  }
}

export function scoreGuest(metric: MetricConfig, guest: Guest): { value: number; hash: string; parts: Record<string, number> } {
  const hash = metricInputHash(metric, guest);
  const cached = guest.scores?.[metric.id];
  if (cached && cached.hash === hash && cached.parts) {
    return { value: cached.value, hash, parts: cached.parts };
  }
  const result = evaluateMetric(metric, guest);
  return { value: result.value, hash, parts: result.parts };
}

export function sumMetric(metric: MetricConfig, guests: Guest[]): number {
  return guests.reduce((total, guest) => total + scoreGuest(metric, guest).value, 0);
}

/**
 * Radar breakdown: each variable normalised against the strongest guest in the
 * room, because the absolute magnitudes (reach in millions, quality in tenths)
 * are not comparable on one axis.
 */
export function breakdownFor(
  metric: MetricConfig,
  guest: Guest,
  peers: Guest[],
): Array<{ axis: string; label: string; value: number; raw: number }> {
  const parts = scoreGuest(metric, guest).parts;
  const maxima = new Map<string, number>();
  for (const id of metric.breakdown) maxima.set(id, 0);
  // One pass over the room covers every axis. The old axis loop re-scored
  // every peer from scratch for each of the four axes on the radar.
  for (const peer of peers) {
    const peerParts = scoreGuest(metric, peer).parts;
    for (const id of metric.breakdown) {
      const value = peerParts[id] ?? 0;
      if (value > (maxima.get(id) ?? 0)) maxima.set(id, value);
    }
  }

  return metric.breakdown.map((id) => {
    const variable = metric.variables.find((v) => v.id === id);
    const raw = parts[id] ?? 0;
    const max = maxima.get(id) ?? 0;
    return {
      axis: id,
      label: variable?.label ?? id,
      value: max > 0 ? Math.round((raw / max) * 100) : 0,
      raw,
    };
  });
}
