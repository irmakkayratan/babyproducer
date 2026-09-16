import { Trash2 } from 'lucide-react';
import type { DealBasis, DealKind, SettlementLine, SettlementParty, Vocab } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineNumber, InlineText } from '@/components/InlineInput';
import { ulid } from '@/lib/id';
import { cn } from '@/lib/utils';
import { LineTable } from './LineTable';
import { formatMoney, type PartyResult } from './math';

const DEAL_KINDS: Array<{ id: DealKind; label: string; hint: string }> = [
  { id: 'flat', label: 'Flat fee', hint: 'One number, whatever the room does.' },
  { id: 'percentage', label: 'Percentage', hint: 'A share of the basis, with no floor under it.' },
  { id: 'versus', label: 'Guarantee vs percentage', hint: 'Whichever of the two is greater — never both.' },
  { id: 'plus-bonus', label: 'Guarantee plus bonus', hint: 'The fee, plus a share of everything over a figure.' },
];

const BASES: Array<{ id: DealBasis; label: string }> = [
  { id: 'gross', label: 'Gross receipts' },
  { id: 'adjusted', label: 'Adjusted gross' },
  { id: 'net', label: 'Net after costs' },
];

/**
 * One party's deal, and what it came to.
 *
 * The result sits next to the terms on purpose: the argument at the settlement
 * table is always about which side of a "versus" won, and showing both numbers
 * ends it in one glance.
 */
export function DealEditor({
  result,
  roles,
  currency,
  readOnly,
  onPatch,
  onRemove,
}: {
  result: PartyResult;
  roles: Vocab[];
  currency: string;
  readOnly?: boolean;
  onPatch: (patch: Partial<Omit<SettlementParty, 'id'>>) => void;
  onRemove: () => void;
}) {
  const party = result.party;
  const deal = party.deal;
  const money = (value: number) => formatMoney(value, currency, 0);
  const patchDeal = (patch: Partial<typeof deal>) => onPatch({ deal: { ...deal, ...patch } });

  return (
    <Card className="overflow-hidden" data-testid="settlement-party">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <InlineText
          label="Party name"
          value={party.name}
          placeholder="Who is being paid…"
          disabled={readOnly}
          onCommit={(name) => onPatch({ name })}
          className="min-w-40 flex-1 font-display text-lg"
        />
        <select
          aria-label={`Role for ${party.name || 'party'}`}
          value={party.roleId ?? ''}
          disabled={readOnly}
          onChange={(e) => onPatch({ roleId: e.target.value || undefined })}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">—</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
        {!readOnly && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${party.name || 'party'}`}
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Deal</span>
              <select
                aria-label={`Deal type for ${party.name || 'party'}`}
                value={deal.kind}
                disabled={readOnly}
                onChange={(e) => patchDeal({ kind: e.target.value as DealKind })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {DEAL_KINDS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted-foreground">
                {DEAL_KINDS.find((kind) => kind.id === deal.kind)?.hint}
              </span>
            </label>

            <label className={cn('space-y-1', deal.kind === 'flat' && 'opacity-50')}>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Applies to</span>
              <select
                aria-label={`Percentage basis for ${party.name || 'party'}`}
                value={deal.basis}
                disabled={readOnly || deal.kind === 'flat'}
                onChange={(e) => patchDeal({ basis: e.target.value as DealBasis })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {BASES.map((basis) => (
                  <option key={basis.id} value={basis.id}>
                    {basis.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted-foreground">{money(result.basisValue)} tonight</span>
            </label>

            {deal.kind !== 'percentage' && (
              <Field label="Guarantee">
                <InlineNumber
                  label={`Guarantee for ${party.name || 'party'}`}
                  value={deal.guarantee}
                  disabled={readOnly}
                  onCommit={(guarantee) => patchDeal({ guarantee })}
                  className="h-9 border-input"
                />
              </Field>
            )}

            {deal.kind !== 'flat' && (
              <Field label="Percentage">
                <InlineNumber
                  label={`Percentage for ${party.name || 'party'}`}
                  value={deal.percentage}
                  disabled={readOnly}
                  onCommit={(percentage) => patchDeal({ percentage })}
                  className="h-9 border-input"
                />
              </Field>
            )}

            {deal.kind === 'plus-bonus' && (
              <Field label="Bonus applies above">
                <InlineNumber
                  label={`Breakeven for ${party.name || 'party'}`}
                  value={deal.breakeven}
                  disabled={readOnly}
                  onCommit={(breakeven) => patchDeal({ breakeven })}
                  className="h-9 border-input"
                />
              </Field>
            )}

            <Field label="Deposit already paid">
              <InlineNumber
                label={`Deposit for ${party.name || 'party'}`}
                value={party.deposit}
                disabled={readOnly}
                onCommit={(deposit) => onPatch({ deposit })}
                className="h-9 border-input"
              />
            </Field>

            <Field label="Withholding %">
              <InlineNumber
                label={`Withholding for ${party.name || 'party'}`}
                value={party.withholdingPercent}
                disabled={readOnly}
                onCommit={(withholdingPercent) => onPatch({ withholdingPercent })}
                className="h-9 border-input"
              />
            </Field>
          </div>

          <LineTable
            title="Adjustments"
            description="Buyouts, recharges and extras. A negative amount comes off the payout."
            lines={party.adjustments}
            resolved={new Map(result.adjustments.map((row) => [row.line.id, row.amount]))}
            total={result.adjustmentTotal}
            currency={currency}
            readOnly={readOnly}
            onAdd={() =>
              onPatch({
                adjustments: [...party.adjustments, { id: ulid(), label: '', basis: 'fixed', amount: 0 }],
              })
            }
            onPatch={(lineId, patch) =>
              onPatch({
                adjustments: party.adjustments.map((line) =>
                  line.id === lineId ? ({ ...line, ...patch } as SettlementLine) : line,
                ),
              })
            }
            onRemove={(lineId) =>
              onPatch({ adjustments: party.adjustments.filter((line) => line.id !== lineId) })
            }
          />
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/20 p-4" data-testid="settlement-payout">
          <p className="text-xs leading-relaxed text-muted-foreground">{result.terms}</p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Fee earned" value={money(result.earned)} />
            {result.adjustmentTotal !== 0 && <Row label="Adjustments" value={money(result.adjustmentTotal)} />}
            {result.withholding > 0 && <Row label="Withholding" value={`− ${money(result.withholding)}`} />}
            {result.deposit > 0 && <Row label="Deposit paid" value={`− ${money(result.deposit)}`} />}
            <div className="mt-2 flex items-baseline justify-between border-t pt-2">
              <dt className="text-sm font-medium">Balance due</dt>
              <dd className="font-mono text-xl tabular" data-numeric data-testid="settlement-balance">
                {money(result.balanceDue)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular" data-numeric>
        {value}
      </dd>
    </div>
  );
}
