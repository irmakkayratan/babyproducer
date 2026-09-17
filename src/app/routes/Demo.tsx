import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seedDemoWorkspace, type SeedProgress } from '@/data/seed/generate';
import { SCENARIOS } from '@/data/seed/scenarios';
import { useStore } from '@/store';

/**
 * Loads the demo workspace and drops the visitor straight into it. Generation
 * is deterministic, so this screen shows a determinate progress line rather
 * than an indefinite spinner.
 */
export function Demo() {
  const navigate = useNavigate();
  const bootstrap = useStore((s) => s.bootstrap);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const workspace = await seedDemoWorkspace(setProgress);
        await bootstrap();
        await setActiveWorkspace(workspace.id);
        navigate(`/w/${workspace.id}`, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not build the demo data.');
      }
    })();
  }, [bootstrap, navigate, setActiveWorkspace]);

  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <h1 className="font-display text-2xl tracking-tight">Building the demo</h1>
        <p className="text-sm text-muted-foreground">
          {SCENARIOS.length} complete productions with guests, arrivals and media value, all generated on this device from a
          fixed seed. Nothing is downloaded.
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${Math.max(8, percent)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {error ?? (progress ? `${progress.scenario}: ${progress.step}` : 'Starting…')}
        </p>
      </div>
    </div>
  );
}
