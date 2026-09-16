import type { Guest, SavedView, ViewFilter } from '@/data/types';
import * as guestRepo from '@/data/guests';
import type { SliceCreator } from '../types';

export interface GuestSlice {
  guests: Guest[];
  guestsEventId: string | null;
  guestsLoading: boolean;
  arrivedIds: string[];

  search: string;
  filters: ViewFilter[];
  sort: Array<{ id: string; desc: boolean }>;
  selection: string[];
  hiddenColumns: string[];
  groupBy: string | null;
  density: 'compact' | 'comfortable';
  activeViewId: string | null;
  openGuestId: string | null;

  loadGuests: (eventId: string) => Promise<void>;
  reloadGuests: () => Promise<void>;
  setSearch: (search: string) => void;
  setFilters: (filters: ViewFilter[]) => void;
  toggleFilterValue: (field: string, value: string) => void;
  clearFilters: () => void;
  setSort: (sort: Array<{ id: string; desc: boolean }>) => void;
  toggleColumn: (columnId: string) => void;
  setGroupBy: (field: string | null) => void;
  setDensity: (density: 'compact' | 'comfortable') => void;
  setSelection: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  openGuest: (id: string | null) => void;

  updateGuest: (id: string, patch: Partial<Omit<Guest, 'id'>>) => Promise<void>;
  bulkUpdateGuests: (ids: string[], patch: Partial<Omit<Guest, 'id'>>) => Promise<void>;
  deleteGuests: (ids: string[]) => Promise<void>;
  /** Optimistic: the row flips immediately, then reconciles with the database. */
  checkIn: (id: string, arrivedStatusId?: string) => Promise<guestRepo.CheckInResult>;
  undoCheckIn: (id: string, previousStatusId?: string) => Promise<void>;
  applyRemoteGuestChange: (guestIds: string[]) => Promise<void>;
  applySavedView: (view: SavedView) => void;
}

export const createGuestSlice: SliceCreator<GuestSlice> = (set, get) => ({
  guests: [],
  guestsEventId: null,
  guestsLoading: false,
  arrivedIds: [],

  search: '',
  filters: [],
  sort: [],
  selection: [],
  hiddenColumns: [],
  groupBy: null,
  density: 'compact',
  activeViewId: null,
  openGuestId: null,

  loadGuests: async (eventId) => {
    if (get().guestsEventId === eventId && get().guests.length > 0) return;
    set((s) => {
      s.guestsLoading = true;
      s.guestsEventId = eventId;
      s.selection = [];
    });
    const [guests, arrived] = await Promise.all([
      guestRepo.listGuests(eventId),
      guestRepo.arrivedGuestIds(eventId),
    ]);
    set((s) => {
      s.guests = guests;
      s.arrivedIds = [...arrived];
      s.guestsLoading = false;
    });
  },

  reloadGuests: async () => {
    const eventId = get().guestsEventId;
    if (!eventId) return;
    const [guests, arrived] = await Promise.all([
      guestRepo.listGuests(eventId),
      guestRepo.arrivedGuestIds(eventId),
    ]);
    set((s) => {
      s.guests = guests;
      s.arrivedIds = [...arrived];
    });
  },

  setSearch: (search) =>
    set((s) => {
      s.search = search;
    }),

  setFilters: (filters) =>
    set((s) => {
      s.filters = filters;
      s.activeViewId = null;
    }),

  toggleFilterValue: (field, value) =>
    set((s) => {
      const existing = s.filters.find((f) => f.field === field && f.op === 'is');
      if (!existing) {
        s.filters.push({ field, op: 'is', value: [value] });
        return;
      }
      const values = Array.isArray(existing.value) ? [...existing.value] : [];
      const index = values.indexOf(value);
      if (index >= 0) values.splice(index, 1);
      else values.push(value);
      if (values.length === 0) s.filters = s.filters.filter((f) => f !== existing);
      else existing.value = values;
      s.activeViewId = null;
    }),

  clearFilters: () =>
    set((s) => {
      s.filters = [];
      s.search = '';
      s.activeViewId = null;
    }),

  setSort: (sort) =>
    set((s) => {
      s.sort = sort;
    }),

  toggleColumn: (columnId) =>
    set((s) => {
      const index = s.hiddenColumns.indexOf(columnId);
      if (index >= 0) s.hiddenColumns.splice(index, 1);
      else s.hiddenColumns.push(columnId);
    }),

  setGroupBy: (field) =>
    set((s) => {
      s.groupBy = field;
    }),

  setDensity: (density) =>
    set((s) => {
      s.density = density;
    }),

  setSelection: (ids) =>
    set((s) => {
      s.selection = ids;
    }),

  toggleSelected: (id) =>
    set((s) => {
      const index = s.selection.indexOf(id);
      if (index >= 0) s.selection.splice(index, 1);
      else s.selection.push(id);
    }),

  openGuest: (id) =>
    set((s) => {
      s.openGuestId = id;
    }),

  updateGuest: async (id, patch) => {
    set((s) => {
      const guest = s.guests.find((g) => g.id === id);
      if (guest) Object.assign(guest, patch);
    });
    const next = await guestRepo.updateGuest(id, patch);
    if (next) {
      set((s) => {
        const index = s.guests.findIndex((g) => g.id === id);
        if (index >= 0) s.guests[index] = next;
      });
    }
  },

  bulkUpdateGuests: async (ids, patch) => {
    set((s) => {
      for (const guest of s.guests) if (ids.includes(guest.id)) Object.assign(guest, patch);
    });
    await guestRepo.bulkUpdateGuests(ids, patch);
    await get().reloadGuests();
  },

  deleteGuests: async (ids) => {
    const eventId = get().guestsEventId;
    if (!eventId) return;
    set((s) => {
      s.guests = s.guests.filter((g) => !ids.includes(g.id));
      s.selection = [];
    });
    await guestRepo.deleteGuests(ids, eventId);
  },

  checkIn: async (id, arrivedStatusId) => {
    const previous = get().guests.find((g) => g.id === id);
    // Optimistic: the desk sees the flip instantly.
    set((s) => {
      const guest = s.guests.find((g) => g.id === id);
      if (guest && arrivedStatusId) guest.statusId = arrivedStatusId;
      if (!s.arrivedIds.includes(id)) s.arrivedIds.push(id);
    });

    const result = await guestRepo.checkInGuest(id, { method: 'manual', arrivedStatusId });
    if (!result.ok) {
      // Roll back the optimistic flip, but keep the arrived marker when the
      // reason is that somebody else already checked them in.
      set((s) => {
        const guest = s.guests.find((g) => g.id === id);
        if (guest && previous) guest.statusId = previous.statusId;
        if (!result.duplicate) s.arrivedIds = s.arrivedIds.filter((arrivedId) => arrivedId !== id);
      });
    } else if (result.guest) {
      set((s) => {
        const index = s.guests.findIndex((g) => g.id === id);
        if (index >= 0) s.guests[index] = result.guest!;
      });
    }
    return result;
  },

  undoCheckIn: async (id, previousStatusId) => {
    const eventId = get().guestsEventId;
    if (!eventId) return;
    set((s) => {
      s.arrivedIds = s.arrivedIds.filter((arrivedId) => arrivedId !== id);
      const guest = s.guests.find((g) => g.id === id);
      if (guest && previousStatusId) guest.statusId = previousStatusId;
    });
    await guestRepo.undoCheckIn(id, eventId, previousStatusId);
  },

  /** Another tab changed these guests; pull just those records back in. */
  applyRemoteGuestChange: async (guestIds) => {
    const eventId = get().guestsEventId;
    if (!eventId) return;
    const [fresh, arrived] = await Promise.all([
      Promise.all(guestIds.map((id) => guestRepo.getGuest(id))),
      guestRepo.arrivedGuestIds(eventId),
    ]);
    set((s) => {
      for (const guest of fresh) {
        if (!guest || guest.eventId !== eventId) continue;
        const index = s.guests.findIndex((g) => g.id === guest.id);
        if (index >= 0) s.guests[index] = guest;
        else s.guests.push(guest);
      }
      s.arrivedIds = [...arrived];
    });
  },

  applySavedView: (view) =>
    set((s) => {
      s.filters = view.filters;
      s.sort = view.sort;
      s.hiddenColumns = view.columns.hidden;
      s.groupBy = view.groupBy ?? null;
      s.density = view.density;
      s.activeViewId = view.id;
    }),
});
