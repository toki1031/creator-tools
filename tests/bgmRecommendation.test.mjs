import test from 'node:test';
import assert from 'node:assert/strict';
import { rankBgmTracks, scoreBgmTrack, isRecommendableBgm } from '../bgmRecommendation.js';

const blob = { size: 1 };

test('great-person projects prefer inspiring licensed commercial tracks', () => {
  const tracks = [
    { id: 'calm', blob, category: 'calm', commercialUse: 'allowed', license: 'CC0' },
    { id: 'inspiring', blob, category: 'inspiring', commercialUse: 'allowed', license: 'CC0', sourceUrl: 'https://example.test' },
    { id: 'dramatic', blob, category: 'dramatic', commercialUse: 'unknown', license: 'site terms' }
  ];
  const ranked = rankBgmTracks(tracks, { genre: 'great-person' }, 3);
  assert.equal(ranked[0].track.id, 'inspiring');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('commercially disallowed tracks are excluded from recommendations', () => {
  const track = { id: 'blocked', blob, category: 'inspiring', commercialUse: 'not-allowed', license: 'personal only' };
  assert.equal(isRecommendableBgm(track), false);
  assert.equal(scoreBgmTrack(track, { genre: 'great-person' }), -Infinity);
  assert.deepEqual(rankBgmTracks([track], { genre: 'great-person' }), []);
});

test('ranking does not mutate the source library', () => {
  const tracks = [{ id: 'a', blob, category: 'calm' }, { id: 'b', blob, category: 'inspiring' }];
  const ids = tracks.map(x => x.id).join(',');
  rankBgmTracks(tracks, { genre: 'education' });
  assert.equal(tracks.map(x => x.id).join(','), ids);
});
