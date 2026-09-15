import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { router } from './app/router';
import { useStore } from './store';
import { requestPersistentStorage } from './data/db';
import { syncBus } from './lib/syncBus';
import './styles/index.css';

function Root() {
  return (
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" theme="system" richColors closeButton />
    </TooltipProvider>
  );
}

async function start() {
  await useStore.getState().bootstrap();

  // Other tabs changing the same workspace must not leave this one stale.
  syncBus.subscribe((event) => {
    const store = useStore.getState();
    if (event.type === 'event:changed' || event.type === 'workspace:changed' || event.type === 'demo:reset') {
      void store.bootstrap();
    }
    // A check-in at another desk must appear here immediately, and a duplicate
    // scan on this tab must then be refused.
    if (event.type === 'guest:checked-in' && store.guestsEventId === event.eventId) {
      void store.applyRemoteGuestChange([event.guestId]);
    }
    if (event.type === 'guest:changed' && store.guestsEventId === event.eventId) {
      void store.applyRemoteGuestChange(event.guestIds);
    }
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );

  // Ask the browser to keep our data; a busy device can otherwise evict an
  // event mid-show. Reported in Diagnostics either way.
  void requestPersistentStorage();
}

void start();
