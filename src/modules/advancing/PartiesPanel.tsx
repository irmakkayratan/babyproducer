import { Plus, Trash2 } from 'lucide-react';
import type { AdvanceContact, AdvanceParty, AdvanceSheet, Vocab } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { InlineText } from '@/components/InlineInput';
import {
  addAdvanceContact,
  addAdvanceParty,
  removeAdvanceContact,
  removeAdvanceParty,
  updateAdvanceContact,
  updateAdvanceParty,
} from '@/data/advancing';
import { checklistForEvent } from '@/data/advancing';
import { totalHeadcount } from './model';

/**
 * Who is travelling, and who to call.
 *
 * A party is the unit the per-party questions repeat over, so adding one here
 * is what makes a second set of flights, rooms and transfers appear on the
 * checklist, so the advance grows with the booking and nobody retypes it.
 */
export function PartiesPanel({
  sheet,
  eventId,
  startsAt,
  templateId,
  roles,
}: {
  sheet: AdvanceSheet;
  eventId: string;
  startsAt: string;
  templateId?: string;
  roles: Vocab[];
}) {
  return (
    <div className="space-y-6">
      <section>
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-tight">Travelling parties</h2>
            <p className="text-sm text-muted-foreground">
              {sheet.parties.length} {sheet.parties.length === 1 ? 'party' : 'parties'} ·{' '}
              {totalHeadcount(sheet.parties)} people to feed, badge and move.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              void addAdvanceParty(
                eventId,
                { name: 'New party', headcount: 1, roleId: roles[0]?.id },
                checklistForEvent(templateId),
                startsAt,
              )
            }
          >
            <Plus className="size-4" /> Add party
          </Button>
        </header>

        {sheet.parties.length === 0 ? (
          <EmptyState
            title="Nobody is travelling yet"
            description="Add the party you are advancing and the travel, hotel and transfer questions repeat for them."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {sheet.parties.map((party) => (
              <PartyCard key={party.id} party={party} eventId={eventId} roles={roles} />
            ))}
          </div>
        )}
      </section>

      <section>
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-tight">Production contacts</h2>
            <p className="text-sm text-muted-foreground">
              The numbers that matter at 6am on load-in day. They print on the advance sheet.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void addAdvanceContact(eventId, { name: '' })}>
            <Plus className="size-4" /> Add contact
          </Button>
        </header>

        {sheet.contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description="Venue production manager, local crew chief, tour manager. Whoever actually picks up the phone."
            className="mt-4"
          />
        ) : (
          <Card className="mt-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">Company</th>
                  <th className="p-2.5">Email</th>
                  <th className="p-2.5">Phone</th>
                  <th className="w-10 p-2.5" />
                </tr>
              </thead>
              <tbody>
                {sheet.contacts.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} eventId={eventId} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}

function PartyCard({ party, eventId, roles }: { party: AdvanceParty; eventId: string; roles: Vocab[] }) {
  const patch = (value: Partial<AdvanceParty>) => void updateAdvanceParty(eventId, party.id, value);

  return (
    <Card className="p-4" data-testid="advance-party">
      <div className="flex items-start gap-2">
        <InlineText
          label="Party name"
          value={party.name}
          onCommit={(name) => patch({ name })}
          className="flex-1 font-display text-lg"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remove ${party.name || 'party'}`}
          className="text-destructive hover:text-destructive"
          onClick={() => void removeAdvanceParty(eventId, party.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Role</span>
          <select
            aria-label={`Role for ${party.name || 'party'}`}
            value={party.roleId ?? ''}
            onChange={(e) => patch({ roleId: e.target.value || undefined })}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">-</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Headcount</span>
          <InlineText
            label={`Headcount for ${party.name || 'party'}`}
            inputMode="numeric"
            value={String(party.headcount ?? 0)}
            onCommit={(value) => patch({ headcount: Number(value) || 0 })}
            className="h-8 border-input"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Day contact</span>
          <InlineText
            label={`Day contact for ${party.name || 'party'}`}
            value={party.contactName ?? ''}
            onCommit={(contactName) => patch({ contactName })}
            className="h-8 border-input"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</span>
          <InlineText
            label={`Phone for ${party.name || 'party'}`}
            value={party.contactPhone ?? ''}
            onCommit={(contactPhone) => patch({ contactPhone })}
            className="h-8 border-input"
          />
        </label>
      </div>
    </Card>
  );
}

function ContactRow({ contact, eventId }: { contact: AdvanceContact; eventId: string }) {
  const patch = (value: Partial<AdvanceContact>) => void updateAdvanceContact(eventId, contact.id, value);
  const field = (key: keyof AdvanceContact, label: string) => (
    <td className="p-1.5">
      <InlineText
        label={`${label} for ${contact.name || 'contact'}`}
        value={String(contact[key] ?? '')}
        onCommit={(value) => patch({ [key]: value })}
      />
    </td>
  );

  return (
    <tr className="border-b border-border/60 last:border-b-0" data-testid="advance-contact">
      {field('name', 'Name')}
      {field('role', 'Role')}
      {field('company', 'Company')}
      {field('email', 'Email')}
      {field('phone', 'Phone')}
      <td className="p-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remove ${contact.name || 'contact'}`}
          className="text-destructive hover:text-destructive"
          onClick={() => void removeAdvanceContact(eventId, contact.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
  );
}
