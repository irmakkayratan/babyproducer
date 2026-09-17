import { Plus, ScanLine, Trash2 } from 'lucide-react';
import type { TicketTier } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineNumber, InlineText } from '@/components/InlineInput';
import { ulid } from '@/lib/id';
import { formatNumber } from '@/lib/utils';
import { formatMoney, type TierResult } from './math';

/**
 * The box office, priced band by band.
 *
 * Comps get their own column. Folding them into sold would be wrong twice
 * over: they are bodies in the room for the per-head costs, and nothing at
 * all for the gross,
 * and conflating the two is the classic way a settlement ends up wrong.
 */
export function ScalingTable({
  tiers,
  currency,
  readOnly,
  countedAttendance,
  onChange,
}: {
  tiers: TierResult[];
  currency: string;
  readOnly?: boolean;
  /** What the door actually counted, offered as a one-click fill. */
  countedAttendance: number;
  onChange: (scaling: TicketTier[]) => void;
}) {
  const rows = tiers.map((row) => row.tier);

  const patch = (id: string, value: Partial<TicketTier>) =>
    onChange(rows.map((tier) => (tier.id === id ? { ...tier, ...value } : tier)));

  const totals = tiers.reduce(
    (acc, row) => ({
      allotment: acc.allotment + (row.tier.allotment || 0),
      sold: acc.sold + (row.tier.sold || 0),
      comps: acc.comps + (row.tier.comps || 0),
      gross: acc.gross + row.gross,
    }),
    { allotment: 0, sold: 0, comps: 0, gross: 0 },
  );

  return (
    <Card className="overflow-hidden" data-testid="settlement-scaling">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div>
          <h3 className="font-medium">Box office</h3>
          <p className="text-xs text-muted-foreground">
            What each price band sold. Comps fill a seat and earn nothing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && countedAttendance > 0 && rows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              title="Fill the first band from the check-in desk's count"
              onClick={() =>
                onChange(
                  rows.map((tier, index) =>
                    index === 0
                      ? { ...tier, sold: Math.max(0, countedAttendance - totals.comps - (totals.sold - (rows[0].sold || 0))) }
                      : tier,
                  ),
                )
              }
            >
              <ScanLine className="size-4" /> Pull {formatNumber(countedAttendance)} from check-in
            </Button>
          )}
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onChange([...rows, { id: ulid(), label: 'New band', price: 0, allotment: 0, sold: 0, comps: 0 }])
              }
            >
              <Plus className="size-4" /> Add band
            </Button>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No price bands yet. Add one for each price the show sold at.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5">Band</th>
              <th className="w-28 px-3 py-1.5 text-right">Price</th>
              <th className="w-28 px-3 py-1.5 text-right">Allotment</th>
              <th className="w-24 px-3 py-1.5 text-right">Sold</th>
              <th className="w-24 px-3 py-1.5 text-right">Comps</th>
              <th className="w-24 px-3 py-1.5 text-right">Sell-through</th>
              <th className="w-32 px-3 py-1.5 text-right">Gross</th>
              {!readOnly && <th className="w-10 px-3 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {tiers.map((row) => (
              <tr key={row.tier.id} className="border-b border-border/60" data-testid="settlement-tier">
                <td className="px-1.5 py-1">
                  <InlineText
                    label="Price band name"
                    value={row.tier.label}
                    disabled={readOnly}
                    onCommit={(label) => patch(row.tier.id, { label })}
                  />
                </td>
                <td className="px-1.5 py-1">
                  <InlineNumber
                    label={`Price for ${row.tier.label}`}
                    value={row.tier.price}
                    disabled={readOnly}
                    onCommit={(price) => patch(row.tier.id, { price })}
                  />
                </td>
                <td className="px-1.5 py-1">
                  <InlineNumber
                    label={`Allotment for ${row.tier.label}`}
                    value={row.tier.allotment}
                    disabled={readOnly}
                    onCommit={(allotment) => patch(row.tier.id, { allotment })}
                  />
                </td>
                <td className="px-1.5 py-1">
                  <InlineNumber
                    label={`Sold for ${row.tier.label}`}
                    value={row.tier.sold}
                    disabled={readOnly}
                    onCommit={(sold) => patch(row.tier.id, { sold })}
                  />
                </td>
                <td className="px-1.5 py-1">
                  <InlineNumber
                    label={`Comps for ${row.tier.label}`}
                    value={row.tier.comps}
                    disabled={readOnly}
                    onCommit={(comps) => patch(row.tier.id, { comps })}
                  />
                </td>
                <td className="px-3 py-1 text-right font-mono text-xs tabular text-muted-foreground" data-numeric>
                  {row.tier.allotment > 0 ? `${Math.round(row.sellThrough * 100)}%` : '-'}
                </td>
                <td className="px-3 py-1 text-right font-mono tabular" data-numeric>
                  {formatMoney(row.gross, currency, 0)}
                </td>
                {!readOnly && (
                  <td className="px-1.5 py-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${row.tier.label}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => onChange(rows.filter((tier) => tier.id !== row.tier.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            <tr className="bg-muted/20 text-xs font-medium">
              <td className="px-3 py-2">Total</td>
              <td />
              <td className="px-3 py-2 text-right font-mono tabular" data-numeric>
                {formatNumber(totals.allotment)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular" data-numeric>
                {formatNumber(totals.sold)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular" data-numeric>
                {formatNumber(totals.comps)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular" data-numeric>
                {totals.allotment > 0 ? `${Math.round((totals.sold / totals.allotment) * 100)}%` : '-'}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular" data-numeric>
                {formatMoney(totals.gross, currency, 0)}
              </td>
              {!readOnly && <td />}
            </tr>
          </tbody>
        </table>
      )}
    </Card>
  );
}
