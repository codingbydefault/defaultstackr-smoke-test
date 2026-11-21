import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_H, TYPES, WEAPON_DURATION, enemySize, fireImpact, moveShip, newImpact, stepImpact } from '../public/games/impact-core.mjs';

const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};
const enemyAt = (x, y, type = 'scout') => ({
  type, x, y, baseY: y, wobble: 0, freq: 0, amp: 0, hp: TYPES[type].hp, maxHp: TYPES[type].hp
});

test('the ship stays inside the playfield', () => {
  const state = newImpact();
  moveShip(state, 'up', 10);
  assert.equal(state.ship.y, 1);
  moveShip(state, 'down', 10);
  assert.equal(state.ship.y, FIELD_H - 2);
});

test('firing respects the cooldown', () => {
  const state = newImpact();
  assert.equal(fireImpact(state), true);
  assert.equal(state.bullets.length, 1);
  assert.equal(fireImpact(state), false);
  stepImpact(state, 0.2, () => 0.9);
  assert.equal(fireImpact(state), true);
  assert.equal(state.bullets.length, 2);
});

test('shooting an enemy raises the score', () => {
  const state = newImpact();
  state.enemies.push({ type: 'scout', x: 6, y: state.ship.y, baseY: state.ship.y, wobble: 0, freq: 0, amp: 0, hp: 1 });
  state.bullets.push({ x: 5, y: state.ship.y, w: 3, h: 1 });
  const result = stepImpact(state, 0.05, () => 0.9);
  assert.equal(result.destroyed, 1);
  assert.equal(state.score, 10);
  assert.equal(state.enemies.length, 0);
});

test('an enemy collision costs a life and grants brief invulnerability', () => {
  const state = newImpact();
  state.spawnIn = 99;
  state.enemies.push({ type: 'scout', x: state.ship.x, y: state.ship.y, baseY: state.ship.y, wobble: 0, freq: 0, amp: 0, hp: 1 });
  const first = stepImpact(state, 0.02, () => 0.9);
  assert.equal(first.hit, true);
  assert.equal(state.lives, 2);
  state.enemies.push({ type: 'scout', x: state.ship.x, y: state.ship.y, baseY: state.ship.y, wobble: 0, freq: 0, amp: 0, hp: 1 });
  stepImpact(state, 0.02, () => 0.9);
  assert.equal(state.lives, 2);
});

test('the game ends when the last life is lost', () => {
  const state = newImpact();
  state.lives = 1;
  state.invuln = 0;
  state.enemies.push({ type: 'heavy', x: state.ship.x, y: state.ship.y, baseY: state.ship.y, wobble: 0, freq: 0, amp: 0, hp: 2 });
  stepImpact(state, 0.02, () => 0.9);
  assert.equal(state.over, true);
  assert.equal(state.lives, 0);
  assert.equal(fireImpact(state), false);
});

test('a killed enemy can drop a weapon pickup that upgrades firing', () => {
  const state = newImpact();
  state.spawnIn = 99;
  state.enemies.push(enemyAt(6, state.ship.y));
  state.bullets.push({ x: 5, y: state.ship.y, w: 3, h: 1 });

  const drop = stepImpact(state, 0.05, sequence(0, 0, 0.5));
  assert.equal(drop.destroyed, 1);
  assert.equal(state.pickups.length, 1);
  assert.equal(state.pickups[0].type, 'weapon');

  state.pickups[0].x = state.ship.x;
  state.pickups[0].y = state.ship.y;
  state.spawnIn = 99;
  const collected = stepImpact(state, 0.02, () => 0.9);
  assert.deepEqual(collected.collected, ['weapon']);
  assert.equal(state.pickups.length, 0);
  assert.ok(state.weaponTime > 0 && state.weaponTime <= WEAPON_DURATION);

  assert.equal(fireImpact(state), true);
  assert.equal(state.bullets.length, 3);
  assert.ok(state.fireIn < 0.16);
  assert.equal(fireImpact(state), false);
});

test('the weapon upgrade expires when its timer runs out', () => {
  const state = newImpact();
  state.spawnIn = 99;
  state.weaponTime = 0.1;
  stepImpact(state, 0.2, () => 0.9);
  assert.equal(state.weaponTime, 0);
  assert.equal(fireImpact(state), true);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.fireIn, 0.16);
});

test('a shield pickup absorbs one collision', () => {
  const state = newImpact();
  state.spawnIn = 99;
  state.pickups.push({ type: 'shield', x: state.ship.x, y: state.ship.y, w: 3, h: 3 });

  const picked = stepImpact(state, 0.02, () => 0.9);
  assert.deepEqual(picked.collected, ['shield']);
  assert.equal(state.shield, 1);

  state.enemies.push(enemyAt(state.ship.x, state.ship.y));
  const blocked = stepImpact(state, 0.02, () => 0.9);
  assert.equal(blocked.hit, false);
  assert.equal(blocked.shielded, true);
  assert.equal(state.lives, 3);
  assert.equal(state.shield, 0);
  assert.equal(state.enemies.length, 0);

  state.invuln = 0;
  state.enemies.push(enemyAt(state.ship.x, state.ship.y));
  const hurt = stepImpact(state, 0.02, () => 0.9);
  assert.equal(hurt.hit, true);
  assert.equal(state.lives, 2);
});

test('repair pickups restore a life but never exceed the cap of three', () => {
  const state = newImpact();
  state.spawnIn = 99;
  state.lives = 1;
  for (let i = 0; i < 3; i += 1) {
    state.pickups.push({ type: 'repair', x: state.ship.x, y: state.ship.y, w: 3, h: 3 });
    const result = stepImpact(state, 0.02, () => 0.9);
    assert.deepEqual(result.collected, ['repair']);
  }
  assert.equal(state.lives, 3);
});

test('every third level spawns a single boss that can be destroyed', () => {
  const state = newImpact();
  state.spawnIn = 99;
  state.score = 500; // wave 3

  const spawned = stepImpact(state, 0.02, () => 0.9);
  assert.equal(state.level, 3);
  assert.equal(spawned.bossSpawn, true);
  const boss = state.enemies.find((enemy) => enemy.type === 'boss');
  assert.ok(boss);
  assert.equal(enemySize(boss).hp, TYPES.boss.hp);
  assert.equal(boss.hp, boss.maxHp);
  assert.ok(TYPES.boss.hp > TYPES.heavy.hp);
  assert.ok(TYPES.boss.points > TYPES.heavy.points);
  assert.ok(enemySize(boss).w > enemySize({ type: 'scout' }).w);

  const again = stepImpact(state, 0.02, () => 0.9);
  assert.equal(again.bossSpawn, false);
  assert.equal(state.enemies.filter((enemy) => enemy.type === 'boss').length, 1);

  boss.x = 10;
  boss.y = state.ship.y;
  boss.baseY = state.ship.y;
  boss.freq = 0;
  boss.amp = 0;
  let bossDown = false;
  const bossHp = boss.hp;
  for (let i = 0; i < bossHp; i += 1) {
    state.bullets.push({ x: boss.x - 2, y: boss.y, w: 3, h: 1 });
    const result = stepImpact(state, 0.01, () => 0.9);
    bossDown = bossDown || result.bossDown;
  }
  assert.equal(bossDown, true);
  assert.equal(state.enemies.some((enemy) => enemy.type === 'boss'), false);
  assert.equal(state.score, 650);

  const other = newImpact();
  other.spawnIn = 99;
  other.score = 250; // wave 2
  stepImpact(other, 0.02, () => 0.9);
  assert.equal(other.level, 2);
  assert.equal(other.enemies.some((enemy) => enemy.type === 'boss'), false);
});
