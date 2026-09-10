import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../voice-lab.html', import.meta.url), 'utf8');

test('Voice Lab初期表示は読み込み済みprojectを再開状態計算へ渡す', () => {
  assert.match(html, /await updateResumeSummary\(project\);/);
  assert.match(html, /updateResumeSummary\(projectOverride=null\)/);
  assert.match(html, /projectOverride \|\| currentProject \|\| await getProject\(projectId\)/);
});

test('声変更時は同じ読み込み済みprojectで再開状態を再計算する', () => {
  assert.match(html, /updateResumeSummary\(currentProject\)/);
});
