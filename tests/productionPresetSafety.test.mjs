import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionPreset, applyProductionPreset } from '../productionPreset.js';

test('preset excludes project-specific BGM references', () => {
  const preset = createProductionPreset({ bgm: { enabled: true, volume: 0.2, loop: true, audioData: 'data:x', dataUrl: 'data:y', audioAssetId: 'asset-1', assetId: 'asset-2', fileName: 'song.mp3', license: 'CC0' } });
  assert.equal(preset.version, 2);
  assert.equal(preset.settings.bgm.volume, 0.2);
  assert.equal(preset.settings.bgm.license, 'CC0');
  for (const key of ['audioData','dataUrl','audioAssetId','assetId','fileName']) assert.equal(preset.settings.bgm[key], undefined);
});

test('applying preset preserves current project BGM asset while applying reusable settings', () => {
  const project = { bgm: { audioAssetId: 'current-audio', fileName: 'current.mp3', volume: 0.5 } };
  const preset = { version: 2, settings: { bgm: { volume: 0.15, loop: true } } };
  const next = applyProductionPreset(project, preset);
  assert.equal(next.bgm.audioAssetId, 'current-audio');
  assert.equal(next.bgm.fileName, 'current.mp3');
  assert.equal(next.bgm.volume, 0.15);
  assert.equal(next.bgm.loop, true);
});

test('legacy preset cannot inject stale BGM asset references', () => {
  const project = { bgm: { audioAssetId: 'current' } };
  const legacy = { version: 1, settings: { bgm: { audioAssetId: 'stale', audioData: 'old', volume: 0.1 } } };
  const next = applyProductionPreset(project, legacy);
  assert.equal(next.bgm.audioAssetId, 'current');
  assert.equal(next.bgm.audioData, undefined);
  assert.equal(next.bgm.volume, 0.1);
});
