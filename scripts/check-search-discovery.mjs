import { readFileSync } from 'node:fs';

const fail = message => { throw new Error(message); };
const index = readFileSync('dist/sitemap-index.xml','utf8');
const robots = readFileSync('dist/robots.txt','utf8');
const discovery = JSON.parse(readFileSync('dist/search-discovery.json','utf8'));
const submit = readFileSync('scripts/submit-indexnow.mjs','utf8');
const keyFile = `dist/${discovery.indexNowKey}.txt`;
const key = readFileSync(keyFile,'utf8').trim();

const expectedSitemaps = [
  'https://xcski.chrisizworski.com/sitemap.xml',
  'https://xcski.chrisizworski.com/forecast-sitemap.xml',
  'https://xcski.chrisizworski.com/midwest/sitemap.xml',
  'https://xcski.chrisizworski.com/minnesota/intent-sitemap.xml',
  'https://xcski.chrisizworski.com/minnesota/sitemap.xml',
  'https://xcski.chrisizworski.com/wisconsin/intent-sitemap.xml',
  'https://xcski.chrisizworski.com/wisconsin/sitemap.xml'
];
if ((index.match(/<sitemap>/g)||[]).length !== 7) fail('sitemap index must contain 7 child sitemaps');
for (const url of expectedSitemaps) if (!index.includes(`<loc>${url}</loc>`)) fail(`sitemap index missing ${url}`);
if (!robots.includes('Sitemap: https://xcski.chrisizworski.com/sitemap-index.xml')) fail('sitemap index not advertised in robots');
if (discovery.urlCount !== 222 || discovery.urls.length !== 222) fail(`expected 222 canonical URLs, got ${discovery.urls.length}`);
if (new Set(discovery.urls).size !== discovery.urls.length) fail('duplicate IndexNow URLs detected');
if (discovery.urls.some(url => !url.startsWith('https://xcski.chrisizworski.com/'))) fail('non-canonical IndexNow URL detected');
if (key !== discovery.indexNowKey) fail('IndexNow key file does not match discovery manifest');
if (discovery.keyLocation !== `https://xcski.chrisizworski.com/${discovery.indexNowKey}.txt`) fail('IndexNow key location malformed');
if (!submit.includes("process.env.VERCEL_ENV") || !submit.includes("env !== 'production'")) fail('IndexNow production-only guard missing');
if (!submit.includes('https://api.indexnow.org/IndexNow')) fail('IndexNow endpoint missing');
if (!submit.includes('keyLocation: discovery.keyLocation')) fail('IndexNow keyLocation missing');
if (!submit.includes('urlList: discovery.urls')) fail('IndexNow canonical URL list missing');

console.log('Search discovery: PASS — 7-sitemap index, 222 canonical URLs, robots discovery, IndexNow key verification, and production-only bulk submission.');
