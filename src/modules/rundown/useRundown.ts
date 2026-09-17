import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Y from 'yjs';
import type { Cue, FieldValue, RundownColumn, RundownMeta } from '@/data/types';
import {
  broadcastCaller,
  insertCue,
  moveCue,
  openRundown,
  readCues,
  readMeta,
  removeCue,
  setCell,
  setMeta,
  updateCue,
} from './doc';

export interface RundownState {
  cues: Cue[];
  meta: RundownMeta;
  ready: boolean;
}

/**
 * Subscribes a component to the shared rundown document. Every surface in this
 * tab (grid, caller, prompter, timer) shares one Y.Doc, so they stay in step
 * with no plumbing between them.
 */
export function useRundown(eventId: string | undefined, seed?: (doc: Y.Doc) => void) {
  const docRef = useRef<Y.Doc | null>(null);
  const [state, setState] = useState<RundownState>({
    cues: [],
    meta: { eventId: eventId ?? '', showStart: new Date().toISOString(), columns: [], callerCueId: null },
    ready: false,
  });

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const handle = await openRundown(eventId, seed);
      if (cancelled) {
        handle.destroy();
        return;
      }
      docRef.current = handle.doc;

      const sync = () =>
        setState({ cues: readCues(handle.doc), meta: readMeta(handle.doc), ready: true });
      sync();
      handle.doc.on('update', sync);

      cleanup = () => {
        handle.doc.off('update', sync);
        handle.destroy();
        docRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // `seed` is intentionally excluded: it only ever runs on first creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const withDoc = useCallback((fn: (doc: Y.Doc) => void) => {
    if (docRef.current) fn(docRef.current);
  }, []);

  const actions = {
    insert: useCallback((index: number, cue?: Partial<Cue>) => withDoc((doc) => insertCue(doc, index, cue)), [withDoc]),
    update: useCallback((cueId: string, patch: Partial<Cue>) => withDoc((doc) => updateCue(doc, cueId, patch)), [withDoc]),
    remove: useCallback((cueId: string) => withDoc((doc) => removeCue(doc, cueId)), [withDoc]),
    move: useCallback((from: number, to: number) => withDoc((doc) => moveCue(doc, from, to)), [withDoc]),
    cell: useCallback(
      (cueId: string, columnId: string, value: FieldValue) => withDoc((doc) => setCell(doc, cueId, columnId, value)),
      [withDoc],
    ),
    meta: useCallback((patch: Partial<RundownMeta>) => withDoc((doc) => setMeta(doc, patch)), [withDoc]),
    setColumns: useCallback((columns: RundownColumn[]) => withDoc((doc) => setMeta(doc, { columns })), [withDoc]),
    /** Moves the show caller and stamps the actual start time of the new cue. */
    setCaller: useCallback(
      (cueId: string | null) =>
        withDoc((doc) => {
          setMeta(doc, { callerCueId: cueId });
          if (cueId) updateCue(doc, cueId, { actualStart: new Date().toISOString() });
          if (eventId) broadcastCaller(eventId, cueId);
        }),
      [withDoc, eventId],
    ),
    message: useCallback(
      (text: string, flash = false) =>
        withDoc((doc) => setMeta(doc, { message: text ? { text, at: new Date().toISOString(), flash } : null })),
      [withDoc],
    ),
  };

  return { ...state, actions, doc: docRef.current };
}
