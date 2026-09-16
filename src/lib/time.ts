import type { Cue, ISODate, Seconds } from '@/data/types';

/* ------------------------------------------------------------- formatting */

export function formatDuration(seconds: Seconds, opts: { forceHours?: boolean } = {}): string {
  const sign = seconds < 0 ? '-' : '';
  const total = Math.abs(Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0 || opts.forceHours) {
    return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Accepts what producers actually type: "90" (seconds), "4:12", "1:04:12",
 * "2m", "1h30m". Returns null when it cannot be understood, so the caller can
 * keep the previous value rather than silently writing a zero.
 */
export function parseDuration(input: string): Seconds | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  if (/^\d+$/.test(text)) return clampDuration(Number(text));

  if (text.includes(':')) {
    // Every segment must actually be digits. Reading "" as 0 turned ":" into a
    // zero-length cue — the silent zeroing this function exists to prevent.
    const parts = text.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    if (!parts.every((part) => /^\d+$/.test(part))) return null;
    const numbers = parts.map(Number);
    const seconds =
      numbers.length === 2
        ? numbers[0] * 60 + numbers[1]
        : numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
    return clampDuration(seconds);
  }

  const match = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(text);
  if (match && (match[1] || match[2] || match[3])) {
    return clampDuration(
      Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0),
    );
  }
  return null;
}

/**
 * A cue longer than this is a typo, not a plan. Accepting it would push the
 * derived clock past the range `Date` can represent, and the cue grid would
 * throw on the next render rather than reject the keystroke.
 */
export const MAX_DURATION_SEC = 100 * 24 * 3600;

function clampDuration(seconds: number): Seconds | null {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_DURATION_SEC) return null;
  return seconds;
}

/**
 * `Intl.DateTimeFormat` throws twice over: once at construction for a timezone
 * it does not recognise, and again at `format` for an unreadable date. Both are
 * reachable from imported or hand-edited data, and both would take down a page
 * that is only trying to print a time, so every formatter goes through here.
 */
function safeFormat(iso: ISODate, options: Intl.DateTimeFormatOptions, timezone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(date);
  } catch {
    // Fall back to the device's own zone rather than losing the value.
    try {
      return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch {
      return '—';
    }
  }
}

export function formatClock(iso: ISODate, timezone?: string): string {
  return safeFormat(iso, { hour: '2-digit', minute: '2-digit', hour12: false }, timezone);
}

export function formatEventWindow(startsAt: ISODate, endsAt: ISODate, timezone?: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dayOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (Number.isNaN(start.getTime())) return '—';
  const startLabel = safeFormat(startsAt, dayOpts, timezone);
  if (Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) {
    return `${startLabel}, ${formatClock(startsAt, timezone)}`;
  }
  return `${startLabel} – ${safeFormat(endsAt, dayOpts, timezone)}`;
}

export function relativeToNow(iso: ISODate, now = Date.now()): string {
  const diffMs = new Date(iso).getTime() - now;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return rtf.format(Math.round(diffMs / 1000), 'second');
}

export function countdownParts(target: ISODate, now = Date.now()) {
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    past: new Date(target).getTime() < now,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

/* --------------------------------------------------------- timing cascade */

export interface DerivedCueTime {
  cueId: string;
  /** Wall-clock start the cue is planned for, after anchors and drift. */
  plannedStart: ISODate;
  plannedEnd: ISODate;
  /** Offset from the running clock at this point, in seconds. */
  driftSec: Seconds;
  anchored: boolean;
}

/**
 * The auto-drift cascade.
 *
 * Start times are never stored — they are derived from `showStart` plus the
 * durations above each cue. A duration edit is therefore a single-field change
 * and this one O(n) pass re-times everything below it.
 *
 * A **hard** anchor pins a cue to a wall-clock time and resets the running
 * clock to it (the show waits, or is late, but the anchor holds). A **soft**
 * anchor reports how far off the plan is without moving it.
 */
/**
 * Largest instant `Date` can represent. Everything derived here is clamped to
 * it: a cue sheet is read live during a show, and a single unparseable date or
 * fat-fingered duration must not be able to throw from a render path.
 */
const MAX_TIME_MS = 8.64e15;

function clampMs(ms: number, fallback: number): number {
  if (!Number.isFinite(ms)) return fallback;
  return Math.min(Math.max(ms, -MAX_TIME_MS), MAX_TIME_MS);
}

export function deriveTimes(showStart: ISODate, cues: Cue[]): DerivedCueTime[] {
  // An unreadable show start is treated as the epoch rather than poisoning
  // every downstream instant with NaN.
  const startMs = clampMs(new Date(showStart).getTime(), 0);
  let clock = startMs;
  const out: DerivedCueTime[] = new Array(cues.length);

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    let driftSec = 0;
    let anchored = false;

    if (cue.anchor) {
      const anchorMs = new Date(cue.anchor.at).getTime();
      if (Number.isFinite(anchorMs)) {
        driftSec = Math.round((clock - anchorMs) / 1000);
        anchored = true;
        if (cue.anchor.mode === 'hard') clock = clampMs(anchorMs, clock);
      }
    }

    const rawDuration = Number(cue.durationSec);
    const duration = (Number.isFinite(rawDuration) ? Math.max(0, rawDuration) : 0) * 1000;
    const start = clampMs(clock, startMs);
    const end = clampMs(start + duration, start);
    out[i] = {
      cueId: cue.id,
      plannedStart: new Date(start).toISOString(),
      plannedEnd: new Date(end).toISOString(),
      driftSec,
      anchored,
    };
    clock = end;
  }

  return out;
}

/** Total planned runtime, honouring hard anchors that absorb or add time. */
export function totalRuntimeSec(showStart: ISODate, cues: Cue[]): Seconds {
  if (cues.length === 0) return 0;
  const times = deriveTimes(showStart, cues);
  const last = times[times.length - 1];
  return Math.round((new Date(last.plannedEnd).getTime() - new Date(showStart).getTime()) / 1000);
}

/**
 * How far the live show is running from plan: positive means over.
 * Compares the caller's actual position against the derived plan.
 */
export function liveDriftSec(
  showStart: ISODate,
  cues: Cue[],
  callerCueId: string | null,
  now = Date.now(),
): Seconds {
  if (!callerCueId) return 0;
  const times = deriveTimes(showStart, cues);
  const current = times.find((t) => t.cueId === callerCueId);
  if (!current) return 0;
  return Math.round((now - new Date(current.plannedStart).getTime()) / 1000);
}

/* ------------------------------------------------------- form field values */

/**
 * `<input type="date">` and `type="datetime-local"` speak local wall-clock
 * strings, not ISO instants. These convert in both directions and return
 * undefined for a cleared field, so an emptied date erases rather than
 * becoming the epoch.
 */
export function toDateInputValue(iso?: ISODate): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTimeInputValue(iso?: ISODate): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${toDateInputValue(iso)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromInputValue(value: string): ISODate | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "Tue 14 Mar, 18:30" — the format a day sheet is read in. */
export function formatDayTime(iso: ISODate, timezone?: string): string {
  return safeFormat(
    iso,
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false },
    timezone,
  );
}

export function formatDay(iso: ISODate, timezone?: string): string {
  return safeFormat(iso, { day: 'numeric', month: 'short' }, timezone);
}
