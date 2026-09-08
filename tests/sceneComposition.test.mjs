import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoScenes } from '../qualityLogic.js';

test('短い文を句点ごとにScene化せず同じ映像テーマへまとめる', () => {
  const scenes = splitIntoScenes('短い一文。短い二文。短い三文。短い四文。短い五文。', 20);
  assert.ok(scenes.length < 5);
  assert.equal(scenes.map(scene => scene.text).join(''), '短い一文。短い二文。短い三文。短い四文。短い五文。');
});

test('空行はユーザーが示した意味の区切りとしてScene境界を守る', () => {
  const scenes = splitIntoScenes('前半の話です。まだ前半です。\n\nここから後半です。続きます。', 30);
  assert.ok(scenes.length >= 2);
  const boundary = scenes.findIndex(scene => scene.text.startsWith('ここから後半'));
  assert.ok(boundary > 0);
});

test('転換語は十分な前文がある場合に新しい映像Beatを作る', () => {
  const scenes = splitIntoScenes('北斎は絵を描き続けました。多くの作品を残しました。しかし本人はまだ完成していないと考えていました。さらに先を見ていました。', 30);
  assert.ok(scenes.some(scene => scene.text.startsWith('しかし')));
});

test('Scene尺は文章量に応じて配分し最低2秒を確保する', () => {
  const scenes = splitIntoScenes('短い文。こちらは少し長めの文章として複数の情報を含んでいます。最後です。', 20);
  assert.ok(scenes.every(scene => scene.durationSec >= 2));
  assert.ok(scenes.reduce((sum, scene) => sum + scene.durationSec, 0) >= 18);
});
