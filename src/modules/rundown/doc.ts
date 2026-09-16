/**
 * The rundown document.
 *
 * This is the one place a CRDT earns its keep: several producers legitimately
 * edit the same cue sheet at once, often offline, and a lost edit during a show
 * is unacceptable. Yjs merges those edits without a conflict UI.
 *
 * Start times are deliberately NOT stored. They are derived from showStart plus
 * the durations above each cue (see lib/time.ts), so changing a duration is a
 * single-field update and the cascade is a recomputation, nothing to conflict
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

interface HandleEntry {
  handle: RundownHandle;
  refs: number;
  closeTimer?: ReturnType<typeof setTimeout>;
}

const handles = new Map<string, HandleEntry>();

/**
 * Opening reads IndexedDB, so it is asynchronous, and the grid, the caller bar
 * and the stage timer all mount in the same tick. Without this, each of them
 * awaited the read before anybody had registered a handle, every one of them
 * built its own `Y.Doc`, and the last to finish won the map, three documents
 * for one event, edits landing in whichever copy the surface happened to hold,
 * and three debounced writers overwriting each other in IndexedDB. Callers
 * queue on the first open instead.
 */
const opening = new Map<string, Promise<RundownHandle>>();

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
  // Spread first, then the defaults: a caller passing `{ label: undefined }`
  // means "no label given", not "set the label to undefined". Spreading last
  // put the string "undefined" in the id and a zero-length cue on the sheet.
  cueArray(doc).insert(index, [
    cueToMap({
      ...cue,
      id,
      label: cue.label ?? 'New cue',
      durationSec: cue.durationSec ?? 300,
      cells: cue.cells ?? {},
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
 * `bytes.buffer` is the whole backing store, which for a view into a pooled
 * buffer is longer than the update and starts in the wrong place, the far end
 * would decode neighbouring bytes as part of the message. Copy exactly the
 * region the view covers.
 */
function toTransferable(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

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
    this.channel = new BroadcastChannel(`babyproducer:rundown:${eventId}`);
    this.channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      try {
        Y.applyUpdate(doc, new Uint8Array(event.data), 'remote');
      } catch (error) {
        // A malformed update from another tab must not take this one down
        // mid-show; Yjs simply keeps the state it already has.
        console.error('[rundown] ignoring an unreadable update from another tab', error);
      }
    };
    doc.on('update', this.onUpdate);
    // Announce our state so an existing tab can merge us in.
    this.channel.postMessage(toTransferable(Y.encodeStateAsUpdate(doc)));
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;
    this.channel?.postMessage(toTransferable(update));
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
    retain(existing);
    return existing.handle;
  }

  // Someone else is already building this document: wait for it and take a
  // reference on the one they registered.
  const inFlight = opening.get(eventId);
  if (inFlight) {
    await inFlight;
    const entry = handles.get(eventId);
    if (entry) {
      retain(entry);
      return entry.handle;
    }
    // The open failed for the first caller; fall through and try again.
  }

  const pending = createRundown(eventId, seed);
  opening.set(eventId, pending);
  try {
    return await pending;
  } finally {
    opening.delete(eventId);
  }
}

function retain(entry: HandleEntry): void {
  entry.refs += 1;
  if (entry.closeTimer) {
    clearTimeout(entry.closeTimer);
    entry.closeTimer = undefined;
  }
}

async function createRundown(eventId: string, seed?: (doc: Y.Doc) => void): Promise<RundownHandle> {
  const doc = new Y.Doc();
  const stored = await db.rundowns.get(eventId);
  if (stored) {
    Y.applyUpdate(doc, stored.update, 'storage');
  }
  // A document nobody has written to yet gets its starting shape here, with
  // the doc passed in, the caller has no handle to it until this returns.
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
      // A surface that unmounts twice (StrictMode does exactly this) must not
      // drive the count negative and strand the document open.
      if (!entry || entry.refs <= 0) return;
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
