/**
 * The settlement engine.
 *
 * One pure function turns a sheet of inputs into every figure a statement
 * shows, in the order the industry reads them:
 *
 *   ticket sales + other income        → gross
 *   − taxes, ticketing, rights          → adjusted gross
 *   − the cost of putting the show on   → net
 *   → apply each deal to its basis      → payouts
 *   − deposits and withholding          → balance due
 *
 * Nothing here is stored. That is deliberate: a settlement gets re-run half a
 * dozen times on the night as the door count firms up and a runner comes back
 * with a receipt, and a total that was written down two hours ago is the one
 * that ends up wrong.
 */
import type {
  DealTerms,
  SettlementLine,
  SettlementParty,
  SettlementSheet,
  TicketTier,
} from '@/data/types';

/**
 * Money is rounded to the cent at every reported figure, never before.
 *
 * `Math.round` breaks ties towards +Infinity, which would round 1.005 up and
 * -1.005 down to -1.00 — a statement where a credit and the debit reversing it
 * do not cancel. Ties here always go away from zero, and the scaled value is
 * nudged past the binary-representation error that puts 1.005 * 100 at
 * 100.49999999999999.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const scaled = value * 100;
  const nudged = scaled + Math.sign(scaled) * Number.EPSILON * Math.abs(scaled);
  return Math.sign(scaled) * Math.round(Math.abs(nudged)) / 100;
}

const num = (value: number | undefined): number => (Number.isFinite(value) ? (value as number) : 0);

export interface LineContext {
  /**
   * Gross box office. Tax, ticketing and rights are levied on what the tickets
   * took, not on what the bar did, so percentages read this rather than total
   * receipts — the same thing "% of gross" means on a printed settlement.
   */
  boxOffice: number;
  /** What the lines above this one have left: the running balance. */
  balance: number;
  /** Paid tickets. */
  ticketsSold: number;
  /** Bodies in the room: paid plus comps. */
  heads: number;
}

/**
 * Resolves one line against the figures known at the point it is applied.
 * `percent-adjusted` on a deduction is resolved against the running balance,
 * which is how a box office statement cascades: tax comes off the top, and
 * rights are calculated on what is left.
 */
export function resolveLine(line: SettlementLine, ctx: LineContext): number {
  const amount = num(line.amount);
  switch (line.basis) {
    case 'percent-gross':
      return round2((ctx.boxOffice * amount) / 100);
    case 'percent-adjusted':
      return round2((ctx.balance * amount) / 100);
    case 'per-ticket':
      return round2(amount * ctx.ticketsSold);
    case 'per-head':
      return round2(amount * ctx.heads);
    case 'fixed':
    default:
      return round2(amount);
  }
}

export interface ResolvedLine {
  line: SettlementLine;
  amount: number;
}

export interface TierResult {
  tier: TicketTier;
  gross: number;
  /** Share of this tier's allotment that sold. */
  sellThrough: number;
}

export interface PartyResult {
  party: SettlementParty;
  /** The figure the deal's percentage was taken from. */
  basisValue: number;
  /** What the percentage side of the deal came to, before any comparison. */
  percentageValue: number;
  /** The fee the contract lands on. */
  earned: number;
  /** For a `versus` deal: which side of it won. */
  wonBy: 'guarantee' | 'percentage' | null;
  adjustments: ResolvedLine[];
  adjustmentTotal: number;
  withholding: number;
  deposit: number;
  /** What is actually handed over at the settlement table. */
  balanceDue: number;
  /** One sentence describing the deal as applied. */
  terms: string;
}

export interface SettlementResult {
  currency: string;
  tiers: TierResult[];
  ticketGross: number;
  otherRevenue: ResolvedLine[];
  otherRevenueTotal: number;
  gross: number;
  deductions: ResolvedLine[];
  deductionTotal: number;
  adjustedGross: number;
  expenses: ResolvedLine[];
  expenseTotal: number;
  expensesByCategory: Array<{ categoryId: string; total: number }>;
  /** Adjusted gross less show costs: the pot the deals are applied to. */
  net: number;
  parties: PartyResult[];
  /** Everything owed to the parties, before deposits and withholding. */
  talentCost: number;
  /** What the house keeps once the show is paid. */
  houseResult: number;
  balanceDue: number;
  attendance: {
    allotment: number;
    sold: number;
    comps: number;
    heads: number;
    sellThrough: number;
    averageTicket: number;
    grossPerHead: number;
  };
  /** Paid tickets the show needed to cover costs and guarantees. */
  breakevenTickets: number | null;
}

export function computeSettlement(sheet: SettlementSheet): SettlementResult {
  const tiers: TierResult[] = sheet.scaling.map((tier) => {
    const sold = Math.max(0, num(tier.sold));
    return {
      tier,
      gross: round2(num(tier.price) * sold),
      sellThrough: tier.allotment > 0 ? sold / tier.allotment : 0,
    };
  });

  const allotment = sheet.scaling.reduce((sum, tier) => sum + Math.max(0, num(tier.allotment)), 0);
  const sold = sheet.scaling.reduce((sum, tier) => sum + Math.max(0, num(tier.sold)), 0);
  const comps = sheet.scaling.reduce((sum, tier) => sum + Math.max(0, num(tier.comps)), 0);
  const heads = sold + comps;
  const ticketGross = round2(tiers.reduce((sum, row) => sum + row.gross, 0));

  // Other income is resolved before the gross it might be a percentage of is
  // known, so it only ever sees ticket income. A percentage of your own
  // percentage is not a thing anyone puts on a settlement.
  const revenueCtx: LineContext = { boxOffice: ticketGross, balance: ticketGross, ticketsSold: sold, heads };
  const otherRevenue = sheet.otherRevenue.map((line) => ({ line, amount: resolveLine(line, revenueCtx) }));
  const otherRevenueTotal = round2(otherRevenue.reduce((sum, row) => sum + row.amount, 0));
  const gross = round2(ticketGross + otherRevenueTotal);

  // Deductions cascade off the box office: tax comes off the top, and rights
  // are calculated on what the tax left — which is how the statement a venue
  // hands over is laid out.
  let running = ticketGross;
  const deductions: ResolvedLine[] = sheet.deductions.map((line) => {
    const amount = resolveLine(line, { boxOffice: ticketGross, balance: running, ticketsSold: sold, heads });
    running = round2(running - amount);
    return { line, amount };
  });
  const deductionTotal = round2(deductions.reduce((sum, row) => sum + row.amount, 0));
  const adjustedGross = round2(gross - deductionTotal);

  const costCtx: LineContext = { boxOffice: ticketGross, balance: adjustedGross, ticketsSold: sold, heads };
  const expenses = sheet.expenses.map((line) => ({ line, amount: resolveLine(line, costCtx) }));
  const expenseTotal = round2(expenses.reduce((sum, row) => sum + row.amount, 0));
  const net = round2(adjustedGross - expenseTotal);

  const byCategory = new Map<string, number>();
  for (const row of expenses) {
    const key = row.line.categoryId ?? 'other';
    byCategory.set(key, round2((byCategory.get(key) ?? 0) + row.amount));
  }

  const bases = { gross, adjusted: adjustedGross, net };
  const parties = sheet.parties.map((party) => settleParty(party, bases, costCtx, sheet.currency));

  const talentCost = round2(parties.reduce((sum, row) => sum + row.earned + row.adjustmentTotal, 0));
  const houseResult = round2(net - talentCost);
  const balanceDue = round2(parties.reduce((sum, row) => sum + row.balanceDue, 0));

  return {
    currency: sheet.currency,
    tiers,
    ticketGross,
    otherRevenue,
    otherRevenueTotal,
    gross,
    deductions,
    deductionTotal,
    adjustedGross,
    expenses,
    expenseTotal,
    expensesByCategory: [...byCategory.entries()]
      .map(([categoryId, total]) => ({ categoryId, total }))
      .sort((a, b) => b.total - a.total),
    net,
    parties,
    talentCost,
    houseResult,
    balanceDue,
    attendance: {
      allotment,
      sold,
      comps,
      heads,
      sellThrough: allotment > 0 ? sold / allotment : 0,
      averageTicket: sold > 0 ? round2(ticketGross / sold) : 0,
      grossPerHead: heads > 0 ? round2(gross / heads) : 0,
    },
      breakevenTickets: breakevenTickets(sheet, { ticketGross, sold, expenseTotal, deductionTotal }),
  };
}

function settleParty(
  party: SettlementParty,
  bases: { gross: number; adjusted: number; net: number },
  ctx: LineContext,
  currency: string,
): PartyResult {
  const deal = party.deal;
  const basisValue = bases[deal.basis] ?? 0;
  const percentageValue = round2((basisValue * num(deal.percentage)) / 100);
  const guarantee = round2(num(deal.guarantee));

  let earned = guarantee;
  let wonBy: PartyResult['wonBy'] = null;

  if (deal.kind === 'percentage') {
    earned = percentageValue;
  } else if (deal.kind === 'versus') {
    // "Guarantee versus a percentage" pays whichever is greater — never both.
    wonBy = percentageValue > guarantee ? 'percentage' : 'guarantee';
    earned = Math.max(guarantee, percentageValue);
  } else if (deal.kind === 'plus-bonus') {
    // The overage deal: the fee is safe, and the percentage only applies to
    // what the show made above the figure written into the contract.
    const overage = Math.max(0, round2(basisValue - num(deal.breakeven)));
    earned = round2(guarantee + (overage * num(deal.percentage)) / 100);
  }
  earned = round2(earned);

  const adjustments = party.adjustments.map((line) => ({ line, amount: resolveLine(line, ctx) }));
  const adjustmentTotal = round2(adjustments.reduce((sum, row) => sum + row.amount, 0));
  const withholding = round2((earned * num(party.withholdingPercent)) / 100);
  const deposit = round2(num(party.deposit));

  return {
    party,
    basisValue,
    percentageValue,
    earned,
    wonBy,
    adjustments,
    adjustmentTotal,
    withholding,
    deposit,
    balanceDue: round2(earned + adjustmentTotal - withholding - deposit),
    terms: describeDeal(deal, { guarantee, percentageValue, wonBy, currency }),
  };
}

const BASIS_LABEL: Record<DealTerms['basis'], string> = {
  gross: 'gross',
  adjusted: 'adjusted gross',
  net: 'net after costs',
};

/** The deal in one sentence, as it was actually applied tonight. */
export function describeDeal(
  deal: DealTerms,
  applied: { guarantee: number; percentageValue: number; wonBy: PartyResult['wonBy']; currency: string },
): string {
  const money = (value: number) => formatMoney(value, applied.currency);
  const share = `${trimPercent(deal.percentage)}% of ${BASIS_LABEL[deal.basis]}`;

  switch (deal.kind) {
    case 'flat':
      return `Flat fee of ${money(applied.guarantee)}.`;
    case 'percentage':
      return `${share} — ${money(applied.percentageValue)}.`;
    case 'versus':
      return `${money(applied.guarantee)} versus ${share} (${money(applied.percentageValue)}) — the ${
        applied.wonBy === 'percentage' ? 'percentage' : 'guarantee'
      } applies.`;
    case 'plus-bonus':
      return `${money(applied.guarantee)} plus ${trimPercent(deal.percentage)}% of ${
        BASIS_LABEL[deal.basis]
      } above ${money(deal.breakeven)}.`;
  }
}

function trimPercent(value: number): string {
  return String(Math.round(num(value) * 100) / 100);
}

/**
 * A currency code that `Intl` rejects throws at construction, and every figure
 * on a statement runs through this function — so one bad code in an imported
 * workspace would take the whole settlement page down rather than showing a
 * slightly wrong symbol. Codes are validated once and remembered.
 */
const currencyCache = new Map<string, string>();

function safeCurrency(currency: string): string {
  const code = (currency || 'EUR').trim().toUpperCase();
  const cached = currencyCache.get(code);
  if (cached) return cached;
  let resolved = 'EUR';
  try {
    new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    resolved = code;
  } catch {
    resolved = 'EUR';
  }
  currencyCache.set(code, resolved);
  return resolved;
}

export function formatMoney(value: number, currency: string, decimals = 2): string {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: safeCurrency(currency),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * How many paid tickets the show had to sell to cover its costs and its
 * guarantees, priced at the average ticket actually sold and net of the
 * percentage coming off the top. Null when there is nothing to divide by.
 */
function breakevenTickets(
  sheet: SettlementSheet,
  totals: { ticketGross: number; sold: number; expenseTotal: number; deductionTotal: number },
): number | null {
  if (totals.sold <= 0 || totals.ticketGross <= 0) return null;
  const keepRate = (totals.ticketGross - totals.deductionTotal) / totals.ticketGross;
  const netPerTicket = (totals.ticketGross / totals.sold) * keepRate;
  if (netPerTicket <= 0) return null;

  const guarantees = sheet.parties.reduce(
    (sum, party) => sum + (party.deal.kind === 'percentage' ? 0 : num(party.deal.guarantee)),
    0,
  );
  return Math.ceil((totals.expenseTotal + guarantees) / netPerTicket);
}

/* -------------------------------------------------------------- exporting */

/** The statement as rows, for the CSV an accounts department can open. */
export function toSettlementRows(
  result: SettlementResult,
  labels: { event: string; categoryLabel: (id: string) => string },
): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = [];
  const push = (section: string, label: string, amount: number, detail = '') =>
    rows.push({ Section: section, Line: label, Detail: detail, Amount: amount, Currency: result.currency });

  for (const row of result.tiers) {
    push(
      'Box office',
      row.tier.label,
      row.gross,
      `${row.tier.sold} sold @ ${row.tier.price}${row.tier.comps ? ` · ${row.tier.comps} comps` : ''}`,
    );
  }
  for (const row of result.otherRevenue) push('Other income', row.line.label, row.amount);
  push('Total', 'Gross receipts', result.gross);

  for (const row of result.deductions) push('Deductions', row.line.label, -row.amount, basisDetail(row.line));
  push('Total', 'Adjusted gross', result.adjustedGross);

  for (const row of result.expenses) {
    push('Expenses', row.line.label, -row.amount, labels.categoryLabel(row.line.categoryId ?? 'other'));
  }
  push('Total', 'Net after costs', result.net);

  for (const party of result.parties) {
    push('Payout', `${party.party.name} — fee`, party.earned, party.terms);
    for (const adjustment of party.adjustments) {
      push('Payout', `${party.party.name} — ${adjustment.line.label}`, adjustment.amount);
    }
    if (party.withholding) push('Payout', `${party.party.name} — withholding`, -party.withholding);
    if (party.deposit) push('Payout', `${party.party.name} — deposit paid`, -party.deposit);
    push('Payout', `${party.party.name} — balance due`, party.balanceDue);
  }

  push('Total', 'House result', result.houseResult);
  return rows;
}

export function basisDetail(line: SettlementLine): string {
  switch (line.basis) {
    case 'percent-gross':
      return `${trimPercent(line.amount)}% of box office`;
    case 'percent-adjusted':
      return `${trimPercent(line.amount)}% of the running balance`;
    case 'per-ticket':
      return `${line.amount} per ticket`;
    case 'per-head':
      return `${line.amount} per head`;
    default:
      return '';
  }
}
