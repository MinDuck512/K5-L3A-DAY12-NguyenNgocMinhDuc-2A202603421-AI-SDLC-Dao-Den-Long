import * as THREE from 'three';
import { createSimulation, stepSimulation, defaultInput, FIXED_DT, TUNING, ISLAND_RADIUS } from './simulation.js';

const stats = document.querySelector('#stats');
const prompt = document.querySelector('#prompt');
const overlay = document.querySelector('#overlay');
const playButton = document.querySelector('#play');
const errorBox = document.querySelector('#error');

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Game 3D Đảo Đèn Lồng, điều khiển Mây bằng bàn phím');
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1025');
  scene.fog = new THREE.Fog('#0b1025', 20, 65);
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 140);
  const ambient = new THREE.HemisphereLight('#b4c8ff', '#1c282b', 1.4);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight('#a9bfff', 1.5);
  moon.position.set(-10, 20, 5);
  scene.add(moon);
  const material = (color, other = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...other });
  const mesh = (geometry, mat, pos = [0, 0, 0]) => {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(...pos);
    return item;
  };
  const island = mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3, 5, 96), material('#34433c'), [0, -2.5, 0]);
  scene.add(island);
  const edge = mesh(new THREE.TorusGeometry(ISLAND_RADIUS, 0.12, 6, 128), material('#6b7880'), [0, 0.02, 0]);
  edge.rotation.x = Math.PI / 2;
  scene.add(edge);

  // Toàn bộ nhân vật và cảnh là hình học tạo bằng mã, không tải asset ngoài.
  const may = new THREE.Group();
  may.add(mesh(new THREE.CylinderGeometry(0.25, 0.38, 0.7, 12), material('#78b9bd'), [0, 0.85, 0]));
  may.add(mesh(new THREE.SphereGeometry(0.25, 16, 12), material('#edbd98'), [0, 1.42, 0]));
  may.add(mesh(new THREE.ConeGeometry(0.6, 0.3, 32), material('#d7c390'), [0, 1.71, 0]));
  for (const x of [-0.14, 0.14]) may.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.5, 8), material('#273b55'), [x, 0.25, 0]));
  may.add(mesh(new THREE.BoxGeometry(0.025, 0.35, 0.025), material('#674732'), [0.46, 1.35, 0]));
  may.add(mesh(new THREE.SphereGeometry(0.14, 12, 8), material('#ffd68a', { emissive: '#ffac46', emissiveIntensity: 1.3 }), [0.46, 1.1, 0]));
  scene.add(may);
  const playerLight = new THREE.PointLight('#ffbf65', 12, 5, 2);
  scene.add(playerLight);

  const lanterns = new Map();
  function createLantern(lantern) {
    const group = new THREE.Group();
    group.position.set(...lantern.pos);
    group.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 12), material('#674735'), [0, 1.6, 0]));
    group.add(mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 16), material('#6b707a'), [0, 0.15, 0]));
    const paper = mesh(new THREE.SphereGeometry(0.75, 20, 16), material('#7a6e5c'), [0, 3.2, 0]);
    paper.scale.y = 1.25;
    group.add(paper);
    for (const y of [2.26, 4.14]) group.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 16), material('#5c3529'), [0, y, 0]));
    const light = new THREE.PointLight('#ffb85a', 0, 15, 2);
    light.position.y = 3.2;
    group.add(light);
    const safe = mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.06, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: '#ffd17e', transparent: true, opacity: 0.25, side: THREE.DoubleSide }), [0, 0.03, 0]);
    safe.rotation.x = -Math.PI / 2;
    safe.visible = false;
    group.add(safe);
    scene.add(group);
    lanterns.set(lantern.id, { group, paper, light, safe });
  }
  const moteGeometry = new THREE.SphereGeometry(0.17, 10, 8);
  const moteMaterial = material('#fff5b0', { emissive: '#ffd05f', emissiveIntensity: 3 });
  const shadeGeometry = new THREE.SphereGeometry(0.65, 16, 12);
  const shadeMaterial = material('#282039', { emissive: '#512265', emissiveIntensity: 0.5 });
  const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#cfb4ff' });
  const motes = new Map();
  const shades = new Map();
  const pulseRing = mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffdf8b', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  pulseRing.rotation.x = -Math.PI / 2;
  scene.add(pulseRing);
  let game = createSimulation();
  let running = false;
  let yaw = 0;
  let previousTime;
  let accumulator = 0;
  let pulseAt = -1000;
  const keys = new Set();
  const pendingActions = new Set();

  function syncView() {
    may.position.set(...game.player.pos);
    const movingX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const movingZ = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    if (movingX || movingZ) may.rotation.y = Math.atan2(movingX, movingZ) + yaw * Math.PI / 180;
    playerLight.position.set(game.player.pos[0], game.player.pos[1] + 1.2, game.player.pos[2]);
    may.visible = game.tick >= game.player.invulnerableUntil || Math.floor(game.tick / 5) % 2 === 0;
    const litCount = game.lanterns.filter((lantern) => lantern.lit).length;
    ambient.intensity = 1.4 + litCount * 0.3;
    for (const lantern of game.lanterns) {
      if (!lanterns.has(lantern.id)) createLantern(lantern);
      const view = lanterns.get(lantern.id);
      view.group.position.set(...lantern.pos);
      view.paper.material.color.set(lantern.lit ? '#ffd17e' : '#7a6e5c');
      view.paper.material.emissive.set(lantern.lit ? '#ffad39' : '#000000');
      view.paper.material.emissiveIntensity = lantern.lit ? 1.5 : 0;
      view.light.intensity = lantern.lit ? 50 : 0;
      view.safe.visible = lantern.lit;
    }
    const active = new Set(game.motes.map((mote) => mote.id));
    for (const [id, item] of motes) if (!active.has(id)) { scene.remove(item); motes.delete(id); }
    for (const mote of game.motes) {
      if (!motes.has(mote.id)) { const item = mesh(moteGeometry, moteMaterial); scene.add(item); motes.set(mote.id, item); }
      motes.get(mote.id).position.set(mote.pos[0], 0.7 + Math.sin(game.tick / 30 + Number(mote.id.slice(1))) * 0.18, mote.pos[2]);
    }
    for (const shade of game.shades) {
      if (!shades.has(shade.id)) {
        const item = new THREE.Group();
        const body = mesh(shadeGeometry, shadeMaterial.clone());
        body.scale.y = 1.3;
        item.add(body);
        for (const x of [-0.2, 0.2]) item.add(mesh(eyeGeometry, eyeMaterial, [x, 0.1, -0.57]));
        scene.add(item);
        shades.set(shade.id, item);
      }
      const item = shades.get(shade.id);
      item.position.set(...shade.pos);
      item.rotation.y = Math.atan2(game.player.pos[0] - shade.pos[0], game.player.pos[2] - shade.pos[2]) + Math.PI;
      item.children[0].material.emissive.set(shade.state === 'stunned' ? '#a392ca' : '#512265');
    }
    const remaining = Math.ceil(game.time_left_s);
    stats.innerHTML = `<span>Ngọn lửa: ${game.player.flames}/${TUNING.flames}</span><span>Đom đóm: ${game.player.carried}/${TUNING.carry_capacity}</span><span>Đèn: ${litCount}/${TUNING.lantern_count_night1}</span><span>Thời gian: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}</span><span>Điểm: ${game.score}</span>`;
    const nearest = game.lanterns.filter((lantern) => !lantern.lit).map((lantern) => ({ lantern, distance: Math.hypot(lantern.pos[0] - game.player.pos[0], lantern.pos[2] - game.player.pos[2]) })).sort((a, b) => a.distance - b.distance)[0];
    prompt.textContent = nearest?.distance <= TUNING.interact_radius
      ? `E: nạp đèn ${nearest.lantern.id} (${nearest.lantern.deposited}/${TUNING.lantern_cost}) · F: tỏa sáng, tốn ${TUNING.pulse_cost}`
      : `Gom đom đóm · ${nearest ? `Đèn ${nearest.lantern.id} cách ${nearest.distance.toFixed(0)} m` : 'Đã thắp đủ đèn'} · F: tỏa sáng`;
    const pulseAge = (game.tick - pulseAt) * FIXED_DT;
    pulseRing.material.opacity = Math.max(0, 0.8 - pulseAge * 1.6);
    pulseRing.scale.setScalar(Math.min(TUNING.pulse_radius, Math.max(0, pulseAge * 14)));
    const radians = yaw * Math.PI / 180;
    camera.position.set(game.player.pos[0] + Math.sin(radians) * 9, game.player.pos[1] + 6, game.player.pos[2] + Math.cos(radians) * 9);
    camera.lookAt(game.player.pos[0], game.player.pos[1] + 1, game.player.pos[2]);
  }
  playButton.addEventListener('click', () => {
    game = createSimulation();
    keys.clear(); pendingActions.clear(); yaw = 0; accumulator = 0; pulseAt = -1000;
    for (const item of motes.values()) scene.remove(item);
    motes.clear();
    for (const item of shades.values()) { scene.remove(item); item.children[0].material.dispose(); }
    shades.clear();
    running = true; overlay.hidden = true;
  });
  const handledKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyF']);
  window.addEventListener('keydown', (event) => {
    if (!handledKeys.has(event.code)) return;
    event.preventDefault();
    if (!keys.has(event.code) && ['Space', 'KeyE', 'KeyF'].includes(event.code)) pendingActions.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); pendingActions.clear(); });
  let dragging = false;
  renderer.domElement.addEventListener('pointerdown', (event) => { dragging = true; renderer.domElement.setPointerCapture(event.pointerId); });
  renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
  renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });
  renderer.domElement.addEventListener('pointermove', (event) => { if (dragging) yaw = (yaw + event.movementX * 0.3) % 360; });
  window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
  renderer.setAnimationLoop((time) => {
    if (previousTime !== undefined && running) accumulator += Math.min((time - previousTime) / 1000, 0.25);
    previousTime = time;
    while (running && accumulator >= FIXED_DT) {
      const input = defaultInput();
      input.move = [Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')), Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))];
      input.cam_yaw_deg = yaw;
      input.jump = keys.has('Space') || pendingActions.has('Space');
      input.interact = keys.has('KeyE') || pendingActions.has('KeyE');
      input.pulse = keys.has('KeyF') || pendingActions.has('KeyF');
      const events = stepSimulation(game, input);
      pendingActions.clear();
      for (const event of events) if (event.name === 'pulse') { pulseAt = game.tick; pulseRing.position.set(game.player.pos[0], 0.1, game.player.pos[2]); }
      accumulator -= FIXED_DT;
      if (game.state !== 'playing') {
        running = false; overlay.hidden = false;
        document.querySelector('#dialog-title').textContent = game.state === 'won' ? 'Đảo đã sáng trở lại!' : 'Đêm nay chưa trọn vẹn';
        document.querySelector('#dialog-message').textContent = game.state === 'won' ? 'Mây đã thắp đủ 5 Đèn Lồng Lớn.' : game.reason === 'dawn' ? 'Bình minh đã tới trước khi thắp đủ đèn.' : 'Mây đã mất hết ngọn lửa.';
        document.querySelector('#dialog-detail').textContent = `Điểm: ${game.score} · Đèn: ${game.lanterns.filter((lantern) => lantern.lit).length}/5`;
        playButton.textContent = 'Chơi lại';
      }
    }
    syncView();
    renderer.render(scene, camera);
  });
} catch (error) {
  errorBox.hidden = false;
  errorBox.textContent = 'Không khởi tạo được WebGL 2. Hãy kiểm tra trình duyệt; chi tiết lỗi có trong console.';
  console.error(error);
}
