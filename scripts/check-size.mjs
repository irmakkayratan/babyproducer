import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

/**
 * Performance budget, enforced in CI.
 *
 * Only the eager shell counts: the entry chunk plus everything it statically
 * imports. Route chunks that load on demand (charts, canvases, the scanner)
 * are reported but not charged against the budget — that is the whole point of
 * splitting them out.
 */
const BUDGET_KB = 250;
const dist = resolve(import.meta.dirname, '..', 'dist');
const manifest = JSON.parse(await readFile(resolve(dist, '.vite', 'manifest.json'), 'utf8'));

const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
if (!entry) {
  console.error('No entry chunk in the build manifest');
  process.exit(1);
}

const eager = new Set();
const queue = [entry.file];
const byFile = new Map(Object.values(manifest).map((chunk) => [chunk.file, chunk]));

while (queue.length) {
  const file = queue.pop();
  if (eager.has(file)) continue;
  eager.add(file);
  const chunk = byFile.get(file) ?? manifest[file];
  for (const importKey of chunk?.imports ?? []) {
    const imported = manifest[importKey];
    if (imported) queue.push(imported.file);
  }
}

async function gzipKb(file) {
  await stat(resolve(dist, file));
  return gzipSync(await readFile(resolve(dist, file))).length / 1024;
}

let total = 0;
for (const file of [...eager].sort()) {
  const kb = await gzipKb(file);
  total += kb;
  console.log(`eager   ${file.padEnd(44)} ${kb.toFixed(1)} KB gz`);
}

const lazy = Object.values(manifest)
  .map((chunk) => chunk.file)
  .filter((file) => file.endsWith('.js') && !eager.has(file));
for (const file of [...new Set(lazy)].sort()) {
  console.log(`lazy    ${file.padEnd(44)} ${(await gzipKb(file)).toFixed(1)} KB gz`);
}

console.log(`\nEager shell: ${total.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) {
  console.error(`✗ Bundle budget exceeded by ${(total - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
console.log('✓ Within budget');
