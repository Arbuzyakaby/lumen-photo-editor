// Inlines css/style.css and js/*.js into index.html so the app stays a single self-contained file.
// Usage: node build.mjs   (edit the sources, never the inlined copies)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const SCRIPTS = ['js/engine.js', 'js/scenes.js', 'js/brush.js', 'js/analysis.js', 'js/app.js'];
const read = f => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n').trimEnd();

export function build(html) {
  html = html.replace(/\r\n/g, '\n');
  // Function replacers: a string replacement would expand `$&`/`$'` sequences found in the sources.
  html = html.replace(/<style>[\s\S]*?<\/style>/, () => `<style>\n${read('css/style.css')}\n</style>`);
  let i = 0;
  html = html.replace(/<script>[\s\S]*?<\/script>/g, () => {
    if (i >= SCRIPTS.length) throw new Error('index.html has more inline <script> blocks than sources');
    return `<script>\n${read(SCRIPTS[i++])}\n</script>`;
  });
  if (i !== SCRIPTS.length) throw new Error(`expected ${SCRIPTS.length} inline <script> blocks, found ${i}`);
  return html;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(ROOT, 'index.html');
  writeFileSync(file, build(readFileSync(file, 'utf8')));
  console.log('index.html rebuilt');
}
