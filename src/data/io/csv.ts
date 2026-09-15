/**
 * CSV import and export.
 *
 * Guest lists arrive as whatever the PR team had in a spreadsheet, so the
 * importer never assumes a shape: it parses, guesses a mapping, shows a
 * preview, and lets unknown columns become custom fields.
 */
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** RFC4180-ish parser: strips a BOM, handles quotes, separators and newlines. */
export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const sep = delimiter ?? guessDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === sep) {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);

  const [headers = [], ...body] = rows;
  return { headers, rows: body };
}

function guessDelimiter(text: string): string {
  const newline = text.indexOf('\n');
  const firstLine = newline === -1 ? text : text.slice(0, newline);
  const counts = [',', ';', '\t', '|'].map((candidate) => ({
    candidate,
    count: firstLine.split(candidate).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0].candidate || ',';
}

/** Target fields the importer can map onto, beyond the custom ones. */
export const GUEST_IMPORT_TARGETS = [
  { id: 'name', label: 'Name', aliases: ['name', 'full name', 'guest', 'attendee', 'contact'] },
  { id: 'handle', label: 'Handle', aliases: ['handle', 'instagram', 'social', 'username', 'ig'] },
  { id: 'company', label: 'Company', aliases: ['company', 'brand', 'outlet', 'publication', 'organisation', 'organization'] },
  { id: 'email', label: 'Email', aliases: ['email', 'e-mail', 'mail'] },
  { id: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'tel'] },
  { id: 'voiceId', label: 'Voice', aliases: ['voice', 'type', 'category', 'segment'] },
  { id: 'tierId', label: 'Tier', aliases: ['tier', 'level', 'priority', 'seating tier'] },
  { id: 'statusId', label: 'Status', aliases: ['status', 'rsvp', 'response'] },
  { id: 'plusOnes', label: 'Plus ones', aliases: ['plus ones', '+1', 'plusones', 'party'] },
  { id: 'followers', label: 'Followers', aliases: ['followers', 'reach', 'audience', 'subscribers'] },
  { id: 'platform', label: 'Platform', aliases: ['platform', 'channel', 'network'] },
  { id: 'notes', label: 'Notes', aliases: ['notes', 'comment', 'remarks'] },
  { id: 'tags', label: 'Tags', aliases: ['tags', 'labels'] },
] as const;

export type ImportTargetId = (typeof GUEST_IMPORT_TARGETS)[number]['id'] | 'ignore' | `field:${string}`;

/** Fuzzy header matching, so a well-formed file needs no manual mapping. */
export function guessMapping(headers: string[]): Record<string, ImportTargetId> {
  const mapping: Record<string, ImportTargetId> = {};
  const used = new Set<string>();

  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();
    const match = GUEST_IMPORT_TARGETS.find(
      (target) =>
        !used.has(target.id) && target.aliases.some((alias) => normalized === alias || normalized.includes(alias)),
    );
    if (match) {
      mapping[header] = match.id;
      used.add(match.id);
    } else {
      mapping[header] = 'ignore';
    }
  }
  return mapping;
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  const columns = headers ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
}

export function downloadFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
