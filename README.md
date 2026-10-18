# Atharva Bhorpe portfolio

Static Astro portfolio at https://atharvabhorpe.github.io/.
The editorial design uses a monochrome light/dark palette, serif headings and Satoshi body text.
The original fonts, portrait, project media, downloads and résumé retain their approved bytes.

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
Set `EVIDENCE_DIR` to choose the local screenshot directory. Raw captures remain local and ignored.
Approved regression fixtures live in `tests/fixtures/`. Tests do not read local research archives or agent skills.
Reviewed PR images live in `docs/pr/editorial-portfolio/`. Neither the fixtures nor these images enter the site build.

`npm test` includes the homepage, bottom navigation and same-page name-link regressions.
With a built preview running, run the focused figure and circular-navigation tests:

```sh
SITE_URL=http://127.0.0.1:4336 npm run test:figures
SITE_URL=http://127.0.0.1:4336 node tests/visuals.mjs
```

[Project figure documentation](docs/project-figures.md) describes the optional geometry generator and its public source dependency.
Normal installation, builds and tests use committed SVG data. They do not require the generator.

## Deployment

The workflow uses the official Astro GitHub Pages action and deploys only `dist/` from successful checks.
It runs on `main` pushes and manual dispatch. Repository Pages must use GitHub Actions, not the legacy branch build.
This is a user-site repository, so routes and assets use the site root without a repository-name prefix.
No custom domain, backend or authentication is configured.

For a local built preview:

```sh
npm run preview -- --port 4336
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
follow their parent tutorial in its documented step order. Other articles remain accessible through the same index.
The SO-ARM101 video is an existing external link, not IMU-project evidence.
Insertion and IMU photographs and recordings remain content gaps.
Their static diagrams describe simulation concepts, not measured results, live policy inference or manufacturer CAD.
No local article text or route is published without real source content.

If a recording uses non-square pixels, use its display aspect ratio for its poster and reserved dimensions.
Project sections use `<section class="panel prose">`. Navigation comes from actual Markdown headings.

## Design implementation

The homepage starts with Atharva’s name, role, biography and original portrait.
View projects, Resume and Contact follow the introduction. Resume and Contact stay adjacent on phones.
Projects, Areas of work, Writing and Contact follow the opening section. The circular navigation links to four project records.
The portrait sits beside the introduction on wider screens and below it on phones.
Project and article routes retain their original content, apart from the corrected UR5 model name.

Wide screens with a fine pointer retain desktop navigation.
Phones, touch tablets and screens below 1200px use a bottom dock with an upward-opening menu.
The theme icon stays beside the persistent name link and the compact Menu control.
It cycles Light → Dark → System, defaults to System for new visitors, and retains URL/storage preferences.
Sun, moon and monitor icons show the chosen mode. Tooltips, accessible names and status feedback describe it.

All routes use native document scrolling. Section navigation preserves browser Back/Forward, focus targets and
navigation clearance. The homepage name link reuses the shared smooth-scroll handler and respects reduced motion.
Other routes retain normal navigation home. The menu makes covered content inert while open and restores it on close.
Responsive mode changes transfer focus before they hide controls.
Technical media uses contain sizing. The RBot image stays at or below 675 CSS pixels.
The two schematic robot figures identify their illustrative scope. They do not replace hardware evidence.
The design adds no fictional projects, affiliations or measured outcomes.

`public/motion.js` owns the hero entrance and once-only project/writing reveals. Only offscreen leaf groups are
prepared. Restored content, rapid scrolling, resizing and reduced-motion changes finish those owned effects.
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
