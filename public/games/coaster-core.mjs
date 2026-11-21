// Compact, original park-management logic for Coaster Park. Pure and
// deterministic when a random function is injected.

// A tall grid whose aspect matches the LCD screen, so the playfield fills
// the display instead of being letterboxed inside it.
export const W = 12;
export const H = 18;

// Attractions have their own price, ticket fee, thrill, reliability and
// footprint. Rotating a footprint swaps its width and height.
export const ATTRACTIONS = {
  carousel: { label: 'CARROUSEL', cost: 70, fee: 4, thrill: 8, breakRate: 0.012, rideTime: 1.0, size: [1, 1] },
  coaster: { label: 'COASTER', cost: 120, fee: 8, thrill: 15, breakRate: 0.03, rideTime: 1.6, size: [2, 1] },
  ferris: { label: 'SKY WHEEL', cost: 150, fee: 6, thrill: 11, breakRate: 0.018, rideTime: 1.3, size: [2, 2] },
  shop: { label: 'SHOP', cost: 60, fee: 4, thrill: 6, breakRate: 0, rideTime: 0.8, size: [1, 1] },
  burger: { label: 'BURGER SHOP', cost: 50, fee: 5, thrill: 7, breakRate: 0, rideTime: 0.8, size: [1, 1] },
  info: { label: 'INFO-CENTER', cost: 80, fee: 3, thrill: 10, breakRate: 0, rideTime: 1.0, size: [1, 1], guestBonus: true }
};

export const RIDE_TYPES = ['carousel', 'coaster', 'ferris'];
export const REPAIR_COST = 20;

export const COSTS = {
  path: 5,
  tree: 10,
  carousel: ATTRACTIONS.carousel.cost,
  coaster: ATTRACTIONS.coaster.cost,
  ferris: ATTRACTIONS.ferris.cost,
  shop: ATTRACTIONS.shop.cost,
  burger: ATTRACTIONS.burger.cost,
  info: ATTRACTIONS.info.cost
};

const DAY_SECONDS = 8;
const MAX_GUESTS = 24;

export const isRide = (type) => RIDE_TYPES.includes(type);
export const index = (x, y) => y * W + x;
export const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

export function footprint(type, rotation = 0) {
  const size = ATTRACTIONS[type]?.size || [1, 1];
  return rotation % 2 ? [size[1], size[0]] : [size[0], size[1]];
}

export function cellsOf(object) {
  const cells = [];
  for (let y = object.y; y < object.y + object.h; y += 1) {
    for (let x = object.x; x < object.x + object.w; x += 1) cells.push([x, y]);
  }
  return cells;
}

export function newPark() {
  return {
    tiles: Array(W * H).fill('grass'),
    objects: [],
    guests: [],
    cash: 500,
    rating: 15,
    day: 1,
    time: 0,
    income: 0,
    spent: 0,
    nextId: 1,
    spawnTimer: 0,
    over: false,
    won: false
  };
}

export function objectAtCell(state, x, y) {
  return state.objects.find((object) =>
    x >= object.x && x < object.x + object.w && y >= object.y && y < object.y + object.h);
}

export function canPlace(state, x, y, tool, rotation = 0) {
  if (state.over) return { ok: false, reason: 'GAME OVER' };
  if (!(tool in COSTS)) return { ok: false, reason: 'ONBEKEND' };
  const [w, h] = footprint(tool, rotation);
  if (x < 0 || y < 0 || x + w > W || y + h > H) return { ok: false, reason: 'BUITEN' };
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const cx = x + dx;
      const cy = y + dy;
      if (state.tiles[index(cx, cy)] !== 'grass' || objectAtCell(state, cx, cy)) {
        return { ok: false, reason: 'BEZET' };
      }
    }
  }
  const cost = COSTS[tool];
  if (state.cash < cost) return { ok: false, reason: 'TE WEINIG GELD' };
  return { ok: true, cost, w, h };
}

export function place(state, x, y, tool, rotation = 0) {
  if (state.over) return { ok: false, reason: 'GAME OVER' };
  if (!inside(x, y)) return { ok: false, reason: 'BUITEN' };
  const at = index(x, y);

  if (tool === 'demolish') {
    const object = objectAtCell(state, x, y);
    if (state.tiles[at] === 'path') {
      state.tiles[at] = 'grass';
      return { ok: true, refund: 0 };
    }
    if (!object) return { ok: false, reason: 'LEEG VAK' };
    state.objects = state.objects.filter((item) => item !== object);
    const refund = Math.round(COSTS[object.type] * 0.25);
    state.cash += refund;
    return { ok: true, refund };
  }

  const check = canPlace(state, x, y, tool, rotation);
  if (!check.ok) return check;

  state.cash -= check.cost;
  state.spent += check.cost;
  if (tool === 'path') state.tiles[at] = 'path';
  else state.objects.push({
    id: state.nextId++,
    type: tool,
    x,
    y,
    w: check.w,
    h: check.h,
    rotation,
    broken: false,
    repair: 0,
    revenue: 0
  });
  return { ok: true, cost: check.cost };
}

export function repairAll(state) {
  if (state.over) return { ok: false, reason: 'GAME OVER' };
  const broken = state.objects.filter((object) => object.broken);
  if (!broken.length) return { ok: false, reason: 'ALLES OK' };
  const cost = broken.length * REPAIR_COST;
  if (state.cash < cost) return { ok: false, reason: 'TE WEINIG GELD' };
  state.cash -= cost;
  state.spent += cost;
  broken.forEach((object) => { object.broken = false; object.repair = 0; });
  return { ok: true, cost, count: broken.length };
}

export function findPath(state, from, to) {
  if (from === to) return [];
  if (state.tiles[from] !== 'path' || state.tiles[to] !== 'path') return null;
  const queue = [from];
  const parent = new Map([[from, null]]);
  while (queue.length) {
    const current = queue.shift();
    const x = current % W;
    const y = Math.floor(current / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const next = index(nx, ny);
      if (parent.has(next) || state.tiles[next] !== 'path') continue;
      parent.set(next, current);
      if (next === to) {
        const path = [to];
        let step = current;
        while (step !== null) { path.unshift(step); step = parent.get(step); }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

function pathBeside(state, object) {
  for (const [x, y] of cellsOf(object)) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const at = index(nx, ny);
      if (state.tiles[at] === 'path') return at;
    }
  }
  return -1;
}

function pickTarget(state, guest, random) {
  const candidates = state.objects
    .filter((object) => object.type in ATTRACTIONS)
    .filter((object) => !object.broken || !isRide(object.type))
    .filter((object) => guest.cash >= ATTRACTIONS[object.type].fee)
    .map((object) => ({ object, stop: pathBeside(state, object) }))
    .filter((candidate) => candidate.stop >= 0);
  if (!candidates.length) return false;
  const choice = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  const path = findPath(state, guest.at, choice.stop);
  if (!path) return false;
  guest.targetId = choice.object.id;
  guest.path = path;
  guest.state = path.length ? 'walking' : 'arrived';
  return true;
}

function sendHome(state, guest) {
  const paths = [];
  state.tiles.forEach((tile, at) => { if (tile === 'path') paths.push(at); });
  if (!paths.length) { guest.state = 'gone'; return; }
  const exit = paths[0];
  const path = findPath(state, guest.at, exit);
  guest.path = path || [];
  guest.targetId = null;
  guest.state = 'leaving';
}

function boardGuest(state, guest, random) {
  const object = state.objects.find((item) => item.id === guest.targetId);
  const cfg = object && ATTRACTIONS[object.type];
  if (!cfg || (object.broken && isRide(object.type)) || guest.cash < cfg.fee) {
    if (!pickTarget(state, guest, random)) sendHome(state, guest);
    return;
  }
  guest.cash -= cfg.fee;
  object.revenue += cfg.fee;
  state.cash += cfg.fee;
  state.income += cfg.fee;
  guest.happy = Math.min(100, guest.happy + cfg.thrill);
  guest.state = 'riding';
  guest.timer = cfg.rideTime;
}

function spawnGuest(state, random) {
  const paths = [];
  state.tiles.forEach((tile, at) => { if (tile === 'path') paths.push(at); });
  if (!paths.length) return;
  const at = paths[Math.min(paths.length - 1, Math.floor(random() * paths.length))];
  const guest = {
    id: state.nextId++,
    at,
    x: at % W,
    y: Math.floor(at / W),
    path: [],
    targetId: null,
    state: 'walking',
    timer: 0,
    cash: 30,
    happy: 55
  };
  if (!pickTarget(state, guest, random)) sendHome(state, guest);
  state.guests.push(guest);
}

function updateRating(state) {
  const thrill = state.objects.reduce((sum, object) => sum + (ATTRACTIONS[object.type]?.thrill || 0), 0);
  const trees = state.objects.filter((object) => object.type === 'tree');
  const broken = state.objects.filter((object) => object.broken).length;
  const happiness = state.guests.length
    ? state.guests.reduce((sum, guest) => sum + guest.happy, 0) / state.guests.length
    : 50;
  const paths = state.tiles.filter((tile) => tile === 'path').length;
  const value = 15 + thrill * 0.75 + trees.length * 3
    + Math.min(10, paths) * 0.4 + (happiness - 50) * 0.35 - broken * 12;
  state.rating = Math.max(0, Math.min(100, Math.round(value)));
}

export function stepPark(state, dt, random = Math.random) {
  if (state.over) return state;
  state.time += dt;
  const day = 1 + Math.floor(state.time / DAY_SECONDS);
  if (day > state.day) {
    state.day = day;
    const upkeep = state.objects.length * 2 + state.guests.length;
    state.cash -= upkeep;
  }

  for (const object of state.objects) {
    const cfg = ATTRACTIONS[object.type];
    if (!cfg || !cfg.breakRate) continue;
    if (object.broken) {
      object.repair -= dt;
      if (object.repair <= 0) { object.broken = false; state.cash -= 15; }
    } else if (random() < dt * cfg.breakRate) {
      object.broken = true;
      object.repair = 4;
    }
  }

  state.spawnTimer += dt;
  const infoCenters = state.objects.filter((object) => ATTRACTIONS[object.type]?.guestBonus).length;
  const interval = Math.max(0.8, 1.4 + (100 - state.rating) / 60 - infoCenters * 0.2);
  if (state.spawnTimer >= interval && state.guests.length < MAX_GUESTS) {
    state.spawnTimer = 0;
    spawnGuest(state, random);
  }

  for (const guest of state.guests) {
    if (guest.state === 'riding') {
      guest.timer -= dt;
      if (guest.timer <= 0) {
        if (guest.happy > 82 || guest.cash < 4 || random() < 0.35) sendHome(state, guest);
        else if (!pickTarget(state, guest, random)) sendHome(state, guest);
      }
      continue;
    }
    if (guest.state === 'arrived') { boardGuest(state, guest, random); continue; }
    if (guest.state === 'leaving') {
      if (!guest.path.length) { guest.state = 'gone'; continue; }
    } else if (guest.state === 'gone' || !guest.path.length) continue;

    guest.timer += dt;
    while (guest.timer >= 0.45 && guest.path.length) {
      guest.timer -= 0.45;
      const at = guest.path.shift();
      guest.at = at;
      guest.x = at % W;
      guest.y = Math.floor(at / W);
      if (state.tiles[at] !== 'path') { guest.path = []; sendHome(state, guest); }
    }
    if (guest.path.length) continue;

    if (guest.state === 'leaving') { guest.state = 'gone'; continue; }
    boardGuest(state, guest, random);
  }

  state.guests = state.guests.filter((guest) => guest.state !== 'gone');
  updateRating(state);

  if (state.cash < -50) state.over = true;
  if (state.rating >= 60 && state.cash >= 1000 && state.day >= 3) {
    state.over = true;
    state.won = true;
  }
  return state;
}

export function parkScore(state) {
  return Math.max(0, Math.round(state.cash + state.rating * 5 + state.guests.length * 10));
}
