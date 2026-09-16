import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, SCHEMA_VERSION } from '@/data/db';
import type { Workspace } from '@/data/types';

/**
 * The v1 → v2 upgrade, run against a fixture written by the previous version.
 *
 * A migration that silently drops a live guest list is the worst failure this
 * app can have, so every schema version gets one of these.
 */
const V1_STORES = {
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
};

const iso = '2026-01-01T00:00:00.000Z';

/** A workspace exactly as v1 wrote it: no advancing or settlement anywhere. */
function legacyWorkspace() {
  return {
    id: 'w1',
    name: 'Season',
    brand: {
      appName: 'Atelier',
      accent: 'hsl(258 85% 68%)',
      radius: 0.75,
      defaultScheme: 'dark',
      displayFont: 'serif',
    },
    schema: {
      fields: [],
      eventStatuses: [{ id: 'planning', label: 'Planning', order: 0 }],
      guestStatuses: [{ id: 'invited', label: 'Invited', order: 0 }],
      tiers: [{ id: 'tier-1', label: 'Tier 1', order: 0 }],
      voices: [{ id: 'guest', label: 'Guest', order: 0 }],
      cueTypes: [{ id: 'segment', label: 'Segment', order: 0 }],
      platforms: [{ id: 'instagram', label: 'Instagram', order: 0 }],
    },
    metrics: [],
    enabledModules: ['guests', 'seating', 'rundown', 'checkin', 'command', 'metrics'],
    demo: false,
    createdAt: iso,
    updatedAt: iso,
    rev: 3,
  };
}

async function writeV1Fixture() {
  const legacy = new Dexie('atelier');
  legacy.version(1).stores(V1_STORES);
  await legacy.open();
  await legacy.table('workspaces').put(legacyWorkspace());
  await legacy.table('events').put({
    id: 'e1',
    workspaceId: 'w1',
    name: 'Show',
    kind: 'Event',
    statusId: 'planning',
    startsAt: '2026-03-01T19:00:00.000Z',
    endsAt: '2026-03-01T22:00:00.000Z',
    timezone: 'Europe/Paris',
    venue: { name: 'Venue' },
    capacity: 400,
    theme: null,
    fields: {},
    moduleOverrides: {},
    createdAt: iso,
    updatedAt: iso,
    rev: 1,
  });
  await legacy.table('guests').put({
    id: 'g1',
    eventId: 'e1',
    name: 'Existing Guest',
    statusId: 'invited',
    plusOnes: 0,
    tags: [],
    fields: {},
    qrToken: 'token',
    createdAt: iso,
    updatedAt: iso,
    rev: 1,
  });
  legacy.close();
}

beforeEach(async () => {
  await db.delete();
});

describe('v1 → v2 upgrade', () => {
  it('keeps every record the previous version wrote', async () => {
    await writeV1Fixture();
    await db.open();

    expect(await db.events.get('e1')).toBeDefined();
    expect((await db.guests.get('g1'))?.name).toBe('Existing Guest');
    expect((await db.workspaces.get('w1'))?.name).toBe('Season');
  });

  it('backfills the vocabulary the new modules read', async () => {
    await writeV1Fixture();
    await db.open();

    const workspace = (await db.workspaces.get('w1')) as Workspace;
    expect(workspace.schema.advanceSections.length).toBeGreaterThan(0);
    expect(workspace.schema.partyRoles.length).toBeGreaterThan(0);
    expect(workspace.schema.expenseCategories.length).toBeGreaterThan(0);
    // Vocabulary the user already had is untouched.
    expect(workspace.schema.voices.map((voice) => voice.id)).toEqual(['guest']);
  });

  it('turns the new modules on rather than hiding them behind a setting', async () => {
    await writeV1Fixture();
    await db.open();

    const workspace = (await db.workspaces.get('w1')) as Workspace;
    expect(workspace.enabledModules).toContain('advancing');
    expect(workspace.enabledModules).toContain('settlement');
  });

  it('opens the new tables empty and ready', async () => {
    await writeV1Fixture();
    await db.open();

    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.advanceSheets.count()).toBe(0);
    expect(await db.settlements.count()).toBe(0);
  });
});
