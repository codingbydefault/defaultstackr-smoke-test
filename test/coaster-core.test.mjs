import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRACTIONS, COSTS, REPAIR_COST, RIDE_TYPES, W, findPath, footprint, index, newPark, parkScore, place, repairAll, stepPark } from '../public/games/coaster-core.mjs';

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
  for (let x = 0; x < W; x += 2) place(state, x, 0, 'coaster');
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

test('the ride dropdown choices have distinct prices and rating impact', () => {
  assert.deepEqual(RIDE_TYPES, ['carousel', 'coaster', 'ferris']);
  const parks = RIDE_TYPES.map((type) => {
    const state = newPark();
    assert.equal(place(state, 1, 1, type).ok, true);
    stepPark(state, 0.1, FIXED);
    return state;
  });
  assert.deepEqual(parks.map((state) => state.cash), [430, 380, 350]);
  assert.ok(parks[1].rating > parks[0].rating);
  assert.ok(parks[2].rating > parks[0].rating);
  assert.ok(parks[1].rating > parks[2].rating);
});

test('guests pay the fee of the chosen ride', () => {
  const state = newPark();
  buildRow(state, 8, 6);
  place(state, 2, 6, 'ferris');
  for (let i = 0; i < 160; i += 1) stepPark(state, 0.1, FIXED);
  const ride = state.objects[0];
  assert.ok(ride.revenue > 0, `expected ferris revenue, got ${ride.revenue}`);
  assert.equal(ride.revenue % ATTRACTIONS.ferris.fee, 0);
});

test('repairAll fixes broken rides for a fee', () => {
  const state = newPark();
  place(state, 2, 2, 'carousel');
  place(state, 4, 2, 'coaster');
  state.objects.forEach((object) => { object.broken = true; object.repair = 4; });
  const before = state.cash;
  const result = repairAll(state);
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.cost, 2 * REPAIR_COST);
  assert.equal(state.cash, before - result.cost);
  assert.ok(state.objects.every((object) => !object.broken));
  assert.equal(repairAll(state).ok, false);
});

test('attractions have footprints and rotation swaps their footprint', () => {
  assert.deepEqual(footprint('carousel'), [1, 1]);
  assert.deepEqual(footprint('coaster'), [2, 1]);
  assert.deepEqual(footprint('coaster', 1), [1, 2]);
  assert.deepEqual(footprint('ferris'), [2, 2]);
  assert.deepEqual(footprint('shop'), [1, 1]);
  assert.deepEqual(footprint('burger'), [1, 1]);
  assert.deepEqual(footprint('info'), [1, 1]);
});

test('multi-cell attractions occupy every cell and refuse overlap', () => {
  const state = newPark();
  assert.equal(place(state, 2, 2, 'coaster').ok, true);
  const coaster = state.objects[0];
  assert.equal(coaster.w, 2);
  assert.equal(coaster.h, 1);
  assert.equal(place(state, 3, 2, 'tree').ok, false);
  assert.equal(place(state, 2, 3, 'carousel').ok, true);
  assert.equal(place(state, 4, 2, 'ferris').ok, true);
  assert.equal(state.objects.find((object) => object.type === 'ferris').w, 2);
});

test('a rotated coaster is placed vertically', () => {
  const state = newPark();
  assert.equal(place(state, 2, 2, 'coaster', 1).ok, true);
  const coaster = state.objects[0];
  assert.equal(coaster.w, 1);
  assert.equal(coaster.h, 2);
  assert.equal(coaster.rotation, 1);
  assert.equal(place(state, 2, 3, 'shop').ok, false);
  assert.equal(place(state, 3, 2, 'shop').ok, true);
});

test('the burger shop is a cheap single-cell build option', () => {
  const state = newPark();
  assert.equal(COSTS.burger, 50);
  assert.equal(place(state, 4, 4, 'burger').ok, true);
  assert.equal(state.cash, 450);
  assert.equal(state.objects[0].type, 'burger');
  assert.equal(ATTRACTIONS.burger.label, 'BURGER SHOP');
});

test('the info center adds rating and earns fees beside a path', () => {
  const state = newPark();
  assert.equal(COSTS.info, 80);
  assert.equal(ATTRACTIONS.info.guestBonus, true);
  buildRow(state, 8, 6);
  assert.equal(place(state, 2, 7, 'info').ok, true);
  assert.equal(state.cash, 390);
  for (let i = 0; i < 160; i += 1) stepPark(state, 0.1, FIXED);
  assert.ok(state.objects[0].revenue > 0, 'expected info center fees');
  assert.ok(state.rating > 15);
});
