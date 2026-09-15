/**
 * Seeded pseudo-random number generation.
 *
 * Every demo record — names, follower counts, arrival times, sensor noise —
 * comes from here, so the demo is byte-identical on every machine and tests
 * and screenshots are stable.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 32-bit hash — turns a scenario name into a seed. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Weighted pick: `{ a: 0.7, b: 0.3 }`. Weights need not sum to 1. */
  weighted<K extends string>(weights: Record<K, number>): K;
  bool(p?: number): boolean;
  /** Box–Muller normal, clamped to sane bounds by the caller. */
  normal(mean: number, stdDev: number): number;
  /** Follower counts and impressions are heavy-tailed, never uniform. */
  logNormal(median: number, sigma: number): number;
  shuffle<T>(items: T[]): T[];
}

export function createRng(seed: number | string): Rng {
  const next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (weights) => {
      const entries = Object.entries(weights) as Array<[string, number]>;
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let roll = next() * total;
      for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key as never;
      }
      return entries[entries.length - 1][0] as never;
    },
    bool: (p = 0.5) => next() < p,
    normal: (mean, stdDev) => {
      const u = Math.max(next(), Number.EPSILON);
      const v = next();
      return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    logNormal: (median, sigma) => Math.exp(Math.log(median) + sigma * rng.normal(0, 1)),
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
  return rng;
}
