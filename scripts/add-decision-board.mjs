import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const indexPath = path.join(out, 'index.html');

let html = await readFile(indexPath, 'utf8');

const heroPhrase = 'plus a fast snow-cover screen before you verify the operator or groomer report.';
if (!html.includes(heroPhrase)) throw new Error('XC decision-board hero phrase anchor missing');
html = html.replace(
  heroPhrase,
  'plus a live Michigan Nordic Board that compares the strongest modeled natural-snow signals and shows the best available grooming-status source before you make the drive.'
);

const heroEnd = '</div></header>';
const boardMarkup = `
<section class="ski-board-shell" id="ski-board" aria-labelledby="ski-board-title">
  <div class="ski-board">
    <div class="ski-board-head">
      <div>
        <p class="ski-board-kicker">Michigan Nordic Board</p>
        <h2 id="ski-board-title">Where does the snow look best?</h2>
        <p class="ski-board-intro">A decision layer across all 48 trailheads. It ranks modeled natural-snow and weather signals, then shows the strongest grooming/status source we have registered for each trail. The snow score and the grooming source stay separate on purpose.</p>
      </div>
      <div class="ski-board-state" id="ski-board-state" role="status">Loading snow intelligence…</div>
    </div>
    <div class="ski-board-filters" aria-label="Nordic Board filters">
      <button type="button" data-board-filter="all" aria-pressed="true">Best snow signal</button>
      <button type="button" data-board-filter="groomed" aria-pressed="false">Groomed centers</button>
      <button type="button" data-board-filter="skate" aria-pressed="false">Skate</button>
      <button type="button" data-board-filter="rentals" aria-pressed="false">Rentals</button>
    </div>
    <p class="ski-board-filter-label" id="ski-board-filter-label">Comparing all 48 trailheads.</p>
    <p class="ski-board-freshness" id="ski-board-freshness">Loading current weather, snow signals, and grooming-source coverage…</p>
    <div class="ski-board-list" id="ski-board-list" aria-live="polite">
      <div class="ski-preseason"><strong>Building the board…</strong><p>Checking snow depth, the last 72 hours of snowfall, temperature, thaw risk, rain, tomorrow's snow signal, and available grooming/status sources.</p></div>
    </div>
    <p class="ski-board-note"><strong>What the score means:</strong> 0–100 is a comparative modeled natural-snow signal, not a grooming or skiability score. Grooming sources are displayed separately and never boost the score unless an authorized live-data integration is actually supplying current values.</p>
  </div>
</section>`;
if (!html.includes(heroEnd)) throw new Error('XC decision-board hero end anchor missing');
html = html.replace(heroEnd, `${heroEnd}\n${boardMarkup}`);

const methodAnchor = '<section class="method" id="method">\n<h2>How the snow read works</h2>';
const methodIntro = `${methodAnchor}
<p><strong>The Michigan Nordic Board is comparative, not authoritative.</strong> It combines modeled snow depth, snowfall during the previous 72 hours, current temperature, today's high and low, rain, and tomorrow's snow signal across all 48 trailheads. Its 0–100 number is a modeled natural-snow signal only. It does not claim a trail is open, groomed, safe, or skiable.</p>
<p><strong>Grooming data has a separate provenance layer.</strong> The tool keeps a registry of known operator and live grooming sources. When a provider requires approved API access, we link to the provider rather than scrape or republish its data. The source registry can accept authorized machine-readable feeds later without changing the snow model.</p>`;
if (!html.includes(methodAnchor)) throw new Error('XC method anchor missing');
html = html.replace(methodAnchor, methodIntro);

if (!html.includes('</head>')) throw new Error('XC head end missing');
html = html.replace('</head>', '<link rel="stylesheet" href="/decision-board.css">\n</head>');

if (!html.includes('</body>')) throw new Error('XC body end missing');
html = html.replace('</body>', '<script src="/decision-board.js" defer></script>\n</body>');

html = html.replaceAll('"dateModified":"2026-08-18"', '"dateModified":"2026-09-13"');

await writeFile(indexPath, html);
await cp(path.join(root, 'decision-board.js'), path.join(out, 'decision-board.js'));
await cp(path.join(root, 'decision-board.css'), path.join(out, 'decision-board.css'));
await cp(path.join(root, 'grooming-sources.json'), path.join(out, 'grooming-sources.json'));

console.log('Added Michigan Nordic Board decision and grooming-source layers.');
