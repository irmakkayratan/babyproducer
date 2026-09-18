import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, LayoutTemplate, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import { useStore } from '@/store';
import { BUILTIN_TEMPLATES } from '@/data/templates';

/** What the advance actually covers, in the words a producer would use. */
const ADVANCE_POINTS = [
  'One checklist per show, with a number on it for how ready you are',
  'A panel that answers "what is still missing" before you have to ask',
  'Flights, hotels and transfers for everyone travelling in',
  'Production contacts, so nobody hunts through a mail thread at 2am',
  'A day sheet built from the answers, ready to print',
];

const DOORS = [
  {
    id: 'demo',
    icon: PlayCircle,
    title: 'Explore the demo',
    body: 'Four productions to open and pull apart: a runway show, a pop-up, a launch keynote and a tour date that has already been settled.',
    cta: 'Open the demo',
  },
  {
    id: 'template',
    icon: LayoutTemplate,
    title: 'Start from a template',
    body: 'Pick the shape of your event and get the vocabulary, cue columns and dashboards that suit it.',
    cta: 'Browse templates',
  },
  {
    id: 'blank',
    icon: Sparkles,
    title: 'Start blank',
    body: 'Nothing assumed about your industry. Neutral defaults you shape yourself in Studio.',
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
        <span className="font-display text-lg tracking-tight">BabyProducer</span>
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
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-foreground/30 px-3 py-1 text-xs uppercase tracking-widest">
          <ClipboardCheck className="size-3.5" />
          An advancing tool
        </p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Advance the show
          <br />
          without the mail thread.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Advancing is the job. It is the weeks of chasing riders, travel, contacts and timings that decide
          whether the day goes well, and it is the part that usually lives in somebody&rsquo;s inbox and a
          spreadsheet nobody else can find. BabyProducer gives it a home.
        </p>

        <ul className="mt-8 grid max-w-2xl gap-2.5 text-sm text-muted-foreground sm:text-base">
          {ADVANCE_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
              {point}
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-xl text-sm text-muted-foreground">
          Everything a show needs around the advance is here too: guest lists, seating, a run of show that
          re-times itself, door check-in that works when the venue Wi-Fi does not, and a settlement at the end
          of the night. All of it on your device, with no account and no server.
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
              className="group flex h-full flex-col items-start gap-3 rounded-lg border bg-card/60 p-5 text-left transition-colors hover:border-foreground/60 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <door.icon className="size-5" />
              <span className="font-medium">{door.title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{door.body}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm">
                {door.cta}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        <p className="mt-14 text-xs text-muted-foreground">
          {BUILTIN_TEMPLATES.length} built-in templates · No account · No server · Your data never leaves this
          browser
        </p>
      </main>
    </div>
  );
}
