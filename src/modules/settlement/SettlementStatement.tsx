import type { Event, SettlementSheet, Vocab } from '@/data/types';
import { formatEventWindow } from '@/lib/time';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { basisDetail, formatMoney, type SettlementResult } from './math';

/**
 * The settlement statement.
 *
 * This is the document the whole module produces: the one page that gets
 * signed in the production office, printed to PDF and mailed on. It renders
 * twice — once on screen and once, ink-light, for paper — from the same
 * component, so what is sent is exactly what was checked.
 */
export function SettlementStatement({
  event,
  sheet,
  result,
  categories,
  paper = false,
}: {
  event: Event;
  sheet: SettlementSheet;
  result: SettlementResult;
  categories: Vocab[];
  paper?: boolean;
}) {
  const money = (value: number, decimals = 0) => formatMoney(value, result.currency, decimals);
  const categoryLabel = (id?: string) => categories.find((entry) => entry.id === id)?.label ?? '—';
  const rule = paper ? 'border-black/15' : 'border-border/60';
  const heading = paper ? 'text-[11px] font-semibold uppercase tracking-wide' : 'font-display text-lg tracking-tight';
  const table = paper ? 'w-full border-collapse text-[11px]' : 'w-full text-sm';
  const cell = paper ? 'py-1 pr-2' : 'px-3 py-1.5';

  return (
    <article className={cn(paper && 'text-black')} data-testid={paper ? 'settlement-paper' : 'settlement-statement'}>
      <header className={cn('border-b pb-3', rule)}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className={paper ? 'text-xl font-semibold' : 'font-display text-2xl tracking-tight'}>
            {event.name} — Settlement
          </h1>
          <span className={cn('text-xs uppercase tracking-widest', !paper && 'text-muted-foreground')}>
            {sheet.finalizedAt ? 'Final' : 'Draft'}
          </span>
        </div>
        <p className={cn('mt-1 text-xs', !paper && 'text-muted-foreground')}>
          {[event.venue.name, formatEventWindow(event.startsAt, event.endsAt, event.timezone)]
            .filter(Boolean)
            .join(' · ')}
          {sheet.preparedBy ? ` · prepared by ${sheet.preparedBy}` : ''} · all figures in {result.currency}
        </p>
      </header>

      {result.attendance.heads > 0 && (
      <section className={cn('grid gap-3 border-b py-3 sm:grid-cols-4', rule)}>
        <Figure paper={paper} label="Sold" value={formatNumber(result.attendance.sold)} />
        <Figure
          paper={paper}
          label="In the room"
          value={formatNumber(result.attendance.heads)}
          note={result.attendance.comps > 0 ? `${formatNumber(result.attendance.comps)} comped` : undefined}
        />
        <Figure
          paper={paper}
          label="Sell-through"
          value={
            result.attendance.allotment > 0 ? `${Math.round(result.attendance.sellThrough * 100)}%` : '—'
          }
          note={result.attendance.allotment > 0 ? `of ${formatNumber(result.attendance.allotment)}` : undefined}
        />
        <Figure
          paper={paper}
          label="Average ticket"
          value={money(result.attendance.averageTicket, 2)}
          note={`${money(result.attendance.grossPerHead, 2)} per head`}
        />
      </section>
      )}

      <Block title={result.tiers.length > 0 ? 'Box office' : 'Income'} heading={heading}>
        <table className={table}>
          {result.tiers.length > 0 && (
          <thead>
            <tr className={cn('border-b text-left', rule, !paper && 'text-xs uppercase text-muted-foreground')}>
              <th className={cell}>Band</th>
              <th className={cn(cell, 'text-right')}>Price</th>
              <th className={cn(cell, 'text-right')}>Sold</th>
              <th className={cn(cell, 'text-right')}>Comps</th>
              <th className={cn(cell, 'text-right')}>Gross</th>
            </tr>
          </thead>
          )}
          <tbody>
            {result.tiers.map((row) => (
              <tr key={row.tier.id} className={cn('border-b', rule)}>
                <td className={cell}>{row.tier.label}</td>
                <td className={cn(cell, 'text-right font-mono tabular')}>{money(row.tier.price, 2)}</td>
                <td className={cn(cell, 'text-right font-mono tabular')}>{formatNumber(row.tier.sold)}</td>
                <td className={cn(cell, 'text-right font-mono tabular')}>{formatNumber(row.tier.comps)}</td>
                <td className={cn(cell, 'text-right font-mono tabular')}>{money(row.gross)}</td>
              </tr>
            ))}
            {result.otherRevenue.map((row) => (
              <tr key={row.line.id} className={cn('border-b', rule)}>
                <td className={cell} colSpan={4}>
                  {row.line.label || 'Other income'}
                </td>
                <td className={cn(cell, 'text-right font-mono tabular')}>{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Total paper={paper} label="Gross receipts" value={money(result.gross)} testId="settlement-gross" />
      </Block>

      {result.deductions.length > 0 && (
        <Block title="Off the top" heading={heading}>
          <table className={table}>
            <tbody>
              {result.deductions.map((row) => (
                <tr key={row.line.id} className={cn('border-b', rule)}>
                  <td className={cell}>{row.line.label || 'Deduction'}</td>
                  <td className={cn(cell, !paper && 'text-muted-foreground')}>{basisDetail(row.line)}</td>
                  <td className={cn(cell, 'text-right font-mono tabular')}>− {money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Total paper={paper} label="Adjusted gross" value={money(result.adjustedGross)} />
        </Block>
      )}

      {result.expenses.length > 0 && (
        <Block title="Show costs" heading={heading}>
          <table className={table}>
            <tbody>
              {result.expenses.map((row) => (
                <tr key={row.line.id} className={cn('border-b', rule)}>
                  <td className={cell}>{row.line.label || 'Expense'}</td>
                  <td className={cn(cell, !paper && 'text-muted-foreground')}>
                    {[categoryLabel(row.line.categoryId), basisDetail(row.line)].filter(Boolean).join(' · ')}
                  </td>
                  <td className={cn(cell, 'text-right font-mono tabular')}>− {money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Total paper={paper} label="Net after costs" value={money(result.net)} testId="settlement-net" />
        </Block>
      )}

      {result.parties.map((party) => (
        <Block key={party.party.id} title={`Payout — ${party.party.name || 'party'}`} heading={heading}>
          <p className={cn('mb-2 text-xs', !paper && 'text-muted-foreground')}>{party.terms}</p>
          <table className={table}>
            <tbody>
              <tr className={cn('border-b', rule)}>
                <td className={cell}>Fee earned</td>
                <td className={cn(cell, 'text-right font-mono tabular')}>{money(party.earned)}</td>
              </tr>
              {party.adjustments.map((row) => (
                <tr key={row.line.id} className={cn('border-b', rule)}>
                  <td className={cell}>{row.line.label || 'Adjustment'}</td>
                  <td className={cn(cell, 'text-right font-mono tabular')}>{money(row.amount)}</td>
                </tr>
              ))}
              {party.withholding > 0 && (
                <tr className={cn('border-b', rule)}>
                  <td className={cell}>Withholding at source</td>
                  <td className={cn(cell, 'text-right font-mono tabular')}>− {money(party.withholding)}</td>
                </tr>
              )}
              {party.deposit > 0 && (
                <tr className={cn('border-b', rule)}>
                  <td className={cell}>Deposit already paid</td>
                  <td className={cn(cell, 'text-right font-mono tabular')}>− {money(party.deposit)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <Total paper={paper} label="Balance due" value={money(party.balanceDue)} />
        </Block>
      ))}

      <Block title="Where it lands" heading={heading}>
        <table className={table}>
          <tbody>
            <tr className={cn('border-b', rule)}>
              <td className={cell}>Net after costs</td>
              <td className={cn(cell, 'text-right font-mono tabular')}>{money(result.net)}</td>
            </tr>
            <tr className={cn('border-b', rule)}>
              <td className={cell}>Paid to parties</td>
              <td className={cn(cell, 'text-right font-mono tabular')}>− {money(result.talentCost)}</td>
            </tr>
          </tbody>
        </table>
        <Total paper={paper} label="House result" value={money(result.houseResult)} testId="settlement-house" />
        {result.breakevenTickets != null && (
          <p className={cn('mt-2 text-xs', !paper && 'text-muted-foreground')}>
            The show needed {formatNumber(result.breakevenTickets)} paid tickets to cover its costs and guarantees;
            it sold {formatNumber(result.attendance.sold)}.
          </p>
        )}
      </Block>

      {sheet.notes && (
        <p className={cn('mt-4 whitespace-pre-wrap text-xs', !paper && 'text-muted-foreground')}>{sheet.notes}</p>
      )}

      <p className={cn('mt-6 text-[11px]', !paper && 'text-muted-foreground')}>
        {sheet.finalizedAt
          ? `Finalized ${new Date(sheet.finalizedAt).toLocaleString()}.`
          : 'Draft — figures move as the sheet is edited.'}{' '}
        Generated {new Date().toLocaleString()} from data held in this browser.
      </p>
    </article>
  );
}

function Block({ title, heading, children }: { title: string; heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className={heading}>{title}</h2>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function Total({
  label,
  value,
  paper,
  testId,
}: {
  label: string;
  value: string;
  paper: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'mt-1.5 flex items-baseline justify-between gap-4 rounded-md px-3 py-2',
        paper ? 'bg-black/5' : 'bg-muted/40',
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="font-mono text-base tabular" data-numeric data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  paper,
}: {
  label: string;
  value: string;
  note?: string;
  paper: boolean;
}) {
  return (
    <div>
      <p className={cn('text-[11px] uppercase tracking-wide', !paper && 'text-muted-foreground')}>{label}</p>
      <p className="mt-0.5 font-mono text-xl tabular" data-numeric>
        {value}
      </p>
      {note && <p className={cn('text-[11px]', !paper && 'text-muted-foreground')}>{note}</p>}
    </div>
  );
}
