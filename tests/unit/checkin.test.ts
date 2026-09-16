import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { checkInGuest, createGuest, listArrivals, undoCheckIn } from '@/data/guests';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function guest(name = 'Front Row Guest') {
  return createGuest({ eventId: 'event-1', name });
}

describe('check-in', () => {
  it('records an arrival and moves the guest to the arrived status', async () => {
    const g = await guest();
    const result = await checkInGuest(g.id, { method: 'qr', arrivedStatusId: 'arrived' });

    expect(result.ok).toBe(true);
    expect(result.guest?.statusId).toBe('arrived');
    expect(await listArrivals('event-1')).toHaveLength(1);
  });

  it('refuses a second scan and reports when the guest actually arrived', async () => {
    const g = await guest();
    const first = await checkInGuest(g.id, { method: 'qr' });
    const second = await checkInGuest(g.id, { method: 'qr' });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.duplicate?.at).toBeDefined();
    expect(await listArrivals('event-1')).toHaveLength(1);
  });

  it('two desks scanning at the same moment produce exactly one arrival', async () => {
    const g = await guest();
    const results = await Promise.all([
      checkInGuest(g.id, { method: 'qr' }),
      checkInGuest(g.id, { method: 'qr' }),
      checkInGuest(g.id, { method: 'search' }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await listArrivals('event-1')).toHaveLength(1);
  });

  it('undo appends a tombstone instead of deleting history', async () => {
    const g = await guest();
    await checkInGuest(g.id, { method: 'qr', arrivedStatusId: 'arrived' });
    await undoCheckIn(g.id, 'event-1', 'confirmed');

    expect(await listArrivals('event-1')).toHaveLength(0);
    expect(await db.arrivals.where('guestId').equals(g.id).count()).toBe(1);
    expect((await db.guests.get(g.id))?.statusId).toBe('confirmed');

    // And the guest can be checked in again afterwards.
    expect((await checkInGuest(g.id, { method: 'search' })).ok).toBe(true);
  });

  it('carries the party size from plus-ones', async () => {
    const g = await createGuest({ eventId: 'event-1', name: 'Plus Two', plusOnes: 2 });
    await checkInGuest(g.id);
    const [arrival] = await listArrivals('event-1');
    expect(arrival.partySize).toBe(3);
  });
});
