/**
 * Demo advance sheets.
 *
 * A finished advance is boring; an advance in progress is the one worth
 * showing. Statuses here are drawn against each item's own deadline, so a show
 * twelve days out has most of its early questions answered, a couple of things
 * chasing, and one or two lines properly late, which is exactly the state the
 * module exists to make visible.
 */
import { checklistForEvent, instantiateChecklist } from '@/data/advancing';
import type { AdvanceItem, AdvanceParty, AdvanceSheet, Event } from '@/data/types';
import type { Rng } from '@/lib/rng';
import type { ScenarioSpec } from './scenarios';

const AIRLINES = [
  ['KLM', 'KL'],
  ['Air France', 'AF'],
  ['Lufthansa', 'LH'],
  ['British Airways', 'BA'],
  ['SAS', 'SK'],
] as const;

const HOTELS = [
  'Hotel Mercier',
  'The Standard',
  'Kimpton De Witt',
  'Hôtel National',
  'Nobis Hotel',
  'The Hoxton',
];

const CAR_FIRMS = ['Blacklane', 'Citycars', 'Gerrits Transport', 'Prestige Cars'];

/** Schedule items key off doors: a show day is built backwards from them. */
const SCHEDULE_OFFSET_HOURS: Record<string, { start: number; end?: number }> = {
  'Load-in time': { start: -8 },
  'Rehearsal / line check': { start: -4.5 },
  Soundcheck: { start: -3.5, end: -2 },
  'Line check window': { start: -2.5, end: -1 },
  Doors: { start: 0 },
  'Start time': { start: 1 },
  'Set times published': { start: 1 },
  'Changeover window between acts': { start: 2, end: 2.25 },
  'Changeover between DJs': { start: 2, end: 2.25 },
  'Headline set time': { start: 3 },
  'Hard out / curfew': { start: 5 },
  'Hard stop and noise curfew': { start: 5 },
  'Bus call': { start: 6 },
};

const GENERIC_ANSWERS = [
  'Confirmed by email',
  'Signed and returned',
  'Agreed on the call',
  'Locked with the venue',
  'Sent to the tour manager',
];

function offsetIso(base: Date, hours: number): string {
  return new Date(base.getTime() + hours * 3_600_000).toISOString();
}

/**
 * Decides where an item has got to. Past events are settled; upcoming ones are
 * judged against the item's deadline and the scenario's confidence.
 */
function drawStatus(item: AdvanceItem, now: number, confidence: number, rng: Rng): AdvanceItem['status'] {
  if (rng.bool(0.04)) return 'na';

  const due = item.dueAt ? new Date(item.dueAt).getTime() : now + 30 * 86_400_000;
  const daysLeft = (due - now) / 86_400_000;

  // A deadline that has passed usually means the item is done, though not
  // always. The exceptions are the whole point of the "still missing" panel.
  const confirmChance =
    daysLeft < 0 ? 0.55 + confidence * 0.42 : daysLeft < 7 ? confidence * 0.8 : confidence * 0.45;

  if (rng.bool(confirmChance)) return 'confirmed';
  return rng.bool(0.55) ? 'requested' : 'missing';
}

/** Fills in the answer an item would carry once it has been chased down. */
function answerItem(
  item: AdvanceItem,
  party: AdvanceParty | undefined,
  doors: Date,
  start: Date,
  venue: string,
  rng: Rng,
): void {
  const kind = item.logistics?.kind;
  const headcount = party?.headcount ?? 1;

  if (kind === 'schedule') {
    const offset = SCHEDULE_OFFSET_HOURS[item.label];
    if (offset) {
      item.logistics = {
        kind: 'schedule',
        startsAt: offsetIso(doors, offset.start),
        endsAt: offset.end != null ? offsetIso(doors, offset.end) : undefined,
      };
      item.detail = new Date(item.logistics.startsAt!).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return;
    }
  }

  if (kind === 'travel') {
    const [carrier, code] = rng.pick(AIRLINES);
    const inbound = item.label.toLowerCase().includes('inbound');
    const departs = offsetIso(start, inbound ? -rng.int(20, 30) : rng.int(14, 20));
    item.logistics = {
      kind: 'travel',
      provider: carrier,
      reference: `${code}${rng.int(1000, 1999)}`,
      from: inbound ? rng.pick(['LHR', 'CDG', 'BER', 'ARN']) : venue,
      to: inbound ? venue : rng.pick(['LHR', 'CDG', 'BER', 'ARN']),
      startsAt: departs,
      endsAt: offsetIso(new Date(departs), rng.int(1, 3)),
      quantity: headcount,
      unit: 'seats',
    };
    item.detail = `${item.logistics.provider} ${item.logistics.reference}, ${headcount} pax`;
    return;
  }

  if (kind === 'stay') {
    const rooms = Math.max(1, Math.ceil(headcount / 1.6));
    item.logistics = {
      kind: 'stay',
      provider: rng.pick(HOTELS),
      reference: `CNF-${rng.int(100_000, 999_999)}`,
      startsAt: offsetIso(doors, -rng.int(20, 28)),
      endsAt: offsetIso(doors, rng.int(14, 20)),
      quantity: rooms,
      unit: 'rooms',
    };
    item.detail = `${item.logistics.provider}, ${rooms} rooms`;
    return;
  }

  if (kind === 'transfer') {
    const arrival = item.label.toLowerCase().includes('arrival');
    item.logistics = {
      kind: 'transfer',
      provider: rng.pick(CAR_FIRMS),
      from: arrival ? 'Airport' : 'Hotel',
      to: arrival ? 'Hotel' : venue,
      startsAt: offsetIso(doors, arrival ? -rng.int(18, 24) : -rng.int(5, 9)),
      quantity: headcount,
      unit: 'seats',
    };
    item.detail = `${item.logistics.provider}, ${item.logistics.from} → ${item.logistics.to}`;
    return;
  }

  if (kind === 'spec') {
    const quantity = item.label.toLowerCase().includes('crew') ? rng.int(6, 14) : headcount;
    item.logistics = { kind: 'spec', quantity, unit: 'people' };
    item.detail = `${quantity}`;
    return;
  }

  item.detail = rng.pick(GENERIC_ANSWERS);
}

export function generateAdvanceSheet(
  spec: ScenarioSpec,
  event: Event,
  doors: Date,
  rng: Rng,
  makeId: () => string,
  now: number,
): AdvanceSheet {
  const advance = spec.advance;
  const parties: AdvanceParty[] = (advance?.parties ?? []).map((party) => ({ id: makeId(), ...party }));
  const items = instantiateChecklist(checklistForEvent(event.templateId), parties, event.startsAt, makeId);
  const confidence = advance?.confidence ?? 0.5;
  const start = new Date(event.startsAt);

  for (const item of items) {
    item.status = drawStatus(item, now, confidence, rng);
    if (item.status === 'confirmed' || (item.status === 'requested' && rng.bool(0.4))) {
      answerItem(item, parties.find((party) => party.id === item.partyId), doors, start, spec.venue.name, rng);
    }
    if (item.owner == null) {
      item.owner = rng.pick(['Venue', 'Production', 'Tour', 'Promoter']);
    }
  }

  const iso = new Date(start.getTime() - 30 * 86_400_000).toISOString();
  return {
    id: makeId(),
    eventId: event.id,
    parties,
    contacts: (advance?.contacts ?? []).map((contact) => ({ id: makeId(), ...contact })),
    items,
    createdAt: iso,
    updatedAt: iso,
    rev: 1,
  };
}
