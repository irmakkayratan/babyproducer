/**
 * Built-in event templates.
 *
 * This file (and seed/) is where industry vocabulary is allowed to live: a
 * template is data, applied by `applyTemplate()`, and every word in it is
 * editable by the user afterwards. The app's defaults stay neutral.
 */
import type {
  AdvanceChecklistEntry,
  EventTemplate,
  RundownColumn,
  SettlementLine,
  Vocab,
} from './types';

const col = (
  id: string,
  label: string,
  width = 180,
  type: RundownColumn['type'] = 'text',
  printed = true,
): RundownColumn => ({ id, label, type, width, printed });

const v = (id: string, label: string, order: number, color?: string, extra: Partial<Vocab> = {}): Vocab => ({
  id,
  label,
  order,
  color,
  ...extra,
});

/** Checklist entries here are appended to the neutral default advance. */
const ask = (
  sectionId: string,
  label: string,
  extra: Partial<AdvanceChecklistEntry> = {},
): AdvanceChecklistEntry => ({ sectionId, label, ...extra });

const cost = (
  label: string,
  categoryId: string,
  amount: number,
  basis: SettlementLine['basis'] = 'fixed',
): Omit<SettlementLine, 'id'> => ({ label, categoryId, amount, basis });

export const BUILTIN_TEMPLATES: EventTemplate[] = [
  {
    id: 'club-night',
    name: 'Club Night',
    kind: 'Club Night',
    description:
      'One room, a late licence and a door list. Standing capacity, a booth rather than a stage, and a settlement the promoter runs before anyone goes home.',
    accent: 'hsl(0 0% 74%)',
    builtin: true,
    seatingPreset: 'open-floor',
    enabledModules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'settlement'],
    metricIds: [],
    // A club night is a door and a clock: who is in the room, how fast they are
    // arriving, and how close the headline set is to the curfew.
    dashboardWidgets: ['arrivals', 'arrival-rate', 'occupancy', 'next-cue', 'show-drift', 'systems', 'alerts'],
    rundownColumns: [
      col('audio', 'Audio'),
      col('lighting', 'Lighting'),
      col('booth', 'Booth', 200),
      col('visuals', 'Visuals', 160),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Headline set time', { required: true, dueDaysBefore: 5, logisticsKind: 'schedule' }),
      ask('schedule', 'Changeover between DJs', { dueDaysBefore: 3, logisticsKind: 'schedule' }),
      ask('technical', 'Booth spec: decks, mixer and booth monitors', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Sound limiter level and who holds the key', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Lighting, haze and strobe policy', { dueDaysBefore: 7 }),
      ask('ground', 'Cloakroom and smoking area cover', { dueDaysBefore: 3, logisticsKind: 'spec' }),
      ask('access', 'Guest list cap per party', { required: true, dueDaysBefore: 2, logisticsKind: 'spec' }),
      ask('access', 'Security ratio and door policy', { required: true, dueDaysBefore: 5, logisticsKind: 'spec' }),
      ask('admin', 'Late licence and noise permit', { required: true, dueDaysBefore: 21 }),
      ask('admin', 'Door split and what time you settle', { required: true, dueDaysBefore: 7 }),
    ],
    settlementPreset: {
      currency: 'EUR',
      scaling: [
        { label: 'Early release', price: 12, allotment: 200 },
        { label: 'Presale', price: 16, allotment: 380 },
        { label: 'Door', price: 20, allotment: 120 },
      ],
      deductions: [
        { label: 'VAT', basis: 'percent-gross', amount: 21, categoryId: 'ticketing' },
        { label: 'Ticketing fee', basis: 'percent-gross', amount: 9, categoryId: 'ticketing' },
        { label: "Author's rights", basis: 'percent-adjusted', amount: 8.8, categoryId: 'ticketing' },
      ],
      expenses: [
        cost('Venue rent', 'venue', 1800),
        cost('Sound and lighting hire', 'production', 1400),
        cost('Local crew', 'staffing', 700),
        cost('Security', 'staffing', 1.4, 'per-head'),
        cost('Marketing and print', 'marketing', 1600),
        cost('Rider and catering', 'hospitality', 650),
        cost('Hotels and ground', 'travel', 900),
      ],
      deal: { kind: 'versus', guarantee: 3500, percentage: 70, basis: 'net', breakeven: 0 },
    },
    schemaPatch: {
      voices: [
        v('dj', 'DJ', 0, 'tier-1'),
        v('crew', 'Crew', 1, 'tier-4'),
        v('promoter', 'Promoter', 2, 'tier-2'),
        v('press', 'Press', 3, 'tier-3'),
        v('guest', 'Guest', 4, 'tier-6'),
      ],
      tiers: [
        v('aaa', 'All Access', 0, 'tier-1'),
        v('artist-list', 'Artist List', 1, 'tier-2'),
        v('guest-list', 'Guest List', 2, 'tier-4'),
        v('presale', 'Presale', 3, 'tier-5'),
        v('door', 'Door', 4, 'tier-6'),
      ],
      cueTypes: [
        v('doors', 'Doors', 0),
        v('opener', 'Opener', 1),
        v('changeover', 'Changeover', 2),
        v('headliner', 'Headliner', 3),
        v('curfew', 'Curfew', 4),
      ],
      partyRoles: [
        v('headline', 'Headline', 0, 'tier-1'),
        v('support', 'Support', 1, 'tier-3'),
        v('touring-crew', 'Touring Crew', 2, 'tier-4'),
        v('local-crew', 'Local Crew', 3, 'tier-5'),
        v('promoter', 'Promoter', 4, 'tier-6'),
      ],
      expenseCategories: [
        v('venue', 'Venue', 0),
        v('production', 'Production', 1),
        v('staffing', 'Staffing', 2),
        v('marketing', 'Marketing', 3),
        v('hospitality', 'Hospitality', 4),
        v('travel', 'Travel & hotels', 5),
        v('ticketing', 'Ticketing & taxes', 6),
        v('other', 'Other', 7),
      ],
    },
  },
  {
    id: 'festival-stage',
    name: 'Festival Stage',
    kind: 'Festival Stage',
    description:
      'One stage on a site somebody else is running. Published set times, shared backline, a changeover window between every act and a hard stop nobody negotiates.',
    accent: 'hsl(0 0% 66%)',
    builtin: true,
    seatingPreset: 'open-floor',
    enabledModules: ['guests', 'rundown', 'advancing', 'checkin', 'command'],
    metricIds: [],
    // A stage lives or dies on the clock, so timing leads and the door follows.
    dashboardWidgets: ['next-cue', 'show-drift', 'arrivals', 'arrival-rate', 'occupancy', 'systems', 'alerts'],
    rundownColumns: [
      col('audio', 'Audio'),
      col('monitors', 'Monitors', 160),
      col('backline', 'Backline', 200),
      col('patch', 'Patch', 160),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Set times published', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('schedule', 'Line check window', { required: true, dueDaysBefore: 5, logisticsKind: 'schedule' }),
      ask('schedule', 'Changeover window between acts', { required: true, dueDaysBefore: 5, logisticsKind: 'schedule' }),
      ask('schedule', 'Hard stop and noise curfew', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('technical', 'Shared backline and who supplies what', { required: true, dueDaysBefore: 14 }),
      ask('technical', 'Patch list and split to the broadcast truck', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Monitor package and engineer per act', { dueDaysBefore: 10 }),
      ask('ground', 'Buggy and cart access to the stage', { dueDaysBefore: 5, logisticsKind: 'spec' }),
      ask('access', 'Artist credentials and wristband count', { required: true, dueDaysBefore: 5, logisticsKind: 'spec' }),
      ask('admin', 'Weather contingency and stop-show procedure', { required: true, dueDaysBefore: 14 }),
      ask('admin', 'Artist advance returned', { required: true, dueDaysBefore: 21, perParty: true }),
    ],
    schemaPatch: {
      voices: [
        v('artist', 'Artist', 0, 'tier-1'),
        v('crew', 'Crew', 1, 'tier-4'),
        v('production', 'Production', 2, 'tier-2'),
        v('press', 'Press', 3, 'tier-3'),
        v('guest', 'Guest', 4, 'tier-6'),
      ],
      tiers: [
        v('aaa', 'All Access', 0, 'tier-1'),
        v('artist', 'Artist', 1, 'tier-2'),
        v('working', 'Working', 2, 'tier-4'),
        v('photo', 'Photo', 3, 'tier-3'),
        v('wristband', 'Wristband', 4, 'tier-6'),
      ],
      cueTypes: [
        v('line-check', 'Line Check', 0),
        v('set', 'Set Time', 1),
        v('changeover', 'Changeover Window', 2),
        v('hard-stop', 'Hard Stop', 3),
      ],
      partyRoles: [
        v('headline', 'Headline', 0, 'tier-1'),
        v('support', 'Support', 1, 'tier-3'),
        v('touring-crew', 'Touring Crew', 2, 'tier-4'),
        v('local-crew', 'Local Crew', 3, 'tier-5'),
        v('promoter', 'Promoter', 4, 'tier-6'),
      ],
    },
  },
  {
    id: 'runway-show',
    name: 'Runway Show',
    kind: 'Runway Show',
    description:
      'Curated guest list, front-row politics, tight cue stack. Voices and tiers set up for fashion week.',
    accent: 'hsl(0 0% 100%)',
    builtin: true,
    seatingPreset: 'runway',
    enabledModules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'command', 'metrics'],
    metricIds: ['miv', 'emv'],
    metricWeights: {
      miv: {
        // Weighted on authority: a critic at a top-tier title outweighs a
        // larger account with no standing. Every number here is editable.
        mediaRate: { celebrity: 0.09, influencer: 0.05, media: 0.045, buyer: 0.012, partner: 0.02, owned: 0.03 },
        mediaQuality: { 'a-list': 2.4, 'front-row': 1.7, press: 1.35, buyer: 0.9, standing: 0.6 },
      },
    },
    rundownColumns: [
      col('music', 'Music'),
      col('lighting', 'Lighting'),
      col('models', 'Model Order', 200),
      col('camera', 'Camera', 160),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Fitting and hair/make-up call', { dueDaysBefore: 5, logisticsKind: 'schedule' }),
      ask('schedule', 'Photo call and step-and-repeat window', { dueDaysBefore: 3, logisticsKind: 'schedule' }),
      ask('technical', 'Runway build, riser height and marley', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Music playback and timecode', { dueDaysBefore: 7 }),
      ask('access', 'Backstage pass split: house, press, brand', { required: true, dueDaysBefore: 3, logisticsKind: 'spec' }),
      ask('access', 'Photographer pit allocation', { dueDaysBefore: 3, logisticsKind: 'spec' }),
      ask('hospitality', 'Backstage catering for the show crew', { dueDaysBefore: 4, logisticsKind: 'spec' }),
    ],
    schemaPatch: {
      voices: [
        v('celebrity', 'Celebrity', 0, 'tier-1'),
        v('influencer', 'Influencer', 1, 'tier-2'),
        v('media', 'Media', 2, 'tier-3'),
        v('buyer', 'Buyer', 3, 'tier-4'),
        v('partner', 'Partner', 4, 'tier-5'),
        v('owned', 'Owned Media', 5, 'tier-6'),
      ],
      tiers: [
        v('a-list', 'A-list', 0, 'tier-1'),
        v('front-row', 'Front Row', 1, 'tier-2'),
        v('press', 'Press', 2, 'tier-3'),
        v('buyer', 'Buyer', 3, 'tier-4'),
        v('standing', 'Standing', 4, 'tier-6'),
      ],
      cueTypes: [
        v('walk', 'Walk', 0),
        v('music', 'Music', 1),
        v('lighting', 'Lighting', 2),
        v('finale', 'Finale', 3),
        v('bow', 'Designer Bow', 4),
      ],
    },
  },
  {
    id: 'brand-activation',
    name: 'Brand Activation / Pop-Up',
    kind: 'Activation',
    description:
      'Multi-day experiential footprint: walk-in heavy, sensor telemetry, dwell time and content capture.',
    accent: 'hsl(0 0% 84%)',
    builtin: true,
    seatingPreset: 'open-floor',
    enabledModules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'metrics'],
    metricIds: ['miv', 'emv'],
    metricWeights: {
      miv: {
        mediaRate: { creator: 0.055, media: 0.04, vip: 0.08, public: 0.004, partner: 0.02 },
        mediaQuality: { hosted: 1.8, rsvp: 1.1, 'walk-in': 0.5 },
      },
    },
    rundownColumns: [
      col('station', 'Station'),
      col('staffing', 'Staffing'),
      col('content', 'Content Capture', 200),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Build and strike windows agreed with the landlord', { required: true, dueDaysBefore: 14, logisticsKind: 'schedule' }),
      ask('schedule', 'Daily opening hours', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('technical', 'Power draw and distribution per station', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Wi-fi and sensor connectivity on site', { dueDaysBefore: 7 }),
      ask('access', 'Staff rota and brand ambassador briefing', { dueDaysBefore: 5, logisticsKind: 'spec' }),
      ask('admin', 'Local permits and fire sign-off', { required: true, dueDaysBefore: 21 }),
    ],
    schemaPatch: {
      voices: [
        v('creator', 'Creator', 0, 'tier-2'),
        v('media', 'Media', 1, 'tier-3'),
        v('vip', 'VIP', 2, 'tier-1'),
        v('public', 'Public', 3, 'tier-6'),
        v('partner', 'Partner', 4, 'tier-5'),
      ],
      tiers: [
        v('hosted', 'Hosted', 0, 'tier-1'),
        v('rsvp', 'RSVP', 1, 'tier-3'),
        v('walk-in', 'Walk-in', 2, 'tier-6'),
      ],
      guestStatuses: [
        v('invited', 'Invited', 0, 'tier-6'),
        v('confirmed', 'Confirmed', 1, 'tier-3'),
        v('arrived', 'Arrived', 2, 'tier-4', { meansArrived: true }),
        v('no-show', 'No-show', 3, 'tier-6', { terminal: true }),
      ],
    },
  },
  {
    id: 'product-launch',
    name: 'Product Launch Keynote',
    kind: 'Keynote',
    description:
      'Theatre seating, rehearsal blocks, teleprompter scripts and press embargo tracking.',
    accent: 'hsl(0 0% 70%)',
    builtin: true,
    seatingPreset: 'theatre',
    enabledModules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'command', 'metrics'],
    metricIds: ['emv'],
    metricWeights: {
      miv: {
        mediaRate: { analyst: 0.06, press: 0.05, customer: 0.008, partner: 0.02, internal: 0.005 },
        mediaQuality: { 'keynote-row': 1.9, reserved: 1.2, general: 0.7 },
      },
    },
    rundownColumns: [
      col('slides', 'Slides'),
      col('mics', 'Mics', 140),
      col('stream', 'Stream', 160),
      col('lowerthirds', 'Lower Thirds', 200),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Rehearsal blocks per speaker', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('schedule', 'Press embargo lift', { required: true, dueDaysBefore: 5, logisticsKind: 'schedule' }),
      ask('technical', 'Slide deck delivery and playback format', { required: true, dueDaysBefore: 5 }),
      ask('technical', 'Teleprompter scripts loaded', { dueDaysBefore: 3 }),
      ask('technical', 'Stream encoder, bitrate and backup path', { required: true, dueDaysBefore: 7 }),
      ask('access', 'Press accreditation list', { dueDaysBefore: 5, logisticsKind: 'spec' }),
    ],
    schemaPatch: {
      voices: [
        v('analyst', 'Analyst', 0, 'tier-2'),
        v('press', 'Press', 1, 'tier-3'),
        v('customer', 'Customer', 2, 'tier-4'),
        v('partner', 'Partner', 3, 'tier-5'),
        v('internal', 'Internal', 4, 'tier-6'),
      ],
      tiers: [
        v('keynote-row', 'Keynote Row', 0, 'tier-1'),
        v('reserved', 'Reserved', 1, 'tier-3'),
        v('general', 'General', 2, 'tier-6'),
      ],
      cueTypes: [
        v('slide', 'Slide', 0),
        v('demo', 'Demo', 1),
        v('video', 'Video', 2),
        v('qa', 'Q&A', 3),
        v('break', 'Break', 4),
      ],
    },
  },
  {
    id: 'conference-track',
    name: 'Conference Track',
    kind: 'Conference',
    description: 'Sessions, speakers and room turnarounds with badge check-in.',
    accent: 'hsl(0 0% 56%)',
    builtin: true,
    seatingPreset: 'theatre',
    enabledModules: ['guests', 'rundown', 'advancing', 'checkin', 'command'],
    metricIds: [],
    rundownColumns: [
      col('speaker', 'Speaker'),
      col('av', 'AV'),
      col('room', 'Room', 140),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Room turnaround times between sessions', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('technical', 'Speaker AV check slots', { dueDaysBefore: 3, logisticsKind: 'schedule' }),
      ask('technical', 'Recording and captioning setup', { dueDaysBefore: 7 }),
      ask('hospitality', 'Speaker green room and refreshments', { dueDaysBefore: 5, logisticsKind: 'spec' }),
      ask('access', 'Badge stock and on-site printing', { required: true, dueDaysBefore: 5, logisticsKind: 'spec' }),
    ],
    schemaPatch: {
      voices: [
        v('speaker', 'Speaker', 0, 'tier-1'),
        v('attendee', 'Attendee', 1, 'tier-6'),
        v('press', 'Press', 2, 'tier-3'),
        v('sponsor', 'Sponsor', 3, 'tier-2'),
      ],
    },
  },
  {
    id: 'gala-dinner',
    name: 'Gala Dinner',
    kind: 'Gala',
    description: 'Banquet tables, seating politics, donor tiers and a served-course rundown.',
    accent: 'hsl(0 0% 92%)',
    builtin: true,
    seatingPreset: 'banquet',
    enabledModules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'metrics', 'settlement'],
    metricIds: ['miv'],
    metricWeights: {
      miv: {
        mediaRate: { donor: 0.05, board: 0.04, press: 0.045, guest: 0.01 },
        mediaQuality: { 'head-table': 2, major: 1.5, table: 0.8 },
      },
    },
    rundownColumns: [
      col('service', 'Service'),
      col('audio', 'Audio'),
      col('lighting', 'Lighting'),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Reception, service and speech windows', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('hospitality', 'Menu, wine and dietary requirements', { required: true, dueDaysBefore: 7, logisticsKind: 'spec' }),
      ask('hospitality', 'Table dressing and floral delivery', { dueDaysBefore: 3 }),
      ask('technical', 'Room audio for speeches and the auction', { required: true, dueDaysBefore: 7 }),
      ask('admin', 'Payment handling for pledges on the night', { required: true, dueDaysBefore: 7 }),
    ],
    settlementPreset: {
      currency: 'GBP',
      scaling: [
        { label: 'Table of ten', price: 4500, allotment: 40 },
        { label: 'Individual seat', price: 495, allotment: 60 },
      ],
      deductions: [
        { label: 'VAT', basis: 'percent-gross', amount: 20, categoryId: 'ticketing' },
        { label: 'Payment processing', basis: 'percent-gross', amount: 1.8, categoryId: 'ticketing' },
      ],
      expenses: [
        cost('Venue hire', 'venue', 9500),
        cost('Catering', 'hospitality', 78, 'per-head'),
        cost('Production and audio', 'production', 6400),
        cost('Floral and dressing', 'production', 3800),
        cost('Front of house staffing', 'staffing', 2600),
      ],
      deal: { kind: 'flat', guarantee: 0, percentage: 0, basis: 'net', breakeven: 0 },
    },
    schemaPatch: {
      voices: [
        v('donor', 'Donor', 0, 'tier-1'),
        v('board', 'Board', 1, 'tier-2'),
        v('press', 'Press', 2, 'tier-3'),
        v('guest', 'Guest', 3, 'tier-6'),
      ],
      tiers: [
        v('head-table', 'Head Table', 0, 'tier-1'),
        v('major', 'Major Gift', 1, 'tier-2'),
        v('table', 'Table Guest', 2, 'tier-6'),
      ],
      cueTypes: [
        v('course', 'Course', 0),
        v('speech', 'Speech', 1),
        v('auction', 'Auction Lot', 2),
        v('performance', 'Performance', 3),
      ],
    },
  },
  {
    id: 'live-show',
    name: 'Live Show / Tour Date',
    kind: 'Live Show',
    description:
      'A touring date end to end: advance the venue and the travelling party, then settle the box office against the deal on the night.',
    accent: 'hsl(0 0% 62%)',
    builtin: true,
    seatingPreset: 'open-floor',
    enabledModules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'metrics', 'settlement'],
    metricIds: [],
    rundownColumns: [
      col('audio', 'Audio'),
      col('lighting', 'Lighting'),
      col('backline', 'Backline', 200),
      col('video', 'Video', 160),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [
      ask('schedule', 'Soundcheck', { required: true, dueDaysBefore: 7, logisticsKind: 'schedule' }),
      ask('schedule', 'Support set times and changeover', { required: true, dueDaysBefore: 5, logisticsKind: 'schedule' }),
      ask('schedule', 'Bus call', { dueDaysBefore: 3, logisticsKind: 'schedule' }),
      ask('technical', 'PA system and console spec', { required: true, dueDaysBefore: 14 }),
      ask('technical', 'Monitor world: wedges, in-ears, mix count', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Backline list and hire confirmation', { required: true, dueDaysBefore: 10 }),
      ask('technical', 'Lighting plot and follow spots', { dueDaysBefore: 10 }),
      ask('ground', 'Bus and truck parking, shore power', { dueDaysBefore: 7, logisticsKind: 'spec' }),
      ask('hospitality', 'Dressing room rider and towels', { dueDaysBefore: 3 }),
      ask('access', 'Laminate and working pass count', { required: true, dueDaysBefore: 3, logisticsKind: 'spec' }),
      ask('access', 'Photo pass rules and first three songs', { dueDaysBefore: 2 }),
      ask('admin', 'Work permits and visas', { required: true, dueDaysBefore: 30, perParty: true }),
      ask('admin', 'Merchandise split and seller', { dueDaysBefore: 7 }),
      ask('admin', 'Box office reports and deposit received', { required: true, dueDaysBefore: 7 }),
    ],
    settlementPreset: {
      currency: 'EUR',
      scaling: [
        { label: 'Early bird', price: 29, allotment: 300 },
        { label: 'Advance', price: 35, allotment: 900 },
        { label: 'Door', price: 40, allotment: 200 },
        { label: 'VIP package', price: 95, allotment: 100 },
      ],
      deductions: [
        { label: 'VAT', basis: 'percent-gross', amount: 20, categoryId: 'ticketing' },
        { label: 'Ticketing fee', basis: 'percent-gross', amount: 8, categoryId: 'ticketing' },
        { label: "Author's rights", basis: 'percent-adjusted', amount: 8.8, categoryId: 'ticketing' },
      ],
      expenses: [
        cost('Venue rent', 'venue', 6500),
        cost('Sound and lighting hire', 'production', 4200),
        cost('Backline hire', 'production', 1450),
        cost('Local crew and stagehands', 'staffing', 2300),
        cost('Security', 'staffing', 1.6, 'per-head'),
        cost('Marketing and print', 'marketing', 5200),
        cost('Catering and rider', 'hospitality', 1850),
        cost('Hotels and ground', 'travel', 2400),
      ],
      // The deal the industry actually writes down: a floor the artist is paid
      // whatever happens, against a share of what is left after costs.
      deal: { kind: 'versus', guarantee: 18000, percentage: 85, basis: 'net', breakeven: 0 },
    },
    schemaPatch: {
      voices: [
        v('artist', 'Artist', 0, 'tier-1'),
        v('crew', 'Crew', 1, 'tier-4'),
        v('promoter', 'Promoter', 2, 'tier-2'),
        v('press', 'Press', 3, 'tier-3'),
        v('guest', 'Guest', 4, 'tier-6'),
      ],
      tiers: [
        v('aaa', 'All Access', 0, 'tier-1'),
        v('working', 'Working Pass', 1, 'tier-2'),
        v('photo', 'Photo Pass', 2, 'tier-3'),
        v('guest-list', 'Guest List', 3, 'tier-5'),
        v('ticket', 'Ticket Holder', 4, 'tier-6'),
      ],
      cueTypes: [
        v('doors', 'Doors', 0),
        v('support', 'Support Set', 1),
        v('changeover', 'Changeover', 2),
        v('set', 'Set', 3),
        v('encore', 'Encore', 4),
        v('walkout', 'Walk-out', 5),
      ],
      partyRoles: [
        v('headline', 'Headline', 0, 'tier-1'),
        v('support', 'Support', 1, 'tier-3'),
        v('touring-crew', 'Touring Crew', 2, 'tier-4'),
        v('local-crew', 'Local Crew', 3, 'tier-5'),
        v('promoter', 'Promoter', 4, 'tier-6'),
      ],
      expenseCategories: [
        v('venue', 'Venue', 0),
        v('production', 'Production', 1),
        v('staffing', 'Staffing', 2),
        v('marketing', 'Marketing', 3),
        v('hospitality', 'Hospitality', 4),
        v('travel', 'Travel & hotels', 5),
        v('ticketing', 'Ticketing & taxes', 6),
        v('other', 'Other', 7),
      ],
    },
  },
  {
    id: 'blank',
    name: 'Blank',
    kind: 'Event',
    description: 'No assumptions. Neutral vocabulary you shape yourself in Studio.',
    accent: 'hsl(0 0% 46%)',
    builtin: true,
    seatingPreset: 'none',
    enabledModules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'command', 'metrics', 'settlement'],
    metricIds: [],
    rundownColumns: [
      col('audio', 'Audio'),
      col('video', 'Video'),
      col('lighting', 'Lighting'),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    advanceChecklist: [],
    schemaPatch: {},
  },
];

export function getTemplate(id: string): EventTemplate {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? BUILTIN_TEMPLATES[BUILTIN_TEMPLATES.length - 1];
}
