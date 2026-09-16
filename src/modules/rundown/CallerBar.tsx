import { useEffect, useState } from 'react';
import { MessageSquare, SkipBack, SkipForward, Square } from 'lucide-react';
import type { Cue } from '@/data/types';
import type { DerivedCueTime } from '@/lib/time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DriftPill } from './DriftPill';
import { formatDuration } from '@/lib/time';

/**
 * The producer's position bar. Space advances, ArrowLeft steps back — the show
 * caller should never need the mouse, and the keys work anywhere on the page
 * that is not a text field.
 */
export function CallerBar({
  cues,
  times,
  callerIndex,
  drift,
  onAdvance,
  onBack,
  onStop,
  onMessage,
}: {
  cues: Cue[];
  times: DerivedCueTime[];
  callerIndex: number;
  drift: number;
  onAdvance: () => void;
  onBack: () => void;
  onStop: () => void;
  onMessage: (text: string) => void;
}) {
  const [message, setMessage] = useState('');
  const current = cues[callerIndex];
  const next = cues[callerIndex + 1];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === ' ') {
        event.preventDefault();
        onAdvance();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onBack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAdvance, onBack]);

  if (!current) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-primary/10 px-4 py-2 sm:px-6" data-testid="caller-bar">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <span className="text-muted-foreground">On:</span> {current.label}
          <span className="ml-2 font-mono text-xs text-muted-foreground" data-numeric>
            {formatDuration(current.durationSec)}
          </span>
        </p>
        {next && (
          <p className="truncate text-xs text-muted-foreground">
            Next: {next.label} · {formatDuration(next.durationSec)}
            {times[callerIndex + 1]?.anchored && ' · anchored'}
          </p>
        )}
      </div>

      <DriftPill seconds={drift} />

      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="Previous cue" onClick={onBack}>
          <SkipBack className="size-4" />
        </Button>
        <Button size="sm" onClick={onAdvance} aria-label="Next cue">
          <SkipForward className="size-4" /> Next <kbd className="ml-1 text-[10px] opacity-70">space</kbd>
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Stop calling" onClick={onStop}>
          <Square className="size-4" />
        </Button>
      </div>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          onMessage(message);
          setMessage('');
        }}
      >
        <MessageSquare className="size-4 text-muted-foreground" />
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message to stage…"
          aria-label="Message to stage"
          className="h-8 w-48"
        />
      </form>
    </div>
  );
}
