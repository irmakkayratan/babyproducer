/**
 * The rundown document.
 *
 * This is the one place a CRDT earns its keep: several producers legitimately
 * edit the same cue sheet at once, often offline, and a lost edit during a show
 * is unacceptable. Yjs merges those edits without a conflict UI.
 *
 * Start times are deliberately NOT stored. They are derived from showStart plus
 * the durations above each cue (see lib/time.ts), so changing a duration is a
 * single-field update and the cascade is a recomputation — nothing to conflict
 * over, and no write amplification down a 500-row sheet.
 */
import * as Y from 'yjs';
import { db } from '@/data/db';
import type { Cue, CueAnchor, FieldValue, RundownColumn, RundownMeta } from '@/data/types';
import { ulid } from '@/lib/id';
import { syncBus } from '@/lib/syncBus';

const CUES = 'cues';
const META = 'meta';

export interface RundownHandle {
  doc: Y.Doc;
  eventId: string;
  destroy: () => void;
}

const handles = new Map<string, { handle: RundownHandle; refs: number; closeTimer?: ReturnType<typeof setTimeout> }>();

/**
 * Moving between the grid, the caller and the timer unmounts one surface and
 * mounts another. Tearing the document down in between would both lose the
 * in-memory state and race the debounced write to IndexedDB, so a document
 * with no subscribers lingers briefly and is reclaimed only if nobody comes
 * back for it.
 */
const CLOSE_GRACE_MS = 10_000;

function cueToMap(cue: Cue): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('id', cue.id);
  map.set('label', cue.label);
  map.set('durationSec', cue.durationSec);
  map.set('itemTypeId', cue.itemTypeId ?? null);
  map.set('anchor', cue.anchor ?? null);
  map.set('cells', cue.cells ?? {});
  map.set('notes', cue.notes ?? '');
  map.set('prompter', cue.prompter ?? '');
  map.set('actualStart', cue.actualStart ?? null);
  map.set('actualDurationSec', cue.actualDurationSec ?? null);
  map.set('done', cue.done ?? false);
  return map;
}

function mapToCue(map: Y.Map<unknown>): Cue {
  return {
    id: String(map.get('id')),
    label: String(map.get('label') ?? ''),
    durationSec: Number(map.get('durationSec') ?? 0),
    itemTypeId: (map.get('itemTypeId') as string | null) ?? undefined,
    anchor: (map.get('anchor') as CueAnchor | null) ?? undefined,
    cells: (map.get('cells') as Record<string, FieldValue>) ?? {},
    notes: (map.get('notes') as string) || undefined,
    prompter: (map.get('prompter') as string) || undefined,
    actualStart: (map.get('actualStart') as string | null) ?? undefined,
    actualDurationSec: (map.get('actualDurationSec') as number | null) ?? undefined,
    done: Boolean(map.get('done')),
  };
}

export function cueArray(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray<Y.Map<unknown>>(CUES);
}

export function metaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(META);
}

export function readCues(doc: Y.Doc): Cue[] {
  return cueArray(doc).toArray().map(mapToCue);
}

export function readMeta(doc: Y.Doc): RundownMeta {
  const meta = metaMap(doc);
  return {
    eventId: String(meta.get('eventId') ?? ''),
    showStart: String(meta.get('showStart') ?? new Date().toISOString()),
    columns: (meta.get('columns') as RundownColumn[]) ?? [],
    callerCueId: (meta.get('callerCueId') as string | null) ?? null,
    message: (meta.get('message') as RundownMeta['message']) ?? null,
  };
}

/* --------------------------------------------------------------- mutation */

export function insertCue(doc: Y.Doc, index: number, cue: Partial<Cue> = {}): string {
  const id = cue.id ?? ulid();
  cueArray(doc).insert(index, [
    cueToMap({
      id,
      label: cue.label ?? 'New cue',
      durationSec: cue.durationSec ?? 300,
      cells: cue.cells ?? {},
      ...cue,
    }),
  ]);
  return id;
}

export function updateCue(doc: Y.Doc, cueId: string, patch: Partial<Cue>): void {
  const array = cueArray(doc);
  for (let i = 0; i < array.length; i++) {
    const map = array.get(i);
    if (map.get('id') !== cueId) continue;
    doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        map.set(key, value === undefined ? null : value);
      }
    });
    return;
  }
}

export function setCell(doc: Y.Doc, cueId: string, columnId: string, value: FieldValue): void {
  const array = cueArray(doc);
  for (let i = 0; i < array.length; i++) {
    const map = array.get(i);
    if (map.get('id') !== cueId) continue;
    const cells = { ...((map.get('cells') as Record<string, FieldValue>) ?? {}) };
    cells[columnId] = value;
    map.set('cells', cells);
    return;
  }
}

export function removeCue(doc: Y.Doc, cueId: string): void {
  const array = cueArray(doc);
  for (let i = 0; i < array.length; i++) {
    if (array.get(i).get('id') === cueId) {
      array.delete(i, 1);
      return;
    }
  }
}

/** Y.Array reorder: delete then insert a clone, inside one transaction. */
export function moveCue(doc: Y.Doc, from: number, to: number): void {
  const array = cueArray(doc);
  if (from === to || from < 0 || from >= array.length) return;
  doc.transact(() => {
    const cue = mapToCue(array.get(from));
    array.delete(from, 1);
    const target = from < to ? to - 1 : to;
    array.insert(Math.max(0, Math.min(array.length, target)), [cueToMap(cue)]);
  });
}

export function setMeta(doc: Y.Doc, patch: Partial<RundownMeta>): void {
  const meta = metaMap(doc);
  doc.transact(() => {
    for (const [key, value] of Object.entries(patch)) meta.set(key, value);
  });
}

/* -------------------------------------------------------- persistence/sync */

/**
 * Cross-tab sync without a server: each tab broadcasts its Yjs updates and
 * applies the ones it receives. Yjs guarantees the merge is conflict-free and
 * order-independent, so a tab that was offline catches up on reconnect.
 */
class BroadcastProvider {
  private channel: BroadcastChannel | null = null;

  constructor(
    private doc: Y.Doc,
    eventId: string,
  ) {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel(`atelier:rundown:${eventId}`);
    this.channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      Y.applyUpdate(doc, new Uint8Array(event.data), 'remote');
    };
    doc.on('update', this.onUpdate);
    // Announce our state so an existing tab can merge us in.
    this.channel.postMessage(Y.encodeStateAsUpdate(doc).buffer);
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;
    this.channel?.postMessage(update.buffer.slice(0) as ArrayBuffer);
  };

  destroy() {
    this.doc.off('update', this.onUpdate);
    this.channel?.close();
  }
}

async function persist(doc: Y.Doc, eventId: string) {
  await db.rundowns.put({
    eventId,
    update: Y.encodeStateAsUpdate(doc),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Opens (or joins) the rundown for an event. Reference-counted so the grid,
 * the caller view and the timer display in the same tab share one document.
 */
export async function openRundown(eventId: string, seed?: (doc: Y.Doc) => void): Promise<RundownHandle> {
  const existing = handles.get(eventId);
  if (existing) {
    existing.refs += 1;
    if (existing.closeTimer) {
      clearTimeout(existing.closeTimer);
      existing.closeTimer = undefined;
    }
    return existing.handle;
  }

  const doc = new Y.Doc();
  const stored = await db.rundowns.get(eventId);
  if (stored) {
    Y.applyUpdate(doc, stored.update, 'storage');
  }
  // A document nobody has written to yet gets its starting shape here, with
  // the doc passed in — the caller has no handle to it until this returns.
  if (metaMap(doc).get('eventId') === undefined) {
    metaMap(doc).set('eventId', eventId);
    seed?.(doc);
  }

  const provider = new BroadcastProvider(doc, eventId);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const onUpdate = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(doc, eventId), 250);
  };
  doc.on('update', onUpdate);

  const handle: RundownHandle = {
    doc,
    eventId,
    destroy: () => {
      const entry = handles.get(eventId);
      if (!entry) return;
      entry.refs -= 1;
      if (entry.refs > 0) return;
      void persist(doc, eventId);
      entry.closeTimer = setTimeout(() => {
        const current = handles.get(eventId);
        if (!current || current.refs > 0) return;
        doc.off('update', onUpdate);
        provider.destroy();
        void persist(doc, eventId);
        handles.delete(eventId);
        doc.destroy();
      }, CLOSE_GRACE_MS);
    },
  };

  handles.set(eventId, { handle, refs: 1 });
  return handle;
}

/** Caller position also rides the ordinary sync bus, for surfaces without the doc. */
export function broadcastCaller(eventId: string, cueId: string | null): void {
  syncBus.post({ type: 'rundown:caller', eventId, cueId });
}

export { mapToCue };
