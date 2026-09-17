import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { applyTemplateToSchema, createEvent, createWorkspace, deleteEvent, listEvents } from '@/data/repo';
import { defaultSchema } from '@/data/defaults';
import { getTemplate } from '@/data/templates';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('applyTemplateToSchema', () => {
  it('replaces untouched defaults so a fresh workspace speaks the template language', () => {
    const schema = applyTemplateToSchema(defaultSchema(), getTemplate('runway-show'));
    expect(schema.voices.map((v) => v.id)).toContain('celebrity');
    // The neutral placeholders are gone, with nothing left alongside.
    expect(schema.voices.map((v) => v.id)).not.toContain('guest');
  });

  it('never discards vocabulary the user has already shaped', () => {
    const custom = defaultSchema();
    custom.voices = [{ id: 'my-voice', label: 'Community', order: 0 }];
    const schema = applyTemplateToSchema(custom, getTemplate('runway-show'));
    expect(schema.voices.map((v) => v.id)).toContain('my-voice');
    expect(schema.voices.map((v) => v.id)).toContain('celebrity');
  });
});

describe('events', () => {
  it('creates an event and applies the template to the workspace schema', async () => {
    const workspace = await createWorkspace({ name: 'Test' });
    const event = await createEvent({
      workspaceId: workspace.id,
      name: 'SS27',
      templateId: 'runway-show',
      startsAt: '2027-03-04T19:00:00.000Z',
    });

    expect(event.kind).toBe('Runway Show');
    expect(event.endsAt > event.startsAt).toBe(true);

    const stored = await db.workspaces.get(workspace.id);
    expect(stored?.schema.voices.map((v) => v.id)).toContain('celebrity');
    expect(stored?.rev).toBe(2);
  });

  it('lists events in start order', async () => {
    const workspace = await createWorkspace({ name: 'Test' });
    await createEvent({ workspaceId: workspace.id, name: 'Later', startsAt: '2027-05-01T10:00:00.000Z' });
    await createEvent({ workspaceId: workspace.id, name: 'Sooner', startsAt: '2027-01-01T10:00:00.000Z' });
    const events = await listEvents(workspace.id);
    expect(events.map((e) => e.name)).toEqual(['Sooner', 'Later']);
  });

  it('deleting an event takes its dependent records with it', async () => {
    const workspace = await createWorkspace({ name: 'Test' });
    const event = await createEvent({ workspaceId: workspace.id, name: 'Show', startsAt: '2027-03-04T19:00:00.000Z' });
    await db.guests.put({
      id: 'g1',
      eventId: event.id,
      name: 'Guest',
      statusId: 'invited',
      plusOnes: 0,
      tags: [],
      fields: {},
      qrToken: 'abc',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rev: 1,
    });

    await deleteEvent(event.id);

    expect(await db.events.get(event.id)).toBeUndefined();
    expect(await db.guests.where('eventId').equals(event.id).count()).toBe(0);
  });
});
