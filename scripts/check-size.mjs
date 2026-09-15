import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

/** Performance budget, enforced in CI: the shell must stay small. */
const BUDGET_KB = 250;
const dir = resolve(import.meta.dirname, '..', 'dist', 'assets');

const files = await readdir(dir);
let total = 0;
for (const file of files.filter((f) => f.endsWith('.js'))) {
  const gz = gzipSync(await readFile(resolve(dir, file))).length;
  total += gz;
  console.log(`${file.padEnd(40)} ${(gz / 1024).toFixed(1)} KB gz`);
}

const totalKb = total / 1024;
console.log(`\nTotal eager JS: ${totalKb.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`);
if (totalKb > BUDGET_KB) {
  console.error(`✗ Bundle budget exceeded by ${(totalKb - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
console.log('✓ Within budget');
