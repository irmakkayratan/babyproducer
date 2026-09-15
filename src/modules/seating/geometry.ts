/**
 * Seating geometry and presets.
 *
 * Rooms are described as elements on a canvas: a stage or runway, rows of
 * chairs, banquet tables. Seats carry their own ids so an assignment survives
 * the element being moved or renamed.
 */
import type { Seat, SeatingElement, SeatingMap } from '@/data/types';
import { ulid } from '@/lib/id';

export interface SeatPosition {
  seat: Seat;
  element: SeatingElement;
  x: number;
  y: number;
  index: number;
}

const SEAT_SIZE = 22;
const SEAT_GAP = 6;

/** Absolute seat positions, used for hit-testing, rendering and printing. */
export function seatPositions(element: SeatingElement): SeatPosition[] {
  if (element.kind === 'row') {
    return element.seats.map((seat, index) => ({
      seat,
      element,
      index,
      x: element.x + index * (SEAT_SIZE + SEAT_GAP),
      y: element.y,
    }));
  }

  if (element.kind === 'table') {
    const count = element.seats.length;
    if (element.shape === 'round') {
      const radius = Math.max(element.w, element.h) / 2 + SEAT_SIZE * 0.9;
      const cx = element.x + element.w / 2;
      const cy = element.y + element.h / 2;
      return element.seats.map((seat, index) => {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
        return {
          seat,
          element,
          index,
          x: cx + Math.cos(angle) * radius - SEAT_SIZE / 2,
          y: cy + Math.sin(angle) * radius - SEAT_SIZE / 2,
        };
      });
    }
    // Rectangular tables seat people along the long edges.
    const perSide = Math.ceil(count / 2);
    return element.seats.map((seat, index) => {
      const side = index < perSide ? 0 : 1;
      const offset = side === 0 ? index : index - perSide;
      return {
        seat,
        element,
        index,
        x: element.x + offset * (SEAT_SIZE + SEAT_GAP),
        y: side === 0 ? element.y - SEAT_SIZE - 4 : element.y + element.h + 4,
      };
    });
  }

  return [];
}

export function allSeats(map: SeatingMap): SeatPosition[] {
  return map.elements.flatMap(seatPositions);
}

export function seatCount(map: SeatingMap): number {
  return map.elements.reduce((total, element) => total + ('seats' in element ? element.seats.length : 0), 0);
}

function makeSeats(count: number, labelPrefix: string, tierHint?: string): Seat[] {
  return Array.from({ length: count }, (_, index) => ({
    id: ulid(),
    label: `${labelPrefix}${index + 1}`,
    tierHint,
  }));
}

export function makeRow(options: {
  label: string;
  seats: number;
  x: number;
  y: number;
  zoneId?: string;
  tierHint?: string;
}): SeatingElement {
  return {
    kind: 'row',
    id: ulid(),
    label: options.label,
    zoneId: options.zoneId,
    x: options.x,
    y: options.y,
    w: options.seats * (SEAT_SIZE + SEAT_GAP),
    h: SEAT_SIZE,
    rotation: 0,
    seats: makeSeats(options.seats, `${options.label}-`, options.tierHint),
  };
}

export function makeTable(options: {
  label: string;
  seats: number;
  x: number;
  y: number;
  shape?: 'round' | 'rect';
  zoneId?: string;
}): SeatingElement {
  const shape = options.shape ?? 'round';
  return {
    kind: 'table',
    id: ulid(),
    label: options.label,
    zoneId: options.zoneId,
    shape,
    x: options.x,
    y: options.y,
    w: shape === 'round' ? 90 : 160,
    h: shape === 'round' ? 90 : 70,
    rotation: 0,
    seats: makeSeats(options.seats, `${options.label}.`),
  };
}

export function makeStage(options: {
  kind: 'stage' | 'runway' | 'entrance' | 'bar' | 'prop';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}): SeatingElement {
  return { ...options, id: ulid(), rotation: 0 };
}

export { SEAT_SIZE, SEAT_GAP };
