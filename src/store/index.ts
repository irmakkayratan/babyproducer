import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { createGuestSlice } from './slices/guests';
import { createUiSlice } from './slices/ui';
import { createWorkspaceSlice } from './slices/workspace';
import type { AppStore } from './types';

export const STORE_VERSION = 1;

/**
 * One bound store composed from domain slices.
 *
 * Domain records live in IndexedDB (see data/db.ts); this store holds the
 * working set plus UI state. Only small, boring preferences are persisted, and
 * transient UI such as an open drawer is deliberately discarded on reload.
 */
export const useStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      ...createWorkspaceSlice(...a),
      ...createGuestSlice(...a),
      ...createUiSlice(...a),
    })),
    {
      name: 'babyproducer:prefs',
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        tourCompleted: state.tourCompleted,
        activeWorkspaceId: state.activeWorkspaceId,
        activeEventId: state.activeEventId,
        density: state.density,
        hiddenColumns: state.hiddenColumns,
      }),
    },
  ),
);

export { useShallow };
export type { AppStore };
