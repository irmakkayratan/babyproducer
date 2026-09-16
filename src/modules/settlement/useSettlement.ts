import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ensureSettlement, getSettlement } from '@/data/settlement';
import type { Event, SettlementSheet } from '@/data/types';

/**
 * The settlement sheet for an event, live.
 *
 * Settlements get worked on two screens at once, the promoter's laptop and the
 * tour manager's. This reads through Dexie's live query, so every write lands
 * on both within a tick.
 */
export function useSettlement(event: Event | undefined): {
  sheet: SettlementSheet | undefined;
  loading: boolean;
} {
  useEffect(() => {
    if (event) void ensureSettlement(event);
  }, [event]);

  const sheet = useLiveQuery(
    async () => (event ? ((await getSettlement(event.id)) ?? null) : null),
    [event?.id],
    undefined,
  );

  return { sheet: sheet ?? undefined, loading: sheet === undefined };
}
