import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { createEvent, createWorkspace } from '@/data/repo';
import { createGuest } from '@/data/guests';
import { exportWorkspace, importWorkspace, isWorkspaceExport } from '@/data/io/workspace';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedWorkspace() {
  const workspace = await createWorkspace({ name: 'Studio Test' });
  const event = await createEvent({
    workspaceId: workspace.id,
    name: 'Show',
    templateId: 'runway-show',
    startsAt: '2027-03-04T19:00:00.000Z',
  });
  await createGuest({ eventId: event.id, name: 'Exported Guest', tierId: 'a-list' });
  return { workspace, event };
}

describe('workspace export', () => {
  it('carries schema, brand and metrics without the data by default', async () => {
    const { workspace } = await seedWorkspace();
    const payload = await exportWorkspace(workspace.id);

    expect(isWorkspaceExport(payload)).toBe(true);
    expect(payload.workspace.schema.voices.length).toBeGreaterThan(0);
    expect(payload.workspace.metrics.length).toBeGreaterThan(0);
    expect(payload.events).toHaveLength(1);
    expect(payload.data).toBeUndefined();
  });

  it('includes records when asked', async () => {
    const { workspace } = await seedWorkspace();
    const payload = await exportWorkspace(workspace.id, { includeData: true });
    expect(payload.data?.guests).toHaveLength(1);
  });

  it('carries the advance and the settlement with the event', async () => {
    const { workspace } = await seedWorkspace();
    const payload = await exportWorkspace(workspace.id, { includeData: true });

    expect(payload.data?.advanceSheets?.[0].items.length).toBeGreaterThan(0);
    expect(payload.data?.settlements).toHaveLength(1);
  });

  it('survives a JSON round trip', async () => {
    const { workspace } = await seedWorkspace();
    const payload = await exportWorkspace(workspace.id, { includeData: true });
    const parsed = JSON.parse(JSON.stringify(payload));
    expect(isWorkspaceExport(parsed)).toBe(true);
  });
});

describe('workspace import', () => {
  it('imports as a new workspace without touching the original', async () => {
    const { workspace } = await seedWorkspace();
    const payload = JSON.parse(JSON.stringify(await exportWorkspace(workspace.id, { includeData: true })));

    const result = await importWorkspace(payload);

    expect(result.workspaceId).not.toBe(workspace.id);
    expect(await db.workspaces.count()).toBe(2);
    expect((await db.workspaces.get(workspace.id))?.name).toBe('Studio Test');

    const imported = await db.workspaces.get(result.workspaceId);
    expect(imported?.name).toContain('imported');
    expect(imported?.schema.voices.map((voice) => voice.id)).toContain('celebrity');
  });

  it('remaps ids so guests stay attached to their imported event', async () => {
    const { workspace } = await seedWorkspace();
    const payload = JSON.parse(JSON.stringify(await exportWorkspace(workspace.id, { includeData: true })));
    const result = await importWorkspace(payload);

    const events = await db.events.where('workspaceId').equals(result.workspaceId).toArray();
    expect(events).toHaveLength(1);
    const guests = await db.guests.where('eventId').equals(events[0].id).toArray();
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe('Exported Guest');
    expect(guests[0].id).not.toBe((await db.guests.where('eventId').notEqual(events[0].id).toArray())[0]?.id);
  });

  it('reattaches an imported advance and settlement to the imported event', async () => {
    const { workspace } = await seedWorkspace();
    const payload = JSON.parse(JSON.stringify(await exportWorkspace(workspace.id, { includeData: true })));
    const result = await importWorkspace(payload);

    const events = await db.events.where('workspaceId').equals(result.workspaceId).toArray();
    const advance = await db.advanceSheets.where('eventId').equals(events[0].id).first();
    const settlement = await db.settlements.where('eventId').equals(events[0].id).first();

    expect(advance?.items.length).toBeGreaterThan(0);
    expect(settlement).toBeDefined();
    // The original keeps its own copies rather than having them moved.
    expect(await db.advanceSheets.count()).toBe(2);
  });

  it('opens an export written before advancing and settlement existed', async () => {
    const { workspace } = await seedWorkspace();
    const payload = JSON.parse(JSON.stringify(await exportWorkspace(workspace.id, { includeData: true })));

    // A v1 file: no new tables, and a schema with none of the new vocabulary.
    payload.version = 1;
    delete payload.data.advanceSheets;
    delete payload.data.settlements;
    delete payload.workspace.schema.advanceSections;
    delete payload.workspace.schema.partyRoles;
    delete payload.workspace.schema.expenseCategories;

    const result = await importWorkspace(payload);
    const imported = await db.workspaces.get(result.workspaceId);

    expect(imported?.schema.advanceSections.length).toBeGreaterThan(0);
    expect(imported?.schema.expenseCategories.length).toBeGreaterThan(0);
  });

  it('never flags an imported workspace as demo data', async () => {
    const demo = await createWorkspace({ name: 'Demo', demo: true });
    const payload = JSON.parse(JSON.stringify(await exportWorkspace(demo.id)));
    const result = await importWorkspace(payload);
    expect((await db.workspaces.get(result.workspaceId))?.demo).toBe(false);
  });

  it('rejects a file that is not a workspace export', async () => {
    await expect(importWorkspace({ hello: 'world' })).rejects.toThrow('not an Atelier workspace');
  });

  it('rejects an export from a newer version rather than guessing', async () => {
    const { workspace } = await seedWorkspace();
    const payload = { ...(await exportWorkspace(workspace.id)), version: 99 };
    await expect(importWorkspace(payload)).rejects.toThrow('newer version');
  });
});
