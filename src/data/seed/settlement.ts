/**
 * Demo settlement sheets.
 *
 * Built from the event template's preset and then filled in from the scenario:
 * how each band sold, what the night actually cost, and the deal each party is
 * on. Left as drafts on purpose, a reader should be able to change a ticket
 * count and watch the payout move.
 */
import { buildSettlementSheet } from '@/data/settlement';
import type { Event, SettlementLine, SettlementSheet } from '@/data/types';
import type { Rng } from '@/lib/rng';
import type { ScenarioSpec } from './scenarios';

export function generateSettlement(
  spec: ScenarioSpec,
  event: Event,
  rng: Rng,
  makeId: () => string,
  isPast: boolean,
): SettlementSheet {
  const base = buildSettlementSheet(event, makeId);
  const settlement = spec.settlement;
  if (!settlement) return base;

  const withIds = (lines: Array<Omit<SettlementLine, 'id'>>): SettlementLine[] =>
    lines.map((line) => ({ ...line, id: makeId() }));

  // A band never sells at exactly the headline rate: cheap tickets go first.
  const soldRate = settlement.soldRate ?? 0;
  const scaling = settlement.noBoxOffice ? [] : base.scaling.map((tier, index) => {
    if (!isPast || soldRate === 0) return tier;
    const bias = 1 + (base.scaling.length - index - 1) * 0.06;
    const sold = Math.min(tier.allotment, Math.round(tier.allotment * Math.min(1, soldRate * bias * rng.normal(1, 0.05))));
    return {
      ...tier,
      sold,
      comps: Math.round(tier.allotment * (settlement.compsRate ?? 0) * rng.normal(1, 0.2)),
    };
  });

  return {
    ...base,
    currency: settlement.currency ?? base.currency,
    scaling,
    deductions: settlement.deductions ? withIds(settlement.deductions) : base.deductions,
    otherRevenue: isPast && settlement.otherRevenue ? withIds(settlement.otherRevenue) : [],
    expenses: settlement.expenses ? withIds(settlement.expenses) : base.expenses,
    preparedBy: 'Production office',
    parties: settlement.parties.map((party) => ({
      id: makeId(),
      name: party.name,
      roleId: party.roleId,
      deal: { ...party.deal },
      deposit: party.deposit ?? 0,
      withholdingPercent: party.withholdingPercent ?? 0,
      adjustments: withIds(party.adjustments ?? []),
    })),
  };
}
