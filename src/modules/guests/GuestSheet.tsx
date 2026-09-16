import { lazy, Suspense, useMemo } from 'react';
import { Check, Undo2 } from 'lucide-react';
import type { Guest, MetricConfig, SchemaConfig } from '@/data/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GeneratedAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { VocabDot } from '@/components/VocabDot';
import { FIELD_RENDERERS } from '@/modules/fields/registry';
import { breakdownFor, scoreGuest } from '@/modules/metrics/engine';
import { Skeleton } from '@/components/ui/skeleton';

const MetricRadar = lazy(() => import('@/modules/metrics/MetricRadar'));
import { compact, formatCurrency, formatNumber } from '@/lib/utils';

export function GuestSheet({
  guest,
  peers,
  schema,
  metrics,
  arrived,
  onClose,
  onChange,
  onCheckIn,
  onUndoCheckIn,
}: {
  guest: Guest | undefined;
  peers: Guest[];
  schema: SchemaConfig;
  metrics: MetricConfig[];
  arrived: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Guest>) => void;
  onCheckIn: () => void;
  onUndoCheckIn: () => void;
}) {
  const metric = metrics[0];
  const radar = useMemo(
    () => (guest && metric ? breakdownFor(metric, guest, peers) : []),
    [guest, metric, peers],
  );
  const fieldDefs = schema.fields.filter((f) => f.entity === 'guest' && !f.archived && f.showIn.includes('detail'));

  return (
    <Sheet open={Boolean(guest)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col p-0" aria-describedby={undefined}>
        {guest && (
          <>
            <SheetHeader className="flex-row items-center gap-3 space-y-0">
              <GeneratedAvatar name={guest.name} className="size-11" />
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate">{guest.name}</SheetTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {guest.handle ?? guest.email ?? guest.company ?? '—'}
                </p>
              </div>
              {arrived ? (
                <Button variant="ghost" size="sm" onClick={onUndoCheckIn}>
                  <Undo2 className="size-4" /> Undo
                </Button>
              ) : (
                <Button size="sm" onClick={onCheckIn}>
                  <Check className="size-4" /> Check in
                </Button>
              )}
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 scrollbar-thin">
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">
                  <VocabDot vocab={schema.voices.find((v) => v.id === guest.voiceId)} />
                </Badge>
                <Badge variant="muted">
                  <VocabDot vocab={schema.tiers.find((t) => t.id === guest.tierId)} />
                </Badge>
                {arrived && <Badge variant="success">In the room</Badge>}
                {guest.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              {metric && guest.audience && (
                <section className="rounded-lg border p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-medium">{metric.label}</h3>
                    <span className="font-mono text-lg" data-numeric>
                      {metric.format.style === 'currency'
                        ? formatCurrency(scoreGuest(metric, guest).value, metric.format.currency, 0)
                        : formatNumber(scoreGuest(metric, guest).value, metric.format.decimals)}
                    </span>
                  </div>
                  <Suspense fallback={<Skeleton className="h-52 w-full" />}>
                    <MetricRadar data={radar} />
                  </Suspense>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    {radar.map((axis) => (
                      <div key={axis.axis} className="flex justify-between gap-2">
                        <dt className="truncate text-muted-foreground">{axis.label}</dt>
                        <dd data-numeric>{axis.raw >= 1000 ? compact(axis.raw) : axis.raw.toFixed(2)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Axes are scaled against the strongest guest in this room, so the shape reads as relative
                    standing rather than absolute magnitude.
                  </p>
                </section>
              )}

              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="guest-status">Status</Label>
                    <Select value={guest.statusId} onValueChange={(statusId) => onChange({ statusId })}>
                      <SelectTrigger id="guest-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {schema.guestStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-tier">Tier</Label>
                    <Select value={guest.tierId ?? ''} onValueChange={(tierId) => onChange({ tierId })}>
                      <SelectTrigger id="guest-tier">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {schema.tiers.map((tier) => (
                          <SelectItem key={tier.id} value={tier.id}>
                            {tier.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email">Email</Label>
                    <Input
                      id="guest-email"
                      value={guest.email ?? ''}
                      onChange={(e) => onChange({ email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-plus">Plus ones</Label>
                    <Input
                      id="guest-plus"
                      type="number"
                      min={0}
                      value={guest.plusOnes}
                      onChange={(e) => onChange({ plusOnes: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {fieldDefs.map((def) => {
                  const renderer = FIELD_RENDERERS[def.kind];
                  return (
                    <div key={def.id} className="space-y-2">
                      <Label htmlFor={`field-${def.id}`}>{def.label}</Label>
                      <renderer.Control
                        def={def}
                        id={`field-${def.id}`}
                        value={guest.fields[def.id] ?? null}
                        onChange={(value) => onChange({ fields: { ...guest.fields, [def.id]: value } })}
                      />
                      {def.helpText && <p className="text-xs text-muted-foreground">{def.helpText}</p>}
                    </div>
                  );
                })}

                <div className="space-y-2">
                  <Label htmlFor="guest-notes">Notes</Label>
                  <Textarea
                    id="guest-notes"
                    value={guest.notes ?? ''}
                    placeholder="Seating sensitivities, press embargo, gifting…"
                    onChange={(e) => onChange({ notes: e.target.value })}
                  />
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
