import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export async function motionChecks(browser,origin,out) {
  fs.mkdirSync(out,{recursive:true});
  const errors=[],captures=[],pacing=[];
  const devices=[[320,740],[390,844],[414,896],[768,1024],[1024,768],[1440,1000]];
  for(const [width,height] of devices) for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:width<1200,reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/?theme=${theme}`);
    await page.evaluate(()=>document.fonts.ready);
    const detailed=width===390||width===1440;
    for(const kind of ['insertion','imu']) {
      const figure=page.locator(`project-robot[data-kind="${kind}"]`), svg=figure.locator('svg'),button=figure.locator('button');
      await figure.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      assert.equal(await figure.getAttribute('data-motion'),'paused');
      assert.equal(await svg.getAttribute('data-motion-time'),null,'Reduced motion starts still');
      assert.equal(await svg.locator('[data-joint]').count(),kind==='imu'?7:6);
      assert.match(await svg.locator('title').textContent(),kind==='imu'?/Kinova Gen3/:/UR5e/);
      const box=await button.boundingBox();assert(box.width>=44&&box.height>=44);
      await button.focus(); assert(await button.evaluate(el=>el.matches(':focus-visible')));
      if(!detailed) continue;
      const fixed=await svg.locator('[data-part^="fixture."],[data-part^="socket"],[data-part^="stand."]').evaluateAll(nodes=>nodes.map(n=>n.innerHTML));
      // Keyboard opt-in works even when reduced motion is requested.
      await page.keyboard.press('Enter');
      const targets=width===1440&&theme==='light'?(kind==='imu'?[2,5,8,11,13,17.8]:[2,4.5,8,10.5,13,16.5]):[2,kind==='imu'?11:4.5];
      for(const target of targets) {
        await page.waitForFunction(({kind,target})=>Number(document.querySelector(`[data-project-figure="${kind}"]`).dataset.motionTime)>=target,{kind,target},{timeout:25000});
        await button.click();
        const before=await svg.getAttribute('data-motion-time');
        await page.waitForTimeout(80);assert.equal(await svg.getAttribute('data-motion-time'),before,'Pause freezes the pose');
        const bounds=await svg.evaluate(el=>{const b=el.getBBox();return {x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height};});
        assert(bounds.x>=0&&bounds.y>=0&&bounds.right<=480&&bounds.bottom<=400,`No clipped pose ${kind} ${target}: ${JSON.stringify(bounds)}`);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.deepEqual(await svg.locator('[data-part^="fixture."],[data-part^="socket"],[data-part^="stand."]').evaluateAll(nodes=>nodes.map(n=>n.innerHTML)),fixed,'Fixtures stay fixed');
        const rect=await figure.boundingBox(), scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));
        const cdp=await page.context().newCDPSession(page);
        for(const scale of [1,4]) {
          const capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:rect.x+scroll.x,y:rect.y+scroll.y,width:rect.width,height:rect.height,scale}});
          const png=Buffer.from(capture.data,'base64');
          assert(Math.abs(png.readUInt32BE(16)-rect.width*scale)<=scale,'Real output resolution');
          fs.writeFileSync(path.join(out,`${kind}-${width}-${theme}-${target}s-${scale}x.png`),png);
        }
        await cdp.detach();
        captures.push({kind,width,theme,time:before,bounds});
        await button.click();
      }
      // Move away; neither its clock nor its paths may advance offscreen.
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(100);
      const offscreen=await svg.getAttribute('data-motion-time');
      await page.waitForTimeout(150);assert.equal(await svg.getAttribute('data-motion-time'),offscreen);
      await figure.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
      assert(Number(await svg.getAttribute('data-motion-time'))>Number(offscreen));
      // The same visibilitychange path handles background documents.
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      const hidden=await svg.getAttribute('data-motion-time');await page.waitForTimeout(100);
      assert.equal(await svg.getAttribute('data-motion-time'),hidden);
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForTimeout(100);assert(Number(await svg.getAttribute('data-motion-time'))>Number(hidden));
      await button.click();
    }
    await page.goto(`${origin}/projects/autonomous-insertion/?theme=${theme}`);
    assert.equal(await page.locator('.technical-flow').count(),2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Article fits every viewport');
    assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1)))),[]);
    await page.locator('#end-to-end-architecture').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,`article-${width}-${theme}.png`)});
    await page.close();
  }
  // Default motion, lifecycle cleanup, preference changes, and measured frame pacing.
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  for(const kind of ['insertion','imu']) {
    const figure=page.locator(`project-robot[data-kind="${kind}"]`);
    await figure.scrollIntoViewIfNeeded();
    await page.waitForFunction(kind=>Number(document.querySelector(`[data-project-figure="${kind}"]`).dataset.motionTime)>.2,kind);
    const stats=await page.evaluate(()=>new Promise(resolve=>{
      const times=[];let last=performance.now();const end=last+1200;
      function sample(now){times.push(now-last);last=now;if(now<end) requestAnimationFrame(sample);else {times.sort((a,b)=>a-b);resolve({frames:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)});}}
      requestAnimationFrame(sample);
    }));
    pacing.push({kind,...stats});assert(stats.p95<100,'No sustained main-thread stalls on this test machine');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('project-robot')).every(el=>el.dataset.motion==='paused'));
  assert.deepEqual(await page.locator('project-robot').evaluateAll(es=>es.map(e=>e.dataset.motion)),['paused','paused']);
  const removed=await page.locator('project-robot[data-kind="imu"]').evaluate(async el=>{
    el.querySelector('button').click();await new Promise(r=>setTimeout(r,100));
    el.remove();const before=el.querySelector('svg').dataset.motionTime;
    await new Promise(r=>setTimeout(r,100));return before===el.querySelector('svg').dataset.motionTime;
  });assert(removed,'Disconnected component stops work');await page.close();
  for(const width of [320,1440]) for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:900},javaScriptEnabled:false,colorScheme:theme});await page.goto(origin);
    assert.equal(await page.locator('project-robot svg').count(),2);
    assert.equal(await page.locator('project-robot button:visible').count(),0);
    assert.equal(await page.locator('[data-joint]').count(),13);
    await page.close();
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'motion.json'),JSON.stringify({captures,pacing,errors,limitation:'Chromium emulation; no physical Safari/device claim.'},null,2)+'\n');
  return {captures:captures.length,pacing,errors};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
  try{console.log(await motionChecks(browser,process.env.SITE_URL||'http://127.0.0.1:4337',process.env.EVIDENCE_DIR||'.evidence/project-motion'));}
  finally{await browser.close();}
}
