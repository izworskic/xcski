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
  'plus a live statewide Michigan Nordic Board that compares snow, surface timing, and source confidence before you verify the operator or groomer report.'
);

const heroEnd = '</div></header>';
const boardMarkup = `
<section class="ski-board-shell" id="ski-board" aria-labelledby="ski-board-title">
  <div class="ski-board">
    <div class="ski-board-head">
      <div>
        <p class="ski-board-kicker">Michigan Nordic Board</p>
        <h2 id="ski-board-title">Where should I ski, and when?</h2>
        <p class="ski-board-intro">A statewide decision layer across all 61 trailheads. Snow score, modeled surface state, best time-of-day window, and source confidence stay separate so you can see what the engine knows and what still needs operator verification.</p>
      </div>
      <div class="ski-board-state" id="ski-board-state" role="status">Loading snow intelligence…</div>
    </div>
    <div class="ski-board-filters" aria-label="Nordic Board filters">
      <button type="button" data-board-filter="all" aria-pressed="true">Best today</button>
      <button type="button" data-board-filter="groomed" aria-pressed="false">Groomed</button>
      <button type="button" data-board-filter="classic" aria-pressed="false">Classic</button>
      <button type="button" data-board-filter="skate" aria-pressed="false">Skate</button>
      <button type="button" data-board-filter="rentals" aria-pressed="false">Rentals</button>
      <button type="button" data-board-filter="lighted" aria-pressed="false">Lighted</button>
      <button type="button" data-board-filter="backcountry" aria-pressed="false">Backcountry</button>
    </div>
    <p class="ski-board-filter-label" id="ski-board-filter-label">Comparing all 61 trailheads.</p>
    <p class="ski-board-freshness" id="ski-board-freshness">Loading current weather, surface timing, and source confidence…</p>
    <div class="ski-board-list" id="ski-board-list" aria-live="polite">
      <div class="ski-preseason"><strong>Building the board…</strong><p>Checking modeled base, fresh snow, rain, freeze/thaw, hourly temperature, wind, and today’s best surface window.</p></div>
    </div>
    <div class="ski-region-links" aria-label="Regional Nordic boards">
      <strong>Regional boards</strong>
      <a href="/regions/southeast-michigan/">Southeast Michigan</a>
      <a href="/regions/west-michigan/">West Michigan</a>
      <a href="/regions/grayling-roscommon/">Grayling + Roscommon</a>
      <a href="/regions/gaylord-pigeon-river/">Gaylord + Pigeon River</a>
      <a href="/regions/traverse-leelanau-antrim/">Traverse + Leelanau</a>
      <a href="/regions/cadillac-benzie-manistee/">Cadillac + Benzie</a>
      <a href="/regions/petoskey-harbor-springs-boyne/">Petoskey + Harbor Springs</a>
      <a href="/regions/northeast-lower/">Northeast Lower</a>
      <a href="/regions/straits-eastern-up/">Straits + Eastern UP</a>
      <a href="/regions/central-upper-peninsula/">Central UP</a>
      <a href="/regions/keweenaw-houghton-calumet/">Keweenaw</a>
      <a href="/regions/western-upper-peninsula/">Western UP</a>
    </div>
    <p class="ski-board-note"><strong>How to read this:</strong> the 0–100 number remains a modeled natural-snow score. Surface state and best time are hourly weather-derived. Confidence measures source quality, not trail quality. Grooming/open status still comes from the operator or land manager unless an authorized live feed is explicitly connected.</p>
  </div>
</section>`;
if (!html.includes(heroEnd)) throw new Error('XC decision-board hero end anchor missing');
html = html.replace(heroEnd, `${heroEnd}\n${boardMarkup}`);

const methodAnchor = '<section class="method" id="method">\n<h2>How the snow read works</h2>';
const methodIntro = `${methodAnchor}
<p><strong>The Michigan Nordic Board uses four independent layers.</strong> Snow score compares modeled base and recent snow. Surface intelligence looks at rain, overnight freeze, daytime thaw, hourly temperature and wind. Best-time modeling compares morning, midday and afternoon. Source confidence reports whether the trail has a live grooming platform, a direct operator page, a land-manager reference, or no current machine-readable feed. None of those layers silently substitutes for another.</p>`;
if (!html.includes(methodAnchor)) throw new Error('XC method anchor missing');
html = html.replace(methodAnchor, methodIntro);

if (!html.includes('</head>')) throw new Error('XC head end missing');
html = html.replace('</head>', '<link rel="stylesheet" href="/decision-board.css">\n</head>');

if (!html.includes('</body>')) throw new Error('XC body end missing');
html = html.replace('</body>', '<script src="/xc-intelligence.js" defer></script>\n<script src="/decision-board.js" defer></script>\n</body>');

html = html.replaceAll('"dateModified":"2026-08-18"', '"dateModified":"2026-09-13"');

await writeFile(indexPath, html);
await cp(path.join(root, 'xc-intelligence.js'), path.join(out, 'xc-intelligence.js'));
await cp(path.join(root, 'decision-board.js'), path.join(out, 'decision-board.js'));
await cp(path.join(root, 'decision-board.css'), path.join(out, 'decision-board.css'));

console.log('Added statewide Michigan Nordic Board with reusable snow, surface, timing, and source-confidence engine.');
