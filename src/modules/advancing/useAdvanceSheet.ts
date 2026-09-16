import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { ensureAdvanceSheet, getAdvanceSheet } from '@/data/advancing';
import type { AdvanceSheet, Event } from '@/data/types';

/**
 * The advance sheet for an event, live.
 *
 * Reads go through Dexie's live query, so a change made in another tab (the
 * production office laptop next to the door desk) lands here with no refresh.
 * Writes go straight to `data/advancing`, which is what feeds it.
 */
export function useAdvanceSheet(event: Event | undefined): {
  sheet: AdvanceSheet | undefined;
  loading: boolean;
} {
  // An event that predates the module, or arrived through an older import,
  // has no sheet yet; build it once on the way in.
  useEffect(() => {
    if (event) void ensureAdvanceSheet(event);
  }, [event]);

  const sheet = useLiveQuery(
    async () => (event ? ((await getAdvanceSheet(event.id)) ?? null) : null),
    [event?.id],
    undefined,
  );

  // `undefined` is "still asking Dexie", `null` is "asked, nothing there".
  return { sheet: sheet ?? undefined, loading: sheet === undefined };
}

/** Live arrivals count, used by the settlement sheet's attendance pull. */
export function useArrivalCount(eventId: string | undefined): number {
  return (
    useLiveQuery(
      async () => {
        if (!eventId) return 0;
        const arrivals = await db.arrivals.where('eventId').equals(eventId).toArray();
        return arrivals.filter((arrival) => !arrival.undone).reduce((sum, arrival) => sum + arrival.partySize, 0);
      },
      [eventId],
      0,
    ) ?? 0
  );
}
