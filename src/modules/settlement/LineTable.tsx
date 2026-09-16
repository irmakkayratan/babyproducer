import { Plus, Trash2 } from 'lucide-react';
import type { LineBasis, SettlementLine, Vocab } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineNumber, InlineText } from '@/components/InlineInput';
import { formatMoney } from './math';

const BASIS_OPTIONS: Array<{ id: LineBasis; label: string }> = [
  { id: 'fixed', label: 'Amount' },
  { id: 'percent-gross', label: '% of box office' },
  { id: 'percent-adjusted', label: '% of balance' },
  { id: 'per-ticket', label: 'Per ticket' },
  { id: 'per-head', label: 'Per head' },
];

export interface LineTableProps {
  title: string;
  description: string;
  lines: SettlementLine[];
  /** The resolved money for each line id, from the engine. */
  resolved: Map<string, number>;
  total: number;
  currency: string;
  categories?: Vocab[];
  readOnly?: boolean;
  onAdd: () => void;
  onPatch: (lineId: string, patch: Partial<Omit<SettlementLine, 'id'>>) => void;
  onRemove: (lineId: string) => void;
  testId?: string;
}

/**
 * One editable block of the statement.
 *
 * Every line states its own basis: a flat amount, a percentage, or a rate per
 * ticket or per head. That is how they are written into a contract, and a
 * settlement argued at 1am is won by the side whose numbers can be worked out
 * again in front of the other.
 */
export function LineTable({
  title,
  description,
  lines,
  resolved,
  total,
  currency,
  categories,
  readOnly,
  onAdd,
  onPatch,
  onRemove,
  testId,
}: LineTableProps) {
  return (
    <Card className="overflow-hidden" data-testid={testId}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm tabular" data-numeric>
            {formatMoney(total, currency, 0)}
          </span>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={onAdd}>
              <Plus className="size-4" /> Add
            </Button>
          )}
        </div>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5">Line</th>
              {categories && <th className="w-36 px-3 py-1.5">Category</th>}
              <th className="w-36 px-3 py-1.5">Basis</th>
              <th className="w-28 px-3 py-1.5 text-right">Rate</th>
              <th className="w-32 px-3 py-1.5 text-right">Amount</th>
              {!readOnly && <th className="w-10 px-3 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-border/60 last:border-b-0" data-testid="settlement-line">
                <td className="px-1.5 py-1">
                  <InlineText
                    label={`${title} line name`}
                    value={line.label}
                    placeholder="Describe the line…"
                    disabled={readOnly}
                    onCommit={(label) => onPatch(line.id, { label })}
                  />
                </td>
                {categories && (
                  <td className="px-1.5 py-1">
                    <select
                      aria-label={`Category for ${line.label || 'line'}`}
                      value={line.categoryId ?? ''}
                      disabled={readOnly}
                      onChange={(e) => onPatch(line.id, { categoryId: e.target.value || undefined })}
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-input"
                    >
                      <option value="">-</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-1.5 py-1">
                  <select
                    aria-label={`Basis for ${line.label || 'line'}`}
                    value={line.basis}
                    disabled={readOnly}
                    onChange={(e) => onPatch(line.id, { basis: e.target.value as LineBasis })}
                    className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-input"
                  >
                    {BASIS_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1.5 py-1">
                  <InlineNumber
                    label={`Rate for ${line.label || 'line'}`}
                    value={line.amount}
                    disabled={readOnly}
                    onCommit={(amount) => onPatch(line.id, { amount })}
                  />
                </td>
                <td className="px-3 py-1 text-right font-mono tabular" data-numeric>
                  {formatMoney(resolved.get(line.id) ?? 0, currency, 0)}
                </td>
                {!readOnly && (
                  <td className="px-1.5 py-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${line.label || 'line'}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => onRemove(line.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
