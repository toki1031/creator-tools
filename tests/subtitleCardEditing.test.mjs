import test from 'node:test';
import assert from 'node:assert/strict';
import { readSubtitleCards, writeSubtitleCards, splitSubtitleCardNaturally, mergeSubtitleCardWithNext, replaceSubtitleCard, subtitleCardTiming } from '../subtitleCardEditing.js';

test('reads explicit blank-line subtitle cards and preserves single line breaks inside a card', () => {
  assert.deepEqual(readSubtitleCards('一行目\n二行目\n\n次のカード'), ['一行目\n二行目', '次のカード']);
});

test('writes cards using blank lines without changing scene structure', () => {
  assert.equal(writeSubtitleCards(['カード1', 'カード2']), 'カード1\n\nカード2');
});

test('splits a card near natural punctuation', () => {
  const result = splitSubtitleCardNaturally(['今日はここまで、明日は次へ進みます。'], 0);
  assert.equal(result.length, 2);
  assert.equal(result.join(''), '今日はここまで、明日は次へ進みます。');
});

test('merges adjacent cards and keeps text content', () => {
  assert.deepEqual(mergeSubtitleCardWithNext(['前半。', '後半。', '第三。'], 0), ['前半。後半。', '第三。']);
});

test('replace refuses empty card text so an accidental blank does not delete content', () => {
  assert.deepEqual(replaceSubtitleCard(['残す'], 0, '   '), ['残す']);
});

test('timing is evenly derived inside the existing scene duration', () => {
  assert.deepEqual(subtitleCardTiming(6, 3, 1), { startSec: 2, endSec: 4, durationSec: 2 });
});
