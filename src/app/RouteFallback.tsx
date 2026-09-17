import { Skeleton } from '@/components/ui/skeleton';

/** Shown only while a route chunk loads. Data itself is already local. */
export function RouteFallback() {
  return (
    <div className="space-y-3 p-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-[60vh] w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
