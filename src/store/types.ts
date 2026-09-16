import type { StateCreator } from 'zustand';
import type { GuestSlice } from './slices/guests';
import type { UiSlice } from './slices/ui';
import type { WorkspaceSlice } from './slices/workspace';

export type AppStore = WorkspaceSlice & GuestSlice & UiSlice;

/**
 * Slices are written against the whole store (so one slice may read another)
 * but only ever mutate their own keys. Mutators are declared once here.
 */
export type SliceCreator<T> = StateCreator<
  AppStore,
  [['zustand/persist', unknown], ['zustand/immer', never]],
  [],
  T
>;
