/**
 * Guest and arrival persistence.
 *
 * Arrivals are append-only. An undo writes a new record and deletes nothing,
 * and the current state is a reduction over the log. That is what makes
 * two registration desks scanning at the same moment safe.
 */
import { db } from './db';
import type { Arrival, Guest, Vocab } from './types';
import { deviceId, qrToken, ulid } from '@/lib/id';
import { syncBus } from '@/lib/syncBus';

const now = () => new Date().toISOString();

export async function listGuests(eventId: string): Promise<Guest[]> {
  return db.guests.where('eventId').equals(eventId).toArray();
}

export async function getGuest(id: string): Promise<Guest | undefined> {
  return db.guests.get(id);
}

export async function updateGuest(id: string, patch: Partial<Omit<Guest, 'id'>>): Promise<Guest | undefined> {
  const existing = await db.guests.get(id);
  if (!existing) return undefined;
  const next: Guest = { ...existing, ...patch, updatedAt: now(), rev: existing.rev + 1 };
  await db.guests.put(next);
  syncBus.post({ type: 'guest:changed', eventId: next.eventId, guestIds: [id] });
  return next;
}

export async function bulkUpdateGuests(
  ids: string[],
  patch: Partial<Omit<Guest, 'id'>>,
): Promise<void> {
  if (ids.length === 0) return;
  const guests = await db.guests.bulkGet(ids);
  const updated = guests
    .filter((guest): guest is Guest => Boolean(guest))
    .map((guest) => ({ ...guest, ...patch, updatedAt: now(), rev: guest.rev + 1 }));
  await db.guests.bulkPut(updated);
  if (updated[0]) {
    syncBus.post({ type: 'guest:changed', eventId: updated[0].eventId, guestIds: ids });
  }
}

export async function createGuest(input: Partial<Guest> & { eventId: string; name: string }): Promise<Guest> {
  const iso = now();
  const guest: Guest = {
    id: ulid(),
    plusOnes: 0,
    statusId: 'invited',
    tags: [],
    fields: {},
    qrToken: qrToken(),
    createdAt: iso,
    updatedAt: iso,
    rev: 1,
    ...input,
  };
  await db.guests.put(guest);
  syncBus.post({ type: 'guest:changed', eventId: guest.eventId, guestIds: [guest.id] });
  return guest;
}

export async function deleteGuests(ids: string[], eventId: string): Promise<void> {
  await db.guests.bulkDelete(ids);
  syncBus.post({ type: 'guest:changed', eventId, guestIds: ids });
}

/* ---------------------------------------------------------------- arrivals */

export interface CheckInResult {
  ok: boolean;
  duplicate?: { at: string };
  guest?: Guest;
}

/**
 * Check a guest in.
 *
 * The duplicate check reads inside the write transaction and not from the
 * in-memory store. Two desks scanning the same badge at the same moment then
 * produce one arrival and one honest warning, instead of two arrivals or a
 * lost one.
 */
export async function checkInGuest(
  guestId: string,
  options: { method?: Arrival['method']; partySize?: number; arrivedStatusId?: string } = {},
): Promise<CheckInResult> {
  return db.transaction('rw', [db.guests, db.arrivals], async () => {
    const guest = await db.guests.get(guestId);
    if (!guest) return { ok: false };

    const priorArrivals = await db.arrivals.where('[eventId+guestId]').equals([guest.eventId, guestId]).toArray();
    const active = priorArrivals.filter((arrival) => !arrival.undone);
    if (active.length > 0) {
      const first = active.reduce((earliest, arrival) => (arrival.at < earliest.at ? arrival : earliest));
      return { ok: false, duplicate: { at: first.at }, guest };
    }

    const at = now();
    await db.arrivals.put({
      id: ulid(),
      eventId: guest.eventId,
      guestId,
      at,
      method: options.method ?? 'manual',
      deviceId: deviceId(),
      partySize: options.partySize ?? 1 + guest.plusOnes,
    });

    const updated: Guest = {
      ...guest,
      statusId: options.arrivedStatusId ?? guest.statusId,
      updatedAt: at,
      rev: guest.rev + 1,
    };
    await db.guests.put(updated);
    syncBus.post({ type: 'guest:checked-in', eventId: guest.eventId, guestId, at });
    return { ok: true, guest: updated };
  });
}

/** Undo appends a tombstone. History is never deleted. */
export async function undoCheckIn(guestId: string, eventId: string, previousStatusId?: string): Promise<void> {
  await db.transaction('rw', [db.guests, db.arrivals], async () => {
    const arrivals = await db.arrivals.where('[eventId+guestId]').equals([eventId, guestId]).toArray();
    await db.arrivals.bulkPut(arrivals.filter((a) => !a.undone).map((a) => ({ ...a, undone: true })));
    if (previousStatusId) {
      const guest = await db.guests.get(guestId);
      if (guest) {
        await db.guests.put({ ...guest, statusId: previousStatusId, updatedAt: now(), rev: guest.rev + 1 });
      }
    }
  });
  syncBus.post({ type: 'guest:changed', eventId, guestIds: [guestId] });
}

export async function listArrivals(eventId: string): Promise<Arrival[]> {
  const arrivals = await db.arrivals.where('eventId').equals(eventId).toArray();
  return arrivals.filter((arrival) => !arrival.undone).sort((a, b) => a.at.localeCompare(b.at));
}

export async function arrivedGuestIds(eventId: string): Promise<Set<string>> {
  const arrivals = await listArrivals(eventId);
  return new Set(arrivals.map((arrival) => arrival.guestId));
}

/** The status a workspace considers "in the room", with a sensible fallback. */
export function arrivedStatus(statuses: Vocab[]): string | undefined {
  return (statuses.find((status) => status.meansArrived) ?? statuses.find((s) => s.id === 'arrived'))?.id;
}
