import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, mulberry32 } from '@/lib/rng';

describe('seeded randomness', () => {
  it('produces identical sequences for the same seed', () => {
    const a = Array.from({ length: 20 }, mulberry32(42));
    const b = Array.from({ length: 20 }, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('produces different sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('hashes a scenario name to a stable seed', () => {
    expect(hashSeed('club-night')).toBe(hashSeed('club-night'));
    expect(hashSeed('club-night')).not.toBe(hashSeed('festival-stage'));
  });

  it('gives a stable demo: the same seed rebuilds the same records', () => {
    const build = () => {
      const rng = createRng('club-night');
      return Array.from({ length: 50 }, () => ({
        followers: Math.round(rng.logNormal(80_000, 1.4)),
        tier: rng.weighted({ 'a-list': 0.1, 'front-row': 0.3, press: 0.6 }),
        arrives: rng.bool(0.82),
      }));
    };
    expect(build()).toEqual(build());
  });

  it('weights a pick roughly in proportion', () => {
    const rng = createRng(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) counts[rng.weighted({ a: 0.75, b: 0.25 })] += 1;
    expect(counts.a / 2000).toBeGreaterThan(0.7);
    expect(counts.a / 2000).toBeLessThan(0.8);
  });

  it('produces heavy-tailed follower counts, not uniform ones', () => {
    const rng = createRng('followers');
    const values = Array.from({ length: 500 }, () => rng.logNormal(50_000, 1.6)).sort((a, b) => a - b);
    const median = values[250];
    const top = values[499];
    // A realistic guest list has a few very large accounts and many small ones.
    expect(top / median).toBeGreaterThan(10);
  });
});
