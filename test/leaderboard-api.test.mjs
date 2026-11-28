import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES,validNickname,plausibleScore } from '../src/leaderboard-api.mjs';
test('all nine games supported',()=>assert.equal(GAMES.length,9));
test('validates player nicknames',()=>{
  assert.equal(validNickname('Speler 12'),true);
  assert.equal(validNickname('x'),false);
  assert.equal(validNickname('<script>'),false);
  assert.equal(validNickname('x'.repeat(25)),false);
});
test('rejects implausible scores',()=>{
  assert.equal(plausibleScore('snake',10,15),true);
  assert.equal(plausibleScore('snake',999999999,2),false);
  assert.equal(plausibleScore('snake',10,0),false);
  assert.equal(plausibleScore('other',10,10),false);
  assert.equal(plausibleScore('frogger',25,2),true);
  assert.equal(plausibleScore('frogger',1_000_000_001,2),false);
});
