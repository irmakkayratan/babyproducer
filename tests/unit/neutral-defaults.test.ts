import { describe, expect, it } from 'vitest';
import { defaultSchema, defaultMetrics } from '@/data/defaults';
import { BUILTIN_TEMPLATES } from '@/data/templates';

/**
 * The guardrail for "fully customizable": a blank workspace must not assume an
 * industry. Vocabulary belongs in templates and seed data, which the user can
 * rename or delete. Never baked into the defaults.
 */
const INDUSTRY_WORDS = [
  'celebrity',
  'influencer',
  'front row',
  'runway',
  'buyer',
  'a-list',
  'model',
  'keynote',
  'donor',
  'fashion',
];

describe('neutral defaults', () => {
  it('ships no industry vocabulary in the blank schema', () => {
    const serialized = JSON.stringify(defaultSchema()).toLowerCase();
    for (const word of INDUSTRY_WORDS) {
      expect(serialized, `default schema leaks "${word}"`).not.toContain(word);
    }
  });

  it('defines a full pipeline so views, boards and funnels have something to derive from', () => {
    const schema = defaultSchema();
    expect(schema.guestStatuses.length).toBeGreaterThanOrEqual(3);
    expect(schema.guestStatuses.some((s) => s.meansArrived)).toBe(true);
    expect(schema.tiers.length).toBeGreaterThan(0);
    expect(schema.voices.length).toBeGreaterThan(0);
  });

  it('ships both metric presets as editable data, not code', () => {
    const metrics = defaultMetrics();
    const miv = metrics.find((m) => m.id === 'miv');
    const emv = metrics.find((m) => m.id === 'emv');
    expect(miv?.formula).toContain('mediaRate');
    expect(emv?.formula).toContain('platformCpm');
    // Every multiplier is a visible, editable weight table entry.
    expect(miv?.weightTables.length).toBeGreaterThan(0);
    expect(emv?.weightTables[0].entries.instagram).toBeTypeOf('number');
  });
});

describe('templates carry the vocabulary instead', () => {
  it('every template is applicable data with modules and columns', () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.rundownColumns.length).toBeGreaterThan(0);
      expect(template.enabledModules.length).toBeGreaterThan(0);
      expect(template.accent).toMatch(/^hsl\(/);
    }
  });

  it('has a genuinely blank option that assumes nothing', () => {
    const blank = BUILTIN_TEMPLATES.find((t) => t.id === 'blank');
    expect(blank).toBeDefined();
    expect(Object.keys(blank!.schemaPatch)).toHaveLength(0);
  });
});
