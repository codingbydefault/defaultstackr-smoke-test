import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_H, fireImpact, moveShip, newImpact, stepImpact } from '../public/games/impact-core.mjs';

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
