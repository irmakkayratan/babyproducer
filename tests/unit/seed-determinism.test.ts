import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { seedDemoWorkspace } from '@/data/seed/generate';
import { SCENARIOS } from '@/data/seed/scenarios';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function snapshot() {
  const guests = await db.guests.toArray();
  const seating = await db.seatingMaps.toArray();
  return {
    // Ids included on purpose: identical values in a different order is not
    // the same demo, and ordering is what a reader actually sees.
    guests: guests.map((guest) => `${guest.id}|${guest.name}|${guest.tierId}|${guest.audience?.followers}`),
    seats: seating.flatMap((map) =>
      map.elements.flatMap((element) => ('seats' in element ? element.seats.map((seat) => `${seat.id}|${seat.guestId ?? ''}`) : [])),
    ),
  };
}

describe('demo determinism', () => {
  it('rebuilds identical records from the same seed', async () => {
    await seedDemoWorkspace();
    const first = await snapshot();

    await seedDemoWorkspace();
    const second = await snapshot();

    expect(second.guests).toEqual(first.guests);
    expect(second.seats).toEqual(first.seats);
  }, 30_000);

  it('produces the expected shape for every scenario', async () => {
    await seedDemoWorkspace();
    const events = await db.events.toArray();
    expect(events).toHaveLength(SCENARIOS.length);

    for (const spec of SCENARIOS) {
      const event = events.find((candidate) => candidate.name === spec.name);
      expect(event, `missing event for ${spec.id}`).toBeDefined();
      const guests = await db.guests.where('eventId').equals(event!.id).toArray();
      expect(guests).toHaveLength(spec.guests.count);
      expect(guests.every((guest) => guest.qrToken.length > 0)).toBe(true);
      expect(await db.telemetry.where('eventId').equals(event!.id).count()).toBeGreaterThan(0);
    }
  }, 30_000);

  it('gives past events arrivals and upcoming events none', async () => {
    await seedDemoWorkspace();
    const events = await db.events.toArray();
    for (const event of events) {
      const arrivals = await db.arrivals.where('eventId').equals(event.id).count();
      const isPast = new Date(event.endsAt).getTime() < Date.now();
      expect(arrivals > 0, `${event.name} arrivals`).toBe(isPast);
    }
  }, 30_000);

  it('only ever flags the demo workspace as demo data', async () => {
    await seedDemoWorkspace();
    const workspaces = await db.workspaces.toArray();
    expect(workspaces.filter((workspace) => workspace.demo)).toHaveLength(1);
  }, 30_000);
});
