import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const before = process.argv.includes('--before');
const origin = process.env.SITE_URL || 'http://127.0.0.1:4336';
const out = resolve(process.env.EVIDENCE_DIR || '.evidence/visual-refinement', before ? 'before' : 'after');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
const destinations = ['tiny-recursive-model', 'cost-effective-amr', 'autonomous-insertion', 'imu-controlled-arm'].map(id => '#work-' + id);
const report = { captures: [], navigation: [], limitations: ['Chromium emulation does not replace physical Safari/iOS testing.'] };
const errors = [];
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const scale of [1, 4]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/?theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    for (const [name, selector] of [['orbit', '.practice-orbit']]) {
      const item = page.locator(selector);
      await item.scrollIntoViewIfNeeded();
      const png = await item.screenshot({ path: `${out}/${name}-${width}-${theme}-${scale}x.png` });
      assert(png.readUInt32BE(16) >= (await item.boundingBox()).width * scale - 4, 'Actual capture resolution');
      report.captures.push({ name, width, theme, scale, pixels: [png.readUInt32BE(16), png.readUInt32BE(20)] });
    }
    if (!before && scale === 1) {
      assert.deepEqual(await page.locator('.practice-orbit a').evaluateAll(es => es.map(e => e.getAttribute('href'))), destinations);
      assert.equal(await page.locator('[data-encoder]').count(), 0);
      assert.equal(await page.locator('.project-drawing .project-anatomy').count(), 2, 'Project-specific figures occupy the two original slots');
      assert.equal(await page.locator('.hero-drawing').count(), 0, 'Generic hero drawing intentionally removed');
      assert.equal(await page.locator('.practice-orbit svg').getAttribute('viewBox'), '0 0 500 500');
      const geometry = await page.locator('.practice-orbit svg').evaluate(svg => {
        const box = svg.getBoundingClientRect();
        return [...svg.querySelectorAll('path,circle,ellipse')].map(e => {
          const b = e.getBoundingClientRect();
          return { invalid: /NaN|Infinity/.test(e.getAttribute('d') || ''), outside: b.left < box.left || b.top < box.top || b.right > box.right || b.bottom > box.bottom };
        });
      });
      assert(geometry.every(p => !p.invalid && !p.outside), 'Finite geometry within the original viewBox');
      assert(await page.locator('.orbit-segment').evaluateAll(es => es.every((e,i) => {
        const end=e.getPointAtLength(e.getTotalLength()), next=es[(i+1)%es.length].getPointAtLength(0);
        return Math.hypot(end.x-next.x,end.y-next.y)<.01 && Math.abs(e.getTotalLength()-Math.PI*100)<.1;
      })), 'Four exact quarter-arcs meet without gaps');
      const contrast = await page.evaluate(() => {
        const lum = color => (color.startsWith('#') ? color.slice(1).match(/../g).map(c=>parseInt(c,16)) : color.match(/[\d.]+/g).slice(0,3).map(Number)).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
        return ['.orbit-segment'].map(selector => {
          const style=getComputedStyle(document.querySelector(selector));
          const a=lum(style.stroke), b=lum(getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim());
          return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
        });
      });
      assert(contrast.every(c=>c.ratio>=3),'Functional strokes meet 3:1');
      for (const [i, link] of (await page.locator('.practice-orbit a').all()).entries()) {
        await link.focus();
        assert(await link.evaluate(e => e.matches(':focus-visible')));
        const box = await link.boundingBox(); assert(box.width >= 44 && box.height >= 44);
        const stroke = await page.locator('.orbit-segment').nth(i).evaluate(e => getComputedStyle(e).stroke);
        assert.equal(stroke, await link.evaluate(e => getComputedStyle(e).color), 'Focused discipline highlights its arc');
        if (i === 0) await page.locator('.practice-orbit').screenshot({path:`${out}/orbit-${width}-${theme}-focus.png`});
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => '#' + document.activeElement.id), destinations[i]);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      report.navigation.push({ width, theme, nativeLinks: 4, focusAndHighlight: true, overflow: false, contrast });
    }
    await page.close();
  }
  if (!before) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, javaScriptEnabled });
      const page = await context.newPage(); await page.goto(`${origin}/?theme=light`);
      for (const [i, link] of (await page.locator('.practice-orbit a').all()).entries()) {
        await link.tap();
        assert.equal(await page.evaluate(() => location.hash), destinations[i]);
      }
      assert.equal(await page.locator('.hero-drawing svg').count(), 0);
      assert.equal(await page.locator('.hero-portrait img').count(), 1);
      await context.close();
    }
    const page = await browser.newPage({ reducedMotion: 'reduce' }); await page.goto(origin);
    assert.equal(await page.locator('.practice-orbit .orbit-segment').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    assert.equal(await page.locator('.practice-orbit svg').evaluateAll(es => es.flatMap(e => e.getAnimations({ subtree: true })).length), 0, 'No idle motion');
    await page.close();
    for (const file of ['src/components/EncoderFigure.astro', 'src/data/encoder-figure.json', 'src/lib/encoder.mjs', 'src/scripts/encoder.ts', 'src/styles/encoder.css', 'scripts/build-encoder.mjs', 'tests/encoder.mjs']) assert(!existsSync(file), `Removed unintended feature: ${file}`);
    assert(!readFileSync('dist/index.html', 'utf8').includes('data-encoder'));
    report.touch = true; report.noJS = true; report.reducedMotion = true;
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/verification.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`${before ? 'Before captures' : 'Visual checks'} passed: ${report.captures.length} images, ${report.navigation.length} navigation combinations.`);
} finally { await browser.close(); }
