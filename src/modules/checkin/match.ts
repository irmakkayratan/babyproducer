/**
 * Door-side guest matching.
 *
 * The person at the door types what they heard, not what is on the list, so
 * matching is typo-tolerant and always offers the near misses rather than
 * failing flat.
 */
import type { Guest } from '@/data/types';

/**
 * Damerau-Levenshtein distance (optimal string alignment), bounded for speed on
 * a long list.
 *
 * The transposition term is what makes this Damerau rather than plain
 * Levenshtein, and it is the whole point at a door: two adjacent letters
 * swapped is the single most common way a name gets typed wrong, and counting
 * it as two edits pushed "Jnoathan" outside the tolerance for "Jonathan".
 */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  // Three rows: a transposition looks two back on both axes.
  let beforePrevious = new Array<number>(cols).fill(0);
  let previous = new Array<number>(cols);
  let current = new Array<number>(cols);
  for (let j = 0; j < cols; j++) previous[j] = j;

  for (let i = 1; i < rows; i++) {
    current[0] = i;
    let best = current[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, beforePrevious[j - 2] + 1);
      }
      current[j] = value;
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    const spare = beforePrevious;
    beforePrevious = previous;
    previous = current;
    current = spare;
  }
  return previous[cols - 1];
}

export interface Match {
  guest: Guest;
  score: number;
  reason: 'exact' | 'prefix' | 'contains' | 'fuzzy' | 'token';
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@ ]/g, '')
    .trim();
}

/** Ranked matches for a typed query. Lower score is a better match. */
export function matchGuests(guests: Guest[], query: string, limit = 8): Match[] {
  const needle = normalize(query);
  if (needle.length < 2) return [];

  const matches: Match[] = [];
  for (const guest of guests) {
    const name = normalize(guest.name);
    const handle = normalize(guest.handle ?? '');
    const company = normalize(guest.company ?? '');
    const email = normalize(guest.email ?? '');

    if (name === needle || handle === needle || email === needle) {
      matches.push({ guest, score: 0, reason: 'exact' });
      continue;
    }
    if (name.startsWith(needle)) {
      matches.push({ guest, score: 1, reason: 'prefix' });
      continue;
    }
    if (name.includes(needle) || company.includes(needle) || handle.includes(needle)) {
      matches.push({ guest, score: 2, reason: 'contains' });
      continue;
    }
    // Surname-first entry is normal at a door: match any token.
    const tokenHit = name.split(' ').some((token) => token.startsWith(needle));
    if (tokenHit) {
      matches.push({ guest, score: 2.5, reason: 'token' });
      continue;
    }
    // Compare against each part of the name as well as the whole: someone
    // typing "valburg" is aiming at a surname, not the full string.
    const tolerance = needle.length > 6 ? 3 : 2;
    const candidates = [name, ...name.split(' '), handle.replace('@', '')].filter(Boolean);
    let best = tolerance + 1;
    for (const candidate of candidates) {
      best = Math.min(best, editDistance(candidate, needle, tolerance));
      if (best === 0) break;
    }
    if (best <= tolerance) {
      matches.push({ guest, score: 3 + best, reason: 'fuzzy' });
    }
  }

  return matches.sort((a, b) => a.score - b.score || a.guest.name.localeCompare(b.guest.name)).slice(0, limit);
}

/** A scanned badge resolves by token; anything else falls back to search. */
export function matchByToken(guests: Guest[], scanned: string): Guest | undefined {
  const token = scanned.trim().toUpperCase();
  if (!token) return undefined;
  // An imported guest can arrive without a badge token; scanning must not throw.
  const normalizeToken = (value: string | undefined) => (value ?? '').trim().toUpperCase();
  return guests.find(
    (guest) => normalizeToken(guest.qrToken) === token || normalizeToken(guest.id) === token,
  );
}
