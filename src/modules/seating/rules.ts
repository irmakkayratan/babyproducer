/**
 * Seating rules.
 *
 * Producers overrule these constantly — a rule is information, not a lock. So
 * every rule evaluates to a violation that is surfaced on the seat and in a
 * panel, and only a rule explicitly marked `block` refuses the assignment.
 */
import type { Guest, SeatingMap, SeatingRule } from '@/data/types';
import { allSeats } from './geometry';

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
}

function seatIndexById(map: SeatingMap) {
  const positions = allSeats(map);
  return new Map(positions.map((position) => [position.seat.id, position]));
}

function seatOfGuest(map: SeatingMap, guestId: string) {
  return allSeats(map).find((position) => position.seat.guestId === guestId);
}

function evaluateRule(rule: SeatingRule, context: Context): Violation[] {
  const { map } = context;

  switch (rule.type) {
    case 'seat-together': {
      const positions = rule.subjects.map((guestId) => seatOfGuest(map, guestId)).filter(Boolean);
      if (positions.length < 2) return [];
      const elements = new Set(positions.map((position) => position!.element.id));
      if (elements.size === 1) {
        // Same row or table — check they are actually adjacent in a row.
        const [first, second] = positions as NonNullable<(typeof positions)[number]>[];
        if (first.element.kind !== 'row' || Math.abs(first.index - second.index) === 1) return [];
      }
      return [
        {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.label ?? 'These guests should be seated together',
          seatIds: positions.map((position) => position!.seat.id),
          guestIds: rule.subjects,
        },
      ];
    }

    case 'keep-apart': {
      const positions = rule.subjects.map((guestId) => seatOfGuest(map, guestId)).filter(Boolean);
      if (positions.length < 2) return [];
      const [first, second] = positions as NonNullable<(typeof positions)[number]>[];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance > 160) return [];
      return [
        {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.label ?? 'These guests are seated too close together',
          seatIds: [first.seat.id, second.seat.id],
          guestIds: rule.subjects,
        },
      ];
    }

    case 'tier-in-zone': {
      if (!rule.zoneId || !rule.tierId) return [];
      const offenders = allSeats(map).filter((position) => {
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
      for (const element of map.elements) {
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

export function evaluateRules(map: SeatingMap, guests: Guest[]): Violation[] {
  const context: Context = { map, guests: new Map(guests.map((guest) => [guest.id, guest])) };
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
  const seats = seatIndexById(map);
  if (!seats.has(seatId)) return null;

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
