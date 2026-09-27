import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('prototype auto-asset action is limited to production-request projects and explicit user action', async () => {
  const source=await readFile(new URL('../main.js',import.meta.url),'utf8');
  assert.match(source,/project\.autoProduction\?\.mode==="production-request"/);
  assert.match(source,/id="autoAcquireAssets"/);
  assert.match(source,/Library of Congressへ素材検索・権利情報確認/);
  assert.match(source,/confirm\("Library of Congressへ素材検索・権利情報確認を行います/);
  assert.match(source,/await runMultiSceneAssetPipeline\(project\)/);
  assert.match(source,/await saveProject\(project\)/);
  assert.match(source,/autoAcquireRunning/);
  assert.doesNotMatch(source,/createAutoProductionProject[\s\S]{0,500}runMultiSceneAssetPipeline/);
});
