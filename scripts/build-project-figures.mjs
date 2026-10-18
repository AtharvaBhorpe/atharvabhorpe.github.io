import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Optional authoring tool. Normal builds and tests use the committed static figures.
if (!process.env.ANATOMY_HOME) throw new Error('Set ANATOMY_HOME to an Anatomy source checkout. See docs/project-figures.md.');
const kit = resolve(process.env.ANATOMY_HOME, 'kit');
const k = await import(pathToFileURL(`${kit}/iso-kit.mjs`));
const G = await import(pathToFileURL(`${kit}/lathe.mjs`));
const A = await import(pathToFileURL(`${kit}/audit.mjs`));
const { add3: add, sub3: sub, mul3: mul, unit3: unit } = G;
const out = {};

for (const kind of ['imu', 'insertion']) {
  const isIMU = kind === 'imu';
  const P = k.fitProjection(isIMU ? [[-85,0,0],[-85,130,0],[125,0,0],[125,60,0],[-44,0,178]] : [[-60,0,0],[185,0,0],[185,55,0],[-38,0,180]], 480, 400, { pad: 30, azimuth: 125, elevation: 23 });
  const R = A.recorder(P);
  function put(name, at, paths, shape, { tone = 'mid', material = '', inner = '', joint } = {}) {
    shape.name = name;
    R.put({ name, piece: kind, at, shapes: [R.solid(shape)], svg: `<g data-part="${name}"${joint ? ` data-joint="${joint}"` : ''} class="${material}">${k.solidSvg(paths, { tone, crease: 'lo', inner })}</g>` });
    return shape;
  }
  function box(name, x, y, z, w, d, h, options = {}) {
    const plan = { x, y, w, d, r: options.radius ?? Math.min(1.5, w / 5, d / 5) };
    return put(name, [x+w/2,y+d/2,z+h/2], k.slabOf(plan,z,h,P,6,.5), A.slab(plan,z,h,{ ground: options.ground }), options);
  }
  function disc(name, c, axis, s0, s1, r, options = {}) {
    const F = G.frameAlong(c, axis);
    return put(name, add(c,mul(F.a,(s0+s1)/2)), G.disc(s0,s1,r,F,P), A.disc(F,s0,s1,r), options);
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
  const joints = isIMU ? [
    { c:[0,0,30], axis:[0,0,1], r:15, h:12 },
    { c:[0,0,65], axis:[0,1,0], r:15, h:12 },
    { c:[-22,0,110], axis:[-22,0,45], r:12, h:9 },
    { c:[-44,0,155], axis:[0,1,0], r:13, h:10 },
    { c:[8,0,136], axis:[52,0,-19], r:10, h:8 },
    { c:[36,0,113], axis:[0,1,0], r:10, h:8 },
    { c:[65,0,113], axis:[1,0,0], r:8, h:7 },
  ] : [
    { c:[0,0,30], axis:[0,0,1], r:15, h:12 },
    { c:[0,0,65], axis:[0,1,0], r:17, h:13 },
    { c:[-38,0,157], axis:[0,1,0], r:16, h:12 },
    { c:[48,0,125], axis:[0,1,0], r:11, h:9 },
    { c:[48,28,125], axis:[0,0,1], r:10, h:8 },
    { c:[75,28,125], axis:[1,0,0], r:9, h:8 },
  ];
  mount(0,0);
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
    const distance = p => Math.min(...joint.shapes.map(s=>A.sdf(s,p)));
    const surface = (angle,r=radius) => {
      let lo=0, hi=joint.r+joint.h+4;
      for(let i=0;i<35;i++) {
        const mid=(lo+hi)/2;
        if(distance(G.pointOf(F,mid,r,angle))<0) lo=mid; else hi=mid;
      }
      return (lo+hi)/2;
    };
    const starts=Array.from({length:64},(_,i)=>surface(i*Math.PI/32));
    const start=Math.min(...starts), end=Math.max(surface(0,0),...starts)+.35;
    const flat=Math.max(...starts)-start<.001;
    put(name,add(joint.c,mul(F.a,(start+end)/2)),flat?G.disc(start,end,radius,F,P):G.saddleOf(F,radius,surface,end,P),A.disc(F,start,end,radius,flat?{}:{cut:joint.shapes,seated:true}),{material:isIMU?'carbon':''});
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
  const last=joints.at(-1), [cx,cy,cz]=last.c, tool=cx+last.h;
  disc('tool.flange',[tool,cy,cz],[1,0,0],0,3,8,{tone:'hi'});
  box('gripper.motor',tool+3,cy-12,cz-9,17,24,18,{material:'carbon'});
  box('gripper.cover',tool+4,cy-10,cz+9,14,20,1,{tone:'hi'});
  for (const side of [-1,1]) {
    const y=cy+side*7;
    box(`gripper.carrier.${side}`,tool+20,y-2,cz-6,10,4,12,{tone:'hi'});
    box(`gripper.finger.${side}`,tool+30,side<0?cy-9:cy+4,cz-5,9,5,10,{material:'carbon'});
    screw(`gripper.pivot.${side}`,[tool+25,y,cz+6]);
  }
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
    disc('controller.encoder-knob',[-20,101,11],[0,0,1],0,7,8,{tone:'hi',inner:k.lineSvg(k.knurl(-20,101,8,11,18,24,P,0),{tone:'lo'})});
    box('controller.ir-board',-71,114,5,59,9,1,{tone:'hi'});
    box('controller.ir-comparator',-66,115,6,14,7,2,{material:'carbon'});
    for(const x of [-34,-22]) disc(`controller.ir-optic.${x}`,[x,118.5,6],[0,0,1],0,6,2.5,{material:'carbon'});
    for(const [x,y] of [[-74,62],[-6,62],[-74,122],[-6,122]]) screw(`controller.tray-screw.${x}.${y}`,[x,y,5]);
  } else {
    const plugX=tool+32;
    box('connector.shell',plugX,cy-4,cz-4,14,8,8,{tone:'hi'});
    box('connector.mating-tip',plugX+14,cy-3,cz-3,7,6,6,{tone:'hi'});
    box('connector.latch',plugX+3,cy-2,cz+4,8,4,1,{material:'carbon'});
    const face=plugX+30, back=face+13;
    box('stand.fixture-foot',face-2,cy-27,0,40,54,5,{ground:true,tone:'lo'});
    box('fixture.upright',back+2,cy-21,5,8,42,cz-28,{tone:'lo'});
    box('fixture.network-board',back,cy-25,cz-23,2,50,40,{material:'carbon'});
    box('socket.bottom',face,cy-7,cz-6,13,14,2,{tone:'hi'});
    box('socket.top',face,cy-7,cz+4,13,14,2,{tone:'hi'});
    box('socket.left',face,cy-7,cz-4,13,2,8,{tone:'hi'});
    box('socket.right',face,cy+5,cz-4,13,2,8,{tone:'hi'});
    box('socket.contacts',back-.8,cy-5,cz-4,.8,10,8,{material:'carbon',radius:0});
    for(const [y,z] of [[cy-20,cz-18],[cy+20,cz-18],[cy-20,cz+12],[cy+20,cz+12]]) screw(`fixture.board-screw.${y}.${z}`,[back,y,z],[-1,0,0]);
    for(const y of [cy-21,cy+21]) screw(`fixture.mount-screw.${y}`,[face+4,y,5]);
  }
  assert(R.solids.length >= 40 && R.solids.length <= 80, 'Figure-tier solid budget');
  assert.equal(joints.length, isIMU ? 7 : 6);
  if (!isIMU) {
    const shape = name => R.solids.find(s => s.name === name);
    const plug = A.boundsOf(shape('connector.mating-tip'));
    const socket = A.boundsOf(shape('socket.bottom'));
    assert(socket.min[0] > plug.max[0], 'Connector approaches, rather than intersects, the fixed socket');
    assert.equal((plug.min[1] + plug.max[1]) / 2, cy);
    assert.equal((plug.min[2] + plug.max[2]) / 2, cz);
    for (const side of [-1, 1]) {
      const contact = [tool + 35, cy + side * 4, cz];
      assert(Math.abs(A.sdf(shape('connector.shell'), contact)) < .01);
      assert(Math.abs(A.sdf(shape(`gripper.finger.${side}`), contact)) < .01, 'Both fingers hold the connector');
    }
    assert(plug.min[2] > socket.max[2], 'Connector clears the socket floor');
  }
  console.log(`\n${kind}: ${R.solids.length} purposeful solids`);
  A.settle(R,P);
  R.items.sort((a,b)=>a.key-b.key);
  A.auditOrExit(R,P);
  out[kind]={ svg:R.items.map(item=>item.svg).join(''), solids:R.solids.length, joints:joints.length, projection:P, parts:R.solids.map(s=>s.name) };
}
if (!process.exitCode) {
  mkdirSync('src/data',{recursive:true});
  writeFileSync('src/data/project-figures.json',JSON.stringify(out)+'\n');
  console.log('Wrote static project figures. No browser runtime.');
}
