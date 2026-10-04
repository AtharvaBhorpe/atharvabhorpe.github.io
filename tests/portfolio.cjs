// One isolated Chrome/page. Astro preview serves only dist; no workspace server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.EVIDENCE_DIR || path.join(require('node:os').tmpdir(), 'portfolio-evidence');
const pages = ['/', ...fs.readdirSync(path.join(root, 'dist/projects')).map(id => `/projects/${id}/`)];
const { createHash } = require('node:crypto');
const expectedEmail = 'hello@atharvabhorpe.com';
const retiredEmail = 'atharva.r.bhorpe@gmail.com';
// PDF text/link/redaction validation precedes this immutable reviewed-byte fixture.
for (const file of fs.readdirSync(path.join(root,'dist'),{recursive:true,withFileTypes:true})) {
  if (file.isFile() && /\.(html|js|css|json|txt)$/.test(file.name)) {
    assert(!fs.readFileSync(path.join(file.parentPath,file.name),'utf8').includes(retiredEmail), 'Retired email must not enter public output');
  }
}
const approvedAssets = {
  'fonts/cabinet-grotesk.woff2':'f71103771c9e32406026b6ea46c7e57cb977d5884e70d0f1beeab91ab2c7abb6',
  'fonts/satoshi.woff2':'e739aff9b4d02c264341d6d4872edcda28e79373aeda936f659566a1cd3eb47f',
  'fonts/Fontshare-FFL.txt':'145e7fe2429a3336ba215c070ef722000e01348a3e1baaa127e871bb5012f554',
  'images/portrait.png':'614a5de87e5d9da6005f7fddf48a99fe9a4ad3a7cd395835b766997a940cda8c',
  'resume.pdf':'b8fc7f6da33ace2689c77aabd2b6fb23ce61c25806e1693a721d55ee3894bc26',
};
for (const [file,hash] of Object.entries(approvedAssets)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'public',file))).digest('hex'), hash, file);
const css = fs.readFileSync(path.join(root,'src/styles/theme.css'),'utf8');
const approvedPalette = { light:'6ae44769ffe202c7828e4559636b63a2d969154beac30b872b0cc37a4ac9a889', dark:'8dfe6db750f7b8193d42a987fc216cbfee47581a75ae7837a8f7f3dd179c2ada' };
const luminance = hex => hex.match(/[a-f\d]{2}/gi).map(s=>parseInt(s,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrasts = [];
for (const mode of ['light','dark']) {
  const pattern = new RegExp(':root\\[data-resolved="'+mode+'"\\]\\{([^}]*)\\}');
  const block = css.match(pattern)[1];
  assert.equal(createHash('sha256').update(block).digest('hex'), approvedPalette[mode], 'Approved palette is unchanged');
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):(#\w{6})/g)].map(m=>[m[1],m[2]]));
  const pairs = [['selection-text','selection-bg',4.5],['button-text','button-bg',4.5],['link-text','surface-panel',4.5],['focus-selected','selection-bg',3]];
  for (const surface of ['surface-page','surface-panel','surface-navigation','surface-hover','surface-input']) pairs.push(['text-primary',surface,4.5],['text-secondary',surface,4.5],['focus-ring',surface,3],['rule-control',surface,3]);
  for (const [foreground,background,minimum] of pairs) {
    const a=luminance(tokens[foreground]),b=luminance(tokens[background]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    assert(ratio>=minimum, `${mode} ${foreground}/${background}: ${ratio}`); contrasts.push({mode,foreground,background,ratio,minimum});
  }
}
(async () => {
  fs.mkdirSync(out, { recursive:true });
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', String(port)], { cwd:root, stdio:'pipe' });
  let browser;
  let serverLog = '';
  server.stdout.on('data', b => serverLog += b);
  server.stderr.on('data', b => serverLog += b);
  try {
    for (let i=0; i<100; i++) {
      try { if ((await fetch(origin)).ok) break; } catch {}
      if (i===99) throw new Error(serverLog);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome', headless:true, ignoreDefaultArgs:['--disable-back-forward-cache'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    const errors = [], landings = [], fontRendering = [];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    async function verifyFonts(route) {
      const { root:doc } = await cdp.send('DOM.getDocument');
      for (const [selector,family] of [['h1','Cabinet Grotesk'],[route==='/'?'.positioning':'.summary','Satoshi']]) {
        const { nodeId } = await cdp.send('DOM.querySelector',{nodeId:doc.nodeId,selector});
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
        assert(fonts.some(f=>f.isCustomFont && f.glyphCount>0 && f.familyName.includes(family)), `${selector} renders ${family}: ${JSON.stringify(fonts)}`);
        fontRendering.push({route,selector,fonts});
      }
    }
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    page.on('response', r => { if (r.status()>=400) errors.push(`${r.status()} ${r.url()}`); });
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const nav = async () => page.locator(await page.locator('.phone-dock').isVisible() ? '.phone-dock nav' : 'aside nav');
    const theme = async () => {
      if (await page.locator('.phone-dock').isVisible()) {
        if (!(await page.locator('#contact-menu').isVisible())) await page.locator('.say-hi').click();
        await page.locator('#contact-menu').waitFor({ state:'visible' });
        return page.locator('#contact-menu select');
      }
      return page.locator('aside select');
    };
    async function landing(id) {
      await settle();
      const s = await page.evaluate(id => {
        const node = document.getElementById(id), heading = id==='home' ? node.querySelector('h1') : node;
        const panel = node.closest('.panel'), region = document.querySelector('.page-scroll');
        const r = region?.getBoundingClientRect(), v = visualViewport;
        const dock = document.querySelector('.phone-dock');
        const compact = !!dock.getClientRects().length;
        const top = Math.max(r?.top || 0, v.offsetTop), bottom = Math.min(r?.bottom || innerHeight, v.offsetTop+v.height, compact ? dock.getBoundingClientRect().top : Infinity);
        const scroll = region || document.scrollingElement;
        return { id, width:innerWidth, height:innerHeight, top, bottom, headingTop:heading.getBoundingClientRect().top, headingBottom:heading.getBoundingClientRect().bottom, panelTop:panel.getBoundingClientRect().top, nested:node.tagName==='H3', clamped:scroll.scrollHeight>scroll.clientHeight && scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-1, active:document.querySelector((compact?'.phone-dock':'aside')+' [aria-current]')?.dataset.section, last:[...document.querySelectorAll('aside [data-section]')].at(-1).dataset.section };
      }, id);
      landings.push(s);
      assert(s.headingTop>=s.top-1, JSON.stringify(s));
      assert(s.headingBottom<=s.bottom+1, JSON.stringify(s));
      if (!s.nested) assert(s.panelTop>=s.top+6, JSON.stringify(s));
      if (!s.clamped) assert(Math.abs((s.nested?s.headingTop:s.panelTop)-s.top-8)<=1, 'Exact 8px landing '+JSON.stringify(s));
      assert.equal(s.active, s.clamped?s.last:id, JSON.stringify(s));
    }
    for (const route of pages) {
      assert.equal((await fetch(origin+route)).status, 200);
      for (const [width,height] of [[320,900],[375,900],[414,900],[768,900],[1440,900],[852,393],[320,480],[375,300],[1440,393]]) {
        await page.setViewportSize({ width,height });
        await page.goto(origin+route+'?theme=light');
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => portfolioTheme.fontsLoaded), 'Licensed fonts load');
        assert.equal(await page.locator('h1').count(), 1);
        if(width===1440 && height===900) await verifyFonts(route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.locator('.controls,.preview-chrome,.note,.preview-settings').count(), 0);
        assert.equal(await page.locator('.resume-link').count(),route==='/'?3:2);
        assert.equal(await page.getByRole('button',{name:'Resume',includeHidden:true}).count(),0);
        assert(await page.locator('.copy-email').evaluateAll((nodes,email)=>nodes.length===2&&nodes.every(n=>n.dataset.email===email),expectedEmail));
        assert(await page.locator('.email-fallback input').evaluateAll((nodes,email)=>nodes.every(n=>n.value===email),expectedEmail));
        assert(await page.locator('a[href^="mailto:"]').evaluateAll((nodes,email)=>nodes.every(n=>n.getAttribute('href')==='mailto:'+email),expectedEmail));
        assert(await page.locator('.resume-link').evaluateAll(nodes=>nodes.every(a=>a.tagName==='A'&&a.getAttribute('href')==='/resume.pdf'&&a.target==='_blank'&&a.rel.includes('noopener'))));
        const ids = await page.locator('aside [data-section]').evaluateAll(nodes => nodes.map(n=>n.dataset.section));
        const len = await page.evaluate(() => history.length);
        for (const id of ids) {
          const link = (await nav()).locator(`[data-section="${id}"]`);
          await link.click(); await landing(id);
          assert.equal(await page.evaluate(()=>document.activeElement.id), id);
          await link.focus(); await page.keyboard.press('Enter'); await landing(id);
          assert.equal(await page.evaluate(()=>document.activeElement.id), id);
          assert.equal(await page.evaluate(() => history.length), len);
          if (['/','/projects/cost-effective-amr/'].includes(route) && [375,1440].includes(width) && height===900 && ['projects','writing','reported-results-and-limitations'].includes(id)) await page.screenshot({path:path.join(out,`${route==='/'?'home':'amr'}-${id}-${width}.png`)});
        }
        assert(await (await nav()).locator('a').evaluateAll(nodes=>nodes.every(e=>{const r=e.getBoundingClientRect();return r.width>=44 && r.height>=44;})));
        await page.waitForFunction(()=>[...document.images].every(i=>i.complete && i.naturalWidth>0));
        assert(await page.locator('img').evaluateAll(images=>images.every(i=>i.hasAttribute('alt'))));
        const select = await theme();
        await select.scrollIntoViewIfNeeded();
        await select.focus();
        const scroll = await page.evaluate(() => [scrollY,document.querySelector('.page-scroll')?.scrollTop || 0]);
        await select.selectOption('dark');
        assert.equal(await page.evaluate(() => history.length), len);
        assert.deepEqual(await page.evaluate(() => [scrollY,document.querySelector('.page-scroll')?.scrollTop || 0]), scroll);
        assert(await page.locator('select').evaluateAll(nodes=>nodes.every(n=>n.value==='dark')));
        if (await page.locator('.phone-dock').isVisible()) {
          await page.keyboard.press('Escape');
          assert(await page.locator('.say-hi').evaluate(e=>e===document.activeElement));
        }
        if (['/','/projects/tiny-recursive-model/','/projects/cost-effective-amr/'].includes(route) && [375,1440].includes(width) && height===900) for (const mode of ['light','dark']) {
          await page.goto(origin+route+'?theme='+mode); await page.evaluate(()=>document.fonts.ready);
          await page.screenshot({ path:path.join(out, `${route==='/'?'home':route.split('/')[2]}-${width}-${mode}.png`) });
        }
      }
      // Every generated section fragment works after a fresh page load.
      await page.setViewportSize({ width:375,height:900 });
      const ids = await page.locator('aside [data-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.section));
      for (const id of ids) { await page.goto(origin+route+'?theme=light#'+id); await page.evaluate(()=>document.fonts.ready); await landing(id); }
      console.log(`PASS ${route}: widths, light/dark, click/Enter, headings, fragments, dock clearance`);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const width of [320,375,1440]) {
      await page.setViewportSize({width,height:width===1440?900:600});
      await page.goto(origin+'/projects/tiny-recursive-model/');
      const video=page.locator('video');
      await video.evaluate(v=>v.scrollIntoView({block:'start'}));
      await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
      const initial=await video.evaluate(v=>({paused:v.paused,autoplay:v.autoplay,loop:v.loop,controls:v.controls,inline:v.playsInline,preload:v.preload,width:v.videoWidth,height:v.videoHeight,duration:v.duration,described:!!document.getElementById(v.getAttribute('aria-describedby'))?.textContent}));
      assert.deepEqual({...initial,duration:undefined},{paused:true,autoplay:false,loop:false,controls:true,inline:true,preload:'metadata',width:1920,height:1200,duration:undefined,described:true});
      assert(initial.duration>10.8&&initial.duration<11.1);
      assert(await video.evaluate(v=>v.getBoundingClientRect().right<=innerWidth));
      await video.focus(); await page.keyboard.press('Space');
      await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.paused&&v.currentTime>.1&&v.getVideoPlaybackQuality().totalVideoFrames>1;});
      await page.keyboard.press('Space'); assert(await video.evaluate(v=>v.paused));
      assert.equal(await page.evaluate(()=>document.querySelector('video').error),null);
      await video.evaluate(v=>{v.currentTime=6;});
      await page.waitForFunction(()=>!document.querySelector('video').seeking);
      await page.screenshot({path:path.join(out,`trm-video-${width}.png`)});
    }
    console.log('PASS real TRM video: metadata, dimensions, decoded playback, native Space play/pause, seeking and reduced-motion static default');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:375,height:900});
    await page.goto(origin);
    assert.equal(await page.locator('video,iframe').count(),0);
    assert.equal(await page.locator('.writing-row').filter({hasText:'SO-ARM101 in Isaac Sim + ROS 2 + MoveIt 2'}).getAttribute('href'),'https://www.youtube.com/watch?v=0vvhCdKZyQE');
    await page.evaluate(()=>localStorage.removeItem('portfolio-approved-theme'));
    await page.emulateMedia({ colorScheme:'light' }); await page.goto(origin);
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'system');
    await page.emulateMedia({ colorScheme:'dark' }); await page.waitForFunction(()=>document.documentElement.dataset.resolved==='dark');
    await (await theme()).selectOption('light');
    await page.emulateMedia({ colorScheme:'light' }); await page.emulateMedia({ colorScheme:'dark' });
    assert.equal(await page.locator('html').getAttribute('data-resolved'), 'light');
    await page.keyboard.press('Escape'); await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'light');
    await (await nav()).locator('[data-section="projects"]').click();
    const row = page.locator('.project-link').first();
    assert.equal(await row.locator('a,button').count(), 0);
    assert.equal(new URL(await row.getAttribute('href'),origin).pathname, '/projects/tiny-recursive-model/');
    await row.focus(); await page.keyboard.press('Enter'); await page.waitForURL('**/projects/tiny-recursive-model/**');
    const len = await page.evaluate(()=>history.length);
    const ids = await page.locator('aside [data-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.section));
    for (const id of ids) await (await nav()).locator(`[data-section="${id}"]`).click();
    await (await theme()).selectOption('dark'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>history.length), len);
    await page.goBack(); assert.equal(new URL(page.url()).hash, '#projects'); await landing('projects');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'dark');
    // Genuine modified section anchors remain unhandled by our script.
    for (const key of ['ctrlKey','metaKey','shiftKey','altKey']) assert.equal(await page.locator('aside [data-section="writing"]').evaluate((link,key)=>{
      let prevented; window.addEventListener('click',e=>{prevented=e.defaultPrevented;e.preventDefault();},{once:true});
      link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,[key]:true})); return prevented;
    },key), false);
    // Observe our handlers without opening a second page during this one-page test.
    assert(await page.locator('.project-link').first().evaluate(link => {
      return [{button:0},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}].every(options=>{
        const type=options.button===1?'auxclick':'click'; let prevented;
        window.addEventListener(type,e=>{prevented=e.defaultPrevented;e.preventDefault();},{once:true});
        link.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,...options}));
        return prevented===false;
      });
    }));
    await theme();
    await page.waitForFunction(()=>document.activeElement===document.querySelector('#contact-menu .resume-link'));
    await page.keyboard.press('Escape');
    for (const result of ['success','denied','unsupported']) {
      await theme();
      await page.evaluate(result=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:result==='unsupported'?undefined:{writeText:async text=>{window.copiedEmail=text;if(result==='denied') throw Error('Denied');}}}), result);
      await page.locator('#contact-menu .copy-email').click();
      await page.waitForFunction(()=>document.querySelector('#contact-menu .copy-status').textContent.length>0);
      const text=await page.locator('#contact-menu .copy-status').textContent();
      assert.equal(text.includes('Email copied.'), result==='success');
      if (result==='success') assert.equal(await page.evaluate(()=>window.copiedEmail),expectedEmail);
      else {
        assert.equal(await page.locator('#contact-menu input').inputValue(),expectedEmail);
        assert(await page.locator('#contact-menu input').evaluate(e=>e===document.activeElement && e.readOnly && e.selectionEnd===e.value.length));
      }
      await page.keyboard.press('Escape');
    }
    await theme(); await page.mouse.click(8,8);
    await page.waitForFunction(()=>document.querySelector('.say-hi').getAttribute('aria-expanded')==='false');
    assert(!(await page.locator('#contact-menu').isVisible()));
    // Resize must not strand focus in hidden navigation or contact controls.
    await theme(); await page.locator('#contact-menu select').focus();
    await page.setViewportSize({width:1440,height:900}); await settle();
    assert(!(await page.locator('#contact-menu').isVisible()));
    assert(await page.locator('aside').evaluate(e=>e.contains(document.activeElement)));
    await page.setViewportSize({width:375,height:600}); await settle();
    assert(await page.locator('.phone-dock').evaluate(e=>e.contains(document.activeElement)));
    // Storage denial: preference survives via the actual clean-route anchor URL.
    await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));
    await page.goto(origin); await (await theme()).selectOption('dark'); await page.keyboard.press('Escape');
    await page.reload(); assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
    await (await nav()).locator('[data-section="projects"]').click(); await page.locator('.project-link').first().click();
    assert.equal(new URL(page.url()).searchParams.get('theme'),'dark');
    await page.locator('main>.back').click(); assert.equal(new URL(page.url()).pathname,'/'); await landing('projects');
    for (const url of ['/fonts/cabinet-grotesk.woff2','/fonts/satoshi.woff2','/fonts/Fontshare-FFL.txt','/images/portrait.png']) assert.equal((await fetch(origin+url)).status,200);
    const resume=await fetch(origin+'/resume.pdf');
    assert.equal(resume.status,200); assert(resume.headers.get('content-type').includes('application/pdf'));
    assert.equal(createHash('sha256').update(Buffer.from(await resume.arrayBuffer())).digest('hex'),approvedAssets['resume.pdf']);
    for (const url of ['/.env','/reports/','/resume-public.pdf']) assert.equal((await fetch(origin+url)).status,404);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out,'regression.json'), JSON.stringify({pages,landings,fontRendering,contrasts,errors,checks:'System/overrides/reload/Back, native links, popover/copy fallback, resize focus, storage denial, safe HTTP output'},null,2));
    console.log('PASS shared behavior; Chrome only. Safari/WebKit physical-device check remains manual.');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
    await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
