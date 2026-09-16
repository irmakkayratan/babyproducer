import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Filter, Plus, Search, Settings2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/EmptyState';
import { useStore } from '@/store';
import { arrivedStatus } from '@/data/guests';
import { downloadFile, toCsv } from '@/data/io/csv';
import { formatNumber } from '@/lib/utils';
import { queryGuests, facetCounts } from './filter';
import { buildGuestColumns } from './columns';
import { GuestTable } from './GuestTable';
import { GuestSheet } from './GuestSheet';
import { ImportWizard } from './ImportWizard';
import { FilterChips } from './FilterChips';

export function GuestsPage() {
  const { eventId } = useParams();
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const guests = useStore((s) => s.guests);
  const guestsLoading = useStore((s) => s.guestsLoading);
  const arrivedIds = useStore((s) => s.arrivedIds);
  const loadGuests = useStore((s) => s.loadGuests);
  const reloadGuests = useStore((s) => s.reloadGuests);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const filters = useStore((s) => s.filters);
  const clearFilters = useStore((s) => s.clearFilters);
  const sort = useStore((s) => s.sort);
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const openGuestId = useStore((s) => s.openGuestId);
  const openGuest = useStore((s) => s.openGuest);
  const updateGuest = useStore((s) => s.updateGuest);
  const bulkUpdateGuests = useStore((s) => s.bulkUpdateGuests);
  const checkIn = useStore((s) => s.checkIn);
  const undoCheckIn = useStore((s) => s.undoCheckIn);
  const hiddenColumns = useStore((s) => s.hiddenColumns);
  const toggleColumn = useStore((s) => s.toggleColumn);
  const density = useStore((s) => s.density);
  const setDensity = useStore((s) => s.setDensity);

  const [importOpen, setImportOpen] = useState(false);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (eventId) {
      setActiveEvent(eventId);
      void loadGuests(eventId);
    }
  }, [eventId, loadGuests, setActiveEvent]);

  const schema = workspace?.schema;
  const metrics = useMemo(() => workspace?.metrics ?? [], [workspace?.metrics]);
  const arrived = useMemo(() => new Set(arrivedIds), [arrivedIds]);

  const visible = useMemo(() => {
    if (!schema) return [];
    return queryGuests(guests, { search, filters, sort, arrivedIds: arrived, schema, metrics });
  }, [guests, search, filters, sort, arrived, schema, metrics]);

  const facets = useMemo(
    () => ({
      voiceId: facetCounts(guests, 'voiceId'),
      tierId: facetCounts(guests, 'tierId'),
      statusId: facetCounts(guests, 'statusId'),
    }),
    [guests],
  );

  const columns = useMemo(
    () => (schema ? buildGuestColumns(metrics, schema.fields.filter((f) => f.entity === 'guest')) : []),
    [schema, metrics],
  );

  if (!schema || !workspace) return null;
  const arrivedStatusId = arrivedStatus(schema.guestStatuses);
  const openGuestRecord = guests.find((guest) => guest.id === openGuestId);

  async function handleCheckIn(guestId: string, name: string) {
    const result = await checkIn(guestId, arrivedStatusId);
    if (result.ok) {
      toast.success(`${name} checked in`);
    } else if (result.duplicate) {
      toast.warning(`${name} was already checked in`, {
        description: new Date(result.duplicate.at).toLocaleTimeString(),
      });
    } else {
      toast.error(`Could not check in ${name}`);
    }
  }

  function exportVisible() {
    const rows = visible.map((guest) => ({
      Name: guest.name,
      Handle: guest.handle ?? '',
      Company: guest.company ?? '',
      Voice: schema!.voices.find((v) => v.id === guest.voiceId)?.label ?? '',
      Tier: schema!.tiers.find((t) => t.id === guest.tierId)?.label ?? '',
      Status: schema!.guestStatuses.find((s) => s.id === guest.statusId)?.label ?? guest.statusId,
      'Plus ones': guest.plusOnes,
      Followers: guest.audience?.followers ?? '',
      Email: guest.email ?? '',
      Arrived: arrived.has(guest.id) ? 'yes' : 'no',
    }));
    downloadFile(`guests-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    toast.success(`Exported ${rows.length} guests`);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, handle, company…"
            className="pl-9"
            aria-label="Search guests"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="size-4" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            {columns
              .filter((column) => column.hideable)
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={!hiddenColumns.includes(column.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleColumn(column.id)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Density</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={density === 'compact'}
              onCheckedChange={() => setDensity('compact')}
            >
              Compact
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={density === 'comfortable'}
              onCheckedChange={() => setDensity('comfortable')}
            >
              Comfortable
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="size-4" /> Import
        </Button>
        <Button variant="outline" size="sm" onClick={exportVisible}>
          <Download className="size-4" /> Export
        </Button>
      </div>

      <FilterChips schema={schema} facets={facets} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {formatNumber(visible.length)} of {formatNumber(guests.length)} guests
          {arrived.size > 0 && ` · ${formatNumber(arrived.size)} in the room`}
          {filters.length > 0 && (
            <Button variant="link" size="sm" className="h-auto px-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="size-3" /> clear filters
            </Button>
          )}
        </span>

        {selection.length > 0 && (
          <span className="flex items-center gap-2">
            <Badge variant="default">{selection.length} selected</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Bulk actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                {schema.guestStatuses.map((status) => (
                  <DropdownMenuItem
                    key={status.id}
                    onSelect={() => void bulkUpdateGuests(selection, { statusId: status.id })}
                  >
                    {status.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Set tier</DropdownMenuLabel>
                {schema.tiers.map((tier) => (
                  <DropdownMenuItem
                    key={tier.id}
                    onSelect={() => void bulkUpdateGuests(selection, { tierId: tier.id })}
                  >
                    {tier.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSelection([])}>Clear selection</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>

      {guestsLoading ? (
        <div className="flex-1 rounded-lg border" />
      ) : guests.length === 0 ? (
        <EmptyState
          className="flex-1 rounded-lg border border-dashed"
          title="No guests yet"
          description="Import a spreadsheet. Any column layout works. Or add guests one at a time."
          action={
            <>
              <Button onClick={() => setImportOpen(true)}>
                <Upload className="size-4" /> Import a guest list
              </Button>
              <Button variant="outline" onClick={() => void reloadGuests()}>
                <Plus className="size-4" /> Refresh
              </Button>
            </>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          className="flex-1 rounded-lg border border-dashed"
          title="Nothing matches those filters"
          description="Loosen a filter or clear the search to see the rest of the room."
          action={
            <Button variant="outline" onClick={clearFilters}>
              <Filter className="size-4" /> Clear filters
            </Button>
          }
        />
      ) : (
        <GuestTable
          guests={visible}
          schema={schema}
          metrics={metrics}
          arrived={arrived}
          onCheckIn={(guest) => void handleCheckIn(guest.id, guest.name)}
        />
      )}

      <GuestSheet
        guest={openGuestRecord}
        peers={guests}
        schema={schema}
        metrics={metrics}
        arrived={openGuestRecord ? arrived.has(openGuestRecord.id) : false}
        onClose={() => openGuest(null)}
        onChange={(patch) => openGuestRecord && void updateGuest(openGuestRecord.id, patch)}
        onCheckIn={() => openGuestRecord && void handleCheckIn(openGuestRecord.id, openGuestRecord.name)}
        onUndoCheckIn={() => openGuestRecord && void undoCheckIn(openGuestRecord.id, 'confirmed')}
      />

      {eventId && (
        <ImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          eventId={eventId}
          schema={schema}
          existing={guests}
          onImported={() => void reloadGuests()}
        />
      )}
    </div>
  );
}
