import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendBgmTracks } from '../bgmRecommendation.js';

test('ranks metadata-matching reusable BGM first', () => {
  const tracks = [
    {id:'a',title:'静かなピアノ',mood:'calm',audioData:'x',license:'CC0',sourceUrl:'https://example.test/a',commercialUseAllowed:true},
    {id:'b',title:'Epic History',mood:'dramatic',genre:'great-person',audioData:'y',license:'free',sourceUrl:'https://example.test/b',commercialUseAllowed:true}
  ];
  const result = recommendBgmTracks(tracks, {genre:'great-person',mood:'dramatic'}, 2);
  assert.equal(result[0].id, 'b');
});

test('does not recommend entries without local audio', () => {
  assert.deepEqual(recommendBgmTracks([{id:'x',title:'metadata only'}], {}), []);
});
