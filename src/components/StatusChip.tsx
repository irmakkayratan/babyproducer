import { useEffect } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

/**
 * Offline is just a state here. Nothing is blocked by it, so the chip is
 * informational and quiet until the connection actually drops.
 */
export function StatusChip({ className }: { className?: string }) {
  const online = useStore((s) => s.online);
  const setOnline = useStore((s) => s.setOnline);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [setOnline]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        online ? 'text-muted-foreground' : 'border-warning/40 bg-warning/10 text-warning',
        className,
      )}
      title={online ? 'Connected. All data is stored on this device.' : 'Offline. Everything still works, because the data is on this device.'}
      data-testid="status-chip"
    >
      {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}
      {online ? 'Local' : 'Offline'}
    </span>
  );
}
