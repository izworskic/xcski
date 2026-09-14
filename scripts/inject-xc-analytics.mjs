import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const scriptTag = '<script src="/xc-analytics.js" defer></script>';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

await cp(path.join(root, 'xc-analytics.js'), path.join(out, 'xc-analytics.js'));
let changed = 0;
for (const file of await walk(out)) {
  let html = await readFile(file, 'utf8');
  if (html.includes('/xc-analytics.js')) continue;
  if (!html.includes('</body>')) throw new Error(`Missing </body>: ${path.relative(out, file)}`);
  html = html.replace('</body>', `${scriptTag}\n</body>`);
  await writeFile(file, html);
  changed++;
}
console.log(`XC decision-funnel analytics injected into ${changed} generated pages.`);
