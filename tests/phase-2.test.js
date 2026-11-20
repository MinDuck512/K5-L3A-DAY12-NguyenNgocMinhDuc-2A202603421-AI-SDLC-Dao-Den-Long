import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSimulation,stepSimulation,snapshot,defaultInput,worldFor,groundHeight} from '../src/simulation.js';
const quiet=(night=1,scenario={})=>createSimulation({night,scenario:{random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,...scenario}});
const act=(g,changes={})=>stepSimulation(g,{...defaultInput(),...changes});
const run=(g,n,input={})=>{const all=[];for(let i=0;i<n;i++)all.push(...act(g,input));return all;};
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('pause freezes all gameplay counters, snapshots and held button edges',()=>{
 const g=quiet(2,{player:{invuln_ticks:50,dash_cd_ticks:40,pulse_cd_ticks:30,charm_ticks:600},charms:[{id:'C1',pos:[10,0,0],available:false,respawn_ticks:200}]});
 act(g,{pause:true});const frozen=snapshot(g);run(g,60,{pause:true,dash:true,move:[1,0]});
 assert.equal(g.tick,61);assert.equal(g.sim_tick,0);assert.equal(g.state,'paused');assert.equal(g.time_left_s,270);assert.deepEqual(snapshot(g).player,frozen.player);assert.equal(g.charms[0].respawn,200);
 act(g);act(g,{pause:true});assert.equal(g.state,'playing');assert.equal(g.sim_tick,1);assert.equal(g.player.invuln,49);
});
test('dash follows facing when still, lasts 12 ticks, holds air height, no invulnerability',()=>{
 const g=quiet();act(g,{dash:true});run(g,11,{dash:true});close(g.player.pos[2],2.8);assert.equal(g.player.dashLeft,0);assert.equal(g.player.invuln,0);
 assert.equal(act(g,{dash:true}).some(e=>e.name==='dash'),false);
 const air=quiet(1,{player:{pos:[0,4,0]}});act(air,{dash:true});run(air,11);close(air.player.pos[1],4);act(air);assert.ok(air.player.pos[1]<4);
});
test('Bùa Gió has 600 tick effect, 2700 tick respawn, speed 7.2 and repeated dash without cooldown',()=>{
 const g=quiet(2,{charms:[{id:'C1',pos:[0,0,0]}]});const picked=act(g);assert.ok(picked.some(e=>e.name==='charm_picked'));assert.equal(g.player.charm,600);
 run(g,60,{move:[1,0]});close(g.player.pos[0],7.2);act(g,{dash:true});assert.equal(g.player.dashCd,0);run(g,11);assert.ok(act(g,{dash:true}).some(e=>e.name==='dash'));
 g.player.pos=[10,0,0];run(g,527);assert.equal(g.player.charm,0);assert.equal(g.charms[0].available,false);
 run(g,2100);assert.equal(g.charms[0].available,true);
});
test('pads launch toward other island and land; bridge edges are fallable',()=>{
 const g=quiet(2,{player:{pos:[20,0,18]}});act(g,{move:[-1,0]});assert.ok(g.player.vy>13);assert.ok(g.player.launch[0]>0);
 run(g,90,{move:[-1,0]});assert.ok(g.player.pos[0]>45);assert.equal(g.player.grounded,true);
 assert.equal(groundHeight(g.world,35,0),0);assert.equal(groundHeight(g.world,35,2.01),null);
});
test('night 3 levels, ramps, vertical walls, bell and upper pad',()=>{
 const world=worldFor(3);assert.equal(groundHeight(world,0,6),6);assert.equal(groundHeight(world,18,10),3);assert.equal(groundHeight(world,0,-20),0);
 close(groundHeight(world,27*Math.cos(Math.PI/6),27*Math.sin(Math.PI/6)),1.5);
 const wall=quiet(3,{player:{pos:[0,0,25]}});run(wall,30,{move:[0,-1]});assert.ok(wall.player.pos[2]>=24);
 const jump=quiet(3,{player:{pos:[0,3,13]}});run(jump,65);assert.equal(jump.player.grounded,true);close(jump.player.pos[1],6);assert.ok(jump.player.pos[2]<8);
 const bell=quiet(3,{player:{pos:[0,6,3]}});run(bell,30,{move:[0,-1]});assert.ok(bell.player.pos[2]>=2);
});
test('wind warns 2 seconds before each 30 second gust, pushes 2 m/s, stops when paused',()=>{
 const g=createSimulation({night:3,scenario:{random_motes:false,random_shades:false,random_drifters:false}});
 run(g,1680);assert.equal(g.wind.warning,true);assert.equal(g.wind.active,false);run(g,120);assert.equal(g.wind.active,true);
 const before=[...g.player.pos];run(g,60);close(Math.hypot(g.player.pos[0]-before[0],g.player.pos[2]-before[2]),2);
 act(g,{pause:true});const at=[...g.player.pos];run(g,100);assert.deepEqual(g.player.pos,at);assert.equal(g.sim_tick,1860);
});
test('Gió Lạc steals before shade hit even through invulnerability and safe zone',()=>{
 const g=quiet(2,{player:{carried:8,invuln_ticks:90},lanterns:[{id:'L1',pos:[0,0,0],lit:true}],drifters:[{id:'D1',pos:[.5,.8,0]}]});
 const events=act(g);assert.equal(g.player.carried,5);assert.equal(g.player.flames,3);assert.equal(g.drifters[0].state,'flee');assert.ok(events.some(e=>e.name==='drifter_steal'));
 run(g,240);assert.equal(g.drifters.length,0);
 const order=quiet(2,{player:{carried:8},drifters:[{id:'D1',pos:[0,.8,0]}],shades:[{id:'S2',pos:[0,.8,0],state:'chase'}]});const e=act(order);assert.deepEqual(e.filter(e=>['drifter_steal','player_hit'].includes(e.name)).map(e=>e.name),['drifter_steal','player_hit']);assert.equal(order.player.carried,3);
});
test('pulse frightens chase drifter; pulse on loaded flee returns all stolen motes',()=>{
 const chase=quiet(2,{player:{carried:6},drifters:[{id:'D1',pos:[1,.8,0],state:'chase'}]});act(chase,{pulse:true});assert.equal(chase.drifters[0].state,'flee');assert.equal(chase.drifters[0].stolen,0);
 const flee=quiet(2,{player:{carried:3},drifters:[{id:'D1',pos:[1,.8,0],state:'flee',stolen:3,state_ticks_left:240}]});const events=act(flee,{pulse:true});assert.ok(events.some(e=>e.name==='drifter_drop'&&e.data.amount===3));assert.equal(flee.motes.filter(m=>m.kind==='dropped').length,3);assert.equal(flee.drifters[0].stolen,0);run(flee,120);assert.equal(flee.drifters.length,0);
});
test('spawn schedules: motes at 240, shades at 300/780, drifters at 1200; no same-tick pickup',()=>{
 const g=createSimulation({scenario:{random_shades:true,random_motes:true}});run(g,239);assert.equal(g.motes.length,20);act(g);assert.equal(g.motes.length,21);run(g,60);assert.equal(g.shades.length,2);assert.ok(g.shades.every(s=>s.state==='spawning'));run(g,480);assert.equal(g.shades.length,3);
 const d=quiet(2,{random_drifters:true});run(d,1199);assert.equal(d.drifters.length,0);act(d);assert.equal(d.drifters.length,1);
});
test('hit drops floor(carried/2) at 1.5..2.5 m, TTL 480 and one hit per tick',()=>{
 const g=quiet(1,{player:{carried:9},shades:[{id:'S2',pos:[0,.8,0]},{id:'S1',pos:[0,.8,0]}]});const events=act(g);assert.equal(events.filter(e=>e.name==='player_hit').length,1);assert.equal(g.player.carried,5);assert.equal(g.shades.find(s=>s.id==='S1').state,'recoil');assert.equal(g.motes.length,4);
 for(const m of g.motes){const d=Math.hypot(m.pos[0],m.pos[2]);assert.ok(d>=1.5&&d<=2.5);assert.equal(m.ttl,480);}
 g.shades=[];run(g,479);assert.equal(g.motes.length,4);act(g);assert.equal(g.motes.length,0);
});
test('safe newly lit light ejects shade within 30 ticks without damage; outside shade stays at rim',()=>{
 const g=quiet(1,{player:{carried:10},lanterns:[{id:'L1',pos:[0,0,0]}],shades:[{id:'S1',pos:[0,.8,0]}]});act(g,{interact:true});run(g,29);assert.equal(g.player.flames,3);close(Math.hypot(g.shades[0].pos[0],g.shades[0].pos[2]),6);
 run(g,30);assert.ok(Math.hypot(g.shades[0].pos[0],g.shades[0].pos[2])>=6-1e-7);
});
test('pulse repeated on stunned shade refreshes and scores every target every activation',()=>{
 const g=quiet(1,{player:{carried:10},shades:[{id:'S1',pos:[1,.8,0]}]});act(g,{pulse:true});assert.equal(g.score,5);
 act(g);g.player.pulseCd=0;g.shades[0].pos=[1,.8,0];act(g,{pulse:true});assert.equal(g.score,10);assert.equal(g.shades[0].left,120);
});
test('no flames always loses; enough lit lanterns win only at dawn; v1.2 snapshot keeps Phase 2 fields',()=>{
 const lamps=worldFor(1).lamps.map((_,i)=>({id:`L${i+1}`,lit:true}));const early=quiet(1,{lanterns:lamps});act(early);assert.equal(early.state,'playing');
 const won=quiet(1,{time_left_s:1/60,lanterns:lamps});act(won);assert.equal(won.state,'won');assert.equal(won.reason,'dawn_survived');
 const lost=quiet(1,{player:{flames:0},lanterns:lamps});act(lost);assert.equal(lost.reason,'no_flames');
 const state=snapshot(quiet(3));for(const field of ['night','wind','motes','drifters','charms'])assert.ok(field in state);for(const field of ['vel','grounded','invuln','dash_cd_s','pulse_cd_s','charm_s'])assert.ok(field in state.player);
});

test('headless scenario per Phase 2 feature and full Phase 3 night budget',()=>{
 const folder=mkdtempSync(join(tmpdir(),'dao-p2-'));const out=join(folder,'out.jsonl'),scenario=join(folder,'scenario.json'),inputs=join(folder,'inputs.json');
 const cli=(night,ticks,frames,s)=>{writeFileSync(scenario,JSON.stringify({random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,...s}));writeFileSync(inputs,JSON.stringify({frames}));const result=spawnSync(process.execPath,['src/headless.js','--night',String(night),'--seed','1','--ticks',String(ticks),'--scenario',scenario,'--inputs',inputs,'--snapshot-every','1','--out',out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return readFileSync(out,'utf8').trim().split('\n').map(JSON.parse);};
 try{
  let r=cli(1,12,[{tick:0,dash:true}],{});close(r.at(-2).player.pos[2],2.8,.001);
  r=cli(2,2,[],{charms:[{id:'C1',pos:[0,0,0]}]});assert.ok(r.some(e=>e.name==='charm_picked'));
  r=cli(2,1,[],{player:{carried:8},drifters:[{id:'D1',pos:[0,.8,0]}]});assert.ok(r.some(e=>e.name==='drifter_steal'));
  r=cli(2,1,[{tick:0,pulse:true}],{player:{carried:3},drifters:[{id:'D1',pos:[0,.8,0],state:'flee',stolen:3}]});assert.ok(r.some(e=>e.name==='drifter_drop'));
  r=cli(1,10,[{tick:0,pause:true},{tick:5,pause:false},{tick:6,pause:true}],{});assert.equal(r.find(e=>e.type==='snapshot'&&e.tick===6).sim_tick,0);assert.equal(r.at(-2).sim_tick,4);
  r=cli(2,90,[],{player:{pos:[20,0,18]}});assert.ok(r.at(-2).player.pos[0]>45);
  r=cli(3,65,[],{player:{pos:[0,3,13]}});assert.equal(r.at(-2).player.pos[1],6);
  r=cli(3,1801,[],{wind_enabled:true});assert.equal(r.at(-2).wind.active,true);
  const started=performance.now();r=cli(3,18000,[],{});assert.equal(r.at(-1).ticks,18000);assert.ok(performance.now()-started<30000);
  const first=readFileSync(out,'utf8');cli(3,18000,[],{});assert.equal(readFileSync(out,'utf8'),first);
 }finally{for(const name of readdirSync(folder))unlinkSync(join(folder,name));rmdirSync(folder);}
});


test('simultaneous contact uses numeric ID order S2 before S10',()=>{
 const g=quiet(3,{player:{pos:[0,0,-30]},shades:[{id:'S10',pos:[0,.8,-30]},{id:'S2',pos:[0,.8,-30]}]});
 act(g);assert.equal(g.shades.find(s=>s.id==='S2').state,'recoil');assert.notEqual(g.shades.find(s=>s.id==='S10').state,'recoil');
});
