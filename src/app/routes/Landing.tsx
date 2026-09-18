import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, LayoutTemplate, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import { useStore } from '@/store';
import { BUILTIN_TEMPLATES } from '@/data/templates';

/** What the advance actually covers, in the words a producer would use. */
const ADVANCE_POINTS = [
  'One checklist per show, turning the whole advance into a number that’s easy to read',
  'A panel that surfaces what’s still open while there’s plenty of time to sort it',
  'Flights, hotels and transfers for everyone travelling in, all in one place',
  'Production contacts ready to hand the second somebody needs them on site',
  'A day sheet built from the answers already given, ready to print',
];

const DOORS = [
  {
    id: 'demo',
    icon: PlayCircle,
    title: 'Explore the demo',
    body: 'There are four productions to open and pull apart, including a club night, a festival stage, a brand launch and a tour date that has already been settled.',
    cta: 'Open the demo',
  },
  {
    id: 'template',
    icon: LayoutTemplate,
    title: 'Start from a template',
    body: 'Tell it what kind of event you’re running, and it comes back with the vocabulary, the cue columns, and the dashboards that suit it.',
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
        <p className="mt-6 max-w-xl font-display text-xl tracking-tight text-foreground sm:text-2xl">
          One place for everything an event needs.
        </p>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          BabyProducer takes the work that fills the weeks before a show and holds it in one structure.
          Everything sits under the same show, from the rider to the travel for everyone coming in to the
          production contacts and the timings, and as things fall into place a checklist reads them back as a
          readiness number while a panel keeps whatever is still open in plain sight, so the advance is shared
          across the team from the first week onwards.
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
          Everything an event needs after the advance lives here too, which means the guest list and the
          artist +1s, the seating chart nobody wants to build twice, a run of show that shifts on its own when
          the opener runs long, and door check-in that carries on scanning while the venue Wi-Fi does whatever
          venue Wi-Fi does. At the end of the night you settle up in the same place, without carrying a pile of
          receipts home with you.
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
