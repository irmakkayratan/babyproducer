import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Download, Plus, Printer } from 'lucide-react';
import type { AdvanceItem } from '@/data/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addAdvanceItem, patchAdvanceItem, removeAdvanceItem } from '@/data/advancing';
import { downloadFile, toCsv } from '@/data/io/csv';
import { useStore } from '@/store';
import { formatDayTime, relativeToNow } from '@/lib/time';
import { cn } from '@/lib/utils';
import { AdvancePrintSheet } from './AdvancePrintSheet';
import { ItemRow } from './ItemRow';
import { PartiesPanel } from './PartiesPanel';
import { advanceCsvRows, groupBySection, isOverdue, isOpen, itinerary, summarizeAdvance } from './model';
import { useAdvanceSheet } from './useAdvanceSheet';

type Filter = 'all' | 'open' | 'required' | 'overdue';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'open', label: 'Still open' },
  { id: 'required', label: 'Required' },
  { id: 'overdue', label: 'Overdue' },
];

/**
 * Advancing: the pre-production tracker.
 *
 * The page answers one question before anything else: what is still missing.
 * Only then does it show the full checklist. That ordering is the point. An
 * advance lives or dies on the three lines nobody has answered yet, and those
 * are the hardest thing to see in a mail thread.
 */
export function AdvancingPage() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const setActiveEvent = useStore((s) => s.setActiveEvent);

  const event = events.find((candidate) => candidate.id === eventId);
  const workspace = workspaces.find((candidate) => candidate.id === event?.workspaceId);
  const { sheet, loading } = useAdvanceSheet(event);

  const [filter, setFilter] = useState<Filter>('all');
  const [partyFilter, setPartyFilter] = useState('all');

  useEffect(() => {
    if (eventId) setActiveEvent(eventId);
  }, [eventId, setActiveEvent]);

  // One clock per load of the sheet: recomputing `Date.now()` per row would
  // let two items with the same deadline disagree about being overdue.
  const [now] = useState(() => Date.now());

  const sections = useMemo(() => workspace?.schema.advanceSections ?? [], [workspace]);
  const summary = useMemo(() => summarizeAdvance({ items: sheet?.items ?? [] }, now), [sheet, now]);

  const visible = useMemo(() => {
    const items = sheet?.items ?? [];
    return items.filter((item) => {
      if (partyFilter !== 'all' && (item.partyId ?? 'shared') !== partyFilter) return false;
      if (filter === 'open') return isOpen(item);
      if (filter === 'required') return item.required;
      if (filter === 'overdue') return isOverdue(item, now);
      return true;
    });
  }, [sheet, filter, partyFilter, now]);

  const groups = useMemo(() => groupBySection(visible, sections, now), [visible, sections, now]);
  const schedule = useMemo(() => itinerary(sheet?.items ?? []), [sheet]);

  if (!event || !workspace) return null;

  if (loading || !sheet) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-8" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <span className="sr-only">Loading the advance…</span>
      </div>
    );
  }

  const sectionLabel = (id: string) => sections.find((section) => section.id === id)?.label ?? id;
  const percent = Math.round(summary.readiness * 100);

  function exportCsv() {
    downloadFile(
      `${event!.name.replace(/\W+/g, '-').toLowerCase()}-advance.csv`,
      toCsv(advanceCsvRows(sheet!, sectionLabel)),
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Advancing</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{event.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every operational, technical and hospitality detail, agreed before the day. Getting all of it settled
            in advance is the job. Anything still open here is something that goes wrong on site.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void addAdvanceItem(event.id, {
                sectionId: sections[0]?.id ?? 'schedule',
                label: '',
                partyId: partyFilter !== 'all' && partyFilter !== 'shared' ? partyFilter : undefined,
              })
            }
          >
            <Plus className="size-4" /> Add item
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Advance sheet
          </Button>
        </div>
      </div>

      <Card className="mt-6 p-5 print:hidden" data-testid="advance-readiness">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ready</p>
            <p className="mt-1 font-mono text-4xl tabular" data-numeric>
              {percent}%
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.confirmed} of {summary.applicable} confirmed
              {summary.notNeeded > 0 ? ` · ${summary.notNeeded} not needed` : ''}
            </p>
          </div>
          <div className="flex gap-6">
            <Figure label="Requested" value={summary.requested} />
            <Figure label="Missing" value={summary.missing} tone={summary.missing > 0 ? 'warning' : undefined} />
            <Figure
              label="Overdue"
              value={summary.overdue.length}
              tone={summary.overdue.length > 0 ? 'destructive' : undefined}
            />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Advance readiness"
          />
        </div>
      </Card>

      {summary.blockers.length > 0 && (
        <section className="mt-6 print:hidden" data-testid="advance-missing">
          <h2 className="flex items-center gap-2 font-display text-xl tracking-tight">
            <AlertTriangle className="size-4 text-warning" />
            Still missing
          </h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Required and unanswered, soonest deadline first. Confirm one here and it updates everywhere.
          </p>
          <Card className="divide-y divide-border/60 overflow-hidden">
            {summary.blockers.slice(0, 8).map((item) => (
              <BlockerRow
                key={item.id}
                item={item}
                now={now}
                sectionLabel={sectionLabel(item.sectionId)}
                partyLabel={sheet.parties.find((party) => party.id === item.partyId)?.name}
                onConfirm={() => void patchAdvanceItem(event.id, item.id, { status: 'confirmed' })}
              />
            ))}
          </Card>
        </section>
      )}

      <Tabs defaultValue="checklist" className="mt-8 print:hidden">
        <TabsList>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="parties">Parties & contacts</TabsTrigger>
          <TabsTrigger value="daysheet">Day sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={filter === entry.id}
                onClick={() => setFilter(entry.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  filter === entry.id ? 'border-primary bg-primary/15 text-primary' : 'hover:bg-accent',
                )}
              >
                {entry.label}
              </button>
            ))}
            {sheet.parties.length > 0 && (
              <select
                aria-label="Filter by party"
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="ml-auto h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              >
                <option value="all">All parties</option>
                <option value="shared">Shared items</option>
                {sheet.parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {groups.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nothing matches this filter. On the overdue filter, that is the answer you want.
            </Card>
          ) : (
            groups.map((group) => (
              <Card key={group.section.id} className="overflow-hidden">
                <header className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
                  <h3 className="font-medium">{group.section.label}</h3>
                  <span className="text-xs text-muted-foreground">
                    {group.summary.confirmed}/{group.summary.applicable} confirmed
                  </span>
                </header>
                {group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    parties={sheet.parties}
                    now={now}
                    onPatch={(patch) => void patchAdvanceItem(event.id, item.id, patch)}
                    onRemove={() => void removeAdvanceItem(event.id, item.id)}
                  />
                ))}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="parties" className="mt-5">
          <PartiesPanel
            sheet={sheet}
            eventId={event.id}
            startsAt={event.startsAt}
            templateId={event.templateId}
            roles={workspace.schema.partyRoles ?? []}
          />
        </TabsContent>

        <TabsContent value="daysheet" className="mt-5">
          {schedule.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nothing is timed yet. Put a departure, a check-in or a load-in time on an item and it appears here, in
              order.
            </Card>
          ) : (
            <Card className="divide-y divide-border/60 overflow-hidden">
              {schedule.map((entry) => (
                <div key={entry.item.id} className="flex flex-wrap items-baseline gap-3 p-3 text-sm">
                  <span className="w-40 shrink-0 font-mono text-xs" data-numeric>
                    {formatDayTime(entry.at, event.timezone)}
                  </span>
                  <span className="font-medium">{entry.item.label}</span>
                  <span className="text-muted-foreground">
                    {[
                      entry.item.detail,
                      entry.item.logistics?.provider,
                      entry.item.logistics?.reference,
                      entry.item.logistics?.from && entry.item.logistics?.to
                        ? `${entry.item.logistics.from} → ${entry.item.logistics.to}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {entry.item.partyId && (
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {sheet.parties.find((party) => party.id === entry.item.partyId)?.name}
                    </Badge>
                  )}
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AdvancePrintSheet event={event} sheet={sheet} sections={sections} />
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'destructive' }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-2xl tabular',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
        data-numeric
      >
        {value}
      </p>
    </div>
  );
}

function BlockerRow({
  item,
  now,
  sectionLabel,
  partyLabel,
  onConfirm,
}: {
  item: AdvanceItem;
  now: number;
  sectionLabel: string;
  partyLabel?: string;
  onConfirm: () => void;
}) {
  const overdue = isOverdue(item, now);
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <Badge variant={overdue ? 'destructive' : 'warning'} className="shrink-0">
        {item.status === 'requested' ? 'Requested' : 'Missing'}
      </Badge>
      <span className="font-medium">{item.label}</span>
      <span className="text-xs text-muted-foreground">
        {sectionLabel}
        {partyLabel ? ` · ${partyLabel}` : ''}
      </span>
      {item.dueAt && (
        <span className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
          due {relativeToNow(item.dueAt, now)}
        </span>
      )}
      <Button size="sm" variant="outline" className="ml-auto" onClick={onConfirm}>
        Confirm
      </Button>
    </div>
  );
}
