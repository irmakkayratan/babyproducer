import { useRouteError, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * A broken route must never take the show down with it — and any error that
 * could threaten data offers the backup first.
 */
export function RootBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = error instanceof Error ? error.message : 'Something went wrong.';

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl tracking-tight">That screen failed to load</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          Your data is untouched — it lives in this browser, not in the page that failed.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    </div>
  );
}
