import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import contract from '../game.contract.json' with { type: 'json' };
import { sortLeaderboard, addEntry, isValidName } from '../src/leaderboard.js';

test('contract 1.3 defines bench_cmd, soak_cmd and valid commands', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.equal(contract.bench_cmd, 'node src/bench.js');
  assert.equal(contract.soak_cmd, 'node src/soak.js');
  assert.equal(contract.run_cmd, 'node src/run.js');
  assert.equal(contract.headless_cmd, 'node src/headless.js');
});

test('leaderboard validates names: 3-12 alphanumeric characters', () => {
  assert.equal(isValidName('May'), true);
  assert.equal(isValidName('Ong_Dang'), true);
  assert.equal(isValidName('NguyenVanA12'), true);
  assert.equal(isValidName('An'), false); // quá ngắn (<3)
  assert.equal(isValidName('NguyenNgocMinhDuc2026'), false); // quá dài (>12)
  assert.equal(isValidName('May@123'), false); // ký tự đặc biệt
  assert.throws(() => addEntry([], { name: 'A', score: 100 }), TypeError);
});

test('leaderboard sorts by score desc, breaks ties by achieved_at, limits to 10', () => {
  const entries = [
    { name: 'PlayerB', score: 500, nights_won: 1, achieved_at: '2026-11-20T10:00:00.000Z', seed: 1 },
    { name: 'PlayerA', score: 1000, nights_won: 2, achieved_at: '2026-11-20T10:00:00.000Z', seed: 1 },
    { name: 'PlayerC', score: 500, nights_won: 1, achieved_at: '2026-11-20T09:00:00.000Z', seed: 2 },
  ];
  const sorted = sortLeaderboard(entries);
  assert.equal(sorted[0].name, 'PlayerA');
  // PlayerC đạt điểm 500 lúc 9h, PlayerB lúc 10h -> PlayerC đứng trước
  assert.equal(sorted[1].name, 'PlayerC');
  assert.equal(sorted[2].name, 'PlayerB');

  // Thêm 15 mục để kiểm tra giới hạn top 10
  let list = [];
  for (let i = 1; i <= 15; i++) {
    list = addEntry(list, { name: `Player_${i}`, score: i * 100, achieved_at: `2026-11-20T12:${String(i).padStart(2, '0')}:00.000Z` });
  }
  assert.equal(list.length, 10);
  assert.equal(list[0].score, 1500);
  assert.equal(list[9].score, 600);
});

test('CLI export-leaderboard exports top entries correctly', () => {
  const tempOut = 'temp-test-leaderboard.json';
  if (existsSync(tempOut)) unlinkSync(tempOut);
  execSync(`node src/run.js --export-leaderboard ${tempOut}`);
  assert.ok(existsSync(tempOut));
  const data = JSON.parse(readFileSync(tempOut, 'utf8'));
  assert.ok(Array.isArray(data.entries));
  assert.ok(data.entries.length > 0);
  assert.ok('name' in data.entries[0]);
  assert.ok('score' in data.entries[0]);
  unlinkSync(tempOut);
});

test('soak runner runs headless without memory leaks', () => {
  const tempSoak = 'temp-test-soak.json';
  if (existsSync(tempSoak)) unlinkSync(tempSoak);
  execSync(`node src/soak.js --seed 42 --nights 3 --out ${tempSoak}`);
  assert.ok(existsSync(tempSoak));
  const data = JSON.parse(readFileSync(tempSoak, 'utf8'));
  assert.equal(data.nights, 3);
  assert.equal(data.crashes, 0);
  assert.ok(Array.isArray(data.results));
  assert.ok(data.mem_end_mb <= 1.5 * data.mem_start_mb);
  unlinkSync(tempSoak);
});
