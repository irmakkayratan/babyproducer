import { describe, expect, it } from 'vitest';
import { evaluateFormula, parseFormula, validateFormula } from '@/lib/formula';
import { evaluateMetric, breakdownFor } from '@/modules/metrics/engine';
import { defaultMetrics } from '@/data/defaults';
import type { Guest, MetricConfig } from '@/data/types';

const guest = (overrides: Partial<Guest> = {}): Guest => ({
  id: 'g1',
  eventId: 'e1',
  name: 'Test Guest',
  statusId: 'invited',
  plusOnes: 0,
  tags: [],
  fields: {},
  qrToken: 'tok',
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
  rev: 1,
  ...overrides,
});

describe('formula language', () => {
  it('evaluates arithmetic with correct precedence and associativity', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('2 ^ 3 ^ 2', {})).toBe(512);
    expect(evaluateFormula('-5 + 2', {})).toBe(-3);
  });

  it('resolves variables and whitelisted functions', () => {
    expect(evaluateFormula('reach * rate', { reach: 1000, rate: 0.02 })).toBe(20);
    expect(evaluateFormula('clamp(quality, 0, 1)', { quality: 1.8 })).toBe(1);
    expect(evaluateFormula('round(value, 2)', { value: 3.14159 })).toBe(3.14);
    expect(evaluateFormula('coalesce(a, b)', { a: Number.NaN, b: 7 })).toBe(7);
  });

  it('supports conditionals for tiered rules', () => {
    expect(evaluateFormula('followers > 1000 ? 2 : 1', { followers: 5000 })).toBe(2);
    expect(evaluateFormula('followers > 1000 ? 2 : 1', { followers: 500 })).toBe(1);
  });

  it('treats division by zero as zero rather than infinity', () => {
    expect(evaluateFormula('10 / missing', { missing: 0 })).toBe(0);
  });

  it('refuses anything outside the whitelist — a formula cannot reach the app', () => {
    const hostile = [
      'constructor',
      'window.alert(1)',
      'process.exit(1)',
      'globalThis',
      '(() => 1)()',
      'fetch("https://example.com")',
      '__proto__.polluted',
      'eval("1+1")',
      'a["b"]',
    ];
    for (const attempt of hostile) {
      expect(() => evaluateFormula(attempt, {}), attempt).toThrow();
    }
  });

  it('names the offending token when validating', () => {
    expect(validateFormula('reach * mystery', ['reach'])).toMatchObject({ token: 'mystery' });
    expect(validateFormula('reach *', ['reach'])).not.toBeNull();
    expect(validateFormula('reach * rate', ['reach', 'rate'])).toBeNull();
  });

  it('parses to a plain AST with no executable payload', () => {
    expect(parseFormula('a + 1')).toEqual({
      type: 'binary',
      op: '+',
      left: { type: 'identifier', name: 'a' },
      right: { type: 'number', value: 1 },
    });
  });
});

describe('metric engine', () => {
  const [miv, emv] = defaultMetrics();

  it('computes MIV from reach, authority and quality', () => {
    const withWeights: MetricConfig = {
      ...miv,
      weightTables: miv.weightTables.map((table) =>
        table.id === 'mediaRate'
          ? { ...table, entries: { celebrity: 0.08 } as Record<string, number> }
          : { ...table, entries: { 'a-list': 2 } as Record<string, number> },
      ),
    };
    const result = evaluateMetric(
      withWeights,
      guest({ voiceId: 'celebrity', tierId: 'a-list', audience: { followers: 1_000_000, contentQuality: 0.9 } }),
    );
    // 1,000,000 × 0.08 × 2 × 0.9
    expect(result.value).toBeCloseTo(144_000);
    expect(result.error).toBeUndefined();
  });

  it('shows the EMV/MIV contrast the research describes', () => {
    const lowQualityMegaReach = guest({
      voiceId: 'public',
      tierId: 'standing',
      audience: { followers: 1_000_000, impressions: 5_000_000, avgEngagementRate: 0.01, contentQuality: 0.1, platform: 'instagram' },
    });
    const highAuthorityNiche = guest({
      voiceId: 'media',
      tierId: 'press',
      audience: { followers: 50_000, impressions: 50_000, avgEngagementRate: 0.09, contentQuality: 0.95, platform: 'press' },
    });

    const mivWeights: MetricConfig = {
      ...miv,
      weightTables: miv.weightTables.map((table) =>
        table.id === 'mediaRate'
          ? { ...table, entries: { public: 0.005, media: 0.4 } as Record<string, number>, fallback: 0.02 }
          : { ...table, entries: { standing: 0.4, press: 3 } as Record<string, number>, fallback: 1 },
      ),
    };

    expect(evaluateMetric(emv, lowQualityMegaReach).value).toBeGreaterThan(
      evaluateMetric(emv, highAuthorityNiche).value,
    );
    expect(evaluateMetric(mivWeights, highAuthorityNiche).value).toBeGreaterThan(
      evaluateMetric(mivWeights, lowQualityMegaReach).value,
    );
  });

  it('degrades to zero with a message rather than crashing a row', () => {
    const broken: MetricConfig = { ...miv, formula: 'reach * nonsense' };
    const result = evaluateMetric(broken, guest({ audience: { followers: 100 } }));
    expect(result.value).toBe(0);
    expect(result.error).toContain('nonsense');
  });

  it('normalises the radar breakdown against the room', () => {
    const peers = [
      guest({ id: 'a', audience: { followers: 1_000_000, contentQuality: 0.5 } }),
      guest({ id: 'b', audience: { followers: 100_000, contentQuality: 1 } }),
    ];
    const axes = breakdownFor(miv, peers[1], peers);
    expect(axes.find((a) => a.axis === 'reach')?.value).toBe(10);
    expect(axes.find((a) => a.axis === 'contentQuality')?.value).toBe(100);
  });
});
