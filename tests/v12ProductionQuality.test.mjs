import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoScenes, splitSubtitleTimelineCards } from '../qualityLogic.js';

const hokusai=`「もう、このくらいでいい。」

そう思った瞬間、
成長は止まるのかもしれない。

世界に知られる絵師、葛飾北斎。

しかし北斎自身は、
70歳を過ぎても、
まだ自分は完成していないと考えていた。

75歳ごろに刊行した『富嶽百景』で、
北斎はさらに先を見ていた。

90歳になれば、もっと奥義に近づく。
100歳を超えれば、
一点一画まで生きるようになるだろう、と。

そして北斎は、
90歳まで絵を描き続けた。

「もう遅い」ではない。

昨日より、ほんの少し先へ。

上達を止めるのは、
年齢ではなく、
「このくらいでいい」という自分なのかもしれない。`;

test('55-60秒Shortsの意味段落を過剰なScene数へ分割しない',()=>{
  const scenes=splitIntoScenes(hokusai,58);
  assert.ok(scenes.length>=7,`too few: ${scenes.length}`);
  assert.ok(scenes.length<=9,`too many: ${scenes.length}`);
  assert.match(scenes.map(x=>x.text).join(''),/葛飾北斎/);
});

test('短いhook段落は次の意味段落と統合できる',()=>{
  const scenes=splitIntoScenes('「もう、このくらいでいい。」\n\nそう思った瞬間、成長は止まるのかもしれない。',12);
  assert.ok(scenes.length<=2);
});

test('手動改行内の長すぎる行も自然な字幕カードへ再分割する',()=>{
  const cards=splitSubtitleTimelineCards('昨日より、ほんの少し先へ。\n上達を止めるのは年齢ではなくこのくらいでいいという自分なのかもしれない。',13,2);
  assert.ok(cards.length>=2);
  assert.ok(cards.every(card=>card.split('\n').length<=2));
  assert.ok(cards.every(card=>card.split('\n').every(line=>Array.from(line).length<=19)));
});

test('明示空行のカード境界は維持する',()=>{
  const cards=splitSubtitleTimelineCards('第一カードです。\n\n第二カードです。',13,2);
  assert.deepEqual(cards,['第一カードです。','第二カードです。']);
});
