import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { assignSeat, clearSeat, putSeatingMap } from '@/data/seating';
import { allSeats, seatCount } from '@/modules/seating/geometry';
import { buildPreset } from '@/data/seed/rooms';
import { assignmentBlocked, evaluateRules } from '@/modules/seating/rules';
import { createGuest } from '@/data/guests';
import type { Guest, SeatingMap } from '@/data/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function setup() {
  const map = buildPreset('runway', 'event-1')!;
  await db.seatingMaps.put(map);
  const a = await createGuest({ eventId: 'event-1', name: 'Guest A', tierId: 'a-list' });
  const b = await createGuest({ eventId: 'event-1', name: 'Guest B', tierId: 'press' });
  return { map, a, b };
}

describe('room presets', () => {
  it('builds a runway room with two banks of rows', () => {
    const map = buildPreset('runway', 'e1')!;
    expect(map.elements.some((element) => element.kind === 'runway')).toBe(true);
    expect(seatCount(map)).toBe(80);  // default house: 2 banks × 4 rows × 10
    expect(map.zones.map((zone) => zone.id)).toContain('front-row');
  });

  it('sizes the room to the event capacity', () => {
    const big = buildPreset('runway', 'e1', { capacity: 420 })!;
    expect(seatCount(big)).toBeGreaterThanOrEqual(420);
    expect(big.canvas.width).toBeGreaterThan(buildPreset('runway', 'e1')!.canvas.width);
  });

  it('builds theatre and banquet rooms', () => {
    expect(seatCount(buildPreset('theatre', 'e1')!)).toBeGreaterThan(90);
    expect(seatCount(buildPreset('banquet', 'e1')!)).toBe(96);
    expect(buildPreset('none', 'e1')).toBeNull();
  });

  it('positions round-table seats around the table', () => {
    const map = buildPreset('banquet', 'e1')!;
    const table = map.elements.find((element) => element.kind === 'table')!;
    const positions = allSeats({ ...map, elements: [table] });
    const xs = new Set(positions.map((position) => Math.round(position.x)));
    expect(xs.size).toBeGreaterThan(3);
  });
});

describe('assignment', () => {
  it('writes the seat and the guest together', async () => {
    const { map, a } = await setup();
    const seatId = allSeats(map)[0].seat.id;

    const next = await assignSeat(map.id, seatId, a.id);
    expect(allSeats(next!).find((position) => position.seat.id === seatId)?.seat.guestId).toBe(a.id);
    expect((await db.guests.get(a.id))?.seatId).toBe(seatId);
  });

  it('moving a guest frees their previous seat', async () => {
    const { map, a } = await setup();
    const [first, second] = allSeats(map);

    await assignSeat(map.id, first.seat.id, a.id);
    const next = await assignSeat(map.id, second.seat.id, a.id);

    const seats = allSeats(next!);
    expect(seats.find((position) => position.seat.id === first.seat.id)?.seat.guestId).toBeUndefined();
    expect(seats.find((position) => position.seat.id === second.seat.id)?.seat.guestId).toBe(a.id);
  });

  it('seating onto an occupied seat displaces the previous guest cleanly', async () => {
    const { map, a, b } = await setup();
    const seatId = allSeats(map)[0].seat.id;

    await assignSeat(map.id, seatId, a.id);
    await assignSeat(map.id, seatId, b.id);

    expect((await db.guests.get(a.id))?.seatId).toBeUndefined();
    expect((await db.guests.get(b.id))?.seatId).toBe(seatId);
  });

  it('clears a seat from both sides', async () => {
    const { map, a } = await setup();
    const seatId = allSeats(map)[0].seat.id;
    await assignSeat(map.id, seatId, a.id);
    await clearSeat(map.id, seatId);

    expect((await db.guests.get(a.id))?.seatId).toBeUndefined();
    const stored = await db.seatingMaps.get(map.id);
    expect(allSeats(stored!).find((position) => position.seat.id === seatId)?.seat.guestId).toBeUndefined();
  });
});

describe('rules', () => {
  function seatGuests(map: SeatingMap, pairs: Array<[number, string]>): SeatingMap {
    const positions = allSeats(map);
    const assigned = new Map(pairs.map(([index, guestId]) => [positions[index].seat.id, guestId]));
    return {
      ...map,
      elements: map.elements.map((element) =>
        'seats' in element
          ? { ...element, seats: element.seats.map((seat) => ({ ...seat, guestId: assigned.get(seat.id) })) }
          : element,
      ),
    };
  }

  const guest = (id: string, tierId: string): Guest => ({
    id,
    eventId: 'e1',
    name: id,
    tierId,
    statusId: 'confirmed',
    plusOnes: 0,
    tags: [],
    fields: {},
    qrToken: 't',
    createdAt: '2027-01-01T00:00:00.000Z',
    updatedAt: '2027-01-01T00:00:00.000Z',
    rev: 1,
  });

  it('flags two guests who must not sit near each other', () => {
    const base = buildPreset('runway', 'e1')!;
    base.rules = [{ id: 'r1', type: 'keep-apart', subjects: ['x', 'y'], severity: 'warn', label: 'Keep apart' }];
    const map = seatGuests(base, [[0, 'x'], [1, 'y']]);
    const violations = evaluateRules(map, [guest('x', 'a-list'), guest('y', 'press')]);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toBe('Keep apart');
  });

  it('is satisfied when they are far apart', () => {
    const base = buildPreset('runway', 'e1')!;
    base.rules = [{ id: 'r1', type: 'keep-apart', subjects: ['x', 'y'], severity: 'warn' }];
    const positions = allSeats(base);
    const farIndex = positions.findIndex(
      (position) => Math.hypot(position.x - positions[0].x, position.y - positions[0].y) > 300,
    );
    const map = seatGuests(base, [[0, 'x'], [farIndex, 'y']]);
    expect(evaluateRules(map, [guest('x', 'a-list'), guest('y', 'press')])).toHaveLength(0);
  });

  it('flags a guest of the wrong tier in a reserved zone', () => {
    const base = buildPreset('runway', 'e1')!;
    base.rules = [
      { id: 'r2', type: 'tier-in-zone', subjects: [], tierId: 'a-list', zoneId: 'front-row', severity: 'warn' },
    ];
    const frontRowIndex = allSeats(base).findIndex((position) => position.element.zoneId === 'front-row');
    const map = seatGuests(base, [[frontRowIndex, 'y']]);
    expect(evaluateRules(map, [guest('y', 'press')])).toHaveLength(1);
    expect(evaluateRules(map, [guest('y', 'a-list')])).toHaveLength(0);
  });

  it('a warn rule never blocks the producer, a block rule does', () => {
    const base = buildPreset('runway', 'e1')!;
    const positions = allSeats(base);
    const frontRow = positions.find((position) => position.element.zoneId === 'front-row')!;

    base.rules = [
      { id: 'r3', type: 'tier-in-zone', subjects: [], tierId: 'a-list', zoneId: 'front-row', severity: 'warn' },
    ];
    expect(assignmentBlocked(base, [guest('y', 'press')], frontRow.seat.id, 'y')).toBeNull();

    base.rules[0].severity = 'block';
    expect(assignmentBlocked(base, [guest('y', 'press')], frontRow.seat.id, 'y')).not.toBeNull();
  });

  it('flags a table over its limit', () => {
    const base = buildPreset('banquet', 'e1')!;
    base.rules = [{ id: 'r4', type: 'max-per-table', subjects: [], limit: 2, severity: 'warn' }];
    const map = seatGuests(base, [[0, 'a'], [1, 'b'], [2, 'c']]);
    const violations = evaluateRules(map, [guest('a', 't'), guest('b', 't'), guest('c', 't')]);
    expect(violations).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('bumps the revision on every save', async () => {
    const map = buildPreset('theatre', 'e1')!;
    await db.seatingMaps.put(map);
    const saved = await putSeatingMap(map);
    expect(saved.rev).toBe(map.rev + 1);
  });
});
