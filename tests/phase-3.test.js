import test from 'node:test';
import assert from 'node:assert/strict';
import contract from '../game.contract.json' with {type:'json'};
import {createSimulation,stepSimulation,snapshot,defaultInput,validateScenario,worldFor} from '../src/simulation.js';

const quiet=(scenario={},night=1)=>createSimulation({night,scenario:{random_motes:false,random_shades:false,random_drifters:false,wind_enabled:false,...scenario}});
const act=(g,changes={})=>stepSimulation(g,{...defaultInput(),...changes});
const run=(g,n,changes={})=>{const events=[];for(let i=0;i<n;i++)events.push(...act(g,changes));return events;};

test('contract 1.2 exposes required fuel tuning and shorter nights',()=>{
 assert.equal(contract.contract_version,'1.2');
 assert.deepEqual([contract.tuning.night1_duration_s,contract.tuning.night2_duration_s,contract.tuning.night3_duration_s],[240,270,300]);
 for(const [key,value] of Object.entries({fuel_max:100,fuel_decay_per_s:1,fuel_per_mote:10,relight_cost:5,win_ratio:.6,drain_per_s:5,low_fuel_threshold:30,capacity_max:20}))assert.equal(contract.tuning[key],value);
});

test('fuel uses exact 1/60 units, rounds snapshot and turns lantern out once',()=>{
 const g=quiet({lanterns:[{id:'L1',lit:true,fuel:.1}]});const events=run(g,6);
 assert.equal(g.lanterns[0].lit,false);assert.equal(snapshot(g).lanterns[0].fuel,0);
 assert.equal(events.filter(e=>e.name==='lantern_out').length,1);run(g,60);assert.equal(g.lanterns[0].fuelTicks,0);
 const decay=quiet({lanterns:[{id:'L1',lit:true}]});run(decay,60);assert.equal(snapshot(decay).lanterns[0].fuel,99);
});

test('interaction refuels nearest receivable lantern and scores five per mote',()=>{
 const g=quiet({player:{carried:3},lanterns:[{id:'L1',pos:[1,0,0],lit:true,fuel:89},{id:'L2',pos:[1.5,0,0],lit:true,fuel:50}]});
 const refuel=act(g,{interact:true}).find(e=>e.name==='refuel');
 assert.deepEqual(refuel.data,{lantern_id:'L1',amount:2,fuel:100});assert.equal(g.player.carried,1);assert.equal(g.score,10);
});

test('first light and relight use different costs, scores, flags and growing capacity',()=>{
 const first=quiet({player:{carried:10},lanterns:[{id:'L1',pos:[0,0,0]}]});let events=act(first,{interact:true});
 assert.equal(first.score,150);assert.equal(first.player.successfulLights,1);assert.equal(snapshot(first).player.capacity,12);assert.equal(events.find(e=>e.name==='lantern_lit').data.relight,false);
 const relight=quiet({player:{carried:5},lanterns:[{id:'L1',pos:[0,0,0],lit:false,ever_lit:true}]});events=act(relight,{interact:true});
 assert.equal(relight.score,65);assert.equal(relight.lanterns[0].relit_count,1);assert.equal(events.find(e=>e.name==='lantern_lit').data.relight,true);
 const cap=quiet({player:{successful_lights:8,carried:20}});assert.equal(snapshot(cap).player.capacity,20);
});

test('drain removes five extra fuel per second, reports every 60 ticks and pulse scores 15 total',()=>{
 const g=quiet({player:{pos:[20,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20}],shades:[{id:'S1',pos:[1,.8,0],state:'drain',target_lantern_id:'L1'}]});
 const events=run(g,60);assert.equal(snapshot(g).lanterns[0].fuel,14);assert.deepEqual(events.find(e=>e.name==='fuel_drain').data,{lantern_id:'L1',shade_id:'S1',fuel:14});
 const pulse=quiet({player:{carried:3},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20}],shades:[{id:'S1',pos:[1,.8,0],state:'drain',target_lantern_id:'L1'}]});act(pulse,{pulse:true});assert.equal(pulse.score,15);assert.equal(pulse.shades[0].state,'stunned');
});

test('weak lantern loses safe zone; refuel above threshold ejects nearby shades',()=>{
 const weak=quiet({player:{pos:[10,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:29}],shades:[{id:'S1',pos:[1,.8,0],state:'wander'}]});act(weak);assert.ok(Math.hypot(weak.shades[0].pos[0],weak.shades[0].pos[2])<2);
 const restored=quiet({player:{carried:2},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20}],shades:[{id:'S1',pos:[3,.8,0],state:'drain',target_lantern_id:'L1'}]});act(restored,{interact:true});run(restored,29);assert.ok(Math.hypot(restored.shades[0].pos[0],restored.shades[0].pos[2])>=6-1e-7);assert.notEqual(restored.shades[0].state,'drain');
});

test('dawn threshold replaces early win and awards only fuel, lit-lantern and flame bonuses',()=>{
 const three=worldFor(1).lamps.slice(0,3).map((_,i)=>({id:`L${i+1}`,lit:true,fuel:100}));const early=quiet({lanterns:three});act(early);assert.equal(early.state,'playing');
 const won=quiet({time_left_s:1/60,lanterns:three});const events=act(won);assert.equal(won.state,'won');assert.equal(won.reason,'dawn_survived');assert.equal(won.score,597);assert.equal(events.find(e=>e.name==='game_over').data.reason,'dawn_survived');
 const two=quiet({time_left_s:1/60,lanterns:three.slice(0,2)});act(two);assert.equal(two.state,'lost');assert.equal(two.reason,'dawn');
 const dead=quiet({time_left_s:1/60,player:{flames:0},lanterns:three});act(dead);assert.equal(dead.reason,'no_flames');
});

test('v1.2 scenario and snapshot fields validate malformed data',()=>{
 const g=quiet({player:{successful_lights:2,carried:14},lanterns:[{id:'L1',lit:true}],shades:[{id:'S1',pos:[5,.8,0],state:'drain',target_lantern_id:'L1'}]});const state=snapshot(g);
 assert.equal(state.player.capacity,14);for(const key of ['fuel','ever_lit','relit_count'])assert.ok(key in state.lanterns[0]);assert.equal(state.shades[0].target_lantern_id,'L1');
 assert.throws(()=>validateScenario({lanterns:[{id:'L1',fuel:101}]}),TypeError);assert.throws(()=>validateScenario({player:{successful_lights:1,carried:13}}),TypeError);assert.throws(()=>validateScenario({shades:[{pos:[0,0,0],state:'drain',target_lantern_id:'L9'}]}),TypeError);
});
