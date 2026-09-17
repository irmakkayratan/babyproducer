import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsv, toCsv } from '@/data/io/csv';

describe('CSV parsing', () => {
  it('handles quoted fields, embedded separators and newlines', () => {
    const { headers, rows } = parseCsv('Name,Company\n"Doe, Jane","House of ""Onyx"""\n"Multi\nline",Acme');
    expect(headers).toEqual(['Name', 'Company']);
    expect(rows[0]).toEqual(['Doe, Jane', 'House of "Onyx"']);
    expect(rows[1]).toEqual(['Multi\nline', 'Acme']);
  });

  it('detects semicolon and tab separated files', () => {
    expect(parseCsv('Name;Email\nA;a@example.com').headers).toEqual(['Name', 'Email']);
    expect(parseCsv('Name\tEmail\nA\ta@example.com').headers).toEqual(['Name', 'Email']);
  });

  it('skips blank lines so no empty guests are imported', () => {
    expect(parseCsv('Name\nA\n\n\nB').rows).toHaveLength(2);
  });

  it('round-trips through export', () => {
    const csv = toCsv([{ Name: 'Doe, Jane', Notes: 'Says "hello"' }]);
    const parsed = parseCsv(csv);
    expect(parsed.rows[0]).toEqual(['Doe, Jane', 'Says "hello"']);
  });
});

describe('header mapping', () => {
  it('guesses the obvious columns', () => {
    const mapping = guessMapping(['Full Name', 'Instagram', 'Publication', 'RSVP', '+1']);
    expect(mapping['Full Name']).toBe('name');
    expect(mapping['Instagram']).toBe('handle');
    expect(mapping['Publication']).toBe('company');
    expect(mapping['RSVP']).toBe('statusId');
    expect(mapping['+1']).toBe('plusOnes');
  });

  it('leaves unknown columns unmapped so the user can promote them to fields', () => {
    expect(guessMapping(['Dietary requirements'])['Dietary requirements']).toBe('ignore');
  });

  it('never maps two source columns onto the same target', () => {
    const mapping = guessMapping(['Name', 'Guest Name']);
    const targets = Object.values(mapping).filter((t) => t === 'name');
    expect(targets).toHaveLength(1);
  });
});
