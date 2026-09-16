import type { Cue, RundownColumn } from '@/data/types';
import type { DerivedCueTime } from '@/lib/time';
import { formatClock, formatDuration } from '@/lib/time';

/**
 * The paper cue sheet.
 *
 * Print is a real output in this industry — the stage manager's copy lives on
 * a clipboard. It renders only the columns marked as printed, uses ink-light
 * styling regardless of the screen theme, and stamps the version so two copies
 * on a table can be told apart.
 */
export function PrintSheet({
  eventName,
  venue,
  timezone,
  cues,
  times,
  columns,
}: {
  eventName: string;
  venue?: string;
  timezone: string;
  cues: Cue[];
  times: DerivedCueTime[];
  columns: RundownColumn[];
}) {
  const printed = columns.filter((column) => column.printed);

  return (
    <div className="hidden print:block print:text-black">
      <header className="mb-4 border-b border-black/20 pb-2">
        <h1 className="text-xl font-semibold">{eventName} — Run of Show</h1>
        <p className="text-xs">
          {venue ? `${venue} · ` : ''}
          {cues.length} cues · printed {new Date().toLocaleString()} · times in {timezone}
        </p>
      </header>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-black/40 text-left">
            <th className="py-1 pr-2">Start</th>
            <th className="py-1 pr-2">Dur</th>
            <th className="py-1 pr-2">Cue</th>
            {printed.map((column) => (
              <th key={column.id} className="py-1 pr-2">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cues.map((cue, index) => (
            <tr key={cue.id} className="break-inside-avoid border-b border-black/10 align-top">
              <td className="py-1 pr-2 font-mono">{formatClock(times[index].plannedStart, timezone)}</td>
              <td className="py-1 pr-2 font-mono">{formatDuration(cue.durationSec)}</td>
              <td className="py-1 pr-2 font-medium">
                {cue.label}
                {cue.anchor && <span className="ml-1 font-normal">(anchored)</span>}
              </td>
              {printed.map((column) => (
                <td key={column.id} className="py-1 pr-2">
                  {String(cue.cells[column.id] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
