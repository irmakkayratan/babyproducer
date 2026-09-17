/**
 * Filtering, searching and sorting for the guest table.
 *
 * Kept as pure functions over plain arrays so they can be unit-tested and so
 * the table can memoize them, a filter pass over 5,000 guests has to stay
 * well inside a frame.
 */
import type { FieldValue, Guest, MetricConfig, SchemaConfig, ViewFilter } from '@/data/types';
import { scoreGuest } from '@/modules/metrics/engine';

export interface GuestQuery {
  search: string;
  filters: ViewFilter[];
  sort: Array<{ id: string; desc: boolean }>;
  arrivedIds: Set<string>;
  schema: SchemaConfig;
  metrics: MetricConfig[];
}

function guestValue(guest: Guest, field: string, query: GuestQuery): FieldValue | number | undefined {
  switch (field) {
    case 'name':
      return guest.name;
    case 'handle':
      return guest.handle ?? '';
    case 'company':
      return guest.company ?? '';
    case 'voiceId':
      return guest.voiceId ?? '';
    case 'tierId':
      return guest.tierId ?? '';
    case 'statusId':
      return guest.statusId;
    case 'plusOnes':
      return guest.plusOnes;
    case 'followers':
      return guest.audience?.followers ?? 0;
    case 'engagement':
      return guest.audience?.avgEngagementRate ?? 0;
    case 'platform':
      return guest.audience?.platform ?? '';
    case 'arrived':
      return query.arrivedIds.has(guest.id) ? 'yes' : 'no';
    case 'tags':
      return guest.tags;
    default: {
      if (field.startsWith('metric:')) {
        const metric = query.metrics.find((m) => m.id === field.slice('metric:'.length));
        return metric ? scoreGuest(metric, guest).value : 0;
      }
      return guest.fields[field];
    }
  }
}

function matchesFilter(guest: Guest, filter: ViewFilter, query: GuestQuery): boolean {
  const value = guestValue(guest, filter.field, query);

  switch (filter.op) {
    case 'is': {
      if (Array.isArray(filter.value)) {
        if (Array.isArray(value)) return value.some((entry) => (filter.value as string[]).includes(String(entry)));
        return (filter.value as string[]).includes(String(value ?? ''));
      }
      return String(value ?? '') === String(filter.value ?? '');
    }
    case 'is-not':
      return String(value ?? '') !== String(filter.value ?? '');
    case 'contains':
      return String(value ?? '').toLowerCase().includes(String(filter.value ?? '').toLowerCase());
    case 'gt':
      return Number(value ?? 0) > Number(filter.value ?? 0);
    case 'lt':
      return Number(value ?? 0) < Number(filter.value ?? 0);
    case 'between':
      return Number(value ?? 0) >= Number(filter.value ?? 0) && Number(value ?? 0) <= Number(filter.value2 ?? 0);
    case 'is-empty':
      return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    case 'is-not-empty':
      return !(value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0));
    default:
      return true;
  }
}

function matchesSearch(guest: Guest, needle: string): boolean {
  if (!needle) return true;
  const haystack = `${guest.name} ${guest.handle ?? ''} ${guest.company ?? ''} ${guest.email ?? ''} ${guest.tags.join(' ')}`;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function queryGuests(guests: Guest[], query: GuestQuery): Guest[] {
  const needle = query.search.trim().toLowerCase();
  const filtered = guests.filter(
    (guest) => matchesSearch(guest, needle) && query.filters.every((filter) => matchesFilter(guest, filter, query)),
  );

  if (query.sort.length === 0) return filtered;

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return [...filtered].sort((a, b) => {
    for (const { id, desc } of query.sort) {
      const left = guestValue(a, id, query);
      const right = guestValue(b, id, query);
      let comparison: number;
      if (typeof left === 'number' && typeof right === 'number') comparison = left - right;
      else comparison = collator.compare(String(left ?? ''), String(right ?? ''));
      if (comparison !== 0) return desc ? -comparison : comparison;
    }
    return 0;
  });
}

/** Counts per option, so filter chips can show how much each choice matches. */
export function facetCounts(guests: Guest[], field: 'voiceId' | 'tierId' | 'statusId'): Map<string, number> {
  const counts = new Map<string, number>();
  for (const guest of guests) {
    const key = String(guest[field] ?? '');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function groupGuests(guests: Guest[], field: string | null, query: GuestQuery): Array<{ key: string; guests: Guest[] }> {
  if (!field) return [{ key: '', guests }];
  const groups = new Map<string, Guest[]>();
  for (const guest of guests) {
    const key = String(guestValue(guest, field, query) ?? '-');
    const bucket = groups.get(key);
    if (bucket) bucket.push(guest);
    else groups.set(key, [guest]);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, guests: items }));
}

export { guestValue };
