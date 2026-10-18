import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildScene } from '../src/lib/project-scene.mjs';
import * as A from './anatomy/audit.mjs';

// The same geometry builds the static fallback and every browser pose.
// Prove a single painter order over the bounded cycle; no per-frame ray casting.
export const AUDIT_TIMES = Array.from({length:37},(_,i)=>i/2);
const output={};
for(const kind of ['imu','insertion']) {
  const scenes=AUDIT_TIMES.map(time=>buildScene(kind,time,A));
  const first=scenes[0], {R,projection}=first;
  const overlaps=scenes.map(s=>A.overlapsOf(s.R.items,s.projection,{states:[0]}));
  const union={...overlaps[0],pairs:overlaps.flatMap(o=>o.pairs)};
  const solved=A.orderKeys(R.items,union);
  assert.equal(solved.cycles.length,0,`${kind}: interlocking painter geometry`);
  assert.equal(solved.dropped.length,0,`${kind}: contradictory painter order across poses`);
  for(const [i,scene] of scenes.entries()) {
    const {R,projection,toolPoint}=scene;
    R.items.forEach((item,j)=>item.key=solved.keys[j]);
    R.settled={items:R.items,overlaps:overlaps[i],solved,states:[0]};
    assert(R.solids.length>=40 && R.solids.length<=80);
    assert.equal(scene.joints.length,kind==='imu'?7:6);
    if(kind==='insertion') {
      const shape=name=>R.solids.find(s=>s.name===name);
      const plug=A.boundsOf(shape('connector.mating-tip'));
      assert(plug.min[2]>40.8,'Tip clears socket contacts');
      if(plug.min[2]<54) assert(Math.abs(scene.pose.offset[0])<1e-8,'Align before insertion');
      for(const side of [-1,1]) {
        const point=toolPoint([35,side*4,0]);
        assert(Math.abs(A.sdf(shape('connector.shell'),point))<.01);
        assert(Math.abs(A.sdf(shape(`gripper.finger.${side}`),point))<.01,'Connector stays held');
      }
      const fixed=R.items.filter(item=>/^(stand\.|fixture\.|socket)/.test(item.name)).map(item=>item.svg);
      assert.deepEqual(fixed,first.R.items.filter(item=>/^(stand\.|fixture\.|socket)/.test(item.name)).map(item=>item.svg),'Fixture and workbench never move');
    }
    if(process.argv.includes('--audit')) {
      const result=A.audit(R,projection);
      const failures=A.failures(result);
      if(failures) console.error(`${kind} at ${AUDIT_TIMES[i]}s\n${A.report(result)}`);
      assert.equal(failures,0,`${kind} ${AUDIT_TIMES[i]}s geometry audit`);
    }
  }
  const ordered=R.items.toSorted((a,b)=>a.key-b.key);
  output[kind]={svg:ordered.map(item=>item.svg).join(''),solids:R.solids.length,joints:first.joints.length,projection,parts:R.solids.map(s=>s.name),order:ordered.map(item=>item.name)};
  console.log(`${kind}: ${R.solids.length} solids; ${scenes.length} poses; ${solved.rules} shared painter rules; ${process.argv.includes('--audit')?'support, clearance, depth, coverage and saddles passed':'order checked'}.`);
}
if(process.argv.includes('--check')) {
  assert.equal(readFileSync('src/data/project-figures.json','utf8'),JSON.stringify(output)+'\n','Static fallbacks match the shared geometry');
} else {
  writeFileSync('src/data/project-figures.json',JSON.stringify(output)+'\n');
  console.log('Wrote audited static fallbacks.');
}
