import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../voice-lab.html', import.meta.url), 'utf8');

test('Voice Lab初期表示では大容量projectや旧音声Blobを自動読込しない', () => {
  assert.doesNotMatch(html, /loadRegistered\(\);/);
  assert.doesNotMatch(html, /await loadProject\(\);\s*\n.*voice.*onchange/s);
  assert.match(html, /画面を開いただけでは大容量のプロジェクト音声を読み込みません/);
});

test('音声エンジン準備時にprojectを遅延読込し同一page内では再利用する', () => {
  assert.match(html, /プロジェクト情報を読み込み中/);
  assert.match(html, /await loadProject\(\);/);
  assert.match(html, /if\(currentProject\)return currentProject;/);
});

test('Voice LabはScene別ナレーションへ一本化する', () => {
  assert.match(html, /シーン別ナレーションに一本化/);
  assert.doesNotMatch(html, /この音声を動画用ナレーションに登録/);
  assert.doesNotMatch(html, /全文1本ナレーション（任意）/);
  assert.doesNotMatch(html, /creator-os-audio/);
});

test('再開状態計算とScene生成は読み込み済みprojectを再利用する', () => {
  assert.match(html, /const project=projectOverride\|\|currentProject;/);
  assert.match(html, /const project=currentProject\|\|await loadProject\(\);/);
  assert.match(html, /updateResumeSummary\(currentProject\)/);
});
