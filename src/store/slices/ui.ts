import type { SliceCreator } from '../types';

/**
 * There is one theme, so there is nothing here for choosing one.
 *
 * The product is black and white everywhere, which took the scheme toggle and
 * the per-event accent crossfade with it. What is left is genuine UI state: is
 * the sidebar in, is the command palette open, are we online, and where has the
 * tour got to.
 */
export interface UiSlice {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  online: boolean;
  tourCompleted: boolean;
  tourStep: number | null;

  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setOnline: (online: boolean) => void;
  startTour: () => void;
  setTourStep: (step: number | null) => void;
  completeTour: () => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  tourCompleted: false,
  tourStep: null,

  toggleSidebar: () =>
    set((s) => {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    }),
  setCommandOpen: (open) =>
    set((s) => {
      s.commandOpen = open;
    }),
  setOnline: (online) =>
    set((s) => {
      s.online = online;
    }),
  startTour: () =>
    set((s) => {
      s.tourStep = 0;
    }),
  setTourStep: (step) =>
    set((s) => {
      s.tourStep = step;
    }),
  completeTour: () =>
    set((s) => {
      s.tourStep = null;
      s.tourCompleted = true;
    }),
});
