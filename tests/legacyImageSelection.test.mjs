import test from 'node:test';
import assert from 'node:assert/strict';
import { promoteLegacySceneImage } from '../mediaLibrary.js';
import { recordSceneImageSelection } from '../decisionLog.js';

const legacyImageData = 'data:image/png;base64,TEVHQUNZ';
const selectedImageData = 'data:image/png;base64,U0VMRUNURUQ=';

test('legacy scene replacement records the promoted legacy asset as proposal', () => {
  const project = {
    id: 'p-legacy-image',
    platform: 'youtube-shorts',
    aspectRatio: '9:16',
    learning: { decisions: [] },
    mediaLibrary: [
      { id: 'asset-selected', type: 'image', data: selectedImageData }
    ],
    scenes: [
      { id: 'scene-1', text: 'legacy image scene', imageData: legacyImageData }
    ]
  };
  const scene = project.scenes[0];
  const beforeAssetId = scene.imageAssetId || null;
  const candidateAssetIds = project.mediaLibrary.map(asset => asset.id);

  const promoted = promoteLegacySceneImage(project, scene, {
    createId: () => 'legacy-promoted',
    now: () => '2026-09-04T00:00:00.000Z'
  });
  scene.imageAssetId = 'asset-selected';
  delete scene.imageData;

  const record = recordSceneImageSelection(project, {
    sceneId: scene.id,
    beforeAssetId,
    afterAssetId: 'asset-selected',
    sceneIndex: 0,
    candidateAssetIds
  }, {
    createId: () => 'decision-legacy-image',
    now: () => '2026-09-04T00:01:00.000Z'
  });

  assert.equal(promoted.id, 'asset-legacy-promoted');
  assert.equal(project.learning.decisions.length, 1);
  assert.deepEqual(record.proposal, { imageAssetId: 'asset-legacy-promoted' });
  assert.deepEqual(record.finalDecision, { imageAssetId: 'asset-selected' });
  assert.ok(record.assetIds.includes('asset-legacy-promoted'));
  assert.ok(record.assetIds.includes('asset-selected'));
});

test('legacy promotion to the same existing asset creates no decision', () => {
  const project = {
    id: 'p-legacy-same',
    learning: { decisions: [] },
    mediaLibrary: [
      { id: 'asset-same', type: 'image', data: legacyImageData }
    ],
    scenes: [
      { id: 'scene-1', text: 'same legacy image', imageData: legacyImageData }
    ]
  };
  const scene = project.scenes[0];
  const beforeAssetId = scene.imageAssetId || null;
  const candidateAssetIds = project.mediaLibrary.map(asset => asset.id);

  const promoted = promoteLegacySceneImage(project, scene);
  scene.imageAssetId = 'asset-same';
  delete scene.imageData;

  const record = recordSceneImageSelection(project, {
    sceneId: scene.id,
    beforeAssetId,
    afterAssetId: 'asset-same',
    sceneIndex: 0,
    candidateAssetIds
  });

  assert.equal(promoted.id, 'asset-same');
  assert.equal(record, null);
  assert.equal(project.learning.decisions.length, 0);
});
