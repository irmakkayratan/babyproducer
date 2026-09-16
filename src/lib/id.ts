/**
 * ULID-style ids: lexicographically sortable by creation time, and safe to
 * generate on several offline devices at once.
 */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

function randomChars(len: number, random: () => number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ENCODING[Math.floor(random() * 32)];
  return out;
}

function encodeTime(now: number, len = 10): string {
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    out = ENCODING[mod] + out;
    now = (now - mod) / 32;
  }
  return out;
}

export function ulid(now: number = Date.now(), random: () => number = Math.random): string {
  return encodeTime(now) + randomChars(16, random);
}

/**
 * A fixed timestamp for seeded data.
 *
 * Demo ids are derived entirely from the scenario seed, so a reset rebuilds
 * the same records in the same order — which is what makes screenshots and
 * tests stable.
 */
export const SEED_EPOCH = Date.UTC(2027, 0, 1);

/** Deterministic id factory bound to a seeded RNG. */
export function seededIds(random: () => number): () => string {
  let counter = 0;
  return () => ulid(SEED_EPOCH + counter++, random);
}

/** Short, stable, URL-safe token for badge QR codes. */
export function qrToken(random: () => number = Math.random): string {
  return randomChars(12, random);
}

/** Per-browser identifier used for check-in audit trails. Never leaves the device. */
export function deviceId(): string {
  const key = 'atelier.deviceId';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = ulid();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return 'ephemeral';
  }
}
