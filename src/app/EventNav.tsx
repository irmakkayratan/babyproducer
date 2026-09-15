import { NavLink } from 'react-router-dom';
import { Armchair, BarChart3, FileText, LayoutDashboard, ListOrdered, ScanLine, Users } from 'lucide-react';
import type { Event, ModuleKey } from '@/data/types';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

const MODULE_NAV: Array<{ key: ModuleKey | 'overview'; to: string; label: string; icon: typeof Users }> = [
  { key: 'overview', to: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'guests', to: 'guests', label: 'Guests', icon: Users },
  { key: 'seating', to: 'seating', label: 'Seating', icon: Armchair },
  { key: 'rundown', to: 'rundown', label: 'Run of Show', icon: ListOrdered },
  { key: 'checkin', to: 'checkin', label: 'Check-in', icon: ScanLine },
  { key: 'command', to: 'command', label: 'Command', icon: BarChart3 },
  { key: 'metrics', to: 'recap', label: 'Recap', icon: FileText },
];

/** Nav is derived from enabled modules: disabling one removes it everywhere. */
export function EventNav({ event, collapsed }: { event: Event; collapsed: boolean }) {
  const isModuleEnabled = useStore((s) => s.isModuleEnabled);

  return (
    <div className="mt-4">
      {!collapsed && (
        <p className="truncate px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {event.name}
        </p>
      )}
      {MODULE_NAV.filter((item) => item.key === 'overview' || isModuleEnabled(item.key as ModuleKey, event.id)).map(
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
