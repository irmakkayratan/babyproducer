import type { Event, EventTemplate, ModuleKey, Workspace } from '@/data/types';
import * as repo from '@/data/repo';
import { syncBus } from '@/lib/syncBus';
import type { SliceCreator } from '../types';

export interface WorkspaceSlice {
  workspaces: Workspace[];
  events: Event[];
  activeWorkspaceId: string | null;
  activeEventId: string | null;
  loaded: boolean;
  firstRun: boolean;

  bootstrap: () => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  setActiveEvent: (id: string | null) => void;
  createWorkspace: (input: { name: string; demo?: boolean; template?: EventTemplate }) => Promise<Workspace>;
  updateWorkspace: (id: string, patch: Partial<Omit<Workspace, 'id'>>) => Promise<void>;
  createEvent: (input: Omit<repo.CreateEventInput, 'workspaceId'> & { workspaceId?: string }) => Promise<Event>;
  updateEvent: (id: string, patch: Partial<Omit<Event, 'id'>>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  refreshEvents: (workspaceId?: string) => Promise<void>;
  /** Module visibility: event override wins over the workspace setting. */
  isModuleEnabled: (moduleKey: ModuleKey, eventId?: string) => boolean;
  activeWorkspace: () => Workspace | undefined;
  activeEvent: () => Event | undefined;
}

export const createWorkspaceSlice: SliceCreator<WorkspaceSlice> = (set, get) => ({
  workspaces: [],
  events: [],
  activeWorkspaceId: null,
  activeEventId: null,
  loaded: false,
  firstRun: true,

  bootstrap: async () => {
    const { workspaces, firstRun } = await repo.ensureBootstrapped();
    const activeId = get().activeWorkspaceId ?? workspaces[0]?.id ?? null;
    const events = activeId ? await repo.listEvents(activeId) : [];
    set((s) => {
      s.workspaces = workspaces;
      s.events = events;
      s.activeWorkspaceId = activeId;
      s.loaded = true;
      s.firstRun = firstRun;
    });
  },

  setActiveWorkspace: async (id) => {
    const events = await repo.listEvents(id);
    set((s) => {
      s.activeWorkspaceId = id;
      s.events = events;
      s.activeEventId = null;
    });
  },

  setActiveEvent: (id) =>
    set((s) => {
      s.activeEventId = id;
    }),

  createWorkspace: async (input) => {
    const workspace = await repo.createWorkspace(input);
    set((s) => {
      s.workspaces.push(workspace);
      s.activeWorkspaceId = workspace.id;
      s.events = [];
      s.firstRun = false;
    });
    syncBus.post({ type: 'workspace:changed', workspaceId: workspace.id });
    return workspace;
  },

  updateWorkspace: async (id, patch) => {
    const next = await repo.updateWorkspace(id, patch);
    if (!next) return;
    set((s) => {
      const index = s.workspaces.findIndex((w) => w.id === id);
      if (index >= 0) s.workspaces[index] = next;
    });
    syncBus.post({ type: 'workspace:changed', workspaceId: id });
  },

  createEvent: async (input) => {
    const workspaceId = input.workspaceId ?? get().activeWorkspaceId;
    if (!workspaceId) throw new Error('No active workspace');
    const event = await repo.createEvent({ ...input, workspaceId });
    const workspace = await repo.getWorkspace(workspaceId);
    set((s) => {
      s.events.push(event);
      s.events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      s.activeEventId = event.id;
      if (workspace) {
        const index = s.workspaces.findIndex((w) => w.id === workspaceId);
        if (index >= 0) s.workspaces[index] = workspace;
      }
    });
    syncBus.post({ type: 'event:changed', eventId: event.id });
    return event;
  },

  updateEvent: async (id, patch) => {
    const next = await repo.updateEvent(id, patch);
    if (!next) return;
    set((s) => {
      const index = s.events.findIndex((e) => e.id === id);
      if (index >= 0) s.events[index] = next;
    });
    syncBus.post({ type: 'event:changed', eventId: id });
  },

  deleteEvent: async (id) => {
    await repo.deleteEvent(id);
    set((s) => {
      s.events = s.events.filter((e) => e.id !== id);
      if (s.activeEventId === id) s.activeEventId = null;
    });
    syncBus.post({ type: 'event:changed', eventId: id });
  },

  refreshEvents: async (workspaceId) => {
    const id = workspaceId ?? get().activeWorkspaceId;
    if (!id) return;
    const events = await repo.listEvents(id);
    set((s) => {
      s.events = events;
    });
  },

  isModuleEnabled: (moduleKey, eventId) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!workspace) return true;
    const event = state.events.find((e) => e.id === (eventId ?? state.activeEventId));
    const override = event?.moduleOverrides?.[moduleKey];
    if (typeof override === 'boolean') return override;
    return workspace.enabledModules.includes(moduleKey);
  },

  activeWorkspace: () => {
    const state = get();
    return state.workspaces.find((w) => w.id === state.activeWorkspaceId);
  },

  activeEvent: () => {
    const state = get();
    return state.events.find((e) => e.id === state.activeEventId);
  },
});
