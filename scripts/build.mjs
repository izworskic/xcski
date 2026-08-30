import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const source = await readFile(path.join(root, 'index.html'), 'utf8');
let html = source;

const replacements = [
  ['plus a plain read on whether it is worth the drive.', 'plus a fast snow-cover screen before you verify the operator or groomer report.'],
  ['role="application" aria-label="Map of northern Michigan cross country ski trail systems"', 'role="region" aria-label="Map of northern Michigan cross country ski trail systems"'],
  ['>Trail info</a>', '>Verify trail status</a>'],
  ['<p>Every badge on this page is computed, not written. On each visit the page pulls the Open-Meteo model analysis for all 48 trailheads in a single request: snow depth on the ground, snowfall over the past three days, and current temperature. Simple thresholds turn those numbers into a read. Under about 2 inches of depth there is nothing to ski. From 2 to 5 inches, groomed corridors with smooth bases may be skiable on rock skis. From 5 to 10 the volunteer systems come alive, past 10 everything skis well, and past 18 the backcountry opens up too. Warm afternoons flag a thaw, hard cold gets a warning, and a big three day total flags a storm cycle where grooming may lag the snowfall.</p>', '<p>Every badge on this page is computed, not written. On each visit the page pulls Open-Meteo model analysis for all 48 trailheads in one request: modeled snow depth, snowfall over the past three days, and current temperature. The thresholds are a snow-cover screen only: under 2 inches is very low modeled cover, 2 to 5 is low, 5 to 10 is moderate, 10 to 18 is substantial, and 18 or more is deep. Those signals do not determine whether a trail is open, groomed, safe, or worth a long drive. Snowmaking, packing, thaw and freeze cycles, wind, ground cover, and grooming timing can all differ from the model. Use the live numbers to narrow the choices, then verify the trail operator or land manager before you go.</p>'],
  ["<p>Model snow depth is a regional signal, not a grooming report. The centers that make snow, Forbush Corner and Cross Country Ski Headquarters, regularly ski when the model shows almost nothing on the ground. Check the operator's own report before a long drive, and put money in the donation box where volunteers groom.</p>", "<p>Model snow depth is a regional signal, not a grooming report. Snowmaking can make local conditions diverge sharply from modeled natural snow at centers such as Forbush Corner and Cross Country Ski Headquarters. Check the operator's own report before a long drive, and put money in the donation box where volunteers groom.</p>"],
  ['if (depth < 2) return ["none", "No base. Nothing to ski yet."];', 'if (depth < 2) return ["none", "Very low modeled snow cover. Verify the operator before making the drive."];'],
  ['if (depth < 5) { cls = "thin"; txt = "Thin cover. Rock skis on groomed corridors only."; }', 'if (depth < 5) { cls = "thin"; txt = "Low modeled snow cover. Snowmaking or packed base may differ; verify locally."; }'],
  ['else if (depth < 10) { cls = "fair"; txt = "Fair base. Groomed systems ski, backcountry is marginal."; }', 'else if (depth < 10) { cls = "fair"; txt = "Moderate modeled snow cover. Trail conditions can vary sharply; verify grooming locally."; }'],
  ['else if (depth < 18) { cls = "good"; txt = "Good base. Most systems skiing well."; }', 'else if (depth < 18) { cls = "good"; txt = "Substantial modeled snow cover. This is not a grooming report; verify trail status locally."; }'],
  ['else { cls = "deep"; txt = "Deep base. Everything skis, backcountry included."; }', 'else { cls = "deep"; txt = "Deep modeled snow cover. Groomed status and backcountry conditions still require local verification."; }'],
  ['if (new3 >= 6) txt += " Storm cycle, grooming may lag.";', 'if (new3 >= 6) txt += " Recent snowfall may change grooming timing.";'],
  ['else if (new3 >= 3) txt += " Fresh snow on top.";', 'else if (new3 >= 3) txt += " Recent modeled snowfall.";'],
  ['st.textContent = "Region: " + (cls === "off" ? "off season, season typically runs late December to mid March" : txt.toLowerCase() + " Median trailhead base " + med.toFixed(1) + \'".\');', 'st.textContent = cls === "off" ? "Region: off season; live snow returns with winter." : "Region modeled median snow depth: " + med.toFixed(1) + " in. Use this to screen options, then verify the operator or groomer report. Updated " + now.toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit", timeZone:"America/Detroit"}) + " ET via Open-Meteo.";'],
  ['"dateModified":"2026-07-05"', '"dateModified":"2026-08-18"']
];

for (const [from, to] of replacements) {
  if (!html.includes(from)) throw new Error(`Expected source fragment missing: ${from.slice(0, 120)}`);
  html = html.replaceAll(from, to);
}

const statusAnchor = '<p class="status" id="region-status"><span class="dot"></span><span id="status-text">Checking regional snow...</span></p>';
const trustNote = '<p style="max-width:760px;margin:12px auto 0;font-size:.86rem;line-height:1.45;color:#52606a"><strong>Live snow is a screening signal.</strong> Open-Meteo modeled snow depth, recent snowfall, and temperature do not confirm grooming, opening, access, or local trail quality. Use each trail\'s <em>Verify trail status</em> link before driving.</p>';
if (!html.includes(statusAnchor)) throw new Error('Regional status anchor missing');
html = html.replace(statusAnchor, `${statusAnchor}\n${trustNote}`);

const footerAnchor = '<p class="net">More Michigan field tools:';
if (!html.includes(footerAnchor)) throw new Error('Footer network anchor missing');
html = html.replace(footerAnchor, '<p><a href="https://chrisizworski.com/michigan-cross-country-skiing/">Compare flagship Michigan XC trails and planning sources</a></p>\n' + footerAnchor);

await writeFile(path.join(out, 'index.html'), html);

for (const file of ['favicon.svg','apple-touch-icon.png','og.png','robots.txt','sitemap.xml','b1be9ee40d264668af173e98e30188bf.txt']) {
  await cp(path.join(root, file), path.join(out, file));
}

let llms = await readFile(path.join(root, 'llms.txt'), 'utf8');
llms = llms.replace('with a plain language skiability read derived from fixed thresholds rather than generated text.', 'with a plain-language modeled snow-cover screen. Model signals never claim a trail is groomed, open, or skiable; operator or land-manager reports remain the final trail-status source.');
await writeFile(path.join(out, 'llms.txt'), llms);

console.log('Built hardened static XC site in dist/.');
