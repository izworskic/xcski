import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const html = await readFile(path.join(out, 'index.html'), 'utf8');
const trailsMatch = html.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if (!trailsMatch) throw new Error('TRAILS dataset missing for regional pages');
const trails = JSON.parse(trailsMatch[1]);
const registry = JSON.parse(await readFile(path.join(out, 'grooming-sources.json'), 'utf8'));

const defs = [
  { id:'grayling', slug:'grayling-roscommon' },
  { id:'gaylord', slug:'gaylord-pigeon-river' },
  { id:'traverse', slug:'traverse-leelanau-antrim' },
  { id:'cadillac', slug:'cadillac-benzie-manistee' },
  { id:'petoskey', slug:'petoskey-harbor-springs-boyne' },
  { id:'northeast', slug:'northeast-lower' },
  { id:'straits', slug:'straits-eastern-up' }
];

const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const strip = (s='') => String(s).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const js = value => JSON.stringify(value).replace(/</g,'\\u003c');

function cardHtml(id) {
  const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<article class="card" id="t-${safe}"[\\s\\S]*?<\\/article>`))?.[0] || '';
}

function regionData(def) {
  const safe = def.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = html.match(new RegExp(`<section class="region" id="${safe}">([\\s\\S]*?)<\\/section>`))?.[1];
  if (!section) throw new Error(`Region section missing: ${def.id}`);
  const title = strip(section.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] || def.id);
  const blurb = strip(section.match(/<p class="region-blurb">([\s\S]*?)<\/p>/)?.[1] || 'Northern Michigan cross-country ski trail systems.');
  const ids = [...section.matchAll(/<article class="card" id="t-([^"]+)"/g)].map(m => m[1]);
  const regionTrails = ids.map(id => {
    const trail = trails.find(t => t.id === id);
    if (!trail) throw new Error(`Trail ${id} missing from runtime dataset`);
    const card = cardHtml(id);
    const chips = [...card.matchAll(/<span class="chip[^"]*">([\s\S]*?)<\/span>/g)].map(m => strip(m[1]));
    return { ...trail, classic: chips.some(c => c.toLowerCase().includes('classic')) };
  });
  return { ...def, title, blurb, trails: regionTrails };
}

function page(region) {
  const url = `https://xcski.chrisizworski.com/regions/${region.slug}/`;
  const title = `${region.title} XC Ski Conditions | Michigan Nordic Board`;
  const description = `${region.title} cross-country ski conditions with live snow score, modeled surface timing, best time of day, confidence, and official status links.`.slice(0,158);
  const itemList = region.trails.map((trail, i) => ({ '@type':'ListItem', position:i+1, url:`https://xcski.chrisizworski.com/trails/${trail.id}/`, name:trail.name }));
  const schema = { '@context':'https://schema.org', '@type':'CollectionPage', name:title, url, description, mainEntity:{ '@type':'ItemList', numberOfItems:region.trails.length, itemListElement:itemList } };

  const cards = region.trails.map(trail => {
    const source = registry.sources?.[trail.id];
    const sourceLabel = source?.kind === 'live-grooming-platform' ? `${source.provider} live source linked` : source?.provider || 'Status source audited';
    return `<a class="region-trail" href="/trails/${trail.id}/"><strong>${esc(trail.name)}</strong><span>${esc(trail.town)} · ${trail.cat === 'groomed' ? 'groomed' : trail.cat === 'volunteer' ? 'managed / volunteer groomed' : 'backcountry / skier-tracked'} · ${esc(sourceLabel)}</span></a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}"><link rel="author" href="https://chrisizworski.com/chris-izworski/">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="https://xcski.chrisizworski.com/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="https://xcski.chrisizworski.com/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/region-page.css"><script type="application/ld+json">${js(schema)}</script>
</head><body>
<header class="region-top"><div class="region-wrap"><a href="/">← Michigan XC Ski Trails &amp; Nordic Board</a></div></header>
<main class="region-wrap">
<section class="region-hero"><p class="region-kicker">Regional Michigan Nordic Board</p><h1>${esc(region.title)}</h1><p>${esc(region.blurb)}</p></section>
<section class="region-panel"><div class="region-board-head"><div><h2>Best skiing signals today</h2><p id="region-freshness" class="region-freshness">Loading regional snow, surface, and confidence intelligence…</p></div><span id="region-board-state" class="region-state">Loading…</span></div>
<div class="region-filters"><button data-region-filter="all" aria-pressed="true">Best today</button><button data-region-filter="groomed" aria-pressed="false">Groomed</button><button data-region-filter="classic" aria-pressed="false">Classic</button><button data-region-filter="skate" aria-pressed="false">Skate</button><button data-region-filter="rentals" aria-pressed="false">Rentals</button></div>
<div id="region-board"><div class="region-empty">Building regional board…</div></div></section>
<section class="region-panel"><h2>${esc(region.trails.length)} trails in this region</h2><div class="region-trails">${cards}</div></section>
</main>
<footer class="region-footer"><div class="region-wrap">Regional board within <a href="/">Michigan XC Ski Trails</a>. Weather from Open-Meteo; grooming/status provenance stays separate from modeled snow and surface guidance.</div></footer>
<script>window.REGION_TRAILS=${js(region.trails)};</script><script src="/xc-intelligence.js" defer></script><script src="/region-page.js" defer></script>
</body></html>`;
}

const regions = defs.map(regionData);
for (const region of regions) {
  const dir = path.join(out, 'regions', region.slug);
  await mkdir(dir, { recursive:true });
  await writeFile(path.join(dir, 'index.html'), page(region));
}
await cp(path.join(root, 'region-page.js'), path.join(out, 'region-page.js'));
await cp(path.join(root, 'region-page.css'), path.join(out, 'region-page.css'));

let sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8');
const entries = regions.map(r => `<url><loc>https://xcski.chrisizworski.com/regions/${r.slug}/</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.85</priority></url>`).join('\n');
sitemap = sitemap.replace('</urlset>', `${entries}\n</urlset>`);
await writeFile(path.join(out, 'sitemap.xml'), sitemap);
console.log(`Generated ${regions.length} indexable regional XC intelligence boards.`);
