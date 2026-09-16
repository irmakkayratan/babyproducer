import { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Guest, SchemaConfig, Vocab } from '@/data/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GUEST_IMPORT_TARGETS, guessMapping, parseCsv, type ImportTargetId } from '@/data/io/csv';
import { createGuest } from '@/data/guests';
import { qrToken, ulid } from '@/lib/id';

type Step = 'file' | 'map' | 'done';

/** Match an incoming label against user-defined vocabulary, case-insensitively. */
function matchVocab(list: Vocab[], raw: string): string | undefined {
  const needle = raw.trim().toLowerCase();
  if (!needle) return undefined;
  return list.find((entry) => entry.id.toLowerCase() === needle || entry.label.toLowerCase() === needle)?.id;
}

export function ImportWizard({
  open,
  onOpenChange,
  eventId,
  schema,
  existing,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  schema: SchemaConfig;
  existing: Guest[];
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>('file');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportTargetId>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'merge' | 'create'>('skip');
  const [result, setResult] = useState<{ created: number; merged: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => parsed?.rows.slice(0, 5) ?? [], [parsed]);
  const mappedCount = Object.values(mapping).filter((target) => target !== 'ignore').length;

  async function onFile(file: File) {
    const text = await file.text();
    const result = parseCsv(text);
    setFileName(file.name);
    setParsed(result);
    setMapping(guessMapping(result.headers));
    setStep('map');
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    try {
      const byName = new Map(existing.map((guest) => [guest.name.trim().toLowerCase(), guest]));
      let created = 0;
      let merged = 0;
      let skipped = 0;

      for (const row of parsed.rows) {
        const draft: Partial<Guest> & { eventId: string; name: string } = {
          eventId,
          name: '',
          fields: {},
        };
        let followers: number | undefined;
        let platform: string | undefined;

        parsed.headers.forEach((header, index) => {
          const target = mapping[header];
          const raw = row[index] ?? '';
          if (!target || target === 'ignore' || raw === '') return;

          if (target.startsWith('field:')) {
            draft.fields = { ...draft.fields, [target.slice('field:'.length)]: raw };
            return;
          }

          switch (target) {
            case 'name': draft.name = raw; break;
            case 'handle': draft.handle = raw.startsWith('@') ? raw : `@${raw}`; break;
            case 'company': draft.company = raw; break;
            case 'email': draft.email = raw; break;
            case 'phone': draft.phone = raw; break;
            case 'notes': draft.notes = raw; break;
            case 'tags': draft.tags = raw.split(/[;,|]/).map((tag) => tag.trim()).filter(Boolean); break;
            case 'plusOnes': draft.plusOnes = Number.parseInt(raw, 10) || 0; break;
            case 'followers': followers = Number(raw.replace(/[^0-9.]/g, '')) || undefined; break;
            case 'platform': platform = matchVocab(schema.platforms, raw) ?? raw.toLowerCase(); break;
            case 'voiceId': draft.voiceId = matchVocab(schema.voices, raw); break;
            case 'tierId': draft.tierId = matchVocab(schema.tiers, raw); break;
            case 'statusId': draft.statusId = matchVocab(schema.guestStatuses, raw); break;
          }
        });

        if (!draft.name.trim()) {
          skipped++;
          continue;
        }
        if (followers || platform) draft.audience = { followers, platform };

        const duplicate = byName.get(draft.name.trim().toLowerCase());
        if (duplicate && duplicateStrategy === 'skip') {
          skipped++;
          continue;
        }
        if (duplicate && duplicateStrategy === 'merge') {
          const { updateGuest } = await import('@/data/guests');
          await updateGuest(duplicate.id, { ...draft, fields: { ...duplicate.fields, ...draft.fields } });
          merged++;
          continue;
        }

        await createGuest({ ...draft, id: ulid(), qrToken: qrToken() });
        created++;
      }

      setResult({ created, merged, skipped });
      setStep('done');
      onImported();
    } finally {
      setBusy(false);
    }
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setStep('file');
      setParsed(null);
      setResult(null);
      setFileName('');
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import guests</DialogTitle>
          <DialogDescription>
            Any CSV works. Columns we do not recognise can be ignored or kept as custom fields.
          </DialogDescription>
        </DialogHeader>

        {step === 'file' && (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-accent/30">
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">Choose a CSV file</span>
            <span className="text-xs text-muted-foreground">
              Comma, semicolon or tab separated. Nothing is uploaded, because the parsing happens in this browser.
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
        )}

        {step === 'map' && parsed && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="muted">{fileName}</Badge>
              <span>
                {parsed.rows.length} rows · {mappedCount} of {parsed.headers.length} columns mapped
              </span>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
              {parsed.headers.map((header, index) => (
                <div key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{header}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {preview.map((row) => row[index]).filter(Boolean).slice(0, 2).join(' · ') || 'no sample values'}
                    </p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={mapping[header]}
                    onValueChange={(value) => setMapping({ ...mapping, [header]: value as ImportTargetId })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Ignore this column</SelectItem>
                      {GUEST_IMPORT_TARGETS.map((target) => (
                        <SelectItem key={target.id} value={target.id}>
                          {target.label}
                        </SelectItem>
                      ))}
                      {schema.fields
                        .filter((field) => field.entity === 'guest' && !field.archived)
                        .map((field) => (
                          <SelectItem key={field.id} value={`field:${field.id}`}>
                            Custom · {field.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicates">When a guest already exists</Label>
              <Select value={duplicateStrategy} onValueChange={(value) => setDuplicateStrategy(value as typeof duplicateStrategy)}>
                <SelectTrigger id="duplicates" className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip the imported row</SelectItem>
                  <SelectItem value="merge">Merge into the existing guest</SelectItem>
                  <SelectItem value="create">Create a second record</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-2 py-4 text-sm">
            <p className="text-base font-medium">Import complete</p>
            <p className="text-muted-foreground">
              {result.created} created · {result.merged} merged · {result.skipped} skipped
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {step === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {step === 'map' && (
            <Button onClick={() => void runImport()} disabled={busy}>
              Import {parsed?.rows.length ?? 0} rows
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
