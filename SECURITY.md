# Security scope

This site deploys static HTML, CSS, scripts and approved public media through GitHub Pages.
It has no authentication, server endpoints or shared application cache.
The build uses the npm lockfile. Dependency install hooks are disabled in CI and clean installation checks.
GitHub supplies HTTPS hosting. This site does not configure unsupported custom response headers.

## Temporary dependency advisory review

`npm audit` reports two high package flags for one underlying advisory:
[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), in `http-cache-semantics` through 4.2.0.
The advisory lists no patched version. The registry's latest version is 4.2.0 at this review.
The automatic Astro downgrade suggestion is incompatible with the content collections API and was not applied.

The vulnerable scenario requires client `max-stale` requests against a shared cache of private responses and session cookies.
Astro imports this dependency only in its remote-image build cache module.
That module uses `storable()` and `timeToLive()`, not client stale-cache request handling.
This project does not import `astro:assets` or the cache module. Its image/video files are local public assets.
No Node application or dependency cache runs on the deployed GitHub Pages site.
The reviewed runtime, build, test and deployment paths cannot serve another user's cached credentials through this dependency.

`npm run audit` runs native npm audit and rejects all other high/critical advisories.
The specific exception expires on 2026-11-03 and requires static output and no image/cache service imports.
Before that date, review an upstream patch or renew the reachability review.
If you add server endpoints, remote image services or private caching, remove this exception before deployment.
