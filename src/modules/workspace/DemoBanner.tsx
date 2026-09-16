import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialogBody,
  ConfirmDialog,
} from '@/components/ConfirmDialog';
import { useStore } from '@/store';
import { forkDemoWorkspace, resetDemoData } from '@/data/seed/generate';
import { syncBus } from '@/lib/syncBus';

/**
 * Demo mode is explicit and reversible.
 *
 * Reset only ever touches workspaces flagged as demo, and the confirmation
 * names exactly what will be rebuilt, a user's own work is never in scope.
 */
export function DemoBanner({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const navigate = useNavigate();
  const bootstrap = useStore((s) => s.bootstrap);
  const startTour = useStore((s) => s.startTour);
  const tourCompleted = useStore((s) => s.tourCompleted);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function reset() {
    setBusy(true);
    try {
      const workspace = await resetDemoData();
      await bootstrap();
      syncBus.post({ type: 'demo:reset' });
      navigate(`/w/${workspace.id}`);
      toast.success('Demo data rebuilt', { description: 'Same seed, so it is identical to how it started.' });
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  async function fork() {
    setBusy(true);
    try {
      const workspace = await forkDemoWorkspace(workspaceId);
      await bootstrap();
      navigate(`/w/${workspace.id}`);
      toast.success('Copied into your own workspace', {
        description: 'Edit it freely. Resetting the demo will not touch it.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 border-b border-primary/25 bg-primary/10 px-4 py-2 text-sm sm:px-6"
        data-testid="demo-banner"
      >
        <span className="mr-auto">
          <strong className="font-medium">Demo data.</strong>{' '}
          <span className="text-muted-foreground">
            Four example productions, generated on this device. Nothing here is real, and nothing leaves the browser.
          </span>
        </span>

        {!tourCompleted && (
          <Button size="sm" variant="outline" onClick={startTour}>
            <Play className="size-4" /> Take the tour
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void fork()}>
          <Copy className="size-4" /> Copy to my workspace
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Hide demo banner" onClick={() => setDismissed(true)}>
          <X className="size-4" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Rebuild the demo data?"
        confirmLabel="Rebuild demo data"
        onConfirm={() => void reset()}
      >
        <AlertDialogBody>
          <p>
            This deletes and regenerates <strong>{workspaceName}</strong>, including its events, guests, seating, rundowns and
            telemetry.
          </p>
          <p className="text-muted-foreground">
            Only this demo workspace is affected. Any workspace you created yourself is left exactly as it is.
          </p>
        </AlertDialogBody>
      </ConfirmDialog>
    </>
  );
}
