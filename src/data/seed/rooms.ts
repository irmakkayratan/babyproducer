/**
 * Room presets.
 *
 * Room shapes and zone names are content, not code: a runway's "Front Row" is
 * exactly the kind of vocabulary the app must not assume, so it lives here
 * with the other seed data and is editable once loaded.
 */
import type { SeatingElement, SeatingMap, Zone } from '@/data/types';
import type { Rng } from '@/lib/rng';
import { seededIds, ulid } from '@/lib/id';
import { makeRow, makeStage, makeTable } from '@/modules/seating/geometry';

const ZONES: Record<string, Zone[]> = {
  runway: [
    { id: 'front-row', label: 'Front Row', order: 0, color: 'tier-1' },
    { id: 'second-row', label: 'Second Row', order: 1, color: 'tier-2' },
    { id: 'riser', label: 'Riser', order: 2, color: 'tier-3' },
    { id: 'standing', label: 'Standing', order: 3, color: 'tier-6' },
  ],
  theatre: [
    { id: 'reserved', label: 'Reserved', order: 0, color: 'tier-2' },
    { id: 'general', label: 'General', order: 1, color: 'tier-6' },
  ],
  banquet: [
    { id: 'head', label: 'Head Tables', order: 0, color: 'tier-1' },
    { id: 'floor', label: 'Floor', order: 1, color: 'tier-3' },
  ],
  'open-floor': [{ id: 'floor', label: 'Floor', order: 0, color: 'tier-3' }],
};

/**
 * Room presets. A runway is two facing banks of rows; a theatre is a fan of
 * rows facing a stage; a banquet is a grid of tables.
 */
export interface PresetOptions {
  /** Rooms are built to the event's capacity rather than a fixed size. */
  capacity?: number;
  rng?: Rng;
}

export function buildPreset(
  preset: 'runway' | 'theatre' | 'banquet' | 'open-floor' | 'none',
  eventId: string,
  options: PresetOptions = {},
): SeatingMap | null {
  if (preset === 'none') return null;
  const { capacity, rng } = options;
  // With a seeded rng, ids come from the seed so the room rebuilds identically.
  const makeId = rng ? seededIds(rng.next) : ulid;
  const iso = new Date().toISOString();
  const base = {
    id: makeId(),
    eventId,
    createdAt: iso,
    updatedAt: iso,
    rev: 1,
  };

  if (preset === 'runway') {
    // Two banks facing a central runway, sized to the house.
    const rows = capacity && capacity > 260 ? 6 : 4;
    const perRow = Math.max(8, Math.ceil((capacity ?? 80) / (rows * 2)));
    const bankWidth = perRow * 28;
    const runwayX = 80 + bankWidth + 60;
    const width = runwayX + 120 + 60 + bankWidth + 80;
    const height = Math.max(640, 160 + rows * 46 + 220);

    const elements: SeatingElement[] = [
      makeStage({ kind: 'runway', label: 'Runway', x: runwayX, y: 80, w: 120, h: height - 180 }),
      makeStage({ kind: 'entrance', label: 'Entrance', x: 40, y: height - 70, w: 120, h: 40, makeId }),
    ];
    for (let bank = 0; bank < 2; bank++) {
      const xBase = bank === 0 ? 80 : runwayX + 180;
      for (let row = 0; row < rows; row++) {
        elements.push(
          makeRow({
            label: `${bank === 0 ? 'L' : 'R'}${row + 1}`,
            seats: perRow,
            x: xBase,
            y: 120 + row * 46,
            zoneId: row === 0 ? 'front-row' : row === 1 ? 'second-row' : 'riser',
            makeId,
          }),
        );
      }
    }
    return {
      ...base,
      name: 'Runway room',
      canvas: { width, height, gridSize: 10 },
      zones: ZONES.runway,
      elements,
      rules: [],
    };
  }

  if (preset === 'theatre') {
    const rows = capacity ? Math.max(6, Math.min(24, Math.ceil(capacity / 18))) : 8;
    const elements: SeatingElement[] = [makeStage({ kind: 'stage', label: 'Stage', x: 280, y: 60, w: 440, h: 90, makeId })];
    for (let row = 0; row < rows; row++) {
      const seats = capacity ? Math.ceil(capacity / rows) : 12 + Math.min(row, 4);
      elements.push(
        makeRow({
          label: String.fromCharCode(65 + row),
          seats,
          x: 500 - (seats * 28) / 2,
          y: 220 + row * 46,
          zoneId: row < 2 ? 'reserved' : 'general',
          makeId,
        }),
      );
    }
    return {
      ...base,
      name: 'Theatre room',
      canvas: { width: 1100, height: Math.max(760, 260 + rows * 46), gridSize: 10 },
      zones: ZONES.theatre,
      elements,
      rules: [],
    };
  }

  if (preset === 'banquet') {
    const tables = capacity ? Math.max(4, Math.ceil(capacity / 8)) : 12;
    const columns = 4;
    const tableRows = Math.ceil(tables / columns);
    const elements: SeatingElement[] = [makeStage({ kind: 'stage', label: 'Stage', x: 380, y: 40, w: 240, h: 70, makeId })];
    let index = 0;
    for (let row = 0; row < tableRows; row++) {
      for (let column = 0; column < columns && index < tables; column++) {
        index++;
        elements.push(
          makeTable({
            label: `T${index}`,
            seats: 8,
            x: 160 + column * 200,
            y: 220 + row * 200,
            zoneId: row === 0 ? 'head' : 'floor',
            makeId,
          }),
        );
      }
    }
    return {
      ...base,
      name: 'Banquet room',
      canvas: { width: 1000, height: Math.max(820, 260 + tableRows * 200), gridSize: 10 },
      zones: ZONES.banquet,
      elements,
      rules: [],
    };
  }

  return {
    ...base,
    name: 'Open floor',
    canvas: { width: 900, height: 650, gridSize: 10 },
    zones: ZONES['open-floor'],
    elements: [
      makeStage({ kind: 'entrance', label: 'Entrance', x: 40, y: 560, w: 120, h: 40, makeId }),
      makeStage({ kind: 'bar', label: 'Bar', x: 600, y: 80, w: 220, h: 60, makeId }),
    ],
    rules: [],
  };
}

