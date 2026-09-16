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

  if (/^\d+$/.test(text)) return Number(text);

  if (text.includes(':')) {
    const parts = text.split(':').map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  const match = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(text);
  if (match && (match[1] || match[2] || match[3])) {
    return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  }
  return null;
}

export function formatClock(iso: ISODate, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatEventWindow(startsAt: ISODate, endsAt: ISODate, timezone?: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  if (sameDay) return `${dateFmt.format(start)}, ${formatClock(startsAt, timezone)}`;
  return `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
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
export function deriveTimes(showStart: ISODate, cues: Cue[]): DerivedCueTime[] {
  const startMs = new Date(showStart).getTime();
  let clock = startMs;
  const out: DerivedCueTime[] = new Array(cues.length);

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    let driftSec = 0;
    let anchored = false;

    if (cue.anchor) {
      const anchorMs = new Date(cue.anchor.at).getTime();
      driftSec = Math.round((clock - anchorMs) / 1000);
      anchored = true;
      if (cue.anchor.mode === 'hard') clock = anchorMs;
    }

    const duration = Math.max(0, cue.durationSec || 0) * 1000;
    out[i] = {
      cueId: cue.id,
      plannedStart: new Date(clock).toISOString(),
      plannedEnd: new Date(clock + duration).toISOString(),
      driftSec,
      anchored,
    };
    clock += duration;
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
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatDay(iso: ISODate, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).format(new Date(iso));
}
