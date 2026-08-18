# xcski.chrisizworski.com

Northern Michigan cross-country ski trails: map, trail detail, and live snow conditions.

## Provenance — read this first

This repository was **recovered from the running Vercel deployment**, not from an original
source tree. As of 2026-08-18 no source for this application existed anywhere in the connected
estate: not in `izworskic/chrisizworski-com`, not in any other repository on the account, and
not in the Vercel project, which had no Git integration and whose only deployment
(`dpl_8q22KqBGasvwotZYd9jTVkWYmqGM`, 2026-07-05) carried no commit SHA.

The files here were downloaded through the Vercel deployment-files API and base64-decoded.
`index.html` is **byte-identical to production at recovery time**:

    sha256  78283130a996cf4d3268fc519743435b52464b56e61f221ce1f34b6555c78c95

That hash is the guarantee this is the real application and not a reconstruction. The recovered
`index.html` is intentionally retained as the source-of-record rather than rewritten in place.

## What it is

The recovered application is a single self-contained `index.html` (about 103 KB) with three
inline `<script>` blocks and roughly 42 KB of inline JavaScript. Live snow depth, new snowfall
and trailhead temperature come from the Open-Meteo model API, fetched client-side on page load.
There is no server component and no API key.

## 2026-27 production build

Production is still static, but Vercel now runs a deterministic zero-dependency build before
serving it:

1. `scripts/build.mjs` reads the recovered source-of-record.
2. It generates `dist/index.html` with the 2026-27 trust and usability hardening.
3. `scripts/check-build.mjs` verifies the canonical, all 48 trail cards, operator/land-manager
   verification links, sitemap ownership, privacy boundary, and removal of unsupported
   model-derived skiability claims.
4. `vercel.json` runs `npm test` as the build command and serves `dist/` only if the checks pass.

This keeps the recovered artifact auditable while making the deploy output maintainable.

## Operating boundary

Open-Meteo snow depth, recent snowfall and temperature are **screening signals only**. They may
help a skier narrow choices, but they must never be presented as proof that a trail is open,
groomed, safe or skiable. Snowmaking, packing, thaw/freeze, wind, local ground cover and grooming
timing can all diverge from the model. Every trail retains an operator or land-manager link as
the final status source.

The main-domain planning/search authority remains:
`https://chrisizworski.com/michigan-cross-country-skiing/`

The live conditions owner remains:
`https://xcski.chrisizworski.com/`

## Deploying

Vercel builds are now being created from this GitHub repository. Do not treat a GitHub merge as
proof that the custom domain changed until the post-merge Vercel status is green and the custom
domain is verified. The historical production project recovered by Claude was `xcski`
(`prj_t4K5iVJQDJAj7uW5VfvFuHtYe3qb`); current GitHub status checks are the operational deployment
evidence available through the connected estate.

## Known caveats

- The 48-trail source list is embedded in `index.html`. The build hardens presentation and trust
  language; it does not invent or silently rewrite trail facts.
- Outbound links to `fallcolor.chrisizworski.com` and `phenology.chrisizworski.com` were verified
  live on 2026-08-18. Fall color also exists at `chrisizworski.com/fall-color/`.
- `b1be9ee40d264668af173e98e30188bf.txt` is an IndexNow key file.
