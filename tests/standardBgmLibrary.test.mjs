import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_BGM_LIBRARY_VERSION,
  getStandardBgmPreset,
  isExplicitNoBgm,
  listStandardBgmPresets,
  selectStandardBgmPreset
} from '../standardBgmLibrary.js';

test('ships five Creator OS standard BGM presets with stable unique ids',()=>{
  const presets=listStandardBgmPresets();
  assert.equal(STANDARD_BGM_LIBRARY_VERSION,1);
  assert.equal(presets.length,5);
  assert.equal(new Set(presets.map(item=>item.id)).size,5);
  assert.deepEqual(presets.map(item=>item.id),[
    'calm-documentary',
    'history-gravity',
    'gentle-learning',
    'challenge-forward',
    'emotional-afterglow'
  ]);
  assert.ok(presets.every(item=>item.label&&item.description&&item.chords.length>=4));
});

test('returns defensive copies of standard preset data',()=>{
  const first=getStandardBgmPreset('history-gravity');
  first.chords[0][0]=999;
  const second=getStandardBgmPreset('history-gravity');
  assert.notEqual(second.chords[0][0],999);
});

test('explicit BGM guidance has priority when selecting a standard track',()=>{
  assert.equal(selectStandardBgmPreset({guidance:['歴史・重厚なBGM'],tone:'やさしい教育'}).id,'history-gravity');
  assert.equal(selectStandardBgmPreset({guidance:['挑戦・前進を感じるBGM'],tone:'落ち着いた解説'}).id,'challenge-forward');
  assert.equal(selectStandardBgmPreset({guidance:['感動と余韻'],objective:'歴史紹介'}).id,'emotional-afterglow');
});

test('uses production context and genre when BGM guidance is omitted',()=>{
  assert.equal(selectStandardBgmPreset({tone:'落ち着いた教育ドキュメンタリー',genre:'great-person'}).id,'calm-documentary');
  assert.equal(selectStandardBgmPreset({genre:'education'}).id,'gentle-learning');
  assert.equal(selectStandardBgmPreset({objective:'挑戦して前へ進む行動につなげる',genre:'other'}).id,'challenge-forward');
});

test('recognizes explicit requests for no BGM',()=>{
  for(const value of ['BGMなし','音楽は不要','music なし','無音']){
    assert.equal(isExplicitNoBgm([value]),true,value);
    assert.equal(selectStandardBgmPreset({guidance:[value]}),null);
  }
  assert.equal(isExplicitNoBgm(['静かなBGM']),false);
});
