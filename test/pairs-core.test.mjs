import test from 'node:test';
import assert from 'node:assert/strict';
import { SYMBOLS, flipCard, finishPairs, hideMismatch, newPairs } from '../public/games/pairs-core.mjs';

const FIXED = () => 0.5;

test('a fresh deck has one pair of every symbol', () => {
  const state = newPairs(FIXED);
  assert.equal(state.cards.length, SYMBOLS * 2);
  for (let symbol = 0; symbol < SYMBOLS; symbol += 1) {
    assert.equal(state.cards.filter((card) => card.symbol === symbol).length, 2);
  }
});

test('matching cards score ten and stay revealed', () => {
  const state = newPairs(FIXED);
  const first = state.cards.findIndex((card) => card.symbol === 0);
  const second = state.cards.findIndex((card, i) => i !== first && card.symbol === state.cards[first].symbol);
  assert.equal(flipCard(state, first).changed, true);
  const result = flipCard(state, second);
  assert.equal(result.match, true);
  assert.equal(state.score, 10);
  assert.equal(state.cards[first].matched, true);
  assert.equal(state.moves, 1);
});

test('a mismatch locks the board until hidden', () => {
  const state = newPairs(FIXED);
  const first = state.cards.findIndex((card) => card.symbol === 0);
  const second = state.cards.findIndex((card) => card.symbol === 1);
  flipCard(state, first);
  assert.equal(flipCard(state, second).match, false);
  assert.equal(state.locked, true);
  assert.equal(flipCard(state, 0).changed, false);
  hideMismatch(state);
  assert.equal(state.locked, false);
  assert.equal(state.cards[first].flipped, false);
});

test('finishing all pairs ends the game', () => {
  const state = newPairs(FIXED);
  state.matches = SYMBOLS;
  finishPairs(state);
  assert.equal(state.over, true);
  assert.equal(flipCard(state, 0).changed, false);
});
