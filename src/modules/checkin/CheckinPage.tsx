import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, CameraOff, Check, Lock, Printer, Search, UserPlus, X } from 'lucide-react';
import type { Guest } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useStore } from '@/store';
import { arrivedStatus, createGuest } from '@/data/guests';
import { matchByToken, matchGuests } from './match';
import { scannerSupported, startScanner, type ScannerHandle } from './scanner';
import { BadgeSheet } from './BadgeSheet';
import { cn, formatNumber } from '@/lib/utils';

type Feedback =
  | { kind: 'ok'; guest: Guest; seat?: string }
  | { kind: 'duplicate'; guest: Guest; at: string }
  | { kind: 'unknown'; query: string }
  | null;

/**
 * The door.
 *
 * One screen, thumb-reachable, dark, and unambiguous: green means in, amber
 * means already in and when, red means not found with the closest matches
 * offered. Everything works with the network off.
 */
export function CheckinPage() {
  const { eventId } = useParams();
  const events = useStore((s) => s.events);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveEvent = useStore((s) => s.setActiveEvent);
  const guests = useStore((s) => s.guests);
  const arrivedIds = useStore((s) => s.arrivedIds);
  const loadGuests = useStore((s) => s.loadGuests);
  const reloadGuests = useStore((s) => s.reloadGuests);
  const checkIn = useStore((s) => s.checkIn);
  const undoCheckIn = useStore((s) => s.undoCheckIn);

  const event = events.find((e) => e.id === eventId);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [scanning, setScanning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [badgeGuest, setBadgeGuest] = useState<Guest | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  useEffect(() => {
    if (eventId) {
      setActiveEvent(eventId);
      void loadGuests(eventId);
    }
  }, [eventId, setActiveEvent, loadGuests]);

  useEffect(() => () => scannerRef.current?.stop(), []);

  const arrived = useMemo(() => new Set(arrivedIds), [arrivedIds]);
  const arrivedStatusId = workspace ? arrivedStatus(workspace.schema.guestStatuses) : undefined;
  const matches = useMemo(() => matchGuests(guests, query), [guests, query]);
  const expected = guests.filter((guest) => guest.statusId !== 'declined').length;

  const admit = useCallback(
    async (guest: Guest) => {
      const result = await checkIn(guest.id, arrivedStatusId);
      if (result.ok) {
        setFeedback({ kind: 'ok', guest, seat: guest.seatId ? 'seated' : undefined });
      } else if (result.duplicate) {
        setFeedback({ kind: 'duplicate', guest, at: result.duplicate.at });
      }
      setQuery('');
      window.setTimeout(() => setFeedback(null), 6000);
    },
    [checkIn, arrivedStatusId],
  );

  const onScan = useCallback(
    (value: string) => {
      // A camera fires many frames a second; ignore repeats of the same badge.
      const now = Date.now();
      if (lastScanRef.current && lastScanRef.current.value === value && now - lastScanRef.current.at < 2500) return;
      lastScanRef.current = { value, at: now };

      const guest = matchByToken(guests, value);
      if (guest) void admit(guest);
      else setFeedback({ kind: 'unknown', query: value });
    },
    [guests, admit],
  );

  async function toggleScanner() {
    if (scanning) {
      scannerRef.current?.stop();
      scannerRef.current = null;
      setScanning(false);
      return;
    }
    if (!videoRef.current) return;
    try {
      scannerRef.current = await startScanner(videoRef.current, onScan);
      setScanning(true);
    } catch {
      setFeedback({ kind: 'unknown', query: 'camera unavailable' });
    }
  }

  if (!event || !workspace) return null;

  return (
    <div className="flex h-full flex-col bg-background" data-testid="checkin">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
        <div className="mr-auto flex items-center gap-3 text-sm">
          <span className="font-medium" data-numeric>
            {formatNumber(arrived.size)}
          </span>
          <span className="text-muted-foreground">in the room of {formatNumber(expected)} expected</span>
          <Badge variant="muted">{Math.round((arrived.size / Math.max(1, expected)) * 100)}%</Badge>
        </div>

        {!locked && (
          <>
            <Button size="sm" variant="outline" onClick={() => setWalkInOpen(true)}>
              <UserPlus className="size-4" /> Walk-in
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLocked(true)}>
              <Lock className="size-4" /> Kiosk mode
            </Button>
          </>
        )}
        {locked && (
          <Button size="sm" variant="ghost" onClick={() => setLocked(false)}>
            Exit kiosk mode
          </Button>
        )}
        {scannerSupported() && (
          <Button size="sm" variant={scanning ? 'default' : 'outline'} onClick={() => void toggleScanner()}>
            {scanning ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
            {scanning ? 'Stop camera' : 'Scan badges'}
          </Button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
        <video
          ref={videoRef}
          className={cn('w-full rounded-lg border bg-black', scanning ? 'block aspect-video' : 'hidden')}
          muted
          playsInline
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) void admit(matches[0].guest);
            }}
            placeholder="Type a name, or scan a badge"
            aria-label="Find a guest"
            className="h-14 pl-11 text-lg"
            data-testid="checkin-search"
          />
        </div>

        {feedback && (
          <div
            data-testid="checkin-feedback"
            /*
              Three outcomes a door needs to tell apart in half a second, with
              no colour to lean on. They differ in fill and in edge instead:
              admitted is a solid white block, already in is outlined and quiet,
              and not found is a heavy dashed edge that reads as unfinished.
            */
            className={cn(
              'rounded-lg border p-4 text-lg',
              feedback.kind === 'ok' && 'border-foreground bg-foreground text-background',
              feedback.kind === 'duplicate' && 'border-border bg-muted text-foreground',
              feedback.kind === 'unknown' && 'border-2 border-dashed border-foreground bg-transparent text-foreground',
            )}
            aria-live="assertive"
          >
            {feedback.kind === 'ok' && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Check className="size-5" /> {feedback.guest.name} is in
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void undoCheckIn(feedback.guest.id, 'confirmed');
                    setFeedback(null);
                  }}
                >
                  Undo
                </Button>
              </div>
            )}
            {feedback.kind === 'duplicate' && (
              <span>
                {feedback.guest.name} was already checked in at{' '}
                {new Date(feedback.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {feedback.kind === 'unknown' && (
              <span className="flex items-center gap-2">
                <X className="size-5" /> No match for “{feedback.query}”
              </span>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border scrollbar-thin" data-testid="checkin-matches">
          {query.length < 2 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Start typing a name, or point the camera at a badge. Everything here works offline.
            </p>
          ) : matches.length === 0 ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">Nobody on the list matches “{query}”.</p>
              <Button variant="outline" onClick={() => setWalkInOpen(true)}>
                <UserPlus className="size-4" /> Add as a walk-in
              </Button>
            </div>
          ) : (
            matches.map(({ guest, reason }) => {
              const isIn = arrived.has(guest.id);
              return (
                <div
                  key={guest.id}
                  data-testid="checkin-match"
                  className="flex items-center gap-3 border-b border-border/60 p-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{guest.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[guest.company, guest.handle, guest.plusOnes ? `+${guest.plusOnes}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                      {reason === 'fuzzy' && ' · near match'}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Badge for ${guest.name}`} onClick={() => setBadgeGuest(guest)}>
                    <Printer className="size-4" />
                  </Button>
                  {isIn ? (
                    <Badge variant="success">In</Badge>
                  ) : (
                    <Button size="sm" onClick={() => void admit(guest)}>
                      Check in
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        defaultName={query}
        onCreate={async (name) => {
          if (!eventId) return;
          const guest = await createGuest({ eventId, name, statusId: arrivedStatusId ?? 'confirmed' });
          await reloadGuests();
          await admit(guest);
        }}
      />

      <BadgeSheet guest={badgeGuest} eventName={event.name} onClose={() => setBadgeGuest(null)} />
    </div>
  );
}

function WalkInDialog({
  open,
  onOpenChange,
  defaultName,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a walk-in</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await onCreate(name.trim());
            onOpenChange(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="walkin-name">Name</Label>
            <Input id="walkin-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add and check in</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
