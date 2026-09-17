import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoProductionProject } from '../autoProductionProject.js';

const request = `
# 目的
伝わる形にする
# トーン
落ち着いた教育ドキュメンタリー

Scene 1
0:00–0:04.52
ナレーション：
「正しいことを言っているのに、なぜか人が動いてくれない。」
字幕：
正しいことを言っているのに、
なぜか人が動いてくれない。
映像：
現代の会議。女性が説明しているが伝わっていない。
目的：問題を提示する

Scene 2
0:04.52–0:12.91
ナレーション：
「ナイチンゲールも、そんな大きな壁に向き合いました。」
映像：
クリミア戦争の病院をAI再現する。
- 赤十字を描かない
目的：歴史へ移る
`;

test('separates timing, narration, subtitle and visual instructions', () => {
  const result = createAutoProductionProject({ requestText: request, title: 'test', targetDurationSec: 60 });
  assert.equal(result.ok, true);
  assert.equal(result.project.scenes.length, 2);

  const first = result.project.scenes[0];
  assert.equal(first.durationSec, 4.52);
  assert.equal(first.speechText, '正しいことを言っているのに、なぜか人が動いてくれない。');
  assert.equal(first.text, '正しいことを言っているのに、\nなぜか人が動いてくれない。');
  assert.equal(first.subtitleText, '正しいことを言っているのに、\nなぜか人が動いてくれない。');
  assert.equal(first.productionDirection.visualDirection, '現代の会議。女性が説明しているが伝わっていない。');
  assert.doesNotMatch(first.speechText, /0:00|ナレーション|字幕|映像/);
  assert.doesNotMatch(first.subtitleText, /0:00|ナレーション|映像/);

  const second = result.project.scenes[1];
  assert.equal(second.durationSec, 8.39);
  assert.equal(second.speechText, 'ナイチンゲールも、そんな大きな壁に向き合いました。');
  assert.ok(second.productionDirection.rules.includes('赤十字を描かない'));
});
