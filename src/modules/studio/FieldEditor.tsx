import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FieldDef, FieldEntity, FieldKind } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FIELD_RENDERERS } from '@/modules/fields/registry';
import { ulid } from '@/lib/id';

const KINDS: FieldKind[] = [
  'text',
  'longtext',
  'number',
  'currency',
  'percent',
  'select',
  'multiselect',
  'boolean',
  'date',
  'datetime',
  'url',
  'email',
  'phone',
];

const SURFACES = ['table', 'detail', 'form', 'badge', 'print'] as const;

/**
 * Custom fields.
 *
 * A definition saved here is immediately real everywhere: the registry gives
 * it a table cell, a detail row, a form control and a validation rule without
 * any module knowing it exists.
 */
export function FieldEditor({
  entity,
  fields,
  onChange,
}: {
  entity: FieldEntity;
  fields: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
}) {
  const [draftLabel, setDraftLabel] = useState('');
  const [draftKind, setDraftKind] = useState<FieldKind>('text');
  const mine = fields.filter((field) => field.entity === entity);

  function update(id: string, patch: Partial<FieldDef>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function add() {
    const label = draftLabel.trim();
    if (!label) return;
    const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${ulid().slice(-4).toLowerCase()}`;
    onChange([
      ...fields,
      {
        id,
        entity,
        label,
        kind: draftKind,
        showIn: ['table', 'detail', 'form'],
        order: mine.length,
        options:
          draftKind === 'select' || draftKind === 'multiselect'
            ? [
                { value: 'option-1', label: 'Option 1' },
                { value: 'option-2', label: 'Option 2' },
              ]
            : undefined,
      },
    ]);
    setDraftLabel('');
  }

  return (
    <section className="rounded-lg border">
      <header className="border-b p-4">
        <h3 className="font-medium">Custom fields</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Anything your events track that the built-in fields do not. New fields appear in the table, the detail
          sheet, forms and exports straight away.
        </p>
      </header>

      <div className="divide-y divide-border/60">
        {mine.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No custom fields yet.</p>
        )}
        {mine.map((field) => {
          const renderer = FIELD_RENDERERS[field.kind];
          return (
            <div key={field.id} className="space-y-3 p-4" data-testid="field-row">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={field.label}
                  aria-label={`Label for ${field.id}`}
                  onChange={(e) => update(field.id, { label: e.target.value })}
                  className="h-8 max-w-56"
                />
                <Badge variant="muted">{field.kind}</Badge>
                {field.archived && <Badge variant="warning">archived</Badge>}
                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={Boolean(field.required)}
                      onCheckedChange={(checked) => update(field.id, { required: Boolean(checked) })}
                    />
                    Required
                  </label>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Archive ${field.label}`}
                    title="Archiving keeps existing values and hides the field"
                    onClick={() => update(field.id, { archived: !field.archived })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {SURFACES.map((surface) => (
                  <label key={surface} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={field.showIn.includes(surface)}
                      onCheckedChange={(checked) =>
                        update(field.id, {
                          showIn: checked
                            ? [...field.showIn, surface]
                            : field.showIn.filter((entry) => entry !== surface),
                        })
                      }
                    />
                    {surface}
                  </label>
                ))}
              </div>

              {(field.kind === 'select' || field.kind === 'multiselect') && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${field.id}-options`}>Options</Label>
                  <Input
                    id={`${field.id}-options`}
                    value={(field.options ?? []).map((option) => option.label).join(', ')}
                    onChange={(e) =>
                      update(field.id, {
                        options: e.target.value
                          .split(',')
                          .map((label) => label.trim())
                          .filter(Boolean)
                          .map((label) => ({
                            value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            label,
                          })),
                      })
                    }
                    className="h-8"
                  />
                </div>
              )}

              <div className="rounded-md border border-dashed p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Preview</p>
                <renderer.Control def={field} value={field.defaultValue ?? null} onChange={() => {}} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t p-2.5">
        <Input
          value={draftLabel}
          placeholder="Field name, e.g. Dietary requirements"
          aria-label="New field name"
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="h-8 min-w-48 flex-1"
        />
        <Select value={draftKind} onValueChange={(value) => setDraftKind(value as FieldKind)}>
          <SelectTrigger className="h-8 w-40" aria-label="New field type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={add}>
          <Plus className="size-4" /> Add field
        </Button>
      </div>
    </section>
  );
}
