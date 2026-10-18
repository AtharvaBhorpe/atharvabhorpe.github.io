const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function focusCycles(browser, origin, out) {
  const page = await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});
  const failures = [];
  try {
    await page.addInitScript(() => {
      window.focusTrace = [];
      const record = type => window.focusTrace.push({type,width:innerWidth,active:document.activeElement?.className,menuDisplay:document.querySelector('.menu-toggle') && getComputedStyle(document.querySelector('.menu-toggle')).display});
      document.addEventListener('blur', () => record('blur'), true);
      document.addEventListener('focusin', () => record('focusin'));
      matchMedia('(min-width:1200px)').addEventListener('change', () => record('media-change'));
    });
    for (let i=0;i<30;i++) {
      await page.setViewportSize({width:390,height:900});
      await page.goto(origin+'/?theme=light');
      await page.locator('.menu-toggle').focus();
      for (const width of [1440,390]) {
        await page.setViewportSize({width,height:900});
        try {
          await page.waitForFunction(w => w < 1200
            ? document.activeElement === document.querySelector('.menu-toggle')
            : document.querySelector('#navigation-panel').contains(document.activeElement), width, {timeout:1500});
        } catch {
          failures.push({cycle:i,width,trace:await page.evaluate(()=>window.focusTrace)});
        }
        assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
      }
    }
    fs.writeFileSync(path.join(out,'focus-cycles.json'),JSON.stringify({cycles:30,failures},null,2)+'\n');
    assert.deepEqual(failures, [], 'Responsive focus transfer must not depend on CSS/event timing');
    return {cycles:30,failures:0};
  } finally { await page.close(); }
}
const routes = ['/', '/projects/tiny-recursive-model/', '/writing/', '/writing/so-arm100101-lerobot-isaac-sim/'];
const devices = [
  [320,740,true],[390,844,true],[414,896,true],
  [768,1024,true],[820,1180,true],[1024,1366,true],
  [1024,768,true],[1180,820,true],[1366,1024,true],
  [1366,900,false],[1440,900,false],
];
async function dockChecks(browser, origin, out) {
  const matrix=[], errors=[];
  const exposed = locator => locator.evaluate(e => {
    const r=e.getBoundingClientRect();
    return r.top>=0 && r.bottom<=innerHeight+1 && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  });
  for (const [width,height,touch] of devices) for (const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    const docked=touch || width<1200;
    const activate=async locator=>touch?locator.tap():locator.click();
    try {
      for (const route of routes) {
        await page.goto(origin+route+'?theme='+theme);await page.evaluate(()=>document.fonts.ready);
        const bar=page.locator('.identity-row'), menu=page.locator('.menu-toggle'), panel=page.locator('#navigation-panel');
        const box=await bar.boundingBox();
        assert.equal(await menu.isVisible(),docked);
        assert(Math.abs(docked?box.y+box.height-height:box.y)<1,'Correct dock edge');
        assert.equal(await page.locator('.site-navigation').count(),1);
        assert.equal(await page.locator('.theme-toggle').count(),1);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        if(docked) assert((await page.locator('main').boundingBox()).y<100,'No obsolete top-header space');
        for(const control of await bar.locator('a:visible,button:visible').all()) {
          const r=await control.boundingBox();assert(r.width>=44 && r.height>=44);
          assert(await exposed(control),'Dock control is exposed');
        }
        const capture=[390,820,1366,1440].includes(width);
        const label=route==='/'?'home':route.startsWith('/projects')?'project':route==='/writing/'?'writing':'article';
        const device=touch?'touch':'mouse';
        if(capture) await page.screenshot({path:path.join(out,`${label}-${width}-${device}-${theme}.png`)});
        if(docked) {
          await activate(menu);
          const p=await panel.boundingBox();
          assert(p.y>=0 && p.y+p.height<=box.y-7,'Menu opens entirely above the dock');
          assert(await page.locator('main').evaluate(e=>e.inert));
          await menu.focus();await page.keyboard.press('Tab');
          assert(await panel.evaluate(e=>e.contains(document.activeElement)),'Tab reaches the single menu');
          const last=panel.locator('a,button').last();await last.focus();
          assert(await exposed(last),'Long contents scroll to the focused final control');
          if(label==='article' && height<=900) assert(await panel.evaluate(e=>e.scrollHeight>e.clientHeight),'Long article menu scrolls in constrained viewports');
          if(capture && (label==='home'||label==='article')) {
            await panel.evaluate(e=>e.scrollTop=0);await menu.focus();
            await page.screenshot({path:path.join(out,`${label}-${width}-${device}-${theme}-menu.png`)});
          }
          await page.keyboard.press('Escape');assert(await panel.isHidden());
          assert(await menu.evaluate(e=>e===document.activeElement && getComputedStyle(e).outlineStyle==='solid'));
          assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
          await activate(menu);
        }
        const destination=panel.locator('[data-section]').last();
        const id=await destination.getAttribute('data-section');
        await destination.focus();await page.keyboard.press('Enter');
        await page.waitForFunction(id=>document.activeElement.id===id,id);
        assert(await page.evaluate(id=>{
          const r=document.getElementById(id).getBoundingClientRect(),bar=document.querySelector('.identity-row').getBoundingClientRect();
          const top=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
          return r.top>=-1 && r.top < (bar.top>0?bar.top:innerHeight)-20 && (r.top>=top-1 || scrollY===0);
        },id),'Anchor destination clears the navigation');
        if(docked) assert(await panel.isHidden());
        await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
        const lastContent=page.locator('main a').last();await lastContent.focus();
        assert(await exposed(lastContent),'Last content link remains reachable above the dock');
        for(const selector of ['main video','main .code-toolbar button']) {
          const control=page.locator(selector).first();
          if(await control.count()) {await control.focus();assert(await exposed(control),'Media/code control remains reachable');}
        }
        await activate(page.locator('.theme-toggle'));
        assert.equal(await page.locator('html').getAttribute('data-mode'),theme==='light'?'dark':'system');
        await activate(page.locator('.home-link'));
        await page.waitForURL(url=>url.pathname==='/' && url.hash==='#home');
        assert(await exposed(page.locator('.home-link')),'Home shortcut persists');
        matrix.push({route,width,height,touch,theme,docked});
      }
    } catch(error) {
      await page.screenshot({path:path.join(out,'navigation-failure.png')});
      error.message=`${page.url()} ${width}×${height} touch=${touch}: ${error.message}`;throw error;
    } finally {await page.close();}
  }
  // Rotation retains an open touch sheet, not an inert page with an inaccessible menu.
  const rotated=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true,reducedMotion:'reduce'});
  try {
    await rotated.goto(origin+routes[3]);await rotated.locator('.menu-toggle').tap();
    const last=rotated.locator('#navigation-panel a,#navigation-panel button').last();await last.focus();
    for(const viewport of [{width:1180,height:820},{width:1366,height:1024},{width:1024,height:768},{width:390,height:320},{width:820,height:1180}]) {
      await rotated.setViewportSize(viewport);
      await rotated.waitForFunction(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=document.querySelector('.identity-row').getBoundingClientRect().top;});
      assert(await exposed(last),'Rotation keeps the focused sheet control exposed');
    }
    await rotated.keyboard.press('Escape');assert.equal(await rotated.locator('main').evaluate(e=>e.inert),false);
    await rotated.emulateMedia({reducedMotion:'no-preference'});await rotated.locator('.menu-toggle').tap();
    assert(await rotated.locator('#navigation-panel').evaluate(e=>{
      const animation=e.getAnimations()[0];
      window.menuCancelled=false;
      animation?.addEventListener('cancel',()=>window.menuCancelled=true,{once:true});
      return Boolean(animation);
    }),'Normal-motion sheet starts its transition');
    await rotated.emulateMedia({reducedMotion:'reduce'});
    await rotated.waitForFunction(()=>window.menuCancelled);
    assert.equal(await rotated.locator('#navigation-panel').evaluate(e=>e.getAnimations().length),0);
  } finally {await rotated.close();}
  // Mode changes also cover focused controls that desktop hides, and an open sheet.
  const mode=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  try {
    for(const route of ['/',routes[3]]) {
      await mode.goto(origin+route);await mode.locator('.menu-toggle').click();
      await mode.locator('#navigation-panel a,#navigation-panel button').last().focus();
      await mode.setViewportSize({width:1440,height:900});
      await mode.waitForFunction(()=>!document.querySelector('main').inert && document.querySelector('.menu-toggle').hidden);
      assert(await exposed(mode.locator(':focus')),'Desktop mode does not strand focus');
      if(route!=='/') await mode.locator('.masthead-links a').first().focus();
      await mode.setViewportSize({width:390,height:844});
      await mode.waitForFunction(()=>document.activeElement===document.querySelector('.menu-toggle'));
      assert.equal(await mode.locator('main').evaluate(e=>e.inert),false);
      assert(await mode.locator('#navigation-panel').isHidden());
    }
    // Primary touch input changes mode even at the same width.
    await mode.setViewportSize({width:1366,height:900});
    await mode.waitForFunction(()=>document.querySelector('.menu-toggle').hidden);
    await mode.locator('.masthead-links a').first().focus();
    const input=await mode.context().newCDPSession(mode);
    await input.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    await mode.waitForFunction(()=>!document.querySelector('.menu-toggle').hidden && document.activeElement===document.querySelector('.menu-toggle'));
    await mode.keyboard.press('Enter');assert(await mode.locator('main').evaluate(e=>e.inert));
    await input.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    // CDP removal reports pointer:none, not a real mouse. The compact rule includes it.
    await mode.waitForFunction(()=>matchMedia('(pointer:none)').matches);
    assert(await mode.locator('.menu-toggle').isVisible());
    await mode.keyboard.press('Escape');assert.equal(await mode.locator('main').evaluate(e=>e.inert),false);
    assert(await exposed(mode.locator(':focus')),'Input-mode change preserves visible focus');
  } finally {await mode.close();}
  const safe=await browser.newPage({viewport:{width:820,height:768},hasTouch:true,reducedMotion:'reduce'});
  try {
    const cdp=await safe.context().newCDPSession(safe);
    await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:20,bottom:34,left:44,right:44}});
    await safe.goto(origin+'/?theme=dark');
    await safe.keyboard.press('Tab');
    assert(await safe.locator('.skip-link').evaluate(e=>e===document.activeElement && e.getBoundingClientRect().top>=28 && e.getBoundingClientRect().left>=44),'Skip link clears the top and horizontal safe areas');
    const style=await safe.locator('.identity-row').evaluate(e=>({bottom:parseFloat(getComputedStyle(e).paddingBottom),left:parseFloat(getComputedStyle(e).paddingLeft),right:parseFloat(getComputedStyle(e).paddingRight),height:e.getBoundingClientRect().height}));
    assert(style.bottom>=50 && style.left>=44 && style.right>=44 && style.height>=111,'Real CSS env insets pad the dock');
    assert.equal(await safe.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)),28,'Anchor clearance includes the top safe area');
    await safe.locator('.menu-toggle').tap();
    assert((await safe.locator('#navigation-panel').boundingBox()).y>=20);
    await safe.screenshot({path:path.join(out,'safe-area-dark.png')});
    await safe.keyboard.press('Escape');await safe.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    assert(await exposed(safe.locator('main a').last()),'Inset dock leaves content clearance');
  } finally {await safe.close();}
  let fallbackCases=0;
  for(const [width,height,touch] of [[320,740,true],[820,1180,true],[1366,1024,true],[1440,900,false]]) for(const colorScheme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:touch,javaScriptEnabled:false,colorScheme});
    try {
      for(const route of routes) {
        await page.goto(origin+route);
        assert(await page.locator('.menu-toggle').isHidden());assert(await page.locator('#navigation-panel').isVisible());
        const link=page.locator('#navigation-panel [data-section]').last(),id=await link.getAttribute('data-section');
        await link.click();await page.waitForURL(url=>decodeURIComponent(url.hash.slice(1))===id);
        assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.locator('main a').last().focus();assert(await exposed(page.locator('main a').last()));
        fallbackCases++;
      }
    } finally {await page.close();}
  }
  for(const script of ['ui.js','navigation.js']) {
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
    try {
      await page.route('**/'+script,route=>route.abort());await page.goto(origin+routes[3]+'?theme=dark');
      if(script==='navigation.js') await page.locator('.menu-toggle').tap();
      else assert(await page.locator('.menu-toggle').isHidden());
      const link=page.locator('#navigation-panel [data-section]').last(),id=await link.getAttribute('data-section');
      await link.click();await page.waitForURL(url=>decodeURIComponent(url.hash.slice(1))===id);
      assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
      if(script==='navigation.js') assert(await page.locator('#navigation-panel').isHidden());
    } finally {await page.close();}
  }
  assert.deepEqual(errors,[]);
  return {matrix,fallbackCases,safeArea:'CDP env override passed',errors};
}
module.exports = async (browser,origin,out) => {
  const focus=await focusCycles(browser,origin,out);
  const dock=await dockChecks(browser,origin,out);
  const result={focus,...dock,limitations:['Physical Safari/iOS and browser-toolbar behavior require device testing.','No-JS preserves the existing light appearance; both OS color-scheme preferences were exercised.']};
  fs.writeFileSync(path.join(out,'navigation.json'),JSON.stringify(result,null,2)+'\n');
  return result;
};
if (require.main === module) (async () => {
  const out=process.env.EVIDENCE_DIR || '.evidence/bottom-navigation';fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
  try {
    const run=process.argv.includes('--focus-only')?focusCycles:module.exports;
    const result=await run(browser,process.env.SITE_URL||'http://127.0.0.1:4336',out);
    console.log(`Navigation passed: ${result.matrix?.length||0} route/device/theme cases; ${result.focus?.cycles||result.cycles} focus cycles.`);
  }
  finally { await browser.close(); }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
