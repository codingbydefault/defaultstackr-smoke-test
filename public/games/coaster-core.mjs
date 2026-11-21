// Compact, original park-management logic for Coaster Park. Pure and
// deterministic when a random function is injected.

export const W = 12;
export const H = 9;
export const COSTS = { path: 5, coaster: 120, shop: 60, tree: 10 };
const FEES = { coaster: 8, shop: 4 };
const DAY_SECONDS = 8;
const MAX_GUESTS = 24;

export const index = (x, y) => y * W + x;
export const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

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

function objectAt(state, x, y) {
  return state.objects.find((object) => object.x === x && object.y === y);
}

export function place(state, x, y, tool) {
  if (state.over) return { ok: false, reason: 'GAME OVER' };
  if (!inside(x, y)) return { ok: false, reason: 'BUITEN' };
  const at = index(x, y);

  if (tool === 'demolish') {
    const object = objectAt(state, x, y);
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

  if (!(tool in COSTS)) return { ok: false, reason: 'ONBEKEND' };
  if (state.tiles[at] !== 'grass' || objectAt(state, x, y)) return { ok: false, reason: 'BEZET' };
  const cost = COSTS[tool];
  if (state.cash < cost) return { ok: false, reason: 'TE WEINIG GELD' };

  state.cash -= cost;
  state.spent += cost;
  if (tool === 'path') state.tiles[at] = 'path';
  else state.objects.push({ id: state.nextId++, type: tool, x, y, broken: false, repair: 0, revenue: 0 });
  return { ok: true, cost };
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
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = object.x + dx;
    const y = object.y + dy;
    if (!inside(x, y)) continue;
    const at = index(x, y);
    if (state.tiles[at] === 'path') return at;
  }
  return -1;
}

function pickTarget(state, guest, random) {
  const candidates = state.objects
    .filter((object) => object.type === 'coaster' || object.type === 'shop')
    .filter((object) => !object.broken || object.type === 'shop')
    .filter((object) => guest.cash >= FEES[object.type])
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
  if (!object || object.broken || (object.type === 'shop' && guest.cash < FEES.shop)) {
    if (!pickTarget(state, guest, random)) sendHome(state, guest);
    return;
  }
  const fee = FEES[object.type];
  guest.cash -= fee;
  object.revenue += fee;
  state.cash += fee;
  state.income += fee;
  guest.happy = Math.min(100, guest.happy + (object.type === 'coaster' ? 14 : 6));
  guest.state = 'riding';
  guest.timer = object.type === 'coaster' ? 1.6 : 0.8;
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
  const rides = state.objects.filter((object) => object.type === 'coaster');
  const shops = state.objects.filter((object) => object.type === 'shop');
  const trees = state.objects.filter((object) => object.type === 'tree');
  const broken = state.objects.filter((object) => object.broken).length;
  const happiness = state.guests.length
    ? state.guests.reduce((sum, guest) => sum + guest.happy, 0) / state.guests.length
    : 50;
  const paths = state.tiles.filter((tile) => tile === 'path').length;
  const value = 15 + rides.length * 11 + shops.length * 5 + trees.length * 3
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
    if (object.type !== 'coaster') continue;
    if (object.broken) {
      object.repair -= dt;
      if (object.repair <= 0) { object.broken = false; state.cash -= 15; }
    } else if (random() < dt * 0.025) {
      object.broken = true;
      object.repair = 4;
    }
  }

  state.spawnTimer += dt;
  const interval = 1.4 + (100 - state.rating) / 60;
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
