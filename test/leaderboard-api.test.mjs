import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES,validNickname,plausibleScore,clientAddress } from '../src/leaderboard-api.mjs';
test('Cloudflare visitors have separate limits behind the trusted loopback tunnel',()=>{
  const request = (remote, header) => ({socket:{remoteAddress:remote},headers:{'cf-connecting-ip':header}});
  assert.equal(clientAddress(request('127.0.0.1','203.0.113.10')),'203.0.113.10');
  assert.equal(clientAddress(request('::1','2001:db8::2')),'2001:db8::2');
  assert.equal(clientAddress(request('203.0.113.20','203.0.113.10')),'203.0.113.20');
  assert.equal(clientAddress(request('127.0.0.1','203.0.113.10, 203.0.113.11')),'127.0.0.1');
  assert.equal(clientAddress(request('127.0.0.1',undefined)),'127.0.0.1');
});
test('all eight games supported',()=>assert.equal(GAMES.length,8));
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
});
