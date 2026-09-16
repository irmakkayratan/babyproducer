/**
 * Seating rules.
 *
 * Producers overrule these constantly, because a rule here is information. So
 * every rule evaluates to a violation that is surfaced on the seat and in a
 * panel, and only a rule explicitly marked `block` refuses the assignment.
 */
import type { Guest, SeatingMap, SeatingRule } from '@/data/types';
import { allSeats, type SeatPosition } from './geometry';

export interface Violation {
  ruleId: string;
  severity: 'warn' | 'block';
  message: string;
  seatIds: string[];
  guestIds: string[];
}

interface Context {
  map: SeatingMap;
  guests: Map<string, Guest>;
  /** Built once per evaluation: every rule needs the same two lookups. */
  seats: SeatPosition[];
  byGuest: Map<string, SeatPosition>;
}

/** How close two people a rule keeps apart may be seated, in canvas pixels. */
const KEEP_APART_RADIUS = 160;

function evaluateRule(rule: SeatingRule, context: Context): Violation[] {
  switch (rule.type) {
    case 'seat-together': {
      const positions = seatedSubjects(rule, context);
      if (positions.length < 2) return [];
      // Everyone on the same table counts as together; in a row they have to be
      // a contiguous block, so this compares the whole party. Checking only the
      // first two subjects missed real clashes.
      const elements = new Set(positions.map((position) => position.element.id));
      if (elements.size === 1) {
        if (positions[0].element.kind !== 'row') return [];
        const indices = positions.map((position) => position.index).sort((a, b) => a - b);
        const contiguous = indices.every((value, i) => i === 0 || value - indices[i - 1] === 1);
        if (contiguous) return [];
      }
      return [
        {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.label ?? 'These guests should be seated together',
          seatIds: positions.map((position) => position.seat.id),
          guestIds: rule.subjects,
        },
      ];
    }

    case 'keep-apart': {
      const positions = seatedSubjects(rule, context);
      if (positions.length < 2) return [];
      // Every pair gets checked. A rule naming three people is one
      // rule about all of them, and checking only subjects[0] and subjects[1]
      // reported a clean room while two of them sat next to each other.
      const offenders = new Map<string, SeatPosition>();
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) > KEEP_APART_RADIUS) continue;
          offenders.set(a.seat.id, a);
          offenders.set(b.seat.id, b);
        }
      }
      if (offenders.size === 0) return [];
      return [
        {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.label ?? 'These guests are seated too close together',
          seatIds: [...offenders.keys()],
          guestIds: [...offenders.values()].map((position) => position.seat.guestId!),
        },
      ];
    }

    case 'tier-in-zone': {
      if (!rule.zoneId || !rule.tierId) return [];
      const offenders = context.seats.filter((position) => {
        if (position.element.zoneId !== rule.zoneId) return false;
        const guestId = position.seat.guestId;
        if (!guestId) return false;
        const guest = context.guests.get(guestId);
        return guest ? guest.tierId !== rule.tierId : false;
      });
      if (offenders.length === 0) return [];
      return [
        {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.label ?? 'This zone is reserved for another tier',
          seatIds: offenders.map((position) => position.seat.id),
          guestIds: offenders.map((position) => position.seat.guestId!),
        },
      ];
    }

    case 'max-per-table': {
      const limit = rule.limit ?? 0;
      if (limit <= 0) return [];
      const violations: Violation[] = [];
      for (const element of context.map.elements) {
        if (!('seats' in element)) continue;
        if (rule.zoneId && element.zoneId !== rule.zoneId) continue;
        const seated = element.seats.filter((seat) => seat.guestId);
        if (seated.length <= limit) continue;
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.label ?? `${element.label} is over its limit of ${limit}`,
          seatIds: seated.map((seat) => seat.id),
          guestIds: seated.map((seat) => seat.guestId!),
        });
      }
      return violations;
    }

    default:
      return [];
  }
}

/** The seated position of each subject a rule names, in the rule's own order. */
function seatedSubjects(rule: SeatingRule, context: Context): SeatPosition[] {
  const seen = new Set<string>();
  const positions: SeatPosition[] = [];
  for (const guestId of rule.subjects) {
    if (seen.has(guestId)) continue;
    seen.add(guestId);
    const position = context.byGuest.get(guestId);
    if (position) positions.push(position);
  }
  return positions;
}

export function evaluateRules(map: SeatingMap, guests: Guest[]): Violation[] {
  // `allSeats` walks every element in the room. Building the indexes once here
  // keeps a room of a few thousand seats linear instead of re-walking it for
  // every subject of every rule.
  const seats = allSeats(map);
  const byGuest = new Map<string, SeatPosition>();
  for (const position of seats) {
    const guestId = position.seat.guestId;
    if (guestId && !byGuest.has(guestId)) byGuest.set(guestId, position);
  }
  const context: Context = {
    map,
    guests: new Map(guests.map((guest) => [guest.id, guest])),
    seats,
    byGuest,
  };
  return map.rules.flatMap((rule) => evaluateRule(rule, context));
}

/** Seat ids carrying at least one violation, for rendering. */
export function violatingSeatIds(violations: Violation[]): Set<string> {
  return new Set(violations.flatMap((violation) => violation.seatIds));
}

/**
 * Whether an assignment may proceed. Only `block` rules stop it; everything
 * else is reported and left to the producer's judgement.
 */
export function assignmentBlocked(
  map: SeatingMap,
  guests: Guest[],
  seatId: string,
  guestId: string,
): Violation | null {
  if (!allSeats(map).some((position) => position.seat.id === seatId)) return null;

  const speculative: SeatingMap = {
    ...map,
    elements: map.elements.map((element) => {
      if (!('seats' in element)) return element;
      return {
        ...element,
        seats: element.seats.map((seat) =>
          seat.id === seatId
            ? { ...seat, guestId }
            : seat.guestId === guestId
              ? { ...seat, guestId: undefined }
              : seat,
        ),
      };
    }),
  };

  return evaluateRules(speculative, guests).find((violation) => violation.severity === 'block') ?? null;
}
