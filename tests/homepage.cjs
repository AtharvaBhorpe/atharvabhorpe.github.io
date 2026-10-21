const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');

const evidence = '.evidence/personal-homepage';
const role = 'Robotics master’s student at RWTH Aachen';
const introduction = 'I work on robot learning, control, and simulation. My background is in mechanical engineering and industrial automation.';
const devices = [[320,740,true],[390,844,true],[414,896,true],[768,1024,true],[820,1180,true],[1024,1366,true],[1180,820,true],[1366,1024,true],[1440,900,false]];

async function homepageChecks(browser, origin, out, before = false) {
  fs.mkdirSync(out,{recursive:true});
  const captures = [], errors = [];
  if (!before) {
    for (const [file, hash] of Object.entries(JSON.parse(fs.readFileSync('tests/fixtures/preserved-hashes.json','utf8')))) {
      assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,`Preserved bytes: ${file}`);
    }
    const approved = JSON.parse(fs.readFileSync('tests/fixtures/homepage-markup.json','utf8'));
    const current = fs.readFileSync('src/pages/index.astro','utf8');
    assert.deepEqual(current.match(/<nav class="practice-orbit"[\s\S]*?<\/nav>/g),approved.orbit,'Orbit markup unchanged');
    assert.deepEqual(current.match(/<figure class="project-drawing">[\s\S]*?<\/figure>/g),approved.figures,'Project-figure markup unchanged');
    assert.equal(fs.readFileSync('src/components/Contact.astro','utf8').split('</footer> : ')[1],approved.detailContact,'Shared detail-page contact markup unchanged');
    const approvedCSS=fs.readFileSync('tests/fixtures/home.css','utf8');
    assert.equal(fs.readFileSync('src/styles/home.css','utf8'),approvedCSS,'Approved personal hero and Contact stylesheet preserved in full');
  }
  for (const [width,height,hasTouch] of devices) for (const theme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width,height},hasTouch,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(`${origin}/?theme=${theme}`);
      await page.evaluate(()=>document.fonts.ready);
      await page.locator('.hero-portrait img').evaluate(img=>img.decode());
      await page.screenshot({path:path.join(out,`home-${width}-${theme}.png`)});
      if (!before) {
        assert.equal(await page.locator('h1').innerText(),'Atharva Bhorpe');
        assert.equal(await page.locator('.hero-role').innerText(),role);
        assert.equal(await page.locator('.hero-introduction').innerText(),introduction);
        assert.equal(await page.getByText(introduction,{exact:true}).count(),1,'One biography');
        assert.equal(await page.locator('.contact-name').count(),0,'No duplicate name above Contact');
        assert.equal(await page.locator('.contact-introduction > :first-child').getAttribute('id'),'contact-heading');
        assert.equal(await page.locator('.footer-signature > p').innerText(),'Atharva Bhorpe');
        assert.equal(await page.getByRole('link',{name:'Atharva Bhorpe',exact:true}).getAttribute('href'),'#home');
        assert.equal(await page.locator('#home .hero-portrait img').count(),1);
        assert.equal(await page.locator('.hero-drawing,#robot-illustration,.concept-arm').count(),0,'No decorative robot elsewhere');
        assert(!/Robotics\s+in practice|Learning, control, and the machinery between|I’m Atharva/.test(await page.locator('main').innerText()));
        assert.deepEqual(await page.locator('main h2').allTextContents(),['Projects','Areas I work in','Writing','Contact']);
        assert.equal(await page.locator('#projects .section-heading p').count(),0,'No Projects subtitle');
        assert.equal(await page.locator('#writing .section-heading p').innerText(),'I document the tools, setups, and experiments behind my projects.');
        assert.equal(await page.locator('.hero-actions a').first().getAttribute('href'),'#projects');
        assert.match(await page.locator('.hero-actions a').first().innerText(),/^View projects/);
        assert.equal(await page.locator('.hero-actions a').count(),3,'Three hero actions');
        assert.equal(await page.locator('.hero-actions a').nth(1).getAttribute('href'),'/resume.pdf');
        assert.equal(await page.locator('.hero-actions a').nth(1).getAttribute('target'),'_blank');
        assert.equal(await page.locator('.hero-actions a').nth(1).locator('span').innerText(),'↗');
        assert.equal(await page.locator('.hero-actions a').last().getAttribute('href'),'#contact');
        assert.equal(await page.locator('.hero-actions a').last().locator('[aria-hidden="true"]').innerText(),'↓');
        assert.equal(await page.locator('.hero-actions a.secondary-action').count(),2);
        assert.equal(await page.locator('.intro-link,.hero-copy > a').count(),0,'No standalone Contact line');
        const actions=await page.locator('.hero-actions a').evaluateAll(links=>links.map(e=>{
          const r=e.getBoundingClientRect(),s=getComputedStyle(e);
          return {x:r.x,y:r.y,right:r.right,width:r.width,height:r.height,minHeight:parseFloat(s.minHeight),style:['font','padding','border','border-radius','background-color','color','gap'].map(p=>s.getPropertyValue(p))};
        }));
        assert(Math.abs(actions[1].y-actions[2].y)<1 && actions[2].x>=actions[1].right,'Resume and Contact remain adjacent');
        assert.deepEqual(actions[1].style,actions[2].style,'Matching secondary-action styling');
        assert(actions.every(a=>a.minHeight>=44 && a.width>=43.9 && a.height>=43.9),'Accessible hero targets');
        const geometry = await page.evaluate(()=>{
          const h=document.querySelector('h1'), portrait=document.querySelector('.hero-portrait img');
          const range=document.createRange();range.selectNodeContents(h);
          const lines=[...range.getClientRects()].map(r=>({left:r.left,right:r.right}));
          const p=portrait.getBoundingClientRect(), intro=document.querySelector('.hero-introduction').getBoundingClientRect();
          const dock=document.querySelector('.identity-row').getBoundingClientRect();
          return {lines,portrait:[p.width,p.height],loaded:portrait.complete&&portrait.naturalWidth===640,fit:getComputedStyle(portrait).objectFit,
            introBottom:intro.bottom,available:matchMedia('(max-width:1199px), (hover:none), (pointer:coarse), (pointer:none)').matches?dock.top:innerHeight,
            heroHeight:document.querySelector('#home').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth};
        });
        assert(geometry.lines.length<=2 && geometry.lines.every(r=>r.left>=0 && r.right<=width),'Readable name within two lines');
        assert(geometry.loaded && geometry.fit==='contain' && Math.abs(geometry.portrait[0]-geometry.portrait[1])<1,'Original square portrait without distortion');
        assert(geometry.introBottom<=geometry.available,'Role and introduction clear the dock on the first screen');
        assert(geometry.heroHeight<height,'The hero does not consume multiple screens');
        assert(!geometry.overflow);
        assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1)))),[],'Every fragment has a destination');
        captures.push({width,height,theme,...geometry});
        await page.keyboard.press('Tab');await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
        await page.keyboard.press('Tab');
        assert.match(await page.locator(':focus').innerText(),/^View projects/);
        await page.keyboard.press('Enter');
        await page.waitForFunction(()=>document.activeElement.id==='projects');
        await page.locator('.hero-actions a').nth(1).focus();await page.keyboard.press('Tab');
        assert.equal(await page.locator(':focus').getAttribute('href'),'#contact','Contact follows Resume in keyboard order');
        await page.keyboard.press('Enter');
        await page.waitForFunction(()=>location.hash==='#contact' && document.activeElement.id==='contact');
        assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
        for (const id of ['home','about']) {
          await page.goto(`${origin}/?theme=${theme}#${id}`);
          await page.waitForFunction(id=>document.activeElement.id===id,id);
          assert(await page.locator(`#${id}`).isVisible());
        }
      }
    } finally {await page.close();}
  }
  if (!before) for (const width of [320,390,1366,1440]) for (const colorScheme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width!==1440,javaScriptEnabled:false,colorScheme});
    try {
      await page.goto(origin);
      assert.equal(await page.locator('h1').innerText(),'Atharva Bhorpe');
      assert.equal(await page.locator('.hero-introduction').innerText(),introduction);
      assert(await page.locator('.hero-portrait img').evaluate(img=>img.complete&&img.naturalWidth===640));
      await page.locator('.hero-actions a').first().click();assert.equal(new URL(page.url()).hash,'#projects');
      assert.equal(await page.locator('.project-anatomy').count(),2);
      assert.equal(await page.locator('.practice-orbit a').count(),4);
      assert.equal(await page.locator('.hero-drawing').count(),0);
    } finally {await page.close();}
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'homepage.json'),JSON.stringify({captures,noJS:before?0:8,errors},null,2)+'\n');
  return {captures:devices.length*2,noJS:before?0:8};
}
module.exports={homepageChecks};
if (require.main===module) (async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
  const before=process.argv.includes('--before');
  try {console.log('Homepage passed:',await homepageChecks(browser,process.env.SITE_URL||'http://127.0.0.1:4336',path.join(process.env.EVIDENCE_DIR||evidence,before?'before':'after'),before));}
  finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
