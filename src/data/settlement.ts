/**
 * Settlement sheets: the post-event financial record.
 *
 * The row stores inputs only. Ticket scaling, deductions, expenses and deal
 * terms. Every total on the statement is derived by `computeSettlement()`, for
 * the same reason cue start times are derived: a stored total is a total that
 * can disagree with the numbers under it.
 */
import { db } from './db';
import { defaultSettlementPreset } from './defaults';
import { getTemplate } from './templates';
import type { Event, SettlementLine, SettlementParty, SettlementSheet } from './types';
import { ulid } from '@/lib/id';

const now = () => new Date().toISOString();

export function buildSettlementSheet(
  event: Pick<Event, 'id' | 'name' | 'templateId' | 'capacity'>,
  makeId: () => string = ulid,
): SettlementSheet {
  const preset = getTemplate(event.templateId ?? 'blank').settlementPreset ?? defaultSettlementPreset();
  const stamp = now();
  const scaling = preset.scaling.map((tier) => ({ ...tier, id: makeId(), sold: 0, comps: 0 }));

  // A preset that does not state its own allotments inherits the room: the
  // capacity on the event is the only number we can honestly put there.
  if (event.capacity && scaling.length && scaling.every((tier) => tier.allotment === 0)) {
    scaling[0].allotment = event.capacity;
  }

  return {
    id: makeId(),
    eventId: event.id,
    currency: preset.currency,
    preparedBy: undefined,
    scaling,
    otherRevenue: [],
    deductions: preset.deductions.map((line) => ({ ...line, id: makeId() })),
    expenses: preset.expenses.map((line) => ({ ...line, id: makeId() })),
    parties: [
      {
        id: makeId(),
        name: event.name,
        deal: { ...preset.deal },
        deposit: 0,
        withholdingPercent: 0,
        adjustments: [],
      },
    ],
    createdAt: stamp,
    updatedAt: stamp,
    rev: 1,
  };
}

/* ------------------------------------------------------------------ reads */

export async function getSettlement(eventId: string): Promise<SettlementSheet | undefined> {
  return db.settlements.where('eventId').equals(eventId).first();
}

export async function ensureSettlement(event: Event): Promise<SettlementSheet> {
  const existing = await getSettlement(event.id);
  if (existing) return existing;
  const sheet = buildSettlementSheet(event);
  await db.settlements.put(sheet);
  return sheet;
}

/**
 * What the door actually counted, including plus-ones. Settlements get argued
 * over attendance, and this is the number the check-in desk can defend.
 */
export async function countedAttendance(eventId: string): Promise<number> {
  const arrivals = await db.arrivals.where('eventId').equals(eventId).toArray();
  return arrivals.filter((arrival) => !arrival.undone).reduce((sum, arrival) => sum + arrival.partySize, 0);
}

/* ----------------------------------------------------------------- writes */

async function mutate(
  eventId: string,
  fn: (sheet: SettlementSheet) => SettlementSheet | void,
): Promise<SettlementSheet | undefined> {
  const sheet = await getSettlement(eventId);
  if (!sheet) return undefined;
  const draft: SettlementSheet = structuredClone(sheet);
  const next = (fn(draft) ?? draft) as SettlementSheet;
  next.updatedAt = now();
  next.rev = sheet.rev + 1;
  await db.settlements.put(next);
  return next;
}

export type SettlementPatch = Partial<
  Pick<
    SettlementSheet,
    | 'currency'
    | 'finalizedAt'
    | 'preparedBy'
    | 'scaling'
    | 'otherRevenue'
    | 'deductions'
    | 'expenses'
    | 'parties'
    | 'notes'
  >
>;

export async function updateSettlement(
  eventId: string,
  patch: SettlementPatch,
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => Object.assign(sheet, patch));
}

/** Which of the three line collections a caller means. */
export type LineGroup = 'otherRevenue' | 'deductions' | 'expenses';

export async function addLine(
  eventId: string,
  group: LineGroup,
  input: Partial<SettlementLine> = {},
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet[group].push({
      id: ulid(),
      label: '',
      basis: group === 'deductions' ? 'percent-gross' : 'fixed',
      amount: 0,
      ...input,
    });
  });
}

export async function patchLine(
  eventId: string,
  group: LineGroup,
  lineId: string,
  patch: Partial<Omit<SettlementLine, 'id'>>,
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const line = sheet[group].find((candidate) => candidate.id === lineId);
    if (line) Object.assign(line, patch);
  });
}

export async function removeLine(
  eventId: string,
  group: LineGroup,
  lineId: string,
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet[group] = sheet[group].filter((line) => line.id !== lineId);
  });
}

export async function addParty(
  eventId: string,
  input: Partial<SettlementParty> = {},
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const template = sheet.parties[0]?.deal;
    sheet.parties.push({
      id: ulid(),
      name: '',
      deal: template
        ? { ...template, guarantee: 0, breakeven: 0 }
        : { kind: 'flat', guarantee: 0, percentage: 0, basis: 'net', breakeven: 0 },
      deposit: 0,
      withholdingPercent: 0,
      adjustments: [],
      ...input,
    });
  });
}

export async function patchParty(
  eventId: string,
  partyId: string,
  patch: Partial<Omit<SettlementParty, 'id'>>,
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const party = sheet.parties.find((candidate) => candidate.id === partyId);
    if (party) Object.assign(party, patch);
  });
}

export async function removeParty(eventId: string, partyId: string): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.parties = sheet.parties.filter((party) => party.id !== partyId);
  });
}

export async function patchPartyAdjustments(
  eventId: string,
  partyId: string,
  adjustments: SettlementLine[],
): Promise<SettlementSheet | undefined> {
  return patchParty(eventId, partyId, { adjustments });
}

/** Ticket scaling rows are edited as a block: one table, one write. */
export async function updateScaling(
  eventId: string,
  scaling: SettlementSheet['scaling'],
): Promise<SettlementSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.scaling = scaling;
  });
}
