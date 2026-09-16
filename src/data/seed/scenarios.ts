/**
 * Demo scenario specifications.
 *
 * A scenario is a compact parameter set (a few kilobytes), not a dump of
 * records — the generator expands it deterministically at load time. Vocabulary
 * here is demo content: everything is editable once loaded.
 */
import type { DealTerms, ModuleKey, SettlementLine } from '@/data/types';

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

/** The travelling parties and contacts an advance is run for. */
export interface AdvanceSpec {
  parties: Array<{ name: string; roleId?: string; headcount: number; contactName?: string; contactPhone?: string }>;
  contacts: Array<{ name: string; role: string; company?: string; phone?: string; email?: string }>;
  /** How far along the advance is: raises the odds of a confirmed line. */
  confidence: number;
}

/** What the box office did and what the deal was. */
export interface SettlementSpec {
  currency?: string;
  /** Share of each band's allotment that sold. */
  soldRate?: number;
  compsRate?: number;
  /** A project settled against a fee rather than a box office has no bands. */
  noBoxOffice?: boolean;
  deductions?: Array<Omit<SettlementLine, 'id'>>;
  otherRevenue?: Array<Omit<SettlementLine, 'id'>>;
  /** Replaces the template's costs when a scenario prices its own. */
  expenses?: Array<Omit<SettlementLine, 'id'>>;
  parties: Array<{
    name: string;
    roleId?: string;
    deal: DealTerms;
    deposit?: number;
    withholdingPercent?: number;
    adjustments?: Array<Omit<SettlementLine, 'id'>>;
  }>;
}

export interface ScenarioSpec {
  id: 'aurelia' | 'lumen' | 'nova' | 'atlas';
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
  advance?: AdvanceSpec;
  settlement?: SettlementSpec;
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
    modules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'command', 'metrics'],
    advance: {
      confidence: 0.62,
      parties: [
        { name: 'Design studio', roleId: 'principal', headcount: 14, contactName: 'Studio production', contactPhone: '+33 6 12 44 90 21' },
        { name: 'Casting and hair/make-up', roleId: 'crew', headcount: 38, contactName: 'Casting desk' },
        { name: 'Show crew', roleId: 'crew', headcount: 22 },
      ],
      contacts: [
        { name: 'Camille Roux', role: 'Venue production manager', company: 'Palais de Tokyo', phone: '+33 1 47 23 54 01' },
        { name: 'Ibrahim Sy', role: 'Head of security', company: 'Palais de Tokyo', phone: '+33 6 88 12 02 77' },
        { name: 'Marta Oliveira', role: 'Show caller', company: 'Atelier Productions', phone: '+33 6 21 55 18 04' },
      ],
    },
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
    modules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'metrics', 'settlement'],
    advance: {
      confidence: 0.97,
      parties: [
        { name: 'Brand team', roleId: 'principal', headcount: 8, contactName: 'Brand experience lead' },
        { name: 'Build crew', roleId: 'crew', headcount: 16 },
        { name: 'Floor staff', roleId: 'crew', headcount: 24 },
      ],
      contacts: [
        { name: 'Ruth Adeyemi', role: 'Landlord liaison', company: 'The Old Sorting Office', phone: '+44 20 7946 0102' },
        { name: 'Tom Hargreaves', role: 'Build lead', company: 'Northbank Scenic', phone: '+44 7700 900412' },
      ],
    },
    // A brand activation has no box office: it is a fee against a budget, and
    // the same statement handles it.
    settlement: {
      currency: 'GBP',
      noBoxOffice: true,
      deductions: [],
      otherRevenue: [
        { label: 'Client production fee', basis: 'fixed', amount: 168_000 },
        { label: 'Retail sales share', basis: 'fixed', amount: 21_400 },
      ],
      expenses: [
        { label: 'Space hire, four days', basis: 'fixed', amount: 38_000, categoryId: 'venue' },
        { label: 'Build and scenic', basis: 'fixed', amount: 52_500, categoryId: 'production' },
        { label: 'AV, lighting and sensors', basis: 'fixed', amount: 16_800, categoryId: 'production' },
        { label: 'Floor staff and hosts', basis: 'fixed', amount: 19_200, categoryId: 'staffing' },
        { label: 'Content capture crew', basis: 'fixed', amount: 8400, categoryId: 'production' },
        { label: 'Catering and hospitality', basis: 'fixed', amount: 6100, categoryId: 'hospitality' },
        { label: 'Paid social and print', basis: 'fixed', amount: 11_500, categoryId: 'marketing' },
      ],
      parties: [
        {
          name: 'Atelier Productions',
          roleId: 'principal',
          deal: { kind: 'percentage', guarantee: 0, percentage: 15, basis: 'gross', breakeven: 0 },
          deposit: 20_000,
        },
      ],
    },
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
    modules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'command', 'metrics'],
    advance: {
      confidence: 0.5,
      parties: [
        { name: 'Executive speakers', roleId: 'principal', headcount: 6, contactName: 'Comms lead' },
        { name: 'Broadcast crew', roleId: 'crew', headcount: 18 },
      ],
      contacts: [
        { name: 'Elin Bergström', role: 'Technical manager', company: 'Kulturhuset', phone: '+46 8 506 20 10' },
        { name: 'Jonas Lind', role: 'Stream producer', company: 'Norrsken Broadcast', phone: '+46 70 555 21 88' },
      ],
    },
  },
  {
    id: 'atlas',
    seed: 'atlas-tour',
    name: 'ATLAS — Tour Date',
    kind: 'Live Show',
    templateId: 'live-show',
    accent: 'hsl(12 80% 62%)',
    venue: { name: 'Muziekgebouw aan het IJ', address: 'Piet Heinkade 1, Amsterdam' },
    startsInDays: -3,
    startHour: 20,
    durationHours: 4,
    capacity: 1500,
    blurb: 'A touring date settled the night it happened: advance, box office, deal.',
    guests: {
      count: 260,
      voiceMix: { artist: 0.12, crew: 0.24, promoter: 0.1, press: 0.18, guest: 0.36 },
      tierMix: { aaa: 0.12, working: 0.26, photo: 0.1, 'guest-list': 0.32, ticket: 0.2 },
      rsvpConversion: { artist: 0.99, crew: 0.98, promoter: 0.95, press: 0.8, guest: 0.7 },
      reachMedian: { artist: 320_000, crew: 2_400, promoter: 8_000, press: 54_000, guest: 3_600 },
      platformMix: { instagram: 0.4, tiktok: 0.14, youtube: 0.1, x: 0.1, press: 0.26 },
      companyCount: 32,
      plusOneRate: 0.28,
    },
    arrivals: { curve: 'preshow-spike', attendedRate: 0.83, walkInRate: 0.06 },
    modules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'metrics', 'settlement'],
    advance: {
      confidence: 0.98,
      parties: [
        { name: 'ATLAS', roleId: 'headline', headcount: 11, contactName: 'Nadia Faber', contactPhone: '+31 6 1188 4420' },
        { name: 'Halveil', roleId: 'support', headcount: 5, contactName: 'Tour manager' },
        { name: 'Touring crew', roleId: 'touring-crew', headcount: 9 },
      ],
      contacts: [
        { name: 'Sanne de Wit', role: 'Venue production manager', company: 'Muziekgebouw', phone: '+31 20 788 2000' },
        { name: 'Kwame Boateng', role: 'Head of audio', company: 'Muziekgebouw', phone: '+31 6 2244 7781' },
        { name: 'Ilse Mulder', role: 'Box office manager', company: 'Muziekgebouw', phone: '+31 6 5510 3390' },
        { name: 'Pieter Vos', role: 'Promoter rep', company: 'Lowlands Live', phone: '+31 6 4409 8812' },
      ],
    },
    settlement: {
      soldRate: 0.88,
      compsRate: 0.04,
      // Dutch rates: live performance is taxed at the reduced band, and
      // author's rights are calculated on what the tax and the ticketing fee
      // leave behind.
      deductions: [
        { label: 'VAT', basis: 'percent-gross', amount: 9, categoryId: 'ticketing' },
        { label: 'Ticketing fee', basis: 'percent-gross', amount: 8, categoryId: 'ticketing' },
        { label: "Author's rights", basis: 'percent-adjusted', amount: 8.8, categoryId: 'ticketing' },
      ],
      otherRevenue: [
        { label: 'Merchandise split, 20% of net sales', basis: 'fixed', amount: 2860 },
        { label: 'Bar share', basis: 'fixed', amount: 4150 },
      ],
      parties: [
        {
          name: 'ATLAS',
          roleId: 'headline',
          // The classic touring deal: a guarantee the artist is paid whatever
          // happens, against 85% of what is left once the show is paid for.
          deal: { kind: 'versus', guarantee: 12_000, percentage: 70, basis: 'net', breakeven: 0 },
          deposit: 6000,
          withholdingPercent: 15,
          adjustments: [{ label: 'Rider buyout', basis: 'fixed', amount: 850 }],
        },
        {
          name: 'Halveil',
          roleId: 'support',
          deal: { kind: 'flat', guarantee: 1800, percentage: 0, basis: 'net', breakeven: 0 },
          deposit: 0,
          withholdingPercent: 15,
        },
      ],
    },
  },
];

export function getScenario(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
