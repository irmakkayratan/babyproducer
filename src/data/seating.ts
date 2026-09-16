/**
 * Seating persistence.
 *
 * A seat assignment lives in two places — the seat on the map and `seatId` on
 * the guest — so both are written in one transaction and can never disagree.
 */
import { db } from './db';
import type { SeatingMap } from './types';
import { syncBus } from '@/lib/syncBus';

const now = () => new Date().toISOString();

export async function getSeatingMap(eventId: string): Promise<SeatingMap | undefined> {
  return db.seatingMaps.where('eventId').equals(eventId).first();
}

export async function putSeatingMap(map: SeatingMap): Promise<SeatingMap> {
  const next = { ...map, updatedAt: now(), rev: map.rev + 1 };
  await db.seatingMaps.put(next);
  syncBus.post({ type: 'seating:changed', eventId: map.eventId, mapId: map.id });
  return next;
}

export async function assignSeat(
  mapId: string,
  seatId: string | null,
  guestId: string,
): Promise<SeatingMap | undefined> {
  return db.transaction('rw', [db.seatingMaps, db.guests], async () => {
    const map = await db.seatingMaps.get(mapId);
    if (!map) return undefined;

    const next: SeatingMap = {
      ...map,
      elements: map.elements.map((element) => {
        if (!('seats' in element)) return element;
        return {
          ...element,
          seats: element.seats.map((seat) => {
            // Clear any seat this guest already occupied, then set the new one.
            if (seat.guestId === guestId) return { ...seat, guestId: undefined };
            return seat;
          }),
        };
      }),
      updatedAt: now(),
      rev: map.rev + 1,
    };

    if (seatId) {
      for (const element of next.elements) {
        if (!('seats' in element)) continue;
        const seat = element.seats.find((candidate) => candidate.id === seatId);
        if (seat) {
          // A seat holds one guest: whoever was there is displaced.
          const displaced = seat.guestId;
          seat.guestId = guestId;
          if (displaced && displaced !== guestId) {
            await db.guests.get(displaced).then((guest) => {
              if (guest) db.guests.put({ ...guest, seatId: undefined, updatedAt: now(), rev: guest.rev + 1 });
            });
          }
          break;
        }
      }
    }

    await db.seatingMaps.put(next);
    const guest = await db.guests.get(guestId);
    if (guest) {
      await db.guests.put({ ...guest, seatId: seatId ?? undefined, updatedAt: now(), rev: guest.rev + 1 });
    }

    syncBus.post({ type: 'seating:changed', eventId: map.eventId, mapId: map.id });
    syncBus.post({ type: 'guest:changed', eventId: map.eventId, guestIds: [guestId] });
    return next;
  });
}

export async function clearSeat(mapId: string, seatId: string): Promise<SeatingMap | undefined> {
  return db.transaction('rw', [db.seatingMaps, db.guests], async () => {
    const map = await db.seatingMaps.get(mapId);
    if (!map) return undefined;

    let guestId: string | undefined;
    const next: SeatingMap = {
      ...map,
      elements: map.elements.map((element) => {
        if (!('seats' in element)) return element;
        return {
          ...element,
          seats: element.seats.map((seat) => {
            if (seat.id !== seatId) return seat;
            guestId = seat.guestId;
            return { ...seat, guestId: undefined };
          }),
        };
      }),
      updatedAt: now(),
      rev: map.rev + 1,
    };

    await db.seatingMaps.put(next);
    if (guestId) {
      const guest = await db.guests.get(guestId);
      if (guest) await db.guests.put({ ...guest, seatId: undefined, updatedAt: now(), rev: guest.rev + 1 });
      syncBus.post({ type: 'guest:changed', eventId: map.eventId, guestIds: [guestId] });
    }
    syncBus.post({ type: 'seating:changed', eventId: map.eventId, mapId: map.id });
    return next;
  });
}
