import test from 'node:test';
import assert from 'node:assert/strict';
import { rankAssetsForText, rankProjectAssetsForScene } from '../assetSearch.js';

const assets = [
  { id:'a', type:'image', fileName:'江戸の街並み.jpg' },
  { id:'b', type:'image', fileName:'北斎_富嶽三十六景.png', tags:['葛飾北斎','浮世絵'] },
  { id:'c', type:'image', fileName:'海辺.png', note:'波 富士山' },
  { id:'x', type:'audio', fileName:'北斎.mp3' }
];

test('ranks matching image metadata without reading image payloads', () => {
  const ranked = rankAssetsForText('葛飾北斎の浮世絵', assets);
  assert.equal(ranked[0].assetId, 'b');
  assert.equal(ranked.some(item => item.assetId === 'x'), false);
});

test('uses scene text, speech and subtitles as local search context', () => {
  const project = { mediaLibrary: assets };
  const ranked = rankProjectAssetsForScene(project, { text:'江戸の街を歩いた。', subtitleText:'江戸の街並み' });
  assert.equal(ranked[0].assetId, 'a');
});

test('returns no recommendation when metadata has no meaningful match', () => {
  assert.deepEqual(rankAssetsForText('宇宙船', assets), []);
});

test('does not mutate assets', () => {
  const before = JSON.stringify(assets);
  rankAssetsForText('北斎', assets);
  assert.equal(JSON.stringify(assets), before);
});
