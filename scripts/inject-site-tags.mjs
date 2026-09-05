#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const MEASUREMENT_ID = 'G-Y5D2V2W7HN';
const ADSENSE_PUBLISHER_ID = 'ca-pub-8222782620788075';
const GA4_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${MEASUREMENT_ID}');
</script>`;
const ADSENSE_TAG = `<meta name="google-adsense-account" content="${ADSENSE_PUBLISHER_ID}">`;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) continue;

    const html = await readFile(fullPath, 'utf8');
    const tags = [];
    if (!html.includes(MEASUREMENT_ID)) tags.push(GA4_TAG);
    if (!html.includes(ADSENSE_PUBLISHER_ID)) tags.push(ADSENSE_TAG);
    if (!tags.length) continue;
    if (!/<\/head>/i.test(html)) throw new Error(`Missing </head> in ${path.relative(ROOT, fullPath)}`);
    await writeFile(fullPath, html.replace(/<\/head>/i, `${tags.join('\n')}\n</head>`));
  }
}

await walk(ROOT);
