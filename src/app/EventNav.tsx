import { NavLink } from 'react-router-dom';
import {
  Armchair,
  BarChart3,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListOrdered,
  Receipt,
  ScanLine,
  Users,
} from 'lucide-react';
import type { Event, ModuleKey } from '@/data/types';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

/*
  Ordered the way a show actually gets made.

  Advancing comes first because it is where the job starts and where most of
  the work is. Everything under it either feeds off the advance or happens on
  the day, so the list reads forward in time from the top.
*/
const MODULE_NAV: Array<{ key: ModuleKey | 'overview'; to: string; label: string; icon: typeof Users }> = [
  { key: 'advancing', to: 'advancing', label: 'Advancing', icon: ClipboardCheck },
  { key: 'overview', to: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'guests', to: 'guests', label: 'Guests', icon: Users },
  { key: 'seating', to: 'seating', label: 'Seating', icon: Armchair },
  { key: 'rundown', to: 'rundown', label: 'Run of Show', icon: ListOrdered },
  { key: 'checkin', to: 'checkin', label: 'Check-in', icon: ScanLine },
  { key: 'command', to: 'command', label: 'Command', icon: BarChart3 },
  { key: 'metrics', to: 'recap', label: 'Recap', icon: FileText },
  { key: 'settlement', to: 'settlement', label: 'Settlement', icon: Receipt },
];

/** Nav is derived from enabled modules: disabling one removes it everywhere. */
export function EventNav({ event, collapsed }: { event: Event; collapsed: boolean }) {
  // Subscribe to the data itself. An action's identity
  // never changes, so selecting it would leave this nav stale after a change
  // in Studio.
  const enabledModules = useStore(
    (s) => s.workspaces.find((workspace) => workspace.id === event.workspaceId)?.enabledModules,
  );
  const overrides = useStore((s) => s.events.find((candidate) => candidate.id === event.id)?.moduleOverrides);

  const isEnabled = (moduleKey: ModuleKey) => {
    const override = overrides?.[moduleKey];
    if (typeof override === 'boolean') return override;
    return enabledModules?.includes(moduleKey) ?? true;
  };

  return (
    <div className="mt-4">
      {!collapsed && (
        <p className="truncate px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {event.name}
        </p>
      )}
      {MODULE_NAV.filter((item) => item.key === 'overview' || isEnabled(item.key as ModuleKey)).map(
        (item) => (
          <NavLink
            key={item.to}
            to={`/w/${event.workspaceId}/events/${event.id}/${item.to}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ),
      )}
    </div>
  );
}
