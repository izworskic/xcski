import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const indexPath = path.join(out, 'index.html');
const expansion = JSON.parse(await readFile(path.join(root, 'statewide-expansion.json'), 'utf8'));
let html = await readFile(indexPath, 'utf8');

const trailsMatch = html.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if (!trailsMatch) throw new Error('Base TRAILS dataset missing before statewide expansion');
const baseTrails = JSON.parse(trailsMatch[1]);
if (baseTrails.length !== 48) throw new Error(`Expected 48 base trails before expansion, found ${baseTrails.length}`);
if (!Array.isArray(expansion.trails) || expansion.trails.length !== 13) throw new Error('Expected 13 statewide expansion trails');

const duplicate = expansion.trails.find(t => baseTrails.some(b => b.id === t.id));
if (duplicate) throw new Error(`Duplicate statewide trail id: ${duplicate.id}`);

const runtimeAdditions = expansion.trails.map(({ id, name, town, lat, lon, cat, lit, rentals, skate }) => ({ id, name, town, lat, lon, cat, lit, rentals, skate }));
const allTrails = [...baseTrails, ...runtimeAdditions];
html = html.replace(trailsMatch[0], `const TRAILS = ${JSON.stringify(allTrails)};\nconst COLORS`);

const esc = (s = '') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function card(trail) {
  return `<article class="card" id="t-${trail.id}" data-cat="${trail.cat}" data-lit="${trail.lit ? 1 : 0}" data-rentals="${trail.rentals ? 1 : 0}" data-skate="${trail.skate ? 1 : 0}">
<div class="card-top"><h3>${esc(trail.name)}</h3><span class="town">${esc(trail.town)}</span></div>
<div class="chips"><span class="chip chip-km">${esc(trail.km)}</span><span class="chip chip-style">${esc(trail.style)}</span><span class="chip chip-cat">${trail.cat === 'groomed' ? 'Groomed' : trail.cat === 'volunteer' ? 'Volunteer groomed' : 'Backcountry'}</span>${trail.rentals ? '<span class="chip chip-rentals">Rentals</span>' : ''}${trail.lit ? '<span class="chip">Lighted</span>' : ''}<span class="chip chip-fee">${esc(trail.fee)}</span></div>
<div class="ledger" data-id="${trail.id}"><span class="ledger-wait">Live snow loads in winter</span></div>
<p class="desc">${esc(trail.desc)}</p>
<div class="card-actions"><button class="map-btn" data-id="${trail.id}" type="button">Show on map</button><a class="ext" href="${esc(trail.official)}" target="_blank" rel="noopener">Verify trail status</a></div>
</article>`;
}

const statewideSections = expansion.regions.map(region => {
  const trails = expansion.trails.filter(t => t.region === region.id);
  if (!trails.length) throw new Error(`Statewide region has no trails: ${region.id}`);
  return `<section class="region" id="${region.id}"><div class="region-head"><h2>${esc(region.title)}</h2><p class="region-blurb">${esc(region.blurb)}</p></div><div class="grid">\n${trails.map(card).join('\n')}\n</div></section>`;
}).join('\n');

const methodAnchor = '<section class="method" id="method">';
if (!html.includes(methodAnchor)) throw new Error('Method section missing for statewide section insertion');
html = html.replace(methodAnchor, `${statewideSections}\n\n${methodAnchor}`);

const navClose = '</nav>';
const navStart = html.indexOf('<nav class="regions"');
const navEnd = html.indexOf(navClose, navStart);
if (navStart < 0 || navEnd < 0) throw new Error('Region nav missing');
const newNavLinks = expansion.regions.map(r => `<a href="#${r.id}">${esc(r.title)}</a>`).join('');
html = html.slice(0, navEnd) + newNavLinks + html.slice(navEnd);

html = html.replace('<h1>Northern Michigan<br>Cross Country Ski Trails</h1>', '<h1>Michigan<br>Cross Country Ski Trails</h1>');
html = html.replace(/<p class="thesis">[\s\S]*?<\/p>/, '<p class="thesis">Sixty-one cross-country ski systems across Michigan on one decision map: Southeast Michigan snowmaking, Lake Michigan snowbelts, northern Lower Peninsula classics, and the major Nordic networks of the Upper Peninsula, each with live weather intelligence and a direct status-source handoff.</p>');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Michigan Cross Country Ski Trails | Statewide Map and Live Snow Conditions</title>');
html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Statewide Michigan cross-country ski conditions for 61 trail systems, with live snow intelligence, surface timing, regional boards, maps, and official status sources.">');
html = html.replaceAll('Map of northern Michigan cross country ski trail systems', 'Map of Michigan cross country ski trail systems');
html = html.replace('>All 48</button>', '>All 61</button>');
html = html.replace('setView([45.05, -84.95], 7)', 'setView([44.8, -85.7], 6)');
html = html.replaceAll('Northern Michigan Cross Country Ski Trails', 'Michigan Cross Country Ski Trails');
html = html.replaceAll('northern Michigan cross country ski trail systems', 'Michigan cross country ski trail systems');

const schemaMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!schemaMatch) throw new Error('Primary JSON-LD missing');
const schema = JSON.parse(schemaMatch[1]);
const graph = schema['@graph'] || [];
const website = graph.find(n => n['@type'] === 'WebSite');
const webpage = graph.find(n => n['@type'] === 'WebPage');
const itemList = graph.find(n => n['@type'] === 'ItemList');
const breadcrumb = graph.find(n => n['@type'] === 'BreadcrumbList');
if (!website || !webpage || !itemList) throw new Error('Expected schema graph nodes missing');
website.name = 'Michigan Cross Country Ski Trails';
webpage.name = 'Michigan Cross Country Ski Trails Map and Live Conditions';
webpage.about = 'Cross country skiing in Michigan';
webpage.description = 'A statewide interactive map and guide to 61 Michigan cross-country ski trail systems with live snow intelligence, surface timing and official status-source handoffs.';
webpage.dateModified = '2026-09-13';
itemList.name = 'Michigan cross country ski trail systems';
const nextPos = itemList.itemListElement.length + 1;
itemList.itemListElement.push(...expansion.trails.map((trail, index) => ({
  '@type':'ListItem',
  position: nextPos + index,
  item:{
    '@type':'SportsActivityLocation',
    name:trail.name,
    address:{'@type':'PostalAddress',addressLocality:trail.town,addressRegion:'MI',addressCountry:'US'},
    geo:{'@type':'GeoCoordinates',latitude:trail.lat,longitude:trail.lon},
    description:trail.desc,
    url:trail.official
  }
})));
itemList.numberOfItems = itemList.itemListElement.length;
if (breadcrumb?.itemListElement?.[1]) breadcrumb.itemListElement[1].name = 'Michigan XC Ski Trails';
html = html.replace(schemaMatch[0], `<script type="application/ld+json">${JSON.stringify(schema)}</script>`);

await writeFile(indexPath, html);

const llmsPath = path.join(out, 'llms.txt');
let llms = await readFile(llmsPath, 'utf8');
llms = llms.replaceAll('Northern Michigan', 'Michigan').replaceAll('48 trail', '61 trail').replaceAll('48 cross country', '61 cross country');
await writeFile(llmsPath, llms);

console.log(`Expanded XC production dataset from ${baseTrails.length} to ${allTrails.length} statewide trails across ${expansion.regions.length + 7} regions.`);
