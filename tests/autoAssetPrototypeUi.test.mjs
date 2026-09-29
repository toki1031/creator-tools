import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('prototype auto-asset action is limited to production-request projects and explicit user action', async () => {
  const source=await readFile(new URL('../main.js',import.meta.url),'utf8');
  assert.match(source,/project\.autoProduction\?\.mode==="production-request"/);
  assert.match(source,/id="autoAcquireAssets"/);
  assert.match(source,/実物史料・文書はLibrary of Congress、AI再現・現代ビジュアルは無料のWorkers AI/);
  assert.match(source,/confirm\("Sceneごとに素材を自動取得します/);
  assert.match(source,/normalizeLegacyAutoProductionProject\(project\)/);
  assert.match(source,/await runMultiSceneAssetPipeline\(project\)/);
  assert.match(source,/await saveProject\(project\)/);
  assert.match(source,/autoAcquireRunning/);
  assert.doesNotMatch(source,/createAutoProductionProject[\s\S]{0,500}runMultiSceneAssetPipeline/);
});
