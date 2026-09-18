/**
 * Demo cue stacks.
 *
 * Shapes, held loosely: block structure, plausible durations per item type,
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
  'club-night': [
    {
      name: 'Door',
      cues: [
        { label: 'Doors open', itemTypeId: 'doors', minSec: 1800, maxSec: 2700, cells: { audio: 'Warm-up playlist', lighting: 'House 60%' } },
        { label: 'Room fills', itemTypeId: 'doors', minSec: 2700, maxSec: 3600, cells: { booth: 'Resident on', lighting: 'House 30%' } },
      ],
    },
    {
      name: 'Openers',
      // Three sets before the headline, each with the changeover after it, so
      // an opener running long pushes everything below and the curfew shows it.
      repeat: 3,
      cues: [
        { label: 'Opening set', itemTypeId: 'opener', minSec: 3600, maxSec: 5400, cells: { booth: 'CDJ 1–2', visuals: 'Loop pack A' } },
        { label: 'Changeover', itemTypeId: 'changeover', minSec: 300, maxSec: 600, cells: { audio: 'Booth feed down 6dB', booth: 'USB swap' } },
      ],
    },
    {
      name: 'Headline',
      cues: [
        { label: 'Headline set', itemTypeId: 'headliner', minSec: 7200, maxSec: 9000, cells: { audio: 'Limiter armed', lighting: 'Show look', visuals: 'Live feed' } },
        { label: 'Changeover to close', itemTypeId: 'changeover', minSec: 300, maxSec: 600, cells: { booth: 'USB swap' } },
        { label: 'Close-out set', itemTypeId: 'opener', minSec: 3600, maxSec: 5400, cells: { booth: 'Resident back on' } },
      ],
    },
    {
      name: 'Curfew',
      cues: [
        { label: 'Last track', itemTypeId: 'curfew', minSec: 300, maxSec: 480, cells: { audio: 'Hard out', lighting: 'House 100%' } },
        { label: 'Room clear', itemTypeId: 'curfew', minSec: 900, maxSec: 1500, cells: { lighting: 'Work lights' } },
      ],
    },
  ],
  'festival-stage': [
    {
      name: 'Stage prep',
      cues: [
        { label: 'Line check', itemTypeId: 'line-check', minSec: 1800, maxSec: 2700, cells: { audio: 'FOH + monitors', patch: 'House split' } },
        { label: 'Doors to the field', itemTypeId: 'line-check', minSec: 1800, maxSec: 2400, cells: { audio: 'Walk-in music' } },
      ],
    },
    {
      name: 'Day programme',
      // A stage is the same shape over and over: a set, then the window the
      // next act has to get on. Re-time one and everything after it moves.
      repeat: 5,
      cues: [
        { label: 'Set', itemTypeId: 'set', minSec: 2400, maxSec: 3600, cells: { monitors: '6 mixes', backline: 'Shared kit' } },
        { label: 'Changeover', itemTypeId: 'changeover', minSec: 900, maxSec: 1500, cells: { patch: 'Re-patch to next', backline: 'Risers roll' } },
      ],
    },
    {
      name: 'Headline',
      cues: [
        { label: 'Headline set', itemTypeId: 'set', minSec: 4200, maxSec: 5400, cells: { monitors: 'Own engineer', audio: 'Own control package' } },
        { label: 'Hard stop', itemTypeId: 'hard-stop', minSec: 300, maxSec: 600, cells: { audio: 'Noise curfew', patch: 'Strike to store' } },
      ],
    },
  ],
  'live-show': [
    {
      name: 'Load-in',
      cues: [
        { label: 'Load-in', minSec: 5400, maxSec: 7200, cells: { backline: 'Trucks to the dock' } },
        { label: 'Backline build and patch', minSec: 3600, maxSec: 5400, cells: { audio: 'Console file loaded', backline: 'Risers set' } },
        { label: 'Soundcheck, headline', minSec: 2700, maxSec: 3600, cells: { audio: 'FOH and monitors', lighting: 'Focus check' } },
        { label: 'Soundcheck, support', minSec: 900, maxSec: 1800, cells: { audio: 'Line check only' } },
      ],
    },
    {
      name: 'Show',
      cues: [
        { label: 'Doors open', itemTypeId: 'doors', minSec: 2700, maxSec: 3600, cells: { audio: 'Walk-in music', lighting: 'House 70%' } },
        { label: 'Support set', itemTypeId: 'support', minSec: 1800, maxSec: 2400, cells: { audio: 'Support package' } },
        { label: 'Changeover', itemTypeId: 'changeover', minSec: 1200, maxSec: 1800, cells: { backline: 'Reset to headline' } },
        { label: 'Headline set', itemTypeId: 'set', minSec: 4800, maxSec: 6000, cells: { audio: 'Show file', lighting: 'Show look', video: 'IMAG live' } },
        { label: 'Encore', itemTypeId: 'encore', minSec: 480, maxSec: 900, cells: { lighting: 'Encore look' } },
        { label: 'Walk-out', itemTypeId: 'walkout', minSec: 600, maxSec: 1200, cells: { audio: 'Walk-out music', lighting: 'House 100%' } },
      ],
    },
    {
      name: 'Out',
      cues: [
        { label: 'Strike and load-out', minSec: 3600, maxSec: 5400, cells: { backline: 'Trucks loaded' } },
        { label: 'Bus call', minSec: 600, maxSec: 900, cells: { notes: 'All aboard' } },
      ],
    },
  ],
  'runway-show': [
    {
      name: 'Pre-show',
      cues: [
        { label: 'Doors open', itemTypeId: 'segment', minSec: 1800, maxSec: 2400, cells: { music: 'Playlist A', lighting: 'House 70%' } },
        { label: 'Seating push', itemTypeId: 'segment', minSec: 600, maxSec: 900, cells: { music: 'Playlist A', lighting: 'House 50%' } },
        { label: 'House to half', itemTypeId: 'lighting', minSec: 60, maxSec: 120, cells: { lighting: 'LX 3, house 25%' } },
      ],
    },
    {
      name: 'Show',
      // A full collection: a real sheet is dozens of walk cues, which is also
      // what makes the drift cascade worth having.
      repeat: 34,
      cues: [
        { label: 'Look', itemTypeId: 'walk', minSec: 26, maxSec: 46, cells: { camera: 'Cam 2, runway' } },
      ],
    },
    {
      name: 'Finale',
      cues: [
        { label: 'Finale walk', itemTypeId: 'finale', minSec: 90, maxSec: 150, cells: { music: 'Track 4, finale', lighting: 'LX 22 full' } },
        { label: 'Designer bow', itemTypeId: 'bow', minSec: 30, maxSec: 60, cells: { camera: 'Cam 1, wide' } },
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
        { label: 'Doors, public', minSec: 3600, maxSec: 5400, cells: { station: 'All stations live' } },
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
        if (spec.label === 'Doors open' || spec.label === 'Doors and seating' || spec.label === 'Line check') {
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
