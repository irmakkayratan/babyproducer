import { describe, expect, it } from 'vitest';
import type { SettlementLine, SettlementParty, SettlementSheet, TicketTier } from '@/data/types';
import { computeSettlement, resolveLine, toSettlementRows } from '@/modules/settlement/math';

const tier = (over: Partial<TicketTier> = {}): TicketTier => ({
  id: over.id ?? 't1',
  label: 'Advance',
  price: 30,
  allotment: 1000,
  sold: 800,
  comps: 0,
  ...over,
});

const line = (over: Partial<SettlementLine> = {}): SettlementLine => ({
  id: over.id ?? 'l1',
  label: 'Line',
  basis: 'fixed',
  amount: 0,
  ...over,
});

const party = (over: Partial<SettlementParty> = {}): SettlementParty => ({
  id: over.id ?? 'p1',
  name: 'Headline',
  deal: { kind: 'flat', guarantee: 0, percentage: 0, basis: 'net', breakeven: 0 },
  deposit: 0,
  withholdingPercent: 0,
  adjustments: [],
  ...over,
});

const sheet = (over: Partial<SettlementSheet> = {}): SettlementSheet => ({
  id: 's1',
  eventId: 'e1',
  currency: 'EUR',
  scaling: [tier()],
  otherRevenue: [],
  deductions: [],
  expenses: [],
  parties: [party()],
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
  rev: 1,
  ...over,
});

describe('box office', () => {
  it('grosses each price band and totals them', () => {
    const result = computeSettlement(
      sheet({
        scaling: [
          tier({ id: 'a', label: 'Early bird', price: 25, allotment: 200, sold: 200 }),
          tier({ id: 'b', label: 'Advance', price: 35, allotment: 800, sold: 540 }),
        ],
      }),
    );

    expect(result.ticketGross).toBe(200 * 25 + 540 * 35);
    expect(result.gross).toBe(result.ticketGross);
    expect(result.attendance.sold).toBe(740);
    expect(result.attendance.sellThrough).toBeCloseTo(740 / 1000, 5);
    expect(result.attendance.averageTicket).toBeCloseTo(result.ticketGross / 740, 2);
  });

  it('counts comps as bodies in the room and as nothing at the box office', () => {
    const result = computeSettlement(sheet({ scaling: [tier({ sold: 800, comps: 120 })] }));

    expect(result.ticketGross).toBe(24_000);
    expect(result.attendance.heads).toBe(920);
    expect(result.attendance.grossPerHead).toBeCloseTo(24_000 / 920, 2);
  });

  it('adds other income to the gross', () => {
    const result = computeSettlement(
      sheet({
        otherRevenue: [line({ label: 'Bar share', amount: 2200 }), line({ id: 'l2', label: 'Merch', amount: 1450 })],
      }),
    );
    expect(result.otherRevenueTotal).toBe(3650);
    expect(result.gross).toBe(24_000 + 3650);
  });
});

describe('deductions', () => {
  it('cascades: each line sees what the ones above it left', () => {
    const result = computeSettlement(
      sheet({
        deductions: [
          line({ id: 'vat', label: 'VAT', basis: 'percent-gross', amount: 20 }),
          line({ id: 'rights', label: "Author's rights", basis: 'percent-adjusted', amount: 10 }),
        ],
      }),
    );

    // 20% of 24,000 comes off the top, then 10% of the 19,200 that is left.
    expect(result.deductions[0].amount).toBe(4800);
    expect(result.deductions[1].amount).toBe(1920);
    expect(result.adjustedGross).toBe(24_000 - 4800 - 1920);
  });

  it('is levied on the box office, not on the bar', () => {
    const result = computeSettlement(
      sheet({
        otherRevenue: [line({ label: 'Bar share', amount: 6000 })],
        deductions: [line({ label: 'VAT', basis: 'percent-gross', amount: 20 })],
      }),
    );

    // 20% of the 24,000 the tickets took, never of the 30,000 total.
    expect(result.gross).toBe(30_000);
    expect(result.deductionTotal).toBe(4800);
    expect(result.adjustedGross).toBe(25_200);
  });

  it('supports per-ticket facility fees', () => {
    const result = computeSettlement(
      sheet({ deductions: [line({ label: 'Facility fee', basis: 'per-ticket', amount: 2.5 })] }),
    );
    expect(result.deductionTotal).toBe(2000);
    expect(result.adjustedGross).toBe(22_000);
  });
});

describe('expenses', () => {
  it('resolves every basis and groups by category', () => {
    const result = computeSettlement(
      sheet({
        scaling: [tier({ sold: 800, comps: 200 })],
        expenses: [
          line({ id: 'rent', label: 'Venue rent', basis: 'fixed', amount: 6500, categoryId: 'venue' }),
          line({ id: 'sec', label: 'Security', basis: 'per-head', amount: 1.5, categoryId: 'staffing' }),
          line({ id: 'crew', label: 'Stagehands', basis: 'fixed', amount: 2300, categoryId: 'staffing' }),
          line({ id: 'mkt', label: 'Marketing', basis: 'percent-gross', amount: 10, categoryId: 'marketing' }),
        ],
      }),
    );

    expect(result.expenses.find((row) => row.line.id === 'sec')?.amount).toBe(1500);
    expect(result.expenses.find((row) => row.line.id === 'mkt')?.amount).toBe(2400);
    expect(result.expenseTotal).toBe(6500 + 1500 + 2300 + 2400);
    expect(result.expensesByCategory.find((row) => row.categoryId === 'staffing')?.total).toBe(3800);
    expect(result.net).toBe(result.adjustedGross - result.expenseTotal);
  });

  it('files an uncategorised cost under other, so nothing is dropped', () => {
    const result = computeSettlement(sheet({ expenses: [line({ label: 'Runner', amount: 250 })] }));
    expect(result.expensesByCategory).toEqual([{ categoryId: 'other', total: 250 }]);
  });
});

describe('deals', () => {
  const withDeal = (deal: SettlementParty['deal'], over: Partial<SettlementSheet> = {}) =>
    computeSettlement(
      sheet({
        expenses: [line({ label: 'Costs', amount: 4000 })],
        parties: [party({ deal })],
        ...over,
      }),
    );

  it('pays a flat fee whatever the room does', () => {
    const result = withDeal({ kind: 'flat', guarantee: 9000, percentage: 0, basis: 'net', breakeven: 0 });
    expect(result.parties[0].earned).toBe(9000);
    expect(result.parties[0].terms).toContain('Flat fee');
  });

  it('pays a straight percentage of its basis', () => {
    const result = withDeal({ kind: 'percentage', guarantee: 0, percentage: 70, basis: 'net', breakeven: 0 });
    // 24,000 gross, no deductions, 4,000 of costs → 20,000 net.
    expect(result.net).toBe(20_000);
    expect(result.parties[0].earned).toBe(14_000);
  });

  it('versus pays whichever side is greater, and says which', () => {
    const strong = withDeal({ kind: 'versus', guarantee: 12_000, percentage: 85, basis: 'net', breakeven: 0 });
    expect(strong.parties[0].percentageValue).toBe(17_000);
    expect(strong.parties[0].earned).toBe(17_000);
    expect(strong.parties[0].wonBy).toBe('percentage');
    expect(strong.parties[0].terms).toContain('The percentage applies');

    const quiet = withDeal(
      { kind: 'versus', guarantee: 12_000, percentage: 85, basis: 'net', breakeven: 0 },
      { scaling: [tier({ sold: 300 })] },
    );
    expect(quiet.parties[0].earned).toBe(12_000);
    expect(quiet.parties[0].wonBy).toBe('guarantee');
  });

  it('guarantee plus a bonus only pays the bonus on the overage', () => {
    const result = withDeal({ kind: 'plus-bonus', guarantee: 8000, percentage: 50, basis: 'net', breakeven: 15_000 });
    // Net is 20,000, so 5,000 is over the breakeven and half of it is shared.
    expect(result.parties[0].earned).toBe(10_500);

    const under = withDeal(
      { kind: 'plus-bonus', guarantee: 8000, percentage: 50, basis: 'net', breakeven: 15_000 },
      { scaling: [tier({ sold: 400 })] },
    );
    expect(under.parties[0].earned).toBe(8000);
  });

  it('applies the deal to the basis it names', () => {
    const onGross = withDeal({ kind: 'percentage', guarantee: 0, percentage: 10, basis: 'gross', breakeven: 0 });
    expect(onGross.parties[0].basisValue).toBe(24_000);
    expect(onGross.parties[0].earned).toBe(2400);
  });
});

describe('payouts', () => {
  it('nets the deposit and withholding off the balance due', () => {
    const result = computeSettlement(
      sheet({
        parties: [
          party({
            deal: { kind: 'flat', guarantee: 10_000, percentage: 0, basis: 'net', breakeven: 0 },
            deposit: 3000,
            withholdingPercent: 15,
            adjustments: [line({ label: 'Buyout', amount: 500 })],
          }),
        ],
      }),
    );

    const payout = result.parties[0];
    expect(payout.earned).toBe(10_000);
    expect(payout.withholding).toBe(1500);
    expect(payout.adjustmentTotal).toBe(500);
    expect(payout.balanceDue).toBe(10_000 + 500 - 1500 - 3000);
    expect(result.balanceDue).toBe(payout.balanceDue);
  });

  it('charges the house the whole fee, deposit or not', () => {
    const result = computeSettlement(
      sheet({
        expenses: [line({ label: 'Costs', amount: 4000 })],
        parties: [
          party({ deal: { kind: 'flat', guarantee: 9000, percentage: 0, basis: 'net', breakeven: 0 }, deposit: 9000 }),
        ],
      }),
    );

    expect(result.talentCost).toBe(9000);
    expect(result.houseResult).toBe(result.net - 9000);
    expect(result.balanceDue).toBe(0);
  });

  it('settles several parties independently', () => {
    const result = computeSettlement(
      sheet({
        parties: [
          party({ id: 'a', name: 'Headline', deal: { kind: 'flat', guarantee: 9000, percentage: 0, basis: 'net', breakeven: 0 } }),
          party({ id: 'b', name: 'Support', deal: { kind: 'flat', guarantee: 1500, percentage: 0, basis: 'net', breakeven: 0 } }),
        ],
      }),
    );

    expect(result.parties.map((row) => row.earned)).toEqual([9000, 1500]);
    expect(result.talentCost).toBe(10_500);
  });
});

describe('robustness', () => {
  it('returns zeros for an empty sheet, with no NaN anywhere', () => {
    const result = computeSettlement(sheet({ scaling: [], parties: [] }));
    expect(result.gross).toBe(0);
    expect(result.net).toBe(0);
    expect(result.houseResult).toBe(0);
    expect(result.attendance.sellThrough).toBe(0);
    expect(result.attendance.averageTicket).toBe(0);
    expect(result.breakevenTickets).toBeNull();
  });

  it('survives fields a half-filled form leaves blank', () => {
    const result = computeSettlement(
      sheet({
        scaling: [tier({ price: Number.NaN, sold: Number.NaN })],
        expenses: [line({ label: '', amount: Number.NaN })],
      }),
    );
    expect(Number.isFinite(result.gross)).toBe(true);
    expect(Number.isFinite(result.net)).toBe(true);
  });

  it('rounds money to the cent', () => {
    const result = computeSettlement(
      sheet({ scaling: [tier({ price: 33.33, sold: 3 })], deductions: [line({ basis: 'percent-gross', amount: 7.5 })] }),
    );
    expect(result.ticketGross).toBe(99.99);
    expect(result.deductionTotal).toBe(7.5);
  });

  it('reports the tickets the show needed to break even', () => {
    const result = computeSettlement(
      sheet({
        deductions: [line({ label: 'VAT', basis: 'percent-gross', amount: 20 })],
        expenses: [line({ label: 'Costs', amount: 6000 })],
        parties: [party({ deal: { kind: 'versus', guarantee: 6000, percentage: 85, basis: 'net', breakeven: 0 } })],
      }),
    );
    // 24 net per ticket after tax against 12,000 of costs and guarantee.
    expect(result.breakevenTickets).toBe(500);
  });
});

describe('resolveLine', () => {
  it('reads each basis against the context it is given', () => {
    const ctx = { boxOffice: 10_000, balance: 8000, ticketsSold: 400, heads: 450 };
    expect(resolveLine(line({ basis: 'fixed', amount: 120 }), ctx)).toBe(120);
    expect(resolveLine(line({ basis: 'percent-gross', amount: 10 }), ctx)).toBe(1000);
    expect(resolveLine(line({ basis: 'percent-adjusted', amount: 10 }), ctx)).toBe(800);
    expect(resolveLine(line({ basis: 'per-ticket', amount: 2 }), ctx)).toBe(800);
    expect(resolveLine(line({ basis: 'per-head', amount: 2 }), ctx)).toBe(900);
  });
});

describe('export', () => {
  it('writes every section of the statement as rows', () => {
    const result = computeSettlement(
      sheet({
        deductions: [line({ id: 'vat', label: 'VAT', basis: 'percent-gross', amount: 20 })],
        expenses: [line({ id: 'rent', label: 'Venue rent', amount: 6500, categoryId: 'venue' })],
        parties: [
          party({
            deal: { kind: 'flat', guarantee: 9000, percentage: 0, basis: 'net', breakeven: 0 },
            deposit: 4500,
          }),
        ],
      }),
    );
    const rows = toSettlementRows(result, { event: 'Show', categoryLabel: (id) => id });

    expect(rows.some((row) => row.Line === 'Gross receipts' && row.Amount === 24_000)).toBe(true);
    // Money leaving the show is written as a negative, so the column sums.
    expect(rows.find((row) => row.Line === 'VAT')?.Amount).toBe(-4800);
    expect(rows.find((row) => row.Line === 'Headline · balance due')?.Amount).toBe(4500);
    expect(rows.at(-1)).toMatchObject({ Line: 'House result' });
  });
});
