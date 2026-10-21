// Robot floor: draws behind content, stays static under reduced motion, raises no errors.
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const reservation = net.createServer();
  await new Promise(r => reservation.listen(0, '127.0.0.1', r));
  const port = reservation.address().port;
  await new Promise(r => reservation.close(r));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await sleep(100); }
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
    const errors = [];
    const drawn = page => page.evaluate(() => {
      const c = document.querySelector('canvas.robot-field'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++;
      return { ink, hidden: c.getAttribute('aria-hidden'), events: getComputedStyle(c).pointerEvents, z: getComputedStyle(c).zIndex, hash: d.reduce((h, v, i) => (h * 31 + v * (i % 97)) | 0, 0) };
    });
    for (const route of ['/', '/projects/cost-effective-amr/']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on('pageerror', e => errors.push(route + ': ' + e.message));
      await page.goto(origin + route); await sleep(1500);
      const a = await drawn(page);
      assert(a.ink > 1000, `${route} draws the floor`);
      assert.deepEqual([a.hidden, a.events, a.z], ['true', 'none', '-1'], `${route} canvas is decorative and behind content`);
      await sleep(300);
      assert.notEqual((await drawn(page)).hash, a.hash, `${route} animates`);
      await page.close();
    }
    const still = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await still.goto(origin + '/'); await sleep(800);
    const s1 = await drawn(still); await sleep(800);
    assert(s1.ink > 0 && s1.hash === (await drawn(still)).hash, 'Reduced motion draws one still frame');
    assert.deepEqual(errors, []);
    console.log('Robot floor draws, animates, stays behind content and holds still under reduced motion.');
  } finally { await browser?.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
