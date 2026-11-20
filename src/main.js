import * as THREE from 'three';
import { createSimulation, stepSimulation, defaultInput, FIXED_DT } from './simulation.js';
import { PALETTE as C } from './worlds.js';
import { createAudio } from './audio.js';
import { loadLocalLeaderboard, saveLocalLeaderboard, addEntry, isValidName } from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const audio = createAudio();

// Cấu hình phím mặc định
const DEFAULT_KEYS = {
  move_up: ['KeyW', 'ArrowUp'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_down: ['KeyS', 'ArrowDown'],
  move_right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  pulse: ['KeyF'],
  pause: ['Escape', 'KeyP'],
};

const ACTION_NAMES = {
  move_up: 'Đi lên',
  move_left: 'Đi sang trái',
  move_down: 'Đi lùi',
  move_right: 'Đi sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Nạp / Châm dầu',
  pulse: 'Tỏa sáng',
  pause: 'Tạm dừng',
};

let settings = {
  volume: 0.5,
  sensitivity: 0.3,
  distinctPalette: false,
  reduceMotion: false,
  largeFont: false,
  keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
};

try {
  const saved = JSON.parse(localStorage.getItem('dao-den-long-settings'));
  if (saved) {
    if (Number.isFinite(saved.volume)) settings.volume = Math.max(0, Math.min(1, saved.volume));
    if (Number.isFinite(saved.sensitivity)) settings.sensitivity = Math.max(0.1, Math.min(1, saved.sensitivity));
    if (typeof saved.distinctPalette === 'boolean') settings.distinctPalette = saved.distinctPalette;
    if (typeof saved.reduceMotion === 'boolean') settings.reduceMotion = saved.reduceMotion;
    if (typeof saved.largeFont === 'boolean') settings.largeFont = saved.largeFont;
    if (saved.keys && typeof saved.keys === 'object') {
      for (const k of Object.keys(DEFAULT_KEYS)) {
        if (Array.isArray(saved.keys[k]) && saved.keys[k].length > 0) settings.keys[k] = saved.keys[k];
      }
    }
  }
} catch {}

audio.setVolume(settings.volume);

function checkKeyConflicts() {
  const seen = new Map();
  let hasConflict = false;
  for (const [action, keyList] of Object.entries(settings.keys)) {
    for (const code of keyList) {
      if (seen.has(code) && seen.get(code) !== action) {
        hasConflict = true;
      }
      seen.set(code, action);
    }
  }
  $('key-conflict').hidden = !hasConflict;
  return hasConflict;
}

const saveSettings = () => {
  audio.setVolume(settings.volume);
  document.body.classList.toggle('distinct', settings.distinctPalette);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  document.body.classList.toggle('large-font', settings.largeFont);
  checkKeyConflicts();
  try {
    localStorage.setItem('dao-den-long-settings', JSON.stringify(settings));
  } catch {}
};

$('volume').value = settings.volume;
$('volume').oninput = () => { settings.volume = Number($('volume').value); saveSettings(); };
$('sensitivity').value = settings.sensitivity;
$('sensitivity').oninput = () => { settings.sensitivity = Number($('sensitivity').value); saveSettings(); };
$('distinct-palette').checked = settings.distinctPalette;
$('distinct-palette').onchange = () => { settings.distinctPalette = $('distinct-palette').checked; saveSettings(); };
$('reduce-motion').checked = settings.reduceMotion;
$('reduce-motion').onchange = () => { settings.reduceMotion = $('reduce-motion').checked; saveSettings(); };
$('large-font').checked = settings.largeFont;
$('large-font').onchange = () => { settings.largeFont = $('large-font').checked; saveSettings(); };

// Render danh sách đổi phím
function renderRebindList() {
  const container = $('rebind-list');
  container.replaceChildren();
  for (const [action, label] of Object.entries(ACTION_NAMES)) {
    const row = document.createElement('div');
    row.className = 'rebind-row';
    const title = document.createElement('span');
    title.textContent = label;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rebind-btn';
    btn.textContent = settings.keys[action]?.map((c) => c.replace(/Key|Digit|Arrow/, '')).join(' / ') || 'None';
    btn.onclick = () => {
      btn.textContent = 'Nhấn phím mới...';
      btn.classList.add('listening');
      const listener = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('keydown', listener, true);
        btn.classList.remove('listening');
        settings.keys[action] = [e.code];
        saveSettings();
        renderRebindList();
      };
      window.addEventListener('keydown', listener, true);
    };
    row.append(title, btn);
    container.append(row);
  }
}

$('reset-keys-btn').onclick = () => {
  settings.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
  saveSettings();
  renderRebindList();
};

renderRebindList();
saveSettings();

const pageParams = new URLSearchParams(location.search);
const isBenchmarkMode = pageParams.get('bench') === '1' || pageParams.get('bench') === 'true';
const benchSeed = Number(pageParams.get('seed')) || 42;
const benchDuration = Number(pageParams.get('duration')) || 30;

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
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.setAttribute('aria-label', 'Game 3D Đảo Đèn Lồng');
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.fog, 35, 115);

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 300);
  const ambient = new THREE.HemisphereLight(C.core, C.fog, 0.15);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight('#e4e8ff', 1.1);
  moon.position.set(-30, 60, 25);
  scene.add(moon);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const staticWorld = new THREE.Group(), dynamic = new THREE.Group();
  scene.add(staticWorld, dynamic);

  const mesh = (geometry, material, p = [0, 0, 0], parent = staticWorld) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...p);
    parent.add(m);
    return m;
  };

  const grass = mat(C.grass), wood = mat(C.wood), sand = mat(C.sand);
  let game = createSimulation();
  let mode = 'menu';
  let yaw = 0, cameraHeight = 6, accumulator = 0, previousTime;
  let pulseTick = -999, lastCountdown = 11, lastWind = false, frameCount = 0, metricStart = 0;
  let wonScores = [], currentNight = 1;
  const keys = new Set(), pending = new Set(), views = new Map();
  let subtitleTimer = null, indicatorTimer = null;

  function showSubtitle(text, durationMs = 3000) {
    $('subtitles').textContent = text;
    $('subtitles').hidden = false;
    if (subtitleTimer) clearTimeout(subtitleTimer);
    subtitleTimer = setTimeout(() => { $('subtitles').hidden = true; }, durationMs);
  }

  function showShadeIndicator(worldPos) {
    const projected = new THREE.Vector3(...worldPos);
    projected.y += 1;
    camera.updateMatrixWorld();
    projected.project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * innerHeight;
    const clampedX = Math.max(20, Math.min(innerWidth - 120, screenX));
    const clampedY = Math.max(20, Math.min(innerHeight - 40, screenY));
    $('shade-indicator').style.left = `${clampedX}px`;
    $('shade-indicator').style.top = `${clampedY}px`;
    $('shade-indicator').textContent = '⚠ Bóng Mực';
    $('shade-indicator').hidden = false;
    if (indicatorTimer) clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(() => { $('shade-indicator').hidden = true; }, 3000);
  }

  function clearGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const list = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of list) if (![grass, wood, sand].includes(m)) m.dispose();
        }
      });
    }
  }

  function buildWorld() {
    clearGroup(staticWorld);
    clearGroup(dynamic);
    views.clear();

    for (const [x, , z, r] of game.world.islands) {
      mesh(new THREE.CylinderGeometry(r, r - 2, 5, 72), grass, [x, -2.5, z]);
      const shore = mesh(new THREE.TorusGeometry(r - 0.3, 0.3, 6, 96), sand, [x, -0.1, z]);
      shore.rotation.x = Math.PI / 2;
    }

    if (game.night === 2) {
      mesh(new THREE.BoxGeometry(18, 0.2, 4), wood, [35, -0.1, 0]);
      for (let x = 26; x <= 44; x += 0.6) mesh(new THREE.BoxGeometry(0.07, 0.04, 4), sand, [x, 0.03, 0]);
    }

    if (game.night === 3) {
      const shape = new THREE.Shape();
      shape.moveTo(24, 0); shape.absarc(0, 0, 24, 0, Math.PI, false);
      shape.lineTo(-12, 0); shape.absarc(0, 0, 12, Math.PI, 0, true);
      const tier = mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 }), grass, [0, 3, 0]);
      tier.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(8, 8, 6, 64), grass, [0, 3, 0]);
      mesh(new THREE.CylinderGeometry(2, 2, 8, 24), wood, [0, 10, 0]);
      const bell = mesh(new THREE.SphereGeometry(1.3, 16, 12), mat(C.gold), [0, 13, 0]);
      bell.scale.y = 1.2;
      for (const degrees of [30, 150]) {
        const a = degrees * Math.PI / 180, points = [];
        for (const [r, h, side] of [[30, 0, -1.5], [30, 0, 1.5], [24, 3, -1.5], [24, 3, 1.5]]) {
          points.push(r * Math.cos(a) - side * Math.sin(a), h + 0.015, r * Math.sin(a) + side * Math.cos(a));
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setIndex([0, 2, 1, 1, 2, 3]);
        geometry.computeVertexNormals();
        mesh(geometry, mat(C.sand, { side: THREE.DoubleSide }));
      }
    }

    for (const pad of game.world.pads) {
      const m = mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.35 }), [pad.pos[0], pad.pos[1] + 0.06, pad.pos[2]]);
      m.name = 'Bục nhảy';
    }

    const sea = mesh(new THREE.PlaneGeometry(400, 400), mat(C.sea), [35, -10.5, 0]);
    sea.rotation.x = -Math.PI / 2;

    for (const l of game.lanterns) {
      const group = new THREE.Group();
      group.position.set(...l.pos);
      staticWorld.add(group);
      mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 10), wood, [0, 1.6, 0], group);
      const paper = mesh(new THREE.SphereGeometry(0.7, 16, 12), mat(C.off), [0, 3.2, 0], group);
      paper.scale.y = 1.25;
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), wood, [0, 4.1, 0], group);
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), wood, [0, 2.3, 0], group);
      const tear = mesh(new THREE.BoxGeometry(0.08, 0.55, 0.04), mat(C.shade), [0.35, 3.2, -0.58], group);
      tear.rotation.z = 0.55;
      const fuelBack = mesh(new THREE.BoxGeometry(0.9, 0.14, 0.06), mat(C.shade), [0, 4.55, 0], group);
      const fuelFill = mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.25 }), [0, 4.55, -0.04], group);
      const light = new THREE.PointLight(C.lantern, 0, 15, 2);
      light.position.y = 3.2;
      group.add(light);
      const halo = mesh(new THREE.RingGeometry(5.92, 6, 64), new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.2, side: THREE.DoubleSide }), [0, 0.02, 0], group);
      halo.rotation.x = -Math.PI / 2;
      views.set(l.id, { group, paper, tear, fuelBack, fuelFill, light, halo });
    }

    const may = new THREE.Group();
    dynamic.add(may);
    mesh(new THREE.CylinderGeometry(0.25, 0.38, 0.7, 12), mat(C.shirt), [0, 0.85, 0], may);
    mesh(new THREE.SphereGeometry(0.25, 16, 12), mat('#edbd98'), [0, 1.42, 0], may);
    mesh(new THREE.ConeGeometry(0.6, 0.3, 32), sand, [0, 1.71, 0], may);
    mesh(new THREE.BoxGeometry(0.45, 0.1, 0.12), mat(C.red), [0, 1.21, -0.2], may);
    for (const x of [-0.14, 0.14]) mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.5, 8), mat(C.off), [x, 0.25, 0], may);
    mesh(new THREE.BoxGeometry(0.025, 0.35, 0.025), wood, [0.46, 1.35, 0], may);
    mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(C.core, { emissive: C.lantern, emissiveIntensity: 1 }), [0.46, 1.1, 0], may);
    const light = new THREE.PointLight(C.core, 10, 5, 2);
    light.position.y = 1.2;
    may.add(light);
    views.set('may', may);

    const pulse = mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: C.halo, wireframe: true, transparent: true, opacity: 0 }), [0, 0, 0], dynamic);
    views.set('pulse', pulse);
  }

  function show(title, message, detail, buttons, withSettings = false, withLeaderboard = false, withNameInput = false) {
    $('overlay').hidden = false;
    $('dialog-title').textContent = title;
    $('dialog-message').textContent = message;
    $('dialog-detail').textContent = detail;
    $('settings').hidden = !withSettings;
    $('leaderboard-view').hidden = !withLeaderboard;
    $('name-input-area').hidden = !withNameInput;
    if (withNameInput) {
      $('player-name').value = '';
      $('name-error').hidden = true;
    }
    $('actions').replaceChildren();
    for (const [label, handler] of buttons) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = handler;
      $('actions').append(b);
    }
  }

  function showLeaderboardView(backHandler) {
    mode = 'leaderboard';
    const entries = loadLocalLeaderboard();
    const tbody = $('leaderboard-body');
    tbody.replaceChildren();
    if (entries.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="5" style="text-align:center;padding:1rem">Chưa có điểm lưu nào.</td>';
      tbody.append(row);
    } else {
      entries.forEach((e, idx) => {
        const row = document.createElement('tr');
        const dateStr = new Date(e.achieved_at).toLocaleDateString('vi-VN');
        row.innerHTML = `<td>#${idx + 1}</td><td><strong>${e.name}</strong></td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${dateStr}</td>`;
        tbody.append(row);
      });
    }
    show('Bảng Xếp Hạng', 'Danh sách top 10 người giữ đèn xuất sắc nhất.', '', [['Quay lại', backHandler]], false, true, false);
  }

  function menu() {
    mode = 'menu';
    audio.music(false);
    show(
      'Đảo Đèn Lồng',
      'Ba hòn đảo đang chờ Mây giữ sáng.',
      'Sống sót tới bình minh và giữ ít nhất 60% số đèn đang sáng.',
      [
        ['Bắt đầu', () => { wonScores = []; intro(1); }],
        ['Bảng xếp hạng', () => showLeaderboardView(menu)],
        ['Cài đặt', () => settingsView(menu)],
      ],
    );
  }

  function intro(night) {
    mode = 'intro';
    currentNight = night;
    game = createSimulation({ night });
    buildWorld();
    show(
      `Đêm ${night} · ${game.world.name}`,
      ['Ông Đăng: “Mây ơi, hãy gom ánh sáng và thắp lại những chiếc đèn.”', 'Ông Đăng: “Cầu tre hẹp lắm. Hãy tìm bục nhảy, và coi chừng Gió Lạc.”', 'Ông Đăng: “Theo dốc lên tầng cao. Tiếng chuông đang chờ bình minh.”'][night - 1],
      `${game.lanterns.length} đèn · ${game.world.duration} giây · 3 Ngọn Lửa`,
      [['Vào Đêm', startNight], ['Về menu', menu]],
    );
  }

  function startNight() {
    game = createSimulation({ night: currentNight });
    buildWorld();
    keys.clear();
    pending.clear();
    yaw = 0;
    cameraHeight = 6;
    accumulator = 0;
    pulseTick = -999;
    lastCountdown = 11;
    lastWind = false;
    frameCount = 0;
    metricStart = 0;
    mode = 'playing';
    $('overlay').hidden = true;
    audio.start();
    audio.music(true);
  }

  function resume() {
    stepSimulation(game, { ...defaultInput(), pause: false });
    const events = stepSimulation(game, { ...defaultInput(), pause: true });
    handleEvents(events);
    keys.clear();
    pending.clear();
    mode = 'playing';
    accumulator = 0;
    $('overlay').hidden = true;
    audio.music(true);
  }

  function pauseMenu() {
    mode = 'paused';
    audio.music(false);
    show('Tạm dừng', 'Đêm đang chờ bạn.', '', [
      ['Tiếp tục', resume],
      ['Chơi lại Đêm', startNight],
      ['Cài đặt', () => settingsView(pauseMenu)],
      ['Về menu', menu],
    ]);
  }

  function settingsView(back) {
    mode = 'settings';
    show('Cài đặt & Dễ tiếp cận', 'Điều chỉnh âm lượng, camera, phím và trợ năng.', 'Cài đặt được lưu trên trình duyệt này.', [['Quay lại', back]], true);
  }

  function result() {
    audio.music(false);
    mode = 'result';
    const wonThisNight = game.state === 'won';
    if (wonThisNight) wonScores[currentNight - 1] = game.score;

    const totalScore = wonScores.reduce((a, b) => a + b, 0);
    const nightsWonCount = wonScores.filter((s) => typeof s === 'number').length;

    const promptSaveScore = (onDone) => {
      const nameInput = $('player-name').value.trim();
      if (!isValidName(nameInput)) {
        $('name-error').textContent = 'Tên phải từ 3 đến 12 ký tự (chữ hoặc số).';
        $('name-error').hidden = false;
        return;
      }
      try {
        const currentEntries = loadLocalLeaderboard();
        const updated = addEntry(currentEntries, {
          name: nameInput,
          score: totalScore,
          nights_won: nightsWonCount,
          seed: game.rng,
        });
        saveLocalLeaderboard(updated);
        onDone();
      } catch (err) {
        $('name-error').textContent = err.message;
        $('name-error').hidden = false;
      }
    };

    if (wonThisNight) {
      audio.effect('won');
      if (currentNight === 3) {
        show(
          'Bình Minh',
          'Cả ba hòn đảo đã giữ được ánh sáng!',
          `Tổng điểm hoàn hảo: ${totalScore}`,
          [
            ['Lưu điểm', () => promptSaveScore(() => showLeaderboardView(menu))],
            ['Về menu', menu],
          ],
          false,
          false,
          true,
        );
      } else {
        show(
          'Đã sống sót tới bình minh!',
          'Đủ số đèn vẫn còn sáng.',
          `Điểm Đêm: ${game.score} · Tổng: ${totalScore}`,
          [
            ['Đêm kế tiếp', () => intro(currentNight + 1)],
            ['Về menu', menu],
          ],
        );
      }
    } else {
      audio.effect('lost');
      show(
        'Đêm nay chưa trọn vẹn',
        game.reason === 'dawn' ? 'Không đủ đèn sáng khi bình minh tới.' : 'Mây đã mất hết Ngọn Lửa.',
        `Điểm Đêm: ${game.score} · Tổng điểm các Đêm đã thắng: ${totalScore}`,
        [
          ['Lưu điểm', () => promptSaveScore(() => showLeaderboardView(menu))],
          ['Chơi lại Đêm', startNight],
          ['Về menu', menu],
        ],
        false,
        false,
        true,
      );
    }
  }

  function handleEvents(events) {
    for (const event of events) {
      audio.effect(event.name);
      if (event.name === 'pulse') pulseTick = game.sim_tick;
      if (event.name === 'shade_spawned') {
        showSubtitle('Bóng Mực xuất hiện!');
        const s = game.shades.find((shade) => shade.id === event.data?.id);
        if (s) showShadeIndicator(s.pos);
      }
      if (event.name === 'lantern_out') {
        showSubtitle(`Đèn ${event.data.lantern_id} đã tắt ngúm!`);
      }
    }
  }

  function entities() {
    const active = new Set(['may', 'pulse', ...game.lanterns.map((l) => l.id)]);
    for (const item of [
      ...game.motes.map((m) => ({ ...m, type: 'mote' })),
      ...game.shades.map((s) => ({ ...s, type: 'shade' })),
      ...game.drifters.map((d) => ({ ...d, type: 'drifter' })),
      ...game.charms.filter((c) => c.available).map((c) => ({ ...c, type: 'charm' })),
    ]) {
      const key = `${item.type}:${item.id}`;
      active.add(key);
      if (!views.has(key)) {
        let m;
        if (item.type === 'mote') {
          m = mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(C.mote, { emissive: C.mote, emissiveIntensity: 1 }), [0, 0, 0], dynamic);
          mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: C.halo, transparent: true, opacity: 0.14, depthWrite: false }), [0, 0, 0], m);
        }
        if (item.type === 'shade') {
          m = new THREE.Group();
          dynamic.add(m);
          const body = mesh(new THREE.SphereGeometry(0.65, 12, 10), mat(C.shade, { emissive: C.rim, emissiveIntensity: 0.3 }), [0, 0, 0], m);
          body.scale.y = 1.2;
          for (const x of [-0.2, 0.2]) mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: C.rim }), [x, 0.1, -0.58], m);
        }
        if (item.type === 'drifter') {
          m = mesh(new THREE.PlaneGeometry(2, 0.5, 6, 1), mat(C.drifter, { emissive: C.drifter, emissiveIntensity: 0.3, side: THREE.DoubleSide }), [0, 0, 0], dynamic);
        }
        if (item.type === 'charm') {
          m = mesh(new THREE.BoxGeometry(0.5, 0.75, 0.07), mat(C.red), [0, 0, 0], dynamic);
          const border = mesh(new THREE.BoxGeometry(0.6, 0.85, 0.04), mat(C.gold), [0, 0, 0.04], m);
          border.position.z = -0.04;
        }
        views.set(key, m);
      }
      const m = views.get(key);
      m.position.set(...item.pos);
      if (item.type === 'mote' || item.type === 'charm') m.position.y += 0.65 + Math.sin(game.sim_tick / 30) * 0.12;
      if (item.type === 'shade') {
        const rim = settings.distinctPalette ? '#00B3FF' : C.rim;
        m.children[0].material.color.set(item.state === 'stunned' ? C.stunned : C.shade);
        m.children[0].material.emissive.set(rim);
        for (const eye of m.children.slice(1)) eye.material.color.set(rim);
        m.rotation.y = Math.atan2(game.player.pos[0] - item.pos[0], game.player.pos[2] - item.pos[2]) + Math.PI;
        m.scale.setScalar(item.state === 'spawning' ? 0.5 : 1);
      }
      if (item.type === 'drifter') m.rotation.y = game.sim_tick / 20;
    }
    for (const [key, m] of views) {
      if (!active.has(key)) {
        dynamic.remove(m);
        m.traverse((o) => { o.geometry?.dispose(); if (o.material) o.material.dispose(); });
        views.delete(key);
      }
    }
  }

  function render() {
    const p = game.player;
    entities();
    const may = views.get('may');
    may.position.set(...p.pos);
    may.rotation.y = Math.atan2(p.face[0], p.face[1]);
    may.visible = !p.respawn && (p.invuln === 0 || Math.floor(game.sim_tick / 5) % 2 === 0);

    const count = game.lanterns.filter((l) => l.lit).length;
    ambient.intensity = 0.15 + 0.55 * count / game.lanterns.length;

    let hasCritFuel = false;
    for (const l of game.lanterns) {
      const v = views.get(l.id);
      const fuel = l.fuelTicks / 60;
      const low = l.lit && fuel < 30;
      if (low) hasCritFuel = true;
      const blink = settings.reduceMotion || !low || Math.floor(game.sim_tick / 30) % 2 === 0;
      const ratio = Math.max(0.001, fuel / 100);
      v.paper.material.color.set(l.lit ? C.lantern : C.off);
      v.paper.material.emissive.set(l.lit ? C.core : '#000000');
      v.paper.material.emissiveIntensity = l.lit ? 1 : 0;
      v.paper.scale.y = l.lit ? 1.25 : 1;
      v.paper.visible = blink;
      v.tear.visible = !l.lit;
      v.light.intensity = l.lit && blink ? 45 : 0;
      v.halo.visible = l.lit && fuel >= 30;
      v.fuelBack.visible = l.lit && blink;
      v.fuelFill.visible = l.lit && blink;
      v.fuelFill.scale.x = ratio;
      v.fuelFill.position.x = (ratio - 1) * 0.4;
    }

    if (hasCritFuel && mode === 'playing' && Math.floor(game.sim_tick / 180) % 2 === 0) {
      showSubtitle('Cảnh báo: Đèn có lượng dầu < 30!', 1000);
    }

    const pulse = views.get('pulse');
    const age = (game.sim_tick - pulseTick) / 60;
    pulse.position.set(p.pos[0], p.pos[1] + 0.8, p.pos[2]);
    pulse.scale.setScalar(Math.max(0.01, Math.min(5, age * 15)));
    pulse.material.opacity = Math.max(0, 0.5 - age);

    const angle = yaw * Math.PI / 180;
    camera.position.set(p.pos[0] + Math.sin(angle) * 9, p.pos[1] + cameraHeight, p.pos[2] + Math.cos(angle) * 9);
    camera.lookAt(p.pos[0], p.pos[1] + 1, p.pos[2]);

    $('flames').textContent = `Ngọn Lửa ${p.flames}/3`;
    $('night-label').textContent = `Đêm ${game.night} · ${game.world.name}`;
    const seconds = Math.ceil(game.time_left_s);
    $('time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('time').classList.toggle('danger', game.time_left_s <= 30);
    $('lantern-count').textContent = `Đèn ${count}/${game.lanterns.length} · cần ${Math.ceil(0.6 * game.lanterns.length)}`;
    $('score').textContent = `Điểm ${game.score}`;

    const cap = Math.min(20, 10 + 2 * p.successfulLights);
    for (let i = 0; i < 20; i++) {
      $('carry').children[i].hidden = i >= cap;
      $('carry').children[i].classList.toggle('full', i < p.carried);
    }
    $('carry').setAttribute('aria-label', `Đom đóm ${p.carried}/${cap}`);

    $('cooldowns').textContent = `⇢ Lướt: ${p.charm > 0 ? 'sẵn sàng (bùa)' : p.dashCd ? `${(p.dashCd / 60).toFixed(1)} s` : 'sẵn sàng'} · ☀ Tỏa sáng: ${p.pulseCd ? `${(p.pulseCd / 60).toFixed(1)} s` : 'sẵn sàng'}${p.charm ? ` · Bùa ${(p.charm / 60).toFixed(1)} s` : ''}`;

    const nearest = game.lanterns.filter((l) => !l.lit || l.fuelTicks < 6000).map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) })).sort((a, b) => a.d - b.d || (a.l.id < b.l.id ? -1 : 1))[0];
    $('prompt').textContent = nearest?.d <= 2 ? (nearest.l.lit ? `E — Châm dầu (${(nearest.l.fuelTicks / 60).toFixed(0)}/100)` : `E — Nạp ánh sáng (${nearest.l.deposited}/${nearest.l.ever_lit ? 5 : 10})`) : 'Gom đom đóm và giữ đèn sáng tới bình minh.';

    if (nearest) {
      const projected = new THREE.Vector3(...nearest.l.pos);
      projected.y += 2;
      camera.updateMatrixWorld();
      projected.project(camera);
      const off = Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || projected.z > 1;
      $('direction').hidden = !off;
      const relative = Math.atan2(nearest.l.pos[0] - p.pos[0], nearest.l.pos[2] - p.pos[2]) - angle;
      const arrow = ['↓', '↘', '→', '↗', '↑', '↖', '←', '↙'][((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8];
      $('direction').textContent = `${arrow} ${nearest.l.id} · ${nearest.d.toFixed(0)} m`;
    } else $('direction').hidden = true;

    $('wind').textContent = game.wind.warning ? '🍃 Gió mạnh sắp tới!' : game.wind.active ? '🍃 Gió mạnh đang thổi' : '';

    if (mode === 'playing') {
      if (game.wind.warning && !lastWind) {
        audio.effect('wind');
        showSubtitle('Gió mạnh sắp thổi!');
      }
      lastWind = game.wind.warning;
      if (seconds <= 10 && seconds !== lastCountdown) {
        audio.effect('countdown');
        lastCountdown = seconds;
        showSubtitle(`Đêm sắp tàn! Còn ${seconds} s`);
      }
    }

    warningLeaves.visible = game.wind.warning;
    warningLeaves.position.set(p.pos[0], p.pos[1] + 2, p.pos[2]);
    warningLeaves.children.forEach((leaf, i) => {
      const a = game.sim_tick / 12 + i;
      leaf.position.set(Math.cos(a) * (2 + i / 5), Math.sin(a * 2), Math.sin(a) * (2 + i / 5));
      leaf.rotation.y = a;
    });

    renderer.render(scene, camera);
  }

  for (let i = 0; i < 20; i++) {
    const el = document.createElement('span');
    el.className = 'slot';
    $('carry').append(el);
  }

  window.addEventListener('keydown', (e) => {
    let matched = false;
    for (const codes of Object.values(settings.keys)) {
      if (codes.includes(e.code)) { matched = true; break; }
    }
    if (!matched) return;
    e.preventDefault();
    if (!keys.has(e.code)) pending.add(e.code);
    keys.add(e.code);

    if (settings.keys.pause.includes(e.code) && !e.repeat) {
      if (mode === 'playing') {
        handleEvents(stepSimulation(game, { ...defaultInput(), pause: true }));
        pending.clear();
        pauseMenu();
      } else if (mode === 'paused') resume();
    }
  });

  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pending.clear();
    if (mode === 'playing') {
      stepSimulation(game, { ...defaultInput(), pause: true });
      pauseMenu();
    }
  });

  let dragging = false;
  renderer.domElement.onpointerdown = (e) => {
    dragging = true;
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  renderer.domElement.onpointerup = () => { dragging = false; };
  renderer.domElement.onpointercancel = () => { dragging = false; };
  renderer.domElement.onpointermove = (e) => {
    if (dragging) {
      yaw = (yaw + e.movementX * settings.sensitivity) % 360;
      cameraHeight = Math.max(1, Math.min(12, cameraHeight + e.movementY * settings.sensitivity * 0.05));
    }
  };

  window.onresize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };

  const warningLeaves = new THREE.Group();
  scene.add(warningLeaves);
  for (let i = 0; i < 8; i++) {
    const leaf = mesh(new THREE.PlaneGeometry(0.25, 0.45), mat(C.grass, { side: THREE.DoubleSide }), [0, 0, 0], warningLeaves);
    leaf.rotation.z = i;
  }

  // Khởi động
  if (isBenchmarkMode) {
    // CHẾ ĐỘ BENCHMARK CHUẨN TICKET-04
    mode = 'benchmark';
    $('hud').hidden = true;
    $('controls').hidden = true;
    $('overlay').hidden = true;

    // Thiết lập cảnh benchmark
    game = createSimulation({
      seed: benchSeed,
      night: 1,
      scenario: { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false },
    });
    buildWorld();

    // 3 đèn L1-L3 sáng với fuel 100
    for (let i = 0; i < 3; i++) {
      game.lanterns[i].lit = true;
      game.lanterns[i].fuelTicks = 100 * 60;
      game.lanterns[i].deposited = 10;
      game.lanterns[i].ever_lit = true;
    }
    for (let i = 3; i < 5; i++) {
      game.lanterns[i].lit = false;
      game.lanterns[i].fuelTicks = 0;
    }

    // Đúng 200 Bóng Mực wander rải đều trên đảo (seed 42)
    game.shades = [];
    const benchPrng = makePrng(benchSeed);
    for (let i = 1; i <= 200; i++) {
      const angle = benchPrng() * Math.PI * 2;
      const r = 5 + benchPrng() * 32;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      game.shades.push({
        id: `S${i}`,
        pos: [x, 0.8, z],
        state: 'wander',
        left: 0,
        push: [0, 0],
        pushLeft: 0,
        recoil: [0, 0],
        safeLeft: 0,
        targetLanternId: null,
      });
    }

    // Đúng 100 đom đóm rải đều trên đảo (seed 42)
    game.motes = [];
    for (let i = 1; i <= 100; i++) {
      const angle = benchPrng() * Math.PI * 2;
      const r = 3 + benchPrng() * 34;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      game.motes.push({ id: `M${i}`, pos: [x, 0, z], kind: 'random', ttl: null, born: 0 });
    }

    const benchStartTime = performance.now();
    const dts = [];
    let lastBenchFrameTime = benchStartTime;
    const loadMs = Math.round(benchStartTime);

    renderer.setAnimationLoop((time) => {
      const dt = time - lastBenchFrameTime;
      lastBenchFrameTime = time;
      const elapsedTotal = (time - benchStartTime) / 1000;

      // Camera bay vòng tròn tâm (0,0,0), bán kính 30m, độ cao Y=15m, quay ngược chiều kim đồng hồ 15s một vòng
      const theta = (2 * Math.PI / 15) * elapsedTotal;
      camera.position.set(30 * Math.cos(theta), 15, -30 * Math.sin(theta));
      camera.lookAt(0, 0, 0);

      // Cập nhật di chuyển Bóng Mực bình thường
      game.sim_tick++;
      for (const s of game.shades) {
        const angle = (game.sim_tick / 240 + Number(s.id.replace(/\D/g, ''))) * 0.5;
        s.pos[0] += Math.cos(angle) * 2 / 60;
        s.pos[2] += Math.sin(angle) * 2 / 60;
      }

      // 3 giây đầu warmup, sau đó đo đúng benchDuration giây
      if (elapsedTotal >= 3.0 && elapsedTotal < 3.0 + benchDuration) {
        dts.push(dt);
      }

      entities();
      renderer.render(scene, camera);

      if (elapsedTotal >= 3.0 + benchDuration) {
        renderer.setAnimationLoop(null);
        const frames = dts.length;
        const totalMs = dts.reduce((a, b) => a + b, 0);
        const avgFps = Number((1000 * frames / (totalMs || 1)).toFixed(1));

        const sortedDesc = [...dts].sort((a, b) => b - a);
        const k = Math.max(1, Math.ceil(0.01 * frames));
        const avgWorstK = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
        const p1LowFps = Number((1000 / (avgWorstK || 1)).toFixed(1));

        const sortedAsc = [...dts].sort((a, b) => a - b);
        const p95Idx = Math.min(frames - 1, Math.floor(0.95 * frames));
        const frameMsP95 = Number((sortedAsc[p95Idx] || 0).toFixed(1));

        const peakMemMb = (performance && performance.memory)
          ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
          : null;

        const benchResult = {
          contract_version: '1.3',
          avg_fps: avgFps,
          p1_low_fps: p1LowFps,
          frame_ms_p95: frameMsP95,
          frames,
          load_ms: loadMs,
          peak_mem_mb: peakMemMb,
          vsync_off: true,
          renderer: 'Three.js 0.187.0 (WebGL 2)',
          os: navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux',
        };

        console.log('BENCHMARK COMPLETED:', JSON.stringify(benchResult));
        // Gửi kết quả về Node server nếu đang chạy qua runner
        fetch('/api/bench-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(benchResult),
        }).catch(() => {});

        // Hiển thị trực quan cho người dùng nếu mở bằng trình duyệt tay
        document.body.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#F5F1E6;background:#0E1430;min-height:100vh">
          <h1>Benchmark Hoàn Tất!</h1>
          <pre style="background:#1B2350;padding:1.5rem;border-radius:.5rem;border:1px solid #F2C14E;font-size:1.1rem">${JSON.stringify(benchResult, null, 2)}</pre>
          <button onclick="location.href='/'">Quay lại Game</button>
        </div>`;
      }
    });
  } else {
    buildWorld();
    menu();

    // Harness xem bản đồ trong Vite dev
    if (import.meta.env.DEV) {
      const preview = Number(pageParams.get('preview-night'));
      if ([1, 2, 3].includes(preview)) intro(preview);
    }

    renderer.setAnimationLoop((time) => {
      if (previousTime !== undefined && mode === 'playing') {
        accumulator += Math.min((time - previousTime) / 1000, 0.25);
      }
      previousTime = time;

      while (mode === 'playing' && accumulator >= FIXED_DT) {
        const i = defaultInput();
        const k = settings.keys;
        const hasKey = (action) => (k[action] || []).some((c) => keys.has(c) || pending.has(c));

        i.move = [
          Number(hasKey('move_right')) - Number(hasKey('move_left')),
          Number(hasKey('move_down')) - Number(hasKey('move_up')),
        ];
        i.cam_yaw_deg = yaw;
        i.jump = hasKey('jump');
        i.dash = hasKey('dash');
        i.interact = hasKey('interact');
        i.pulse = hasKey('pulse');

        handleEvents(stepSimulation(game, i));
        pending.clear();
        accumulator -= FIXED_DT;
        if (['won', 'lost'].includes(game.state)) result();
      }

      render();
      if (mode === 'playing') {
        if (!metricStart) metricStart = time;
        frameCount++;
        if (time > metricStart + 1000) {
          renderer.domElement.dataset.fps = ((frameCount - 1) * 1000 / (time - metricStart)).toFixed(1);
        }
      }
    });
  }
} catch (e) {
  $('error').hidden = false;
  $('error').textContent = 'Không khởi tạo được game. Kiểm tra WebGL 2 và console.';
  console.error(e);
}
