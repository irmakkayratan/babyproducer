import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Lock, LockOpen, Plus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  addLine,
  addParty,
  patchLine,
  patchParty,
  removeLine,
  removeParty,
  updateScaling,
  updateSettlement,
  type LineGroup,
} from '@/data/settlement';
import { downloadFile, toCsv } from '@/data/io/csv';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { useArrivalCount } from '@/modules/advancing/useAdvanceSheet';
import { DealEditor } from './DealEditor';
import { LineTable } from './LineTable';
import { ScalingTable } from './ScalingTable';
import { SettlementStatement } from './SettlementStatement';
import { computeSettlement, formatMoney, toSettlementRows } from './math';
import { useSettlement } from './useSettlement';

/**
 * Settlement: the money side of the same event.
 *
 * Inputs on one tab, the statement on the other, and the four figures that
 * actually matter pinned above both, because the question in the room is
 * never "what did the bar take", it is "what do I owe you, and did we make
 * anything".
 */
export function SettlementPage() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const setActiveEvent = useStore((s) => s.setActiveEvent);

  const event = events.find((candidate) => candidate.id === eventId);
  const workspace = workspaces.find((candidate) => candidate.id === event?.workspaceId);
  const { sheet, loading } = useSettlement(event);
  const counted = useArrivalCount(eventId);

  useEffect(() => {
    if (eventId) setActiveEvent(eventId);
  }, [eventId, setActiveEvent]);

  const result = useMemo(() => (sheet ? computeSettlement(sheet) : null), [sheet]);

  if (!event || !workspace) return null;

  if (loading || !sheet || !result) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-8" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
        <span className="sr-only">Loading the settlement…</span>
      </div>
    );
  }

  const locked = Boolean(sheet.finalizedAt);
  const categories = workspace.schema.expenseCategories ?? [];
  const money = (value: number) => formatMoney(value, result.currency, 0);
  const resolvedFor = (group: LineGroup) =>
    new Map(
      (group === 'expenses' ? result.expenses : group === 'deductions' ? result.deductions : result.otherRevenue).map(
        (row) => [row.line.id, row.amount],
      ),
    );

  function exportCsv() {
    downloadFile(
      `${event!.name.replace(/\W+/g, '-').toLowerCase()}-settlement.csv`,
      toCsv(
        toSettlementRows(result!, {
          event: event!.name,
          categoryLabel: (id) => categories.find((entry) => entry.id === id)?.label ?? id,
        }),
      ),
    );
  }

  function toggleFinal() {
    const finalizing = !locked;
    void updateSettlement(event!.id, { finalizedAt: finalizing ? new Date().toISOString() : undefined });
    toast.success(finalizing ? 'Settlement finalized' : 'Settlement reopened', {
      description: finalizing
        ? 'The sheet is read-only until you reopen it. Print or export it as the record.'
        : 'Edits are live again. The statement follows every change.',
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Settlement</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{event.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            What the show took, what it cost, and who is owed what once the deal is applied. Every figure below
            is worked out live, so change an input and the statement follows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={toggleFinal}>
            {locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            {locked ? 'Reopen' : 'Finalize'}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Headline label="Gross receipts" value={money(result.gross)} note={`${result.attendance.sold} tickets`} />
        <Headline
          label="Net after costs"
          value={money(result.net)}
          note={`${money(result.deductionTotal)} off the top · ${money(result.expenseTotal)} of costs`}
        />
        <Headline
          label="Balance due"
          value={money(result.balanceDue)}
          note={`${money(result.talentCost)} total to parties`}
          accent
        />
        <Headline
          label="House result"
          value={money(result.houseResult)}
          note={result.houseResult >= 0 ? 'after everything' : 'the show lost money'}
          tone={result.houseResult >= 0 ? 'success' : 'destructive'}
        />
      </div>

      {locked && (
        <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning print:hidden">
          This settlement is finalized and read-only. Reopen it to make a change.
        </p>
      )}

      <Tabs defaultValue="inputs" className="mt-8 print:hidden">
        <TabsList>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="mt-5 space-y-5">
          <ScalingTable
            tiers={result.tiers}
            currency={result.currency}
            readOnly={locked}
            countedAttendance={counted}
            onChange={(scaling) => void updateScaling(event.id, scaling)}
          />

          <LineTable
            title="Other income"
            description="Bar share, merchandise, sponsorship. Anything that lands in the same pot."
            lines={sheet.otherRevenue}
            resolved={resolvedFor('otherRevenue')}
            total={result.otherRevenueTotal}
            currency={result.currency}
            readOnly={locked}
            onAdd={() => void addLine(event.id, 'otherRevenue')}
            onPatch={(lineId, patch) => void patchLine(event.id, 'otherRevenue', lineId, patch)}
            onRemove={(lineId) => void removeLine(event.id, 'otherRevenue', lineId)}
          />

          <LineTable
            title="Off the top"
            description="Tax, ticketing and rights, in the order they come off. Each percentage reads the balance the one above it left."
            lines={sheet.deductions}
            resolved={resolvedFor('deductions')}
            total={result.deductionTotal}
            currency={result.currency}
            categories={categories}
            readOnly={locked}
            testId="settlement-deductions"
            onAdd={() => void addLine(event.id, 'deductions')}
            onPatch={(lineId, patch) => void patchLine(event.id, 'deductions', lineId, patch)}
            onRemove={(lineId) => void removeLine(event.id, 'deductions', lineId)}
          />

          <LineTable
            title="Show costs"
            description="What it cost to open the doors. These come off before any percentage deal is applied."
            lines={sheet.expenses}
            resolved={resolvedFor('expenses')}
            total={result.expenseTotal}
            currency={result.currency}
            categories={categories}
            readOnly={locked}
            testId="settlement-expenses"
            onAdd={() => void addLine(event.id, 'expenses')}
            onPatch={(lineId, patch) => void patchLine(event.id, 'expenses', lineId, patch)}
            onRemove={(lineId) => void removeLine(event.id, 'expenses', lineId)}
          />

          <section className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl tracking-tight">Deals and payouts</h2>
                <p className="text-sm text-muted-foreground">
                  One block per party being settled with. The terms and the result sit side by side.
                </p>
              </div>
              {!locked && (
                <Button size="sm" variant="outline" onClick={() => void addParty(event.id)}>
                  <Plus className="size-4" /> Add party
                </Button>
              )}
            </header>

            {result.parties.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                Nobody is being settled with yet. Add the party whose deal this show is under.
              </Card>
            ) : (
              result.parties.map((party) => (
                <DealEditor
                  key={party.party.id}
                  result={party}
                  roles={workspace.schema.partyRoles ?? []}
                  currency={result.currency}
                  readOnly={locked}
                  onPatch={(patch) => void patchParty(event.id, party.party.id, patch)}
                  onRemove={() => void removeParty(event.id, party.party.id)}
                />
              ))
            )}
          </section>

          <Card className="grid gap-4 p-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Currency</span>
              <Input
                aria-label="Currency"
                value={sheet.currency}
                disabled={locked}
                maxLength={3}
                onChange={(e) => void updateSettlement(event.id, { currency: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Prepared by</span>
              <Input
                aria-label="Prepared by"
                value={sheet.preparedBy ?? ''}
                disabled={locked}
                onChange={(e) => void updateSettlement(event.id, { preparedBy: e.target.value })}
              />
            </label>
            <label className="space-y-1 sm:col-span-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes on the statement</span>
              <Input
                aria-label="Settlement notes"
                value={sheet.notes ?? ''}
                disabled={locked}
                onChange={(e) => void updateSettlement(event.id, { notes: e.target.value })}
              />
            </label>
          </Card>
        </TabsContent>

        <TabsContent value="statement" className="mt-5">
          <Card className="p-6">
            <SettlementStatement event={event} sheet={sheet} result={result} categories={categories} />
          </Card>
        </TabsContent>
      </Tabs>

      {/* The paper copy: same component, ink-light, only ever printed. */}
      <div className="hidden print:block">
        <SettlementStatement event={event} sheet={sheet} result={result} categories={categories} paper />
      </div>
    </div>
  );
}

function Headline({
  label,
  value,
  note,
  tone,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'success' | 'destructive';
  accent?: boolean;
}) {
  return (
    <Card className={cn('p-4', accent && 'border-primary/40 bg-primary/5')}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-2xl tabular',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
        data-numeric
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </Card>
  );
}
