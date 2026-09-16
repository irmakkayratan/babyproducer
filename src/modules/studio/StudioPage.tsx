import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import type { Guest, ModuleKey } from '@/data/types';
import { ALL_MODULES } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/data/db';
import { useStore } from '@/store';
import { downloadFile } from '@/data/io/csv';
import { exportWorkspace, importWorkspace } from '@/data/io/workspace';
import { VocabEditor } from './VocabEditor';
import { FieldEditor } from './FieldEditor';
import { MetricEditor } from './MetricEditor';
import { Diagnostics } from './Diagnostics';

const MODULE_LABELS: Record<ModuleKey, string> = {
  guests: 'Guests',
  seating: 'Seating',
  rundown: 'Run of Show',
  advancing: 'Advancing',
  checkin: 'Check-in',
  command: 'Command Center',
  metrics: 'Metrics & Recap',
  settlement: 'Settlement',
};

/**
 * Studio: one place to reshape the app.
 *
 * Everything here writes to the workspace's schema, brand tokens and metric
 * configs, which the rest of the app reads at render time, so a change takes
 * effect immediately, with no rebuild and no migration.
 */
export function StudioPage() {
  const { workspaceId } = useParams();
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const bootstrap = useStore((s) => s.bootstrap);
  const guests = useStore((s) => s.guests);
  const fileRef = useRef<HTMLInputElement>(null);

  const workspace = workspaces.find((w) => w.id === (workspaceId ?? activeWorkspaceId));
  const [usage, setUsage] = useState<{ tiers: Map<string, number>; voices: Map<string, number>; statuses: Map<string, number> }>({
    tiers: new Map(),
    voices: new Map(),
    statuses: new Map(),
  });

  useEffect(() => {
    if (!workspace) return;
    void (async () => {
      const events = await db.events.where('workspaceId').equals(workspace.id).toArray();
      const all = await db.guests.where('eventId').anyOf(events.map((event) => event.id)).toArray();
      const count = (pick: (guest: (typeof all)[number]) => string | undefined) => {
        const map = new Map<string, number>();
        for (const guest of all) {
          const key = pick(guest);
          if (key) map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
      };
      setUsage({
        tiers: count((guest) => guest.tierId),
        voices: count((guest) => guest.voiceId),
        statuses: count((guest) => guest.statusId),
      });
    })();
  }, [workspace]);

  const [fallbackGuest, setFallbackGuest] = useState<Guest | undefined>();

  // Studio sits above the event level, so the guest working set may be empty.
  // The metric preview needs a real record to be worth anything.
  useEffect(() => {
    if (!workspace || guests.length > 0) return;
    void (async () => {
      const events = await db.events.where('workspaceId').equals(workspace.id).toArray();
      const candidates = await db.guests
        .where('eventId')
        .anyOf(events.map((event) => event.id))
        .limit(200)
        .toArray();
      setFallbackGuest(candidates.find((guest) => guest.audience?.followers) ?? candidates[0]);
    })();
  }, [workspace, guests.length]);

  const sampleGuest = useMemo(
    () => guests.find((guest) => guest.audience?.followers) ?? guests[0] ?? fallbackGuest,
    [guests, fallbackGuest],
  );

  if (!workspace) return null;
  const schema = workspace.schema;

  function patchSchema(patch: Partial<typeof schema>) {
    void updateWorkspace(workspace!.id, { schema: { ...workspace!.schema, ...patch } });
  }

  async function doExport(includeData: boolean) {
    const payload = await exportWorkspace(workspace!.id, { includeData });
    downloadFile(
      `${workspace!.name.replace(/\W+/g, '-').toLowerCase()}${includeData ? '-full' : '-setup'}.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    toast.success(includeData ? 'Exported workspace with data' : 'Exported workspace setup');
  }

  async function doImport(file: File) {
    try {
      const result = await importWorkspace(JSON.parse(await file.text()));
      await bootstrap();
      toast.success('Workspace imported', {
        description: `${result.events} events, ${result.guests} guests, added alongside your existing work.`,
      });
    } catch (error) {
      toast.error('Import failed', { description: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Studio</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Reshape the app for how you actually work. Nothing here requires a rebuild, and everything travels with
            your workspace export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Import
          </Button>
          <Button size="sm" variant="outline" onClick={() => void doExport(false)}>
            <Download className="size-4" /> Export setup
          </Button>
          <Button size="sm" onClick={() => void doExport(true)}>
            <Download className="size-4" /> Export everything
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import a workspace JSON file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <Tabs defaultValue="vocabulary" className="mt-8">
        <TabsList>
          <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="vocabulary" className="mt-6 space-y-5">
          <VocabEditor
            title="Voices"
            description="Who your guests are to you. This is the axis your value metrics weight by."
            entries={schema.voices}
            usage={usage.voices}
            onChange={(voices) => patchSchema({ voices })}
          />
          <VocabEditor
            title="Tiers"
            description="How you rank guests for seating and priority."
            entries={schema.tiers}
            usage={usage.tiers}
            onChange={(tiers) => patchSchema({ tiers })}
          />
          <VocabEditor
            title="Guest statuses"
            description="Your RSVP pipeline, in order. The board columns and the recap funnel follow it."
            entries={schema.guestStatuses}
            usage={usage.statuses}
            onChange={(guestStatuses) => patchSchema({ guestStatuses })}
          />
          <VocabEditor
            title="Cue types"
            description="The kinds of thing that happen in your run of show."
            entries={schema.cueTypes}
            onChange={(cueTypes) => patchSchema({ cueTypes })}
          />
          <VocabEditor
            title="Platforms"
            description="Where your guests' audiences live. Metric weight tables key off this."
            entries={schema.platforms}
            onChange={(platforms) => patchSchema({ platforms })}
          />
          <VocabEditor
            title="Advance sections"
            description="The headings your advance checklist is grouped under, in the order you work through them."
            entries={schema.advanceSections}
            onChange={(advanceSections) => patchSchema({ advanceSections })}
          />
          <VocabEditor
            title="Party roles"
            description="Who the people you advance and settle with are to you, on the advance sheet and on the settlement."
            entries={schema.partyRoles}
            onChange={(partyRoles) => patchSchema({ partyRoles })}
          />
          <VocabEditor
            title="Expense categories"
            description="How show costs are grouped on a settlement statement."
            entries={schema.expenseCategories}
            onChange={(expenseCategories) => patchSchema({ expenseCategories })}
          />
        </TabsContent>

        <TabsContent value="fields" className="mt-6 space-y-5">
          <FieldEditor entity="guest" fields={schema.fields} onChange={(fields) => patchSchema({ fields })} />
          <FieldEditor entity="event" fields={schema.fields} onChange={(fields) => patchSchema({ fields })} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <MetricEditor
            metrics={workspace.metrics}
            schema={schema}
            sampleGuest={sampleGuest}
            onChange={(metrics) => void updateWorkspace(workspace.id, { metrics })}
          />
        </TabsContent>

        <TabsContent value="brand" className="mt-6 space-y-5">
          <section className="space-y-5 rounded-lg border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="app-name">Product name</Label>
              <Input
                id="app-name"
                value={workspace.brand.appName}
                onChange={(e) =>
                  void updateWorkspace(workspace.id, { brand: { ...workspace.brand, appName: e.target.value } })
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                The app&rsquo;s own name is a setting. Call it whatever your team calls it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspace.name}
                onChange={(e) => void updateWorkspace(workspace.id, { name: e.target.value })}
                className="max-w-xs"
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          <section className="rounded-lg border">
            <header className="border-b p-4">
              <h3 className="font-medium">Modules</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Switch off what you do not run. Disabled modules disappear from the navigation and their routes
                stop resolving, so you get no dead links and no half-used screens.
              </p>
            </header>
            <div className="divide-y divide-border/60">
              {ALL_MODULES.map((moduleKey) => {
                const enabled = workspace.enabledModules.includes(moduleKey);
                return (
                  <label key={moduleKey} className="flex items-center justify-between gap-4 p-3.5">
                    <span className="text-sm">{MODULE_LABELS[moduleKey]}</span>
                    <Switch
                      checked={enabled}
                      aria-label={`${MODULE_LABELS[moduleKey]} module`}
                      onCheckedChange={(checked) =>
                        void updateWorkspace(workspace.id, {
                          enabledModules: checked
                            ? [...workspace.enabledModules, moduleKey]
                            : workspace.enabledModules.filter((key) => key !== moduleKey),
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="data" className="mt-6 space-y-5">
          <Diagnostics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
