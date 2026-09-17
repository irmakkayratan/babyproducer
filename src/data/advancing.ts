/**
 * Advance sheets: the pre-production record.
 *
 * One row per event holding parties, contacts and the checklist. The whole
 * sheet is read-modify-written on every change. That matches what an advance
 * really is, which is one document several people edit over a few weeks, and
 * it keeps a party rename from having to touch twenty item rows.
 */
import { db } from './db';
import { defaultAdvanceChecklist } from './defaults';
import { getTemplate } from './templates';
import type {
  AdvanceChecklistEntry,
  AdvanceContact,
  AdvanceItem,
  AdvanceParty,
  AdvanceSheet,
  Event,
} from './types';
import { ulid } from '@/lib/id';

const now = () => new Date().toISOString();

/** A checklist entry's deadline, expressed against the event it belongs to. */
export function dueDateFor(startsAt: string, daysBefore?: number): string | undefined {
  if (daysBefore == null) return undefined;
  return new Date(new Date(startsAt).getTime() - daysBefore * 86_400_000).toISOString();
}

/**
 * Expands checklist entries into items. A `perParty` entry becomes one item per
 * travelling party, and still one unassigned item when there are no parties
 * yet, because the question does not disappear just because nobody is booked.
 */
export function instantiateChecklist(
  entries: AdvanceChecklistEntry[],
  parties: AdvanceParty[],
  startsAt: string,
  makeId: () => string = ulid,
): AdvanceItem[] {
  const stamp = now();
  const items: AdvanceItem[] = [];

  for (const entry of entries) {
    const targets: Array<AdvanceParty | undefined> = entry.perParty && parties.length ? parties : [undefined];
    for (const party of targets) {
      items.push({
        id: makeId(),
        sectionId: entry.sectionId,
        partyId: party?.id,
        label: entry.label,
        status: 'missing',
        required: entry.required ?? false,
        owner: entry.owner,
        dueAt: dueDateFor(startsAt, entry.dueDaysBefore),
        logistics: entry.logisticsKind ? { kind: entry.logisticsKind } : undefined,
        updatedAt: stamp,
      });
    }
  }
  return items;
}

/** The checklist a given event starts from: the neutral base plus its template. */
export function checklistForEvent(templateId?: string): AdvanceChecklistEntry[] {
  const template = getTemplate(templateId ?? 'blank');
  return [...defaultAdvanceChecklist(), ...(template.advanceChecklist ?? [])];
}

export function buildAdvanceSheet(
  event: Pick<Event, 'id' | 'startsAt' | 'templateId'>,
  parties: AdvanceParty[] = [],
  makeId: () => string = ulid,
): AdvanceSheet {
  const stamp = now();
  return {
    id: makeId(),
    eventId: event.id,
    parties,
    contacts: [],
    items: instantiateChecklist(checklistForEvent(event.templateId), parties, event.startsAt, makeId),
    createdAt: stamp,
    updatedAt: stamp,
    rev: 1,
  };
}

/* ------------------------------------------------------------------ reads */

export async function getAdvanceSheet(eventId: string): Promise<AdvanceSheet | undefined> {
  return db.advanceSheets.where('eventId').equals(eventId).first();
}

/**
 * Events created before this module existed, or imported from an older export,
 * have no sheet. Opening the module builds one, so nobody lands on an empty
 * screen that looks broken.
 */
export async function ensureAdvanceSheet(event: Event): Promise<AdvanceSheet> {
  const existing = await getAdvanceSheet(event.id);
  if (existing) return existing;
  const sheet = buildAdvanceSheet(event);
  await db.advanceSheets.put(sheet);
  return sheet;
}

/* ----------------------------------------------------------------- writes */

async function mutate(
  eventId: string,
  fn: (sheet: AdvanceSheet) => AdvanceSheet | void,
): Promise<AdvanceSheet | undefined> {
  const sheet = await getAdvanceSheet(eventId);
  if (!sheet) return undefined;
  const draft: AdvanceSheet = structuredClone(sheet);
  const next = (fn(draft) ?? draft) as AdvanceSheet;
  next.updatedAt = now();
  next.rev = sheet.rev + 1;
  await db.advanceSheets.put(next);
  return next;
}

export async function updateAdvanceSheet(
  eventId: string,
  patch: Partial<Pick<AdvanceSheet, 'notes' | 'sentAt' | 'parties' | 'contacts' | 'items'>>,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => Object.assign(sheet, patch));
}

export async function patchAdvanceItem(
  eventId: string,
  itemId: string,
  patch: Partial<Omit<AdvanceItem, 'id'>>,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const item = sheet.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    Object.assign(item, patch, { updatedAt: now() });
  });
}

export async function addAdvanceItem(
  eventId: string,
  input: Partial<AdvanceItem> & Pick<AdvanceItem, 'sectionId' | 'label'>,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.items.push({
      id: ulid(),
      status: 'missing',
      required: false,
      ...input,
      updatedAt: now(),
    });
  });
}

export async function removeAdvanceItem(eventId: string, itemId: string): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.items = sheet.items.filter((item) => item.id !== itemId);
  });
}

/**
 * Adding a party backfills the per-party questions for it, so a support act
 * added a week out inherits the same travel, hotel and transfer lines the
 * headline party already has.
 */
export async function addAdvanceParty(
  eventId: string,
  input: Partial<AdvanceParty> & Pick<AdvanceParty, 'name'>,
  checklist?: AdvanceChecklistEntry[],
  startsAt?: string,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const party: AdvanceParty = { id: ulid(), headcount: 1, ...input };
    sheet.parties.push(party);
    const perParty = (checklist ?? []).filter((entry) => entry.perParty);
    if (perParty.length && startsAt) {
      sheet.items.push(...instantiateChecklist(perParty, [party], startsAt));
    }
  });
}

export async function updateAdvanceParty(
  eventId: string,
  partyId: string,
  patch: Partial<Omit<AdvanceParty, 'id'>>,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const party = sheet.parties.find((candidate) => candidate.id === partyId);
    if (party) Object.assign(party, patch);
  });
}

/** Removing a party takes its own items with it; shared items are untouched. */
export async function removeAdvanceParty(eventId: string, partyId: string): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.parties = sheet.parties.filter((party) => party.id !== partyId);
    sheet.items = sheet.items.filter((item) => item.partyId !== partyId);
  });
}

export async function addAdvanceContact(
  eventId: string,
  input: Partial<AdvanceContact> & Pick<AdvanceContact, 'name'>,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.contacts.push({ id: ulid(), ...input });
  });
}

export async function updateAdvanceContact(
  eventId: string,
  contactId: string,
  patch: Partial<Omit<AdvanceContact, 'id'>>,
): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    const contact = sheet.contacts.find((candidate) => candidate.id === contactId);
    if (contact) Object.assign(contact, patch);
  });
}

export async function removeAdvanceContact(eventId: string, contactId: string): Promise<AdvanceSheet | undefined> {
  return mutate(eventId, (sheet) => {
    sheet.contacts = sheet.contacts.filter((contact) => contact.id !== contactId);
  });
}
