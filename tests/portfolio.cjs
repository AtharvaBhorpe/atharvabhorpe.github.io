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
  'images/portrait.png':'f2b05066195adadad70b16d800ce50ab3c304985ceead9917b8fcce031af8ab1',
  'resume.pdf':'a8204267abc9b353a25df423678245a77ec362c2da0461e66acbc6e09a4de900',
};
for (const [file,hash] of Object.entries(approvedAssets)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'public',file))).digest('hex'), hash, file);
const css = fs.readFileSync(path.join(root,'src/styles/theme.css'),'utf8');
const approvedPalette = { light:'badddcf3ce049e80ab64a67c8fd4330066a6cf947e07ca3cd316b05681354798', dark:'8dfe6db750f7b8193d42a987fc216cbfee47581a75ae7837a8f7f3dd179c2ada' };
const luminance = hex => hex.match(/[a-f\d]{2}/gi).map(s=>parseInt(s,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrasts = [];
for (const mode of ['light','dark']) {
  const pattern = new RegExp(':root\\[data-resolved="'+mode+'"\\]\\{([^}]*)\\}');
  const block = css.match(pattern)[1];
  assert.equal(createHash('sha256').update(block).digest('hex'), approvedPalette[mode], 'Approved palette is unchanged');
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):(#\w{6})/g)].map(m=>[m[1],m[2]]));
  const pairs = [['selection-text','selection-bg',4.5],['button-text','button-bg',4.5],['link-text','surface-panel',4.5],['focus-selected','selection-bg',3]];
  for (const surface of ['surface-page','surface-panel','surface-navigation','surface-hover','surface-input']) pairs.push(['text-primary',surface,4.5],['text-secondary',surface,4.5],['link-text',surface,4.5],['focus-ring',surface,3],['rule-control',surface,3]);
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
    browser = await chromium.launch({ executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome', headless:true, ignoreDefaultArgs:['--disable-back-forward-cache','--hide-scrollbars'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    const errors = [], landings = [], fontRendering = [];
    for (const width of [375,904,1440]) for (const mode of ['light','dark']) {
      await page.setViewportSize({width,height:900});
      const states=[];
      for (const route of ['/','/writing/']) {
        await page.goto(origin+route+'?theme='+mode); await page.evaluate(()=>document.fonts.ready);
        const row=page.locator('.writing-row').first();
        const geometry=await page.evaluate(()=>{
          const rail=document.querySelector('aside').getBoundingClientRect(),panel=document.querySelector('.panel').getBoundingClientRect();
          return {railX:rail.x,panelX:panel.x,panelWidth:panel.width};
        });
        const styles=[];
        for (const state of ['hover','focus','pressed']) {
          if(state==='hover') await row.hover();
          if(state==='focus') {await page.mouse.move(0,0); await row.focus();}
          if(state==='pressed') {await row.hover(); await page.mouse.down();}
          styles.push(await row.evaluate(e=>{
            const s=getComputedStyle(e),line=getComputedStyle(e,'::before');
            return {columns:s.gridTemplateColumns,gap:s.gap,padding:s.padding,margin:s.margin,border:s.borderTopColor,radius:s.borderRadius,background:s.backgroundColor,font:s.font,line:line.borderTop,edge:line.borderRadius,inset:line.left,outline:s.outline};
          }));
          if(state==='pressed') {await page.mouse.move(0,0); await page.mouse.up();}
        }
        states.push({geometry,styles});
      }
      assert.deepEqual(states[1],states[0],`Writing rows and page alignment match at ${width}px in ${mode}`);
      assert.equal(states[1].styles[0].edge,'0px','Separators remain straight');
    }
    const motionPage=await browser.newPage();
    for(const route of ['/','/writing/install-isaac-lab-in-5-minutes-with-pixi/']) for(const width of [375,1440]) for(const reducedMotion of ['reduce','no-preference']) {
      await motionPage.setViewportSize({width,height:900}); await motionPage.emulateMedia({reducedMotion});
      await motionPage.goto(origin+route); await motionPage.evaluate(()=>document.fonts.ready);
      const id=route==='/'?'projects':await motionPage.locator('.prose h2').nth(1).getAttribute('id');
      await motionPage.evaluate(()=>{
        const region=document.querySelector('.page-scroll'), scroller=region || window;
        const original=scroller.scrollTo.bind(scroller);
        scroller.scrollTo=options=>{
          window.scrollRequest=options;
          window.scrollStart=region?region.scrollTop:scrollY;
          original(options);
        };
      });
      const scope=await motionPage.locator('.phone-dock').isVisible()?'.phone-dock':'aside';
      if(await motionPage.locator('.contents-button').isVisible()) await motionPage.locator('.contents-button').click();
      await motionPage.locator(`${scope} [data-section="${id}"]`).focus();
      await motionPage.keyboard.press('Enter');
      assert.equal(await motionPage.evaluate(()=>scrollRequest.behavior),reducedMotion==='reduce'?'instant':'smooth');
      if(reducedMotion==='no-preference') await motionPage.waitForFunction(()=>{
        const top=document.querySelector('.page-scroll')?.scrollTop ?? scrollY;
        return top>scrollStart && top<scrollRequest.top-1;
      });
      await motionPage.waitForFunction(()=>Math.abs((document.querySelector('.page-scroll')?.scrollTop ?? scrollY)-Math.max(0,scrollRequest.top))<1);
      assert.equal(await motionPage.evaluate(()=>document.activeElement.id),id);
      assert.equal(new URL(motionPage.url()).hash,'#'+id);
      if(route!=='/') assert(Math.abs(await motionPage.locator('#'+id).evaluate(e=>e.getBoundingClientRect().top)-8)<1,'Article scroll lands on the selected heading');
      if(route==='/') {
        await motionPage.locator(`${scope} .home-link`).focus();
        await motionPage.keyboard.press('Enter');
        assert.equal(await motionPage.evaluate(()=>scrollRequest.behavior),reducedMotion==='reduce'?'instant':'smooth');
        await motionPage.waitForFunction(()=>Math.abs(document.querySelector('.page-scroll').scrollTop-Math.max(0,scrollRequest.top))<1);
        assert.equal(await motionPage.evaluate(()=>document.activeElement.id),'home');
        assert.equal(new URL(motionPage.url()).hash,'#home');
      }
    }
    await motionPage.close();
    const homePage=await browser.newPage({hasTouch:true});
    const homeCDP=await homePage.context().newCDPSession(homePage);
    homePage.on('pageerror',e=>errors.push(e.message));
    await homePage.emulateMedia({reducedMotion:'reduce'});
    const homeRoutes=['/',pages[1],'/writing/','/writing/so-arm100101-lerobot-isaac-sim/','/writing/install-isaac-lab-in-5-minutes-with-pixi/'];
    for(const route of homeRoutes) for(const width of [320,375,414,768,904,1440]) for(const mode of ['light','dark']) {
      await homePage.setViewportSize({width,height:width===1440?450:900});
      await homePage.goto(origin+route+'?theme='+mode);
      await homePage.evaluate(()=>document.fonts.ready);
      const compact=await homePage.locator('.phone-dock').isVisible();
      const shortcut=homePage.locator(compact?'.phone-dock>.home-link':'aside>.home-link');
      assert.equal((await shortcut.textContent()).trim(),'Atharva Bhorpe');
      assert.equal(await shortcut.evaluate(e=>getComputedStyle(e).textDecorationLine),'none','Name shortcut is never underlined');
      const box=await shortcut.boundingBox();
      assert(box.width>=44 && box.height>=44,'Home shortcut has a 44px target');
      await homePage.evaluate(()=>{
        const rail=document.querySelector('aside'); rail.scrollTop=rail.scrollHeight;
        const strip=document.querySelector('.phone-dock nav'); strip.scrollLeft=strip.scrollWidth;
      });
      assert(await shortcut.evaluate(e=>{
        const r=e.getBoundingClientRect();
        return r.top>=0 && r.bottom<=innerHeight && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }),route+' name remains visible above overflowing navigation');
      if(!compact) {
        for(const link of await homePage.locator('aside nav a').all()) {
          await link.focus();
          assert(await link.evaluate(e=>{
            const r=e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
          }),'Focused rail links remain visible below the sticky name');
        }
      }
      if(compact) {
        await shortcut.focus();
        await homePage.keyboard.press('Tab');
        assert(await homePage.locator('.say-hi').evaluate(e=>e===document.activeElement && e.matches(':focus-visible')),'Keyboard order follows name then contact');
        await homePage.keyboard.press('Tab');
        assert(await homePage.locator('.phone-dock .contents-button,.phone-dock nav a').first().evaluate(e=>e===document.activeElement && e.matches(':focus-visible')),'Keyboard order continues to the section row');
        assert(await homePage.locator('.phone-dock').evaluate(e=>{
          const dock=e.getBoundingClientRect(),nav=e.querySelector('.contents-button,nav').getBoundingClientRect();
          const name=e.querySelector('.home-link').getBoundingClientRect(),contact=e.querySelector('.say-hi').getBoundingClientRect();
          return dock.height===91 && nav.width===dock.width-2 && name.top===contact.top && nav.top>=name.bottom
            && contact.height>=44 && contact.width>=44 && innerHeight-dock.bottom>=12;
        }),'Unified dock is 91px tall, retains 44px targets and gives sections the full row');
        if(await homePage.locator('.contents-button').isVisible()) await homePage.keyboard.press('Enter');
        assert(await homePage.locator('.phone-dock nav a').evaluateAll(nodes=>nodes.every(e=>{
          const r=e.getBoundingClientRect();return r.height>=44 && r.width>=44;
        })),'Every compact section retains a 44px target');
        assert(await homePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Compact toolbar does not widen the page');
        const section=homePage.locator('.phone-dock nav a').last();
        await section.tap();
        assert.equal(await homePage.evaluate(()=>document.activeElement.id),await section.getAttribute('data-section'),'Touch navigation lands and focuses the heading');
        await homePage.locator('.say-hi').tap();
        assert(await homePage.locator('#contact-menu').evaluate(e=>{
          const r=e.getBoundingClientRect(),dock=document.querySelector('.phone-dock').getBoundingClientRect();
          return r.top>=0 && r.bottom<dock.top;
        }),'Contact popover clears the full dock');
        await homePage.keyboard.press('Escape');
        await homePage.evaluate(()=>{
          const region=document.querySelector('.page-scroll');
          if(region) region.scrollTop=region.scrollHeight; else window.scrollTo(0,document.body.scrollHeight);
        });
        assert(await homePage.evaluate(()=>{
          const main=document.querySelector('.content,.case-study'),last=main.lastElementChild;
          return last.getBoundingClientRect().bottom<=document.querySelector('.phone-dock').getBoundingClientRect().top;
        }),'Last content clears the full dock');
        await homeCDP.send('Emulation.setSafeAreaInsetsOverride',{insets:{bottom:34}});
        await homePage.waitForFunction(()=>innerHeight-document.querySelector('.phone-dock').getBoundingClientRect().bottom===46);
        await homePage.evaluate(()=>{
          const region=document.querySelector('.page-scroll');
          if(region) region.scrollTop=region.scrollHeight; else window.scrollTo(0,document.body.scrollHeight);
        });
        assert(await homePage.evaluate(()=>document.querySelector('.content,.case-study').lastElementChild.getBoundingClientRect().bottom<=document.querySelector('.phone-dock').getBoundingClientRect().top),'Last content clears the dock with a 34px safe area');
        await homePage.locator('.say-hi').tap();
        assert(await homePage.locator('#contact-menu').evaluate(e=>{
          const r=e.getBoundingClientRect();return r.top>=0 && r.bottom<document.querySelector('.phone-dock').getBoundingClientRect().top;
        }),'Contact menu clears the dock with a 34px safe area');
        await homePage.keyboard.press('Escape');
        await homeCDP.send('Emulation.setSafeAreaInsetsOverride',{insets:{}});
      }
      await homePage.screenshot({path:path.join(out,`home-shortcut-${route==='/'?'home':route.replaceAll('/','-')}-${width}-${mode}.png`)});
      await shortcut.focus();
      assert(await shortcut.evaluate(e=>e.matches(':focus-visible') && getComputedStyle(e).outlineStyle!=='none'),'Home shortcut has keyboard focus');
      await homePage.keyboard.press('Enter');
      await homePage.waitForURL(url=>url.pathname==='/' && url.hash==='#home');
      await homePage.waitForFunction(()=>{
        const home=document.querySelector('#home'),region=document.querySelector('.page-scroll');
        if(!home || !region) return false;
        const delta=home.getBoundingClientRect().top-region.getBoundingClientRect().top;
        return delta>=0 && delta<=9;
      });
      assert.equal(await homePage.locator('html').getAttribute('data-mode'),mode);
    }
    for(const route of ['/',pages[1],'/writing/','/writing/install-isaac-lab-in-5-minutes-with-pixi/']) for(const width of [375,1440]) for(const mode of ['light','dark']) {
      await homePage.setViewportSize({width,height:900});
      await homePage.goto(origin+route+'?theme='+mode+(route==='/'?'#projects':'#overview'));
      await homePage.evaluate(()=>document.fonts.ready);
      const shortcut=homePage.locator(width===375?'.phone-dock>.home-link':'aside>.home-link');
      const accent=mode==='light'?'rgb(0, 120, 46)':'rgb(241, 255, 102)';
      assert(await homePage.locator('.intro-contact a,.project h3 .arrow,.links a,.prose a').evaluateAll((nodes,color)=>nodes.every(e=>getComputedStyle(e).color===color),accent),`${route} ${mode} link and arrow accents`);
      for(const phase of ['before','after']) {
        const expected=await homePage.evaluate(()=>[getComputedStyle(document.querySelector('aside')).backgroundColor,getComputedStyle(document.body).color,'none','none']);
        for(const state of ['rest','hover','pressed','keyboard']) {
          if(state==='rest') await homePage.mouse.move(0,0);
          if(state==='hover') await shortcut.hover();
          if(state==='pressed') await homePage.mouse.down();
          if(state==='keyboard') {await homePage.keyboard.press('Tab'); await shortcut.focus();}
          assert.deepEqual(await shortcut.evaluate(e=>{
            const s=getComputedStyle(e); return [s.backgroundColor,s.color,s.boxShadow,s.textDecorationLine];
          }),expected,`Plain home shortcut: ${route} ${width} ${mode} ${phase} ${state}`);
          if(state==='pressed') {await homePage.mouse.move(0,0); await homePage.mouse.up();}
          if(state==='keyboard') assert(await shortcut.evaluate((e,color)=>e.matches(':focus-visible') && getComputedStyle(e).outlineStyle!=='none' && getComputedStyle(e).outlineColor===color,accent));
        }
        if(phase==='before') {
          await homePage.keyboard.press('Enter');
          await homePage.waitForURL(url=>url.pathname==='/' && url.hash==='#home');
          await homePage.waitForFunction(()=>document.querySelector('.home-link[aria-current="location"]'));
        }
      }
      assert.equal(await homePage.locator(width===375?'.phone-dock nav [aria-current]':'aside nav [aria-current]').evaluate(e=>getComputedStyle(e).textDecorationLine),'underline','Section selection remains visible');
    }
    await homePage.goto(origin+'/#home');
    await homePage.evaluate(()=>document.fonts.ready);
    assert(await homePage.locator('#home').evaluate(e=>{
      const delta=e.getBoundingClientRect().top-document.querySelector('.page-scroll').getBoundingClientRect().top;
      return delta>=0 && delta<=9;
    }),'Initial home hash lands at the top section');
    await homePage.close();
    const noScript=await browser.newPage({javaScriptEnabled:false});
    for(const route of ['/',pages[1],'/writing/','/writing/install-isaac-lab-in-5-minutes-with-pixi/']) for(const width of [375,1440]) {
      await noScript.setViewportSize({width,height:900});
      await noScript.goto(origin+route);
      assert(await noScript.locator('html').evaluate(e=>{
        const s=getComputedStyle(e);
        return !e.hasAttribute('data-resolved') && s.getPropertyValue('--link-text').trim().toUpperCase()==='#00782E' && s.getPropertyValue('--focus-ring').trim().toUpperCase()==='#00782E';
      }),'No-script fallback retains the approved light accent');
      const name=noScript.locator(width===375?'.phone-dock>.home-link':'aside>.home-link');
      await name.focus();
      assert.equal(await name.evaluate(e=>getComputedStyle(e).outlineColor),'rgb(0, 120, 46)');
    }
    await noScript.close();
    await page.emulateMedia({reducedMotion:'reduce'});
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
      await page.waitForFunction(id=>{
        const node=document.getElementById(id), region=document.querySelector('.page-scroll');
        const target=node.tagName==='H3'?node:node.closest('.panel') || node;
        const scroll=region || document.scrollingElement;
        const top=Math.max(region?.getBoundingClientRect().top || 0,visualViewport.offsetTop);
        const expected=Math.max(0,Math.min(scroll.scrollHeight-scroll.clientHeight,scroll.scrollTop+target.getBoundingClientRect().top-top-8));
        return Math.abs(scroll.scrollTop-expected)<=1;
      },id);
      await settle();
      const s = await page.evaluate(id => {
        const node = document.getElementById(id), heading = id==='home' ? node.querySelector('h1') : node;
        const panel = node.closest('.panel'), region = document.querySelector('.page-scroll');
        const r = region?.getBoundingClientRect(), v = visualViewport;
        const dock = document.querySelector('.phone-dock');
        const compact = !!dock.getClientRects().length;
        const top = Math.max(r?.top || 0, v.offsetTop), bottom = Math.min(r?.bottom || innerHeight, v.offsetTop+v.height, compact ? dock.getBoundingClientRect().top : Infinity);
        const scroll = region || document.scrollingElement;
        return { id, width:innerWidth, height:innerHeight, top, bottom, headingTop:heading.getBoundingClientRect().top, headingBottom:heading.getBoundingClientRect().bottom, panelTop:panel.getBoundingClientRect().top, nested:node.tagName==='H3', desktop:!!document.querySelector('aside.rail')?.getClientRects().length, clamped:scroll.scrollHeight>scroll.clientHeight && scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-1, active:document.querySelector((compact?'.phone-dock':'aside')+' [aria-current]')?.dataset.section, last:[...document.querySelectorAll('aside [data-section]')].at(-1).dataset.section };
      }, id);
      landings.push(s);
      assert(s.headingTop>=s.top-1, JSON.stringify(s));
      assert(s.headingBottom<=s.bottom+1, JSON.stringify(s));
      const heroAligned = s.id==='home' && s.desktop;
      if (!s.nested && !heroAligned) assert(s.panelTop>=s.top+6, JSON.stringify(s));
      if (!s.clamped) assert(Math.abs((s.nested?s.headingTop:s.panelTop)-s.top-(heroAligned?0:8))<=1, 'Exact landing offset '+JSON.stringify(s));
      assert.equal(s.active, s.clamped?s.last:id, JSON.stringify(s));
    }
    await page.setViewportSize({width:1440,height:900});
    await page.goto(origin+'/?theme=light'); await settle();
    const homeAlignment=await page.evaluate(()=>{
      const nav=document.querySelector('.rail').getBoundingClientRect();
      const about=document.querySelector('.intro').getBoundingClientRect();
      return {nav:{top:nav.top,bottom:nav.bottom,height:nav.height},about:{top:about.top,bottom:about.bottom,height:about.height}};
    });
    assert(Math.abs(homeAlignment.nav.top-homeAlignment.about.top)<=1, 'Desktop navigation rail and About panel top edges align: '+JSON.stringify(homeAlignment));
    assert(homeAlignment.about.height<350, 'About panel stays compact rather than filling the viewport: '+JSON.stringify(homeAlignment));
    for (const mode of ['light','dark']) {
      await page.goto(origin+'/?theme='+mode);
      await page.locator('.page-scroll').focus();
      for (const key of ['Backspace','Delete']) {
        await page.keyboard.press(key);
        assert.equal(await page.locator('.page-scroll').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      }
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>document.querySelector('.page-scroll').scrollTop>0);
      await page.keyboard.press('Tab');
      assert(await page.evaluate(()=>document.activeElement.matches('a,button,select') && getComputedStyle(document.activeElement).outlineStyle!=='none'), 'Keyboard controls retain visible focus');
      assert(await page.locator('.writing-row').evaluateAll(rows=>{
        const rule=getComputedStyle(document.querySelector('.project'),'::before');
        return rows.every(e=>{
          const s=getComputedStyle(e,'::before');
          return s.borderTopWidth===rule.borderTopWidth && s.borderTopStyle===rule.borderTopStyle && s.borderTopColor===rule.borderTopColor && s.left===rule.left && s.right===rule.right;
        });
      }), 'Writing uses the same straight 1px separators as Projects');
      for (const width of [375,1440]) {
        await page.setViewportSize({width,height:900});
        const hoverStyles = [];
        for (const selector of ['.project-link','.writing-row']) {
          const row=page.locator(selector).first();
          await row.hover();
          hoverStyles.push(await row.evaluate(e=>{
            const s=getComputedStyle(e);
            return [s.backgroundColor,s.borderRadius,s.paddingLeft,s.paddingRight,s.marginLeft,s.marginRight];
          }));
        }
        assert.deepEqual(hoverStyles[1],hoverStyles[0], 'Writing and Projects share hover fill, radius and horizontal padding');
      }
    }
    for (const route of pages) {
      assert.equal((await fetch(origin+route)).status, 200);
      for (const [width,height] of [[320,900],[375,900],[414,900],[599,900],[768,900],[903,900],[904,900],[1440,900],[852,393],[320,480],[375,300],[1440,393]]) {
        await page.setViewportSize({ width,height });
        await page.goto(origin+route+'?theme=light');
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => portfolioTheme.fontsLoaded), 'Licensed fonts load');
        assert.equal(await page.locator('h1').count(), 1);
        if(width===1440 && height===900) await verifyFonts(route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
        const gutter=await page.evaluate(()=>{
          const region=document.querySelector('.page-scroll');
          return region ? region.offsetWidth-region.clientWidth : innerWidth-document.documentElement.getBoundingClientRect().width;
        });
        const compact=width-gutter<904;
        assert.equal(await page.locator('.phone-dock').isVisible(), compact, 'Shared compact navigation breakpoint excludes scrollbar space');
        if (compact) assert.equal(await page.locator('.panel').first().evaluate(e=>Math.round(e.getBoundingClientRect().left)), (width<=500?12:24)+gutter/2, 'Shared compact panel gutters');
        assert.equal(await page.locator('.controls,.preview-chrome,.note,.preview-settings,#phone,.link-pending,.footer-links,.intro h2').count(), 0);
        assert.equal(await page.locator('.resume-link').count(),route==='/'?3:2);
        assert.equal(await page.getByRole('button',{name:'Resume',includeHidden:true}).count(),0);
        assert(await page.locator('.copy-email').evaluateAll((nodes,email)=>nodes.length===2&&nodes.every(n=>n.dataset.email===email),expectedEmail));
        assert(await page.locator('.email-fallback input').evaluateAll((nodes,email)=>nodes.every(n=>n.value===email),expectedEmail));
        assert(await page.locator('a[href^="mailto:"]').evaluateAll((nodes,email)=>nodes.every(n=>n.getAttribute('href')==='mailto:'+email),expectedEmail));
        assert(await page.locator('.resume-link').evaluateAll(nodes=>nodes.every(a=>a.tagName==='A'&&a.getAttribute('href')==='/resume.pdf'&&a.target==='_blank'&&a.rel.includes('noopener'))));
        if (route === '/') {
          const hierarchy = await page.evaluate(() => {
            const size = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
            return [size('h1'), size('#projects'), size('.project h3'), size('#writing')];
          });
          assert(hierarchy[0] > hierarchy[1] && hierarchy[1] > hierarchy[2]);
          assert.equal(hierarchy[1], hierarchy[3]);
          assert(await page.evaluate(()=>{
            const gap=(row,heading)=>document.querySelector(row).getBoundingClientRect().top-document.querySelector(heading).getBoundingClientRect().bottom;
            return Math.abs(gap('.project','#projects')-gap('.writing-row','#writing'))<1;
          }), 'Section heading-to-divider spacing matches');
          assert.equal(await page.getByText('Outcome / role', {exact:true}).count(), 0);
          for (const image of await page.locator('.thumbnail').all()) {
            await image.scrollIntoViewIfNeeded();
            await image.evaluate(e => e.decode());
            assert(await image.evaluate(e => {
              const r = e.getBoundingClientRect();
              const facts = e.parentElement.querySelector('.facts').getBoundingClientRect();
              return Math.abs(r.width / r.height - e.naturalWidth / e.naturalHeight) < .03
                && (getComputedStyle(e.parentElement).gridTemplateColumns.split(' ').length !== 1 || facts.bottom <= r.top);
            }), 'Diagrams preserve their aspect ratio and follow facts in single-column layouts');
          }
        } else {
          await page.waitForFunction(()=>{
            const nav=document.querySelector('.phone-dock nav'), hint=document.querySelector('.section-scroll-hint');
            return hint.hidden === (nav.clientWidth===0 || nav.scrollWidth<=nav.clientWidth+1);
          });
        }
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
    for (const route of ['/','/projects/tiny-recursive-model/']) for (const mode of ['light','dark']) {
      await page.setViewportSize({width:375,height:900});
      await page.goto(origin+route+'?theme='+mode);
      await page.locator('.say-hi').click();
      for (const [name,value] of [['prefers-reduced-transparency','reduce'],['prefers-contrast','more']]) {
        await cdp.send('Emulation.setEmulatedMedia',{features:[{name,value}]});
        await page.waitForFunction(()=>[...document.querySelectorAll('.phone-dock nav,.contact-menu')].every(e=>{
          const s=getComputedStyle(e);
          return s.backdropFilter==='none' && s.backgroundColor.startsWith('rgb(');
        }));
      }
      await cdp.send('Emulation.setEmulatedMedia',{features:[]});
      await page.keyboard.press('Escape');
    }
    await page.goto(origin+'/?theme=dark');
    const textLinkStyles=[];
    for (const selector of ['.intro-contact a','.writing-head a']) {
      const link=page.locator(selector).first();
      await page.keyboard.press('Tab'); await link.focus();
      textLinkStyles.push(await link.evaluate(e=>{const s=getComputedStyle(e);return [s.outline,s.outlineOffset,s.textUnderlineOffset];}));
    }
    assert.deepEqual(textLinkStyles[0],textLinkStyles[1], 'Homepage text links share keyboard focus and underline styling');
    const pressedColors=[];
    for (const [route,selector] of [['/','.intro-contact a'],['/','.writing-head a'],['/projects/tiny-recursive-model/','.links a']]) {
      await page.goto(origin+route+'?theme=dark');
      const link=page.locator(selector).first();
      await link.hover(); await page.mouse.down();
      pressedColors.push(await link.evaluate(e=>getComputedStyle(e).backgroundColor));
      await page.mouse.move(1,1); await page.mouse.up();
    }
    assert(pressedColors.every(color=>color===pressedColors[0] && color!=='rgba(0, 0, 0, 0)'), 'Text links share visible pointer-down feedback');
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const route of ['/projects/tiny-recursive-model/','/writing/teaching-a-tiny-recursive-model-to-plan-paths/']) for (const mode of ['light','dark']) for (const width of [320,375,1440]) {
      await page.setViewportSize({width,height:width===1440?900:600});
      await page.goto(origin+route+'?theme='+mode);
      const video=page.locator('video');
      await video.evaluate(v=>v.scrollIntoView({block:'start'}));
      await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
      const initial=await video.evaluate(v=>({paused:v.paused,autoplay:v.autoplay,loop:v.loop,controls:v.controls,inline:v.playsInline,preload:v.preload,width:v.videoWidth,height:v.videoHeight,duration:v.duration,described:!!document.getElementById(v.getAttribute('aria-describedby'))?.textContent}));
      assert.deepEqual({...initial,duration:undefined},{paused:true,autoplay:false,loop:false,controls:true,inline:true,preload:'metadata',width:1920,height:1200,duration:undefined,described:route.startsWith('/projects/')});
      assert(initial.duration>10.8&&initial.duration<11.1);
      assert.equal(await video.getAttribute('poster'),'/images/trm-demo-poster.jpg');
      assert(await video.getAttribute('aria-label'),'Video has an accessible label');
      assert(await video.evaluate(v=>{
        const box=v.getBoundingClientRect(),container=v.closest('.prose,.panel'),bounds=container.getBoundingClientRect(),style=getComputedStyle(container);
        const left=bounds.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft);
        const contentWidth=container.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
        return box.left>=left-1 && box.right<=left+contentWidth+1 && Math.abs(box.width-contentWidth)<1
          && Math.abs(box.width/box.height-v.videoWidth/v.videoHeight)<.002
          && container.scrollWidth<=container.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth
          && getComputedStyle(v).objectFit!=='cover';
      }),`Video fits text width without overflow or crop: ${route} ${width} ${mode}`);
      await video.focus();
      assert(await video.evaluate(v=>v.matches(':focus-visible') && getComputedStyle(v).outlineStyle!=='none'),'Native video retains visible keyboard focus');
      await page.keyboard.press('Space');
      await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.paused&&v.currentTime>.1&&v.getVideoPlaybackQuality().totalVideoFrames>1;});
      await page.keyboard.press('Space'); assert(await video.evaluate(v=>v.paused));
      assert.equal(await page.evaluate(()=>document.querySelector('video').error),null);
      await video.evaluate(v=>{v.currentTime=6;});
      await page.waitForFunction(()=>!document.querySelector('video').seeking);
      await page.screenshot({path:path.join(out,`trm-video-${route.startsWith('/projects/')?'project':'article'}-${mode}-${width}.png`)});
    }
    console.log('PASS project/article TRM videos: responsive bounds, encoded aspect ratio, light/dark, metadata, native controls/focus/Space, seeking and reduced-motion static default');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:375,height:900});
    await page.goto(origin);
    assert.equal(await page.locator('video,iframe').count(),0);
    assert.equal(await page.locator('.writing-row').filter({hasText:'SO-ARM101 in Isaac Sim + ROS 2 + MoveIt 2'}).getAttribute('href'),'https://www.youtube.com/watch?v=0vvhCdKZyQE');
    const homeHtml=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
    assert.equal((homeHtml.match(/class="writing-row" href="\/writing\//g)||[]).length,4);
    assert.equal(new URL(await page.locator('.writing-head a').getAttribute('href'),origin).pathname,'/writing/');
    await page.evaluate(()=>localStorage.removeItem('portfolio-approved-theme'));
    await page.emulateMedia({ colorScheme:'light' }); await page.goto(origin);
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'system');
    await page.emulateMedia({ colorScheme:'dark' }); await page.waitForFunction(()=>document.documentElement.dataset.resolved==='dark');
    await (await theme()).selectOption('light');
    await page.emulateMedia({ colorScheme:'light' }); await page.emulateMedia({ colorScheme:'dark' });
    assert.equal(await page.locator('html').getAttribute('data-resolved'), 'light');
    await page.keyboard.press('Escape'); await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'light');
    await (await nav()).locator('[data-section="projects"]').click(); await landing('projects');
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
    const codePage=await browser.newPage({viewport:{width:375,height:900}});
    await codePage.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedCode=text;}}}));
    await codePage.goto(origin+'/writing/install-isaac-lab-in-5-minutes-with-pixi/');
    const firstBlock=codePage.locator('.code-block').first();
    await firstBlock.waitFor();
    assert.equal(await codePage.locator('.code-block').count(),await codePage.locator('.prose pre').count());
    assert.equal(await firstBlock.locator('.code-language').textContent(),'sh');
    assert(await firstBlock.getByRole('button').evaluate(e=>e.getBoundingClientRect().width>=44 && e.getBoundingClientRect().height>=44),'Mobile copy target remains at least 44px');
    await codePage.setViewportSize({width:1280,height:900});
    assert(await firstBlock.locator('.code-toolbar').evaluate(e=>e.getBoundingClientRect().height<=36),'Desktop code toolbar stays compact');
    await codePage.setViewportSize({width:375,height:900});
    const originalCode=await firstBlock.locator('code').textContent();
    await firstBlock.getByRole('button').focus(); await codePage.keyboard.press('Enter');
    await codePage.waitForFunction(()=>document.querySelector('.code-copy-status').textContent==='Copied.');
    assert.equal(await codePage.evaluate(()=>window.copiedCode),originalCode,'Copies exact code, not the toolbar or highlighted HTML');
    await codePage.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Denied','NotAllowedError');};});
    await firstBlock.getByRole('button').click();
    await codePage.waitForFunction(()=>document.querySelector('.code-copy-status').textContent.includes('Copy unavailable'));
    assert(await firstBlock.getByRole('button').isEnabled(),'Copy failure permits retry');
    await codePage.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined}));
    await firstBlock.getByRole('button').click();
    await codePage.waitForFunction(()=>document.querySelector('.code-copy-status').textContent.includes('Copy unavailable'));
    assert(await codePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Copy failure message fits mobile');
    await codePage.close();
    const writingRoutes = fs.readdirSync(path.join(root,'dist/writing'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>`/writing/${entry.name}/`).sort();
    assert.equal(writingRoutes.length,9, 'All nine local writing guides are published');
    for (const route of ['/writing/',...writingRoutes]) {
      assert.equal((await fetch(origin+route)).status,200,route);
      await page.setViewportSize({width:1280,height:900}); await page.goto(origin+route);
      assert.equal(await page.locator('h1').count(),1,route);
      if(route==='/writing/') {
        await page.locator('.writing-row').first().hover();
        const radii=await page.evaluate(()=>[getComputedStyle(document.querySelector('.panel')).borderRadius,getComputedStyle(document.querySelector('.writing-row')).borderRadius]);
        assert.equal(radii[1],radii[0],'Writing row hover uses the panel’s rounded corners');
      }
      if(route!=='/writing/') {
        const soArmChildren=['so-arm-install-setup','so-arm-import-isaac-sim','so-arm-moveit-setup'];
        const imuChildren=['microros-setup-humble','interfacing-ir-sensor-ros2'];
        const slug=route.split('/')[2];
        const parent=soArmChildren.includes(slug)?'/writing/so-arm100101-lerobot-isaac-sim/':imuChildren.includes(slug)?'/writing/robotic-arm-control-imu/':'/writing/';
        assert.deepEqual(await page.locator('.article-shell .back').evaluateAll(links=>links.map(e=>new URL(e.href).pathname)),[parent,parent,parent],route+' all back links lead to the immediate parent');
        if(slug==='so-arm100101-lerobot-isaac-sim') {
          assert(!/Stretch goals|Coloured soft gripper|Real2Sim|Tanay|Bharat|Sahil/.test(await page.locator('.prose').textContent()));
          assert.equal(await page.locator('[data-section="team"],#team').count(),0);
        }
        const navSize=await page.locator('aside').evaluate(e=>({width:e.getBoundingClientRect().width,overflow:e.scrollWidth>e.clientWidth}));
        assert(navSize.width>=240 && !navSize.overflow,route+' has a readable contents pane without horizontal scrolling');
        assert(await page.locator('aside .sections a').evaluateAll(links=>links.every(e=>getComputedStyle(e).whiteSpace==='normal' && e.scrollWidth<=e.clientWidth)),route+' section names wrap without clipping');
        for(const width of [375,904,1280]) for(const mode of ['light','dark']) {
          await page.setViewportSize({width,height:900}); await page.goto(origin+route+'?theme='+mode);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' article fits '+width);
          assert(await page.locator('.prose pre').evaluateAll(blocks=>blocks.every(e=>{
            const s=getComputedStyle(e);
            return parseFloat(s.borderBottomLeftRadius)===12 && parseFloat(s.paddingLeft)===12 && parseFloat(s.lineHeight)<=21 && s.overflowX==='auto' && e.tabIndex===0;
          })),route+' code blocks are padded, rounded, and keyboard-scrollable');
        }
      }
      assert.equal(await page.locator('a[href*="super.site"],a[href*="assets.super.so"],img[src*="super.so"]').count(),0,route+' has no Super dependency');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+' has no horizontal overflow');
      assert(await page.locator('img').evaluateAll(images=>images.every(i=>i.hasAttribute('alt'))),route+' images have alt text');
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000});
    }
    const contentsPage=await browser.newPage({hasTouch:true});
    contentsPage.on('pageerror',e=>errors.push(e.message));
    await contentsPage.emulateMedia({reducedMotion:'reduce'});
    const contentsCDP=await contentsPage.context().newCDPSession(contentsPage);
    const contentsMeasurements=[];
    for(const route of writingRoutes) for(const width of [320,375,414,768]) for(const mode of ['light','dark']) {
      await contentsPage.setViewportSize({width,height:900});
      await contentsPage.goto(origin+route+'?theme='+mode);
      await contentsPage.evaluate(()=>document.fonts.ready);
      const trigger=contentsPage.locator('.contents-button'),list=contentsPage.locator('#article-contents');
      const destinations=await contentsPage.locator('h1,.prose h2,.prose h3').evaluateAll(nodes=>nodes.map(e=>({id:e.id,label:e.id==='overview'?'Overview':e.textContent})));
      assert.deepEqual(await list.locator('a').evaluateAll(nodes=>nodes.map(e=>({id:e.dataset.section,label:e.textContent.trim()}))),destinations,'Contents preserves every heading destination and full label');
      assert.equal(await list.locator('.subsection').count(),await contentsPage.locator('.prose h3').count(),'Contents retains all h3 destinations');
      assert(!(await list.isVisible()));
      await trigger.focus(); await contentsPage.keyboard.press('Enter');
      await contentsPage.waitForFunction(()=>document.querySelector('#article-contents [aria-current]')===document.activeElement);
      assert.equal(await trigger.getAttribute('aria-expanded'),'true');
      assert.equal(await contentsPage.evaluate(()=>scrollY),0,'Opening Contents does not move the article');
      assert(await list.evaluate(e=>{
        const r=e.getBoundingClientRect(),dock=document.querySelector('.phone-dock').getBoundingClientRect();
        return r.top>=0 && r.bottom<dock.top && e.scrollWidth===e.clientWidth;
      }),'Contents fits above the dock without horizontal scrolling');
      contentsMeasurements.push(await list.evaluate((e,context)=>{
        const r=e.getBoundingClientRect();return {...context,width:r.width,height:r.height,total:e.children.length,visible:[...e.children].filter(a=>{const x=a.getBoundingClientRect();return x.top>=r.top && x.bottom<=r.bottom;}).length};
      },{route,viewport:width,mode}));
      if(/microros|install-isaac-lab|so-arm-import/.test(route)) await contentsPage.screenshot({path:path.join(out,`contents-${route.split('/')[2]}-${width}-${mode}.png`)});
      for(const link of await list.locator('a').all()) {
        await link.focus();
        assert(await link.evaluate(e=>{
          const r=e.getBoundingClientRect(),menu=e.parentElement.getBoundingClientRect();
          return r.width>=44 && r.height>=44 && r.top>=menu.top && r.bottom<=menu.bottom
            && e.matches(':focus-visible') && getComputedStyle(e).outlineStyle!=='none'
            && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
        }),'Every focused Contents destination is visible and has a 44px target');
        if(width===375) {
          const id=await link.getAttribute('data-section');
          await contentsPage.keyboard.press('Enter');
          assert(!(await list.isVisible()),'Selecting a heading closes Contents');
          assert.equal(await contentsPage.evaluate(()=>document.activeElement.id),id);
          assert.equal(decodeURIComponent(new URL(contentsPage.url()).hash),'#'+id);
          assert.equal(await trigger.locator('.contents-current').textContent(),await contentsPage.locator('aside nav [aria-current]').textContent(),'Closed Contents shows the active section');
          await trigger.focus(); await contentsPage.keyboard.press('Enter');
          await contentsPage.waitForFunction(()=>document.querySelector('#article-contents [aria-current]')===document.activeElement);
        }
      }
      await list.locator('a').last().tap();
      assert(!(await list.isVisible()) && await contentsPage.evaluate(()=>document.activeElement.id)===destinations.at(-1).id,'Touch selection closes Contents and focuses its heading');
      await contentsPage.evaluate(()=>scrollTo(0,document.body.scrollHeight));
      assert(await contentsPage.evaluate(()=>document.querySelector('.case-study').lastElementChild.getBoundingClientRect().bottom<=document.querySelector('.phone-dock').getBoundingClientRect().top),'Final article content clears the closed toolbar');
      await trigger.focus(); await contentsPage.keyboard.press('Enter');
      await contentsPage.waitForFunction(()=>document.querySelector('#article-contents [aria-current]')===document.activeElement);
      await contentsPage.locator('.say-hi').tap();
      assert(!(await list.isVisible()) && await contentsPage.locator('#contact-menu').isVisible(),'Contact dismisses Contents');
      await trigger.tap();
      assert(await list.isVisible() && !(await contentsPage.locator('#contact-menu').isVisible()),'Contents dismisses Contact');
      await contentsPage.keyboard.press('Escape');
      assert(!(await list.isVisible()) && await trigger.evaluate(e=>e===document.activeElement),'Escape restores Contents trigger focus');
      await trigger.tap(); await contentsPage.mouse.click(2,2);
      assert(!(await list.isVisible()) && await trigger.getAttribute('aria-expanded')==='false','Outside click dismisses Contents');
      await contentsCDP.send('Emulation.setSafeAreaInsetsOverride',{insets:{bottom:34}});
      await trigger.tap();
      assert(await list.evaluate(e=>e.getBoundingClientRect().top>=0 && e.getBoundingClientRect().bottom<document.querySelector('.phone-dock').getBoundingClientRect().top),'Contents clears the safe area and toolbar');
      await contentsPage.setViewportSize({width:1440,height:900});
      await contentsPage.waitForFunction(()=>document.querySelector('aside nav [aria-current]')===document.activeElement);
      assert(!(await list.isVisible()),'Desktop resize closes Contents and transfers focus');
      await contentsPage.setViewportSize({width,height:900});
      await contentsPage.waitForFunction(()=>document.querySelector('.contents-button')===document.activeElement);
      await contentsCDP.send('Emulation.setSafeAreaInsetsOverride',{insets:{}});
    }
    fs.writeFileSync(path.join(out,'contents-measurements.json'),JSON.stringify(contentsMeasurements,null,2));
    const unicodeRoute='/writing/install-isaac-lab-in-5-minutes-with-pixi/';
    await contentsPage.goto(origin+unicodeRoute);
    const unicodeId=await contentsPage.locator('.prose h3').first().getAttribute('id');
    await contentsPage.goto(origin+unicodeRoute+'#'+encodeURIComponent(unicodeId));
    await contentsPage.evaluate(()=>document.fonts.ready);
    assert(Math.abs(await contentsPage.evaluate(id=>document.getElementById(id).getBoundingClientRect().top,unicodeId)-8)<1,'Encoded Unicode fragment lands on its heading after load');
    await contentsPage.evaluate(()=>{location.hash='overview';});
    await contentsPage.waitForFunction(()=>document.querySelector('.contents-current').textContent==='Overview');
    await contentsPage.evaluate(id=>{location.hash=encodeURIComponent(id);},unicodeId);
    await contentsPage.waitForFunction(id=>Math.abs(document.getElementById(id).getBoundingClientRect().top-8)<1,unicodeId);
    await contentsPage.evaluate(()=>{location.hash='%';});
    await contentsPage.close();
    const generated=fs.readdirSync(path.join(root,'dist'),{recursive:true,withFileTypes:true});
    for (const file of generated) if(file.isFile()&&/\.(html|js|css|json|txt)$/.test(file.name)) {
      const text=fs.readFileSync(path.join(file.parentPath,file.name),'utf8');
      assert(!/https?:\/\/(?:www\.)?(?:atharva-bhorpe\.super\.site|assets\.super\.so|s\.super\.so)/i.test(text), 'Built site has no Super URLs: '+file.name);
    }
    for (const asset of ['MICROROS_SETUP_INSTRUCTIONS_HUMBLE.md','setup_microros_workspace_humble.sh','microros_esp32_sensors_humble.ino']) {
      assert(fs.statSync(path.join(root,'public/downloads/microros',asset)).size>0,asset);
      assert.equal((await fetch(origin+'/downloads/microros/'+asset)).status,200,asset+' is downloadable');
    }
    // Storage denial: preference survives via the actual clean-route anchor URL.
    await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));
    await page.goto(origin); await (await theme()).selectOption('dark'); await page.keyboard.press('Escape');
    await page.reload(); assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
    await (await nav()).locator('[data-section="projects"]').click(); await page.locator('.project-link').first().click();
    assert.equal(new URL(page.url()).searchParams.get('theme'),'dark');
    await page.locator('main>.back').click(); assert.equal(new URL(page.url()).pathname,'/'); await landing('projects');
    await page.locator('.project-link').first().click();
    await page.locator(await page.locator('.phone-dock').isVisible()?'.phone-dock>.home-link':'aside>.home-link').click();
    await landing('home');
    assert.equal(new URL(page.url()).pathname,'/');
    assert.equal(new URL(page.url()).searchParams.get('theme'),'dark');
    assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
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
