/**
 * Local database.
 *
 * The device holds the primary copy of the data: every read and write in the
 * app hits IndexedDB, never the network. Schema versions are additive and each
 * upgrade is tested against a fixture of the previous version, a migration
 * that silently drops a live guest list is the worst failure this app can have.
 */
import Dexie, { type Table } from 'dexie';
import { defaultSchema } from './defaults';
import type {
  AdvanceSheet,
  Arrival,
  Asset,
  Company,
  Dashboard,
  Event,
  EventTemplate,
  Guest,
  SavedView,
  SchemaConfig,
  SeatingMap,
  SettlementSheet,
  TelemetrySeries,
  Workspace,
} from './types';

export interface RundownDoc {
  eventId: string;
  update: Uint8Array; // Yjs state vector, the rundown's source of truth
  updatedAt: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export const SCHEMA_VERSION = 2;

export const DB_NAME = 'babyproducer';

/**
 * What the database was called before the product was renamed.
 *
 * A device that has been running the old build holds its only copy of the work
 * under that name. Opening a fresh empty database next to it would look exactly
 * like losing a season of events, so the new name adopts the old one on first
 * run and leaves the original in place.
 */
export const LEGACY_DB_NAME = 'atelier';

export class BabyProducerDb extends Dexie {
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
  advanceSheets!: Table<AdvanceSheet, string>;
  settlements!: Table<SettlementSheet, string>;
  templates!: Table<EventTemplate, string>;
  views!: Table<SavedView, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = DB_NAME) {
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

    // v2 adds advancing and settlement. Both are additive: two new tables and
    // three vocabulary lists backfilled onto existing workspaces, so a device
    // that has been running v1 for a season opens with its data intact.
    this.version(2)
      .stores({
        advanceSheets: 'id, eventId',
        settlements: 'id, eventId',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Workspace>('workspaces')
          .toCollection()
          .modify((workspace) => {
            workspace.schema = backfillSchema(workspace.schema);
            for (const moduleKey of ['advancing', 'settlement'] as const) {
              if (!workspace.enabledModules.includes(moduleKey)) workspace.enabledModules.push(moduleKey);
            }
          });
      });
  }
}

/**
 * Vocabulary a workspace predates. Reading a schema anywhere in the app goes
 * through here, because an import or an export written before v2 arrives with
 * the same gaps a migrated record would have had.
 */
export function backfillSchema(schema: SchemaConfig): SchemaConfig {
  const defaults = defaultSchema();
  return {
    ...schema,
    advanceSections: schema.advanceSections?.length ? schema.advanceSections : defaults.advanceSections,
    partyRoles: schema.partyRoles?.length ? schema.partyRoles : defaults.partyRoles,
    expenseCategories: schema.expenseCategories?.length ? schema.expenseCategories : defaults.expenseCategories,
  };
}

export const db = new BabyProducerDb();

/**
 * Copies a database written under the old product name into the new one.
 *
 * Runs before anything opens `db`, because opening it would create the new
 * database and make this look like a device that had already been adopted.
 * The old database is left untouched, so a person who downgrades still has it.
 */
export async function adoptLegacyDatabase(): Promise<boolean> {
  try {
    if (!(await Dexie.exists(LEGACY_DB_NAME))) return false;
    if (await Dexie.exists(DB_NAME)) return false;

    const legacy = new Dexie(LEGACY_DB_NAME);
    await legacy.open();
    const contents = await Promise.all(
      legacy.tables.map(async (table) => ({ name: table.name, rows: await table.toArray() })),
    );
    legacy.close();

    await db.open();
    await db.transaction('rw', db.tables, async () => {
      for (const { name, rows } of contents) {
        if (rows.length === 0) continue;
        // A table the old build had and this one dropped is skipped rather
        // than failing the whole adoption.
        const table = db.tables.find((candidate) => candidate.name === name);
        if (table) await table.bulkPut(rows);
      }
    });
    return true;
  } catch (error) {
    console.error('[db] could not adopt the previous database', error);
    return false;
  }
}

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
