import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RootBoundary } from './RootBoundary';
import { RouteFallback } from './RouteFallback';
import { Landing } from './routes/Landing';
import { StartFromTemplate } from './routes/StartFromTemplate';
import { WorkspaceHome } from './routes/WorkspaceHome';
import { EventOverview } from '@/modules/workspace/EventOverview';
import { ModulePlaceholder } from './routes/ModulePlaceholder';

/**
 * Heavy modules load with their route. Charts, canvases and scanners never
 * enter the app shell's bundle, which keeps the cold start inside budget.
 */
const GuestsPage = lazy(() => import('@/modules/guests/GuestsPage').then((m) => ({ default: m.GuestsPage })));
const Demo = lazy(() => import('./routes/Demo').then((m) => ({ default: m.Demo })));
const RundownPage = lazy(() => import('@/modules/rundown/RundownPage').then((m) => ({ default: m.RundownPage })));
const CallerMode = lazy(() => import('@/modules/rundown/CallerMode').then((m) => ({ default: m.CallerMode })));
const SeatingPage = lazy(() => import('@/modules/seating/SeatingPage').then((m) => ({ default: m.SeatingPage })));
const StageDisplay = lazy(() => import('@/modules/rundown/StageDisplay').then((m) => ({ default: m.StageDisplay })));

const lazyRoute = (element: React.ReactNode) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

const NOT_YET_BUILT = [
  {
    path: 'checkin',
    title: 'Check-in',
    description: 'Lands in phase 5: offline QR check-in with duplicate guards and badge printing.',
  },
  {
    path: 'command',
    title: 'Command Center',
    description: 'Lands in phase 6: a resizable widget grid over live event telemetry.',
  },
];

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
        {
          path: 'events/:eventId',
          children: [
            { index: true, element: <Navigate to="overview" replace /> },
            { path: 'overview', element: <EventOverview /> },
            { path: 'guests', element: lazyRoute(<GuestsPage />) },
            { path: 'seating', element: lazyRoute(<SeatingPage />) },
            { path: 'rundown', element: lazyRoute(<RundownPage />) },
            { path: 'rundown/caller', element: lazyRoute(<CallerMode />) },
            ...NOT_YET_BUILT.map((module) => ({
              path: module.path,
              element: <ModulePlaceholder title={module.title} description={module.description} />,
            })),
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
