import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { db } from '@/data/db';
import { deriveTimes, formatDuration } from '@/lib/time';
import { useRundown } from './useRundown';

/**
 * The stage-facing surface: a countdown large enough to read from the back of
 * a room, plus whatever the producer has pushed to it. Deliberately its own
 * route so it can live on a second screen, a tablet taped to the lectern, or a
 * link handed to a speaker.
 */
export function StageDisplay() {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const mode = pathname.endsWith('/prompter') || params.get('mode') === 'prompter' ? 'prompter' : 'timer';
  const { cues, meta } = useRundown(eventId);
  const [now, setNow] = useState(() => Date.now());
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    void db.events.get(eventId).then((event) => event && setEventName(event.name));
  }, [eventId]);

  const times = useMemo(() => deriveTimes(meta.showStart, cues), [meta.showStart, cues]);
  const index = cues.findIndex((cue) => cue.id === meta.callerCueId);
  const current = cues[index];
  const next = cues[index + 1];

  const elapsed = current?.actualStart ? Math.round((now - new Date(current.actualStart).getTime()) / 1000) : 0;
  const remaining = current ? current.durationSec - elapsed : 0;
  const message = meta.message;
  const messageFresh = message ? now - new Date(message.at).getTime() < 90_000 : false;

  if (mode === 'prompter') {
    return (
      <div className="min-h-dvh bg-black p-8 text-white">
        <p className="text-sm uppercase tracking-widest text-white/40">{current?.label ?? eventName}</p>
        <p className="mx-auto mt-8 max-w-4xl whitespace-pre-wrap text-4xl leading-[1.35] sm:text-5xl">
          {current?.prompter?.trim() ||
            'No script on this cue. Anything typed into the cue’s prompter field appears here instantly.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-black p-6 text-white sm:p-10" data-testid="stage-timer">
      <div className="flex items-baseline justify-between text-white/50">
        <span className="text-sm uppercase tracking-widest">{eventName}</span>
        <span className="font-mono text-sm" data-numeric>
          {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg uppercase tracking-[0.2em] text-white/50 sm:text-2xl">
          {current?.label ?? 'Standing by'}
        </p>
        {/*
          Urgency without colour, read from the back of a room: comfortable time
          is a softer white, the last minute goes to full white, and running over
          inverts the block to black on white. Inverting is the loudest thing a
          two-colour screen can do, and it is unmistakable at a glance.
        */}
        <p
          className={`px-6 font-mono text-[18vw] leading-none tabular-nums sm:text-[15vw] ${
            remaining < 0
              ? 'bg-white text-black'
              : remaining < 60
                ? 'text-white'
                : 'text-white/70'
          }`}
          data-numeric
        >
          {current ? formatDuration(Math.abs(remaining)) : '-'}
        </p>
        {current && remaining < 0 && (
          <p className="bg-white px-4 text-xl uppercase tracking-widest text-black">over</p>
        )}
        {next && <p className="text-base text-white/40 sm:text-xl">Next · {next.label}</p>}
      </div>

      <div className="min-h-16">
        {message && messageFresh && (
          <p
            className="rounded-lg bg-white/10 p-4 text-center text-2xl sm:text-4xl"
            data-testid="stage-message"
            aria-live="polite"
          >
            {message.text}
          </p>
        )}
        {!message && current && times[index] && (
          <p className="text-center text-sm text-white/30">
            Planned start {new Date(times[index].plannedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
        )}
      </div>
    </div>
  );
}
