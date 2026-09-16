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

const normalizeHeader = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * An alias matches a header when it is the whole header or one of its words —
 * never an arbitrary substring. Matching on substrings read "Hotel" as a phone
 * column (it contains "tel") and "Designer" as a social handle (it contains
 * "ig"), which is worse than leaving the column unmapped: the producer sees a
 * confident guess and a populated preview, and the error only surfaces at the
 * door.
 */
function aliasMatches(normalized: string, alias: string): boolean {
  if (normalized === alias) return true;
  const words = normalized.split(' ');
  const aliasWords = alias.split(' ');
  if (aliasWords.length === 1) return words.includes(alias);
  // A multi-word alias matches a run of whole words ("plus ones" in "guest plus ones").
  for (let i = 0; i + aliasWords.length <= words.length; i++) {
    if (aliasWords.every((word, j) => words[i + j] === word)) return true;
  }
  return false;
}

/** Fuzzy header matching, so a well-formed file needs no manual mapping. */
export function guessMapping(headers: string[]): Record<string, ImportTargetId> {
  const mapping: Record<string, ImportTargetId> = {};
  const used = new Set<string>();
  const normalized = headers.map(normalizeHeader);

  // Exact header/alias hits are claimed first, so "Email" takes the email slot
  // before "Company Email" can be considered for it.
  for (const pass of ['exact', 'word'] as const) {
    headers.forEach((header, index) => {
      if (mapping[header]) return;
      const text = normalized[index];
      if (!text) return;
      const match = GUEST_IMPORT_TARGETS.find(
        (target) =>
          !used.has(target.id) &&
          target.aliases.some((alias) => (pass === 'exact' ? text === alias : aliasMatches(text, alias))),
      );
      if (match) {
        mapping[header] = match.id;
        used.add(match.id);
      }
    });
  }

  for (const header of headers) if (!mapping[header]) mapping[header] = 'ignore';
  return mapping;
}

/**
 * A guest list is exported to be opened in Excel or Sheets, and both treat a
 * cell beginning `=`, `+`, `-`, `@` or a control character as a formula. A
 * guest can be called whatever the PR team typed, so a name is untrusted input
 * that ends up in a spreadsheet on someone else's machine: prefix it so it is
 * read as text.
 *
 * Numbers are left alone. A settlement exports its deductions as negatives, and
 * an accounts department needs `-1234.5` to arrive as a number, not `'-1234.5`.
 */
function neutralizeFormula(text: string, value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') return text;
  if (!/^[=+\-@\t\r]/.test(text)) return text;
  // A plain number typed as a string is still a number to a reader.
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) return text;
  return `'${text}`;
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  const columns = headers ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = neutralizeFormula(value == null ? '' : String(value), value);
    // `\r` has to force quoting too: unquoted, a lone carriage return splits the
    // row in a strict reader.
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.map(escape).join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n');
}

export function downloadFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking in the same tick can cancel the download before the browser has
  // read the blob; one turn of the event loop is enough and still bounded.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
