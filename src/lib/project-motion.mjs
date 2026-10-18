// Illustrative world units and seconds, never hardware commands or policy timing.
const ease = t => t*t*t*(10+t*(-15+6*t));
export const CYCLE_SECONDS = 18;
/** @type {Array<[number, number[], string, string]>} */
const insertion = [
  [0, [0,0,0,0], 'Aligned above port', ''],
  [1, [0,0,0,0], 'Insert downward', ''],
  [4, [0,0,-18,0], 'Hold the module', ''],
  [6, [0,0,-18,0], 'Withdraw vertically', ''],
  [9, [0,0,12,0], 'Reset above the fixture', ''],
  [11, [-12,0,12,0], 'Approach the port', ''],
  [14, [0,0,12,0], 'Align above the opening', ''],
  [17, [0,0,0,0], 'Aligned above port', ''],
  [18, [0,0,0,0], 'Aligned above port', ''],
];
/** @type {Array<[number, number[], string, string]>} */
const imu = [
  [0, [0,0,0,0], 'Ready for sensor commands', ''],
  [1, [0,0,0,0], 'MPU6050 → X motion', 'imu'],
  [4, [10,0,0,0], 'MPU6050 → Y motion', 'imu'],
  [7, [10,10,0,0], 'Encoder → Z motion', 'encoder'],
  [10, [10,10,10,0], 'IR → close gripper', 'ir'],
  [12, [10,10,10,3], 'IR → open gripper', 'ir'],
  [14, [10,10,10,0], 'Return to start', ''],
  [18, [0,0,0,0], 'Ready for sensor commands', ''],
];

// Two-link planar solution with one fixed elbow branch. The other joints keep
// their illustrated offsets. ponytail: bounded teaching poses, not a general IK solver.
function elbowAt(shoulder, wrist, upper, lower) {
  const dx=wrist[0]-shoulder[0], dz=wrist[2]-shoulder[2], d=Math.hypot(dx,dz);
  if(d >= upper+lower || d <= Math.abs(upper-lower)) throw new RangeError('Unreachable figure pose');
  const a=(upper*upper-lower*lower+d*d)/(2*d), h=Math.sqrt(upper*upper-a*a);
  return [shoulder[0]+(dx*a-dz*h)/d,0,shoulder[2]+(dz*a+dx*h)/d];
}
export function poseAt(kind, seconds=0) {
  if(!['imu','insertion'].includes(kind) || !Number.isFinite(seconds)) throw new TypeError('Invalid figure pose');
  const frames=kind==='imu'?imu:insertion;
  const t=((seconds%CYCLE_SECONDS)+CYCLE_SECONDS)%CYCLE_SECONDS;
  const index=frames.findIndex((f,i)=>i<frames.length-1 && t>=f[0] && t<frames[i+1][0]);
  const a=frames[index], b=frames[index+1], mix=ease((t-a[0])/(b[0]-a[0]));
  const [x,y,z,grip]=a[1].map((v,i)=>v+(b[1][i]-v)*mix);
  let centers, axes, yaw=0;
  if(kind==='imu') {
    // Hold the tool horizontal. Base yaw gives the commanded world-space Y.
    yaw=Math.atan2(y,107+x);
    const shoulder=[0,0,65], wrist=[Math.hypot(107+x,y)-71,0,113+z];
    const elbow=elbowAt(shoulder,wrist,Math.hypot(44,90),Math.hypot(80,42));
    const angle=Math.atan2(wrist[2]-elbow[2],wrist[0]-elbow[0])-Math.atan2(-42,80);
    const roll=[elbow[0]+52*Math.cos(angle)+19*Math.sin(angle),0,elbow[2]+52*Math.sin(angle)-19*Math.cos(angle)];
    const upper=[elbow[0]/2,0,(65+elbow[2])/2];
    centers=[[0,0,30],shoulder,upper,elbow,roll,wrist,[wrist[0]+29,0,wrist[2]]];
    axes=[[0,0,1],[0,1,0],[elbow[0],0,elbow[2]-65],[0,1,0],[roll[0]-elbow[0],0,roll[2]-elbow[2]],[0,1,0],[1,0,0]];
  } else {
    const shoulder=[0,0,68.24], wrist=[83+x,0,148+z];
    centers=[[0,0,30],shoulder,elbowAt(shoulder,wrist,100,392.2/4.25),wrist,[83+x,133.3/4.25,148+z],[83+x,133.3/4.25,148+z-99.7/4.25]];
    axes=[[0,0,1],[0,1,0],[0,1,0],[0,1,0],[1,0,0],[0,0,-1]];
  }
  return {centers,axes,yaw,grip,encoder:z/10*Math.PI/2,phase:a[2],command:a[3],time:t,offset:[x,y,z]};
}
export function rotateYaw([x,y,z], yaw) {return [x*Math.cos(yaw)-y*Math.sin(yaw),x*Math.sin(yaw)+y*Math.cos(yaw),z];}
