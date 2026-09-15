import { describe, expect, it } from 'vitest';
import { editDistance, matchByToken, matchGuests } from '@/modules/checkin/match';
import type { Guest } from '@/data/types';

const guest = (name: string, extra: Partial<Guest> = {}): Guest => ({
  id: name.toLowerCase().replace(/\W/g, ''),
  eventId: 'e1',
  name,
  statusId: 'confirmed',
  plusOnes: 0,
  tags: [],
  fields: {},
  qrToken: name.slice(0, 4).toUpperCase(),
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
  rev: 1,
  ...extra,
});

const guests = [
  guest('Amara Valberg', { handle: '@amara', company: 'Sable Review' }),
  guest('Anouk Fenrand', { company: 'Maison Onyx' }),
  guest('Jun Morholm'),
  guest('Amaré Vallberg'),
];

describe('edit distance', () => {
  it('measures single-character mistakes', () => {
    expect(editDistance('valberg', 'valberg')).toBe(0);
    expect(editDistance('valberg', 'valburg')).toBe(1);
    expect(editDistance('valberg', 'vallberg')).toBe(1);
  });

  it('bails out early on hopeless comparisons', () => {
    expect(editDistance('a', 'completely different', 3)).toBeGreaterThan(3);
  });
});

describe('door matching', () => {
  it('finds an exact name', () => {
    expect(matchGuests(guests, 'Amara Valberg')[0].reason).toBe('exact');
  });

  it('matches a prefix as someone types', () => {
    expect(matchGuests(guests, 'amar')[0].guest.name).toBe('Amara Valberg');
  });

  it('matches on surname, which is how names get read out at a door', () => {
    expect(matchGuests(guests, 'fenrand')[0].guest.name).toBe('Anouk Fenrand');
  });

  it('tolerates a typo rather than failing flat', () => {
    const results = matchGuests(guests, 'valburg');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].guest.name).toBe('Amara Valberg');
  });

  it('ignores accents and punctuation', () => {
    expect(matchGuests(guests, 'amare vallberg')[0].guest.name).toBe('Amaré Vallberg');
  });

  it('matches a handle or a company', () => {
    expect(matchGuests(guests, '@amara')[0].guest.name).toBe('Amara Valberg');
    expect(matchGuests(guests, 'maison')[0].guest.name).toBe('Anouk Fenrand');
  });

  it('stays quiet until there is something to match on', () => {
    expect(matchGuests(guests, 'a')).toHaveLength(0);
  });

  it('ranks near misses so the door can choose', () => {
    const results = matchGuests(guests, 'amara');
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].guest.name).toBe('Amara Valberg');
  });
});

describe('badge tokens', () => {
  it('resolves a scanned badge, case-insensitively', () => {
    expect(matchByToken(guests, 'amar')?.name).toBe('Amara Valberg');
    expect(matchByToken(guests, ' JUN ')?.name).toBe('Jun Morholm');
  });

  it('returns nothing for an unknown badge', () => {
    expect(matchByToken(guests, 'ZZZZ')).toBeUndefined();
  });
});
