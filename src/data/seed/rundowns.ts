/**
 * Demo cue stacks.
 *
 * Shapes, not transcripts: block structure, plausible durations per item type,
 * and the couple of hard anchors every show has (doors, top of show). Generated
 * from the scenario seed so the sheet is identical on every machine.
 */
import type * as Y from 'yjs';
import type { Cue, RundownColumn } from '@/data/types';
import { createRng } from '@/lib/rng';
import { seededIds } from '@/lib/id';
import { insertCue, setMeta } from '@/modules/rundown/doc';

interface BlockSpec {
  name: string;
  cues: Array<{ label: string; itemTypeId?: string; minSec: number; maxSec: number; cells?: Record<string, string> }>;
  repeat?: number;
}

const SHOW_SHAPES: Record<string, BlockSpec[]> = {
  'runway-show': [
    {
      name: 'Pre-show',
      cues: [
        { label: 'Doors open', itemTypeId: 'segment', minSec: 1800, maxSec: 2400, cells: { music: 'Playlist A', lighting: 'House 70%' } },
        { label: 'Seating push', itemTypeId: 'segment', minSec: 600, maxSec: 900, cells: { music: 'Playlist A', lighting: 'House 50%' } },
        { label: 'House to half', itemTypeId: 'lighting', minSec: 60, maxSec: 120, cells: { lighting: 'LX 3 — house 25%' } },
      ],
    },
    {
      name: 'Show',
      // A full collection: a real sheet is dozens of walk cues, which is also
      // what makes the drift cascade worth having.
      repeat: 34,
      cues: [
        { label: 'Look', itemTypeId: 'walk', minSec: 26, maxSec: 46, cells: { camera: 'Cam 2 — runway' } },
      ],
    },
    {
      name: 'Finale',
      cues: [
        { label: 'Finale walk', itemTypeId: 'finale', minSec: 90, maxSec: 150, cells: { music: 'Track 4 — finale', lighting: 'LX 22 full' } },
        { label: 'Designer bow', itemTypeId: 'bow', minSec: 30, maxSec: 60, cells: { camera: 'Cam 1 — wide' } },
        { label: 'House up / exit music', itemTypeId: 'segment', minSec: 300, maxSec: 600, cells: { music: 'Playlist B', lighting: 'House 100%' } },
      ],
    },
  ],
  'product-launch': [
    {
      name: 'Pre-show',
      cues: [
        { label: 'Doors and seating', itemTypeId: 'segment', minSec: 1800, maxSec: 2400, cells: { stream: 'Holding slide' } },
        { label: 'Countdown roll', itemTypeId: 'video', minSec: 120, maxSec: 180, cells: { slides: 'Countdown', stream: 'Live' } },
      ],
    },
    {
      name: 'Keynote',
      cues: [
        { label: 'Welcome', itemTypeId: 'slide', minSec: 240, maxSec: 420, cells: { mics: 'HH1', slides: '1–4' } },
        { label: 'Product reveal', itemTypeId: 'video', minSec: 150, maxSec: 240, cells: { slides: 'Film', stream: 'Live' } },
        { label: 'Live demo', itemTypeId: 'demo', minSec: 420, maxSec: 720, cells: { mics: 'Lav 2', lowerthirds: 'Speaker 2' } },
        { label: 'Customer story', itemTypeId: 'slide', minSec: 300, maxSec: 480, cells: { mics: 'Lav 3' } },
        { label: 'Pricing and availability', itemTypeId: 'slide', minSec: 180, maxSec: 300, cells: { slides: '22–28' } },
        { label: 'Q&A', itemTypeId: 'qa', minSec: 600, maxSec: 900, cells: { mics: 'HH2 + HH3' } },
      ],
    },
    {
      name: 'Close',
      cues: [{ label: 'Close and walk-out', itemTypeId: 'segment', minSec: 180, maxSec: 300, cells: { stream: 'End card' } }],
    },
  ],
  'brand-activation': [
    {
      name: 'Day shape',
      cues: [
        { label: 'Staff briefing', minSec: 900, maxSec: 1200, cells: { staffing: 'Full team' } },
        { label: 'Doors — public', minSec: 3600, maxSec: 5400, cells: { station: 'All stations live' } },
        { label: 'Creator hour', minSec: 3600, maxSec: 3600, cells: { station: 'Studio', content: 'Capture on' } },
        { label: 'Peak trading', minSec: 7200, maxSec: 9000, cells: { staffing: 'Surge cover' } },
        { label: 'Wind-down and reset', minSec: 1800, maxSec: 2700, cells: { staffing: 'Close team' } },
      ],
    },
  ],
};

export function seedRundown(
  doc: Y.Doc,
  options: { eventId: string; templateId: string; showStart: string; doorsAt?: string; columns: RundownColumn[]; seed: string },
): void {
  const shape = SHOW_SHAPES[options.templateId];
  if (!shape) return;

  const rng = createRng(`${options.seed}-rundown`);
  const makeId = seededIds(rng.next);
  setMeta(doc, {
    eventId: options.eventId,
    showStart: options.doorsAt ?? options.showStart,
    columns: options.columns,
    callerCueId: null,
  });

  let index = 0;
  for (const block of shape) {
    const repeat = block.repeat ?? 1;
    for (let pass = 0; pass < repeat; pass++) {
      for (const spec of block.cues) {
        const cells: Record<string, string> = { ...(spec.cells ?? {}) };
        // Repeated cues carry their sequence into the department columns that
        // track it, the way a real sheet numbers exits.
        if (repeat > 1 && spec.itemTypeId === 'walk') {
          cells.models = `Model ${pass + 1}`;
        }
        const cue: Partial<Cue> = {
          id: makeId(),
          label: repeat > 1 ? `${spec.label} ${pass + 1}` : spec.label,
          durationSec: rng.int(spec.minSec, spec.maxSec),
          itemTypeId: spec.itemTypeId,
          cells,
          blockId: block.name,
        };
        // Every show has a couple of immovable wall-clock moments.
        if (spec.label === 'Doors open' || spec.label === 'Doors and seating') {
          cue.anchor = { at: options.doorsAt ?? options.showStart, mode: 'hard' };
        }
        if (spec.label === 'House to half' || spec.label === 'Countdown roll') {
          cue.anchor = { at: options.showStart, mode: 'soft' };
        }
        insertCue(doc, index++, cue);
      }
    }
  }
}
