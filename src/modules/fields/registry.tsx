/**
 * Custom-field registry.
 *
 * A field definition is data; this registry turns it into a table cell, a
 * detail row, a form control and a validation rule. Adding a new field kind is
 * one entry here — no module needs to know about it.
 */
import { z } from 'zod';
import type { FieldDef, FieldValue } from '@/data/types';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/utils';

export interface FieldControlProps {
  def: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  id?: string;
}

export interface FieldRenderer {
  Cell: (props: { def: FieldDef; value: FieldValue }) => React.ReactNode;
  Control: (props: FieldControlProps) => React.ReactNode;
  zod: (def: FieldDef) => z.ZodTypeAny;
  align?: 'left' | 'right';
}

const text: FieldRenderer = {
  Cell: ({ value }) => <span className="truncate">{value == null ? '' : String(value)}</span>,
  Control: ({ def, value, onChange, id }) => (
    <Input
      id={id}
      value={value == null ? '' : String(value)}
      placeholder={def.helpText}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  zod: (def) => (def.required ? z.string().min(1, `${def.label} is required`) : z.string().optional()),
};

const longtext: FieldRenderer = {
  ...text,
  Control: ({ def, value, onChange, id }) => (
    <Textarea
      id={id}
      value={value == null ? '' : String(value)}
      placeholder={def.helpText}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
};

const number: FieldRenderer = {
  align: 'right',
  Cell: ({ value }) => <span data-numeric>{value == null || value === '' ? '' : formatNumber(Number(value))}</span>,
  Control: ({ value, onChange, id }) => (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  ),
  zod: (def) => (def.required ? z.number() : z.number().nullable().optional()),
};

const currency: FieldRenderer = {
  ...number,
  Cell: ({ value }) => <span data-numeric>{value == null || value === '' ? '' : formatCurrency(Number(value))}</span>,
};

const percent: FieldRenderer = {
  ...number,
  Cell: ({ value }) => (
    <span data-numeric>{value == null || value === '' ? '' : `${(Number(value) * 100).toFixed(1)}%`}</span>
  ),
};

const select: FieldRenderer = {
  Cell: ({ def, value }) => {
    const option = def.options?.find((o) => o.value === String(value));
    if (!option) return <span className="text-muted-foreground">—</span>;
    return (
      <Badge variant="muted" className="gap-1.5">
        {option.color && <span className="size-1.5 rounded-full" style={{ background: option.color }} />}
        {option.label}
      </Badge>
    );
  },
  Control: ({ def, value, onChange }) => (
    <Select value={value == null ? '' : String(value)} onValueChange={(next) => onChange(next)}>
      <SelectTrigger>
        <SelectValue placeholder={def.helpText ?? 'Select…'} />
      </SelectTrigger>
      <SelectContent>
        {def.options?.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  zod: (def) => {
    const values = def.options?.map((o) => o.value) ?? [];
    const base = values.length > 0 ? z.enum(values as [string, ...string[]]) : z.string();
    return def.required ? base : base.optional();
  },
};

const multiselect: FieldRenderer = {
  Cell: ({ def, value }) => {
    const values = Array.isArray(value) ? value : [];
    if (values.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {values.map((entry) => (
          <Badge key={entry} variant="muted">
            {def.options?.find((o) => o.value === entry)?.label ?? entry}
          </Badge>
        ))}
      </span>
    );
  },
  Control: ({ def, value, onChange }) => {
    const values = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {def.options?.map((option) => {
          const checked = values.includes(option.value);
          return (
            <label key={option.value} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={() =>
                  onChange(checked ? values.filter((v) => v !== option.value) : [...values, option.value])
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>
    );
  },
  zod: (def) => (def.required ? z.array(z.string()).min(1) : z.array(z.string()).optional()),
};

const boolean: FieldRenderer = {
  Cell: ({ value }) => <span>{value ? 'Yes' : 'No'}</span>,
  Control: ({ value, onChange, id }) => (
    <Checkbox id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
  ),
  zod: () => z.boolean().optional(),
};

const date: FieldRenderer = {
  Cell: ({ value }) => (
    <span data-numeric>{value ? new Date(String(value)).toLocaleDateString() : ''}</span>
  ),
  Control: ({ value, onChange, id }) => (
    <Input id={id} type="date" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value)} />
  ),
  zod: (def) => (def.required ? z.string().min(1) : z.string().optional()),
};

const datetime: FieldRenderer = {
  ...date,
  Cell: ({ value }) => <span data-numeric>{value ? new Date(String(value)).toLocaleString() : ''}</span>,
  Control: ({ value, onChange, id }) => (
    <Input
      id={id}
      type="datetime-local"
      value={value ? String(value).slice(0, 16) : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
};

const url: FieldRenderer = {
  Cell: ({ value }) =>
    value ? (
      <a
        href={String(value)}
        target="_blank"
        rel="noreferrer noopener"
        className="truncate text-primary underline-offset-4 hover:underline"
      >
        {String(value).replace(/^https?:\/\//, '')}
      </a>
    ) : null,
  Control: text.Control,
  zod: (def) => (def.required ? z.string().url() : z.string().url().optional().or(z.literal(''))),
};

const email: FieldRenderer = {
  Cell: text.Cell,
  Control: ({ value, onChange, id }) => (
    <Input id={id} type="email" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
  ),
  zod: (def) => (def.required ? z.string().email() : z.string().email().optional().or(z.literal(''))),
};

const formula: FieldRenderer = {
  align: 'right',
  Cell: ({ value }) => <span data-numeric className="text-muted-foreground">{value == null ? '' : String(value)}</span>,
  Control: () => <span className="text-sm text-muted-foreground">Calculated automatically</span>,
  zod: () => z.any().optional(),
};

export const FIELD_RENDERERS: Record<FieldDef['kind'], FieldRenderer> = {
  text,
  longtext,
  number,
  currency,
  percent,
  select,
  multiselect,
  boolean,
  date,
  datetime,
  url,
  email,
  phone: text,
  relation: text,
  file: text,
  formula,
};

/** Validation is generated from the definitions — adding a field adds a rule. */
export function fieldDefsToZod(defs: FieldDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const def of defs) {
    if (def.archived) continue;
    shape[def.id] = FIELD_RENDERERS[def.kind].zod(def);
  }
  return z.object(shape);
}

export function defaultValueFor(def: FieldDef): FieldValue {
  if (def.defaultValue !== undefined) return def.defaultValue;
  switch (def.kind) {
    case 'boolean':
      return false;
    case 'multiselect':
      return [];
    case 'number':
    case 'currency':
    case 'percent':
      return null;
    default:
      return '';
  }
}
