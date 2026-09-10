import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../voice-lab.html', import.meta.url), 'utf8');

test('Voice Lab初期表示では大容量projectや旧音声Blobを自動読込しない', () => {
  assert.doesNotMatch(html, /loadRegistered\(\);/);
  assert.doesNotMatch(html, /await loadProjectIntoVoiceLab\(\);\s*\n\$\('#voice'\)/);
  assert.match(html, /画面を開いただけでは大容量音声を読み込みません/);
});

test('音声エンジン準備時にprojectを1回だけ遅延読込する', () => {
  assert.match(html, /プロジェクト情報を読み込み中/);
  assert.match(html, /await loadProjectIntoVoiceLab\(\);/);
  assert.match(html, /if\(currentProject\) return currentProject;/);
});

test('再開状態計算と生成処理は読み込み済みprojectを再利用する', () => {
  assert.match(html, /const project=projectOverride \|\| currentProject;/);
  assert.match(html, /const project=currentProject \|\| await loadProjectIntoVoiceLab\(\);/);
  assert.match(html, /updateResumeSummary\(currentProject\)/);
});
