import type { SliceCreator } from '../types';

export type ColorScheme = 'dark' | 'light' | 'system';

export interface UiSlice {
  scheme: ColorScheme;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  /** Transient: the accent being crossfaded to, if a transition is running. */
  crossfadeTo: string | null;
  online: boolean;
  tourCompleted: boolean;
  tourStep: number | null;

  setScheme: (scheme: ColorScheme) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  beginCrossfade: (accent: string) => void;
  endCrossfade: () => void;
  setOnline: (online: boolean) => void;
  startTour: () => void;
  setTourStep: (step: number | null) => void;
  completeTour: () => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  scheme: 'dark',
  sidebarCollapsed: false,
  commandOpen: false,
  crossfadeTo: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  tourCompleted: false,
  tourStep: null,

  setScheme: (scheme) =>
    set((s) => {
      s.scheme = scheme;
    }),
  toggleSidebar: () =>
    set((s) => {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    }),
  setCommandOpen: (open) =>
    set((s) => {
      s.commandOpen = open;
    }),
  beginCrossfade: (accent) =>
    set((s) => {
      s.crossfadeTo = accent;
    }),
  endCrossfade: () =>
    set((s) => {
      s.crossfadeTo = null;
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
