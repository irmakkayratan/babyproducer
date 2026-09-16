import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ModuleKey } from '@/data/types';
import { AppShell } from './AppShell';
import { RootBoundary } from './RootBoundary';
import { RouteFallback } from './RouteFallback';
import { Landing } from './routes/Landing';
import { StartFromTemplate } from './routes/StartFromTemplate';
import { WorkspaceHome } from './routes/WorkspaceHome';
import { EventOverview } from '@/modules/workspace/EventOverview';
import { ModuleGuard } from './ModuleGuard';

/**
 * Heavy modules load with their route. Charts, canvases and scanners never
 * enter the app shell's bundle, which keeps the cold start inside budget.
 */
const GuestsPage = lazy(() => import('@/modules/guests/GuestsPage').then((m) => ({ default: m.GuestsPage })));
const Demo = lazy(() => import('./routes/Demo').then((m) => ({ default: m.Demo })));
const RundownPage = lazy(() => import('@/modules/rundown/RundownPage').then((m) => ({ default: m.RundownPage })));
const CallerMode = lazy(() => import('@/modules/rundown/CallerMode').then((m) => ({ default: m.CallerMode })));
const StudioPage = lazy(() => import('@/modules/studio/StudioPage').then((m) => ({ default: m.StudioPage })));
const RecapPage = lazy(() => import('@/modules/recap/RecapPage').then((m) => ({ default: m.RecapPage })));
const CommandPage = lazy(() => import('@/modules/command/CommandPage').then((m) => ({ default: m.CommandPage })));
const CheckinPage = lazy(() => import('@/modules/checkin/CheckinPage').then((m) => ({ default: m.CheckinPage })));
const SeatingPage = lazy(() => import('@/modules/seating/SeatingPage').then((m) => ({ default: m.SeatingPage })));
const AdvancingPage = lazy(() =>
  import('@/modules/advancing/AdvancingPage').then((m) => ({ default: m.AdvancingPage })),
);
const SettlementPage = lazy(() =>
  import('@/modules/settlement/SettlementPage').then((m) => ({ default: m.SettlementPage })),
);
const StageDisplay = lazy(() => import('@/modules/rundown/StageDisplay').then((m) => ({ default: m.StageDisplay })));

const lazyRoute = (element: React.ReactNode) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

const moduleRoute = (module: ModuleKey, element: React.ReactNode) => (
  <ModuleGuard module={module}>
    <Suspense fallback={<RouteFallback />}>{element}</Suspense>
  </ModuleGuard>
);

export const router = createBrowserRouter(
  [
    { path: '/', element: <Landing />, errorElement: <RootBoundary /> },
    { path: '/start', element: <StartFromTemplate />, errorElement: <RootBoundary /> },
    { path: '/demo', element: lazyRoute(<Demo />), errorElement: <RootBoundary /> },
    {
      path: '/w/:workspaceId',
      element: <AppShell />,
      errorElement: <RootBoundary />,
      children: [
        { index: true, element: <WorkspaceHome /> },
        { path: 'studio', element: lazyRoute(<StudioPage />) },
        {
          path: 'events/:eventId',
          children: [
            { index: true, element: <Navigate to="overview" replace /> },
            { path: 'overview', element: <EventOverview /> },
            { path: 'guests', element: moduleRoute('guests', <GuestsPage />) },
            { path: 'seating', element: moduleRoute('seating', <SeatingPage />) },
            { path: 'advancing', element: moduleRoute('advancing', <AdvancingPage />) },
            { path: 'checkin', element: moduleRoute('checkin', <CheckinPage />) },
            { path: 'settlement', element: moduleRoute('settlement', <SettlementPage />) },
            { path: 'command', element: moduleRoute('command', <CommandPage />) },
            { path: 'recap', element: moduleRoute('metrics', <RecapPage />) },
            { path: 'rundown', element: moduleRoute('rundown', <RundownPage />) },
            { path: 'rundown/caller', element: moduleRoute('rundown', <CallerMode />) },
          ],
        },
      ],
    },
    // Stage-facing surfaces live outside the app shell: no nav, no chrome,
    // shareable as a plain link to a screen at the back of the room.
    { path: '/show/:eventId/timer', element: lazyRoute(<StageDisplay />), errorElement: <RootBoundary /> },
    { path: '/show/:eventId/prompter', element: lazyRoute(<StageDisplay />), errorElement: <RootBoundary /> },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || undefined },
);
