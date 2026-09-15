/**
 * Deterministic demo generation.
 *
 * Numbers are plausible rather than random: follower counts are log-normal,
 * engagement falls as reach rises, RSVP conversion varies by voice, and
 * arrivals follow a curve. The same seed always rebuilds the same demo, which
 * is what makes screenshots and tests stable.
 */
import { db } from '@/data/db';
import { createEvent, createWorkspace } from '@/data/repo';
import { getTemplate } from '@/data/templates';
import type { Arrival, Company, Guest, SeatingMap, SeatingRule, Workspace } from '@/data/types';
import { createRng, type Rng } from '@/lib/rng';
import { qrToken, ulid } from '@/lib/id';
import { brandName, handleFor, outletName, personName } from './names';
import { buildPreset } from './rooms';
import { ACTIVATION_SOURCES, generateTelemetry, SHOW_SOURCES } from './telemetry';
import { allSeats } from '@/modules/seating/geometry';
import { SCENARIOS, type ScenarioSpec } from './scenarios';

const DEMO_WORKSPACE_NAME = 'Demo Productions';

function stamp<T extends object>(value: T, iso: string) {
  return { ...value, createdAt: iso, updatedAt: iso, rev: 1 };
}

function eventWindow(spec: ScenarioSpec, now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() + spec.startsInDays);
  start.setHours(spec.startHour, 0, 0, 0);
  const end = new Date(start.getTime() + spec.durationHours * 3600_000);
  const doors = new Date(start.getTime() - 60 * 60_000);
  return { start, end, doors };
}

/** Engagement rate falls as an account grows — the well-known inverse curve. */
function engagementFor(followers: number, rng: Rng): number {
  const base = 0.16 / Math.log10(Math.max(followers, 100));
  return Math.max(0.002, Math.min(0.22, base * rng.normal(1, 0.25)));
}

function contentQualityFor(voiceId: string, rng: Rng): number {
  const bias: Record<string, number> = {
    celebrity: 0.78, influencer: 0.68, media: 0.82, buyer: 0.55, partner: 0.6, owned: 0.88,
    creator: 0.7, vip: 0.8, public: 0.38, analyst: 0.72, press: 0.8, customer: 0.45, internal: 0.66,
  };
  const mean = bias[voiceId] ?? 0.6;
  return Math.max(0.05, Math.min(1, rng.normal(mean, 0.16)));
}

function generateCompanies(spec: ScenarioSpec, eventId: string, rng: Rng, iso: string): Company[] {
  return Array.from({ length: spec.guests.companyCount }, () =>
    stamp(
      {
        id: ulid(Date.now(), rng.next),
        eventId,
        name: rng.bool(0.5) ? brandName(rng) : outletName(rng),
        fields: {},
      },
      iso,
    ),
  );
}

function generateGuests(
  spec: ScenarioSpec,
  eventId: string,
  companies: Company[],
  rng: Rng,
  iso: string,
): Guest[] {
  const { guests: mix } = spec;
  return Array.from({ length: mix.count }, () => {
    const voiceId = rng.weighted(mix.voiceMix);
    const tierId = rng.weighted(mix.tierMix);
    const name = personName(rng);
    const followers = Math.round(rng.logNormal(mix.reachMedian[voiceId] ?? 10_000, 1.25));
    const engagement = engagementFor(followers, rng);
    const company = rng.bool(0.82) ? rng.pick(companies) : undefined;
    const confirmed = rng.bool(mix.rsvpConversion[voiceId] ?? 0.8);

    return stamp(
      {
        id: ulid(Date.now(), rng.next),
        eventId,
        name,
        handle: rng.bool(0.86) ? handleFor(name, rng) : undefined,
        companyId: company?.id,
        company: company?.name,
        tierId,
        voiceId,
        statusId: confirmed ? 'confirmed' : rng.bool(0.12) ? 'declined' : 'invited',
        email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
        plusOnes: rng.bool(mix.plusOneRate) ? rng.int(1, 2) : 0,
        audience: {
          followers,
          avgEngagementRate: Number(engagement.toFixed(4)),
          platform: rng.weighted(mix.platformMix),
          impressions: Math.round(followers * rng.normal(1.8, 0.5)),
          contentQuality: Number(contentQualityFor(voiceId, rng).toFixed(2)),
        },
        tags: rng.bool(0.22) ? [rng.pick(['priority', 'photo call', 'gifting', 'interview', 'seated early'])] : [],
        notes: undefined,
        fields: {},
        qrToken: qrToken(rng.next),
      },
      iso,
    );
  });
}

/**
 * Arrival times follow the curve the scenario describes: a runway show spikes
 * in the 40 minutes before doors, a pop-up trickles all day.
 */
function generateArrivals(spec: ScenarioSpec, guests: Guest[], doors: Date, rng: Rng, deviceId: string): Arrival[] {
  const arrivals: Arrival[] = [];
  const windowMs = spec.arrivals.curve === 'walk-in-heavy' ? 8 * 3600_000 : 75 * 60_000;

  for (const guest of guests) {
    if (guest.statusId === 'declined') continue;
    if (!rng.bool(spec.arrivals.attendedRate)) continue;

    let offset: number;
    if (spec.arrivals.curve === 'preshow-spike') {
      // Most people arrive late in the window; a few are early.
      offset = -windowMs * Math.min(1, Math.abs(rng.normal(0.25, 0.22)));
    } else if (spec.arrivals.curve === 'walk-in-heavy') {
      offset = rng.next() * windowMs;
    } else {
      offset = -windowMs * 0.6 + rng.next() * windowMs;
    }

    arrivals.push({
      id: ulid(Date.now(), rng.next),
      eventId: guest.eventId,
      guestId: guest.id,
      at: new Date(doors.getTime() + offset).toISOString(),
      method: rng.bool(spec.arrivals.walkInRate) ? 'walk-in' : rng.bool(0.82) ? 'qr' : 'search',
      deviceId,
      partySize: 1 + guest.plusOnes,
    });
  }

  return arrivals;
}

/**
 * A seated room, with the politics that make seating interesting: a pair who
 * must not sit near each other, a pair who must sit together, and a front row
 * reserved for the top tier.
 */
function generateSeating(
  spec: ScenarioSpec,
  eventId: string,
  templatePreset: 'runway' | 'theatre' | 'banquet' | 'open-floor' | 'none',
  guests: Guest[],
  rng: Rng,
): SeatingMap | null {
  const map = buildPreset(templatePreset, eventId, { capacity: spec.capacity, rng });
  if (!map) return null;

  const tierOrder = Object.keys(spec.guests.tierMix);
  const seatable = guests
    .filter((guest) => guest.statusId !== 'declined')
    .sort((a, b) => tierOrder.indexOf(a.tierId ?? '') - tierOrder.indexOf(b.tierId ?? ''));

  const positions = allSeats(map);
  const assignments = new Map<string, string>();
  // Leave a few seats open: a real chart always has last-minute gaps.
  const fill = Math.floor(positions.length * 0.92);
  for (let i = 0; i < Math.min(fill, seatable.length); i++) {
    assignments.set(positions[i].seat.id, seatable[i].id);
    seatable[i].seatId = positions[i].seat.id;
  }

  const topTier = tierOrder[0];
  const frontRowZone = map.zones[0]?.id;
  const topTierGuests = seatable.filter((guest) => guest.tierId === topTier).slice(0, 4);
  const rules: SeatingRule[] = [];
  if (topTierGuests.length >= 4) {
    rules.push({
      id: 'keep-apart-demo',
      type: 'keep-apart',
      label: `${topTierGuests[0].name} and ${topTierGuests[1].name} must not be seated near each other`,
      subjects: [topTierGuests[0].id, topTierGuests[1].id],
      severity: 'warn',
    });
    rules.push({
      id: 'together-demo',
      type: 'seat-together',
      label: `${topTierGuests[2].name} and ${topTierGuests[3].name} are attending together`,
      subjects: [topTierGuests[2].id, topTierGuests[3].id],
      severity: 'warn',
    });
  }
  if (frontRowZone && topTier) {
    rules.push({
      id: 'front-row-demo',
      type: 'tier-in-zone',
      label: `${map.zones[0].label} is held for the top tier`,
      subjects: [],
      tierId: topTier,
      zoneId: frontRowZone,
      severity: 'warn',
    });
  }

  return {
    ...map,
    rules,
    elements: map.elements.map((element) =>
      'seats' in element
        ? { ...element, seats: element.seats.map((seat) => ({ ...seat, guestId: assignments.get(seat.id) })) }
        : element,
    ),
  };
}

export interface SeedProgress {
  scenario: string;
  step: string;
  done: number;
  total: number;
}

/**
 * Builds the demo workspace. Past events get their arrivals and statuses
 * backfilled so the recap and command surfaces have something real to show;
 * upcoming events are left in their planning state.
 */
export async function seedDemoWorkspace(onProgress?: (progress: SeedProgress) => void): Promise<Workspace> {
  const existing = await db.workspaces.filter((workspace) => workspace.demo).first();
  if (existing) await removeDemoWorkspace(existing.id);

  const workspace = await createWorkspace({
    name: DEMO_WORKSPACE_NAME,
    demo: true,
    template: getTemplate('runway-show'),
  });

  const now = new Date();
  const total = SCENARIOS.length;

  for (const [index, spec] of SCENARIOS.entries()) {
    onProgress?.({ scenario: spec.name, step: 'Building guests', done: index, total });

    const rng = createRng(spec.seed);
    const { start, end, doors } = eventWindow(spec, now);
    const iso = new Date(start.getTime() - 30 * 86_400_000).toISOString();

    const event = await createEvent({
      workspaceId: workspace.id,
      name: spec.name,
      templateId: spec.templateId,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      doorsAt: doors.toISOString(),
      venue: spec.venue,
      capacity: spec.capacity,
      theme: { accent: spec.accent },
    });

    const companies = generateCompanies(spec, event.id, rng, iso);
    const guests = generateGuests(spec, event.id, companies, rng, iso);

    const seating = generateSeating(
      spec,
      event.id,
      (getTemplate(spec.templateId).seatingPreset ?? 'none') as 'runway' | 'theatre' | 'banquet' | 'open-floor' | 'none',
      guests,
      rng,
    );

    // Sensor feeds run from doors to the end of the event; an upcoming event
    // gets the window it will have, so the dashboard is never empty.
    const telemetry = generateTelemetry(
      event.id,
      spec.id === 'lumen' ? ACTIVATION_SOURCES : SHOW_SOURCES,
      {
        start: doors,
        end,
        stepMinutes: spec.durationHours > 4 ? 15 : 5,
        seed: spec.seed,
      },
    );

    const isPast = end.getTime() < now.getTime();
    const arrivals = isPast ? generateArrivals(spec, guests, doors, rng, 'demo-device') : [];
    const arrivedIds = new Set(arrivals.map((a) => a.guestId));

    for (const guest of guests) {
      if (arrivedIds.has(guest.id)) guest.statusId = 'arrived';
      else if (isPast && guest.statusId === 'confirmed') guest.statusId = 'no-show';
    }

    await db.transaction(
      'rw',
      [db.companies, db.guests, db.arrivals, db.events, db.seatingMaps, db.telemetry],
      async () => {
      await db.companies.bulkPut(companies);
      await db.guests.bulkPut(guests);
      if (arrivals.length) await db.arrivals.bulkPut(arrivals);
      if (seating) await db.seatingMaps.put(seating);
      await db.telemetry.bulkPut(telemetry);
      await db.events.update(event.id, { statusId: isPast ? 'complete' : 'planning' });
      },
    );

    onProgress?.({ scenario: spec.name, step: 'Done', done: index + 1, total });
  }

  return (await db.workspaces.get(workspace.id))!;
}

export async function removeDemoWorkspace(workspaceId: string): Promise<void> {
  const events = await db.events.where('workspaceId').equals(workspaceId).toArray();
  const eventIds = events.map((event) => event.id);

  await db.transaction(
    'rw',
    [db.workspaces, db.events, db.guests, db.companies, db.arrivals, db.seatingMaps, db.telemetry, db.dashboards, db.rundowns],
    async () => {
      for (const id of eventIds) {
        await db.guests.where('eventId').equals(id).delete();
        await db.companies.where('eventId').equals(id).delete();
        await db.arrivals.where('eventId').equals(id).delete();
        await db.seatingMaps.where('eventId').equals(id).delete();
        await db.telemetry.where('eventId').equals(id).delete();
        await db.dashboards.where('eventId').equals(id).delete();
        await db.rundowns.delete(id);
      }
      await db.events.bulkDelete(eventIds);
      await db.workspaces.delete(workspaceId);
    },
  );
}

/** Reset only ever touches workspaces flagged as demo. */
export async function resetDemoData(): Promise<Workspace> {
  return seedDemoWorkspace();
}
