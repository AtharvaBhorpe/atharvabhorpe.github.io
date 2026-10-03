# Atharva Bhorpe portfolio

Static Astro portfolio at https://atharvabhorpe.github.io/.
The approved Cabinet Grotesk/Satoshi typography, palette and responsive navigation remain the design baseline.

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

The browser regression uses one isolated Chrome page and closes its temporary preview and browser.
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
- `src/layouts/`: home/project conventions and an unused article shell.
- `public/`: approved project media, scripts, fonts and the approved redacted résumé.

Resume links use the approved two-page PDF. The AMR result is author-reported: the laptop-based robot carried 5kg at 0.3m/s.
The 10-metre track remains the documented test method. No independent benchmark reproduction is claimed.
The TRM video is a real silent recording. It has native controls and does not autoplay or loop.
Homepage thumbnails are static images. The SO-ARM101 video is an official external link, not IMU-project evidence.
Insertion and IMU demonstration media remain optional content gaps. The site does not invent visuals.
No local article text or route is published without real source content.

If a recording uses non-square pixels, use its display aspect ratio for its poster and reserved dimensions.
Project sections use `<section class="panel prose">`. Navigation comes from actual Markdown headings.

## Licenses and security

The previous template license remains in `LICENSE.txt`. [The notices](NOTICE.md) identify its scope and author.
The fonts retain their approved bytes and [Fontshare license](public/fonts/Fontshare-FFL.txt).
Use the fonts for this site, not as a redistributable font library.
[The security review](SECURITY.md) records a time-limited exception for an unreachable dependency-cache advisory.
Physical iOS/Safari and native touch behavior still need manual review.

## Official references

- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro GitHub Pages deployment](https://docs.astro.build/en/guides/deploy/github/)
