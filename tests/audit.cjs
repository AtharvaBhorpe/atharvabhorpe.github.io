// Native npm audit, with one time-limited exception for unreachable static-build cache code.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const result = spawnSync('npm', ['audit', '--json'], { encoding:'utf8' });
assert(!result.error, 'npm audit must run');
const report = JSON.parse(result.stdout);
assert(!report.error && report.metadata && report.vulnerabilities, 'npm audit must return a complete report');
const severe = Object.values(report.vulnerabilities).filter(v => ['high','critical'].includes(v.severity));
if (severe.length) {
  assert(Date.now() < Date.parse('2026-11-03'), 'The cache advisory exception needs a new review');
  assert(fs.readFileSync('astro.config.mjs','utf8').includes("output: 'static'"), 'Exception requires static output');
  function inspect(dir) {
    for (const file of fs.readdirSync(dir,{withFileTypes:true})) {
      const name=path.join(dir,file.name);
      if (file.isDirectory()) inspect(name);
      else assert(!/astro:assets|http-cache-semantics/.test(fs.readFileSync(name,'utf8')), 'Exception requires no image/cache service imports');
    }
  }
  inspect('src');
  for (const v of severe) assert(v.severity==='high' && (
    (v.name==='http-cache-semantics' && v.via.length===1 && v.via.every(a=>typeof a==='object' && a.url==='https://github.com/advisories/GHSA-ch52-4w7c-c8xp')) ||
    (v.name==='astro' && v.via.length===1 && v.via[0]==='http-cache-semantics' && report.vulnerabilities['http-cache-semantics'])
  ), `Unreviewed ${v.severity} advisory in ${v.name}`);
}
assert([0,1].includes(result.status), 'npm audit command failed');
console.log(`Audit gate passed: ${severe.length} known package flags for the documented unreachable cache advisory; no other high/critical findings.`);
