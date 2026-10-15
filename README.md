# Atharva Bhorpe portfolio

Static Astro portfolio at https://atharvabhorpe.github.io/.
The approved Cabinet Grotesk/Satoshi typography and light/dark palette remain the design baseline.
The `design/modern-portfolio` branch implements one supplied design direction. The earlier request for three alternatives remains outside this delivery.

## Development and checks

Use Node.js 24 and npm 11.8.0. The minimum supported Node.js version is 22.12.

```sh
npm ci --ignore-scripts
npm run check
npx tsc --noEmit
npm run build
npm test
npm run audit
npm run dev
```

The browser regression uses isolated Chromium pages and closes its temporary foreground preview and browser.
If Chrome uses a different path, set `CHROME_BIN` before the test. The default is `/usr/bin/google-chrome`.
Set `EVIDENCE_DIR` to choose the local screenshot directory. Evidence is not a repository or deployment asset.

## Deployment

The workflow uses the official Astro GitHub Pages action and deploys only `dist/` from successful checks.
It runs on `main` pushes and manual dispatch. Repository Pages must use GitHub Actions, not the legacy branch build.
This is a user-site repository, so routes and assets use the site root without a repository-name prefix.
No custom domain, backend or authentication is configured.

For a local built preview:

```sh
npm run preview -- --port 4321
```

Do not serve the workspace directory publicly.

## Content

- `src/content/projects/*.md`: source-grounded project content.
- `src/content.config.ts`: Astro collections and optional demonstration metadata.
- `src/data/`: profile, navigation and published tutorial/video links.
- `src/components/`: shared navigation, contact and theme controls.
- `src/layouts/`: shared page, project and article shells.
- `public/`: approved project media, scripts, fonts and the approved redacted résumé.

Resume links use the approved two-page PDF. The AMR result is author-reported: the laptop-based robot carried 5kg at 0.3m/s.
The 10-metre track remains the documented test method. No independent benchmark reproduction is claimed.
The TRM video is a real silent recording. It has native controls and does not autoplay or loop.
The homepage opens with Atharva’s portrait and introduction, then presents four complete project records and three featured tutorials.
Each project owns its heading, media where available, objective, contribution, tools, scope and case-study link.
The writing index includes all nine published local articles and the existing simulation video. Companion guides
follow their parent tutorial in its documented step order; other articles remain accessible through the same index.
The SO-ARM101 video is an existing external link, not IMU-project evidence.
Insertion and IMU demonstration media remain optional content gaps. The site does not invent visuals.
No local article text or route is published without real source content.

If a recording uses non-square pixels, use its display aspect ratio for its poster and reserved dimensions.
Project sections use `<section class="panel prose">`. Navigation comes from actual Markdown headings.

## Design implementation

The October 15 remediation prioritizes a clear reading sequence after the earlier composition was rejected:
portrait and introduction, selected projects, tutorials and contact. The existing fonts, palette, routes and real
project materials remain the baseline. The sidebar stays sticky on desktop; smaller screens use the Menu disclosure.
The opening portrait sits beside the introduction on wider screens and above it on mobile. Tutorials occupy
separate columns or a compact stack. The former lower biography is folded into the opening introduction.
Project and article routes retain their original Markdown.

The theme icon sits to the right of the name in the desktop rail and beside Menu in the compact header.
It cycles Light → Dark → System, defaults to System for new visitors, and retains URL/storage preferences.
Sun, moon and monitor icons show the chosen mode; tooltips, accessible names and status feedback describe it.

All routes use native document scrolling. Section navigation preserves browser Back/Forward, focus targets and
header clearance. The menu makes covered content inert while open and restores it on close. Technical media uses
contain sizing; the RBot image stays at or below 675 CSS pixels. Projects without photographs remain text records.
No fictional projects, affiliations, measured outcomes or replacement hardware imagery were added.

`public/motion.js` owns the hero entrance and once-only project/writing reveals. Only offscreen leaf groups are
prepared; restored content, rapid scrolling, resizing and reduced-motion changes finish those owned effects.
CSS remains visible without JavaScript. Browser regressions cover all published article links, complete project
groups, non-overlapping tutorials, keyboard focus, clipboard fallbacks, font loading and native media playback.
The suite checks 15 routes, widths from 320 to 1505px in both themes, a 200% zoom equivalent, two rapid scroll
passes, restored scroll, resize during playback and reduced-motion changes. Local evidence stays outside deployment.

## Licenses and security

The previous template license remains in `LICENSE.txt`. [The notices](NOTICE.md) identify its scope and author.
The fonts retain their approved bytes and [Fontshare license](public/fonts/Fontshare-FFL.txt).
Use the fonts for this site, not as a redistributable font library.
[The security review](SECURITY.md) records a time-limited exception for an unreachable dependency-cache advisory.
Physical iOS/Safari and native touch behavior still need manual review.

## Official references

- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro GitHub Pages deployment](https://docs.astro.build/en/guides/deploy/github/)
