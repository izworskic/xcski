import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const indexPath = path.join(out, 'index.html');
const html = await readFile(indexPath, 'utf8');
const groomingRegistry = JSON.parse(await readFile(path.join(root, 'grooming-sources.json'), 'utf8'));
const groomingSources = groomingRegistry.sources || {};

const trailsMatch = html.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if (!trailsMatch) throw new Error('TRAILS dataset missing from built XC page');
const trails = JSON.parse(trailsMatch[1]);
if (!Array.isArray(trails) || trails.length !== 48) throw new Error('Expected 48 trails for detail-page generation');

const esc = (s = '') => String(s)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const strip = (s = '') => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const js = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function haversine(a, b) {
  const r = 3958.8;
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function cardData(trail) {
  const id = trail.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<article class="card" id="t-${id}"[\\s\\S]*?<\\/article>`));
  if (!match) throw new Error(`Trail card missing for ${trail.id}`);
  const card = match[0];
  const desc = strip(card.match(/<p class="desc">([\s\S]*?)<\/p>/)?.[1] || '');
  const official = card.match(/<a class="ext" href="([^"]+)"/)?.[1] || '';
  const chips = [...card.matchAll(/<span class="chip[^"]*">([\s\S]*?)<\/span>/g)].map(m => strip(m[1])).filter(Boolean);
  return { desc, official, chips };
}

function sourcePanel(source, official) {
  if (source) {
    return `<section class="trail-panel" style="margin-top:18px">
<h2>Grooming &amp; status sources</h2>
<p><strong>${esc(source.label || 'Live grooming source available')}</strong><br>${esc(source.provider || 'External grooming platform')}</p>
${source.url ? `<a class="trail-verify" href="${esc(source.url)}" target="_blank" rel="noopener">Open ${esc(source.provider || 'grooming source')}</a>` : ''}
<p style="margin-top:14px;font-size:.82rem;color:var(--muted)">This source is linked for verification, but its current values are not scraped or republished. Provider-authorized API access is required before live grooming values can enter the ranking engine.</p>
${official && source.url !== official ? `<p style="margin-top:10px"><a href="${esc(official)}" target="_blank" rel="noopener">Operator / land-manager page →</a></p>` : ''}
</section>`;
  }

  return `<section class="trail-panel" style="margin-top:18px">
<h2>Grooming &amp; status sources</h2>
<p><strong>Official status handoff</strong></p>
<p style="font-size:.86rem;color:var(--muted)">No machine-readable live grooming feed is currently registered for this trail. The weather score stays separate from grooming status.</p>
${official ? `<a class="trail-verify" href="${esc(official)}" target="_blank" rel="noopener">Check operator / land manager</a>` : ''}
</section>`;
}

function pageFor(trail, details, nearby, source) {
  const url = `https://xcski.chrisizworski.com/trails/${trail.id}/`;
  const title = `${trail.name} XC Ski Conditions | ${trail.town}, Michigan`;
  const rawDescription = `${trail.name} cross-country ski conditions near ${trail.town}, Michigan: live modeled snow depth, 72-hour snowfall, temperature, grooming-source provenance, and official status links.`;
  const description = rawDescription.slice(0, 158);
  const category = trail.cat === 'groomed' ? 'Groomed center' : trail.cat === 'volunteer' ? 'Volunteer groomed / managed' : 'Backcountry / skier-tracked';
  const chips = [...details.chips];
  if (!chips.includes(category)) chips.push(category);
  if (source?.provider) chips.push(`${source.provider} source linked`);

  const sameAs = [details.official, source?.url].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsActivityLocation',
        '@id': `${url}#trail`,
        name: trail.name,
        url,
        description: details.desc,
        address: { '@type': 'PostalAddress', addressLocality: trail.town, addressRegion: 'MI', addressCountry: 'US' },
        geo: { '@type': 'GeoCoordinates', latitude: trail.lat, longitude: trail.lon },
        sameAs: sameAs.length ? sameAs : undefined
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        dateModified: '2026-09-13',
        about: { '@id': `${url}#trail` },
        isPartOf: { '@id': 'https://xcski.chrisizworski.com/#website' },
        author: { '@id': 'https://chrisizworski.com/#person' }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="author" href="https://chrisizworski.com/chris-izworski/">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://xcski.chrisizworski.com/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="https://xcski.chrisizworski.com/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/trail-page.css">
<script type="application/ld+json">${js(schema)}</script>
</head>
<body>
<header class="trail-top"><div class="trail-wrap"><a href="/">← Michigan XC Ski Trails &amp; Nordic Board</a></div></header>
<main class="trail-wrap">
<section class="trail-hero">
<p class="trail-kicker">Michigan cross-country ski trail</p>
<h1>${esc(trail.name)}</h1>
<p class="trail-town">${esc(trail.town)}, Michigan</p>
<div class="trail-chips">${chips.map(chip => `<span class="trail-chip">${esc(chip)}</span>`).join('')}</div>
</section>

<div class="trail-layout">
<div>
<section class="trail-panel">
<h2>Live snow signal</h2>
<div id="trail-live" data-lat="${trail.lat}" data-lon="${trail.lon}">
<div class="trail-live-state"><span class="trail-score-label">Loading</span><strong>Checking this trailhead…</strong><p>Snow depth, the last 72 hours of snowfall, temperature, thaw/rain risk, and tomorrow's snow signal.</p></div>
</div>
</section>

<section class="trail-panel" style="margin-top:18px">
<h2>About ${esc(trail.name)}</h2>
<p>${esc(details.desc)}</p>
${details.official ? `<a class="trail-verify" href="${esc(details.official)}" target="_blank" rel="noopener">Verify official trail status</a>` : ''}
<p style="margin-top:14px;font-size:.82rem;color:var(--muted)">Modeled weather is a screening signal only. Grooming, opening, access, snowmaking, and surface conditions must be verified with the operator or land manager.</p>
</section>
</div>

<aside>
<section class="trail-panel">
<h2>Trail profile</h2>
<p><strong>System:</strong> ${esc(category)}</p>
<p><strong>Skate:</strong> ${trail.skate ? 'Yes / supported by the system profile' : 'Not listed as a skate system'}</p>
<p><strong>Rentals:</strong> ${trail.rentals ? 'Available / listed' : 'Not listed'}</p>
<p><strong>Lighted:</strong> ${trail.lit ? 'Yes' : 'No / not listed'}</p>
<p><strong>Grooming feed:</strong> ${source ? `${esc(source.provider)} source linked; live values not ingested` : 'No machine-readable feed registered'}</p>
</section>

${sourcePanel(source, details.official)}

<section class="trail-panel" style="margin-top:18px">
<h2>Nearby XC options</h2>
<div class="trail-related">
${nearby.map(n => `<a href="/trails/${n.id}/">${esc(n.name)} <small>· ${n.distance.toFixed(0)} mi</small></a>`).join('\n')}
</div>
</section>
</aside>
</div>
</main>

<footer class="trail-footer"><div class="trail-wrap">Part of the <a href="/">Michigan XC Ski Trails</a> field tool by <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski</a>. Live weather from Open-Meteo. Grooming-source links retain provider ownership and provenance.</div></footer>
<script src="/trail-page.js" defer></script>
</body>
</html>`;
}

for (const trail of trails) {
  const details = cardData(trail);
  const nearby = trails
    .filter(t => t.id !== trail.id)
    .map(t => ({ ...t, distance: haversine(trail, t) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const dir = path.join(out, 'trails', trail.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), pageFor(trail, details, nearby, groomingSources[trail.id] || null));
}

await cp(path.join(root, 'trail-page.js'), path.join(out, 'trail-page.js'));
await cp(path.join(root, 'trail-page.css'), path.join(out, 'trail-page.css'));

const sitemapUrls = [
  `<url><loc>https://xcski.chrisizworski.com/</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ...trails.map(t => `<url><loc>https://xcski.chrisizworski.com/trails/${t.id}/</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>
`;
await writeFile(path.join(out, 'sitemap.xml'), sitemap);

console.log(`Generated ${trails.length} indexable XC trail pages with grooming-source provenance and expanded sitemap.`);
