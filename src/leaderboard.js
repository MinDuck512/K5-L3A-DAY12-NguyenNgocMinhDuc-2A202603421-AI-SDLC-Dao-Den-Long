const STORAGE_KEY = 'dao-den-long-leaderboard';

export function isValidName(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  // 3-12 ký tự [A-Za-z0-9_] hoặc chữ cái tiếng Việt có dấu
  return trimmed.length >= 3 && trimmed.length <= 12 && /^[\w\p{L}]+$/u.test(trimmed);
}

export function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const timeA = new Date(a.achieved_at).getTime();
    const timeB = new Date(b.achieved_at).getTime();
    return timeA - timeB;
  }).slice(0, 10);
}

export function addEntry(entries, newEntry) {
  if (!isValidName(newEntry.name)) {
    throw new TypeError('Tên phải từ 3 đến 12 ký tự chữ hoặc số.');
  }
  const entry = {
    name: newEntry.name.trim(),
    score: Number(newEntry.score) || 0,
    nights_won: Math.max(0, Math.min(3, Number(newEntry.nights_won) || 0)),
    achieved_at: newEntry.achieved_at || new Date().toISOString(),
    seed: Number(newEntry.seed) || 1,
  };
  return sortLeaderboard([...entries, entry]);
}

export function loadLocalLeaderboard() {
  if (typeof localStorage !== 'undefined') {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(data)) return sortLeaderboard(data);
    } catch {}
  }
  return [];
}

export function saveLocalLeaderboard(entries) {
  const sorted = sortLeaderboard(entries);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch {}
  }
  return sorted;
}
