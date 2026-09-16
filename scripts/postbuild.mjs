import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * GitHub Pages has no server-side routing: a deep link like
 * /w/x/events/y/rundown would 404. Pages serves 404.html for unknown paths,
 * so an exact copy of index.html there boots the SPA and the router takes over.
 */
const dist = resolve(import.meta.dirname, '..', 'dist');
await copyFile(resolve(dist, 'index.html'), resolve(dist, '404.html'));
console.log('postbuild: wrote dist/404.html (SPA fallback)');
