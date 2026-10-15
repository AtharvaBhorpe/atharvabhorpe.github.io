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
const articles = fs.readdirSync(path.join(root,'dist/writing')).filter(id=>fs.statSync(path.join(root,'dist/writing',id)).isDirectory()).map(id=>`/writing/${id}/`);
const allRoutes = [...pages,'/writing/',...articles];
const report = {routes:[],responsive:[],motion:[],contrasts,limitations:['Physical Safari/iOS and native touch are not emulated by desktop Chromium.']};
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async () => {
  fs.mkdirSync(out,{recursive:true});
  const reservation=net.createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  const origin=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','preview','--ignore-lock','--host','127.0.0.1','--port',String(port)],{cwd:root,stdio:'pipe'});
  let browser,page,serverLog='';
  server.stdout.on('data',b=>serverLog+=b); server.stderr.on('data',b=>serverLog+=b);
  try {
    for(let i=0;i<100;i++) {try {if((await fetch(origin)).ok) break;}catch{} if(i===99) throw new Error(serverLog); await sleep(100);}
    browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache','--hide-scrollbars']});
    page=await browser.newPage({viewport:{width:1505,height:1045}});
    page.setDefaultTimeout(7000);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    const goto=async(route='/',mode='light')=>{await page.goto(origin+route+'?theme='+mode);await page.evaluate(()=>document.fonts.ready);};
    const showMenu=async()=>{if(await page.locator('.menu-toggle').isVisible() && await page.locator('#navigation-panel').isHidden()) await page.locator('.menu-toggle').click();};
    const scroll=async(top)=>page.evaluate(top=>(document.scrollingElement||window).scrollTo({top,behavior:'instant'}),top);
    const inspect=()=>page.evaluate(()=>{
      const visible=e=>e.checkVisibility();
      const controls=[...document.querySelectorAll('a,button,select,input')].filter(visible);
      return {
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth,document.scrollingElement?.scrollWidth||0)>innerWidth+1,
        tiny:controls.map(e=>({text:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,65),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(r=>r.w<43.9||r.h<43.9),
        fonts:['Satoshi','Cabinet Grotesk'].map(family=>({family,checked:document.fonts.check(`500 18px "${family}"`),loaded:[...document.fonts].some(f=>f.family.replace(/["']/g,'')===family&&f.status==='loaded')})),
        missingTargets:[...document.querySelectorAll('[data-section]')].filter(e=>!document.getElementById(e.dataset.section)).map(e=>e.dataset.section),
        brokenImages:[...document.images].filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.src)
      };
    });
    for(const route of allRoutes) {
      await goto(route);
      assert.equal(await page.locator('h1').count(),1,route+' has one headline');
      assert.equal(await page.locator('.site-navigation').count(),1,'One navigation instance');
      assert.equal(await page.locator('.theme-toggle').count(),1,'One appearance control');
      const state=await inspect();
      assert(!state.overflow,route+' overflows'); assert.deepEqual(state.tiny,[],route+' target sizes');
      assert(state.fonts.every(f=>f.checked&&f.loaded),route+' real fonts loaded');
      assert.deepEqual(state.missingTargets,[]); assert.deepEqual(state.brokenImages,[]);
      const text=await page.locator('body').innerText();
      assert(!/atharva-bhorpe\.super\.site|assets\.super\.so|s\.super\.so/.test(await page.content()));
      if(route.includes('/writing/') && route!=='/writing/') {
        assert((await page.locator('.prose').innerText()).length>300,'Article text retained');
        const headings=await page.locator('.prose h2,.prose h3').evaluateAll(es=>es.map(e=>e.id));
        const targets=await page.locator('[data-section]').evaluateAll(es=>es.map(e=>e.dataset.section));
        assert(headings.every(id=>targets.includes(id)),'Contents follows actual headings');
        assert.equal(await page.locator('.code-block').count(),await page.locator('.prose pre').count(),'Every code block has its copy toolbar');
        assert(await page.locator('main>.back').getAttribute('href'),'Article back link');
      }
      if(route==='/') {
        assert.equal(await page.locator('img[src="/images/portrait.png"]').count(),1,'The portrait appears once');
        assert.equal(await page.locator('#home img[src="/images/portrait.png"]').count(),1,'The portrait belongs to the opening introduction');
        assert(await page.locator('#home').evaluate(e=>Boolean(e.compareDocumentPosition(document.getElementById('projects'))&Node.DOCUMENT_POSITION_FOLLOWING)),'The personal introduction precedes projects');
        assert.equal(await page.locator('.project-record').count(),4);
        assert.equal(await page.locator('.story').count(),3);
        assert.equal(await page.locator('.writing-more .writing-row').count(),2);
        assert.match(text,/evaluation not independently reproduced/);
        assert.match(text,/Simulation results/); assert.match(text,/student team/);
        assert.match(text,/without published accuracy or latency measurements/);
        assert.equal(await page.getByText(/^Tiny Recursive Model for path planning$/i).count(),1,'TRM recording and facts share one visible title');
        for(const record of await page.locator('.project-record').all()) {
          assert.equal(await record.getByRole('heading',{level:3}).count(),1,'Each project owns its title');
          assert.equal(await record.locator('.facts').count(),1,'Each project owns its facts');
          assert.equal(await record.getByRole('link',{name:/View project:/}).count(),1,'Each project owns its case-study action');
        }
        assert.equal(await page.locator('.project-record').first().locator('video').count(),1,'The TRM recording belongs to the TRM article');
        assert.equal(await page.locator('#projects-heading').isVisible(),true,'Projects navigation has a visible destination heading');
        assert(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight&&getComputedStyle(document.body).overflow!=='hidden'),'Homepage uses document scrolling');
        const destinations=await page.locator('.project-link').evaluateAll(es=>es.map(e=>new URL(e.href).pathname));
        assert.deepEqual(destinations,['/projects/tiny-recursive-model/','/projects/cost-effective-amr/','/projects/autonomous-insertion/','/projects/imu-controlled-arm/']);
      }
      if(route==='/writing/') {
        const listed=await page.locator('.writing-list a').evaluateAll(es=>es.map(e=>new URL(e.href).pathname));
        assert(articles.every(route=>listed.includes(route)),'All writing includes every published local article');
        assert.equal(new Set(listed).size,listed.length,'Writing index has no duplicate destinations');
        for(const sequence of [
          ['so-arm100101-lerobot-isaac-sim','so-arm-install-setup','so-arm-import-isaac-sim','so-arm-moveit-setup'],
          ['robotic-arm-control-imu','microros-setup-humble','interfacing-ir-sensor-ros2'],
        ]) {
          const positions=sequence.map(id=>listed.indexOf(`/writing/${id}/`));
          assert(positions.every((position,index)=>index===0||position>positions[index-1]),'Tutorial steps retain their documented reading order');
        }
      }
      report.routes.push({route,...state});
    }
    for(const file of Object.keys(approvedAssets)) {
      const response=await fetch(origin+'/'+file);assert.equal(response.status,200,file);
      assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),approvedAssets[file],file+' served bytes');
    }
    for(const privatePath of ['/.env','/README.md','/tests/portfolio.cjs','/resume-public.pdf']) assert.equal((await fetch(origin+privatePath)).status,404,privatePath+' not published');
    console.log('All 15 routes, content, font bytes, palette contrast and public-file boundaries passed.');

    for(const width of [320,375,414,768,904,1199,1200,1440,1505]) for(const mode of ['light','dark']) {
      await page.setViewportSize({width,height:900});
      for(const route of ['/','/projects/cost-effective-amr/','/writing/','/writing/so-arm100101-lerobot-isaac-sim/']) {
        await goto(route,mode);
        const state=await inspect(); assert(!state.overflow,`${route} ${width} ${mode} overflow`);assert.deepEqual(state.tiny,[],`${route} ${width} targets`);
        assert.equal(await page.locator('.menu-toggle').isVisible(),width<1200);
        assert(await page.locator('.theme-toggle').evaluate(button=>{const r=button.getBoundingClientRect(),name=document.querySelector('.identity-row .name').getBoundingClientRect();return r.left>=name.right&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Theme toggle is exposed to the right of the name at '+width);
        assert.equal(await page.getByRole('combobox',{name:'Theme'}).count(),0,'No theme dropdown remains');
        await showMenu();
        const panel=await page.locator('#navigation-panel').boundingBox();
        if(width<1200) assert(panel.y>=72 && panel.y+panel.height<=901,'Menu fits viewport');
        for(const control of await page.locator('#navigation-panel a,#navigation-panel select,#navigation-panel button').all()) {
          await control.focus();
          assert(await control.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Focused menu/rail control is visible: '+await control.textContent());
        }
        if(width<1200) {await page.keyboard.press('Escape');assert(await page.locator('.menu-toggle').evaluate(e=>e===document.activeElement));assert(await page.locator('#navigation-panel').isHidden());}
        if(route==='/') {
          await page.locator('#writing').scrollIntoViewIfNeeded();
          for(const link of await page.locator('.story .action').all()) {
            await link.focus();
            assert(await link.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Story link is exposed at '+width);
            assert.equal(await link.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
          }
          assert(await page.locator('.rbot-frame img').evaluate(e=>e.getBoundingClientRect().width<=675.1),'Never upscale RBot');
          const stories=await page.locator('.story').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
          for(let i=0;i<stories.length;i++) for(let j=i+1;j<stories.length;j++) {
            const a=stories[i],b=stories[j];
            assert(!(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1),'Tutorial stories must not obscure one another');
          }
        }
        report.responsive.push({route,width,mode,passed:true});
      }
    }
    // 720 CSS px at DPR 2 represents a 1440px screen at 200% browser zoom.
    const zoom=await browser.newPage({viewport:{width:720,height:450},deviceScaleFactor:2});
    await zoom.goto(origin+'/?theme=dark');await zoom.evaluate(()=>document.fonts.ready);
    assert(await zoom.evaluate(()=>document.body.scrollWidth<=innerWidth),'200% equivalent viewport');await zoom.close();
    for(const viewport of [{width:1440,height:393},{width:852,height:393},{width:375,height:300}]) {
      await page.setViewportSize(viewport);await goto('/writing/so-arm100101-lerobot-isaac-sim/');await showMenu();
      const last=page.locator('#navigation-panel a,#navigation-panel button').last();await last.focus();
      assert(await last.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Short viewport keeps controls reachable');
    }
    console.log('Compact, medium, expanded, both themes, short viewports and 200% equivalent geometry passed.');

    for(const width of [375,1440]) for(const route of ['/','/writing/install-isaac-lab-in-5-minutes-with-pixi/']) {
      await page.setViewportSize({width,height:900});await goto(route);
      const targets=await page.locator('[data-section]').evaluateAll(es=>es.map(e=>e.dataset.section));
      for(const id of [targets[1],targets.at(-1),targets[0]]) {
        await showMenu();
        // Attribute comparison handles punctuation and Unicode IDs without CSS escaping.
        await page.locator('[data-section]').evaluateAll((es,id)=>{const link=es.find(e=>e.dataset.section===id);if(link instanceof HTMLElement)link.click();},id);
        assert.equal(decodeURIComponent(new URL(page.url()).hash.slice(1)),id);
        assert.equal(await page.evaluate(()=>document.activeElement.id),id);
        assert.equal(await page.locator('[aria-current="location"]').getAttribute('data-section'),id);
        if(width<1200) assert(await page.locator('#navigation-panel').isHidden());
      }
      await page.goBack();
      await page.waitForFunction(id=>decodeURIComponent(location.hash.slice(1))===id,targets.at(-1));
      await page.goForward();
      await page.waitForFunction(id=>decodeURIComponent(location.hash.slice(1))===id,targets[0]);
    }
    await page.setViewportSize({width:375,height:900});await goto();await showMenu();
    await page.locator('.menu-toggle').focus();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('data-section'),'home');assert(await page.locator('main').evaluate(e=>e.inert),'Content behind the open menu cannot receive focus');
    await page.keyboard.press('Escape');assert(await page.locator('.menu-toggle').evaluate(e=>e.matches(':focus-visible')));
    await showMenu();await page.mouse.click(5,100);assert(await page.locator('#navigation-panel').isHidden(),'Outside click closes');
    await page.locator('.menu-toggle').focus();await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>document.querySelector('#navigation-panel').contains(document.activeElement));assert(await page.locator('#navigation-panel').evaluate(e=>e.contains(document.activeElement)),'Resize moves focus into expanded navigation');
    await page.setViewportSize({width:375,height:900});await page.waitForFunction(()=>document.activeElement===document.querySelector('.menu-toggle'));assert(await page.locator('.menu-toggle').evaluate(e=>e===document.activeElement),'Resize returns focus before hiding links');

    await goto('/','system');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.resolved==='dark');
    const theme=page.getByRole('button',{name:/^Theme:/});
    assert.equal(await theme.getAttribute('aria-label'),'Theme: System. Switch to Light.');
    assert(await theme.locator('[data-theme-icon="system"]').isVisible(),'System icon represents the preference even when the page is dark');
    await theme.click();assert.equal(await page.locator('html').getAttribute('data-mode'),'light');
    await page.reload();assert.equal(await page.locator('html').getAttribute('data-resolved'),'light');
    await theme.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
    await page.keyboard.press('Space');assert.equal(await page.locator('html').getAttribute('data-mode'),'system');
    assert.equal(await page.locator('.theme-status').innerText(),'System theme selected.');
    await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.resolved==='light');
    assert(await theme.locator('[data-theme-icon="system"]').isVisible(),'System preference survives device appearance changes');
    await theme.click();await theme.click();assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
    await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-resolved'),'dark','Explicit theme overrides device appearance');
    await page.locator('.project-link').first().click();assert.equal(await page.locator('html').getAttribute('data-resolved'),'dark');await page.evaluate(()=>history.back());await page.waitForFunction(()=>location.pathname==='/'&&document.documentElement.dataset.resolved==='dark');assert.equal(await page.locator('html').getAttribute('data-resolved'),'dark');
    const denied=await browser.newPage();await denied.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}});});
    await denied.goto(origin+'/?theme=dark');assert.equal(await denied.locator('html').getAttribute('data-resolved'),'dark');
    await denied.getByRole('button',{name:/^Theme:/}).click();
    assert.equal(await denied.locator('html').getAttribute('data-mode'),'system');
    assert.equal(new URL(denied.url()).searchParams.get('theme'),'system','Theme cycling works through the URL when storage is denied');await denied.close();
    const freshTheme=await browser.newPage();await freshTheme.goto(origin+'/');
    assert.equal(await freshTheme.locator('html').getAttribute('data-mode'),'system','New visitors default to System');await freshTheme.close();

    await page.setViewportSize({width:1440,height:900});await goto();
    for(const behavior of ['success','reject','absent']) {
      await page.evaluate(behavior=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:behavior==='absent'?undefined:{writeText:async text=>{if(behavior==='reject')throw Error('denied');window.copiedText=text;}}}),behavior);
      await page.locator('footer .copy-email').click();
      if(behavior==='success') {assert.equal(await page.evaluate(()=>window.copiedText),expectedEmail);assert.equal(await page.locator('footer .copy-status').innerText(),'Email copied.');}
      else {const input=page.locator('footer .email-fallback input');assert(await input.isVisible());assert.equal(await input.inputValue(),expectedEmail);assert(await input.evaluate(e=>e instanceof HTMLInputElement&&e.readOnly&&e===document.activeElement&&e.selectionEnd-e.selectionStart===e.value.length));}
      assert(await page.locator('footer .copy-email').isEnabled());
    }
    await goto('/writing/install-isaac-lab-in-5-minutes-with-pixi/');
    const code=page.locator('.code-block').first();
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text;}}}));
    await code.locator('button').click();assert.equal(await page.evaluate(()=>window.copiedText),await code.locator('code').textContent());assert.equal(await code.locator('[role=status]').innerText(),'Copied.');
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
    await code.locator('button').click();assert.match(await code.locator('[role=status]').innerText(),/Select the code/);assert(await code.locator('button').isEnabled());
    console.log('Anchor focus, menu keyboard/resize, theme persistence and both clipboard fallbacks passed.');

    for(const route of ['/','/projects/tiny-recursive-model/','/writing/teaching-a-tiny-recursive-model-to-plan-paths/']) {
      await goto(route);const video=page.locator('video').first();await video.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
      assert(await video.evaluate(e=>e.controls&&!e.autoplay&&!e.loop&&e.preload==='metadata'&&getComputedStyle(e).objectFit==='contain'));
      assert(await video.evaluate(e=>Math.abs(e.videoWidth/e.videoHeight-1.6)<.01),'Recording uses its display aspect ratio');
      await video.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('video').currentTime>.1);
      assert(await video.evaluate(e=>e.getVideoPlaybackQuality().totalVideoFrames>0),'Actual video frames decoded');
      await video.evaluate(e=>{if(e instanceof HTMLVideoElement){e.pause();e.currentTime=6;}});await page.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-6)<.1&&!document.querySelector('video').seeking);
    }
    const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:375,height:900}});
    for(const route of ['/','/writing/install-isaac-lab-in-5-minutes-with-pixi/']) {
      await nojs.goto(origin+route);assert(await nojs.locator('#navigation-panel').isVisible());assert(await nojs.locator('main').isVisible());
      assert(await nojs.evaluate(()=>[...document.querySelectorAll('[data-reveal]')].every(e=>getComputedStyle(e).opacity==='1')),'No-JS content visible');
      assert(await nojs.evaluate(()=>document.body.scrollWidth<=innerWidth));
    }
    await nojs.close();
    // Sample actual browser animations without replacing their behavior.
    const motion=await browser.newPage({viewport:{width:1505,height:900}});
    await motion.addInitScript(()=>{
      window.motionEvidence=[];
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(frames,options){
        const animation=animate.call(this,frames,options);
        if(!this.dataset.hero&&!this.dataset.reveal) return animation;
        const record={target:this.dataset.hero||this.dataset.reveal,section:this.closest('section')?.id||'introduction',options,frames,samples:[],plays:0};
        window.motionEvidence.push(record);
        const sample=()=>record.samples.push({time:animation.currentTime,state:animation.playState,opacity:getComputedStyle(this).opacity,transform:getComputedStyle(this).transform});
        const capture=()=>[16,140,350,850].forEach(delay=>setTimeout(sample,delay));capture();
        const play=animation.play.bind(animation);
        animation.play=()=>{record.plays++;play();capture();};
        return animation;
      };
    });
    const fresh=async(label)=>{await motion.emulateMedia({reducedMotion:'no-preference'});await motion.goto(origin+'/?theme=light&check='+label,{waitUntil:'domcontentloaded'});};
    const enter=async(selector)=>{
      await motion.evaluate(selector=>{const e=document.querySelector(selector),r=document.scrollingElement;r.scrollTop+=e.getBoundingClientRect().top-innerHeight-150;},selector);
      await sleep(160);
      for(let i=0;i<3;i++){await motion.evaluate(()=>document.scrollingElement.scrollBy({top:80,behavior:'instant'}));await sleep(60);}
    };
    await fresh('hero');await motion.screenshot({path:path.join(out,'hero-entrance-start.png')});await sleep(900);
    let evidence=await motion.evaluate(()=>motionEvidence.filter(r=>['intro','media'].includes(r.target)&&r.section!=='writing'));
    assert.equal(evidence.length,2,'Introduction and lead media entrance are wired');
    assert(evidence.every(r=>r.samples.some(s=>s.state==='running'&&s.transform!=='none')&&r.samples.some(s=>s.transform==='none')),'Hero really moves and reaches its final state');
    report.motion.push({scenario:'hero entrance',evidence});await motion.screenshot({path:path.join(out,'hero-entrance-finished.png')});
    for(const [name,selector] of [['project','.rbot-frame img'],['writing','.story-main .story-media']]) {
      await fresh(name);await sleep(900);await enter(selector);
      const during=await motion.locator(selector).evaluate(e=>({opacity:Number(getComputedStyle(e).opacity),transform:getComputedStyle(e).transform,played:e.dataset.revealPlayed}));
      assert(during.opacity>0&&during.opacity<1,`${name} has an actual intermediate reveal frame: ${JSON.stringify(during)}`);
      if(name==='project') assert.notEqual(during.transform,'none'); else assert.equal(during.transform,'none','Writing uses a distinct opacity-only reveal');
      await motion.screenshot({path:path.join(out,name+'-reveal-running.png')});await sleep(750);
      assert.equal(await motion.locator(selector).evaluate(e=>getComputedStyle(e).opacity),'1');
      evidence=await motion.evaluate(()=>motionEvidence.filter(r=>r.plays>0));report.motion.push({scenario:name+' reveal',during,evidence});
    }
    await fresh('rapid');await sleep(900);
    const created=await motion.evaluate(()=>motionEvidence.length);
    for(let i=0;i<2;i++){await motion.evaluate(()=>document.scrollingElement.scrollTo(0,100000));await sleep(50);await motion.evaluate(()=>document.scrollingElement.scrollTo(0,0));await sleep(50);}
    assert(await motion.evaluate(()=>[...document.querySelectorAll('[data-reveal]')].every(e=>getComputedStyle(e).opacity==='1'&&e.dataset.revealPlayed==='true')),'Two rapid passes leave all visited groups visible');
    assert.equal(await motion.evaluate(()=>motionEvidence.length),created,'No reveal is recreated');
    assert(await motion.evaluate(()=>motionEvidence.every(r=>r.plays<=1)),'Reveals play once');
    await motion.evaluate(()=>{const r=document.scrollingElement;r.scrollTop+=document.querySelector('#writing').getBoundingClientRect().top-80;});
    const middle=await motion.evaluate(()=>document.scrollingElement.scrollTop);
    await motion.reload();await sleep(900);
    assert(Math.abs(await motion.evaluate(()=>document.scrollingElement.scrollTop)-middle)<3,'Middle scroll position restored');
    assert(await motion.evaluate(()=>[...document.querySelectorAll('[data-reveal]')].filter(e=>e.getBoundingClientRect().top<innerHeight).every(e=>getComputedStyle(e).opacity==='1')),'Restored content never disappears');
    assert(!await motion.evaluate(()=>motionEvidence.some(r=>r.target==='intro')),'No hero replay in middle of page');
    report.motion.push({scenario:'two rapid passes and middle reload',passed:true,restoredScroll:middle});
    for(const change of ['resize','reduced preference']) {
      await fresh(change);await sleep(900);await enter('.rbot-frame img');
      if(change==='resize') await motion.setViewportSize({width:1440,height:850});
      else {
        await motion.evaluate(()=>{window.unrelatedAnimation=document.querySelector('h1').animate([{opacity:1},{opacity:1}],{duration:10000});});
        await motion.emulateMedia({reducedMotion:'reduce'});
      }
      await sleep(100);
      assert(await motion.evaluate(()=>[...document.querySelectorAll('[data-reveal]')].every(e=>getComputedStyle(e).opacity==='1'&&e.dataset.revealPlayed==='true')),'Final visibility after '+change);
      if(change!=='resize') assert.equal(await motion.evaluate(()=>unrelatedAnimation.playState),'running','Preference cleanup does not cancel unrelated animations');
      report.motion.push({scenario:change+' during playback',passed:true});
    }
    await motion.goto(origin+'/?theme=light&check=reduced');await sleep(100);
    assert.equal(await motion.evaluate(()=>motionEvidence.length),0,'Reduced-motion load is immediately static');
    await motion.screenshot({path:path.join(out,'reduced-motion.png')});await motion.close();
    console.log('Actual hero/project/writing frames, once-only reveals, rapid scroll, restoration, resize and reduced-motion changes passed.');

    // Tall viewports capture complete sections without screenshot-induced scrollport clipping.
    for(const width of [375,904,1505]) for(const mode of ['light','dark']) {
      await page.setViewportSize({width,height:width===1505?1045:900});await goto('/',mode);await scroll(0);
      await page.screenshot({path:path.join(out,`home-${width}-${mode}.png`)});
      await page.setViewportSize({width,height:2400});
      for(const id of ['home','writing','contact']) {
        await page.locator('#'+id).scrollIntoViewIfNeeded();
        await page.locator('#'+id).screenshot({path:path.join(out,`${id}-${width}-${mode}.png`)});
      }
      await page.setViewportSize({width,height:900});await goto('/writing/install-isaac-lab-in-5-minutes-with-pixi/',mode);
      await page.screenshot({path:path.join(out,`article-${width}-${mode}.png`)});
    }
    assert.deepEqual(errors,[],'No browser runtime errors');
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
    console.log(`Passed. Evidence: ${out}. Temporary server and browser closed.`);
  } catch(error) {
    if(page) await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
    throw error;
  } finally {
    await browser?.close();server.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
