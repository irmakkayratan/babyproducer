/**
 * Advance readiness.
 *
 * The advance's whole job is to answer one question — what is still open, and
 * which of it matters — so that is what this file computes. Everything is
 * derived from the items on the sheet; nothing is stored.
 */
import type { AdvanceItem, AdvanceParty, AdvanceSheet, AdvanceStatus, Vocab } from '@/data/types';

export const STATUS_LABEL: Record<AdvanceStatus, string> = {
  missing: 'Missing',
  requested: 'Requested',
  confirmed: 'Confirmed',
  na: 'Not needed',
};

/** Cycling a status is the fastest interaction on the page, so it is ordered. */
export const STATUS_CYCLE: AdvanceStatus[] = ['missing', 'requested', 'confirmed', 'na'];

export function nextStatus(status: AdvanceStatus): AdvanceStatus {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
}

/** An item that still owes an answer. `na` is an answer: it does not apply. */
export function isOpen(item: AdvanceItem): boolean {
  return item.status !== 'confirmed' && item.status !== 'na';
}

export function isOverdue(item: AdvanceItem, now: number): boolean {
  return isOpen(item) && item.dueAt != null && new Date(item.dueAt).getTime() < now;
}

export interface AdvanceSummary {
  total: number;
  /** Items that still have to land — `na` is excluded from the denominator. */
  applicable: number;
  confirmed: number;
  requested: number;
  missing: number;
  notNeeded: number;
  /** 0–1. An advance with nothing on it is complete, not divided by zero. */
  readiness: number;
  /** Required and still open, worst deadline first: the actual to-do list. */
  blockers: AdvanceItem[];
  overdue: AdvanceItem[];
  /** Open items due inside the window, in days (default a week). */
  dueSoon: AdvanceItem[];
}

export function summarizeAdvance(
  sheet: Pick<AdvanceSheet, 'items'>,
  now: number = Date.now(),
  soonDays = 7,
): AdvanceSummary {
  const items = sheet.items;
  const counts = { confirmed: 0, requested: 0, missing: 0, na: 0 } as Record<AdvanceStatus, number>;
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;

  const applicable = items.length - counts.na;
  const open = items.filter(isOpen);
  const soonLimit = now + soonDays * 86_400_000;

  return {
    total: items.length,
    applicable,
    confirmed: counts.confirmed,
    requested: counts.requested,
    missing: counts.missing,
    notNeeded: counts.na,
    readiness: applicable === 0 ? 1 : counts.confirmed / applicable,
    blockers: open.filter((item) => item.required).sort(byDeadline),
    overdue: open.filter((item) => isOverdue(item, now)).sort(byDeadline),
    dueSoon: open
      .filter((item) => item.dueAt != null && new Date(item.dueAt).getTime() <= soonLimit)
      .sort(byDeadline),
  };
}

/** Undated items sort last: a deadline is information, its absence is not. */
function byDeadline(a: AdvanceItem, b: AdvanceItem): number {
  if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return a.label.localeCompare(b.label);
}

export interface AdvanceSectionGroup {
  section: Vocab;
  items: AdvanceItem[];
  summary: AdvanceSummary;
}

/**
 * Groups items under the workspace's section vocabulary. Items pointing at a
 * section that has since been renamed away keep their own heading rather than
 * vanishing — losing a line off an advance is not an acceptable failure mode.
 */
export function groupBySection(
  items: AdvanceItem[],
  sections: Vocab[],
  now: number = Date.now(),
): AdvanceSectionGroup[] {
  const known = new Map(sections.map((section) => [section.id, section]));
  const buckets = new Map<string, AdvanceItem[]>();
  for (const section of sections) buckets.set(section.id, []);
  for (const item of items) {
    const bucket = buckets.get(item.sectionId);
    if (bucket) bucket.push(item);
    else buckets.set(item.sectionId, [item]);
  }

  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.length > 0)
    .map(([sectionId, bucket], index) => ({
      section: known.get(sectionId) ?? { id: sectionId, label: sectionId, order: 900 + index },
      items: [...bucket].sort(byDeadline),
      summary: summarizeAdvance({ items: bucket }, now),
    }))
    .sort((a, b) => a.section.order - b.section.order);
}

export interface ItineraryEntry {
  item: AdvanceItem;
  at: string;
  /** `endsAt` where the item covers a span — a hotel stay, a rehearsal. */
  until?: string;
}

/**
 * Everything on the sheet that happens at a time, in the order it happens.
 * This is the day sheet: flights, hotels, transfers and calls on one spine.
 */
export function itinerary(items: AdvanceItem[], partyId?: string): ItineraryEntry[] {
  return items
    .filter((item) => (partyId ? item.partyId === partyId || !item.partyId : true))
    .filter((item) => item.logistics?.startsAt)
    .map((item) => ({
      item,
      at: item.logistics!.startsAt!,
      until: item.logistics!.endsAt,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function partyName(parties: AdvanceParty[], partyId?: string): string | undefined {
  return partyId ? parties.find((party) => party.id === partyId)?.name : undefined;
}

/** Headcount the venue has to feed, seat and badge. */
export function totalHeadcount(parties: AdvanceParty[]): number {
  return parties.reduce((sum, party) => sum + (Number.isFinite(party.headcount) ? party.headcount : 0), 0);
}

/* -------------------------------------------------------------- exporting */

export function advanceCsvRows(
  sheet: AdvanceSheet,
  sectionLabel: (id: string) => string,
): Array<Record<string, string | number>> {
  return sheet.items.map((item) => ({
    Section: sectionLabel(item.sectionId),
    Item: item.label,
    Party: partyName(sheet.parties, item.partyId) ?? '',
    Status: STATUS_LABEL[item.status],
    Required: item.required ? 'yes' : 'no',
    Owner: item.owner ?? '',
    Due: item.dueAt ? item.dueAt.slice(0, 10) : '',
    Detail: item.detail ?? '',
    Reference: item.logistics?.reference ?? '',
    Starts: item.logistics?.startsAt ?? '',
    Ends: item.logistics?.endsAt ?? '',
    Notes: item.notes ?? '',
  }));
}
