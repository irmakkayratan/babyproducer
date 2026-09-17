import type { AdvanceSheet, Event, Vocab } from '@/data/types';
import { formatDayTime, formatEventWindow } from '@/lib/time';
import { groupBySection, itinerary, STATUS_LABEL, totalHeadcount } from './model';

/**
 * The advance sheet as it gets sent.
 *
 * This is the artefact the whole module exists to produce: one page the venue,
 * the tour manager and the local crew all work from, so nobody has to scroll
 * back through a mail thread to find which hotel was booked. Ink-light and
 * black on white regardless of the screen theme.
 */
export function AdvancePrintSheet({
  event,
  sheet,
  sections,
}: {
  event: Event;
  sheet: AdvanceSheet;
  sections: Vocab[];
}) {
  const groups = groupBySection(sheet.items, sections);
  const schedule = itinerary(sheet.items);
  const label = (id: string) => sections.find((section) => section.id === id)?.label ?? id;

  return (
    <div className="hidden print:block print:text-black" data-testid="advance-print">
      <header className="mb-4 border-b border-black/20 pb-2">
        <h1 className="text-xl font-semibold">{event.name} · Advance Sheet</h1>
        <p className="text-xs">
          {[event.venue.name, event.venue.address].filter(Boolean).join(' · ')}
          {event.venue.name ? ' · ' : ''}
          {formatEventWindow(event.startsAt, event.endsAt, event.timezone)} · all times {event.timezone}
        </p>
        <p className="text-xs">
          {sheet.parties.length} parties · {totalHeadcount(sheet.parties)} people · printed{' '}
          {new Date().toLocaleString()}
        </p>
      </header>

      {sheet.parties.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide">Parties</h2>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {sheet.parties.map((party) => (
                <tr key={party.id} className="border-b border-black/10 align-top">
                  <td className="w-40 py-1 pr-2 font-medium">{party.name}</td>
                  <td className="w-16 py-1 pr-2">{party.headcount} pax</td>
                  <td className="py-1 pr-2">
                    {[party.contactName, party.contactPhone, party.contactEmail].filter(Boolean).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {schedule.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide">Day sheet</h2>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {schedule.map((entry) => (
                <tr key={entry.item.id} className="border-b border-black/10 align-top">
                  <td className="w-36 py-1 pr-2 font-mono">{formatDayTime(entry.at, event.timezone)}</td>
                  <td className="w-44 py-1 pr-2 font-medium">{entry.item.label}</td>
                  <td className="py-1 pr-2">
                    {[
                      entry.item.detail,
                      entry.item.logistics?.provider,
                      entry.item.logistics?.reference,
                      entry.item.logistics?.from && entry.item.logistics?.to
                        ? `${entry.item.logistics.from} → ${entry.item.logistics.to}`
                        : null,
                      sheet.parties.find((party) => party.id === entry.item.partyId)?.name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.section.id} className="mb-4 break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide">{label(group.section.id)}</h2>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {group.items.map((item) => (
                <tr key={item.id} className="border-b border-black/10 align-top">
                  <td className="w-52 py-1 pr-2 font-medium">
                    {item.label}
                    {item.partyId && (
                      <span className="font-normal">
                        {' '}
                        ({sheet.parties.find((party) => party.id === item.partyId)?.name})
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-2">{item.detail || '-'}</td>
                  <td className="w-24 py-1 pr-2">{STATUS_LABEL[item.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {sheet.contacts.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide">Contacts</h2>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {sheet.contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-black/10 align-top">
                  <td className="w-40 py-1 pr-2 font-medium">{contact.name}</td>
                  <td className="w-40 py-1 pr-2">{[contact.role, contact.company].filter(Boolean).join(', ')}</td>
                  <td className="py-1 pr-2">{[contact.phone, contact.email].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sheet.notes && <p className="mt-4 whitespace-pre-wrap text-[11px]">{sheet.notes}</p>}
    </div>
  );
}
