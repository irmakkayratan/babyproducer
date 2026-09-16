import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { db } from '@/data/db';
import {
  insertCue,
  moveCue,
  readCues,
  readMeta,
  removeCue,
  setCell,
  setMeta,
  updateCue,
} from '@/modules/rundown/doc';
import { deriveTimes } from '@/lib/time';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function makeDoc(cues: Array<{ label: string; durationSec: number }>) {
  const doc = new Y.Doc();
  setMeta(doc, { eventId: 'e1', showStart: '2027-03-04T19:00:00.000Z', columns: [], callerCueId: null });
  cues.forEach((cue, index) => insertCue(doc, index, cue));
  return doc;
}

describe('rundown document', () => {
  it('reads back cues in order', () => {
    const doc = makeDoc([
      { label: 'Doors', durationSec: 1800 },
      { label: 'Walk', durationSec: 600 },
    ]);
    expect(readCues(doc).map((c) => c.label)).toEqual(['Doors', 'Walk']);
    expect(readMeta(doc).showStart).toBe('2027-03-04T19:00:00.000Z');
  });

  it('updates a single field without touching its neighbours', () => {
    const doc = makeDoc([{ label: 'A', durationSec: 60 }, { label: 'B', durationSec: 120 }]);
    const [first] = readCues(doc);
    updateCue(doc, first.id, { durationSec: 252 });
    expect(readCues(doc).map((c) => c.durationSec)).toEqual([252, 120]);
  });

  it('stores per-department cells', () => {
    const doc = makeDoc([{ label: 'A', durationSec: 60 }]);
    const [cue] = readCues(doc);
    setCell(doc, cue.id, 'lighting', 'LX 12 GO');
    expect(readCues(doc)[0].cells.lighting).toBe('LX 12 GO');
  });

  it('reorders cues', () => {
    const doc = makeDoc([
      { label: 'A', durationSec: 60 },
      { label: 'B', durationSec: 60 },
      { label: 'C', durationSec: 60 },
    ]);
    moveCue(doc, 0, 3);
    expect(readCues(doc).map((c) => c.label)).toEqual(['B', 'C', 'A']);
    moveCue(doc, 2, 0);
    expect(readCues(doc).map((c) => c.label)).toEqual(['A', 'B', 'C']);
  });

  it('removes a cue', () => {
    const doc = makeDoc([{ label: 'A', durationSec: 60 }, { label: 'B', durationSec: 60 }]);
    removeCue(doc, readCues(doc)[0].id);
    expect(readCues(doc).map((c) => c.label)).toEqual(['B']);
  });
});

describe('concurrent editing', () => {
  it('merges edits made on two disconnected replicas with no lost work', () => {
    const a = makeDoc([
      { label: 'Doors', durationSec: 1800 },
      { label: 'Walk', durationSec: 600 },
      { label: 'Finale', durationSec: 300 },
    ]);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    // Both producers go offline and edit different rows.
    const cuesA = readCues(a);
    updateCue(a, cuesA[0].id, { durationSec: 2100 });
    setCell(a, cuesA[0].id, 'audio', 'House music up');

    const cuesB = readCues(b);
    updateCue(b, cuesB[2].id, { label: 'Finale + bow' });
    setCell(b, cuesB[1].id, 'lighting', 'LX 8');

    // Reconnect, in both directions.
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));

    for (const doc of [a, b]) {
      const cues = readCues(doc);
      expect(cues[0].durationSec).toBe(2100);
      expect(cues[0].cells.audio).toBe('House music up');
      expect(cues[1].cells.lighting).toBe('LX 8');
      expect(cues[2].label).toBe('Finale + bow');
    }
    expect(readCues(a)).toEqual(readCues(b));
  });

  it('converges when both replicas insert cues at the same index', () => {
    const a = makeDoc([{ label: 'A', durationSec: 60 }, { label: 'Z', durationSec: 60 }]);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    insertCue(a, 1, { label: 'From A', durationSec: 30 });
    insertCue(b, 1, { label: 'From B', durationSec: 45 });

    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));

    const labelsA = readCues(a).map((c) => c.label);
    const labelsB = readCues(b).map((c) => c.label);
    expect(labelsA).toEqual(labelsB);
    expect(labelsA).toHaveLength(4);
    expect(labelsA).toContain('From A');
    expect(labelsA).toContain('From B');
  });

  it('a merged duration edit re-times the sheet the same way on both replicas', () => {
    const a = makeDoc([
      { label: 'A', durationSec: 600 },
      { label: 'B', durationSec: 300 },
      { label: 'C', durationSec: 900 },
    ]);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    updateCue(a, readCues(a)[0].id, { durationSec: 852 });
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const meta = readMeta(a);
    expect(deriveTimes(meta.showStart, readCues(a))).toEqual(deriveTimes(meta.showStart, readCues(b)));
    expect(deriveTimes(meta.showStart, readCues(b))[1].plannedStart).toBe('2027-03-04T19:14:12.000Z');
  });
});
