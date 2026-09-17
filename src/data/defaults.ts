/**
 * Neutral defaults.
 *
 * A blank workspace must not assume an industry. Anything specific to fashion,
 * beauty, broadcast or conferences lives in `templates.ts` or `seed/`, never
 * here. Enforced by tests/unit/neutral-defaults.test.ts.
 */
import type {
  AdvanceChecklistEntry,
  BrandTokens,
  MetricConfig,
  ModuleKey,
  SchemaConfig,
  SettlementPreset,
  Vocab,
} from './types';
import { ALL_MODULES } from './types';

const v = (id: string, label: string, order: number, extra: Partial<Vocab> = {}): Vocab => ({
  id,
  label,
  order,
  ...extra,
});

export function defaultBrand(): BrandTokens {
  return {
    appName: 'BabyProducer',
    accent: 'hsl(0 0% 100%)',
    radius: 0.75,
    defaultScheme: 'dark',
    displayFont: 'sans',
  };
}

export function defaultSchema(): SchemaConfig {
  return {
    fields: [],
    eventStatuses: [
      v('draft', 'Draft', 0, { color: 'tier-6' }),
      v('planning', 'Planning', 1, { color: 'tier-3' }),
      v('live', 'Live', 2, { color: 'tier-1' }),
      v('complete', 'Complete', 3, { color: 'tier-4', terminal: true }),
    ],
    guestStatuses: [
      v('invited', 'Invited', 0, { color: 'tier-6' }),
      v('confirmed', 'Confirmed', 1, { color: 'tier-3' }),
      v('arrived', 'Arrived', 2, { color: 'tier-4', meansArrived: true }),
      v('declined', 'Declined', 3, { color: 'tier-5', terminal: true }),
      v('no-show', 'No-show', 4, { color: 'tier-6', terminal: true }),
    ],
    tiers: [
      v('tier-1', 'Tier 1', 0, { color: 'tier-1' }),
      v('tier-2', 'Tier 2', 1, { color: 'tier-2' }),
      v('tier-3', 'Tier 3', 2, { color: 'tier-3' }),
    ],
    voices: [
      v('guest', 'Guest', 0, { color: 'tier-6' }),
      v('press', 'Press', 1, { color: 'tier-3' }),
      v('partner', 'Partner', 2, { color: 'tier-2' }),
      v('internal', 'Internal', 3, { color: 'tier-4' }),
    ],
    cueTypes: [
      v('segment', 'Segment', 0),
      v('video', 'Video', 1),
      v('speech', 'Speech', 2),
      v('transition', 'Transition', 3),
      v('break', 'Break', 4),
    ],
    platforms: [
      v('instagram', 'Instagram', 0),
      v('tiktok', 'TikTok', 1),
      v('youtube', 'YouTube', 2),
      v('x', 'X', 3),
      v('press', 'Press', 4),
    ],
    advanceSections: [
      v('schedule', 'Schedule', 0),
      v('travel', 'Travel', 1),
      v('stay', 'Accommodation', 2),
      v('ground', 'Ground transport', 3),
      v('technical', 'Technical', 4),
      v('hospitality', 'Hospitality', 5),
      v('access', 'Access & security', 6),
      v('admin', 'Paperwork', 7),
    ],
    partyRoles: [
      v('principal', 'Principal', 0, { color: 'tier-1' }),
      v('support', 'Support', 1, { color: 'tier-3' }),
      v('crew', 'Crew', 2, { color: 'tier-4' }),
      v('vendor', 'Vendor', 3, { color: 'tier-5' }),
      v('house', 'House', 4, { color: 'tier-6' }),
    ],
    expenseCategories: [
      v('venue', 'Venue', 0),
      v('production', 'Production', 1),
      v('staffing', 'Staffing', 2),
      v('marketing', 'Marketing', 3),
      v('hospitality', 'Hospitality', 4),
      v('travel', 'Travel', 5),
      v('ticketing', 'Ticketing', 6),
      v('other', 'Other', 7),
    ],
  };
}

/**
 * The advance an event starts with.
 *
 * Generic on purpose. These are the questions any production has to answer
 * before it travels. Anything discipline-specific (backline, camera packages,
 * rehearsal blocks) belongs in a template.
 */
export function defaultAdvanceChecklist(): AdvanceChecklistEntry[] {
  return [
    { sectionId: 'schedule', label: 'Load-in time', required: true, dueDaysBefore: 7, logisticsKind: 'schedule' },
    { sectionId: 'schedule', label: 'Rehearsal / line check', dueDaysBefore: 5, logisticsKind: 'schedule' },
    { sectionId: 'schedule', label: 'Doors', required: true, dueDaysBefore: 7, logisticsKind: 'schedule' },
    { sectionId: 'schedule', label: 'Start time', required: true, dueDaysBefore: 7, logisticsKind: 'schedule' },
    { sectionId: 'schedule', label: 'Hard out / curfew', required: true, dueDaysBefore: 7, logisticsKind: 'schedule' },
    { sectionId: 'travel', label: 'Inbound travel', required: true, dueDaysBefore: 14, logisticsKind: 'travel', perParty: true },
    { sectionId: 'travel', label: 'Outbound travel', dueDaysBefore: 14, logisticsKind: 'travel', perParty: true },
    { sectionId: 'stay', label: 'Accommodation', required: true, dueDaysBefore: 14, logisticsKind: 'stay', perParty: true },
    { sectionId: 'ground', label: 'Arrival transfer', dueDaysBefore: 7, logisticsKind: 'transfer', perParty: true },
    { sectionId: 'ground', label: 'Venue transfers', dueDaysBefore: 3, logisticsKind: 'transfer', perParty: true },
    { sectionId: 'technical', label: 'Technical rider signed off', required: true, dueDaysBefore: 14 },
    { sectionId: 'technical', label: 'Stage plot and input list', required: true, dueDaysBefore: 10 },
    { sectionId: 'technical', label: 'Power, rigging and load limits', dueDaysBefore: 10 },
    { sectionId: 'technical', label: 'Local crew call', dueDaysBefore: 7, logisticsKind: 'spec' },
    { sectionId: 'hospitality', label: 'Catering times and headcount', required: true, dueDaysBefore: 5, logisticsKind: 'spec' },
    { sectionId: 'hospitality', label: 'Dressing rooms', dueDaysBefore: 5, logisticsKind: 'spec' },
    { sectionId: 'hospitality', label: 'Rider shopping list', dueDaysBefore: 3 },
    { sectionId: 'access', label: 'Pass list and laminates', required: true, dueDaysBefore: 3, logisticsKind: 'spec' },
    { sectionId: 'access', label: 'Guest list allocation', dueDaysBefore: 2, logisticsKind: 'spec' },
    { sectionId: 'access', label: 'Security and barricade plan', dueDaysBefore: 5 },
    { sectionId: 'admin', label: 'Signed contract', required: true, dueDaysBefore: 21 },
    { sectionId: 'admin', label: 'Insurance certificate', required: true, dueDaysBefore: 14 },
    { sectionId: 'admin', label: 'Settlement contact and payment method', required: true, dueDaysBefore: 7 },
  ];
}

/**
 * A settlement scaffold with no assumptions in it: one price band, the two
 * deductions every box office has in some form, and a flat fee. Rates are zero
 * because a wrong default rate is worse than an empty one.
 */
export function defaultSettlementPreset(): SettlementPreset {
  return {
    currency: 'EUR',
    scaling: [{ label: 'Full price', price: 0, allotment: 0 }],
    deductions: [
      { label: 'Sales tax', basis: 'percent-gross', amount: 0, categoryId: 'ticketing' },
      { label: 'Ticketing fee', basis: 'percent-gross', amount: 0, categoryId: 'ticketing' },
    ],
    expenses: [],
    deal: { kind: 'flat', guarantee: 0, percentage: 0, basis: 'net', breakeven: 0 },
  };
}

export function defaultModules(): ModuleKey[] {
  return [...ALL_MODULES];
}

/**
 * Both metric presets ship as ordinary, editable records. The research is
 * pointed about EMV's weakness being opaque multipliers, so every weight here
 * is visible and changeable in Studio, and either preset can be deleted.
 */
export function defaultMetrics(): MetricConfig[] {
  return [
    {
      id: 'miv',
      label: 'Media Impact Value',
      description:
        'Authority-weighted value: reach scaled by who is speaking and how well the brand shows up. Favours prestige over raw volume.',
      builtinPreset: 'miv',
      formula: 'reach * mediaRate * mediaQuality * contentQuality',
      variables: [
        { id: 'reach', label: 'Reach', source: { kind: 'field', path: 'audience.followers' }, fallback: 0 },
        { id: 'mediaRate', label: 'Voice authority', source: { kind: 'weight', table: 'mediaRate' } },
        { id: 'mediaQuality', label: 'Tier quality', source: { kind: 'weight', table: 'mediaQuality' } },
        {
          id: 'contentQuality',
          label: 'Content quality',
          source: { kind: 'field', path: 'audience.contentQuality' },
          fallback: 0.6,
        },
      ],
      weightTables: [
        { id: 'mediaRate', label: 'Voice authority', keyedBy: 'voiceId', entries: {}, fallback: 0.02 },
        { id: 'mediaQuality', label: 'Tier quality', keyedBy: 'tierId', entries: {}, fallback: 1 },
      ],
      format: { style: 'currency', currency: 'EUR', decimals: 0 },
      breakdown: ['reach', 'mediaRate', 'mediaQuality', 'contentQuality'],
    },
    {
      id: 'emv',
      label: 'Earned Media Value',
      description:
        'Volume-centric benchmark: what comparable paid attention would have cost. Treat it as directional, because it counts every impression the same.',
      builtinPreset: 'emv',
      formula: '(impressions / 1000) * platformCpm * engagementMultiplier',
      variables: [
        {
          id: 'impressions',
          label: 'Impressions',
          source: { kind: 'field', path: 'audience.impressions' },
          fallback: 0,
        },
        { id: 'platformCpm', label: 'Platform CPM', source: { kind: 'weight', table: 'platformCpm' } },
        {
          id: 'engagementMultiplier',
          label: 'Engagement multiplier',
          source: { kind: 'field', path: 'audience.avgEngagementRate' },
          fallback: 0.02,
        },
      ],
      weightTables: [
        {
          id: 'platformCpm',
          label: 'Platform CPM',
          keyedBy: 'platform',
          entries: { instagram: 9.5, tiktok: 7.2, youtube: 14, x: 6, press: 22 },
          fallback: 8,
        },
      ],
      format: { style: 'currency', currency: 'EUR', decimals: 0 },
      breakdown: ['impressions', 'platformCpm', 'engagementMultiplier'],
    },
  ];
}

export const DEFAULT_RUNDOWN_COLUMNS = [
  { id: 'audio', label: 'Audio', type: 'text' as const, width: 180, printed: true },
  { id: 'video', label: 'Video', type: 'text' as const, width: 180, printed: true },
  { id: 'lighting', label: 'Lighting', type: 'text' as const, width: 180, printed: true },
  { id: 'notes', label: 'Notes', type: 'longtext' as const, width: 240, printed: false },
];
