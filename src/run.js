import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { sortLeaderboard } from './leaderboard.js';

const args = process.argv.slice(2);
const exportIndex = args.indexOf('--export-leaderboard');

if (exportIndex !== -1) {
  const targetPath = args[exportIndex + 1];
  if (!targetPath) {
    console.error('Thiếu đường dẫn file sau --export-leaderboard');
    process.exit(2);
  }
  try {
    const dataFile = resolve(process.cwd(), 'data/leaderboard.json');
    let entries = [];
    if (existsSync(dataFile)) {
      const parsed = JSON.parse(readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, ''));
      const list = Array.isArray(parsed) ? parsed : parsed.entries;
      if (Array.isArray(list)) entries = sortLeaderboard(list);
    }
    writeFileSync(targetPath, `${JSON.stringify({ entries }, null, 2)}\n`, 'utf8');
    console.log(`Đã xuất bảng xếp hạng ra ${targetPath} (${entries.length} mục)`);
    process.exit(0);
  } catch (err) {
    console.error('Lỗi xuất bảng xếp hạng:', err.message);
    process.exit(1);
  }
} else {
  // Chạy dev server thông thường
  const child = spawn('npx', ['vite', '--host', '127.0.0.1', ...args], {
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
