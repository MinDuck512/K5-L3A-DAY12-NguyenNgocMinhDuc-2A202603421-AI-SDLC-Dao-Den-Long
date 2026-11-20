// Bản đồ chuẩn Ticket-02; dùng chung cho vật lý, spawn và hiển thị.
const ring = (radius, count, start = 0, center = [0, 0, 0]) => Array.from({ length: count }, (_, i) => {
  const angle = (start + i * 360 / count) * Math.PI / 180;
  return [center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius];
});
export const PALETTE = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lantern: '#FFB347', core: '#FFE9B0', off: '#5B5F6E', mote: '#FFF6C2', halo: '#FFE58A',
  shade: '#120A1A', rim: '#7A3CFF', stunned: '#3A3450', shirt: '#E8E2D0', red: '#C8102E', gold: '#F2C14E', drifter: '#8FA3B8', danger: '#FF5A5F', text: '#F5F1E6',
};
export function worldFor(night) {
  if (night === 1) return {
    night, name: 'Đảo Bến', duration: 300, spawn: [0, 0, 0], islands: [[0,0,0,40]], pads: [], interval: 480, maxShades: 6,
    lamps: [[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]],
    motePoints: [...ring(12,8), ...ring(33,16)], shadePoints: ring(37,12,15), charms: [],
  };
  if (night === 2) return {
    night, name: 'Hai đảo cầu tre', duration: 330, spawn: [0,0,0], islands: [[0,0,0,28],[70,0,0,28]], interval: 420, maxShades: 8,
    pads: [{pos:[20,0,18], vy:14, speed:24, target:[70,0,0]}, {pos:[50,0,-18], vy:14, speed:24, target:[0,0,0]}],
    lamps: [[0,0,20],[17,0,-10],[-17,0,-10],[70,0,20],[87,0,-10],[53,0,-10]],
    motePoints: [0,70].flatMap(x=>[...ring(10,4,0,[x,0,0]), ...ring(22,8,0,[x,0,0])]),
    shadePoints: [0,70].flatMap(x=>ring(26,8,22.5,[x,0,0])), charms: [[35,0,0]],
  };
  return {
    night, name: 'Đảo tháp chuông', duration: 360, spawn: [0,0,-30], islands: [[0,0,0,45]], interval: 360, maxShades: 10,
    pads: [{pos:[0,3,13], vy:12, speed:8, target:[0,3,-100]}],
    lamps: [[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]],
    motePoints: [...ring(34,18), ...Array.from({length:8},(_,i)=>{ const a=(i+1)*20*Math.PI/180; return [18*Math.cos(a),3,18*Math.sin(a)]; }), ...ring(5,4,45,[0,6,0])],
    shadePoints: ring(43,16), charms: [[30,0,25],[-30,0,25]],
  };
}
export function rampHeight(x, z) {
  const r = Math.hypot(x,z);
  for (const degrees of [30,150]) {
    const angle=degrees*Math.PI/180, along=x*Math.cos(angle)+z*Math.sin(angle), side=-x*Math.sin(angle)+z*Math.cos(angle);
    if (along>=24-1e-8 && along<=30+1e-8 && Math.abs(side)<=1.5) return (30-along)/2;
  }
  return null;
}
export function groundHeight(world, x, z) {
  if (world.night===2) return world.islands.some(([cx,,cz,r])=>Math.hypot(x-cx,z-cz)<=r+1e-9) || (x>=26&&x<=44&&Math.abs(z)<=2) ? 0 : null;
  const r=Math.hypot(x,z);
  if(r>world.islands[0][3]+1e-9) return null;
  if(world.night!==3) return 0;
  if(r<=8) return 6;
  const ramp=rampHeight(x,z);
  if(ramp!==null) return ramp;
  return z>0&&r>=12&&r<=24 ? 3 : 0;
}
export function blocked(world, old, next) {
  if(world.night===3 && Math.hypot(next[0],next[2])<2 && next[1]<14) return true;
  const height=groundHeight(world,next[0],next[2]);
  return height!==null && height>old[1]+0.12 && height>next[1]+0.001 && !(world.night===3 && rampHeight(next[0],next[2])!==null);
}
