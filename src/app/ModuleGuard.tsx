import { Navigate, useParams } from 'react-router-dom';
import type { ModuleKey } from '@/data/types';
import { useStore } from '@/store';

/**
 * A module switched off in Studio disappears completely: no nav entry, and its
 * routes stop resolving. A deep link into a disabled module lands on the event
 * overview rather than a screen the workspace has opted out of.
 */
export function ModuleGuard({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { workspaceId, eventId } = useParams();
  const loaded = useStore((s) => s.loaded);
  const enabledModules = useStore(
    (s) => s.workspaces.find((workspace) => workspace.id === workspaceId)?.enabledModules,
  );
  const override = useStore(
    (s) => s.events.find((event) => event.id === eventId)?.moduleOverrides?.[module],
  );

  // Wait for the workspace to load before judging: guarding on an empty store
  // would bounce every deep link on a cold start.
  if (!loaded) return null;
  const enabled = typeof override === 'boolean' ? override : (enabledModules?.includes(module) ?? true);
  if (!enabled) {
    return <Navigate to={`/w/${workspaceId}/events/${eventId}/overview`} replace />;
  }
  return <>{children}</>;
}
