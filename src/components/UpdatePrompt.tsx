import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

/**
 * New builds never reload the page on their own: a forced refresh mid-show is
 * unacceptable. The producer decides when to take the update.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border bg-popover p-3 text-sm shadow-2xl"
      role="status"
      data-testid="update-prompt"
    >
      <span className="flex-1">A new version is ready. It will apply when you reload.</span>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  );
}
