import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes:true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

await cp(path.join(root,'xc-model-client.js'), path.join(out,'xc-model-client.js'));
let changed = 0;
for (const file of await walk(out)) {
  let html = await readFile(file,'utf8');
  if (!html.includes('/xc-intelligence.js') || html.includes('/xc-model-client.js')) continue;
  if (html.includes('<script src="/xc-forecast.js" defer></script>')) {
    html = html.replace('<script src="/xc-forecast.js" defer></script>', '<script src="/xc-forecast.js" defer></script><script src="/xc-model-client.js" defer></script>');
  } else {
    html = html.replace('<script src="/xc-intelligence.js" defer></script>', '<script src="/xc-intelligence.js" defer></script><script src="/xc-model-client.js" defer></script>');
  }
  await writeFile(file,html);
  changed++;
}
console.log(`XC model cache client injected into ${changed} generated HTML pages.`);
