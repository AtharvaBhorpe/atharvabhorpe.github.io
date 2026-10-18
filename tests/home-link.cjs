const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('playwright/test');

async function homeLinkChecks(browser, origin, out) {
  fs.mkdirSync(out,{recursive:true});
  const results=[], errors=[];
  const devices=[[390,844,true],[1366,1024,true],[1440,900,false]];
  const queries=['','?theme=dark','?theme=light&source=name-test'];
  const plain = e=>{
    const s=getComputedStyle(e);
    return s.backgroundColor==='rgba(0, 0, 0, 0)' && s.backgroundImage==='none' && s.textDecorationLine==='none' && s.boxShadow==='none' && s.textShadow==='none' && !e.hasAttribute('aria-current');
  };
  const landed = async (page,id,native=false) => page.waitForFunction(({id,native})=>{
    const node=document.getElementById(id);
    if(!node) return false;
    const padding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
    const destination=scrollY+node.getBoundingClientRect().top-padding;
    const clamp=y=>Math.min(document.scrollingElement.scrollHeight-innerHeight,Math.max(0,y));
    const targets=[clamp(destination)];
    // Initial fragments/history can use native CSS scroll-margin as well as scroll-padding.
    if(native) targets.push(clamp(destination-(parseFloat(getComputedStyle(node).scrollMarginTop)||0)));
    return targets.some(target=>Math.abs(scrollY-target)<1);
  },{id,native});
  for(const [width,height,hasTouch] of devices) for(const reducedMotion of ['no-preference','reduce']) for(const query of queries) {
    const page=await browser.newPage({viewport:{width,height},hasTouch,reducedMotion,colorScheme:'light'});
    page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.addInitScript(()=>{
        window.homeTrace={token:crypto.randomUUID(),calls:[],positions:[]};
        const scroll=window.scrollTo;
        window.scrollTo=function(...args){window.homeTrace.calls.push(args[0]);return scroll.apply(this,args);};
        addEventListener('scroll',()=>window.homeTrace.positions.push(scrollY),{passive:true});
      });
      await page.goto(origin+'/'+query+'#writing');await page.evaluate(()=>document.fonts.ready);
      await landed(page,'writing',true);
      assert(await page.evaluate(()=>homeTrace.calls.every(c=>c.behavior==='instant')),'Initial hashes must not animate');
      const name=page.getByRole('link',{name:'Atharva Bhorpe',exact:true});
      const menu=page.getByRole('button',{name:'Menu',exact:true});
      const original=await page.evaluate(()=>({token:homeTrace.token,search:location.search,mode:document.documentElement.dataset.mode}));
      await page.evaluate(()=>history.replaceState({...history.state,nameTest:'preserved'},'',location.href));
      const historyLength=await page.evaluate(()=>history.length);
      for(const activation of ['pointer','repeat','keyboard']) {
        await page.evaluate(()=>scrollTo({top:document.scrollingElement.scrollHeight,behavior:'instant'}));
        await page.waitForFunction(()=>scrollY>1000);
        if(hasTouch && activation==='pointer') {
          await menu.tap();
          await expect(menu).toHaveAttribute('aria-expanded','true');
          await page.getByRole('navigation',{name:'Sections',exact:true}).getByRole('link',{name:'Writing',exact:true}).focus();
          assert(await page.locator('main').evaluate(e=>e.inert));
        }
        if(activation==='keyboard') {
          await name.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
          await expect(name).toBeFocused();
          const focusStyle=await name.evaluate(e=>({visible:e.matches(':focus-visible'),style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth,color:getComputedStyle(e).outlineColor}));
          assert(focusStyle.visible && focusStyle.style==='solid' && parseFloat(focusStyle.width)>0 && focusStyle.color!=='rgba(0, 0, 0, 0)',`Visible keyboard focus on plain name: ${JSON.stringify(focusStyle)}`);
        } else if(!hasTouch) await name.hover();
        assert(await name.evaluate(plain),'Name stays plain on hover and keyboard focus');
        const start=await page.evaluate(()=>{homeTrace.calls=[];homeTrace.positions=[];return scrollY;});
        assert(start>1000,'Start well below the hero');
        if(activation==='keyboard') await page.keyboard.press('Enter');
        else if(hasTouch) await name.tap();
        else await name.click();
        await landed(page,'home');
        const observed=await page.evaluate(()=>({...homeTrace,y:scrollY,search:location.search,hash:location.hash,mode:document.documentElement.dataset.mode,state:history.state,length:history.length}));
        const intermediate=observed.positions.filter(y=>y>observed.y+2 && y<start-2);
        const result={width,hasTouch,reducedMotion,query,activation,start,end:observed.y,intermediateSamples:intermediate.length,sameDocument:observed.token===original.token,calls:observed.calls};
        results.push(result);
        fs.writeFileSync(path.join(out,'home-link.json'),JSON.stringify(results,null,2)+'\n');
        assert.equal(observed.token,original.token,`Name must use same-document navigation: ${JSON.stringify(result)}`);
        assert.equal(observed.search,original.search,'Preserve the complete homepage query');
        assert.equal(observed.mode,original.mode);assert.equal(observed.hash,'#home');
        assert.equal(observed.state.nameTest,'preserved');assert.equal(observed.length,historyLength+1,'Repeated #home activation must not add history entries');
        assert.equal(observed.calls.length,1,'Reuse one section-navigation scroll call');
        assert.equal(observed.calls[0].behavior,reducedMotion==='reduce'?'instant':'smooth');
        if(reducedMotion==='reduce') assert.equal(intermediate.length,0,'Reduced motion jumps directly to home');
        else assert(intermediate.length>0,'Actual intermediate positions prove smooth movement, not just a smooth option');
        await expect(page.locator('#home')).toBeFocused();
        assert(await name.evaluate(plain),'Name stays plain while Home is selected');
        assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
        if(hasTouch) {await expect(menu).toHaveAttribute('aria-expanded','false');await expect(page.locator('#navigation-panel')).toBeHidden();}
      }
      if(reducedMotion==='no-preference' && query) await page.screenshot({path:path.join(out,`home-${width}-${original.mode}.png`)});
      await page.goBack();await expect(page).toHaveURL(new RegExp('#writing$'));await landed(page,'writing',true);
      await page.goForward();await expect(page).toHaveURL(new RegExp('#home$'));await landed(page,'home');
      assert.equal(await page.evaluate(()=>homeTrace.token),original.token,'History stays in the same document');
      if(hasTouch) {
        await menu.tap();await page.getByRole('navigation',{name:'Sections',exact:true}).getByRole('link',{name:'Home',exact:true}).focus();
        await page.keyboard.press('Escape');await expect(menu).toBeFocused();
        assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
      }
      // Each route keeps normal document navigation and the existing theme URL handling.
      if(reducedMotion==='no-preference' && query==='?theme=dark') for(const route of ['/projects/tiny-recursive-model/','/writing/','/writing/install-isaac-lab-in-5-minutes-with-pixi/']) {
        await page.goto(origin+route+'?theme=dark');await page.evaluate(()=>document.fonts.ready);
        const previous=await page.evaluate(()=>homeTrace.token);
        const title=await page.locator('h1').innerText();
        if(hasTouch) await name.tap();else await name.click();
        await expect(page).toHaveURL(origin+'/?theme=dark#home');await page.evaluate(()=>document.fonts.ready);await landed(page,'home');
        assert.notEqual(await page.evaluate(()=>homeTrace.token),previous,'Cross-page return loads the homepage normally');
        assert(await page.evaluate(()=>homeTrace.calls.every(c=>c.behavior==='instant')),'No invented cross-page animation');
        assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
        // BFCache restoration does not fire a new load event. Wait for the URL and restored content.
        await page.evaluate(()=>history.back());await expect(page).toHaveURL(origin+route+'?theme=dark');
        await expect(page.locator('h1')).toHaveText(title);
        await expect(page.locator('html')).toHaveAttribute('data-mode','dark');
      }
    } catch(error) {
      await page.screenshot({path:path.join(out,'failure.png')});
      throw error;
    } finally {await page.close();}
  }
  // Native fragment fallback remains functional without either enhancement script.
  for(const [width,height,hasTouch] of [devices[0],devices[2]]) for(const fallback of ['no-js','no-navigation']) {
    const page=await browser.newPage({viewport:{width,height},hasTouch,javaScriptEnabled:fallback!=='no-js'});
    try {
      if(fallback==='no-navigation') await page.route('**/navigation.js',route=>route.abort());
      await page.goto(origin+'/?theme=dark&source=fallback#home');await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>scrollTo({top:document.scrollingElement.scrollHeight,behavior:'instant'}));
      const name=page.getByRole('link',{name:'Atharva Bhorpe',exact:true});
      if(hasTouch) await name.tap();else await name.click();
      await landed(page,'home');await expect(page).toHaveURL(origin+'/?theme=dark&source=fallback#home');
      assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
    } finally {await page.close();}
  }
  assert.deepEqual(errors,[]);
  return {cases:results.length,crossPageReturns:9,nativeFallbacks:4,errors};
}
module.exports={homeLinkChecks};
