import contract from '../game.contract.json' with { type: 'json' };

export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;
export const TUNING = Object.freeze(contract.tuning);
export const ISLAND_RADIUS = 32;
const EPSILON = 1e-9;
const buttons = ['jump', 'interact', 'pulse'];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const within = (a, b, radius) => distance(a, b) <= radius + EPSILON;
const round = (value) => Number(value.toFixed(3));
const position = (pos) => pos.map(round);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validPosition(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function validateScenario(scenario) {
  requireValue(object(scenario), 'scenario phải là object.');
  if ('player' in scenario) {
    requireValue(object(scenario.player), 'scenario.player phải là object.');
    const player = scenario.player;
    if ('pos' in player) requireValue(validPosition(player.pos), 'player.pos phải gồm 3 số hữu hạn.');
    if ('carried' in player) requireValue(Number.isSafeInteger(player.carried) && player.carried >= 0 && player.carried <= TUNING.carry_capacity, 'player.carried vượt sức chứa hoặc sai định dạng.');
    if ('flames' in player) requireValue(Number.isSafeInteger(player.flames) && player.flames >= 0, 'player.flames phải là số nguyên không âm.');
  }
  for (const key of ['random_motes', 'random_shades']) {
    if (key in scenario) requireValue(typeof scenario[key] === 'boolean', `${key} phải là boolean.`);
  }
  if ('time_left_s' in scenario) requireValue(Number.isFinite(scenario.time_left_s) && scenario.time_left_s >= 0, 'time_left_s phải là số không âm.');
  if ('motes' in scenario) requireValue(Array.isArray(scenario.motes) && scenario.motes.every(validPosition), 'motes phải là mảng các vị trí 3 số.');
  if ('shades' in scenario) {
    requireValue(Array.isArray(scenario.shades), 'shades phải là mảng.');
    const ids = new Set();
    for (const shade of scenario.shades) {
      requireValue(object(shade) && validPosition(shade.pos), 'Mỗi shade cần pos gồm 3 số.');
      if ('id' in shade) {
        requireValue(typeof shade.id === 'string' && shade.id.length > 0 && !ids.has(shade.id), 'shade.id phải là chuỗi không rỗng, không trùng.');
        ids.add(shade.id);
      }
    }
  }
  if ('lanterns' in scenario) {
    requireValue(Array.isArray(scenario.lanterns), 'lanterns phải là mảng.');
    const ids = new Set();
    for (const lantern of scenario.lanterns) {
      requireValue(object(lantern) && /^L[1-5]$/.test(lantern.id) && !ids.has(lantern.id), 'lantern.id phải là L1…L5, không trùng.');
      ids.add(lantern.id);
      if ('pos' in lantern) requireValue(validPosition(lantern.pos), 'lantern.pos sai định dạng.');
      if ('lit' in lantern) requireValue(typeof lantern.lit === 'boolean', 'lantern.lit phải là boolean.');
      if ('deposited' in lantern) requireValue(Number.isSafeInteger(lantern.deposited) && lantern.deposited >= 0 && lantern.deposited <= TUNING.lantern_cost, 'lantern.deposited sai định dạng.');
    }
  }
}

export function validateInputs(inputs) {
  requireValue(object(inputs) && Array.isArray(inputs.frames), 'inputs cần mảng frames.');
  let previous = -1;
  for (const frame of inputs.frames) {
    requireValue(object(frame) && Number.isSafeInteger(frame.tick) && frame.tick >= 0 && frame.tick > previous, 'tick của frames phải tăng nghiêm ngặt, là số nguyên không âm.');
    previous = frame.tick;
    if ('move' in frame) requireValue(Array.isArray(frame.move) && frame.move.length === 2 && frame.move.every((n) => Number.isFinite(n) && n >= -1 && n <= 1), 'move cần 2 số trong [-1,1].');
    if ('cam_yaw_deg' in frame) requireValue(Number.isFinite(frame.cam_yaw_deg), 'cam_yaw_deg phải là số hữu hạn.');
    for (const key of buttons) if (key in frame) requireValue(typeof frame[key] === 'boolean', `${key} phải là boolean.`);
  }
}
export function defaultInput() {
  return { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
}
function random(game) {
  game.rng = (game.rng + 0x6d2b79f5) >>> 0;
  let value = game.rng;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
function newShade(game, pos, requestedId) {
  let id = requestedId;
  if (!id) do { id = `S${game.nextShadeId++}`; } while (game.reservedShadeIds.has(id));
  game.reservedShadeIds.add(id);
  return { id, pos: [...pos], state: 'chase', stunnedUntil: 0 };
}
function randomShade(game) {
  const angle = random(game) * Math.PI * 2;
  return newShade(game, [Math.cos(angle) * 30, 0.9, Math.sin(angle) * 30]);
}

export function createSimulation({ seed = 1, scenario = {} } = {}) {
  requireValue(Number.isSafeInteger(seed), 'seed phải là số nguyên an toàn.');
  validateScenario(scenario);
  const game = {
    tick: 0, state: 'playing', score: 0, reason: null,
    time_left_s: scenario.time_left_s ?? TUNING.night1_duration_s,
    initialTime: scenario.time_left_s ?? TUNING.night1_duration_s,
    player: { pos: [0, 0, 0], carried: 0, flames: TUNING.flames, ...scenario.player, velocityY: 0, invulnerableUntil: 0, pulseReadyAt: 0 },
    lanterns: Array.from({ length: TUNING.lantern_count_night1 }, (_, i) => {
      const angle = (i / TUNING.lantern_count_night1) * Math.PI * 2;
      return { id: `L${i + 1}`, pos: [Math.sin(angle) * 20, 0, -Math.cos(angle) * 20], lit: false, deposited: 0 };
    }),
    shades: [], motes: [], rng: seed >>> 0, nextShadeId: 1,
    reservedShadeIds: new Set((scenario.shades ?? []).map((shade) => shade.id).filter(Boolean)),
    randomShades: scenario.random_shades ?? true, previousInput: defaultInput(),
  };
  game.player.pos = [...game.player.pos];
  for (const override of scenario.lanterns ?? []) {
    const lantern = game.lanterns.find((item) => item.id === override.id);
    Object.assign(lantern, override);
    lantern.pos = [...lantern.pos];
    lantern.lit = override.lit ?? (lantern.deposited >= TUNING.lantern_cost);
    if (lantern.lit) lantern.deposited = TUNING.lantern_cost;
  }
  if (scenario.motes !== undefined) game.motes = scenario.motes.map((pos, i) => ({ id: `M${i + 1}`, pos: [...pos] }));
  else if (scenario.random_motes !== false) {
    game.motes = Array.from({ length: 80 }, (_, i) => {
      const angle = random(game) * Math.PI * 2;
      const radius = Math.sqrt(random(game)) * 26;
      return { id: `M${i + 1}`, pos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] };
    });
  }
  game.shades = scenario.shades !== undefined
    ? scenario.shades.map((shade) => newShade(game, shade.pos, shade.id))
    : game.randomShades ? Array.from({ length: 3 }, () => randomShade(game)) : [];
  return game;
}

function keepShadeOutsideLights(game, shade) {
  for (const lantern of game.lanterns) {
    if (!lantern.lit || !within(shade.pos, lantern.pos, TUNING.safe_radius)) continue;
    const gap = distance(shade.pos, lantern.pos);
    const dx = gap > EPSILON ? (shade.pos[0] - lantern.pos[0]) / gap : 1;
    const dz = gap > EPSILON ? (shade.pos[2] - lantern.pos[2]) / gap : 0;
    shade.pos[0] = lantern.pos[0] + dx * (TUNING.safe_radius + 0.001);
    shade.pos[2] = lantern.pos[2] + dz * (TUNING.safe_radius + 0.001);
  }
}

export function stepSimulation(game, input = defaultInput()) {
  if (game.state !== 'playing') return [];
  const events = [];
  game.tick += 1;
  const emit = (name, data) => events.push({ type: 'event', tick: game.tick, name, data });
  const pressed = (key) => Boolean(input[key]) && !game.previousInput[key];
  const player = game.player;
  const [x, z] = input.move ?? [0, 0];
  const length = Math.max(1, Math.hypot(x, z));
  const angle = (input.cam_yaw_deg ?? 0) * Math.PI / 180;
  player.pos[0] += ((x * Math.cos(angle) + z * Math.sin(angle)) / length) * TUNING.player_speed * FIXED_DT;
  player.pos[2] += ((-x * Math.sin(angle) + z * Math.cos(angle)) / length) * TUNING.player_speed * FIXED_DT;
  const radius = Math.hypot(player.pos[0], player.pos[2]);
  if (radius > ISLAND_RADIUS) { player.pos[0] *= ISLAND_RADIUS / radius; player.pos[2] *= ISLAND_RADIUS / radius; }
  if (pressed('jump') && player.pos[1] <= EPSILON) player.velocityY = 6;
  if (player.pos[1] > 0 || player.velocityY > 0) {
    player.pos[1] = Math.max(0, player.pos[1] + player.velocityY * FIXED_DT);
    player.velocityY -= 18 * FIXED_DT;
    if (player.pos[1] === 0) player.velocityY = 0;
  }
  game.motes = game.motes.filter((mote) => {
    if (player.carried >= TUNING.carry_capacity || !within(player.pos, mote.pos, TUNING.pickup_radius)) return true;
    player.carried += 1; game.score += TUNING.score.per_mote;
    emit('mote_picked', { carried: player.carried });
    return false;
  });
  if (pressed('interact') && player.carried > 0) {
    const nearby = game.lanterns.filter((lantern) => !lantern.lit && within(player.pos, lantern.pos, TUNING.interact_radius));
    nearby.sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos) || (a.id < b.id ? -1 : 1));
    const lantern = nearby[0];
    if (lantern) {
      const amount = Math.min(player.carried, TUNING.lantern_cost - lantern.deposited);
      player.carried -= amount; lantern.deposited += amount;
      emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
      if (lantern.deposited >= TUNING.lantern_cost) {
        lantern.lit = true; game.score += TUNING.score.per_lantern;
        emit('lantern_lit', { lantern_id: lantern.id });
      }
    }
  }
  if (pressed('pulse') && player.carried >= TUNING.pulse_cost && game.tick >= player.pulseReadyAt) {
    player.carried -= TUNING.pulse_cost;
    player.pulseReadyAt = game.tick + Math.ceil(TUNING.pulse_cooldown_s * TICK_RATE);
    const stunnedIds = [];
    for (const shade of game.shades) {
      if (!within(player.pos, shade.pos, TUNING.pulse_radius)) continue;
      if (shade.state !== 'stunned' || game.tick >= shade.stunnedUntil) game.score += TUNING.score.per_stun;
      shade.state = 'stunned'; shade.stunnedUntil = game.tick + Math.ceil(TUNING.pulse_stun_s * TICK_RATE);
      const gap = distance(player.pos, shade.pos);
      shade.pos[0] += (gap > EPSILON ? (shade.pos[0] - player.pos[0]) / gap : 0) * TUNING.pulse_push_m;
      shade.pos[2] += (gap > EPSILON ? (shade.pos[2] - player.pos[2]) / gap : 1) * TUNING.pulse_push_m;
      stunnedIds.push(shade.id);
    }
    emit('pulse', { stunned_ids: stunnedIds });
  }
  if (game.randomShades && game.tick % (12 * TICK_RATE) === 0 && game.shades.length < 8) {
    const shade = randomShade(game); game.shades.push(shade); emit('shade_spawned', { id: shade.id });
  }
  for (const shade of game.shades) {
    keepShadeOutsideLights(game, shade);
    if (shade.state === 'stunned' && game.tick >= shade.stunnedUntil) shade.state = 'chase';
    if (shade.state === 'stunned') continue;
    const gap = distance(shade.pos, player.pos);
    if (gap > EPSILON) {
      const move = Math.min(gap, TUNING.shade_speed * FIXED_DT);
      shade.pos[0] += (player.pos[0] - shade.pos[0]) / gap * move;
      shade.pos[2] += (player.pos[2] - shade.pos[2]) / gap * move;
      keepShadeOutsideLights(game, shade);
    }
    if (player.flames > 0 && game.tick >= player.invulnerableUntil && within(player.pos, shade.pos, TUNING.shade_hit_radius)) {
      player.flames -= 1; player.invulnerableUntil = game.tick + Math.ceil(TUNING.invuln_s * TICK_RATE);
      emit('player_hit', { by: 'shade', flames: player.flames, dropped: 0 });
    }
  }
  game.time_left_s = Math.max(0, game.initialTime - game.tick * FIXED_DT);
  if (player.flames <= 0) { game.state = 'lost'; game.reason = 'no_flames'; }
  else if (game.lanterns.every((lantern) => lantern.lit)) { game.state = 'won'; game.reason = 'all_lit'; }
  else if (game.time_left_s <= EPSILON) { game.state = 'lost'; game.reason = 'dawn'; }
  if (game.state !== 'playing') {
    if (game.state === 'won') game.score += Math.floor(game.time_left_s) * TUNING.score.per_second_left + player.flames * TUNING.score.per_flame_left;
    emit('game_over', { result: game.state, reason: game.reason });
  }
  game.previousInput = { ...input };
  return events;
}

export function snapshot(game) {
  return {
    type: 'snapshot', tick: game.tick, sim_tick: game.tick, state: game.state,
    time_left_s: game.time_left_s, score: game.score,
    player: { pos: position(game.player.pos), flames: game.player.flames, carried: game.player.carried },
    lanterns: game.lanterns.map((lantern) => ({ ...lantern, pos: position(lantern.pos) })),
    shades: game.shades.map((shade) => ({ id: shade.id, pos: position(shade.pos), state: shade.state })),
    motes_active: game.motes.length, motes: game.motes.map((mote) => ({ id: mote.id, pos: position(mote.pos) })),
  };
}
