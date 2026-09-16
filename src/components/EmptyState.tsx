import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Empty is never blank: one sentence of context and one obvious next action. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <h3 className="font-display text-xl tracking-tight">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2 flex gap-2">{action}</div>}
    </div>
  );
}
