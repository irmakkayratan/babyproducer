import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutTemplate, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import { useStore } from '@/store';
import { BUILTIN_TEMPLATES } from '@/data/templates';

const DOORS = [
  {
    id: 'demo',
    icon: PlayCircle,
    title: 'Explore the demo',
    body: 'Four example productions — a runway show, a pop-up activation, a launch keynote and a tour date already settled — ready to open, edit and reset.',
    cta: 'Open the demo',
  },
  {
    id: 'template',
    icon: LayoutTemplate,
    title: 'Start from a template',
    body: 'Pick a shape — runway, activation, keynote, conference, gala — and get the vocabulary, cue columns and dashboards that fit it.',
    cta: 'Browse templates',
  },
  {
    id: 'blank',
    icon: Sparkles,
    title: 'Start blank',
    body: 'No assumptions about your industry. Neutral defaults you shape yourself in Studio.',
    cta: 'Create a workspace',
  },
] as const;

export function Landing() {
  const navigate = useNavigate();
  const createWorkspace = useStore((s) => s.createWorkspace);
  const workspaces = useStore((s) => s.workspaces);

  async function startBlank() {
    const workspace = await createWorkspace({ name: 'My Workspace' });
    navigate(`/w/${workspace.id}`);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-70"
        style={{
          background:
            'radial-gradient(90% 70% at 50% -10%, color-mix(in oklab, var(--primary) var(--wash), transparent), transparent 70%)',
        }}
      />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-display text-lg tracking-tight">Atelier</span>
        <div className="flex items-center gap-3">
          <StatusChip />
          {workspaces.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${workspaces[0].id}`)}>
              Go to workspace <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl px-6 pb-24 pt-10 sm:px-10 sm:pt-20">
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Run the whole show
          <br />
          from one place.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Guest lists and media value, seating politics, a run of show that re-times itself, and onsite check-in
          that works when the venue Wi-Fi does not. Everything lives on your device.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {DOORS.map((door) => (
            <button
              key={door.id}
              type="button"
              onClick={() => {
                if (door.id === 'blank') void startBlank();
                else if (door.id === 'template') navigate('/start');
                else navigate('/demo');
              }}
              className="group flex h-full flex-col items-start gap-3 rounded-lg border bg-card/60 p-5 text-left transition-colors hover:border-primary/50 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <door.icon className="size-5 text-primary" />
              <span className="font-medium">{door.title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{door.body}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm text-primary">
                {door.cta}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        <p className="mt-14 text-xs text-muted-foreground">
          {BUILTIN_TEMPLATES.length} built-in templates · No account · No server · Your data never leaves this browser
        </p>
      </main>
    </div>
  );
}
