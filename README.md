# xcski.chrisizworski.com

Northern Michigan cross-country ski trails: map, trail detail, and live snow conditions.

## Provenance — read this first

This repository was **recovered from the running Vercel deployment**, not from an original
source tree. As of 2026-08-18 no source for this application existed anywhere in the connected
estate: not in `izworskic/chrisizworski-com`, not in any other repository on the account, and
not in the Vercel project, which had no Git integration and whose only deployment
(`dpl_8q22KqBGasvwotZYd9jTVkWYmqGM`, 2026-07-05) carried no commit SHA.

The files here were downloaded through the Vercel deployment-files API and base64-decoded.
`index.html` is **byte-identical to production** at recovery time:

    sha256  78283130a996cf4d3268fc519743435b52464b56e61f221ce1f34b6555c78c95

That hash is the guarantee this is the real application and not a reconstruction.

## What it is

A single self-contained `index.html` (about 103 KB) with three inline `<script>` blocks and
roughly 42 KB of inline JavaScript. No build step, no dependencies, no framework. Static hosting
is all it needs.

Live snow depth, new snowfall and trailhead temperature come from the Open-Meteo model API,
fetched client-side on page load. There is no server component and no API key.

## Deploying

Static. Serve the repository root. The production project is `xcski`
(`prj_t4K5iVJQDJAj7uW5VfvFuHtYe3qb`) on the `chrisizworski` Vercel team.

## Known caveats

- The trail list is embedded in `index.html`. Editing trails means editing that file.
- Outbound links to `fallcolor.chrisizworski.com` and `phenology.chrisizworski.com` were verified
  live on 2026-08-18. Fall colour has since also been published at
  `chrisizworski.com/fall-color/`, so the subdomain link is worth revisiting if that subdomain is
  ever retired.
- `b1be9ee40d264668af173e98e30188bf.txt` is an IndexNow key file.
