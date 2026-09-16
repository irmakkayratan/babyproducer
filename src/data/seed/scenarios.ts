/**
 * Demo scenario specifications.
 *
 * A scenario is a compact parameter set (a few kilobytes), not a dump of
 * records — the generator expands it deterministically at load time. Vocabulary
 * here is demo content: everything is editable once loaded.
 */
import type { ModuleKey } from '@/data/types';

export interface GuestMix {
  count: number;
  voiceMix: Record<string, number>;
  tierMix: Record<string, number>;
  /** Probability of reaching Confirmed, by voice. */
  rsvpConversion: Record<string, number>;
  /** Median follower count by voice — expanded log-normally. */
  reachMedian: Record<string, number>;
  platformMix: Record<string, number>;
  companyCount: number;
  plusOneRate: number;
}

export interface ScenarioSpec {
  id: 'aurelia' | 'lumen' | 'nova';
  seed: string;
  name: string;
  kind: string;
  templateId: string;
  accent: string;
  venue: { name: string; address?: string };
  /** Days from "now" — negative means the event has already happened. */
  startsInDays: number;
  startHour: number;
  durationHours: number;
  capacity: number;
  guests: GuestMix;
  arrivals: { curve: 'preshow-spike' | 'steady' | 'walk-in-heavy'; attendedRate: number; walkInRate: number };
  modules: ModuleKey[];
  blurb: string;
}

export const SCENARIOS: ScenarioSpec[] = [
  {
    id: 'aurelia',
    seed: 'aurelia-ss27',
    name: 'AURELIA — SS27',
    kind: 'Runway Show',
    templateId: 'runway-show',
    accent: 'hsl(38 90% 62%)',
    venue: { name: 'Palais de Tokyo', address: '13 Av. du Président Wilson, Paris' },
    startsInDays: 12,
    startHour: 19,
    durationHours: 2,
    capacity: 420,
    blurb: 'Paris runway show with front-row politics and a 68-cue stack.',
    guests: {
      count: 420,
      voiceMix: { celebrity: 0.05, influencer: 0.24, media: 0.31, buyer: 0.24, partner: 0.11, owned: 0.05 },
      tierMix: { 'a-list': 0.06, 'front-row': 0.18, press: 0.3, buyer: 0.26, standing: 0.2 },
      rsvpConversion: { celebrity: 0.72, influencer: 0.84, media: 0.9, buyer: 0.93, partner: 0.88, owned: 0.98 },
      reachMedian: { celebrity: 4_200_000, influencer: 240_000, media: 48_000, buyer: 9_000, partner: 26_000, owned: 130_000 },
      platformMix: { instagram: 0.46, tiktok: 0.19, youtube: 0.07, x: 0.08, press: 0.2 },
      companyCount: 64,
      plusOneRate: 0.22,
    },
    arrivals: { curve: 'preshow-spike', attendedRate: 0.86, walkInRate: 0.02 },
    modules: ['guests', 'seating', 'rundown', 'checkin', 'command', 'metrics'],
  },
  {
    id: 'lumen',
    seed: 'lumen-popup',
    name: 'LUMEN Beauty — Pop-Up',
    kind: 'Activation',
    templateId: 'brand-activation',
    accent: 'hsl(325 75% 65%)',
    venue: { name: 'The Old Sorting Office', address: '21–31 New Oxford St, London' },
    startsInDays: -6,
    startHour: 11,
    durationHours: 8,
    capacity: 1800,
    blurb: 'Four-day retail activation: walk-in heavy, sensor telemetry, dwell time.',
    guests: {
      count: 640,
      voiceMix: { creator: 0.34, media: 0.12, vip: 0.06, public: 0.42, partner: 0.06 },
      tierMix: { hosted: 0.18, rsvp: 0.42, 'walk-in': 0.4 },
      rsvpConversion: { creator: 0.78, media: 0.85, vip: 0.7, public: 0.62, partner: 0.9 },
      reachMedian: { creator: 86_000, media: 40_000, vip: 900_000, public: 1_200, partner: 22_000 },
      platformMix: { instagram: 0.42, tiktok: 0.38, youtube: 0.08, x: 0.04, press: 0.08 },
      companyCount: 48,
      plusOneRate: 0.35,
    },
    arrivals: { curve: 'walk-in-heavy', attendedRate: 0.71, walkInRate: 0.38 },
    modules: ['guests', 'checkin', 'command', 'metrics', 'rundown'],
  },
  {
    id: 'nova',
    seed: 'nova-launch',
    name: 'NOVA — Launch Keynote',
    kind: 'Keynote',
    templateId: 'product-launch',
    accent: 'hsl(210 90% 62%)',
    venue: { name: 'Kulturhuset Stadsteatern', address: 'Sergels torg, Stockholm' },
    startsInDays: 34,
    startHour: 10,
    durationHours: 3,
    capacity: 900,
    blurb: 'Corporate launch: theatre seating, rehearsal blocks, teleprompter scripts.',
    guests: {
      count: 780,
      voiceMix: { analyst: 0.12, press: 0.22, customer: 0.4, partner: 0.16, internal: 0.1 },
      tierMix: { 'keynote-row': 0.08, reserved: 0.34, general: 0.58 },
      rsvpConversion: { analyst: 0.88, press: 0.82, customer: 0.74, partner: 0.86, internal: 0.97 },
      reachMedian: { analyst: 32_000, press: 60_000, customer: 3_400, partner: 18_000, internal: 5_000 },
      platformMix: { x: 0.34, press: 0.3, youtube: 0.14, instagram: 0.14, tiktok: 0.08 },
      companyCount: 120,
      plusOneRate: 0.12,
    },
    arrivals: { curve: 'steady', attendedRate: 0.79, walkInRate: 0.05 },
    modules: ['guests', 'seating', 'rundown', 'checkin', 'command', 'metrics'],
  },
];

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
