import test from 'node:test';
import assert from 'node:assert/strict';
import { extractShortsHighlights } from '../shortsHighlight.js';

test('extractShortsHighlights returns ranked contiguous candidates', () => {
  const project = { scenes: [
    { durationSec: 10, text: '導入です。' },
    { durationSec: 12, subtitleText: '実は、ここに大きな理由があります！' },
    { durationSec: 12, subtitleText: 'しかし結果は予想外でした。' },
    { durationSec: 10, subtitleText: '結論はこれです。' },
    { durationSec: 20, text: '補足説明です。' }
  ]};
  const result = extractShortsHighlights(project, { targetSec: 40, minSec: 20, maxSec: 60, limit: 3 });
  assert.ok(result.length > 0);
  assert.ok(result[0].durationSec >= 20 && result[0].durationSec <= 60);
  assert.ok(result[0].score >= result[result.length - 1].score);
  assert.ok(result[0].sceneNumbers.every((number, index, list) => index === 0 || number === list[index - 1] + 1));
});

test('extractShortsHighlights prefers hook-rich text over plain text when duration is similar', () => {
  const project = { scenes: [
    { durationSec: 20, text: '今日は内容を説明します。' },
    { durationSec: 20, text: '実は、知らないと損する理由があります！' },
    { durationSec: 20, text: '通常の説明が続きます。' }
  ]};
  const result = extractShortsHighlights(project, { targetSec: 20, minSec: 15, maxSec: 25, limit: 3 });
  assert.equal(result[0].startIndex, 1);
});

test('extractShortsHighlights does not mutate the source project', () => {
  const project = { scenes: [{ durationSec: 20, text: 'なぜこうなるのでしょう？' }] };
  const before = JSON.stringify(project);
  extractShortsHighlights(project);
  assert.equal(JSON.stringify(project), before);
});

test('extractShortsHighlights returns empty list when no scenes exist', () => {
  assert.deepEqual(extractShortsHighlights({ scenes: [] }), []);
});
