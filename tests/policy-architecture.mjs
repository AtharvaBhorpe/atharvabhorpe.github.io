import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import architecture from '../src/data/policy-architecture.json' with { type: 'json' };

assert.deepEqual(architecture.skipConnections,[['down3','concat8'],['down2','concat16']]);
assert.equal(architecture.downsampleStages,2);assert.equal(architecture.upsampleStages,2);
assert.equal(architecture.context,1206);assert.equal(architecture.conditioning,1334);
assert.deepEqual(architecture.actionShape,[32,9]);assert.deepEqual(architecture.selectedIndices,[2,3,4,5,6,7,8,9]);
assert(!/mechanical|metaphor|tabulator|data-part|<script|<animate|architecture-controls/.test(architecture.html));

export async function architectureChecks(browser,origin,out) {
  fs.mkdirSync(out,{recursive:true});const errors=[],cases=[];
  for(const [width,height]of [[320,740],[390,844],[768,1024],[1024,768],[1440,1000]])for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${origin}/projects/autonomous-insertion/?theme=${theme}#end-to-end-architecture`);await page.evaluate(()=>document.fonts.ready);
    const figure=page.locator('.policy-architecture');
    assert.equal(await figure.locator('svg').count(),3);
    assert.equal(await figure.locator('[data-node^="encoder-"]').count(),3);
    assert.equal(await figure.locator('[data-node^="downsample"]').count(),2);
    assert.equal(await figure.locator('[data-node^="upsample"]').count(),2);
    assert.equal(await figure.locator('.skip[data-edge]').count(),2);
    assert.equal(await figure.locator('[data-edge="skip8"]').getAttribute('data-to'),'concat8');
    assert.equal(await figure.locator('[data-edge="skip16"]').getAttribute('data-to'),'concat16');
    assert.equal(await figure.locator('[data-edge="film-entry"]').getAttribute('data-to'),'down1');
    assert.equal(await figure.locator('button,select,summary').count(),0);
    assert.equal(await page.locator('#dagger-caption').count(),1);
    assert.equal(await page.locator('.technical-flow:not(.policy-architecture) .flow-chain>li').count(),5);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    for(const panel of ['a','b','c']) {
      const svg=figure.locator(`[data-network-panel="${panel}"]`);
      assert((await svg.getAttribute('aria-labelledby'))?.includes(`network-title-${panel}`));
      assert((await svg.locator('desc').textContent()).length>100);
      const issues=await svg.evaluate(el=>{
        const vb=el.viewBox.baseVal;const bad=[];
        for(const text of el.querySelectorAll('text')) {
          const b=text.getBBox();
          if(b.x<0||b.y<0||b.x+b.width>vb.width||b.y+b.height>vb.height)bad.push('clipped '+text.textContent);
          const group=text.closest('[data-node]');
          if(group){const s=group.querySelector('rect,path').getBBox();if(b.x<s.x-1||b.x+b.width>s.x+s.width+1||b.y<s.y-1||b.y+b.height>s.y+s.height+1)bad.push('node label overflow '+group.dataset.node);}
        }return bad;
      });assert.deepEqual(issues,[],`${width} ${theme} ${panel}: labels`);
      const viewport=svg.locator('..');await viewport.focus();
      assert(await viewport.evaluate(el=>el.matches(':focus-visible')));
      if(width<768){await page.keyboard.press('ArrowRight');await page.waitForFunction(id=>document.querySelector(`[data-network-panel="${id}"]`).parentElement.scrollLeft>0,panel);await viewport.evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'}));assert(await viewport.evaluate(el=>el.scrollLeft>0));await viewport.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));}
      assert.equal(await svg.evaluate(el=>el.getAnimations({subtree:true}).length),0);
    }
    if(width===390||width===1440) {
      // Capture a fresh resting page, not a native keyboard-scroll animation.
      await page.goto(`${origin}/projects/autonomous-insertion/?theme=${theme}`);
      await page.evaluate(()=>document.fonts.ready);
      await page.locator('#end-to-end-architecture').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-85,behavior:'instant'}));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({path:path.join(out,`article-${width}-${theme}.png`)});
      if(width===1440)for(const panel of ['a','b','c']) {
        await figure.locator(`[data-network-panel="${panel}"]`).screenshot({path:path.join(out,`panel-${panel}-${theme}.png`),scale:'css'});
      }
      if(width===390) {
        const area=figure.locator('.network-scroll').nth(1);await area.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,`mobile-unet-left-${theme}.png`)});
        await area.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
        await page.screenshot({path:path.join(out,`mobile-unet-right-${theme}.png`)});
      }
    }
    assert.equal(await figure.locator('.network-equivalent li').count(),6);
    cases.push({width,theme});await page.close();
  }
  for(const width of [320,1440])for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:900},javaScriptEnabled:false,colorScheme:theme});await page.goto(`${origin}/projects/autonomous-insertion/`);
    assert.equal(await page.locator('.policy-architecture svg').count(),3);
    assert.equal(await page.locator('.network-equivalent li').count(),6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
  }
  assert.deepEqual(errors,[]);const report={cases,noJSCases:4,errors};fs.writeFileSync(path.join(out,'architecture.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
  try{console.log(await architectureChecks(browser,process.env.SITE_URL||'http://127.0.0.1:4337',process.env.EVIDENCE_DIR||'.evidence/policy-architecture'));}finally{await browser.close();}
}
