import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BUILTIN_TEMPLATES } from '@/data/templates';
import { getTemplate } from '@/data/templates';
import { EventWizard } from '@/modules/workspace/EventWizard';
import { useStore } from '@/store';

export function StartFromTemplate() {
  const navigate = useNavigate();
  const createWorkspace = useStore((s) => s.createWorkspace);
  const workspaces = useStore((s) => s.workspaces);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);

  async function choose(templateId: string) {
    if (workspaces.length === 0) {
      await createWorkspace({ name: 'My Workspace', template: getTemplate(templateId) });
    }
    setPendingTemplate(templateId);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="-ml-2 mb-6 text-muted-foreground">
        <ArrowLeft className="size-4" /> Back
      </Button>
      <h1 className="font-display text-3xl tracking-tight">Start from a template</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        A template is just data: vocabulary, cue columns, modules and a palette. Everything it sets up can be
        renamed, replaced or switched off later in Studio.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {BUILTIN_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => void choose(template.id)}
            className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span aria-hidden className="size-3 rounded-full" style={{ background: template.accent }} />
            <span className="font-medium">{template.name}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{template.description}</span>
            <span className="mt-2 text-xs text-muted-foreground/80">
              {template.enabledModules.length} modules · {template.rundownColumns.length} cue columns
            </span>
          </button>
        ))}
      </div>

      <EventWizard
        open={pendingTemplate !== null}
        onOpenChange={(open) => !open && setPendingTemplate(null)}
        initialTemplateId={pendingTemplate ?? undefined}
      />
    </div>
  );
}
