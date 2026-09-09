import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBgmRights, createBgmCreditLines, summarizeBgmRights } from '../bgmRights.js';

test('marks complete commercial BGM metadata ready',()=>{
  const result=assessBgmRights({commercialUse:'allowed',license:'CC0',sourceUrl:'https://example.com',credit:'Artist'});
  assert.equal(result.status,'ready');
});

test('marks unknown metadata for review and commercial prohibition blocked',()=>{
  assert.equal(assessBgmRights({license:'CC0'}).status,'review');
  assert.equal(assessBgmRights({commercialUse:'not-allowed',license:'x',sourceUrl:'https://x.test'}).status,'blocked');
});

test('credit lines only use metadata that actually exists',()=>{
  const lines=createBgmCreditLines({title:'Song',credit:'Artist',license:'CC BY',sourceUrl:'https://example.com'});
  assert.deepEqual(lines,['BGM: Song','Credit: Artist','License: CC BY','Source: https://example.com']);
  assert.equal(createBgmCreditLines({}).length,0);
});

test('library rights summary separates ready review and blocked tracks',()=>{
  const summary=summarizeBgmRights([
    {id:'a',commercialUse:'allowed',license:'CC0',sourceUrl:'https://a.test'},
    {id:'b',commercialUse:'unknown'},
    {id:'c',commercialUse:'not-allowed'}
  ]);
  assert.deepEqual([summary.ready,summary.review,summary.blocked],[1,1,1]);
});
