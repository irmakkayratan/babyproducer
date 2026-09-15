/**
 * Fictional name generation.
 *
 * Given names are ordinary and international; surnames are assembled from
 * syllables so full names are invented rather than borrowed from real people.
 * Everything is driven by the scenario's seeded RNG, so the demo is identical
 * on every machine.
 */
import type { Rng } from '@/lib/rng';

const GIVEN = [
  'Amara', 'Noor', 'Jun', 'Elif', 'Mateo', 'Sofia', 'Kenji', 'Lucia', 'Idris', 'Freya',
  'Theo', 'Naomi', 'Arjun', 'Camille', 'Dario', 'Yara', 'Nils', 'Hana', 'Oscar', 'Leila',
  'Milo', 'Zara', 'Emil', 'Ines', 'Rafael', 'Anouk', 'Tomas', 'Marta', 'Kai', 'Selin',
  'Rune', 'Aiko', 'Bruno', 'Alma', 'Viktor', 'Nadia', 'Otto', 'Iris', 'Sami', 'Greta',
];

const SURNAME_PREFIX = [
  'Val', 'Mor', 'Brin', 'Cal', 'Dor', 'Fen', 'Hal', 'Kes', 'Lan', 'Mer',
  'Nov', 'Orse', 'Pell', 'Quen', 'Rav', 'Sol', 'Tarr', 'Ver', 'Wyn', 'Zeth',
];

const SURNAME_SUFFIX = [
  'ano', 'berg', 'court', 'dell', 'eau', 'field', 'grave', 'holm', 'ier', 'ley',
  'mont', 'ner', 'ova', 'quist', 'rand', 'son', 'ström', 'ton', 'vik', 'wall',
];

const BRAND_FIRST = [
  'Maison', 'Atelier', 'Studio', 'House of', 'Casa', 'Objet', 'Forme', 'Salon', 'Bureau', 'Cabinet',
];

const BRAND_SECOND = [
  'Verré', 'Nord', 'Lumen', 'Sable', 'Onyx', 'Aurelia', 'Cassis', 'Mirage', 'Sierra', 'Velour',
  'Halcyon', 'Numera', 'Petra', 'Solene', 'Tessero',
];

const OUTLET_SUFFIX = ['Review', 'Quarterly', 'Journal', 'Dispatch', 'Report', 'Edit', 'Weekly', 'Index'];

export function personName(rng: Rng): string {
  return `${rng.pick(GIVEN)} ${rng.pick(SURNAME_PREFIX)}${rng.pick(SURNAME_SUFFIX)}`;
}

export function handleFor(name: string, rng: Rng): string {
  const base = name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const style = rng.int(0, 2);
  if (style === 0) return `@${base.join('')}`;
  if (style === 1) return `@${base[0]}.${base[1]}`;
  return `@${base[0]}${rng.int(2, 99)}`;
}

export function brandName(rng: Rng): string {
  return `${rng.pick(BRAND_FIRST)} ${rng.pick(BRAND_SECOND)}`;
}

export function outletName(rng: Rng): string {
  return `${rng.pick(BRAND_SECOND)} ${rng.pick(OUTLET_SUFFIX)}`;
}
