import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const host = 'https://xcski.chrisizworski.com';
const indexNowKey = '56432a86fa1b11c29ac46b8a3a5cc095';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const sitemapFiles = (await walk(out))
  .filter(file => {
    const name = path.basename(file);
    return name === 'sitemap.xml' || name.endsWith('-sitemap.xml');
  })
  .filter(file => path.basename(file) !== 'sitemap-index.xml')
  .sort((a,b) => path.relative(out,a).localeCompare(path.relative(out,b)));

const expected = [
  'sitemap.xml',
  'forecast-sitemap.xml',
  'midwest/sitemap.xml',
  'minnesota/intent-sitemap.xml',
  'minnesota/sitemap.xml',
  'wisconsin/intent-sitemap.xml',
  'wisconsin/sitemap.xml'
].sort();
const found = sitemapFiles.map(file => path.relative(out,file).split(path.sep).join('/')).sort();
if (JSON.stringify(found) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected sitemap inventory. Expected ${expected.join(', ')}; found ${found.join(', ')}`);
}

const urls = new Set();
for (const file of sitemapFiles) {
  const xml = await readFile(file, 'utf8');
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = match[1].trim();
    if (!url.startsWith(`${host}/`) && url !== `${host}/`) throw new Error(`Non-canonical sitemap URL: ${url}`);
    urls.add(url);
  }
}
if (urls.size !== 222) throw new Error(`Expected 222 unique canonical XC URLs, found ${urls.size}`);

const today = new Date().toISOString().slice(0,10);
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles.map(file => {
  const rel = path.relative(out,file).split(path.sep).join('/');
  return `<sitemap><loc>${host}/${rel}</loc><lastmod>${today}</lastmod></sitemap>`;
}).join('\n')}\n</sitemapindex>\n`;
await writeFile(path.join(out,'sitemap-index.xml'), sitemapIndex);
await writeFile(path.join(out,`${indexNowKey}.txt`), `${indexNowKey}\n`);
await writeFile(path.join(out,'search-discovery.json'), JSON.stringify({
  version: 1,
  host,
  indexNowKey,
  keyLocation: `${host}/${indexNowKey}.txt`,
  sitemapIndex: `${host}/sitemap-index.xml`,
  sitemapCount: sitemapFiles.length,
  urlCount: urls.size,
  urls: [...urls].sort()
}, null, 2) + '\n');

const robotsPath = path.join(out,'robots.txt');
let robots = await readFile(robotsPath,'utf8');
const indexLine = `Sitemap: ${host}/sitemap-index.xml`;
if (!robots.includes(indexLine)) robots = `${robots.trimEnd()}\n${indexLine}\n`;
await writeFile(robotsPath, robots);

console.log(`Search discovery generated: ${sitemapFiles.length} child sitemaps, ${urls.size} canonical URLs, sitemap index + IndexNow key.`);
