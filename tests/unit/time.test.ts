import { describe, expect, it } from 'vitest';
import { deriveTimes, formatDuration, liveDriftSec, parseDuration, totalRuntimeSec } from '@/lib/time';
import type { Cue } from '@/data/types';

const cue = (id: string, durationSec: number, extra: Partial<Cue> = {}): Cue => ({
  id,
  label: id,
  durationSec,
  cells: {},
  ...extra,
});

const SHOW_START = '2027-03-04T19:00:00.000Z';

describe('parseDuration', () => {
  it('accepts the shapes producers actually type', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('4:12')).toBe(252);
    expect(parseDuration('1:04:12')).toBe(3852);
    expect(parseDuration('2m')).toBe(120);
    expect(parseDuration('1h30m')).toBe(5400);
    expect(parseDuration('45s')).toBe(45);
  });

  it('returns null for nonsense, so a bad keystroke cannot wipe a cue', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:2:3:4')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats with tabular-friendly padding', () => {
    expect(formatDuration(252)).toBe('4:12');
    expect(formatDuration(3852)).toBe('1:04:12');
    expect(formatDuration(-90)).toBe('-1:30');
    expect(formatDuration(59, { forceHours: true })).toBe('0:00:59');
  });
});

describe('deriveTimes: the auto-drift cascade', () => {
  it('cascades start times from durations', () => {
    const cues = [cue('a', 600), cue('b', 300), cue('c', 900)];
    const times = deriveTimes(SHOW_START, cues);
    expect(times.map((t) => t.plannedStart)).toEqual([
      '2027-03-04T19:00:00.000Z',
      '2027-03-04T19:10:00.000Z',
      '2027-03-04T19:15:00.000Z',
    ]);
    expect(times[2].plannedEnd).toBe('2027-03-04T19:30:00.000Z');
  });

  it('re-times every later cue when one duration changes', () => {
    const before = deriveTimes(SHOW_START, [cue('a', 600), cue('b', 300), cue('c', 900)]);
    const after = deriveTimes(SHOW_START, [cue('a', 852), cue('b', 300), cue('c', 900)]);
    expect(after[0].plannedStart).toBe(before[0].plannedStart);
    // A speaker running 4:12 long pushes everything below by exactly 4:12.
    for (const index of [1, 2]) {
      const delta =
        new Date(after[index].plannedStart).getTime() - new Date(before[index].plannedStart).getTime();
      expect(delta).toBe(252_000);
    }
  });

  it('a hard anchor absorbs drift and resets the running clock', () => {
    const cues = [
      cue('a', 600),
      cue('b', 300, { anchor: { at: '2027-03-04T19:30:00.000Z', mode: 'hard' } }),
      cue('c', 600),
    ];
    const times = deriveTimes(SHOW_START, cues);
    expect(times[1].plannedStart).toBe('2027-03-04T19:30:00.000Z');
    // Running 15 minutes early against the anchor is reported as negative drift.
    expect(times[1].driftSec).toBe(-1200);
    expect(times[2].plannedStart).toBe('2027-03-04T19:35:00.000Z');
  });

  it('a soft anchor reports drift without moving the plan', () => {
    const cues = [cue('a', 600), cue('b', 300, { anchor: { at: '2027-03-04T19:00:00.000Z', mode: 'soft' } })];
    const times = deriveTimes(SHOW_START, cues);
    expect(times[1].plannedStart).toBe('2027-03-04T19:10:00.000Z');
    expect(times[1].driftSec).toBe(600);
  });

  it('re-times 500 cues in well under a frame', () => {
    const cues = Array.from({ length: 500 }, (_, i) => cue(`c${i}`, 60 + (i % 7)));
    const start = performance.now();
    for (let i = 0; i < 10; i++) deriveTimes(SHOW_START, cues);
    const perRun = (performance.now() - start) / 10;
    expect(perRun).toBeLessThan(16);
  });
});

describe('runtime and live drift', () => {
  it('totals the planned runtime', () => {
    expect(totalRuntimeSec(SHOW_START, [cue('a', 600), cue('b', 300)])).toBe(900);
  });

  it('reports the caller running late as positive drift', () => {
    const cues = [cue('a', 600), cue('b', 300)];
    const now = new Date('2027-03-04T19:12:30.000Z').getTime();
    expect(liveDriftSec(SHOW_START, cues, 'b', now)).toBe(150);
  });
});
