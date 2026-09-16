/**
 * Local database.
 *
 * The device holds the primary copy of the data: every read and write in the
 * app hits IndexedDB, never the network. Schema versions are additive and each
 * upgrade is tested against a fixture of the previous version — a migration
 * that silently drops a live guest list is the worst failure this app can have.
 */
import Dexie, { type Table } from 'dexie';
import type {
  Arrival,
  Asset,
  Company,
  Dashboard,
  Event,
  EventTemplate,
  Guest,
  SavedView,
  SeatingMap,
  TelemetrySeries,
  Workspace,
} from './types';

export interface RundownDoc {
  eventId: string;
  update: Uint8Array; // Yjs state vector — the rundown's source of truth
  updatedAt: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export const SCHEMA_VERSION = 1;

export class AtelierDb extends Dexie {
  workspaces!: Table<Workspace, string>;
  events!: Table<Event, string>;
  guests!: Table<Guest, string>;
  companies!: Table<Company, string>;
  seatingMaps!: Table<SeatingMap, string>;
  arrivals!: Table<Arrival, string>;
  telemetry!: Table<TelemetrySeries, string>;
  dashboards!: Table<Dashboard, string>;
  assets!: Table<Asset, string>;
  rundowns!: Table<RundownDoc, string>;
  templates!: Table<EventTemplate, string>;
  views!: Table<SavedView, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = 'atelier') {
    super(name);
    this.version(1).stores({
      workspaces: 'id, name, demo',
      events: 'id, workspaceId, startsAt, statusId, [workspaceId+startsAt]',
      guests: 'id, eventId, statusId, tierId, voiceId, name, seatId, *tags, [eventId+statusId]',
      companies: 'id, eventId, name',
      seatingMaps: 'id, eventId',
      arrivals: 'id, eventId, guestId, at, [eventId+guestId]',
      telemetry: 'id, eventId, source, metric, [eventId+metric]',
      dashboards: 'id, eventId',
      assets: 'id, workspaceId, eventId, kind',
      rundowns: 'eventId',
      templates: 'id, workspaceId, kind',
      views: 'id, workspaceId, entity, [workspaceId+entity]',
      meta: 'key',
    });
  }
}

export const db = new AtelierDb();

/* ------------------------------------------------------------------ meta */

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/* ------------------------------------------------------------- durability */

/**
 * Ask the browser to keep this origin's data. Without it a busy device can
 * evict an event mid-show. Reported in Diagnostics either way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  try {
    const estimate = (await navigator.storage?.estimate?.()) ?? {};
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted };
  } catch {
    return { usage: 0, quota: 0, persisted: false };
  }
}

/** Wipe everything. Only ever called behind an explicit, named confirmation. */
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}
