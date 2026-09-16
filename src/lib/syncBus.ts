/**
 * Cross-tab message bus.
 *
 * At a registration desk the same event is open in several tabs; a check-in in
 * one must appear in the others immediately. BroadcastChannel is the right API
 * for that, but Safari has historically dropped messages, so this wraps it with
 * a localStorage fallback. One module, one place to fix browser quirks.
 */

export type SyncEvent =
  | { type: 'guest:changed'; eventId: string; guestIds: string[] }
  | { type: 'guest:checked-in'; eventId: string; guestId: string; at: string }
  | { type: 'seating:changed'; eventId: string; mapId: string }
  | { type: 'event:changed'; eventId: string }
  | { type: 'workspace:changed'; workspaceId: string }
  | { type: 'schema:changed'; workspaceId: string }
  | { type: 'rundown:caller'; eventId: string; cueId: string | null }
  | { type: 'demo:reset' };

type Handler = (event: SyncEvent) => void;

const CHANNEL = 'atelier:sync';
const FALLBACK_KEY = 'atelier:sync:fallback';

interface Envelope {
  senderId: string;
  messageId: string;
  event: SyncEvent;
}

/**
 * How many recently seen message ids to remember. Both transports deliver the
 * same message, so this only has to outlive the gap between the two — a few
 * dozen is generous.
 */
const SEEN_LIMIT = 64;

class SyncBus {
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<Handler>();
  private readonly senderId = Math.random().toString(36).slice(2);
  private counter = 0;
  /** Insertion-ordered, so the oldest id is the first key. */
  private seen = new Set<string>();

  constructor() {
    if (typeof window === 'undefined') return;
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<Envelope>) => this.receive(e.data);
    }
    // Fallback (and belt-and-braces for browsers that silently drop messages).
    window.addEventListener('storage', (e) => {
      if (e.key !== FALLBACK_KEY || !e.newValue) return;
      try {
        this.receive(JSON.parse(e.newValue) as Envelope);
      } catch {
        /* ignore malformed payloads */
      }
    });
  }

  /**
   * Where both transports work, every message arrives twice. Handlers happen to
   * be idempotent today, but that is a property nobody declared and nothing
   * tests, so messages carry an id and the second copy is dropped here.
   */
  private receive(envelope: Envelope | undefined): void {
    if (!envelope || envelope.senderId === this.senderId) return;
    const { messageId } = envelope;
    if (messageId) {
      if (this.seen.has(messageId)) return;
      this.seen.add(messageId);
      if (this.seen.size > SEEN_LIMIT) {
        const oldest = this.seen.values().next().value;
        if (oldest !== undefined) this.seen.delete(oldest);
      }
    }
    this.dispatch(envelope.event);
  }

  post(event: SyncEvent): void {
    const payload: Envelope = {
      senderId: this.senderId,
      messageId: `${this.senderId}:${this.counter++}`,
      event,
    };
    this.channel?.postMessage(payload);
    try {
      // `at` keeps the serialised value distinct, so two identical events in a
      // row still fire a `storage` event in the other tabs.
      localStorage.setItem(FALLBACK_KEY, JSON.stringify({ ...payload, at: Date.now() }));
    } catch {
      /* private mode / blocked storage: BroadcastChannel alone still works */
    }
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private dispatch(event: SyncEvent) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[syncBus] handler failed', err);
      }
    }
  }
}

export const syncBus = new SyncBus();
