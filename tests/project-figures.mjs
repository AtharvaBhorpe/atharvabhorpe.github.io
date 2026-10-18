import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const before = process.argv.includes('--before');
const out = resolve(process.env.EVIDENCE_DIR || '.evidence/project-figures', before ? 'before' : 'after');
const origin = process.env.SITE_URL || 'http://127.0.0.1:4336';
const ids = ['imu-controlled-arm', 'autonomous-insertion'];
mkdirSync(out, { recursive: true });
const captures = [], errors = [], payloads = [], contrasts = [];
if (!before) {
  const data = JSON.parse(readFileSync('src/data/project-figures.json', 'utf8'));
  for (const [kind, figure] of Object.entries(data)) {
    assert(figure.solids >= 40 && figure.solids <= 80);
    assert.equal(figure.joints, kind === 'imu' ? 7 : 6);
    assert.equal((figure.svg.match(/data-joint=/g) || []).length, figure.joints);
    assert.equal(figure.parts.length, figure.solids);
    const required = kind === 'imu'
      ? ['controller.esp32-board','controller.mpu6050-chip','controller.encoder-knob','controller.ir-board']
      : ['connector.shell','connector.mating-tip','socket.bottom','fixture.upright','stand.fixture-foot'];
    for (const part of required) assert(figure.parts.includes(part), `${kind}: ${part}`);
    assert(!/NaN|Infinity|<script|<animate|data-free/.test(figure.svg));
    const bytes = Buffer.byteLength(figure.svg), gzip = gzipSync(figure.svg).length;
    assert(gzip < 60_000, 'Compressed SVG budget per figure');
    payloads.push({ kind, bytes, gzip });
  }
  // tests/homepage.cjs protects the approved stylesheet, orbit markup and figure bytes.
  for(const file of ['src/data/site.ts','src/content/projects/autonomous-insertion.md','src/components/ProjectAnatomy.astro']) {
    assert(readFileSync(file,'utf8').includes('UR5e'));
    assert(!/\bUR5\b/.test(readFileSync(file,'utf8')),'Authoritative UR5e identity');
  }
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
try {
  for (const width of [320, 393, 1440]) for (const theme of ['light', 'dark']) for (const scale of [1, 4]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/?theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => devicePixelRatio), scale);
    for (const id of ids) {
      const record = page.locator(`#work-${id}`), figure = record.locator('.project-drawing');
      await figure.scrollIntoViewIfNeeded();
      const png = await figure.screenshot({ path: `${out}/${id}-${width}-${theme}-${scale}x.png` });
      const box = await figure.boundingBox();
      // Locator screenshots round both crop edges outward to CSS pixels.
      assert(Math.abs(png.readUInt32BE(16) - box.width * scale) <= 2 * scale);
      assert(Math.abs(png.readUInt32BE(20) - box.height * scale) <= 2 * scale);
      captures.push({ id, width, theme, scale, pixels: [png.readUInt32BE(16), png.readUInt32BE(20)] });
      if (scale === 1 && width !== 320) {
        const height = Math.max(1000, Math.ceil((await record.boundingBox()).height) + 160);
        await page.setViewportSize({width,height});
        await record.evaluate(el => scrollTo({top:scrollY+el.getBoundingClientRect().top-100,behavior:'instant'}));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await record.screenshot({ path: `${out}/${id}-${width}-${theme}-record.png` });
        await page.setViewportSize({width,height:1000});
      }
      if (!before && scale === 1) {
        const svg = figure.locator('.project-anatomy');
        assert.equal(await svg.count(), 1);
        assert.equal(await svg.getAttribute('role'), 'img');
        assert(await svg.locator('title').textContent());
        assert.match(await svg.locator('desc').textContent(), /Illustrative/);
        const bounds = await svg.evaluate(el => {
          const b = el.getBoundingClientRect();
          return [...el.querySelectorAll('[data-part]')].every(p => {
            const q = p.getBoundingClientRect();
            return q.width > 0 && q.height > 0 && q.left >= b.left-1 && q.top >= b.top-1 && q.right <= b.right+1 && q.bottom <= b.bottom+1;
          });
        });
        assert(bounds, 'Every solid stays inside the figure viewBox');
        const contrast = await svg.evaluate(el => {
          const luminance = color => color.match(/[\d.]+/g).slice(0,3).map(Number)
            .map(v => v/255 <= .04045 ? v/255/12.92 : ((v/255+.055)/1.055)**2.4)
            .reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
          let surface = el.closest('.project-drawing');
          while (surface.parentElement && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
          const background = luminance(getComputedStyle(surface).backgroundColor);
          return Math.min(...[...el.querySelectorAll('.iso-edge')].map(edge => {
            const stroke = luminance(getComputedStyle(edge).stroke);
            return (Math.max(stroke,background)+.05)/(Math.min(stroke,background)+.05);
          }));
        });
        assert(Number.isFinite(contrast) && contrast >= 3, 'Silhouette strokes contrast with the figure background');
        contrasts.push({id,width,theme,contrast});
        assert.equal(await svg.evaluate(e => e.getAnimations({subtree:true}).length), 0);
        if (id === 'autonomous-insertion') {
          assert.match(await record.locator('.facts').textContent(), /simulated UR5e arm/);
          assert(!/\bUR5\b/.test(await record.textContent()));
          const gap = await svg.evaluate(e => {
            const tip=e.querySelector('[data-part="connector.mating-tip"]').getBoundingClientRect();
            const socket=e.querySelector('[data-part="socket.front"]').getBoundingClientRect();
            return socket.top-tip.bottom;
          });
          assert(gap >= 1, 'Connector/socket gap remains legible on phones');
        } else assert.match(await figure.textContent(), /MPU6050: X\/Y · encoder: Z · IR: gripper/);
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
  }
  if (!before) {
    const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:393,height:852}});
    const page = await context.newPage(); await page.goto(origin);
    assert.equal(await page.locator('.project-anatomy').count(),2,'Both complete figures exist without JavaScript');
    await page.goto(`${origin}/projects/autonomous-insertion/`);
    assert.match(await page.locator('main').textContent(),/simulated UR5e arm/);
    assert(!/\bUR5\b/.test(await page.locator('main').textContent()));
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/verification.json`, JSON.stringify({ captures, errors, payloads, contrasts, limitations:['Static schematic geometry, not manufacturer CAD or calibrated physics.','Chromium phone emulation, not physical Safari/iOS.','Gzip measures source compression, not HTTP transfer encoding.'] }, null, 2) + '\n');
  console.log(`${before ? 'Before' : 'After'}: ${captures.length} figure captures, eight record captures, no overflow or page errors.`);
} finally { await browser.close(); }
