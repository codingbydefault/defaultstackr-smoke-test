import test from 'node:test';
import assert from 'node:assert/strict';
import { W, findPath, index, newPark, parkScore, place, stepPark } from '../public/games/coaster-core.mjs';

const FIXED = () => 0.9;

function buildRow(state, y, length) {
  for (let x = 0; x < length; x += 1) place(state, x, y, 'path');
}

test('placing and demolishing paths and rides updates cash', () => {
  const state = newPark();
  assert.equal(state.cash, 500);
  assert.equal(place(state, 2, 2, 'path').ok, true);
  assert.equal(state.cash, 495);
  assert.equal(place(state, 2, 2, 'tree').ok, false);
  assert.equal(place(state, 3, 2, 'coaster').ok, true);
  assert.equal(state.cash, 375);
  assert.equal(place(state, 3, 2, 'demolish').refund, 30);
  assert.equal(state.cash, 405);
});

test('an unaffordable build is rejected', () => {
  const state = newPark();
  state.cash = 4;
  assert.equal(place(state, 1, 1, 'path').ok, false);
  assert.equal(state.cash, 4);
});

test('findPath only walks over paths', () => {
  const state = newPark();
  buildRow(state, 8, 5);
  const from = index(0, 8);
  const to = index(4, 8);
  const path = findPath(state, from, to);
  assert.deepEqual(path, [from, index(1, 8), index(2, 8), index(3, 8), to]);
  assert.equal(findPath(state, from, index(2, 7)), null);
});

test('guests spend money at a coaster beside a path', () => {
  const state = newPark();
  buildRow(state, 8, 6);
  place(state, 2, 7, 'coaster');
  for (let i = 0; i < 160; i += 1) stepPark(state, 0.1, FIXED);
  assert.ok(state.income > 0, `expected income, got ${state.income}`);
  assert.ok(state.objects[0].revenue > 0);
  assert.ok(state.rating > 15);
});

test('the scenario is won at the target rating, cash and day', () => {
  const state = newPark();
  state.cash = 2000;
  for (let x = 0; x < 5; x += 1) place(state, x, 0, 'coaster');
  state.cash = 1000;
  state.day = 3;
  state.time = 16;
  stepPark(state, 0.1, FIXED);
  assert.equal(state.over, true);
  assert.equal(state.won, true);
});

test('bankruptcy ends the run and score is positive', () => {
  const state = newPark();
  state.cash = -60;
  stepPark(state, 0.1, FIXED);
  assert.equal(state.over, true);
  assert.equal(state.won, false);
  assert.ok(parkScore(state) >= 0);
  assert.ok(W > 0);
});
