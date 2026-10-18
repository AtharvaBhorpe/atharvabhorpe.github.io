/*! @license
Anatomy toolkit — Copyright (c) 2026 Ryan. MIT License.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import * as k from '../../scripts/anatomy/iso-kit.mjs';
import * as G from '../../scripts/anatomy/lathe.mjs';
import { poseAt, rotateYaw } from './project-motion.mjs';
const { add3: add, sub3: sub, mul3: mul, unit3: unit, dot3: dot } = G;

// The audit dependency stays in Node. Browser and build use identical drawn geometry.
/** @param {Map<string, {key:string, paths:any}> | null} cache */
export function buildScene(kind, seconds=0, A=null, cache=null) {
  const pose=poseAt(kind,seconds);
  let yaw=0;
  const isIMU = kind === 'imu';
  const projection = k.fitProjection(isIMU ? [[-85,0,0],[-85,130,0],[125,0,0],[125,60,0],[-44,0,178]] : [...k.boxCorners({x:-35,y:-30,w:160,d:115,r:0},-5,0),[-35,0,185]], 480, 400, { pad: 30, azimuth: 125, elevation: 23 });
  let P=projection;
  const R = A ? A.recorder(projection) : {items:[],put(item){this.items.push(item);}};
  const transformed=new WeakMap();
  const worldShape = shape => {
    if(transformed.has(shape)) return transformed.get(shape);
    const world={...shape, F:Object.fromEntries(Object.entries(shape.F).map(([key,v])=>[key,rotateYaw(v,yaw)])), ...(shape.cut?{cut:shape.cut.map(worldShape)}:{})};
    transformed.set(shape,world);
    return world;
  };
  const memo=(name,key,make)=>{
    if(!cache) return make();
    const old=cache.get(name);
    if(old?.key===key) return old.paths;
    const paths=make(); cache.set(name,{key,paths}); return paths;
  };
  function put(name, at, paths, shape, { tone = 'mid', material = '', inner = '', joint } = {}) {
    if(shape) shape.name = name;
    R.put({ name, piece: kind, at:rotateYaw(at,yaw), ...(A?{shapes:[R.solid(yaw?worldShape(shape):shape)]}:{}), paths, inner,
      svg: cache ? '' : `<g data-part="${name}"${joint ? ` data-joint="${joint}"` : ''} class="${material}">${k.solidSvg(paths, { tone, crease: 'lo', inner:inner?`<g data-inner>${inner}</g>`:'' })}</g>` });
    return shape;
  }
  function box(name, x, y, z, w, d, h, options = {}) {
    const plan = { x, y, w, d, r: options.radius ?? Math.min(1.5, w / 5, d / 5) };
    return put(name, [x+w/2,y+d/2,z+h/2], memo(name,JSON.stringify([plan,z,h,P.azimuth]),()=>k.slabOf(plan,z,h,P,6,.5)), A?.slab(plan,z,h,{ ground: options.ground }), options);
  }
  function disc(name, c, axis, s0, s1, r, options = {}) {
    const F = G.frameAlong(c, axis);
    return put(name, add(c,mul(F.a,(s0+s1)/2)), memo(name,JSON.stringify([c,axis,s0,s1,r,P.azimuth]),()=>G.disc(s0,s1,r,F,P)), A?.disc(F,s0,s1,r), options);
  }
  function screw(name, c, axis = [0,0,1]) {
    const F = G.frameAlong(c,axis);
    return disc(name,c,axis,0,1.1,1.8,{tone:'lo',inner:k.lineSvg(G.circleOf(F,1.1,.65,P),{tone:'mid'})});
  }
  function mount(x, y) {
    box('stand.robot-mount',x-27,y-24,0,54,48,5,{ground:true,tone:'lo'});
    for (const [dx,dy] of [[-21,-18],[-21,18],[21,-18],[21,18]]) screw(`mount.screw.${dx}.${dy}`,[x+dx,y+dy,5]);
    disc('base.plinth',[x,y,0],[0,0,1],5,12,21,{tone:'lo'});
    disc('base.controller',[x,y,0],[0,0,1],12,18,16,{material:'carbon'});
  }
  // UR's nominal UR5e dimensions, scaled to this schematic: 425/392.2 arm,
  // 162.5 shoulder height and 133.3/99.7/99.6 wrist offsets. Not calibrated CAD.
  const sizes=isIMU?[[15,12],[15,12],[12,9],[13,10],[10,8],[10,8],[8,7]]:[[15,12],[17,13],[16,12],[11,9],[10,8],[9,8]];
  const joints=sizes.map(([r,h],i)=>({c:pose.centers[i],axis:pose.axes[i],r,h}));
  if(!isIMU) box('stand.workbench',-35,-30,-5,160,115,5,{ground:true,tone:'lo'});
  mount(0,0);
  yaw=pose.yaw;
  P={...projection,azimuth:projection.azimuth-yaw*180/Math.PI};
  joints.forEach((j,i) => {
    j.F = G.frameAlong(j.c,j.axis);
    j.shapes = [
      disc(`joint-${i+1}.rear`,j.c,j.axis,-j.h,-j.h+2,j.r,{material:'carbon'}),
      disc(`joint-${i+1}.housing`,j.c,j.axis,-j.h+2,j.h-2,j.r,{tone:'hi',joint:i+1}),
      disc(`joint-${i+1}.cap`,j.c,j.axis,j.h-2,j.h,j.r,{material:'carbon',inner:k.lineSvg(G.circleOf(j.F,j.h,j.r*.7,P,96),{tone:'mid'})}),
    ];
  });
  // Each seat is the drawn cylinder-minus-host surface, not an overlapping proxy.
  function seat(name, joint, direction, radius) {
    const F = G.frameAlong(joint.c,direction);
    const axis=unit(joint.axis), a=dot(F.a,axis);
    const surface = (angle,r=radius) => {
      // Exact ray/capped-cylinder intersection: the saddle meets the housing.
      const offset=add(mul(F.u,r*Math.cos(angle)),mul(F.v,r*Math.sin(angle)));
      const b=dot(offset,axis), qa=1-a*a, qb=-2*a*b, qc=r*r-b*b-joint.r*joint.r;
      const side=qa>1e-10?(-qb+Math.sqrt(qb*qb-4*qa*qc))/(2*qa):Infinity;
      const cap=Math.abs(a)>1e-10?((a>0?joint.h:-joint.h)-b)/a:Infinity;
      return Math.min(side,cap);
    };
    const starts=Array.from({length:64},(_,i)=>surface(i*Math.PI/32));
    const start=Math.min(...starts), end=Math.max(surface(0,0),...starts)+.35;
    const flat=Math.max(...starts)-start<.001;
    put(name,add(joint.c,mul(F.a,(start+end)/2)),flat?G.disc(start,end,radius,F,P):G.saddleOf(F,radius,surface,end,P),A?.disc(F,start,end,radius,flat?{}:{cut:joint.shapes,seated:true}),{material:isIMU?'carbon':''});
    return add(joint.c,mul(F.a,end));
  }
  for(let i=0;i<joints.length-1;i++) {
    const a=joints[i],b=joints[i+1], direction=unit(sub(b.c,a.c));
    const radius=Math.min(a.r,b.r)*.45;
    const start=seat(`link-${i+1}.root`,a,direction,radius);
    const end=seat(`link-${i+1}.tip`,b,mul(direction,-1),radius);
    const length=G.dot3(sub(end,start),direction);
    if(length<=0) throw new Error(`No room for link ${kind}:${i+1}: ${length}`);
    disc(`link-${i+1}.sleeve`,start,direction,0,length,radius,{tone:'hi',material:isIMU?'carbon':''});
  }
  const last=joints.at(-1), [cx,cy,cz]=last.c, tool=isIMU?cx+last.h:cz-last.h;
  const toolPoint=([x,y,z])=>isIMU?[tool+x,cy+y,cz+z]:[cx+z,cy+y,tool-x];
  const toolAxis=isIMU?[1,0,0]:[0,0,-1];
  const toolBox=(name,x,y,z,w,d,h,options)=>isIMU?box(name,tool+x,cy+y,cz+z,w,d,h,options):box(name,cx+z,cy+y,tool-x-w,h,d,w,options);
  disc('tool.flange',toolPoint([0,0,0]),toolAxis,0,3,8,{tone:'hi'});
  toolBox('gripper.motor',3,-12,-9,17,24,18,{material:'carbon'});
  toolBox('gripper.cover',4,-10,9,14,20,1,{tone:'hi'});
  for (const side of [-1,1]) {
    const y=side*(7-pose.grip);
    toolBox(`gripper.carrier.${side}`,20,y-2,-6,10,4,12,{tone:'hi'});
    toolBox(`gripper.finger.${side}`,30,(side<0?-9:4)-side*pose.grip,-5,9,5,10,{material:'carbon'});
    screw(`gripper.pivot.${side}`,toolPoint([25,y,6]),isIMU?[0,0,1]:[1,0,0]);
  }
  yaw=0;
  P=projection;
  if(isIMU) {
    box('stand.sensor-tray',-78,58,0,76,68,5,{ground:true,tone:'lo'});
    for(const [x,y] of [[-70,68],[-43,68],[-70,106],[-43,106]]) disc(`controller.standoff.${x}.${y}`,[x,y,5],[0,0,1],0,3,1.6,{tone:'lo'});
    box('controller.esp32-board',-73,64,8,33,46,1,{material:'carbon'});
    box('controller.esp32-shield',-68,78,9,23,21,3,{tone:'hi'});
    box('controller.usb-shell',-64,64,9,14,7,3,{tone:'hi'});
    box('controller.usb-opening',-62,63.9,9.7,10,.1,1.6,{material:'carbon',radius:0});
    for(const x of [-73,-42]) box(`controller.header.${x}`,x,77,9,2,30,3,{material:'carbon'});
    box('controller.mpu6050-board',-32,65,5,23,21,1,{tone:'hi'});
    box('controller.mpu6050-chip',-25,72,6,8,8,2,{material:'carbon'});
    box('controller.imu-header',-31,68,6,2,14,2,{material:'carbon'});
    disc('controller.encoder-carrier',[-20,101,5],[0,0,1],0,3,8,{tone:'lo'});
    disc('controller.encoder-shaft',[-20,101,8],[0,0,1],0,3,3,{tone:'hi'});
    disc('controller.encoder-knob',[-20,101,11],[0,0,1],0,7,8,{tone:'hi',inner:k.lineSvg(k.knurl(-20,101,8,11,18,24,P,0)+k.lineOnTop([-20-8*Math.cos(pose.encoder),101-8*Math.sin(pose.encoder)],[-20+8*Math.cos(pose.encoder),101+8*Math.sin(pose.encoder)],18,P),{tone:'lo'})});
    box('controller.ir-board',-71,114,5,59,9,1,{tone:'hi'});
    box('controller.ir-comparator',-66,115,6,14,7,2,{material:'carbon'});
    for(const x of [-34,-22]) disc(`controller.ir-optic.${x}`,[x,118.5,6],[0,0,1],0,6,2.5,{material:'carbon'});
    for(const [x,y] of [[-74,62],[-6,62],[-74,122],[-6,122]]) screw(`controller.tray-screw.${x}.${y}`,[x,y,5]);
  } else {
    toolBox('connector.shell',32,-4,-4,14,8,8,{tone:'hi'});
    toolBox('connector.mating-tip',46,-3,-3,7,6,6,{tone:'hi'});
    toolBox('connector.latch',35,-2,4,8,4,1,{material:'carbon'});
    // Zone 1: an upright NIC supports two horizontal, upward-facing SFP mouths.
    // The task board lies on the workbench. The module mates downward, not sideways.
    const sx=83, sy=133.3/4.25;
    box('stand.fixture-foot',sx-12,sy-15,0,28,54,5,{tone:'lo'});
    box('fixture.upright',sx+9,sy-10,5,3,44,49,{material:'carbon'});
    box('fixture.network-board',sx+8,sy-9,7,1,42,45,{tone:'hi'});
    box('fixture.heatsink',sx+6,sy+2,14,2,22,16,{tone:'hi'});
    for(let i=0;i<5;i++) box(`fixture.heatsink-fin.${i}`,sx+4,sy+2+i*5,14,2,2,16,{tone:'hi'});
    for(const y of [sy-5,sy+29]) screw(`fixture.board-screw.${y}`,[sx+8,y,12],[-1,0,0]);
    for(const [prefix,y] of [['socket',sy],['socket-spare',sy+22]]) {
      box(`${prefix}.bottom`,sx-7,y-7,38,15,14,2,{tone:'hi'});
      box(`${prefix}.front`,sx-7,y-7,40,2,14,14,{tone:'hi'});
      box(`${prefix}.back`,sx+5,y-7,40,3,14,14,{tone:'hi'});
      box(`${prefix}.left`,sx-5,y-7,40,10,2,14,{tone:'hi'});
      box(`${prefix}.right`,sx-5,y+5,40,10,2,14,{tone:'hi'});
      box(`${prefix}.contacts`,sx-4,y-4,40,8,8,.8,{material:'carbon',radius:0});
    }
    for(const y of [sy-10,sy+34]) screw(`fixture.mount-screw.${y}`,[sx,y,5]);
  }
  return {R,projection,joints,pose,toolPoint};
}
