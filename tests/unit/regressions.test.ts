/**
 * Regression tests for defects found during a full-scale audit.
 *
 * Each case below is a bug that shipped: the app typechecked, linted and passed
 * every existing test while doing the wrong thing. They are grouped by the
 * failure they guard against, because that is what makes
 * a broken one legible when it fails in CI.
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

import { deriveTimes, formatClock, formatDay, formatEventWindow, parseDuration } from '@/lib/time';
import { evaluateFormula, parseFormula, validateFormula } from '@/lib/formula';
import { guessMapping, toCsv } from '@/data/io/csv';
import { editDistance, matchByToken, matchGuests } from '@/modules/checkin/match';
import { computeSettlement, formatMoney, round2 } from '@/modules/settlement/math';
import { isWorkspaceExport, importWorkspace } from '@/data/io/workspace';
import { evaluateRules } from '@/modules/seating/rules';
import { insertCue, openRundown, readCues } from '@/modules/rundown/doc';
import type { Cue, Guest, SeatingMap, SettlementSheet } from '@/data/types';

/* ------------------------------------------------- the cue sheet cannot throw */

describe('the timing cascade survives whatever is in the document', () => {
  const cue = (over: Partial<Cue> = {}): Cue =>
    ({ id: 'c1', label: 'Cue', durationSec: 60, cells: {}, ...over }) as Cue;

  it('rejects a duration long enough to overflow the clock', () => {
    // Typed into a duration cell, this used to parse and then throw a
    // RangeError out of every render of the grid.
    expect(parseDuration('99999999999999999999')).toBeNull();
    expect(parseDuration('9999999')).toBeNull();
  });

  it('does not throw on an out-of-range duration that reached the document', () => {
    expect(() => deriveTimes('2027-03-01T18:00:00.000Z', [cue({ durationSec: 1e22 })])).not.toThrow();
    expect(() => deriveTimes('2027-03-01T18:00:00.000Z', [cue({ durationSec: NaN })])).not.toThrow();
  });

  it('does not throw on an unreadable show start or anchor', () => {
    expect(() => deriveTimes('not-a-date', [cue()])).not.toThrow();
    expect(() =>
      deriveTimes('2027-03-01T18:00:00.000Z', [cue({ anchor: { at: 'nope', mode: 'hard' } })]),
    ).not.toThrow();
  });

  it('still derives ordinary times correctly', () => {
    const [first, second] = deriveTimes('2027-03-01T18:00:00.000Z', [
      cue({ id: 'a', durationSec: 600 }),
      cue({ id: 'b', durationSec: 300 }),
    ]);
    expect(first.plannedStart).toBe('2027-03-01T18:00:00.000Z');
    expect(second.plannedStart).toBe('2027-03-01T18:10:00.000Z');
    expect(second.plannedEnd).toBe('2027-03-01T18:15:00.000Z');
  });
});

describe('a blank clock segment is not a zero-length cue', () => {
  it.each([':', '::', ' : ', 'a:b', '1::2'])('rejects %j', (input) => {
    expect(parseDuration(input)).toBeNull();
  });

  it('still reads what producers actually type', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('4:12')).toBe(252);
    expect(parseDuration('1:04:12')).toBe(3852);
    expect(parseDuration('2m')).toBe(120);
    expect(parseDuration('1h30m')).toBe(5400);
  });
});

describe('date formatting never takes a page down', () => {
  it('returns a placeholder when the value is unreadable', () => {
    expect(() => formatClock('nonsense')).not.toThrow();
    expect(formatClock('nonsense')).toBe('-');
    expect(() => formatDay('nonsense')).not.toThrow();
    expect(() => formatEventWindow('nonsense', 'nonsense')).not.toThrow();
  });

  it('falls back to the device zone when the event names one that does not exist', () => {
    expect(() => formatClock('2027-03-01T18:00:00.000Z', 'Not/AZone')).not.toThrow();
    expect(formatClock('2027-03-01T18:00:00.000Z', 'Not/AZone')).not.toBe('-');
  });
});

/* --------------------------------------------------- the settlement statement */

describe('a settlement is not lost to a bad currency code', () => {
  const sheet = (currency: string): SettlementSheet =>
    ({
      id: 's', eventId: 'e', currency,
      scaling: [{ id: 't', label: 'Floor', price: 50, allotment: 100, sold: 80, comps: 5 }],
      otherRevenue: [], deductions: [], expenses: [],
      parties: [
        {
          id: 'p', name: 'Headline', deal: { kind: 'flat', basis: 'net', guarantee: 1000, percentage: 0 },
          adjustments: [], withholdingPercent: 0, deposit: 0,
        },
      ],
      finalized: false,
    }) as unknown as SettlementSheet;

  it('still computes when the code is not a currency', () => {
    expect(() => computeSettlement(sheet('XX'))).not.toThrow();
    expect(computeSettlement(sheet('XX')).ticketGross).toBe(4000);
  });

  it('formats an unknown code without throwing', () => {
    expect(() => formatMoney(10, 'XX')).not.toThrow();
    expect(() => formatMoney(10, '')).not.toThrow();
    expect(() => formatMoney(Number.NaN, 'EUR')).not.toThrow();
    expect(formatMoney(10, 'EUR')).toContain('10');
  });

  it('rounds a credit and the debit reversing it to the same magnitude', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-2.675)).toBe(-2.68);
    expect(round2(1.004)).toBe(1);
    expect(round2(0)).toBe(0);
  });
});

/* ---------------------------------------------------------- importing a file */

describe('a malformed workspace file is refused, not crashed on', () => {
  const base = { format: 'atelier.workspace', version: 2, workspace: { id: 'w', name: 'N', schema: {} } };

  it.each([
    ['no events array', { ...base }],
    ['events is not an array', { ...base, events: 'nope' }],
    ['an event without an id', { ...base, events: [{}] }],
    ['data present but incomplete', { ...base, events: [], data: {} }],
    ['data is not an object', { ...base, events: [], data: 7 }],
    ['no workspace', { format: 'atelier.workspace', version: 2, events: [] }],
  ])('rejects %s', (_label, payload) => {
    expect(isWorkspaceExport(payload)).toBe(false);
  });

  it('fails with the message a person can act on', async () => {
    await expect(importWorkspace({ ...base, events: 'nope' })).rejects.toThrow(
      'That file is not a BabyProducer workspace export.',
    );
  });

  it('still accepts a well-formed export, with and without data', () => {
    expect(isWorkspaceExport({ ...base, events: [{ id: 'e' }] })).toBe(true);
    expect(
      isWorkspaceExport({
        ...base,
        events: [{ id: 'e' }],
        data: {
          guests: [], companies: [], seatingMaps: [], arrivals: [],
          telemetry: [], dashboards: [], rundowns: [],
        },
      }),
    ).toBe(true);
  });
});

/* ------------------------------------------------------------ importing a CSV */

describe('CSV header mapping matches words, not substrings', () => {
  it('does not read a hotel column as a phone number', () => {
    expect(guessMapping(['Hotel'])).toEqual({ Hotel: 'ignore' });
  });

  it('does not read a designer column as a social handle', () => {
    expect(guessMapping(['Designer'])).toEqual({ Designer: 'ignore' });
    expect(guessMapping(['Assigned Seat'])).toEqual({ 'Assigned Seat': 'ignore' });
  });

  it('prefers an exact header over a longer one containing it', () => {
    const mapping = guessMapping(['Company Email', 'Email']);
    expect(mapping.Email).toBe('email');
    expect(mapping['Company Email']).not.toBe('email');
  });

  it('still maps the headers a real list arrives with', () => {
    expect(guessMapping(['Name', 'Instagram', 'Company', 'Email', 'Plus Ones', 'Followers'])).toEqual({
      Name: 'name',
      Instagram: 'handle',
      Company: 'company',
      Email: 'email',
      'Plus Ones': 'plusOnes',
      Followers: 'followers',
    });
  });
});

describe('an exported CSV cannot execute in a spreadsheet', () => {
  it('neutralizes a guest name that is a formula', () => {
    expect(toCsv([{ Name: '=HYPERLINK("http://evil.test","x")' }])).toContain("\"'=HYPERLINK");
    expect(toCsv([{ Name: '@SUM(1+1)' }])).toBe("Name\n'@SUM(1+1)");
    expect(toCsv([{ Name: '+1234' }])).toBe("Name\n+1234");
  });

  it('leaves the numbers an accounts department needs alone', () => {
    expect(toCsv([{ Amount: -1234.5 }])).toBe('Amount\n-1234.5');
    expect(toCsv([{ Amount: 0 }])).toBe('Amount\n0');
  });

  it('quotes a lone carriage return so the row does not split', () => {
    expect(toCsv([{ Note: 'a\rb' }])).toBe('Note\n"a\rb"');
  });

  it('escapes a header that needs it', () => {
    expect(toCsv([{ 'a,b': 1 }])).toBe('"a,b"\n1');
  });
});

/* --------------------------------------------------------------------- a door */

describe('the door tolerates a transposition', () => {
  it('counts two swapped letters as one edit', () => {
    expect(editDistance('ab', 'ba')).toBe(1);
    expect(editDistance('jonathan', 'jnoathan')).toBe(1);
  });

  it('still measures ordinary edits', () => {
    expect(editDistance('kitten', 'kitten')).toBe(0);
    expect(editDistance('kitten', 'sitten')).toBe(1);
    expect(editDistance('kitten', 'sittin')).toBe(2);
    expect(editDistance('abc', 'xyzabc', 2)).toBe(3);
  });

  it('finds a guest whose name was typed with a swap', () => {
    const guests = [{ id: 'g1', name: 'Jonathan Reyes', tags: [], qrToken: 'AAA' }] as unknown as Guest[];
    expect(matchGuests(guests, 'Jnoathan')[0]?.guest.id).toBe('g1');
  });

  it('scans a list containing a guest imported without a badge token', () => {
    const guests = [
      { id: 'g1', name: 'No Token', tags: [] },
      { id: 'g2', name: 'Has Token', tags: [], qrToken: 'ABC123' },
    ] as unknown as Guest[];
    expect(() => matchByToken(guests, 'ABC123')).not.toThrow();
    expect(matchByToken(guests, 'ABC123')?.id).toBe('g2');
  });
});

/* ------------------------------------------------------------------- the room */

describe('a keep-apart rule covers everyone it names', () => {
  const room = (assignments: Record<string, string>): SeatingMap =>
    ({
      id: 'm', eventId: 'e', name: 'Room', w: 2000, h: 600, zones: [],
      elements: [
        {
          kind: 'row', id: 'r1', label: 'A', x: 0, y: 0, w: 2000, h: 22, rotation: 0,
          seats: Array.from({ length: 40 }, (_, i) => ({
            id: `s${i + 1}`,
            label: `A-${i + 1}`,
            guestId: assignments[`s${i + 1}`],
          })),
        },
      ],
      rules: [
        { id: 'k', type: 'keep-apart', severity: 'warn', subjects: ['g1', 'g2', 'g3'], label: 'apart' },
      ],
    }) as unknown as SeatingMap;

  const guests = [
    { id: 'g1', name: 'One' }, { id: 'g2', name: 'Two' }, { id: 'g3', name: 'Three' },
  ] as unknown as Guest[];

  it('reports a clash between the second and third subject', () => {
    // g1 far away; g2 and g3 side by side. Only the first two subjects used to
    // be compared, so this room reported clean.
    const violations = evaluateRules(room({ s1: 'g1', s39: 'g2', s40: 'g3' }), guests);
    expect(violations).toHaveLength(1);
    expect(violations[0].seatIds.sort()).toEqual(['s39', 's40']);
  });

  it('reports a clash between the first and third subject', () => {
    const violations = evaluateRules(room({ s1: 'g1', s2: 'g3', s40: 'g2' }), guests);
    expect(violations).toHaveLength(1);
    expect(violations[0].seatIds.sort()).toEqual(['s1', 's2']);
  });

  it('stays quiet when everyone is far apart', () => {
    expect(evaluateRules(room({ s1: 'g1', s20: 'g2', s40: 'g3' }), guests)).toEqual([]);
  });
});

/* ---------------------------------------------------------------- the rundown */

describe('one event has exactly one rundown document', () => {
  it('serializes concurrent opens', async () => {
    // The grid, the caller bar and the stage timer mount in the same tick; each
    // used to build its own document and the last one registered won.
    const handles = await Promise.all([
      openRundown('evt-concurrent'),
      openRundown('evt-concurrent'),
      openRundown('evt-concurrent'),
    ]);
    expect(handles[1].doc).toBe(handles[0].doc);
    expect(handles[2].doc).toBe(handles[0].doc);

    insertCue(handles[0].doc, 0, { id: 'cue-a', label: 'From the grid' });
    expect(readCues(handles[1].doc).map((cue) => cue.id)).toEqual(['cue-a']);
    expect(readCues(handles[2].doc).map((cue) => cue.id)).toEqual(['cue-a']);
    for (const handle of handles) handle.destroy();
  });

  it('survives a surface unmounting more times than it mounted', async () => {
    const handle = await openRundown('evt-double-release');
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
    const reopened = await openRundown('evt-double-release');
    expect(reopened.doc).toBeDefined();
    reopened.destroy();
  });
});

describe('a new cue gets its defaults', () => {
  it('ignores explicitly undefined fields', () => {
    const doc = new Y.Doc();
    insertCue(doc, 0, { id: undefined, label: undefined, durationSec: undefined });
    const [cue] = readCues(doc);
    expect(cue.id).not.toBe('undefined');
    expect(cue.id).toBeTruthy();
    expect(cue.label).toBe('New cue');
    expect(cue.durationSec).toBe(300);
  });

  it('still honours the values a caller does supply', () => {
    const doc = new Y.Doc();
    insertCue(doc, 0, { id: 'given', label: 'Doors', durationSec: 900 });
    expect(readCues(doc)[0]).toMatchObject({ id: 'given', label: 'Doors', durationSec: 900 });
  });
});

/* --------------------------------------------------------------- the formulas */

describe('the formula language', () => {
  it('negates the power, not the base', () => {
    expect(evaluateFormula('-2^2', {})).toBe(-4);
    expect(evaluateFormula('(-2)^2', {})).toBe(4);
    expect(evaluateFormula('-a * b', { a: 2, b: 3 })).toBe(-6);
    expect(evaluateFormula('2 - -3', {})).toBe(5);
  });

  it('names a formula nested too deeply instead of overflowing the stack', () => {
    const deep = '('.repeat(5000) + '1' + ')'.repeat(5000);
    expect(() => parseFormula(deep)).toThrow(/nested too deeply/);
    expect(validateFormula(deep, [])?.message).toMatch(/nested too deeply/);
  });

  it('caches parsed formulas without changing what they mean', () => {
    const scope = { reach: 1000, rate: 2 };
    expect(evaluateFormula('reach * rate', scope)).toBe(2000);
    expect(evaluateFormula('reach * rate', { reach: 5, rate: 3 })).toBe(15);
  });

  it('still refuses to reach outside its scope', () => {
    expect(() => evaluateFormula('constructor', {})).toThrow(/Unknown value/);
    expect(() => evaluateFormula('__proto__', {})).toThrow(/Unknown value/);
  });
});
