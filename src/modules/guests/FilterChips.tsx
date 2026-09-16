import { ChevronDown } from 'lucide-react';
import type { SchemaConfig } from '@/data/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

const AXES = [
  { field: 'voiceId' as const, label: 'Voice', key: 'voices' as const },
  { field: 'tierId' as const, label: 'Tier', key: 'tiers' as const },
  { field: 'statusId' as const, label: 'Status', key: 'guestStatuses' as const },
];

/**
 * Filter chips read their options from the workspace schema, so a renamed or
 * newly added tier appears here with no code change.
 */
export function FilterChips({
  schema,
  facets,
}: {
  schema: SchemaConfig;
  facets: Record<'voiceId' | 'tierId' | 'statusId', Map<string, number>>;
}) {
  const filters = useStore((s) => s.filters);
  const toggleFilterValue = useStore((s) => s.toggleFilterValue);

  return (
    <div className="flex flex-wrap gap-2">
      {AXES.map((axis) => {
        const options = schema[axis.key].filter((entry) => !entry.archived);
        const active = filters.find((filter) => filter.field === axis.field);
        const activeValues = Array.isArray(active?.value) ? (active.value as string[]) : [];

        return (
          <DropdownMenu key={axis.field}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid={`filter-${axis.field}`}
                className={cn(activeValues.length > 0 && 'border-primary/60 bg-primary/10 text-foreground')}
              >
                {axis.label}
                {activeValues.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 text-xs">{activeValues.length}</span>
                )}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Filter by {axis.label.toLowerCase()}</DropdownMenuLabel>
              {options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={activeValues.includes(option.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleFilterValue(axis.field, option.id)}
                >
                  <span className="flex-1">{option.label}</span>
                  <span className="ml-3 text-xs text-muted-foreground" data-numeric>
                    {facets[axis.field].get(option.id) ?? 0}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
