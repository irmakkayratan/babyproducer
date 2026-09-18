/**
 * Demo scenario specifications.
 *
 * A scenario is a compact parameter set, a few kilobytes. It stands in for
 * records, the generator expands it deterministically at load time. Vocabulary
 * here is demo content: everything is editable once loaded.
 */
import type { DealTerms, ModuleKey, SettlementLine } from '@/data/types';

export interface GuestMix {
  count: number;
  voiceMix: Record<string, number>;
  tierMix: Record<string, number>;
  /** Probability of reaching Confirmed, by voice. */
  rsvpConversion: Record<string, number>;
  /** Median follower count by voice. Expanded log-normally. */
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
  /** A project settled against a fee, with no box office, has no bands. */
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
  id: 'club-night' | 'festival' | 'launch' | 'tour';
  seed: string;
  name: string;
  kind: string;
  templateId: string;
  /**
   * Overrides the template's room. A template ships the shape its events
   * usually take; a scenario occasionally runs a different one, the way a
   * launch built on the activation template still seats a keynote.
   */
  seatingPreset?: 'runway' | 'theatre' | 'banquet' | 'open-floor' | 'none';
  accent: string;
  venue: { name: string; address?: string };
  /** Days from "now". Negative means the event has already happened. */
  startsInDays: number;
  startHour: number;
  durationHours: number;
  capacity: number;
  guests: GuestMix;
  arrivals: { curve: 'preshow-spike' | 'steady' | 'walk-in-heavy'; attendedRate: number; walkInRate: number };
  modules: ModuleKey[];
  /** The line of detail under the event name on its card. */
  subtitle: string;
  advance?: AdvanceSpec;
  settlement?: SettlementSpec;
}

export const SCENARIOS: ScenarioSpec[] = [
  {
    id: 'club-night',
    seed: 'club-night',
    name: 'Club Night',
    kind: 'Club Night',
    templateId: 'club-night',
    accent: 'hsl(0 0% 100%)',
    venue: { name: 'Säälchen', address: 'Holzmarktstraße 25, Berlin' },
    startsInDays: 12,
    startHour: 22,
    durationHours: 6,
    capacity: 700,
    subtitle: 'Electronic, 700 cap',
    guests: {
      count: 520,
      voiceMix: { dj: 0.04, crew: 0.12, promoter: 0.08, press: 0.1, guest: 0.66 },
      tierMix: { aaa: 0.06, 'artist-list': 0.14, 'guest-list': 0.34, presale: 0.3, door: 0.16 },
      rsvpConversion: { dj: 0.99, crew: 0.97, promoter: 0.94, press: 0.78, guest: 0.72 },
      reachMedian: { dj: 180_000, crew: 2_200, promoter: 12_000, press: 46_000, guest: 3_100 },
      platformMix: { instagram: 0.44, tiktok: 0.2, youtube: 0.08, x: 0.08, press: 0.2 },
      companyCount: 28,
      plusOneRate: 0.3,
    },
    // A club fills late and takes money on the door all night.
    arrivals: { curve: 'preshow-spike', attendedRate: 0.81, walkInRate: 0.14 },
    modules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'settlement'],
    advance: {
      confidence: 0.62,
      parties: [
        { name: 'Headline DJ', roleId: 'headline', headcount: 3, contactName: 'Booking agent', contactPhone: '+49 30 5557 1180' },
        { name: 'Opener', roleId: 'support', headcount: 2, contactName: 'Manager' },
        { name: 'Promoter crew', roleId: 'promoter', headcount: 9 },
      ],
      contacts: [
        { name: 'Jonas Lehmann', role: 'Venue manager', company: 'Säälchen', phone: '+49 30 5557 1100' },
        { name: 'Mina Hoffmann', role: 'Head of sound', company: 'Säälchen', phone: '+49 151 2244 8890' },
        { name: 'Deniz Yilmaz', role: 'Head of door', company: 'Nachtwacht Security', phone: '+49 160 778 2245' },
      ],
    },
  },
  {
    id: 'festival',
    seed: 'festival-stage',
    name: 'Festival Stage',
    kind: 'Festival Stage',
    templateId: 'festival-stage',
    accent: 'hsl(0 0% 70%)',
    venue: { name: 'Victoria Park', address: 'Grove Rd, London' },
    startsInDays: 34,
    startHour: 13,
    durationHours: 10,
    capacity: 12_000,
    subtitle: 'Main stage, one day',
    guests: {
      count: 620,
      voiceMix: { artist: 0.1, crew: 0.28, production: 0.16, press: 0.14, guest: 0.32 },
      tierMix: { aaa: 0.08, artist: 0.16, working: 0.36, photo: 0.1, wristband: 0.3 },
      rsvpConversion: { artist: 0.97, crew: 0.98, production: 0.99, press: 0.83, guest: 0.74 },
      reachMedian: { artist: 420_000, crew: 2_600, production: 4_200, press: 58_000, guest: 5_400 },
      platformMix: { instagram: 0.42, tiktok: 0.18, youtube: 0.12, x: 0.08, press: 0.2 },
      companyCount: 54,
      plusOneRate: 0.18,
    },
    arrivals: { curve: 'steady', attendedRate: 0.84, walkInRate: 0.08 },
    modules: ['guests', 'rundown', 'advancing', 'checkin', 'command', 'metrics'],
    // Five weeks out with five acts to advance: most of the sheet is still
    // open, which is the state the "still missing" panel exists for.
    advance: {
      confidence: 0.42,
      parties: [
        { name: 'Headline act', roleId: 'headline', headcount: 16, contactName: 'Tour manager', contactPhone: '+44 7700 900188' },
        { name: 'Main support', roleId: 'support', headcount: 9, contactName: 'Day-to-day manager' },
        { name: 'Early acts', roleId: 'support', headcount: 14 },
        { name: 'Stage crew', roleId: 'local-crew', headcount: 22 },
      ],
      contacts: [
        { name: 'Priya Nair', role: 'Stage manager', company: 'Victoria Park', phone: '+44 20 7946 0155' },
        { name: 'Callum Reid', role: 'Site production', company: 'Fieldworks Production', phone: '+44 7700 900244' },
        { name: 'Aoife Byrne', role: 'Artist liaison', company: 'Fieldworks Production', phone: '+44 7700 900319' },
      ],
    },
  },
  {
    id: 'launch',
    seed: 'brand-launch',
    name: 'Brand Launch',
    kind: 'Activation',
    templateId: 'brand-activation',
    // The activation template is open-floor, but this one seats a keynote
    // before the room turns over for the reception.
    seatingPreset: 'theatre',
    accent: 'hsl(0 0% 84%)',
    venue: { name: 'The Old Sorting Office', address: '21–31 New Oxford St, London' },
    startsInDays: -6,
    startHour: 18,
    durationHours: 5,
    capacity: 520,
    subtitle: 'Keynote and reception',
    guests: {
      // Invited well over the room, the way a launch always is, so the chart
      // keeps a real unseated queue rather than seating everybody.
      count: 640,
      voiceMix: { creator: 0.34, media: 0.12, vip: 0.06, public: 0.42, partner: 0.06 },
      tierMix: { hosted: 0.3, rsvp: 0.55, 'walk-in': 0.15 },
      rsvpConversion: { creator: 0.78, media: 0.85, vip: 0.7, public: 0.62, partner: 0.9 },
      reachMedian: { creator: 86_000, media: 40_000, vip: 900_000, public: 1_200, partner: 22_000 },
      platformMix: { instagram: 0.42, tiktok: 0.38, youtube: 0.08, x: 0.04, press: 0.08 },
      companyCount: 48,
      plusOneRate: 0.35,
    },
    arrivals: { curve: 'steady', attendedRate: 0.74, walkInRate: 0.12 },
    modules: ['guests', 'seating', 'rundown', 'advancing', 'checkin', 'command', 'metrics', 'settlement'],
    advance: {
      confidence: 0.97,
      parties: [
        { name: 'Brand team', roleId: 'principal', headcount: 8, contactName: 'Brand experience lead' },
        { name: 'Build crew', roleId: 'crew', headcount: 16 },
        { name: 'Hosts and floor staff', roleId: 'crew', headcount: 24 },
      ],
      contacts: [
        { name: 'Ruth Adeyemi', role: 'Landlord liaison', company: 'The Old Sorting Office', phone: '+44 20 7946 0102' },
        { name: 'Tom Hargreaves', role: 'Build lead', company: 'Northbank Scenic', phone: '+44 7700 900412' },
      ],
    },
    // A launch has no box office: it is a fee against a budget, and the same
    // statement handles it.
    settlement: {
      currency: 'GBP',
      noBoxOffice: true,
      deductions: [],
      otherRevenue: [
        { label: 'Client production fee', basis: 'fixed', amount: 168_000 },
        { label: 'Content licensing share', basis: 'fixed', amount: 21_400 },
      ],
      expenses: [
        { label: 'Venue hire and rooms', basis: 'fixed', amount: 38_000, categoryId: 'venue' },
        { label: 'Build and scenic', basis: 'fixed', amount: 52_500, categoryId: 'production' },
        { label: 'AV, lighting and sensors', basis: 'fixed', amount: 16_800, categoryId: 'production' },
        { label: 'Hosts and front of house', basis: 'fixed', amount: 19_200, categoryId: 'staffing' },
        { label: 'Content capture crew', basis: 'fixed', amount: 8400, categoryId: 'production' },
        { label: 'Catering and hospitality', basis: 'fixed', amount: 6100, categoryId: 'hospitality' },
        { label: 'Paid social and print', basis: 'fixed', amount: 11_500, categoryId: 'marketing' },
      ],
      parties: [
        {
          name: 'Production agency',
          roleId: 'principal',
          deal: { kind: 'percentage', guarantee: 0, percentage: 15, basis: 'gross', breakeven: 0 },
          deposit: 20_000,
        },
      ],
    },
  },
  {
    id: 'tour',
    seed: 'tour-date',
    name: 'Tour Date',
    kind: 'Live Show',
    templateId: 'live-show',
    accent: 'hsl(0 0% 56%)',
    venue: { name: 'Muziekgebouw aan het IJ', address: 'Piet Heinkade 1, Amsterdam' },
    startsInDays: -3,
    startHour: 20,
    durationHours: 4,
    capacity: 1500,
    subtitle: 'Two day load-in',
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
        { name: 'Headline act', roleId: 'headline', headcount: 11, contactName: 'Nadia Faber', contactPhone: '+31 6 1188 4420' },
        { name: 'Support act', roleId: 'support', headcount: 5, contactName: 'Tour manager' },
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
          name: 'Headline act',
          roleId: 'headline',
          // The classic touring deal: a guarantee the artist is paid whatever
          // happens, against 85% of what is left once the show is paid for.
          deal: { kind: 'versus', guarantee: 12_000, percentage: 70, basis: 'net', breakeven: 0 },
          deposit: 6000,
          withholdingPercent: 15,
          adjustments: [{ label: 'Rider buyout', basis: 'fixed', amount: 850 }],
        },
        {
          name: 'Support act',
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
