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
  close(forward.player.pos[2], TUNING.player_speed); close(forward.time_left_s, 299);
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
test('pickup includes XZ boundary regardless of visual height and respects capacity', () => {
  const game = quiet({ motes: Array.from({ length: 12 }, () => [TUNING.pickup_radius, 8, 0]) });
  const events = act(game);
  assert.equal(game.player.carried, TUNING.carry_capacity); assert.equal(game.motes.length, 2);
  assert.equal(events.filter((event) => event.name === 'mote_picked').length, 10);
  assert.equal(game.score, 10 * TUNING.score.per_mote);
  const outside = quiet({ motes: [[TUNING.pickup_radius + 0.01, 0, 0]] }); act(outside); assert.equal(outside.player.carried, 0);
});
test('deposit is partial, nearest, within radius and requires a new press', () => {
  const game = quiet({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [TUNING.interact_radius, 0, 0] }] });
  const events = act(game, { interact: true });
  assert.deepEqual(events[0], { type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 4, deposited: 4 } });
  game.player.carried = 6;
  assert.equal(act(game, { interact: true }).length, 0);
  act(game); const finish = act(game, { interact: true });
  assert.equal(game.lanterns[0].lit, true); assert.equal(game.lanterns[0].deposited, 10);
  assert.ok(finish.some((event) => event.name === 'lantern_lit'));
  const outside = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [2.51, 0, 0] }] });
  act(outside, { interact: true }); assert.equal(outside.player.carried, 10);
});
test('pulse uses the same boundary convention, charges once, stuns and pushes', () => {
  const game = quiet({ player: { carried: 6 }, shades: [{ id: 'Ink', pos: [TUNING.pulse_radius, 0, 0] }] });
  const events = act(game, { pulse: true });
  assert.deepEqual(events.find((event) => event.name === 'pulse').data.stunned_ids, ['Ink']);
  assert.equal(game.player.carried, 3); close(game.shades[0].pos[0], 9);
  assert.equal(game.shades[0].state, 'stunned');
  advance(game, 60, { pulse: true }); assert.equal(game.player.carried, 3);
  advance(game, 60); assert.equal(game.shades[0].state, 'chase');
});
test('insufficient pulse resource and cooldown prevent repeated spending', () => {
  const poor = quiet({ player: { carried: 2 } });
  assert.equal(act(poor, { pulse: true }).length, 0); assert.equal(poor.player.carried, 2);
  const game = quiet({ player: { carried: 10 } });
  act(game, { pulse: true }); act(game); act(game, { pulse: true });
  assert.equal(game.player.carried, 7);
});
test('shade follows player; contact damages once per invulnerability interval', () => {
  const chase = quiet({ shades: [{ pos: [10, 0, 0] }] }); advance(chase, 60); close(chase.shades[0].pos[0], 8);
  const game = quiet({ shades: [{ pos: [0, 0, 0] }] });
  assert.equal(act(game)[0].name, 'player_hit'); assert.equal(game.player.flames, 2);
  advance(game, 89); assert.equal(game.player.flames, 2);
  act(game); assert.equal(game.player.flames, 1);
});
test('lit lantern excludes shades from safe radius and protects player', () => {
  const game = quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [0, 0, 0] }] });
  advance(game, 120);
  assert.ok(Math.hypot(game.shades[0].pos[0], game.shades[0].pos[2]) > TUNING.safe_radius);
  assert.equal(game.player.flames, 3);
});
test('lose on no flames or dawn; terminal game cannot advance', () => {
  const hurt = quiet({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] });
  assert.ok(act(hurt).some((event) => event.name === 'game_over' && event.data.reason === 'no_flames'));
  const tick = hurt.tick; assert.deepEqual(act(hurt), []); assert.equal(hurt.tick, tick);
  const dawn = quiet({ time_left_s: 1 / 60 });
  act(dawn); assert.equal(dawn.state, 'lost'); assert.equal(dawn.reason, 'dawn');
});
test('map boundary has no fall penalty when fall_enabled=false', () => {
  const game = quiet(); const events = advance(game, 600, { move: [1, 0] });
  close(game.player.pos[0], 32); assert.equal(game.player.flames, 3);
  assert.equal(events.some((event) => event.name === 'player_hit'), false);
});
test('scenario IDs do not collide with generated shade IDs; random spawning can be disabled', () => {
  const game = quiet({ shades: [{ id: 'S1', pos: [30, 0, 0] }, { pos: [0, 0, 30] }] });
  assert.equal(new Set(game.shades.map((shade) => shade.id)).size, 2);
  assert.equal(advance(quiet(), 720).some((event) => event.name === 'shade_spawned'), false);
  const spawning = quiet({ random_shades: true, shades: [] });
  assert.ok(advance(spawning, 720).some((event) => event.name === 'shade_spawned'));
});
test('invalid scenario and input data reject malformed types and tick sequences', () => {
  for (const scenario of [null, [], { motes: [null] }, { random_shades: 0 }, { player: { carried: 11 } }, { lanterns: [{ id: 'L6' }] }, { shades: [{ id: 'S1', pos: [0, 0, 0] }, { id: 'S1', pos: [1, 0, 0] }] }]) assert.throws(() => validateScenario(scenario), TypeError);
  for (const inputs of [{}, { frames: [{ tick: 0 }, { tick: 0 }] }, { frames: [{ tick: -1 }] }, { frames: [{ tick: 0, move: [2, 0] }] }, { frames: [{ tick: 0, pulse: 1 }] }]) assert.throws(() => validateInputs(inputs), TypeError);
});

test('default seeded island can be won through normal movement, collection, deposits and pulse', () => {
  const game = createSimulation({ seed: 1 });
  const totals = { mote_picked: 0, lantern_lit: 0, pulse: 0 };
  for (let tick = 0; tick < 18000 && game.state === 'playing'; tick++) {
    const player = game.player;
    const distance = (entity) => Math.hypot(entity.pos[0] - player.pos[0], entity.pos[2] - player.pos[2]);
    const nearest = (entities) => [...entities].sort((a, b) => distance(a) - distance(b))[0];
    const lantern = nearest(game.lanterns.filter((entity) => !entity.lit));
    const target = player.carried >= TUNING.lantern_cost ? lantern : nearest(game.motes);
    const input = defaultInput();
    if (target) {
      const dx = target.pos[0] - player.pos[0], dz = target.pos[2] - player.pos[2];
      const length = Math.hypot(dx, dz);
      input.move = length > 0.1 ? [dx / Math.max(1, length), dz / Math.max(1, length)] : [0, 0];
    }
    input.interact = Boolean(lantern && distance(lantern) <= TUNING.interact_radius && player.carried > 0);
    input.pulse = game.shades.some((shade) => shade.state !== 'stunned' && distance(shade) < 3.5) && player.carried >= TUNING.pulse_cost && game.tick >= player.pulseReadyAt;
    for (const event of stepSimulation(game, input)) if (event.name in totals) totals[event.name]++;
  }
  assert.equal(game.state, 'won'); assert.equal(totals.lantern_lit, 5);
  assert.ok(totals.mote_picked >= 50); assert.ok(totals.pulse > 0);
  assert.equal(game.player.flames, TUNING.flames);
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
    const win = records(); assert.equal(win.at(-1).state, 'won'); assert.equal(win.at(-1).ticks, 9);
    assert.equal(win.filter((record) => record.name === 'lantern_lit').length, 5);
    assert.equal(win.filter((record) => record.name === 'mote_picked').length, 50);
    assert.equal(win.at(-1).score, 1449);
    for (const extra of [['--ticks', '-1'], ['--snapshot-every', '0'], ['--night', '2']]) {
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
