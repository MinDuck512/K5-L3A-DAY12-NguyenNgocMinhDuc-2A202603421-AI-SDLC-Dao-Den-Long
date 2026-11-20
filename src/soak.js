import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { createSimulation, stepSimulation, defaultInput } from './simulation.js';

function integer(text, name, minimum = 0) {
  if (text === undefined || !/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < minimum) {
    throw new TypeError(`${name} phải là số nguyên >= ${minimum}.`);
  }
  return Number(text);
}

function makePrng(seed) {
  let rng = seed >>> 0;
  return function () {
    rng = (rng + 0x6d2b79f5) >>> 0;
    let t = rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

try {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length - 1; index++) {
    if (['--seed', '--nights'].includes(args[index]) && /^-\d+$/.test(args[index + 1])) {
      args.splice(index, 2, `${args[index]}=${args[index + 1]}`);
    }
  }

  const { values } = parseArgs({
    args,
    options: {
      seed: { type: 'string', default: '7' },
      nights: { type: 'string', default: '10' },
      out: { type: 'string', default: 'soak.json' },
    },
    strict: true,
  });

  const baseSeed = integer(values.seed, '--seed', Number.MIN_SAFE_INTEGER);
  const totalNights = integer(values.nights, '--nights', 1);
  const outPath = values.out;

  const startTime = Date.now();
  let crashes = 0;
  const results = [];
  let memStartMb = null;

  for (let i = 0; i < totalNights; i++) {
    try {
      const night = (i % 3) + 1;
      const currentSeed = baseSeed + i;
      let game = createSimulation({ seed: currentSeed, night });

      if (i === 0) {
        memStartMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
      }

      const rand = makePrng(currentSeed ^ 0x9e3779b9);
      const maxTicks = Math.round(game.initialTime * 60);
      let currentMove = [0, 0];

      while (game.tick < maxTicks && !['won', 'lost'].includes(game.state)) {
        if (game.tick % 30 === 0) {
          const angle = rand() * Math.PI * 2;
          currentMove = [Number(Math.cos(angle).toFixed(3)), Number(Math.sin(angle).toFixed(3))];
        }

        const input = defaultInput();
        input.move = currentMove;
        input.jump = rand() < 0.05;
        input.dash = rand() < 0.03;
        input.pulse = rand() < 0.02;
        input.interact = rand() < 0.10;

        stepSimulation(game, input);
      }

      results.push(game.state);
      // Giúp dọn bộ nhớ sạch giữa các Đêm
      game = null;
    } catch (err) {
      console.error(`Lỗi tại Đêm ${i + 1}:`, err);
      crashes++;
      results.push('crash');
    }
  }

  const memEndMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  const durationS = Number(((Date.now() - startTime) / 1000).toFixed(1));

  const output = {
    nights: totalNights,
    crashes,
    results,
    mem_start_mb: memStartMb ?? memEndMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Soak test hoàn tất trong ${durationS} s. Kết quả lưu tại ${outPath}`);
  console.log(`Crashes: ${crashes}, RAM: ${memStartMb} MB -> ${memEndMb} MB`);
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof TypeError || error.code?.startsWith('ERR_PARSE_ARGS') ? 2 : 1;
}
