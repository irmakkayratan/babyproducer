/**
 * Built-in event templates.
 *
 * This file (and seed/) is where industry vocabulary is allowed to live: a
 * template is data, applied by `applyTemplate()`, and every word in it is
 * editable by the user afterwards. The app's defaults stay neutral.
 */
import type { EventTemplate, RundownColumn, Vocab } from './types';

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

export const BUILTIN_TEMPLATES: EventTemplate[] = [
  {
    id: 'runway-show',
    name: 'Runway Show',
    kind: 'Runway Show',
    description:
      'Curated guest list, front-row politics, tight cue stack. Voices and tiers set up for fashion week.',
    accent: 'hsl(38 90% 62%)',
    builtin: true,
    seatingPreset: 'runway',
    enabledModules: ['guests', 'seating', 'rundown', 'checkin', 'command', 'metrics'],
    metricIds: ['miv', 'emv'],
    rundownColumns: [
      col('music', 'Music'),
      col('lighting', 'Lighting'),
      col('models', 'Model Order', 200),
      col('camera', 'Camera', 160),
      col('notes', 'Notes', 240, 'longtext', false),
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
    accent: 'hsl(325 75% 65%)',
    builtin: true,
    seatingPreset: 'open-floor',
    enabledModules: ['guests', 'checkin', 'command', 'metrics', 'rundown'],
    metricIds: ['miv', 'emv'],
    rundownColumns: [
      col('station', 'Station'),
      col('staffing', 'Staffing'),
      col('content', 'Content Capture', 200),
      col('notes', 'Notes', 240, 'longtext', false),
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
    accent: 'hsl(210 90% 62%)',
    builtin: true,
    seatingPreset: 'theatre',
    enabledModules: ['guests', 'seating', 'rundown', 'checkin', 'command', 'metrics'],
    metricIds: ['emv'],
    rundownColumns: [
      col('slides', 'Slides'),
      col('mics', 'Mics', 140),
      col('stream', 'Stream', 160),
      col('lowerthirds', 'Lower Thirds', 200),
      col('notes', 'Notes', 240, 'longtext', false),
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
    accent: 'hsl(190 80% 52%)',
    builtin: true,
    seatingPreset: 'theatre',
    enabledModules: ['guests', 'rundown', 'checkin', 'command'],
    metricIds: [],
    rundownColumns: [
      col('speaker', 'Speaker'),
      col('av', 'AV'),
      col('room', 'Room', 140),
      col('notes', 'Notes', 240, 'longtext', false),
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
    accent: 'hsl(152 50% 52%)',
    builtin: true,
    seatingPreset: 'banquet',
    enabledModules: ['guests', 'seating', 'rundown', 'checkin', 'metrics'],
    metricIds: ['miv'],
    rundownColumns: [
      col('service', 'Service'),
      col('audio', 'Audio'),
      col('lighting', 'Lighting'),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
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
    id: 'blank',
    name: 'Blank',
    kind: 'Event',
    description: 'No assumptions. Neutral vocabulary you shape yourself in Studio.',
    accent: 'hsl(258 85% 68%)',
    builtin: true,
    seatingPreset: 'none',
    enabledModules: ['guests', 'seating', 'rundown', 'checkin', 'command', 'metrics'],
    metricIds: [],
    rundownColumns: [
      col('audio', 'Audio'),
      col('video', 'Video'),
      col('lighting', 'Lighting'),
      col('notes', 'Notes', 240, 'longtext', false),
    ],
    schemaPatch: {},
  },
];

export function getTemplate(id: string): EventTemplate {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? BUILTIN_TEMPLATES[BUILTIN_TEMPLATES.length - 1];
}
