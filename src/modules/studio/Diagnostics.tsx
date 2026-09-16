import { useEffect, useState } from 'react';
import { HardDrive, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, requestPersistentStorage, storageEstimate } from '@/data/db';
import { downloadFile } from '@/data/io/csv';

interface Report {
  usage: number;
  quota: number;
  persisted: boolean;
  counts: Record<string, number>;
  serviceWorker: string;
}

function mb(bytes: number) {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Observability without a backend.
 *
 * All of this stays on the device — it exists so a producer can answer "is my
 * data safe and where is it?" before a show, not so anything gets reported
 * anywhere.
 */
export function Diagnostics() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [estimate, workspaces, events, guests, arrivals, seatingMaps, rundowns, telemetry, assets] =
      await Promise.all([
        storageEstimate(),
        db.workspaces.count(),
        db.events.count(),
        db.guests.count(),
        db.arrivals.count(),
        db.seatingMaps.count(),
        db.rundowns.count(),
        db.telemetry.count(),
        db.assets.count(),
      ]);

    const registration = await navigator.serviceWorker?.getRegistration?.();
    setReport({
      usage: estimate.usage,
      quota: estimate.quota,
      persisted: estimate.persisted,
      counts: { workspaces, events, guests, arrivals, seatingMaps, rundowns, telemetry, assets },
      serviceWorker: registration
        ? registration.active
          ? 'active'
          : 'installing'
        : 'not registered (dev or unsupported)',
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!report) return null;
  const share = report.quota > 0 ? Math.min(100, (report.usage / report.quota) * 100) : 0;

  return (
    <section className="rounded-lg border">
      <header className="border-b p-4">
        <h3 className="font-medium">Diagnostics</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Everything this app knows is on this device. Nothing here is sent anywhere.
        </p>
      </header>

      <div className="space-y-4 p-4" data-testid="diagnostics">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <HardDrive className="size-4" /> Storage
            </span>
            <span data-numeric>
              {mb(report.usage)} of {mb(report.quota)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.max(1, share)}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {report.persisted ? (
            <Badge variant="success" className="gap-1.5">
              <ShieldCheck className="size-3.5" /> Storage is persistent
            </Badge>
          ) : (
            <>
              <Badge variant="warning" className="gap-1.5">
                <ShieldAlert className="size-3.5" /> Storage can be evicted
              </Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await requestPersistentStorage();
                  await refresh();
                  setBusy(false);
                }}
              >
                Request persistence
              </Button>
            </>
          )}
          <Badge variant="muted">Service worker: {report.serviceWorker}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {Object.entries(report.counts).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="truncate text-muted-foreground">{key}</dt>
              <dd data-numeric>{value}</dd>
            </div>
          ))}
        </dl>

        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadFile(
              `atelier-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
              JSON.stringify({ ...report, userAgent: navigator.userAgent, at: new Date().toISOString() }, null, 2),
              'application/json',
            )
          }
        >
          Download diagnostics
        </Button>
      </div>
    </section>
  );
}
