import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createEvent, createWorkspace, deleteEvent } from '@/data/repo';
import {
  addAdvanceItem,
  addAdvanceParty,
  checklistForEvent,
  dueDateFor,
  ensureAdvanceSheet,
  getAdvanceSheet,
  instantiateChecklist,
  patchAdvanceItem,
  removeAdvanceParty,
} from '@/data/advancing';
import { getSettlement } from '@/data/settlement';
import type { AdvanceItem, AdvanceParty, Vocab } from '@/data/types';
import { groupBySection, isOverdue, itinerary, nextStatus, summarizeAdvance } from '@/modules/advancing/model';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const item = (over: Partial<AdvanceItem> = {}): AdvanceItem => ({
  id: over.id ?? 'i1',
  sectionId: 'schedule',
  label: 'Load-in',
  status: 'missing',
  required: false,
  updatedAt: '2027-01-01T00:00:00.000Z',
  ...over,
});

const NOW = Date.UTC(2027, 2, 1);
const day = (offset: number) => new Date(NOW + offset * 86_400_000).toISOString();

describe('checklist instantiation', () => {
  it('dates each entry against the event it belongs to', () => {
    expect(dueDateFor('2027-03-15T19:00:00.000Z', 7)).toBe('2027-03-08T19:00:00.000Z');
    expect(dueDateFor('2027-03-15T19:00:00.000Z', undefined)).toBeUndefined();
  });

  it('repeats a per-party entry once for every travelling party', () => {
    const parties: AdvanceParty[] = [
      { id: 'a', name: 'Headline', headcount: 9 },
      { id: 'b', name: 'Support', headcount: 4 },
    ];
    const items = instantiateChecklist(
      [
        { sectionId: 'travel', label: 'Inbound travel', perParty: true, dueDaysBefore: 14 },
        { sectionId: 'technical', label: 'Stage plot', required: true },
      ],
      parties,
      '2027-03-15T19:00:00.000Z',
    );

    expect(items.filter((row) => row.label === 'Inbound travel').map((row) => row.partyId)).toEqual(['a', 'b']);
    expect(items.find((row) => row.label === 'Stage plot')?.partyId).toBeUndefined();
    expect(items.every((row) => row.status === 'missing')).toBe(true);
  });

  it('still asks a per-party question when nobody is booked yet', () => {
    const items = instantiateChecklist([{ sectionId: 'stay', label: 'Hotel', perParty: true }], [], '2027-03-15T19:00:00.000Z');
    expect(items).toHaveLength(1);
    expect(items[0].partyId).toBeUndefined();
  });

  it('appends a template checklist to the neutral base', () => {
    const base = checklistForEvent('blank');
    const live = checklistForEvent('live-show');
    expect(live.length).toBeGreaterThan(base.length);
    expect(live.some((entry) => entry.label === 'Load-in time')).toBe(true);
    expect(live.some((entry) => entry.label === 'Soundcheck')).toBe(true);
  });
});

describe('readiness', () => {
  it('scores confirmed against everything that still applies', () => {
    const summary = summarizeAdvance(
      {
        items: [
          item({ id: '1', status: 'confirmed' }),
          item({ id: '2', status: 'confirmed' }),
          item({ id: '3', status: 'requested' }),
          item({ id: '4', status: 'missing' }),
          item({ id: '5', status: 'na' }),
        ],
      },
      NOW,
    );

    expect(summary.total).toBe(5);
    expect(summary.applicable).toBe(4);
    expect(summary.readiness).toBeCloseTo(0.5, 5);
  });

  it('treats an empty advance as complete rather than dividing by zero', () => {
    expect(summarizeAdvance({ items: [] }, NOW).readiness).toBe(1);
  });

  it('lists required open items as blockers, worst deadline first', () => {
    const summary = summarizeAdvance(
      {
        items: [
          item({ id: 'late', required: true, dueAt: day(4) }),
          item({ id: 'now', required: true, dueAt: day(-2) }),
          item({ id: 'done', required: true, status: 'confirmed', dueAt: day(-9) }),
          item({ id: 'optional', dueAt: day(-3) }),
        ],
      },
      NOW,
    );

    expect(summary.blockers.map((row) => row.id)).toEqual(['now', 'late']);
    // Overdue is every open item past its date, deepest in the past first.
    expect(summary.overdue.map((row) => row.id)).toEqual(['optional', 'now']);
  });

  it('never counts a confirmed or not-needed item as overdue', () => {
    expect(isOverdue(item({ status: 'confirmed', dueAt: day(-10) }), NOW)).toBe(false);
    expect(isOverdue(item({ status: 'na', dueAt: day(-10) }), NOW)).toBe(false);
    expect(isOverdue(item({ status: 'requested', dueAt: day(-1) }), NOW)).toBe(true);
  });

  it('flags what is due inside the window', () => {
    const summary = summarizeAdvance(
      { items: [item({ id: 'soon', dueAt: day(3) }), item({ id: 'far', dueAt: day(30) })] },
      NOW,
    );
    expect(summary.dueSoon.map((row) => row.id)).toEqual(['soon']);
  });

  it('cycles a status through the states a producer actually uses', () => {
    expect(nextStatus('missing')).toBe('requested');
    expect(nextStatus('requested')).toBe('confirmed');
    expect(nextStatus('na')).toBe('missing');
  });
});

describe('grouping', () => {
  const sections: Vocab[] = [
    { id: 'travel', label: 'Travel', order: 1 },
    { id: 'schedule', label: 'Schedule', order: 0 },
  ];

  it('orders groups by the workspace vocabulary and drops empty ones', () => {
    const groups = groupBySection([item({ id: '1', sectionId: 'travel' })], sections, NOW);
    expect(groups.map((group) => group.section.id)).toEqual(['travel']);
  });

  it('keeps items whose section has been renamed away', () => {
    const groups = groupBySection([item({ id: '1', sectionId: 'merch' })], sections, NOW);
    expect(groups.map((group) => group.section.id)).toEqual(['merch']);
    expect(groups[0].items).toHaveLength(1);
  });
});

describe('itinerary', () => {
  it('puts everything that happens at a time in the order it happens', () => {
    const items = [
      item({ id: 'hotel', logistics: { kind: 'stay', startsAt: day(1), endsAt: day(2) }, partyId: 'a' }),
      item({ id: 'flight', logistics: { kind: 'travel', startsAt: day(0) }, partyId: 'a' }),
      item({ id: 'undated' }),
      item({ id: 'other-party', logistics: { kind: 'travel', startsAt: day(0) }, partyId: 'b' }),
    ];

    expect(itinerary(items).map((entry) => entry.item.id)).toEqual(['flight', 'other-party', 'hotel']);
    expect(itinerary(items, 'a').map((entry) => entry.item.id)).toEqual(['flight', 'hotel']);
  });
});

describe('the sheet on disk', () => {
  async function makeEvent(templateId = 'live-show') {
    const workspace = await createWorkspace({ name: 'Test' });
    return createEvent({
      workspaceId: workspace.id,
      name: 'Tour Date',
      templateId,
      startsAt: '2027-03-15T19:00:00.000Z',
      capacity: 1200,
    });
  }

  it('is created with the event, alongside its settlement', async () => {
    const event = await makeEvent();
    const sheet = await getAdvanceSheet(event.id);
    expect(sheet?.items.length).toBeGreaterThan(20);
    expect(await getSettlement(event.id)).toBeDefined();
  });

  it('is rebuilt on demand for an event that predates the module', async () => {
    const event = await makeEvent();
    await db.advanceSheets.where('eventId').equals(event.id).delete();

    const rebuilt = await ensureAdvanceSheet(event);
    expect(rebuilt.items.length).toBeGreaterThan(0);
    expect((await getAdvanceSheet(event.id))?.id).toBe(rebuilt.id);
  });

  it('backfills the per-party questions when a party is added', async () => {
    const event = await makeEvent();
    const before = (await getAdvanceSheet(event.id))!.items.length;

    await addAdvanceParty(event.id, { name: 'Support', headcount: 4 }, checklistForEvent(event.templateId), event.startsAt);
    const after = await getAdvanceSheet(event.id);
    const party = after!.parties[0];

    expect(after!.items.length).toBeGreaterThan(before);
    expect(after!.items.some((row) => row.partyId === party.id && row.label === 'Inbound travel')).toBe(true);
  });

  it('takes a removed party\'s own items with it and leaves the shared ones', async () => {
    const event = await makeEvent();
    await addAdvanceParty(event.id, { name: 'Support' }, checklistForEvent(event.templateId), event.startsAt);
    const sheet = (await getAdvanceSheet(event.id))!;
    const partyId = sheet.parties[0].id;
    const shared = sheet.items.filter((row) => !row.partyId).length;

    await removeAdvanceParty(event.id, partyId);
    const after = (await getAdvanceSheet(event.id))!;

    expect(after.parties).toHaveLength(0);
    expect(after.items.some((row) => row.partyId === partyId)).toBe(false);
    expect(after.items.filter((row) => !row.partyId)).toHaveLength(shared);
  });

  it('records an answer against an item and bumps the revision', async () => {
    const event = await makeEvent();
    const sheet = (await getAdvanceSheet(event.id))!;
    const target = sheet.items[0];

    await patchAdvanceItem(event.id, target.id, { status: 'confirmed', detail: '14:00, dock 2' });
    const after = (await getAdvanceSheet(event.id))!;

    expect(after.items.find((row) => row.id === target.id)).toMatchObject({
      status: 'confirmed',
      detail: '14:00, dock 2',
    });
    expect(after.rev).toBe(sheet.rev + 1);
  });

  it('accepts an item the checklist never thought of', async () => {
    const event = await makeEvent();
    await addAdvanceItem(event.id, { sectionId: 'technical', label: 'Piano tuning', required: true });
    const after = await getAdvanceSheet(event.id);
    expect(after!.items.some((row) => row.label === 'Piano tuning')).toBe(true);
  });

  it('is deleted with its event', async () => {
    const event = await makeEvent();
    await deleteEvent(event.id);
    expect(await getAdvanceSheet(event.id)).toBeUndefined();
    expect(await getSettlement(event.id)).toBeUndefined();
  });
});
