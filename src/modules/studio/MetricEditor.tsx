import { useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { Guest, MetricConfig, SchemaConfig } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { validateFormula, FUNCTION_NAMES } from '@/lib/formula';
import { evaluateMetric } from '@/modules/metrics/engine';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { ulid } from '@/lib/id';

/**
 * Metric editor.
 *
 * The research is pointed about EMV's weakness being opaque multipliers, so
 * every weight is visible and editable here, the formula is user-authored, and
 * a live preview against a real guest shows what a change actually does.
 */
export function MetricEditor({
  metrics,
  schema,
  sampleGuest,
  onChange,
}: {
  metrics: MetricConfig[];
  schema: SchemaConfig;
  sampleGuest?: Guest;
  onChange: (metrics: MetricConfig[]) => void;
}) {
  const [activeId, setActiveId] = useState(metrics[0]?.id ?? '');
  const metric = metrics.find((candidate) => candidate.id === activeId) ?? metrics[0];

  const validation = useMemo(
    () => (metric ? validateFormula(metric.formula, metric.variables.map((variable) => variable.id)) : null),
    [metric],
  );

  const preview = useMemo(
    () => (metric && sampleGuest ? evaluateMetric(metric, sampleGuest) : null),
    [metric, sampleGuest],
  );

  if (!metric) {
    return (
      <section className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          No metrics configured. Add one to score guests by whatever matters to your events.
        </p>
        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            onChange([
              {
                id: `metric-${ulid().slice(-6).toLowerCase()}`,
                label: 'New metric',
                formula: 'reach * rate',
                variables: [
                  { id: 'reach', label: 'Reach', source: { kind: 'field', path: 'audience.followers' }, fallback: 0 },
                  { id: 'rate', label: 'Rate', source: { kind: 'constant', value: 0.02 } },
                ],
                weightTables: [],
                format: { style: 'number', decimals: 0 },
                breakdown: ['reach', 'rate'],
              },
            ])
          }
        >
          <Plus className="size-4" /> Add a metric
        </Button>
      </section>
    );
  }

  function update(patch: Partial<MetricConfig>) {
    onChange(metrics.map((candidate) => (candidate.id === metric!.id ? { ...candidate, ...patch } : candidate)));
  }

  function updateWeight(tableId: string, key: string, value: number) {
    update({
      weightTables: metric!.weightTables.map((table) =>
        table.id === tableId ? { ...table, entries: { ...table.entries, [key]: value } } : table,
      ),
    });
  }

  function keysFor(keyedBy: string) {
    if (keyedBy === 'voiceId') return schema.voices;
    if (keyedBy === 'tierId') return schema.tiers;
    return schema.platforms;
  }

  return (
    <section className="rounded-lg border">
      <header className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="mr-auto">
          <h3 className="font-medium">Metrics</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Formulas and weights are data, not code. Change one and every score, chart and report follows.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {metrics.map((candidate) => (
            <Button
              key={candidate.id}
              size="sm"
              variant={candidate.id === metric.id ? 'default' : 'outline'}
              onClick={() => setActiveId(candidate.id)}
            >
              {candidate.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="metric-label">Name</Label>
            <Input id="metric-label" value={metric.label} onChange={(e) => update({ label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metric-formula">Formula</Label>
            <Input
              id="metric-formula"
              value={metric.formula}
              spellCheck={false}
              className={`font-mono ${validation ? 'ring-1 ring-destructive' : ''}`}
              onChange={(e) => update({ formula: e.target.value })}
            />
          </div>
        </div>

        {validation ? (
          <p className="flex items-center gap-2 text-sm text-destructive" data-testid="formula-error">
            <AlertCircle className="size-4" />
            {validation.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Available: {metric.variables.map((variable) => variable.id).join(', ')} · functions:{' '}
            {FUNCTION_NAMES.join(', ')}
          </p>
        )}

        {sampleGuest && preview && (
          <div className="rounded-md border border-dashed p-3" data-testid="metric-preview">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Preview · {sampleGuest.name} ·{' '}
              <span data-testid="preview-voice">
                {schema.voices.find((voice) => voice.id === sampleGuest.voiceId)?.label ?? 'no voice'}
              </span>{' '}
              ·{' '}
              <span data-testid="preview-tier">
                {schema.tiers.find((tier) => tier.id === sampleGuest.tierId)?.label ?? 'no tier'}
              </span>
            </p>
            <p className="mt-1 font-mono text-xl" data-numeric>
              {metric.format.style === 'currency'
                ? formatCurrency(preview.value, metric.format.currency, metric.format.decimals)
                : formatNumber(preview.value, metric.format.decimals)}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(preview.parts).map(([id, value]) => (
                <span key={id}>
                  {id} <span data-numeric>{Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                </span>
              ))}
            </div>
            {preview.error && <p className="mt-2 text-xs text-destructive">{preview.error}</p>}
          </div>
        )}

        {metric.weightTables.map((table) => (
          <div key={table.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">{table.label}</h4>
              <Badge variant="muted">fallback {table.fallback}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {keysFor(table.keyedBy)
                .filter((entry) => !entry.archived)
                .map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2">
                    <Label htmlFor={`${table.id}-${entry.id}`} className="flex-1 truncate text-xs text-muted-foreground">
                      {entry.label}
                    </Label>
                    <Input
                      id={`${table.id}-${entry.id}`}
                      type="number"
                      step="0.001"
                      value={table.entries[entry.id] ?? table.fallback}
                      onChange={(e) => updateWeight(table.id, entry.id, Number(e.target.value))}
                      className="h-8 w-24 text-right font-mono"
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2 border-t pt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const copy: MetricConfig = {
                ...metric,
                id: `${metric.id}-copy-${ulid().slice(-4).toLowerCase()}`,
                label: `${metric.label} (copy)`,
                builtinPreset: undefined,
              };
              onChange([...metrics, copy]);
              setActiveId(copy.id);
            }}
          >
            <Plus className="size-4" /> Duplicate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              onChange(metrics.filter((candidate) => candidate.id !== metric.id));
              setActiveId(metrics.find((candidate) => candidate.id !== metric.id)?.id ?? '');
            }}
          >
            <Trash2 className="size-4" /> Delete metric
          </Button>
        </div>
      </div>
    </section>
  );
}
