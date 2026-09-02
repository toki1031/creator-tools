import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDictionaryEntries, calculateBgmLoopCount, splitIntoScenes, splitSubtitleCards, splitSubtitlePhrases } from '../qualityLogic.js';
import { resolveSubtitlePreviewCard } from '../subtitlePreviewNavigation.js';

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
test('字幕プレビューは2枚目のカードへ移動できる', () => {
  const result = resolveSubtitlePreviewCard('一行目\n二行目\n\n次のカード', 1, 16, 2);
  assert.equal(result.cardCount, 2);
  assert.equal(result.index, 1);
  assert.deepEqual(result.lines, ['次のカード']);
  assert.equal(result.hasPrevious, true);
  assert.equal(result.hasNext, false);
});
test('字幕プレビューは単一改行を同じカード内の改行として保持する', () => {
  const result = resolveSubtitlePreviewCard('一行目\n二行目', 0, 16, 2);
  assert.equal(result.cardCount, 1);
  assert.deepEqual(result.lines, ['一行目', '二行目']);
  assert.equal(result.hasPrevious, false);
  assert.equal(result.hasNext, false);
});
test('字幕カード数が減った場合はプレビュー位置を有効範囲へ補正する', () => {
  const result = resolveSubtitlePreviewCard('カード1', 8, 16, 2);
  assert.equal(result.cardCount, 1);
  assert.equal(result.index, 0);
  assert.deepEqual(result.lines, ['カード1']);
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