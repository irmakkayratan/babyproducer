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

class SyncBus {
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<Handler>();
  private readonly senderId = Math.random().toString(36).slice(2);

  constructor() {
    if (typeof window === 'undefined') return;
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<{ senderId: string; event: SyncEvent }>) => {
        if (e.data?.senderId === this.senderId) return;
        this.dispatch(e.data.event);
      };
    }
    // Fallback (and belt-and-braces for browsers that silently drop messages).
    window.addEventListener('storage', (e) => {
      if (e.key !== FALLBACK_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { senderId: string; event: SyncEvent };
        if (parsed.senderId === this.senderId) return;
        this.dispatch(parsed.event);
      } catch {
        /* ignore malformed payloads */
      }
    });
  }

  post(event: SyncEvent): void {
    const payload = { senderId: this.senderId, event };
    this.channel?.postMessage(payload);
    try {
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
