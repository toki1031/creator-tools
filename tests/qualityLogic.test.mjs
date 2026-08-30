import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDictionaryEntries, calculateBgmLoopCount, splitIntoScenes, splitSubtitleCards, splitSubtitlePhrases } from '../qualityLogic.js';

test('読み辞書は長い語を優先して本文を実際に置換する', () => {
  const entries = [{ from: '北斎', to: 'ほくさい' }, { from: '葛飾北斎', to: 'かつしかほくさい' }];
  assert.equal(applyDictionaryEntries('葛飾北斎と北斎', entries), 'かつしかほくさいとほくさい');
});
test('字幕カードは空行で分割し、1回改行は同じカード内に残す', () => {
  assert.deepEqual(splitSubtitleCards('一行目\n二行目\n\n次のカード'), ['一行目\n二行目', '次のカード']);
});
test('字幕フレーズは手動改行と空行の意味を維持する', () => {
  assert.deepEqual(splitSubtitlePhrases('一行目\n二行目', 13), ['一行目\n二行目']);
  assert.deepEqual(splitSubtitlePhrases('カード1\n\nカード2', 13), ['カード1', 'カード2']);
});
test('シーン分割は目標尺から均等なシーン時間を割り当てる', () => {
  const scenes = splitIntoScenes('第一文です。第二文です。第三文です。', 60);
  assert.equal(scenes.length, 3);
  assert.deepEqual(scenes.map(scene => scene.durationSec), [20, 20, 20]);
  assert.deepEqual(scenes.map(scene => scene.order), [1, 2, 3]);
});
test('BGMループ回数を動画尺と音源尺から計算する', () => {
  assert.equal(calculateBgmLoopCount(58, 4, true), 15);
  assert.equal(calculateBgmLoopCount(10, 12, true), 1);
  assert.equal(calculateBgmLoopCount(58, 4, false), 1);
  assert.equal(calculateBgmLoopCount(58, 0, true), 0);
});
