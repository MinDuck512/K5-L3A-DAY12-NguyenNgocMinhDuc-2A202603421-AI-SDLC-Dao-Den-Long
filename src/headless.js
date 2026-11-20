import { parseArgs } from 'node:util';
import { readFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { createSimulation, stepSimulation, snapshot, defaultInput, validateInputs } from './simulation.js';

function integer(text, name, minimum = 0) {
  if (text === undefined || !/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < minimum) {
    throw new TypeError(`${name} phải là số nguyên >= ${minimum}.`);
  }
  return Number(text);
}
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) {
    if (error instanceof SyntaxError) throw new TypeError(`${path}: JSON sai định dạng.`);
    throw error;
  }
}
let output;
try {
  // parseArgs coi giá trị bắt đầu bằng '-' là option; seed âm vẫn là int hợp lệ.
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length - 1; index++) {
    if (['--seed', '--night', '--ticks', '--snapshot-every'].includes(args[index]) && /^-\d+$/.test(args[index + 1])) {
      args.splice(index, 2, `${args[index]}=${args[index + 1]}`);
    }
  }
  const { values } = parseArgs({
    args,
    options: {
      seed: { type: 'string' }, night: { type: 'string' }, scenario: { type: 'string' },
      inputs: { type: 'string' }, ticks: { type: 'string' }, out: { type: 'string' },
      'snapshot-every': { type: 'string', default: '10' }, help: { type: 'boolean' },
    }, strict: true, allowPositionals: false,
  });
  if (values.help) {
    console.log('node src/headless.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]');
  } else {
    const seed = integer(values.seed, '--seed', Number.MIN_SAFE_INTEGER);
    const night = integer(values.night, '--night', 1);
    if (night !== 1) throw new TypeError('Phase 1 chỉ hỗ trợ --night 1.');
    const ticks = integer(values.ticks, '--ticks');
    const interval = integer(values['snapshot-every'], '--snapshot-every', 1);
    if (!values.out) throw new TypeError('Thiếu --out <file.jsonl>.');
    const inputs = values.inputs ? readJson(values.inputs) : { frames: [] };
    validateInputs(inputs);
    const game = createSimulation({ seed, scenario: values.scenario ? readJson(values.scenario) : {} });
    output = openSync(values.out, 'w');
    const emit = (record) => writeSync(output, `${JSON.stringify(record)}\n`);
    emit(snapshot(game));
    const input = defaultInput();
    let frameIndex = 0;
    while (game.tick < ticks && game.state === 'playing') {
      if (inputs.frames[frameIndex]?.tick === game.tick) {
        const { tick: ignoredTick, ...changes } = inputs.frames[frameIndex++];
        Object.assign(input, changes);
      }
      for (const event of stepSimulation(game, input)) emit(event);
      if (game.tick % interval === 0) emit(snapshot(game));
    }
    emit({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof TypeError || error.code?.startsWith('ERR_PARSE_ARGS') ? 2 : 1;
} finally {
  if (output !== undefined) closeSync(output);
}
