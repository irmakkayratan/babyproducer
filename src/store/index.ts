import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { createUiSlice } from './slices/ui';
import { createWorkspaceSlice } from './slices/workspace';
import type { AppStore } from './types';

export const STORE_VERSION = 1;

/**
 * One bound store composed from domain slices.
 *
 * Domain records live in IndexedDB (see data/db.ts); this store holds the
 * working set plus UI state. Only small, boring preferences are persisted —
 * transient UI (open drawers, crossfades) is deliberately discarded on reload.
 */
export const useStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      ...createWorkspaceSlice(...a),
      ...createUiSlice(...a),
    })),
    {
      name: 'atelier:prefs',
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scheme: state.scheme,
        sidebarCollapsed: state.sidebarCollapsed,
        tourCompleted: state.tourCompleted,
        activeWorkspaceId: state.activeWorkspaceId,
        activeEventId: state.activeEventId,
      }),
    },
  ),
);

export { useShallow };
export type { AppStore };
