import contract from '../game.contract.json' with { type: 'json' };
import { worldFor, groundHeight, blocked } from './worlds.js';
export { worldFor, groundHeight } from './worlds.js';
export const TICK_RATE=60, FIXED_DT=1/60, TUNING=Object.freeze(contract.tuning), ISLAND_RADIUS=40;
const EPS=1e-9, states=['spawning','wander','chase','recoil','stunned'];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const near=(a,b,r)=>dist(a,b)<=r+EPS;
const idOrder=(a,b)=>{const x=/^(.*?)(\d+)$/.exec(a.id),y=/^(.*?)(\d+)$/.exec(b.id);return x&&y&&x[1]===y[1]?Number(x[2])-Number(y[2]):a.id<b.id?-1:a.id>b.id?1:0;};
const rounded=(v)=>Number(v.toFixed(3));
const pos=(p)=>p.map(rounded);
const isObject=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const vec=(v)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function need(ok,message){if(!ok)throw new TypeError(message);}
const nonnegative=(n)=>Number.isSafeInteger(n)&&n>=0;
export function defaultInput(){return {move:[0,0],cam_yaw_deg:0,jump:false,interact:false,pulse:false,dash:false,pause:false};}
export function validateInputs(input){
  need(isObject(input)&&Array.isArray(input.frames),'inputs cần mảng frames.'); let last=-1;
  for(const frame of input.frames){
    need(isObject(frame)&&nonnegative(frame.tick)&&frame.tick>last,'tick phải là số nguyên không âm tăng nghiêm ngặt.');last=frame.tick;
    if('move'in frame)need(Array.isArray(frame.move)&&frame.move.length===2&&frame.move.every(n=>Number.isFinite(n)&&Math.abs(n)<=1),'move cần 2 số trong [-1,1].');
    if('cam_yaw_deg'in frame)need(Number.isFinite(frame.cam_yaw_deg),'cam_yaw_deg sai định dạng.');
    for(const k of ['jump','interact','pulse','dash','pause'])if(k in frame)need(typeof frame[k]==='boolean',`${k} phải là boolean.`);
  }
}
export function validateScenario(s,night=1){
  need(isObject(s),'scenario phải là object.');
  for(const k of ['random_motes','random_shades','random_drifters','wind_enabled'])if(k in s)need(typeof s[k]==='boolean',`${k} phải là boolean.`);
  if('time_left_s'in s)need(Number.isFinite(s.time_left_s)&&s.time_left_s>=0,'time_left_s không hợp lệ.');
  if('player'in s){need(isObject(s.player),'player không hợp lệ.');const p=s.player;
    if('pos'in p)need(vec(p.pos),'player.pos cần 3 số.');
    for(const k of ['carried','flames','invuln_ticks','dash_cd_ticks','pulse_cd_ticks','charm_ticks'])if(k in p)need(nonnegative(p[k]),`${k} không hợp lệ.`);
    if('carried'in p)need(p.carried<=10,'carried vượt sức chứa.');
  }
  if('motes'in s)need(Array.isArray(s.motes)&&s.motes.every(vec),'motes cần mảng vị trí.');
  for(const k of ['lanterns','shades','drifters','charms'])if(k in s){
    need(Array.isArray(s[k]),`${k} phải là mảng.`);const ids=new Set();
    for(const item of s[k]){need(isObject(item),`${k}: phần tử không hợp lệ.`);
      if('pos'in item)need(vec(item.pos),'pos cần 3 số.');
      if(k==='shades'||k==='drifters')need(vec(item.pos),'Thiếu pos.');
      if('id'in item){need(typeof item.id==='string'&&item.id.length>0&&!ids.has(item.id),'id rỗng hoặc trùng.');ids.add(item.id);}
      if(k==='lanterns'){need(worldFor(night).lamps.some((_,i)=>item.id===`L${i+1}`),'lantern.id không tồn tại trong Đêm.');
        if('deposited'in item)need(nonnegative(item.deposited)&&item.deposited<=10,'deposited không hợp lệ.');if('lit'in item)need(typeof item.lit==='boolean','lit phải là boolean.');}
      if(k==='shades'&&'state'in item)need(states.includes(item.state),'Trạng thái Bóng Mực không hợp lệ.');
      if(k==='drifters'&&'state'in item)need(['idle','chase','flee','removed'].includes(item.state),'Trạng thái Gió Lạc không hợp lệ.');
      for(const field of ['state_ticks_left','stolen','respawn_ticks'])if(field in item)need(nonnegative(item[field]),`${field} không hợp lệ.`);
      if('available'in item)need(typeof item.available==='boolean','available phải là boolean.');
    }
  }
}
function random(g){g.rng=(g.rng+0x6d2b79f5)>>>0;let t=g.rng;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
const choose=(g,list)=>list.length?list[Math.floor(random(g)*list.length)]:undefined;
function mote(g,p,kind='random',ttl=null){return {id:`M${g.nextMoteId++}`,pos:[...p],kind,ttl,born:g.sim_tick};}
function shade(g,p,override={}){
  let id=override.id;while(!id||g.shades.some(s=>s.id===id)){id=`S${g.nextShadeId++}`;if(g.reserved.has(id))id=null;}
  return {id,pos:[...p],state:override.state??'wander',left:override.state_ticks_left??0,push:[0,0],pushLeft:0,recoil:[0,0],safeLeft:0,...override};
}
export function createSimulation({seed=1,night=1,scenario={}}={}){
  need(Number.isSafeInteger(seed),'seed phải là số nguyên an toàn.');need([1,2,3].includes(night),'night phải là 1, 2, 3.');validateScenario(scenario,night);
  const world=worldFor(night), given=scenario.player??{};
  const g={night,world,tick:0,sim_tick:0,state:'playing',score:0,reason:null,started:false,rng:seed>>>0,
    initialTime:scenario.time_left_s??world.duration,time_left_s:scenario.time_left_s??world.duration,
    previousInput:defaultInput(),nextMoteId:1,nextShadeId:1,nextDrifterId:1,reserved:new Set((scenario.shades??[]).map(s=>s.id).filter(Boolean)),
    randomMotes:scenario.random_motes??true,randomShades:scenario.random_shades??true,randomDrifters:scenario.random_drifters??true,
    windEnabled:scenario.wind_enabled??true,wind:{active:false,dir_deg:0,warning:false},motes:[],shades:[],drifters:[],
    lanterns:world.lamps.map((p,i)=>({id:`L${i+1}`,pos:[...p],deposited:0,lit:false})),
    charms:world.charms.map((p,i)=>({id:`C${i+1}`,pos:[...p],available:true,respawn:0})),
    player:{pos:[...(given.pos??world.spawn)],carried:given.carried??0,flames:given.flames??3,vel:[0,0,0],vy:0,grounded:false,face:[0,1],invuln:given.invuln_ticks??0,dashCd:given.dash_cd_ticks??0,pulseCd:given.pulse_cd_ticks??0,charm:given.charm_ticks??0,dashLeft:0,dashDir:[0,1],launch:null,respawn:0},
  };
  const h=groundHeight(world,g.player.pos[0],g.player.pos[2]);g.player.grounded=h!==null&&Math.abs(h-g.player.pos[1])<EPS;
  for(const override of scenario.lanterns??[]){const l=g.lanterns.find(l=>l.id===override.id);Object.assign(l,override);l.pos=[...l.pos];l.lit=override.lit??l.deposited===10;if(l.lit)l.deposited=10;}
  if(scenario.motes!==undefined)g.motes=scenario.motes.map(p=>mote(g,p));
  else if(g.randomMotes){const points=[...world.motePoints];for(let i=0;i<20&&points.length;i++)g.motes.push(mote(g,points.splice(Math.floor(random(g)*points.length),1)[0]));}
  for(const s of scenario.shades??[])g.shades.push(shade(g,s.pos,s));
  g.drifters=(scenario.drifters??[]).map((d,i)=>({id:d.id??`D${i+1}`,pos:[...d.pos],state:d.state??'idle',stolen:d.stolen??0,left:d.state_ticks_left??(d.state==='flee'?240:0),dir:away(d.pos,g.player.pos),born:0}));
  while(g.drifters.some(d=>d.id===`D${g.nextDrifterId}`))g.nextDrifterId++;
  if(scenario.charms!==undefined)g.charms=scenario.charms.map((c,i)=>({id:c.id??`C${i+1}`,pos:[...(c.pos??world.charms[i]??[0,0,0])],available:c.available??true,respawn:c.respawn_ticks??Math.round((c.respawn_s??0)*60)}));
  return g;
}
function move(g,entity,dx,dz){const old=[...entity.pos],next=[old[0]+dx,old[1],old[2]+dz];if(!blocked(g.world,old,next)){entity.pos[0]=next[0];entity.pos[2]=next[2];}}
function away(a,b){const d=dist(a,b);return d>EPS?[(a[0]-b[0])/d,(a[2]-b[2])/d]:[1,0];}
function drop(g,at,count,scatter=true){for(let i=0;i<count;i++){const angle=scatter?random(g)*Math.PI*2:0,r=scatter?1.5+random(g):0,x=at[0]+Math.cos(angle)*r,z=at[2]+Math.sin(angle)*r;g.motes.push(mote(g,[x,groundHeight(g.world,x,z)??at[1],z],'dropped',480));}}
function safeMovement(g,s){
  for(const l of g.lanterns)if(l.lit&&dist(s.pos,l.pos)<6-EPS){
    const dir=away(s.pos,l.pos),gap=6-dist(s.pos,l.pos);
    if(!s.safeLeft)s.safeLeft=30;
    move(g,s,dir[0]*gap/s.safeLeft,dir[1]*gap/s.safeLeft);s.safeLeft=Math.max(0,s.safeLeft-1);return true;
  }
  s.safeLeft=0;return false;
}
function shadeMove(g,s,dx,dz){const before=[...s.pos];move(g,s,dx,dz);for(const l of g.lanterns)if(l.lit&&dist(before,l.pos)>=6-EPS&&dist(s.pos,l.pos)<6){const dir=away(s.pos,l.pos);s.pos[0]=l.pos[0]+dir[0]*6;s.pos[2]=l.pos[2]+dir[1]*6;}}
function playerMotion(g,input,pressed,emit,waiting){
  const p=g.player;if(waiting){if(p.respawn===0){p.pos=[...g.world.spawn];p.vel=[0,0,0];p.vy=0;p.grounded=true;p.launch=null;p.invuln=90;}return false;}
  const [x,z]=input.move??[0,0],n=Math.max(1,Math.hypot(x,z)),a=(input.cam_yaw_deg??0)*Math.PI/180;
  const direction=[(x*Math.cos(a)+z*Math.sin(a))/n,(-x*Math.sin(a)+z*Math.cos(a))/n];if(x||z)p.face=[...direction];
  if(pressed('jump')&&p.grounded){p.vy=7;p.grounded=false;emit('jump',{});}
  if(pressed('dash')&&p.dashLeft===0&&(p.dashCd===0||p.charm>0)){p.dashLeft=12;p.dashCd=p.charm>0?0:90;p.dashDir=[...p.face];emit('dash',{});}
  for(const pad of g.world.pads)if(p.grounded&&near(p.pos,pad.pos,1)&&Math.abs(p.pos[1]-pad.pos[1])<0.1){
    const d=away(pad.target,pad.pos);p.launch=[d[0]*pad.speed,d[1]*pad.speed];p.vy=pad.vy;p.grounded=false;break;
  }
  const speed=p.charm>0?7.2:6;let vx=direction[0]*speed,vz=direction[1]*speed;
  if(p.launch)[vx,vz]=p.launch;if(p.dashLeft>0){vx=p.dashDir[0]*14;vz=p.dashDir[1]*14;}
  if(g.wind.active){const a=g.wind.dir_deg*Math.PI/180;vx+=2*Math.cos(a);vz+=2*Math.sin(a);}
  const old=[...p.pos];move(g,p,vx/60,vz/60);let floor=groundHeight(g.world,p.pos[0],p.pos[2]);
  if(p.grounded&&(floor===null||floor<p.pos[1]-0.12))p.grounded=false;
  if(p.grounded&&floor!==null)p.pos[1]=floor;
  else if(!p.dashLeft){p.pos[1]+=p.vy/60-10/3600;p.vy-=20/60;
    if(floor!==null&&old[1]>=floor-EPS&&p.pos[1]<=floor&&p.vy<=0){p.pos[1]=floor;p.vy=0;p.grounded=true;p.launch=null;}}
  p.vel=[(p.pos[0]-old[0])*60,p.dashLeft?0:p.vy,(p.pos[2]-old[2])*60];if(p.dashLeft>0)p.dashLeft--;
  if(p.pos[1]<-10){const lost=p.carried;p.carried=0;p.flames--;p.respawn=60;p.vel=[0,0,0];emit('player_hit',{by:'fall',flames:p.flames,dropped:0,lost});return false;}
  return true;
}
export function stepSimulation(g,input=defaultInput()){
  if(g.state==='won'||g.state==='lost')return [];
  g.tick++;const events=[],emit=(name,data)=>events.push({type:'event',tick:g.tick,name,data});
  const pressed=k=>Boolean(input[k])&&!g.previousInput[k];
  if(!g.started){emit('night_start',{night:g.night});g.started=true;}
  if(pressed('pause')){g.state=g.state==='paused'?'playing':'paused';emit(g.state==='paused'?'paused':'resumed',{});}
  if(g.state==='paused'){g.previousInput={...input};return events;}
  g.sim_tick++;g.time_left_s=Math.max(0,g.initialTime-g.sim_tick/60);const p=g.player,waiting=p.respawn>0;
  for(const k of ['invuln','dashCd','pulseCd','charm','respawn'])p[k]=Math.max(0,p[k]-1);
  for(const s of g.shades){s.previousState=s.state;s.previousLeft=s.left;s.left=Math.max(0,s.left-1);if(s.pushLeft>0)s.pushLeft--;}
  for(const c of g.charms)if(!c.available){c.respawn=Math.max(0,c.respawn-1);if(c.respawn===0)c.available=true;}
  for(const m of g.motes)if(m.ttl!==null)m.ttl--;g.motes=g.motes.filter(m=>m.ttl===null||m.ttl>0);
  if(g.night===3&&g.windEnabled){const cycle=g.sim_tick%1800;
    if(cycle===1680)g.wind.dir_deg=random(g)*360;g.wind.warning=cycle>=1680;g.wind.active=g.sim_tick>=1800&&cycle<300;}
  const active=playerMotion(g,input,pressed,emit,waiting);
  if(active){
    g.motes=g.motes.filter(m=>{if(m.born>=g.sim_tick||p.carried>=10||!near(p.pos,m.pos,1)||Math.abs(p.pos[1]-m.pos[1])>1.5)return true;p.carried++;emit('mote_picked',{carried:p.carried});return false;});
    for(const c of g.charms)if(c.available&&near(p.pos,c.pos,1)&&Math.abs(p.pos[1]-c.pos[1])<=1.5){c.available=false;c.respawn=2700;p.charm=600;emit('charm_picked',{charm_id:c.id,charm_ticks:600});}
    if(pressed('interact')&&p.carried>0){const l=g.lanterns.filter(l=>!l.lit&&near(p.pos,l.pos,2)).sort((a,b)=>dist(p.pos,a.pos)-dist(p.pos,b.pos)||(a.id<b.id?-1:1))[0];
      if(l){const amount=Math.min(p.carried,10-l.deposited);p.carried-=amount;l.deposited+=amount;g.score+=amount*10;emit('deposit',{lantern_id:l.id,amount,deposited:l.deposited});if(l.deposited===10){l.lit=true;g.score+=100;emit('lantern_lit',{lantern_id:l.id});}}}
  }
  if(active&&pressed('pulse')&&p.carried>=3&&p.pulseCd===0){
    p.carried-=3;p.pulseCd=180;const hit=[];const center=[p.pos[0],p.pos[1]+0.8,p.pos[2]];
    for(const s of g.shades)if(Math.hypot(s.pos[0]-center[0],s.pos[1]-center[1],s.pos[2]-center[2])<=5+EPS){s.state='stunned';s.left=120;s.push=away(s.pos,p.pos);s.pushLeft=15;g.score+=5;hit.push(s.id);}
    for(const d of g.drifters)if(d.state!=='removed'&&Math.hypot(d.pos[0]-center[0],d.pos[1]-center[1],d.pos[2]-center[2])<=5+EPS){
      if(d.state==='chase'){d.state='flee';d.left=240;d.dir=away(d.pos,p.pos);}
      else if(d.state==='flee'&&d.stolen>0){drop(g,d.pos,d.stolen,false);emit('drifter_drop',{drifter_id:d.id,amount:d.stolen});d.stolen=0;d.left=120;}}
    emit('pulse',{stunned_ids:hit});
  }
  for(const s of g.shades){
    const safe=safeMovement(g,s);s.safetyThisTick=safe;if(safe)continue;
    if(s.state==='stunned'){
      if(s.pushLeft>0)shadeMove(g,s,s.push[0]*4/15,s.push[1]*4/15);
      if(s.left===0)s.state='wander';else continue;
    }
    if(s.state==='recoil'){
      if(s.previousState==='recoil')shadeMove(g,s,s.recoil[0]*2/60,s.recoil[1]*2/60);
      if(s.left===0)s.state='wander';continue;
    }
    if(s.state==='spawning'){if(s.left===0)s.state='wander';else continue;}
    const gap=dist(p.pos,s.pos);if(s.state==='chase'&&gap>18)s.state='wander';if(s.state==='wander'&&gap<=12)s.state='chase';
    if(s.state==='chase'){const d=away(p.pos,s.pos),speed=g.night===3?4.5:4;shadeMove(g,s,d[0]*Math.min(gap,speed/60),d[1]*Math.min(gap,speed/60));}
    else {const angle=(g.sim_tick/240+Number(s.id.replace(/\D/g,'')))*0.5;shadeMove(g,s,Math.cos(angle)*2/60,Math.sin(angle)*2/60);}
    const h=groundHeight(g.world,s.pos[0],s.pos[2]);if(h!==null)s.pos[1]=h+0.8;
  }
  for(const d of g.drifters){
    if(d.state==='flee'){d.left--;d.pos[0]+=d.dir[0]*7/60;d.pos[2]+=d.dir[1]*7/60;if(d.left<=0)d.state='removed';continue;}
    const gap=dist(d.pos,p.pos);d.state=p.carried>=5&&gap<=15?'chase':'idle';
    const dir=d.state==='chase'?away(p.pos,d.pos):[Math.cos(g.sim_tick/180),Math.sin(g.sim_tick/180)];
    // Gió Lạc bay, không va chạm địa hình hoặc vùng an toàn.
    d.pos[0]+=dir[0]*(d.state==='chase'?7:2)/60;d.pos[2]+=dir[1]*(d.state==='chase'?7:2)/60;
  }
  g.drifters=g.drifters.filter(d=>d.state!=='removed');
  if(active){
    for(const d of [...g.drifters].sort(idOrder))if(d.state==='chase'&&near(d.pos,p.pos,1.2)){const amount=Math.min(3,p.carried);p.carried-=amount;d.stolen=amount;d.state='flee';d.left=240;d.dir=away(d.pos,p.pos);emit('drifter_steal',{drifter_id:d.id,amount,carried:p.carried});}
    if(p.invuln===0)for(const s of [...g.shades].sort(idOrder))if(!s.safetyThisTick&&!s.safeLeft&&['wander','chase'].includes(s.state)&&near(s.pos,p.pos,1)&&Math.abs(s.pos[1]-p.pos[1])<=1.5){
      p.flames--;const amount=Math.floor(p.carried/2);p.carried-=amount;drop(g,p.pos,amount);p.invuln=90;s.state='recoil';s.left=60;s.recoil=away(s.pos,p.pos);emit('player_hit',{by:'shade',flames:p.flames,dropped:amount});break;}
  }
  if(g.randomMotes&&g.sim_tick%240===0&&g.motes.length<30){const vacant=g.world.motePoints.filter(p=>!g.motes.some(m=>m.kind==='random'&&dist(m.pos,p)<0.01&&Math.abs(m.pos[1]-p[1])<0.01));const p=choose(g,vacant);if(p)g.motes.push(mote(g,p));}
  if(g.randomShades&&(g.sim_tick===300||(g.sim_tick>300&&(g.sim_tick-300)%g.world.interval===0))){
    for(let i=0;i<(g.sim_tick===300?2:1)&&g.shades.length<g.world.maxShades;i++){
      const point=choose(g,g.world.shadePoints.filter(s=>dist(s,p.pos)>=15&&!g.shades.some(q=>dist(q.pos,s)<1)));
      if(point){const s=shade(g,[point[0],point[1]+0.8,point[2]],{state:'spawning',state_ticks_left:60});g.shades.push(s);emit('shade_spawned',{id:s.id});}}
  }
  if(g.night>=2&&g.randomDrifters&&g.sim_tick%1200===0&&g.drifters.length<2){const point=choose(g,g.world.shadePoints);let id;do{id=`D${g.nextDrifterId++}`;}while(g.drifters.some(d=>d.id===id));g.drifters.push({id,pos:[point[0],point[1]+0.8,point[2]],state:'idle',stolen:0,left:0,dir:[1,0],born:g.sim_tick});}
  if(p.flames<=0){g.state='lost';g.reason='no_flames';}
  else if(g.lanterns.every(l=>l.lit)){g.state='won';g.reason='all_lit';g.score+=Math.floor(g.time_left_s)*2+50*p.flames;}
  else if(g.time_left_s<=EPS){g.state='lost';g.reason='dawn';}
  if(g.state==='won'||g.state==='lost')emit('game_over',{result:g.state,reason:g.reason});
  g.previousInput={...input};return events;
}
export function snapshot(g){const p=g.player;return {
  type:'snapshot',tick:g.tick,sim_tick:g.sim_tick,night:g.night,state:g.state,time_left_s:g.time_left_s,score:g.score,wind:{active:g.wind.active,dir_deg:g.wind.dir_deg},
  player:{pos:pos(p.pos),vel:pos(p.vel),grounded:p.grounded,flames:p.flames,carried:p.carried,invuln:p.invuln>0,dash_cd_s:p.dashCd/60,pulse_cd_s:p.pulseCd/60,charm_s:p.charm/60},
  lanterns:g.lanterns.map(l=>({...l,pos:pos(l.pos)})),shades:g.shades.map(s=>({id:s.id,pos:pos(s.pos),state:s.state})),
  motes_active:g.motes.length,motes:g.motes.map(m=>({id:m.id,pos:pos(m.pos),kind:m.kind,ttl_s:m.ttl===null?null:m.ttl/60})),
  drifters:g.drifters.map(d=>({id:d.id,pos:pos(d.pos),state:d.state,stolen:d.stolen})),charms:g.charms.map(c=>({id:c.id,available:c.available,respawn_s:c.respawn/60})),
};}
