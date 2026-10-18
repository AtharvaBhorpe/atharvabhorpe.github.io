import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { poseAt, rotateYaw, CYCLE_SECONDS } from '../src/lib/project-motion.mjs';
import { buildScene } from '../src/lib/project-scene.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
for(const kind of ['imu','insertion']) {
  const first=poseAt(kind), lengths=first.centers.slice(1).map((c,i)=>distance(c,first.centers[i]));
  for(let i=0;i<=1800;i++) {
    const pose=poseAt(kind,i/100);
    assert.equal(pose.centers.length,kind==='imu'?7:6);
    assert(pose.centers.flat().every(Number.isFinite));
    pose.centers.slice(1).forEach((c,j)=>assert(Math.abs(distance(c,pose.centers[j])-lengths[j])<1e-8,'Rigid link lengths'));
    if(kind==='imu') {
      const end=rotateYaw([pose.centers[6][0]+42,0,pose.centers[6][2]],pose.yaw);
      [107+pose.offset[0],pose.offset[1],113+pose.offset[2]].forEach((v,j)=>assert(Math.abs(end[j]-v)<1e-8,'Sensor command and tool position share one model'));
      assert(pose.grip>=0 && pose.grip<=3);
    } else if(pose.offset[2]<0) assert.equal(pose.offset[0],0,'Never move sideways inside the socket');
  }
  assert.deepEqual(poseAt(kind,CYCLE_SECONDS),first,'Seamless cycle');
  const end=poseAt(kind,CYCLE_SECONDS-1e-4);
  end.centers.forEach((c,i)=>assert(distance(c,first.centers[i])<1e-6,'No loop jump'));
  // Cached browser geometry must match the audited, uncached builder.
  const cache=new Map();
  for(const t of [0,2,4,5,8,11,13,16]) {
    const a=buildScene(kind,t),b=buildScene(kind,t,null,cache);
    assert.deepEqual(a.R.items.map(i=>[i.name,i.paths,i.inner]),b.R.items.map(i=>[i.name,i.paths,i.inner]));
  }
}
assert.throws(()=>poseAt('unknown',0));assert.throws(()=>poseAt('imu',NaN));
const audit=spawnSync(process.execPath,['scripts/build-project-figures.mjs','--audit','--check'],{encoding:'utf8'});
assert.equal(audit.status,0,audit.stdout+audit.stderr);
console.log(audit.stdout.trim());
console.log('Motion model: 3,602 poses, rigid lengths, mapped commands, alignment, loop continuity and cached geometry passed.');
