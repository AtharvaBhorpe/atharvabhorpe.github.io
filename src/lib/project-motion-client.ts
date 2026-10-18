// Native SVG updates. Geometry and captions share the same illustrative model.
class ProjectRobot extends HTMLElement {
  private teardown?: () => void;
  connectedCallback() {
    if(this.teardown) return;
    const svg=this.querySelector<SVGSVGElement>('svg')!;
    const button=this.querySelector<HTMLButtonElement>('button')!;
    const label=this.querySelector<HTMLElement>('[data-motion-phase]')!;
    const kind=this.dataset.kind!;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const events=new AbortController();
    let playing=!reduced.matches, visible=false, suspended=false, frame=0, last=0, time=0;
    let build: typeof import('./project-scene.mjs').buildScene | undefined;
    let loading=false;
    const cache=new Map();
    const parts=new Map(Array.from(svg.querySelectorAll<SVGGElement>('[data-part]')).map(part=>{
      const solid=part.querySelector<SVGGElement>('.iso-solid')!;
      const path=(selector:string,className:string,before:Element|null,shade?:number)=>{
        let node=solid.querySelector<SVGPathElement>(selector);
        if(!node) {
          node=document.createElementNS('http://www.w3.org/2000/svg','path');
          node.setAttribute('class',className);
          node.setAttribute('d','');
          if(shade!==undefined) node.dataset.shade=String(shade); else node.dataset.tone='lo';
          solid.insertBefore(node,before);
        }
        return node;
      };
      const top=solid.querySelector<SVGPathElement>('.iso-top')!;
      const inner=solid.querySelector('[data-inner]');
      const edge=solid.querySelector<SVGPathElement>('.iso-edge')!;
      const refs={
        part,fill:solid.querySelector<SVGPathElement>('.iso-fill')!,top,edge,
        shades:[0,1,2,3].map(i=>path(`[data-shade="${i}"]`,'iso-shade',top,i)),
        crease:path('.iso-crease','iso-line iso-crease',inner||edge),
        bevel:path('.iso-bevel','iso-line iso-bevel',inner||edge),
        inner:Array.from(solid.querySelectorAll<SVGPathElement>('[data-inner] path')),
        previous:null as object|null, previousInner:'',
      };
      return [part.dataset.part!,refs] as const;
    }));
    const set=(node:SVGPathElement,d:string)=>{if(node.getAttribute('d')!==d) node.setAttribute('d',d||'');};
    const draw=()=>{
      if(!build) return;
      const {R,pose}=build(kind,time,null,cache);
      for(const item of R.items) {
        const ref=parts.get(item.name)!;
        if(ref.previous!==item.paths) {
          const p=item.paths;
          set(ref.fill,p.fill); set(ref.top,p.top); set(ref.edge,p.outline);
          set(ref.crease,p.crease); set(ref.bevel,p.bevel);
          ref.shades.forEach((node,i)=>set(node,p.shades[i]));
          ref.previous=p;
        }
        if(ref.previousInner!==item.inner) {
          const ds=[...item.inner.matchAll(/\bd="([^"]*)"/g)];
          ref.inner.forEach((node,i)=>set(node,ds[i]?.[1]||''));
          ref.previousInner=item.inner;
        }
        const active=pose.command==='imu'?item.name==='controller.mpu6050-chip':pose.command==='encoder'?item.name==='controller.encoder-knob':pose.command==='ir'&&item.name.startsWith('controller.ir-optic');
        ref.part.classList.toggle('is-command',Boolean(active));
      }
      if(label.textContent!==pose.phase) label.textContent=pose.phase;
      svg.dataset.motionTime=time.toFixed(3);
    };
    const eligible=()=>playing&&visible&&!document.hidden&&!suspended;
    const tick=(now:number)=>{
      frame=0;
      if(!eligible()) return;
      if(last) time+=Math.min((now-last)/1000,.1);
      last=now;
      draw();
      frame=requestAnimationFrame(tick);
    };
    const sync=()=>{
      cancelAnimationFrame(frame); frame=0; last=0;
      button.textContent=playing?'Pause':'Play';
      button.setAttribute('aria-label',`${playing?'Pause':'Play'} ${kind==='imu'?'Kinova Gen3':'UR5e'} motion`);
      this.dataset.motion=eligible()?'running':playing?'suspended':'paused';
      if(!eligible()) return;
      if(build) frame=requestAnimationFrame(tick);
      else if(!loading) {
        loading=true;
        import('./project-scene.mjs').then(module=>{
          if(events.signal.aborted) return;
          build=module.buildScene; sync();
        }).catch(()=>{
          if(events.signal.aborted) return;
          playing=false; sync(); button.disabled=true; label.textContent='Static illustration';
        });
      }
    };
    const observer=new IntersectionObserver(entries=>{
      visible=entries[entries.length-1].isIntersecting; sync();
    },{threshold:0});
    observer.observe(svg);
    button.addEventListener('click',()=>{playing=!playing;sync();},{signal:events.signal});
    reduced.addEventListener('change',()=>{playing=false;sync();},{signal:events.signal});
    document.addEventListener('visibilitychange',sync,{signal:events.signal});
    window.addEventListener('pagehide',()=>{suspended=true;sync();},{signal:events.signal});
    window.addEventListener('pageshow',()=>{suspended=false;sync();},{signal:events.signal});
    button.hidden=false;
    sync();
    this.teardown=()=>{events.abort();observer.disconnect();cancelAnimationFrame(frame);cache.clear();};
  }
  disconnectedCallback(){this.teardown?.();this.teardown=undefined;}
}
if(!customElements.get('project-robot')) customElements.define('project-robot',ProjectRobot);
