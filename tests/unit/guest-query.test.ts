import { describe, expect, it } from 'vitest';
import { queryGuests, facetCounts, groupGuests } from '@/modules/guests/filter';
import { defaultMetrics, defaultSchema } from '@/data/defaults';
import type { Guest } from '@/data/types';

const schema = defaultSchema();
const metrics = defaultMetrics();

const guest = (overrides: Partial<Guest>): Guest => ({
  id: overrides.id ?? 'g',
  eventId: 'e1',
  name: 'Guest',
  statusId: 'invited',
  plusOnes: 0,
  tags: [],
  fields: {},
  qrToken: 't',
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
  rev: 1,
  ...overrides,
});

const guests = [
  guest({ id: '1', name: 'Amara Valberg', company: 'Sable Review', voiceId: 'press', tierId: 'tier-1', statusId: 'confirmed', audience: { followers: 900_000 } }),
  guest({ id: '2', name: 'Noor Brinley', company: 'Maison Onyx', voiceId: 'partner', tierId: 'tier-2', statusId: 'invited', audience: { followers: 12_000 } }),
  guest({ id: '3', name: 'Jun Morholm', handle: '@jun.m', voiceId: 'press', tierId: 'tier-3', statusId: 'arrived', audience: { followers: 55_000 }, tags: ['priority'] }),
];

const base = { search: '', filters: [], sort: [], arrivedIds: new Set(['3']), schema, metrics };

describe('guest querying', () => {
  it('searches across name, handle and company', () => {
    expect(queryGuests(guests, { ...base, search: 'sable' }).map((g) => g.id)).toEqual(['1']);
    expect(queryGuests(guests, { ...base, search: '@jun' }).map((g) => g.id)).toEqual(['3']);
    expect(queryGuests(guests, { ...base, search: 'zzz' })).toHaveLength(0);
  });

  it('filters by a multi-value axis', () => {
    const result = queryGuests(guests, {
      ...base,
      filters: [{ field: 'voiceId', op: 'is', value: ['press'] }],
    });
    expect(result.map((g) => g.id)).toEqual(['1', '3']);
  });

  it('combines filters with AND', () => {
    const result = queryGuests(guests, {
      ...base,
      filters: [
        { field: 'voiceId', op: 'is', value: ['press'] },
        { field: 'statusId', op: 'is', value: ['arrived'] },
      ],
    });
    expect(result.map((g) => g.id)).toEqual(['3']);
  });

  it('filters on arrival state derived from the arrivals log', () => {
    expect(
      queryGuests(guests, { ...base, filters: [{ field: 'arrived', op: 'is', value: 'yes' }] }).map((g) => g.id),
    ).toEqual(['3']);
  });

  it('sorts numerically on reach and alphabetically on names', () => {
    expect(queryGuests(guests, { ...base, sort: [{ id: 'followers', desc: true }] }).map((g) => g.id)).toEqual([
      '1', '3', '2',
    ]);
    expect(queryGuests(guests, { ...base, sort: [{ id: 'name', desc: false }] }).map((g) => g.name[0])).toEqual([
      'A', 'J', 'N',
    ]);
  });

  it('sorts by a computed metric column', () => {
    const sorted = queryGuests(guests, { ...base, sort: [{ id: 'metric:miv', desc: true }] });
    expect(sorted[0].id).toBe('1');
  });

  it('counts facets for the filter chips', () => {
    expect(facetCounts(guests, 'voiceId').get('press')).toBe(2);
    expect(facetCounts(guests, 'tierId').get('tier-2')).toBe(1);
  });

  it('groups by any field', () => {
    const groups = groupGuests(guests, 'voiceId', base);
    expect(groups.map((g) => g.key).sort()).toEqual(['partner', 'press']);
  });

  it('stays fast on a full house', () => {
    const many = Array.from({ length: 5000 }, (_, i) =>
      guest({ id: `g${i}`, name: `Guest ${i}`, voiceId: i % 2 ? 'press' : 'partner', audience: { followers: i * 10 } }),
    );
    const start = performance.now();
    queryGuests(many, { ...base, search: 'guest', filters: [{ field: 'voiceId', op: 'is', value: ['press'] }], sort: [{ id: 'followers', desc: true }] });
    expect(performance.now() - start).toBeLessThan(100);
  });
});
