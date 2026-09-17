import type { FieldDef, Guest, MetricConfig, SchemaConfig } from '@/data/types';
import { VocabDot } from '@/components/VocabDot';
import { GeneratedAvatar } from '@/components/ui/avatar';
import { FIELD_RENDERERS } from '@/modules/fields/registry';
import { scoreGuest } from '@/modules/metrics/engine';
import { compact, formatCurrency, formatNumber } from '@/lib/utils';

export interface GuestColumn {
  id: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Present on every column the user can hide; the name column is pinned. */
  hideable?: boolean;
  render: (guest: Guest, context: ColumnContext) => React.ReactNode;
}

export interface ColumnContext {
  schema: SchemaConfig;
  metrics: MetricConfig[];
  arrived: Set<string>;
}

const vocab = (list: SchemaConfig[keyof SchemaConfig], id?: string) =>
  (list as Array<{ id: string }>).find((entry) => entry.id === id) as never;

export function buildGuestColumns(metrics: MetricConfig[], fieldDefs: FieldDef[]): GuestColumn[] {
  const columns: GuestColumn[] = [
    {
      id: 'name',
      label: 'Name',
      width: 260,
      sortable: true,
      render: (guest) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <GeneratedAvatar name={guest.name} className="size-7" />
          <span className="min-w-0">
            <span className="block truncate font-medium" data-testid="guest-name">
              {guest.name}
            </span>
            {guest.handle && <span className="block truncate text-xs text-muted-foreground">{guest.handle}</span>}
          </span>
        </span>
      ),
    },
    {
      id: 'company',
      label: 'Company',
      width: 180,
      sortable: true,
      hideable: true,
      render: (guest) => <span className="truncate text-muted-foreground">{guest.company ?? '-'}</span>,
    },
    {
      id: 'voiceId',
      label: 'Voice',
      width: 140,
      sortable: true,
      hideable: true,
      render: (guest, ctx) => <VocabDot vocab={vocab(ctx.schema.voices, guest.voiceId)} />,
    },
    {
      id: 'tierId',
      label: 'Tier',
      width: 140,
      sortable: true,
      hideable: true,
      render: (guest, ctx) => <VocabDot vocab={vocab(ctx.schema.tiers, guest.tierId)} />,
    },
    {
      id: 'statusId',
      label: 'Status',
      width: 140,
      sortable: true,
      hideable: true,
      render: (guest, ctx) => <VocabDot vocab={vocab(ctx.schema.guestStatuses, guest.statusId)} />,
    },
    {
      id: 'plusOnes',
      label: '+1s',
      width: 70,
      align: 'right',
      sortable: true,
      hideable: true,
      render: (guest) => <span data-numeric>{guest.plusOnes || '-'}</span>,
    },
    {
      id: 'followers',
      label: 'Reach',
      width: 110,
      align: 'right',
      sortable: true,
      hideable: true,
      render: (guest) => (
        <span data-numeric>{guest.audience?.followers ? compact(guest.audience.followers) : '-'}</span>
      ),
    },
    {
      id: 'engagement',
      label: 'Eng.',
      width: 90,
      align: 'right',
      sortable: true,
      hideable: true,
      render: (guest) => (
        <span data-numeric>
          {guest.audience?.avgEngagementRate ? `${(guest.audience.avgEngagementRate * 100).toFixed(1)}%` : '-'}
        </span>
      ),
    },
  ];

  for (const metric of metrics) {
    columns.push({
      id: `metric:${metric.id}`,
      label: metric.label.length > 12 ? metric.id.toUpperCase() : metric.label,
      width: 120,
      align: 'right',
      sortable: true,
      hideable: true,
      render: (guest) => {
        const { value } = scoreGuest(metric, guest);
        return (
          <span data-numeric title={`${metric.label}: ${value.toFixed(metric.format.decimals)}`}>
            {metric.format.style === 'currency'
              ? formatCurrency(value, metric.format.currency, metric.format.decimals)
              : formatNumber(value, metric.format.decimals)}
          </span>
        );
      },
    });
  }

  for (const def of fieldDefs) {
    if (def.archived || !def.showIn.includes('table')) continue;
    const renderer = FIELD_RENDERERS[def.kind];
    columns.push({
      id: def.id,
      label: def.label,
      width: 150,
      align: renderer.align,
      sortable: true,
      hideable: true,
      render: (guest) => <renderer.Cell def={def} value={guest.fields[def.id] ?? null} />,
    });
  }

  return columns;
}
