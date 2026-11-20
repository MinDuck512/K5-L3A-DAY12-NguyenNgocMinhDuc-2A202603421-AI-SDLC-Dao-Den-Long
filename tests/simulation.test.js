import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSimulation, stepSimulation, snapshot, defaultInput, TUNING, validateInputs, validateScenario } from '../src/simulation.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const quiet = (scenario = {}) => createSimulation({ scenario: { random_motes: false, random_shades: false, ...scenario } });
const act = (game, changes = {}) => stepSimulation(game, { ...defaultInput(), ...changes });
const advance = (game, ticks, changes = {}) => { const events = []; for (let i = 0; i < ticks; i++) events.push(...act(game, changes)); return events; };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('tick 0 preserves scenario without events or score; lantern overrides merge by id', () => {
  const game = quiet({ player: { pos: [1, 2, 3], carried: 4 }, lanterns: [{ id: 'L2', lit: true }] });
  const state = snapshot(game);
  assert.equal(state.tick, 0); assert.equal(state.sim_tick, 0); assert.equal(state.score, 0);
  assert.deepEqual(state.player.pos, [1, 2, 3]); assert.equal(state.lanterns.length, 5);
  assert.equal(state.lanterns[1].lit, true); assert.equal(state.lanterns[0].lit, false);
});
test('fixed 60 Hz movement, normalized diagonal and camera yaw', () => {
  const forward = quiet(); advance(forward, 60, { move: [0, 1] });
  close(forward.player.pos[2], TUNING.player_speed); close(forward.time_left_s, 239);
  const diagonal = quiet(); advance(diagonal, 60, { move: [1, 1] });
  close(Math.hypot(diagonal.player.pos[0], diagonal.player.pos[2]), TUNING.player_speed);
  const yaw = quiet(); advance(yaw, 60, { move: [0, 1], cam_yaw_deg: 90 });
  close(yaw.player.pos[0], TUNING.player_speed); close(yaw.player.pos[2], 0);
});
test('jump lands and holding jump does not automatically jump again', () => {
  const game = quiet(); act(game, { jump: true }); assert.ok(game.player.pos[1] > 0);
  advance(game, 100, { jump: true }); assert.equal(game.player.pos[1], 0);
  act(game); act(game, { jump: true }); assert.ok(game.player.pos[1] > 0);
});
test('pickup respects XZ boundary, height, capacity and awards no pickup score', () => {
  const game = quiet({ motes: Array.from({ length: 12 }, () => [TUNING.pickup_radius, 1.5, 0]) });
  const events = act(game);
  assert.equal(game.player.carried, TUNING.carry_capacity); assert.equal(game.motes.length, 2);
  assert.equal(events.filter((event) => event.name === 'mote_picked').length, 10);
  assert.equal(game.score, 0);
  const high = quiet({ motes: [[0, 1.51, 0]] }); act(high); assert.equal(high.player.carried, 0);
  const outside = quiet({ motes: [[TUNING.pickup_radius + 0.01, 0, 0]] }); act(outside); assert.equal(outside.player.carried, 0);
});
test('deposit is partial, nearest, within radius and requires a new press', () => {
  const game = quiet({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [TUNING.interact_radius, 0, 0] }] });
  const events = act(game, { interact: true });
  assert.deepEqual(events.find(e=>e.name==='deposit'), { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 4, deposited: 4 } });
  game.player.carried = 6;
  assert.equal(act(game, { interact: true }).length, 0);
  act(game); const finish = act(game, { interact: true });
  assert.equal(game.lanterns[0].lit, true); assert.equal(game.lanterns[0].deposited, 10);
  assert.ok(finish.some((event) => event.name === 'lantern_lit'));
  const outside = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [2.51, 0, 0] }] });
  act(outside, { interact: true }); assert.equal(outside.player.carried, 10);
});
test('pulse uses 3D boundary, stuns 120 ticks and pushes over 15 ticks', () => {
  const game = quiet({ player: { carried: 6 }, shades: [{ id: 'Ink', pos: [TUNING.pulse_radius, 0.8, 0] }] });
  const events = act(game, { pulse: true });
  assert.deepEqual(events.find((event) => event.name === 'pulse').data.stunned_ids, ['Ink']);
  assert.equal(game.player.carried, 3); close(game.shades[0].pos[0], 5 + 4/15);
  advance(game,14,{pulse:true}); close(game.shades[0].pos[0],9);
  assert.equal(game.shades[0].state, 'stunned');
  advance(game, 46, { pulse: true }); assert.equal(game.player.carried, 3);
  advance(game, 60); assert.equal(game.shades[0].state, 'chase');
});
test('insufficient pulse resource and cooldown prevent repeated spending', () => {
  const poor = quiet({ player: { carried: 2 } });
  assert.equal(act(poor, { pulse: true }).some(e=>e.name==='pulse'), false); assert.equal(poor.player.carried, 2);
  const game = quiet({ player: { carried: 10 } });
  act(game, { pulse: true }); act(game); act(game, { pulse: true });
  assert.equal(game.player.carried, 7);
});
test('shade follows player; contact damages once per invulnerability interval', () => {
  const chase = quiet({ shades: [{ pos: [10, 0, 0] }] }); advance(chase, 60); close(chase.shades[0].pos[0], 6);
  const game = quiet({ shades: [{ pos: [0, 0, 0] }] });
  assert.ok(act(game).some(e=>e.name==='player_hit')); assert.equal(game.player.flames, 2);
  advance(game, 89); assert.equal(game.player.flames, 2);
  act(game); assert.equal(game.player.flames, 1);
});
test('lit lantern excludes shades from safe radius and protects player', () => {
  const game = quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [0, 0, 0] }] });
  advance(game, 120);
  assert.ok(Math.hypot(game.shades[0].pos[0], game.shades[0].pos[2]) >= TUNING.safe_radius - 1e-8);
  assert.equal(game.player.flames, 3);
});
test('lose on no flames or dawn; terminal game cannot advance', () => {
  const hurt = quiet({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] });
  assert.ok(act(hurt).some((event) => event.name === 'game_over' && event.data.reason === 'no_flames'));
  const tick = hurt.tick; assert.deepEqual(act(hurt), []); assert.equal(hurt.tick, tick);
  const dawn = quiet({ time_left_s: 1 / 60 });
  act(dawn); assert.equal(dawn.state, 'lost'); assert.equal(dawn.reason, 'dawn');
});
test('fall bypasses invulnerability and waits exactly 60 ticks before respawn', () => {
  const game = quiet({player:{pos:[41,-9.99,0],carried:7,invuln_ticks:90}});
  let events=[]; while(!events.some(e=>e.name==='player_hit')) events=act(game);
  const hit=events.find(e=>e.name==='player_hit'); assert.equal(hit.data.by,'fall'); assert.equal(hit.data.lost,7);
  assert.equal(game.player.flames,2); assert.equal(game.player.carried,0);
  advance(game,59); assert.ok(game.player.pos[1]<-10);
  act(game); assert.deepEqual(game.player.pos,[0,0,0]); assert.equal(game.player.invuln,90);
});
test('scenario IDs do not collide with generated shade IDs; random spawning can be disabled', () => {
  const game = quiet({ shades: [{ id: 'S1', pos: [30, 0, 0] }, { pos: [0, 0, 30] }] });
  assert.equal(new Set(game.shades.map((shade) => shade.id)).size, 2);
  assert.equal(advance(quiet(), 720).some((event) => event.name === 'shade_spawned'), false);
  const spawning = quiet({ random_shades: true, shades: [] });
  assert.ok(advance(spawning, 300).some((event) => event.name === 'shade_spawned'));
});
test('invalid scenario and input data reject malformed types and tick sequences', () => {
  for (const scenario of [null, [], { motes: [null] }, { random_shades: 0 }, { player: { carried: 11 } }, { lanterns: [{ id: 'L6' }] }, { shades: [{ id: 'S1', pos: [0, 0, 0] }, { id: 'S1', pos: [1, 0, 0] }] }]) assert.throws(() => validateScenario(scenario), TypeError);
  for (const inputs of [{}, { frames: [{ tick: 0 }, { tick: 0 }] }, { frames: [{ tick: -1 }] }, { frames: [{ tick: 0, move: [2, 0] }] }, { frames: [{ tick: 0, pulse: 1 }] }]) assert.throws(() => validateInputs(inputs), TypeError);
});

test('standard seeded island starts with 20 distinct motes, 5 exact lamps, no shades', () => {
  const game=createSimulation({seed:1}); assert.equal(game.motes.length,20); assert.equal(game.shades.length,0);
  assert.equal(new Set(game.motes.map(m=>m.pos.join(','))).size,20);
  assert.deepEqual(game.lanterns[0].pos,[0,0,25]);
  const copy=createSimulation({seed:1});assert.deepEqual(snapshot(game),snapshot(copy));
});

test('headless CLI: JSONL, tick semantics, persisted inputs, deterministic output, win and errors', () => {
  const folder = mkdtempSync(join(tmpdir(), 'dao-den-long-test-'));
  const output = join(folder, 'out.jsonl');
  const scenarioPath = join(folder, 'scenario.json');
  const inputsPath = join(folder, 'inputs.json');
  const run = (extra = []) => spawnSync(process.execPath, ['src/headless.js', '--seed', '7', '--night', '1', '--ticks', '60', '--out', output, ...extra], { cwd: root, encoding: 'utf8' });
  const records = () => readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse);
  try {
    writeFileSync(scenarioPath, JSON.stringify({ random_motes: false, random_shades: false }));
    writeFileSync(inputsPath, JSON.stringify({ frames: [{ tick: 0, move: [0, 1] }, { tick: 30, jump: true }] }));
    assert.equal(run(['--scenario', scenarioPath, '--inputs', inputsPath]).status, 0);
    const result = records(); assert.equal(result[0].tick, 0); assert.deepEqual(result[0].player.pos, [0, 0, 0]);
    assert.equal(result.at(-1).type, 'end'); assert.equal(result.at(-1).ticks, 60);
    assert.equal(result.at(-2).player.pos[2], 6); assert.equal(result.at(-2).sim_tick, 60);
    const first = readFileSync(output, 'utf8');
    assert.equal(run(['--scenario', scenarioPath, '--inputs', inputsPath]).status, 0); assert.equal(readFileSync(output, 'utf8'), first);
    assert.equal(run().status, 0); const randomFirst = readFileSync(output, 'utf8');
    assert.equal(run().status, 0); assert.equal(readFileSync(output, 'utf8'), randomFirst);
    assert.equal(run(['--ticks', '0']).status, 0); assert.equal(records().length, 2);
    assert.equal(run(['--seed', '-7', '--ticks', '0']).status, 0);
    assert.equal(run(['--scenario', 'tests/scenarios/win.json', '--inputs', 'tests/scenarios/win.inputs.json', '--snapshot-every', '1']).status, 0);
    const win = records(); assert.equal(win.at(-1).state, 'won'); assert.equal(win.at(-1).ticks, 1);
    assert.equal(win.find((record) => record.name === 'game_over').data.reason, 'dawn_survived');
    assert.equal(win.at(-1).score, 597);
    for (const extra of [['--ticks', '-1'], ['--snapshot-every', '0'], ['--night', '4']]) {
      const result = run(extra); assert.equal(result.status, 2); assert.ok(result.stderr); assert.equal(result.stdout, '');
    }
    writeFileSync(inputsPath, '{bad JSON'); assert.equal(run(['--inputs', inputsPath]).status, 2);
    writeFileSync(inputsPath, JSON.stringify({ frames: [{ tick: 1 }, { tick: 0 }] })); assert.equal(run(['--inputs', inputsPath]).status, 2);
    writeFileSync(scenarioPath, JSON.stringify({ player: { pos: [0, 0] } })); assert.equal(run(['--scenario', scenarioPath]).status, 2);
  } finally {
    for (const name of readdirSync(folder)) unlinkSync(join(folder, name));
    rmdirSync(folder);
  }
});
