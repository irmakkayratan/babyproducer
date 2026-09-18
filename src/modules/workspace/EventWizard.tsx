import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BUILTIN_TEMPLATES } from '@/data/templates';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

function defaultStart(): string {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  date.setHours(19, 0, 0, 0);
  // datetime-local wants local time without a zone suffix.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function EventWizard({
  open,
  onOpenChange,
  initialTemplateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string;
}) {
  const navigate = useNavigate();
  const createEvent = useStore((s) => s.createEvent);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(initialTemplateId ?? 'club-night');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  const template = useMemo(() => BUILTIN_TEMPLATES.find((t) => t.id === templateId), [templateId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const event = await createEvent({
        name: name.trim() || (template?.name ?? 'Untitled event'),
        templateId,
        startsAt: new Date(startsAt).toISOString(),
        venue: { name: venue.trim() },
        capacity: capacity ? Number(capacity) : null,
        theme: template ? { accent: template.accent } : null,
      });
      onOpenChange(false);
      navigate(`/w/${event.workspaceId}/events/${event.id}/overview`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The template list grows as templates are added, so the dialog is
          capped to the viewport and the form scrolls inside it, the submit
          button never leaves the screen. */}
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            The template sets your starting vocabulary, cue columns and modules. Everything stays editable.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="event-name">Name</Label>
            <Input
              id="event-name"
              value={name}
              autoFocus
              placeholder="Friday Club Night"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Template</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUILTIN_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  aria-pressed={templateId === t.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors',
                    templateId === t.id ? 'border-primary bg-primary/10' : 'hover:bg-accent/60',
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: t.accent }}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-capacity">Capacity</Label>
              <Input
                id="event-capacity"
                type="number"
                inputMode="numeric"
                min={0}
                value={capacity}
                placeholder="420"
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-venue">Venue</Label>
            <Input
              id="event-venue"
              value={venue}
              placeholder="Palais de Tokyo, Paris"
              onChange={(e) => setVenue(e.target.value)}
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
