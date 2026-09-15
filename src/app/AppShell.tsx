import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Settings2,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import { ThemeProvider } from './ThemeProvider';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { EventNav } from './EventNav';

export function AppShell() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const scheme = useStore((s) => s.scheme);
  const setScheme = useStore((s) => s.setScheme);
  const workspaces = useStore((s) => s.workspaces);
  const events = useStore((s) => s.events);
  const activeEventId = useStore((s) => s.activeEventId);

  const workspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
  const activeEvent = events.find((e) => e.id === activeEventId);
  const accent = activeEvent?.theme?.accent ?? workspace?.brand.accent;

  return (
    <ThemeProvider accent={accent}>
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card/40 transition-[width] duration-200 md:flex',
            collapsed ? 'w-16' : 'w-[264px]',
          )}
        >
          <div className="flex h-14 items-center gap-2 px-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 font-display text-sm text-primary">
                {(workspace?.brand.appName ?? 'A').slice(0, 1)}
              </span>
              {!collapsed && (
                <span className="truncate font-display text-sm tracking-tight">{workspace?.name ?? 'Atelier'}</span>
              )}
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2 scrollbar-thin">
            <NavLink
              to={`/w/${workspace?.id ?? ''}`}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
                )
              }
            >
              <CalendarDays className="size-4 shrink-0" />
              {!collapsed && <span>Events</span>}
            </NavLink>

            {activeEvent && <EventNav event={activeEvent} collapsed={collapsed} />}
          </nav>

          <div className="space-y-1 border-t p-2">
            <NavLink
              to={`/w/${workspace?.id ?? ''}/studio`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
                )
              }
            >
              <Settings2 className="size-4 shrink-0" />
              {!collapsed && <span>Studio</span>}
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              {!collapsed && <span>Collapse</span>}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur-sm sm:px-6">
            <div className="min-w-0 truncate text-sm text-muted-foreground">
              {activeEvent ? activeEvent.name : (workspace?.name ?? '')}
            </div>
            <div className="flex items-center gap-2">
              <StatusChip />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={scheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                onClick={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
              >
                {scheme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </Button>
            </div>
          </header>
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
