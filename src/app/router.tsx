import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RootBoundary } from './RootBoundary';
import { Landing } from './routes/Landing';
import { StartFromTemplate } from './routes/StartFromTemplate';
import { WorkspaceHome } from './routes/WorkspaceHome';
import { EventOverview } from '@/modules/workspace/EventOverview';
import { ModulePlaceholder } from './routes/ModulePlaceholder';

const NOT_YET_BUILT = [
  { path: 'guests', title: 'Guest & Talent CRM', description: 'Lands in the next phase: a virtualized guest table with custom fields, saved views, CSV import and media-value scoring.' },
  { path: 'seating', title: 'Seating Chart Builder', description: 'Lands in phase 4: a drag-and-drop room canvas with zones, tiers and adjacency rules.' },
  { path: 'rundown', title: 'Run of Show', description: 'Lands in phase 3: a time-aware cue grid with the auto-drift cascade, show caller mode and stage displays.' },
  { path: 'checkin', title: 'Check-in', description: 'Lands in phase 5: offline QR check-in with duplicate guards and badge printing.' },
  { path: 'command', title: 'Command Center', description: 'Lands in phase 6: a resizable widget grid over live event telemetry.' },
];

export const router = createBrowserRouter(
  [
    { path: '/', element: <Landing />, errorElement: <RootBoundary /> },
    { path: '/start', element: <StartFromTemplate />, errorElement: <RootBoundary /> },
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
            ...NOT_YET_BUILT.map((module) => ({
              path: module.path,
              element: <ModulePlaceholder title={module.title} description={module.description} />,
            })),
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || undefined },
);
