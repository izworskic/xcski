import { readFileSync } from 'node:fs';

const fail = message => { throw new Error(message); };
const wi = readFileSync('dist/wisconsin/index.html','utf8');
const mn = readFileSync('dist/minnesota/index.html','utf8');
const mw = readFileSync('dist/midwest/index.html','utf8');
const stateCss = readFileSync('dist/state-xc.css','utf8');
const mwCss = readFileSync('dist/midwest-xc.css','utf8');
const forecastCss = readFileSync('dist/forecast-pages.css','utf8');
const mwJs = readFileSync('dist/midwest-xc.js','utf8');
const fpJs = readFileSync('dist/forecast-pages.js','utf8');

for (const [slug, html] of [['wisconsin',wi],['minnesota',mn]]) {
  const board = html.indexOf('<section class="state-panel"><div class="state-board-head">');
  const identity = html.indexOf('<section class="state-identity">');
  if (board < 0 || identity < 0 || board > identity) fail(`${slug} decision board must precede identity panels`);
  if (!html.includes('aria-label="Quick XC decisions"')) fail(`${slug} quick-decision nav missing`);
  if (!html.includes('id="state-live-board" aria-live="polite"')) fail(`${slug} live board accessibility missing`);
}

const mwBoard = mw.indexOf('<section class="midwest-panel">');
const mwSummary = mw.indexOf('<section id="midwest-state-summary"');
if (mwBoard < 0 || mwSummary < 0 || mwBoard > mwSummary) fail('Midwest live decision board must precede state summary cards');
if (!mw.includes('aria-label="Quick Midwest XC decisions"')) fail('Midwest quick-decision nav missing');
if (!mw.includes('id="midwest-board" aria-live="polite"')) fail('Midwest live board accessibility missing');

for (const file of [
  'dist/weekend/index.html','dist/storm-watch/index.html',
  'dist/wisconsin/weekend/index.html','dist/wisconsin/storm-watch/index.html',
  'dist/minnesota/weekend/index.html','dist/minnesota/storm-watch/index.html',
  'dist/midwest/weekend/index.html','dist/midwest/storm-watch/index.html'
]) {
  const html = readFileSync(file,'utf8');
  if (!html.includes('aria-label="Quick XC forecast decisions"')) fail(`forecast quick nav missing: ${file}`);
  if (!html.includes('class="forecast-panel forecast-coverage"')) fail(`crawlable forecast coverage missing: ${file}`);
  if (!html.includes('id="forecast-page-board" aria-live="polite"')) fail(`forecast live region missing: ${file}`);
  const links = (html.match(/class="forecast-coverage-grid"/g)||[]).length;
  if (links !== 1) fail(`forecast coverage grid malformed: ${file}`);
}

if (!stateCss.includes('production-audit-pass') || !stateCss.includes('min-height:44px')) fail('state mobile production UX pass missing');
if (!mwCss.includes('production-audit-pass') || !mwCss.includes('.midwest-decision span{display:none}')) fail('Midwest compact mobile UX missing');
if (!forecastCss.includes('production-audit-pass') || !forecastCss.includes('.forecast-coverage-grid')) fail('forecast mobile/static coverage styles missing');
if (!mwJs.includes('Promise.allSettled(ctx.states.map(loadState))')) fail('Midwest graceful state degradation missing');
if (!mwJs.includes("failedStates.join(', ')")) fail('Midwest partial-data disclosure missing');
if (!fpJs.includes('Promise.allSettled(ctx.groups.map(loadGroup))')) fail('forecast graceful group degradation missing');
if (!fpJs.includes("failedGroups.join(', ')")) fail('forecast partial-data disclosure missing');

console.log('Production XC audit: PASS — decision-first hierarchy, mobile compaction, crawlable forecast support, accessibility and partial-state resilience are enforced.');
