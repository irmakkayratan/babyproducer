/**
 * Workspace import and export.
 *
 * This is the portability guarantee. Everything a user has shaped (brand,
 * schema, metrics, templates and optionally the data itself) travels as one
 * JSON file. It is also the backup story, and the migration path if a hosted
 * backend is ever added.
 */
import { backfillSchema, db } from '@/data/db';
import type {
  AdvanceSheet,
  Arrival,
  Company,
  Dashboard,
  Event,
  Guest,
  SeatingMap,
  SettlementSheet,
  TelemetrySeries,
  Workspace,
} from '@/data/types';
import { ulid } from '@/lib/id';

export const EXPORT_FORMAT = 'babyproducer.workspace';

/**
 * What exports were stamped with before the product was renamed. Files people
 * already have on disk still have to open, so both are accepted on the way in
 * and only the current one is written on the way out.
 */
const LEGACY_EXPORT_FORMATS = ['atelier.workspace'];
export const EXPORT_VERSION = 2;

export interface WorkspaceExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  workspace: Workspace;
  events: Event[];
  data?: {
    guests: Guest[];
    companies: Company[];
    seatingMaps: SeatingMap[];
    arrivals: Arrival[];
    telemetry: TelemetrySeries[];
    dashboards: Dashboard[];
    rundowns: Array<{ eventId: string; update: number[] }>;
    /** Added in v2; a v1 export simply has neither. */
    advanceSheets?: AdvanceSheet[];
    settlements?: SettlementSheet[];
  };
}

export async function exportWorkspace(
  workspaceId: string,
  options: { includeData?: boolean } = {},
): Promise<WorkspaceExport> {
  const workspace = await db.workspaces.get(workspaceId);
  if (!workspace) throw new Error('Workspace not found');
  const events = await db.events.where('workspaceId').equals(workspaceId).toArray();
  const eventIds = events.map((event) => event.id);

  const base: WorkspaceExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
    events,
  };
  if (!options.includeData) return base;

  const [guests, companies, seatingMaps, arrivals, telemetry, dashboards, rundowns, advanceSheets, settlements] =
    await Promise.all([
      db.guests.where('eventId').anyOf(eventIds).toArray(),
      db.companies.where('eventId').anyOf(eventIds).toArray(),
      db.seatingMaps.where('eventId').anyOf(eventIds).toArray(),
      db.arrivals.where('eventId').anyOf(eventIds).toArray(),
      db.telemetry.where('eventId').anyOf(eventIds).toArray(),
      db.dashboards.where('eventId').anyOf(eventIds).toArray(),
      db.rundowns.where('eventId').anyOf(eventIds).toArray(),
      db.advanceSheets.where('eventId').anyOf(eventIds).toArray(),
      db.settlements.where('eventId').anyOf(eventIds).toArray(),
    ]);

  return {
    ...base,
    data: {
      guests,
      companies,
      seatingMaps,
      arrivals,
      telemetry,
      dashboards,
      advanceSheets,
      settlements,
      // Uint8Array does not survive JSON; a plain array does.
      rundowns: rundowns.map((doc) => ({ eventId: doc.eventId, update: Array.from(doc.update) })),
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * A file picked off a disk is untrusted input, and the only thing standing
 * between a truncated or hand-edited export and a raw `TypeError` in the
 * middle of a Dexie transaction is this check, so it validates the shape the
 * importer actually walks, all the way down.
 */
export function isWorkspaceExport(value: unknown): value is WorkspaceExport {
  if (!isRecord(value)) return false;
  if (value.format !== EXPORT_FORMAT && !LEGACY_EXPORT_FORMATS.includes(value.format as string)) return false;
  if (typeof value.version !== 'number' || !Number.isFinite(value.version)) return false;

  const workspace = value.workspace;
  if (!isRecord(workspace) || typeof workspace.id !== 'string' || !workspace.id) return false;
  if (!Array.isArray(value.events)) return false;
  if (!value.events.every((event) => isRecord(event) && typeof event.id === 'string')) return false;

  if (value.data !== undefined) {
    if (!isRecord(value.data)) return false;
    // Every collection the importer maps over has to be an array, including the
    // ones a v1 export legitimately omits.
    const required = ['guests', 'companies', 'seatingMaps', 'arrivals', 'telemetry', 'dashboards', 'rundowns'];
    const optional = ['advanceSheets', 'settlements'];
    for (const key of required) if (!Array.isArray(value.data[key])) return false;
    for (const key of optional) {
      if (value.data[key] !== undefined && !Array.isArray(value.data[key])) return false;
    }
  }
  return true;
}

export interface ImportResult {
  workspaceId: string;
  events: number;
  guests: number;
}

/**
 * Imports as a new workspace by default, remapping ids so an import can never
 * silently overwrite work the user already has.
 */
export async function importWorkspace(
  payload: unknown,
  options: { mode?: 'new' | 'replace' } = {},
): Promise<ImportResult> {
  if (!isWorkspaceExport(payload)) {
    throw new Error('That file is not a BabyProducer workspace export.');
  }
  if (payload.version > EXPORT_VERSION) {
    throw new Error('That export came from a newer version of the app.');
  }

  const mode = options.mode ?? 'new';
  const idMap = new Map<string, string>();
  const remap = (id: string) => {
    if (mode === 'replace') return id;
    const existing = idMap.get(id);
    if (existing) return existing;
    const next = ulid();
    idMap.set(id, next);
    return next;
  };

  const workspaceId = remap(payload.workspace.id);
  const now = new Date().toISOString();
  const workspace: Workspace = {
    ...payload.workspace,
    // An export written before a vocabulary list existed still has to open.
    schema: backfillSchema(payload.workspace.schema),
    id: workspaceId,
    name:
      mode === 'new' ? `${payload.workspace.name || 'Workspace'} (imported)` : payload.workspace.name || 'Workspace',
    demo: false,
    updatedAt: now,
  };

  const events = payload.events.map((event) => ({
    ...event,
    id: remap(event.id),
    workspaceId,
  }));

  await db.transaction(
    'rw',
    [
      db.workspaces,
      db.events,
      db.guests,
      db.companies,
      db.seatingMaps,
      db.arrivals,
      db.telemetry,
      db.dashboards,
      db.rundowns,
      db.advanceSheets,
      db.settlements,
    ],
    async () => {
      await db.workspaces.put(workspace);
      await db.events.bulkPut(events);

      const data = payload.data;
      if (!data) return;

      await db.guests.bulkPut(
        data.guests.map((guest) => ({
          ...guest,
          id: remap(guest.id),
          eventId: remap(guest.eventId),
          companyId: guest.companyId ? remap(guest.companyId) : undefined,
          seatId: guest.seatId ? remap(guest.seatId) : undefined,
        })),
      );
      await db.companies.bulkPut(
        data.companies.map((company) => ({ ...company, id: remap(company.id), eventId: remap(company.eventId) })),
      );
      await db.seatingMaps.bulkPut(
        data.seatingMaps.map((map) => ({
          ...map,
          id: remap(map.id),
          eventId: remap(map.eventId),
          elements: (map.elements ?? []).map((element) =>
            'seats' in element
              ? {
                  ...element,
                  id: remap(element.id),
                  seats: (element.seats ?? []).map((seat) => ({
                    ...seat,
                    id: remap(seat.id),
                    guestId: seat.guestId ? remap(seat.guestId) : undefined,
                  })),
                }
              : { ...element, id: remap(element.id) },
          ),
          rules: (map.rules ?? []).map((rule) => ({ ...rule, subjects: (rule.subjects ?? []).map(remap) })),
        })),
      );
      await db.arrivals.bulkPut(
        data.arrivals.map((arrival) => ({
          ...arrival,
          id: remap(arrival.id),
          eventId: remap(arrival.eventId),
          guestId: remap(arrival.guestId),
        })),
      );
      await db.telemetry.bulkPut(
        data.telemetry.map((series) => ({ ...series, id: remap(series.id), eventId: remap(series.eventId) })),
      );
      await db.dashboards.bulkPut(
        data.dashboards.map((dashboard) => ({ ...dashboard, id: remap(dashboard.id), eventId: remap(dashboard.eventId) })),
      );
      await db.rundowns.bulkPut(
        data.rundowns.map((doc) => ({
          eventId: remap(doc.eventId),
          // A hand-edited file can carry anything here; a non-byte would decode
          // into a corrupt Yjs update, and fail quietly much later.
          update: Uint8Array.from((doc.update ?? []).map((byte) => (Number.isFinite(byte) ? byte : 0))),
          updatedAt: now,
        })),
      );
      await db.advanceSheets.bulkPut(
        (data.advanceSheets ?? []).map((sheet) => ({
          ...sheet,
          id: remap(sheet.id),
          eventId: remap(sheet.eventId),
        })),
      );
      await db.settlements.bulkPut(
        (data.settlements ?? []).map((sheet) => ({
          ...sheet,
          id: remap(sheet.id),
          eventId: remap(sheet.eventId),
        })),
      );
    },
  );

  return {
    workspaceId,
    events: events.length,
    guests: payload.data?.guests.length ?? 0,
  };
}
