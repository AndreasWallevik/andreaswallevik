import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const base = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const pages = [];

function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path);
    else if (name.endsWith('.html')) pages.push(path);
  }
}

collect(root);
const errors = [];

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    const pathname = url.split(/[?#]/)[0];
    if (base && pathname !== base && !pathname.startsWith(`${base}/`)) {
      errors.push(`${relative(root, page)}: path outside base: ${url}`);
      continue;
    }
    const local = base ? pathname.slice(base.length) : pathname;
    const target = join(root, local.replace(/^\//, ''));
    if (!existsSync(target) && !existsSync(join(target, 'index.html'))) {
      errors.push(`${relative(root, page)}: missing ${url}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked internal links and assets in ${pages.length} HTML pages.`);
}
